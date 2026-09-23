import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { apenasDigitos, formatarCnpj, buscarCnpj } from '@/lib/brasilApi'
import { withRateLimitRetry, sleep } from '@/lib/pocketbase/rateLimit'
import type { Fornecedor, PlanoConta, CentroCusto, ContaPagar } from '@/types/erp'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Calendar,
  Building2,
  FileCheck2,
} from 'lucide-react'

export interface ImportadorContasPagarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  fornecedores: Fornecedor[]
  categorias: PlanoConta[]
  centrosCusto: CentroCusto[]
  contasExistentes: ContaPagar[]
  onImportComplete: () => Promise<void>
}

export interface ColumnMappingPagar {
  vencimento: string
  fornecedor: string
  descricao: string
  valor: string
  valorPago: string
  dataPagamento: string
  formaPagamento: string
  status: string
  centroCusto: string
  categoria: string
  documento: string
  cnpj: string
}

export interface SheetCompetencia {
  name: string
  selected: boolean
  ano: number
  mes: number // 1 to 12
  sufixo: string
  headerRowIndex: number // 1-based
  headers: string[]
  totalRows: number
}

export interface SheetImportResult {
  aba: string
  linhasLidas: number
  importados: number
  duplicados: number
  errosCount: number
  vaziaOuSemCabecalho?: boolean
  motivoVazia?: string
}

export interface ContasPagarImportSummary {
  totalLidos: number
  importados: number
  duplicadosPulados: number
  pagasBaixadas: number
  emAberto: number
  fornecedoresCriados: string[]
  erros: { linha: number; aba: string; motivo: string }[]
  detalhesPorAba: SheetImportResult[]
}

const MESES_MAP: Record<string, number> = {
  JANEIRO: 1,
  JAN: 1,
  FEVEREIRO: 2,
  FEV: 2,
  MARCO: 3,
  MARÇO: 3,
  MAR: 3,
  ABRIL: 4,
  ABR: 4,
  MAIO: 5,
  MAI: 5,
  JUNHO: 6,
  JUN: 6,
  JULHO: 7,
  JUL: 7,
  AGOSTO: 8,
  AGO: 8,
  SETEMBRO: 9,
  SETEMB: 9,
  SETE: 9,
  SET: 9,
  SEPTEMBER: 9,
  SEP: 9,
  OUTUBRO: 10,
  OUTUB: 10,
  OUTU: 10,
  OUT: 10,
  OCTOBER: 10,
  OCT: 10,
  NOVEMBRO: 11,
  NOVEMB: 11,
  NOVE: 11,
  NOV: 11,
  NOVEMBER: 11,
  DEZEMBRO: 12,
  DEZEMB: 12,
  DEZE: 12,
  DEZ: 12,
  DECEMBER: 12,
  DEC: 12,
}

// Ordenados do nome mais longo para o mais curto para evitar match prefixal inadequado
const MESES_ENTRIES_ORDENADOS = Object.entries(MESES_MAP).sort((a, b) => b[0].length - a[0].length)

export function inferirCompetenciaAba(sheetName: string): {
  ano: number
  mes: number
  sufixo: string
} {
  const currentYear = new Date().getFullYear()
  const raw = String(sheetName || '').trim()

  // Extrair sufixo .2 ou similar (ex: .2, _2, -2 ou folhas duplicadas)
  let sufixo = ''
  const sufixoMatch = raw.match(/(?:[._\-\s])(\d+)$/)
  if (sufixoMatch) {
    sufixo = `.${sufixoMatch[1]}`
  }

  // Normalizar removendo acentos
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  // Inferir ano (4 dígitos como 2026, 2027 ou 2 dígitos como 26, 27)
  let ano = 2026
  const ano4Match = norm.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/)
  if (ano4Match) {
    ano = parseInt(ano4Match[1], 10)
  } else {
    const ano2Match = norm.match(/[_\s-](\d{2})(?:\.|$)/)
    if (ano2Match) {
      const yy = parseInt(ano2Match[1], 10)
      ano = 2000 + yy
    } else {
      ano = currentYear >= 2020 && currentYear <= 2035 ? currentYear : 2026
    }
  }

  if (ano < 2020 || ano > 2035) {
    ano = 2026
  }

  // Inferir mês procurando termos ordenados por especificidade (longest first)
  let mes = 1
  let encontrouMes = false

  for (const [nomeMes, numMes] of MESES_ENTRIES_ORDENADOS) {
    const regex = new RegExp(`(?:^|[^A-Z0-9])${nomeMes}(?:[^A-Z0-9]|$)`, 'i')
    if (regex.test(norm)) {
      mes = numMes
      encontrouMes = true
      break
    }
  }

  // Caso o nome seja colado sem separador, ex.: "SETEMBRO2026", "OUTUBRO2026", "NOVEMBRO2026", "DEZEMBRO2026"
  if (!encontrouMes) {
    for (const [nomeMes, numMes] of MESES_ENTRIES_ORDENADOS) {
      if (norm.includes(nomeMes)) {
        mes = numMes
        encontrouMes = true
        break
      }
    }
  }

  // Fallback se contiver números de mês no formato 09_2026 ou 09-2026 ou 2026_09
  if (!encontrouMes) {
    const numMesMatch =
      norm.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[-_])20\d{2}/) ||
      norm.match(/20\d{2}(?:[-_])(0?[1-9]|1[0-2])/)
    if (numMesMatch) {
      mes = parseInt(numMesMatch[1], 10)
      encontrouMes = true
    }
  }

  return { ano, mes, sufixo }
}

// Normalização profunda de rótulos e células para comparação tolerante
export function normalizarNomeColuna(str: any): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/\u00A0/g, ' ') // NBSP -> space
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ') // remove pontuações, parênteses, barras, etc
    .replace(/\s+/g, ' ')
    .trim()
}

// Expande todas as células mescladas (ws['!merges']) copiando o valor da célula mestre (topo-esquerda)
// para todas as outras células do intervalo mesclado.
// Isso evita que linhas subsequentes de blocos do mesmo dia/favorecido fiquem com células vazias.
export function desdobrarCelulasMescladas(ws: XLSX.WorkSheet): void {
  if (!ws || !ws['!merges'] || !Array.isArray(ws['!merges']) || ws['!merges'].length === 0) {
    return
  }

  ws['!merges'].forEach((range: XLSX.Range) => {
    const startCellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c })
    const masterCell = ws[startCellAddress]
    if (!masterCell || masterCell.v === undefined || masterCell.v === null || masterCell.v === '') {
      return
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        // Pular a própria célula mestre
        if (r === range.s.r && c === range.s.c) continue

        const cellAddr = XLSX.utils.encode_cell({ r, c })
        // Se a célula já tiver valor diferente de vazio, preserva; caso contrário clona da mestre
        if (
          !ws[cellAddr] ||
          ws[cellAddr].v === undefined ||
          ws[cellAddr].v === null ||
          ws[cellAddr].v === ''
        ) {
          ws[cellAddr] = {
            t: masterCell.t,
            v: masterCell.v,
            w: masterCell.w,
            z: masterCell.z,
          }
        }
      }
    }
  })
}

// Regex padronizadas de sinônimos para identificação de colunas em qualquer aba
export const REGEX_COL_VENCIMENTO =
  /^(?:DT\s*VENC|DATA\s*VENC|VENCIMENTO|VENC|DATA|DT|DIA|PREVISAO|PREV)\b|VENC|DT\s*VENC|DATA\s*VENC|PREVISAO/i
export const REGEX_COL_VALOR =
  /VALOR\s*REALIZADO|VALOR\s*TOTAL|VALOR\s*A\s*PAGAR|VALOR\s*R\$?|A\s*PAGAR|REALIZADO|PREVISTO|VALOR|TOTAL|LIQUIDO|BRUTO|R\$|DEBITO|DESPESA|CUSTO/i
export const REGEX_COL_VALOR_PAGO = /VALOR\s*PAGO|PAGO|PG|LIQUID/i
export const REGEX_COL_DATA_PAGAMENTO = /DT\s*PAG|DATA\s*PAG|BAIXA|DATA\s*BAIXA|LIQUID|QUITAC/i
export const REGEX_COL_FORNECEDOR =
  /FORNECEDOR|FAVORECIDO|CREDOR|BENEFICIARIO|EMPRESA|NOME|HISTORICO\s*FAVORECIDO|DESTINATARIO/i
export const REGEX_COL_DESCRICAO =
  /HISTORICO|DESCRICAO|DESC|SERV|PROD|REFERENCIA|ITEM|DISCRIM|DETALHE/i

export function detectarLinhaCabecalho(
  matrix: any[][],
  startRow: number = 0,
  maxScanCount: number = 50,
): number {
  if (!matrix || matrix.length === 0) return 1

  const sRow = Math.max(0, startRow)
  // Buscar dinamicamente a partir de startRow
  const maxScan = Math.min(matrix.length, sRow + maxScanCount)

  let bestRow = -1
  let bestScore = 0
  let bestHeaderCount = 0

  for (let r = sRow; r < maxScan; r++) {
    const row = matrix[r] || []
    if (!Array.isArray(row) || row.length === 0) continue

    const texts = row.map((cell) => normalizarNomeColuna(cell)).filter((t) => t.length > 0)

    if (texts.length < 2) continue

    const rowJoin = texts.join(' ')
    const isPureTitle =
      texts.length <= 2 &&
      (rowJoin.includes('RELATORIO') ||
        rowJoin.includes('CONSOLIDADO') ||
        rowJoin.includes('PEDREIRA') ||
        rowJoin.includes('EXTRATO'))
    if (isPureTitle) continue

    const hasVenc = texts.some(
      (t) =>
        t === 'VENC' ||
        t === 'VENCIMENTO' ||
        t === 'DT VENC' ||
        t === 'DATA VENC' ||
        t === 'DATA VENCIMENTO' ||
        t === 'DATA' ||
        t === 'DT' ||
        t === 'DIA' ||
        t === 'PREVISAO' ||
        t === 'PREV' ||
        t.includes('VENC') ||
        t.includes('DATA') ||
        t.includes('EMISS') ||
        t.includes('PREVIS'),
    )
    const hasForn = texts.some(
      (t) =>
        t === 'FORNECEDOR' ||
        t === 'FAVORECIDO' ||
        t === 'CREDOR' ||
        t.includes('FORN') ||
        t.includes('FAVOREC') ||
        t.includes('CREDOR') ||
        t.includes('BENEFICI') ||
        t.includes('EMPRESA') ||
        t.includes('NOME') ||
        t.includes('HISTORICO FAVORECIDO') ||
        t.includes('DESTINAT'),
    )
    const hasVal = texts.some(
      (t) =>
        t === 'VALOR' ||
        t === 'VALOR R' ||
        t === 'VALOR TOTAL' ||
        t === 'VALOR PAGO' ||
        t === 'VALOR REALIZADO' ||
        t === 'REALIZADO' ||
        t === 'A PAGAR' ||
        t === 'PREVISTO' ||
        t === 'LIQUIDO' ||
        t === 'BRUTO' ||
        t === 'TOTAL' ||
        t === 'DEBITO' ||
        t === 'DESPESA' ||
        t === 'CUSTO' ||
        t.includes('VALOR') ||
        t.includes('PAGAR') ||
        t.includes('REALIZAD') ||
        t.includes('PREVIST') ||
        t.includes('TOTAL') ||
        t.includes('PAGO') ||
        t.includes('BRUTO') ||
        t.includes('LIQUID') ||
        t.includes('DEBIT') ||
        t.includes('DESPES'),
    )
    const hasDesc = texts.some(
      (t) =>
        t === 'DESCRICAO' ||
        t === 'HISTORICO' ||
        t === 'HISTORICO FAVORECIDO' ||
        t.includes('HIST') ||
        t.includes('DESC') ||
        t.includes('REF') ||
        t.includes('CONTA') ||
        t.includes('DISCRIM') ||
        t.includes('ITEM') ||
        t.includes('SERVIC') ||
        t.includes('PRODUTO') ||
        t.includes('DETALH'),
    )
    const hasDoc = texts.some((t) => t.includes('DOC') || t.includes('NF') || t.includes('NOTA'))
    const hasStatus = texts.some(
      (t) => t.includes('STATUS') || t.includes('SITUAC') || t.includes('PAGO'),
    )

    let score = 0
    let validHeaderCount = 0
    if (hasVenc) {
      score += 4
      validHeaderCount++
    }
    if (hasVal) {
      score += 4
      validHeaderCount++
    }
    if (hasForn) {
      score += 3
      validHeaderCount++
    }
    if (hasDesc) {
      score += 2
      validHeaderCount++
    }
    if (hasDoc) {
      score += 1
      validHeaderCount++
    }
    if (hasStatus) {
      score += 1
      validHeaderCount++
    }

    if (
      rowJoin.startsWith('TOTAL') ||
      rowJoin.startsWith('SUBTOTAL') ||
      rowJoin.startsWith('SALDO')
    ) {
      score -= 5
    }

    // Regra B1: score >= 4 com desempate por número de termos válidos e número de colunas
    // garantindo que cabeçalhos tabulares reais vençam banners genéricos
    if (score >= 4) {
      const isBetter =
        score > bestScore ||
        (score === bestScore &&
          (validHeaderCount > bestHeaderCount ||
            (validHeaderCount === bestHeaderCount &&
              texts.length > (matrix[bestRow - 1]?.length || 0))))

      if (isBetter) {
        bestScore = score
        bestHeaderCount = validHeaderCount
        bestRow = r + 1
      }
    }
  }

  if (bestRow > 0) {
    return bestRow
  }

  // Fallback: primeira linha com pelo menos 2 células de texto não vazias
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const row = matrix[r] || []
    const filled = row.filter((c) => String(c ?? '').trim().length > 0)
    if (filled.length >= 2) return r + 1
  }

  return 1
}

export function parseValorPagar(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val)
  if (val === null || val === undefined || val === '') return 0

  let raw = String(val)
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!raw) return 0

  // Detectar formato contábil entre parênteses: ex. "(R$ 1.500,00)" ou "(1500)"
  const isAccountingNegative = /^\s*\(.+\)\s*$/.test(raw)

  let str = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,+-]/g, '')
    .trim()

  if (!str) return 0

  // Se tiver ambos vírgula e ponto:
  // ex: "1.250,50" -> vírgula é decimal
  // ex: "1,250.50" -> ponto é decimal
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      // 1.250,50 -> remove todos os pontos, troca vírgula por ponto
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,250.50 -> remove todas as vírgulas
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: "1250,50" -> "1250.50"
    str = str.replace(',', '.')
  }

  const num = parseFloat(str)
  if (isNaN(num)) return 0
  // Valores negativos ou formato contábil convertidos para positivo
  return Math.abs(num)
}

const MESES_INGLES_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const MESES_PT_MAP: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

export function parseDataPagar(val: any, anoFallback?: number, mesFallback?: number): string {
  // Safe helper to construct UTC noon ISO string
  const toUtcNoon = (y: number, m: number, d: number) => {
    const clampedDay = Math.min(31, Math.max(1, d))
    return new Date(Date.UTC(y, m - 1, clampedDay, 12, 0, 0)).toISOString()
  }

  if (val === null || val === undefined || val === '') {
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  // 1. Objeto Date (ex: lido pelo XLSX com cellDates: true)
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      // Usar a data do calendário do Date sem shift indesejado de timezone
      // Se a data veio em UTC meia-noite (como XLSX lê células de data), getUTCDate() tem o dia exato
      // Se tiver horas > 20 em UTC com offset negativo local, os métodos UTC ou locais podem divergir:
      // XLSX com cellDates: true gera a data como UTC midnight (ex: 2026-08-31 00:00:00 UTC).
      // Então getUTCFullYear / getUTCMonth + 1 / getUTCDate reflete o dia exato da célula!
      const y = val.getUTCFullYear()
      const m = val.getUTCMonth() + 1
      const d = val.getUTCDate()
      return toUtcNoon(y, m, d)
    }
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  // 2. Número serial Excel (ex: 46265)
  if (typeof val === 'number') {
    if (!isNaN(val) && val > 0) {
      // Excel epoch: 1899-12-30 UTC
      const ms = Math.round((val - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        return toUtcNoon(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      }
    }
  }

  const str = String(val).trim()
  if (!str) {
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  // 3. String date em formato "Mon Jun 01 2026" ou "Wed Mar 06 2024" ou "Mon Jun 01 2026 00:00:00 GMT-0300"
  // Padrão: (DiaSemana) (MêsInglês) (Dia) (Ano) ...
  const textDateMatch = str.match(
    /^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/,
  )
  if (textDateMatch) {
    const rawMesNome = textDateMatch[1].toLowerCase()
    const mesNum = MESES_INGLES_MAP[rawMesNome] || MESES_PT_MAP[rawMesNome]
    if (mesNum) {
      const diaNum = parseInt(textDateMatch[2], 10)
      let anoNum = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : anoFallback || 2026
      if (anoNum < 100) anoNum += 2000
      return toUtcNoon(anoNum, mesNum, diaNum)
    }
  }

  // 4. Dia apenas (ex.: "5", "12", "28") acompanhado de competência
  if (/^\d{1,2}$/.test(str)) {
    const dia = parseInt(str, 10)
    if (dia >= 1 && dia <= 31) {
      const y = anoFallback || 2026
      const m = mesFallback || 1
      return toUtcNoon(y, m, dia)
    }
  }

  // 5. Formato brasileiro DD/MM/YYYY ou DD/MM/YY ou DD-MM-YYYY ou apenas DD/MM
  const brMatch = str.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/)
  if (brMatch) {
    const d = parseInt(brMatch[1], 10)
    const m = parseInt(brMatch[2], 10)
    let y = brMatch[3] ? parseInt(brMatch[3], 10) : anoFallback || 2026
    if (y < 100) y += 2000
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return toUtcNoon(y, m, d)
    }
  }

  // 5b. Formato sem separador DDMMYYYY (8 dígitos) ex: "01102026"
  const digits8Match = str.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (digits8Match) {
    const d = parseInt(digits8Match[1], 10)
    const m = parseInt(digits8Match[2], 10)
    const y = parseInt(digits8Match[3], 10)
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2035) {
      return toUtcNoon(y, m, d)
    }
  }

  // 6. Formato ISO YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    const d = parseInt(isoMatch[3], 10)
    if (m >= 1 && m <= 12) {
      return toUtcNoon(y, m, d)
    }
  }

  // 7. Data por extenso em Português: "01 de Junho de 2026" ou "01/Jun/2026"
  const ptExtensoMatch = str.match(/^(\d{1,2})\s*(?:de\s+)?([A-Za-zçÇ]+)(?:\s*(?:de\s+)?(\d{4}))?/i)
  if (ptExtensoMatch) {
    const d = parseInt(ptExtensoMatch[1], 10)
    const nomeMes = ptExtensoMatch[2].slice(0, 3).toLowerCase()
    const mesNum = MESES_PT_MAP[nomeMes] || MESES_INGLES_MAP[nomeMes]
    if (mesNum && d >= 1 && d <= 31) {
      const y = ptExtensoMatch[3] ? parseInt(ptExtensoMatch[3], 10) : anoFallback || 2026
      return toUtcNoon(y, mesNum, d)
    }
  }

  // 8. Tentar parse genérico com new Date(str)
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    // Para evitar que "2026-08-31" sofra off-by-one de fuso local, pegamos os componentes:
    // Se a string tem formato date-only, Date.parse assume UTC em browsers modernos
    // Se tem formato local, pega os componentes locais
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str)
    const y = isIsoDateOnly ? parsed.getUTCFullYear() : parsed.getFullYear()
    const m = isIsoDateOnly ? parsed.getUTCMonth() + 1 : parsed.getMonth() + 1
    const d = isIsoDateOnly ? parsed.getUTCDate() : parsed.getDate()
    return toUtcNoon(y, m, d)
  }

  // 9. Fallback com competência
  if (anoFallback && mesFallback) {
    return toUtcNoon(anoFallback, mesFallback, 1)
  }

  const now = new Date()
  return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}

export function ImportadorContasPagarModal({
  open,
  onOpenChange,
  empresaId,
  fornecedores,
  categorias,
  centrosCusto,
  contasExistentes,
  onImportComplete,
}: ImportadorContasPagarModalProps) {
  // Wizard steps:
  // 1: Upload Arquivo
  // 2: Seleção e Competência das Abas
  // 3: Mapeamento de Colunas e Regras
  // 4: Processando e Gravando
  // 5: Resumo e Conclusão
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetsConfig, setSheetsConfig] = useState<SheetCompetencia[]>([])

  // Raw preview
  const [activeSheetPreview, setActiveSheetPreview] = useState<string>('')
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])

  // Column Mapping
  const [mapping, setMapping] = useState<ColumnMappingPagar>({
    vencimento: '',
    fornecedor: '',
    descricao: '',
    valor: '',
    valorPago: '',
    dataPagamento: '',
    formaPagamento: '',
    status: '',
    centroCusto: '',
    categoria: '',
    documento: '',
    cnpj: '',
  })

  // Business options
  const [criarFornecedoresNaoEncontrados, setCriarFornecedoresNaoEncontrados] = useState(true)
  const [buscarCnpjBrasilApi, setBuscarCnpjBrasilApi] = useState(true)
  const [classificacaoPadrao, setClassificacaoPadrao] = useState<'auto' | 'Paga' | 'Aberta'>('auto')
  const [categoriaPadraoId, setCategoriaPadraoId] = useState<string>(categorias[0]?.id || '')
  const [centroCustoPadraoId, setCentroCustoPadraoId] = useState<string>('none')
  const [detectarDuplicados, setDetectarDuplicados] = useState(true)

  // Execution
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [summary, setSummary] = useState<ContasPagarImportSummary | null>(null)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetsConfig([])
    setActiveSheetPreview('')
    setSheetHeaders([])
    setPreviewRows([])
    setSummary(null)
    setIsProcessing(false)
    setProgressMsg('')
    setMapping({
      vencimento: '',
      fornecedor: '',
      descricao: '',
      valor: '',
      valorPago: '',
      dataPagamento: '',
      formaPagamento: '',
      status: '',
      centroCusto: '',
      categoria: '',
      documento: '',
      cnpj: '',
    })
  }

  // 1. Upload do Arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      setFile(selectedFile)
      const data = await selectedFile.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: true })

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        toast({
          title: 'Arquivo sem planilhas',
          description: 'O arquivo enviado não possui abas legíveis.',
          variant: 'destructive',
        })
        return
      }

      setWorkbook(wb)

      // Desdobrar células mescladas em todas as abas
      wb.SheetNames.forEach((sName) => {
        const ws = wb.Sheets[sName]
        if (ws) {
          desdobrarCelulasMescladas(ws)
        }
      })

      // Analisar cada aba
      const configs: SheetCompetencia[] = wb.SheetNames.map((sName) => {
        const comp = inferirCompetenciaAba(sName)
        const ws = wb.Sheets[sName]
        const matrix: any[][] = ws
          ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
          : []
        const headerRow = detectarLinhaCabecalho(matrix)
        const headerCells = matrix[headerRow - 1] || []
        const headers = headerCells.map((c, idx) => {
          const val = String(c || '').trim()
          return val || `Coluna_${idx + 1}`
        })

        return {
          name: sName,
          selected: true,
          ano: comp.ano,
          mes: comp.mes,
          sufixo: comp.sufixo,
          headerRowIndex: headerRow,
          headers,
          totalRows: Math.max(0, matrix.length - headerRow),
        }
      })

      setSheetsConfig(configs)

      // Primeira aba como prévia inicial
      const firstConfig = configs[0]
      setActiveSheetPreview(firstConfig.name)
      carregarPreviaAba(wb, firstConfig)

      setStep(2)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir planilha Excel',
        description: err.message || 'Verifique se o arquivo é um .xlsx ou .xls válido.',
        variant: 'destructive',
      })
    }
  }

  // Atualiza a linha de cabeçalho de uma aba específica e recalcula colunas/linhas
  const updateSheetHeaderRow = (sheetName: string, headerRowIndex: number) => {
    if (!workbook) return
    const ws = workbook.Sheets[sheetName]
    if (!ws) return
    desdobrarCelulasMescladas(ws)
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    })
    const safeRow = Math.max(1, Math.min(headerRowIndex, matrix.length || 1))
    const rawHeaders = matrix[safeRow - 1] || []
    const headers = rawHeaders.map((c, idx) => {
      const val = String(c || '').trim()
      return val || `Coluna_${idx + 1}`
    })

    setSheetsConfig((prev) =>
      prev.map((s) => {
        if (s.name !== sheetName) return s
        return {
          ...s,
          headerRowIndex: safeRow,
          headers,
          totalRows: Math.max(0, matrix.length - safeRow),
        }
      }),
    )

    if (activeSheetPreview === sheetName) {
      setSheetHeaders(headers)
      const dataRows = matrix.slice(safeRow)
      const preview = dataRows.slice(0, 5).map((row) => {
        const obj: Record<string, any> = {}
        headers.forEach((h, colIdx) => {
          obj[h] = row[colIdx] ?? ''
        })
        return obj
      })
      setPreviewRows(preview)
    }
  }

  // Carrega cabeçalhos e primeiras linhas de uma aba específica
  const carregarPreviaAba = (wb: XLSX.WorkBook, config: SheetCompetencia) => {
    const ws = wb.Sheets[config.name]
    if (!ws) return

    desdobrarCelulasMescladas(ws)
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    const headerRow = config.headerRowIndex || 1
    const rawHeaders = matrix[headerRow - 1] || []
    const headers: string[] = rawHeaders.map((c, idx) => {
      const val = String(c || '').trim()
      return val || `Coluna_${idx + 1}`
    })

    setSheetHeaders(headers)

    const dataRows = matrix.slice(headerRow)
    const preview = dataRows.slice(0, 5).map((row) => {
      const obj: Record<string, any> = {}
      headers.forEach((h, colIdx) => {
        obj[h] = row[colIdx] ?? ''
      })
      return obj
    })

    setPreviewRows(preview)

    // Heurística de sugestão de mapeamento inteligente com normalização profunda
    const findCol = (regex: RegExp) =>
      headers.find((h) => regex.test(normalizarNomeColuna(h)) || regex.test(h)) || ''
    const descColFound = findCol(REGEX_COL_DESCRICAO) || ''
    const fornColFound = findCol(REGEX_COL_FORNECEDOR) || ''

    setMapping((prev) => ({
      vencimento:
        prev.vencimento && headers.includes(prev.vencimento)
          ? prev.vencimento
          : findCol(REGEX_COL_VENCIMENTO) || headers[0] || '',
      fornecedor:
        prev.fornecedor && headers.includes(prev.fornecedor)
          ? prev.fornecedor
          : fornColFound || descColFound || '',
      descricao:
        prev.descricao && headers.includes(prev.descricao)
          ? prev.descricao
          : descColFound || fornColFound || '',
      valor:
        prev.valor && headers.includes(prev.valor) ? prev.valor : findCol(REGEX_COL_VALOR) || '',
      valorPago:
        prev.valorPago && headers.includes(prev.valorPago)
          ? prev.valorPago
          : findCol(REGEX_COL_VALOR_PAGO) || '',
      dataPagamento:
        prev.dataPagamento && headers.includes(prev.dataPagamento)
          ? prev.dataPagamento
          : findCol(REGEX_COL_DATA_PAGAMENTO) || '',
      formaPagamento:
        prev.formaPagamento && headers.includes(prev.formaPagamento)
          ? prev.formaPagamento
          : findCol(/FORMA|MEIO|TIPO PAG/i) || '',
      status:
        prev.status && headers.includes(prev.status)
          ? prev.status
          : findCol(/STATUS|SITUACAO|COND/i) || '',
      centroCusto:
        prev.centroCusto && headers.includes(prev.centroCusto)
          ? prev.centroCusto
          : findCol(/CENTRO|CC|CUSTO|FRENTE|SETOR/i) || '',
      categoria:
        prev.categoria && headers.includes(prev.categoria)
          ? prev.categoria
          : findCol(/CATEG|PLANO|CONTA/i) || '',
      documento:
        prev.documento && headers.includes(prev.documento)
          ? prev.documento
          : findCol(/DOC|NF|NOTA|DUPLICATA|FATURA/i) || '',
      cnpj: prev.cnpj && headers.includes(prev.cnpj) ? prev.cnpj : findCol(/CNPJ|CPF|INSC/i) || '',
    }))
  }

  // Toggle de seleção de abas
  const toggleSheetSelected = (sheetName: string) => {
    setSheetsConfig((prev) =>
      prev.map((s) => (s.name === sheetName ? { ...s, selected: !s.selected } : s)),
    )
  }

  const selectAllSheets = (selected: boolean) => {
    setSheetsConfig((prev) => prev.map((s) => ({ ...s, selected })))
  }

  const updateSheetCompetencia = (sheetName: string, mes: number, ano: number) => {
    setSheetsConfig((prev) => prev.map((s) => (s.name === sheetName ? { ...s, mes, ano } : s)))
  }

  const selectedSheetsCount = useMemo(() => {
    return sheetsConfig.filter((s) => s.selected).length
  }, [sheetsConfig])

  // Execução do lote de importação
  const handleExecuteImport = async () => {
    if (!workbook) return
    setIsProcessing(true)
    setStep(4)

    const resultSummary: ContasPagarImportSummary = {
      totalLidos: 0,
      importados: 0,
      duplicadosPulados: 0,
      pagasBaixadas: 0,
      emAberto: 0,
      fornecedoresCriados: [],
      erros: [],
      detalhesPorAba: [],
    }

    try {
      // 1. Caches para otimizar busca e evitar duplicidade
      const fornecedoresCache = new Map<string, Fornecedor>()
      const fornecedoresCnpjCache = new Map<string, Fornecedor>()

      fornecedores.forEach((f) => {
        fornecedoresCache.set(f.nome.trim().toLowerCase(), f)
        if (f.cnpj_cpf) {
          const c = apenasDigitos(f.cnpj_cpf)
          if (c) fornecedoresCnpjCache.set(c, f)
        }
      })

      // Centros de custo cache (por código ou nome)
      const centrosCache = new Map<string, CentroCusto>()
      centrosCusto.forEach((cc) => {
        centrosCache.set(cc.codigo.trim().toLowerCase(), cc)
        centrosCache.set(cc.nome.trim().toLowerCase(), cc)
      })

      // Categorias contábeis cache
      const categoriasCache = new Map<string, PlanoConta>()
      categorias.forEach((cat) => {
        categoriasCache.set(cat.codigo.trim().toLowerCase(), cat)
        categoriasCache.set(cat.nome.trim().toLowerCase(), cat)
      })

      // Deduplicação: fornecedor_id + data(YYYY-MM-DD) + valor + descricao normalizada
      const existingKeys = new Set<string>()
      contasExistentes.forEach((c) => {
        const d = c.vencimento.slice(0, 10)
        const descNorm = (c.descricao || '')
          .toLowerCase()
          .replace(/[\s\-_]+/g, ' ')
          .trim()
          .slice(0, 30)
        const key = `${c.fornecedor_id || ''}_${d}_${Number(c.valor).toFixed(2)}_${descNorm}`
        existingKeys.add(key)
      })

      const sheetsToImport = sheetsConfig.filter((s) => s.selected)

      for (const sheetCfg of sheetsToImport) {
        setProgressMsg(`Processando aba: ${sheetCfg.name}...`)
        const ws = workbook.Sheets[sheetCfg.name]
        if (!ws) {
          resultSummary.detalhesPorAba.push({
            aba: sheetCfg.name,
            linhasLidas: 0,
            importados: 0,
            duplicados: 0,
            errosCount: 0,
            vaziaOuSemCabecalho: true,
            motivoVazia: 'Aba não encontrada no arquivo XLSX',
          })
          continue
        }

        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        if (!matrix || matrix.length === 0) {
          resultSummary.detalhesPorAba.push({
            aba: sheetCfg.name,
            linhasLidas: 0,
            importados: 0,
            duplicados: 0,
            errosCount: 0,
            vaziaOuSemCabecalho: true,
            motivoVazia: 'Aba sem dados ou linhas em branco',
          })
          continue
        }

        // Redetectar a linha de cabeçalho dinamicamente para CADA aba (mesmo se o usuário configurou o wizard baseado na primeira aba)
        // Isso resolve quando abas como OUTUBRO/NOVEMBRO/DEZEMBRO têm cabeçalho em linha diferente ou nomes diferentes
        const autoDetectedHeaderRow = detectarLinhaCabecalho(matrix)
        const headerIdx =
          sheetCfg.headerRowIndex && sheetCfg.headerRowIndex === autoDetectedHeaderRow
            ? sheetCfg.headerRowIndex
            : autoDetectedHeaderRow || sheetCfg.headerRowIndex || 1

        const rawHeaders = matrix[headerIdx - 1] || []
        const currentSheetHeaders = rawHeaders.map(
          (c, i) => String(c || '').trim() || `Coluna_${i + 1}`,
        )
        const dataRows = matrix.slice(headerIdx)

        // Resolução dinâmica e tolerante de colunas para esta aba específica (normalização avançada)
        const findColInSheet = (pattern: RegExp) =>
          currentSheetHeaders.find(
            (h) => pattern.test(normalizarNomeColuna(h)) || pattern.test(h),
          ) || ''

        const matchColWithFallback = (
          userCol: string,
          pattern: RegExp,
          fallbackDefault: string = '',
        ) => {
          if (userCol && currentSheetHeaders.includes(userCol)) return userCol
          if (userCol) {
            const userNorm = normalizarNomeColuna(userCol)
            const matched = currentSheetHeaders.find((h) => normalizarNomeColuna(h) === userNorm)
            if (matched) return matched
          }
          return findColInSheet(pattern) || fallbackDefault
        }

        const vencCol = matchColWithFallback(
          mapping.vencimento,
          REGEX_COL_VENCIMENTO,
          findColInSheet(REGEX_COL_VENCIMENTO) || currentSheetHeaders[0] || '',
        )

        const fornCol = matchColWithFallback(
          mapping.fornecedor,
          REGEX_COL_FORNECEDOR,
          findColInSheet(REGEX_COL_FORNECEDOR),
        )

        const descCol = matchColWithFallback(
          mapping.descricao,
          REGEX_COL_DESCRICAO,
          findColInSheet(REGEX_COL_DESCRICAO),
        )

        // Candidatos de coluna de valor para a aba (com ampla gama de sinônimos: A PAGAR, PREVISTO, LIQUIDO, BRUTO, etc.)
        let valCol = matchColWithFallback(
          mapping.valor,
          REGEX_COL_VALOR,
          findColInSheet(REGEX_COL_VALOR),
        )

        const valPagoCol = matchColWithFallback(
          mapping.valorPago,
          REGEX_COL_VALOR_PAGO,
          findColInSheet(REGEX_COL_VALOR_PAGO),
        )

        // B2: Validação de densidade de números decimais válidos na coluna de valor mapeada.
        // Se a coluna de valor mapeada (herdada da primeira aba ou default) não tiver números positivos nas linhas de dados,
        // reescolher automaticamente a coluna com maior densidade de números decimais válidos daquela aba.
        const contarValoresPositivosNaColuna = (colName: string): number => {
          if (!colName) return 0
          const cIdx = currentSheetHeaders.indexOf(colName)
          if (cIdx === -1) return 0
          let count = 0
          for (let r = 0; r < Math.min(dataRows.length, 60); r++) {
            const v = parseValorPagar(dataRows[r]?.[cIdx])
            if (v > 0) count++
          }
          return count
        }

        const densidadeAtual = contarValoresPositivosNaColuna(valCol)
        if (densidadeAtual === 0 && dataRows.length > 0) {
          // Procurar entre as colunas a que tiver maior contagem de números decimais/monetários positivos
          let melhorCol = valCol
          let maiorDensidade = 0

          for (let cIdx = 0; cIdx < currentSheetHeaders.length; cIdx++) {
            const h = currentSheetHeaders[cIdx]
            // Evitar coluna de vencimento
            if (h === vencCol) continue
            const dens = contarValoresPositivosNaColuna(h)
            if (dens > maiorDensidade) {
              maiorDensidade = dens
              melhorCol = h
            }
          }

          if (maiorDensidade > 0) {
            valCol = melhorCol
          }
        }

        const dataPagCol = matchColWithFallback(
          mapping.dataPagamento,
          REGEX_COL_DATA_PAGAMENTO,
          findColInSheet(REGEX_COL_DATA_PAGAMENTO),
        )

        const formaCol = matchColWithFallback(mapping.formaPagamento, /FORMA|MEIO|TIPO PAG/i)

        const statusCol = matchColWithFallback(mapping.status, /STATUS|SITUACAO|COND/i)

        const centroCol = matchColWithFallback(mapping.centroCusto, /CENTRO|CC|CUSTO|FRENTE|SETOR/i)

        const catCol = matchColWithFallback(mapping.categoria, /CATEG|PLANO|CONTA/i)

        const docCol = matchColWithFallback(mapping.documento, /DOC|NF|NOTA|DUPLICATA|FATURA/i)

        const cnpjCol = matchColWithFallback(mapping.cnpj, /CNPJ|CPF|INSC/i)

        // Estado mutável de colunas ativas para suporte a múltiplos blocos/quinzenas na mesma aba
        let activeHeaders = [...currentSheetHeaders]
        let activeVencCol = vencCol
        let activeFornCol = fornCol
        let activeDescCol = descCol
        let activeValCol = valCol
        let activeValPagoCol = valPagoCol
        let activeDataPagCol = dataPagCol
        let activeFormaCol = formaCol
        let activeStatusCol = statusCol
        let activeCentroCol = centroCol
        let activeCatCol = catCol
        let activeDocCol = docCol
        let activeCnpjCol = cnpjCol

        const getVal = (row: any[], headerName: string): any => {
          if (!headerName) return ''
          const colIdx = activeHeaders.indexOf(headerName)
          if (colIdx === -1) return ''
          return row[colIdx] ?? ''
        }

        let sheetLidos = 0
        let sheetImportados = 0
        let sheetDuplicados = 0
        let sheetErrosCount = 0

        // Data herdada em bloco: se a linha tem descrição e valor válidos mas a célula de data está vazia (mesclagem),
        // herdar a data do lançamento anterior válido da mesma aba
        let ultimaDataValida: any = null

        // Função para recalcular mapeamento de colunas em um novo bloco/quinzena
        const recalcularMapeamentoBloco = (novoHeaderRow: any[]) => {
          const newHeaders = novoHeaderRow.map(
            (c, i) => String(c || '').trim() || `Coluna_${i + 1}`,
          )
          if (newHeaders.filter((h) => !h.startsWith('Coluna_')).length >= 2) {
            activeHeaders = newHeaders
            const findColInBlock = (pattern: RegExp) =>
              activeHeaders.find((h) => pattern.test(normalizarNomeColuna(h)) || pattern.test(h)) ||
              ''

            const matchColInBlock = (userCol: string, pattern: RegExp, fallback: string = '') => {
              if (userCol && activeHeaders.includes(userCol)) return userCol
              if (userCol) {
                const uNorm = normalizarNomeColuna(userCol)
                const m = activeHeaders.find((h) => normalizarNomeColuna(h) === uNorm)
                if (m) return m
              }
              return findColInBlock(pattern) || fallback
            }

            activeVencCol = matchColInBlock(
              mapping.vencimento,
              REGEX_COL_VENCIMENTO,
              findColInBlock(REGEX_COL_VENCIMENTO) || activeHeaders[0] || '',
            )
            activeFornCol = matchColInBlock(
              mapping.fornecedor,
              REGEX_COL_FORNECEDOR,
              findColInBlock(REGEX_COL_FORNECEDOR),
            )
            activeDescCol = matchColInBlock(
              mapping.descricao,
              REGEX_COL_DESCRICAO,
              findColInBlock(REGEX_COL_DESCRICAO),
            )
            activeValCol = matchColInBlock(
              mapping.valor,
              REGEX_COL_VALOR,
              findColInBlock(REGEX_COL_VALOR),
            )
            activeValPagoCol = matchColInBlock(
              mapping.valorPago,
              REGEX_COL_VALOR_PAGO,
              findColInBlock(REGEX_COL_VALOR_PAGO),
            )
            activeDataPagCol = matchColInBlock(
              mapping.dataPagamento,
              REGEX_COL_DATA_PAGAMENTO,
              findColInBlock(REGEX_COL_DATA_PAGAMENTO),
            )
            activeFormaCol = matchColInBlock(mapping.formaPagamento, /FORMA|MEIO|TIPO PAG/i)
            activeStatusCol = matchColInBlock(mapping.status, /STATUS|SITUACAO|COND/i)
            activeCentroCol = matchColInBlock(mapping.centroCusto, /CENTRO|CC|CUSTO|FRENTE|SETOR/i)
            activeCatCol = matchColInBlock(mapping.categoria, /CATEG|PLANO|CONTA/i)
            activeDocCol = matchColInBlock(mapping.documento, /DOC|NF|NOTA|DUPLICATA|FATURA/i)
            activeCnpjCol = matchColInBlock(mapping.cnpj, /CNPJ|CPF|INSC/i)
          }
        }

        for (let r = 0; r < dataRows.length; r++) {
          const row = dataRows[r]
          const numLinha = r + headerIdx + 1

          // Checar se a linha inteira está vazia
          const temConteudo = row.some((c) => String(c ?? '').trim().length > 0)
          if (!temConteudo) continue

          // Normalizar todas as células como texto para checagem de blocos, subtotais semanais e cabeçalhos repetidos
          const rowTextJoined = row
            .map((c) => normalizarNomeColuna(c))
            .filter(Boolean)
            .join(' ')

          // Detectar separador ou fechamento de quinzena/bloco
          const isQuinzenaSeparator =
            rowTextJoined.includes('QUINZENA') ||
            rowTextJoined.includes('2A QUINZENA') ||
            rowTextJoined.includes('2 QUINZENA') ||
            rowTextJoined.includes('1A QUINZENA') ||
            rowTextJoined.includes('1 QUINZENA') ||
            rowTextJoined.includes('SEGUNDA QUINZENA') ||
            rowTextJoined.includes('PRIMEIRA QUINZENA')

          // Detectar cabeçalho repetido no meio da aba
          const isRepeatedHeader =
            (rowTextJoined.includes('VENC') || rowTextJoined.includes('DATA')) &&
            (rowTextJoined.includes('VALOR') ||
              rowTextJoined.includes('PAGAR') ||
              rowTextJoined.includes('REALIZAD')) &&
            (rowTextJoined.includes('FORNEC') ||
              rowTextJoined.includes('FAVOREC') ||
              rowTextJoined.includes('HIST'))

          if (isQuinzenaSeparator || isRepeatedHeader) {
            // Se for cabeçalho repetido ou a próxima linha for cabeçalho, reexecutar detecção de colunas
            if (isRepeatedHeader) {
              recalcularMapeamentoBloco(row)
            } else if (r + 1 < dataRows.length) {
              const nextRow = dataRows[r + 1]
              const nextRowJoin = nextRow
                .map((c) => normalizarNomeColuna(c))
                .filter(Boolean)
                .join(' ')
              if (
                (nextRowJoin.includes('VENC') || nextRowJoin.includes('DATA')) &&
                (nextRowJoin.includes('VALOR') ||
                  nextRowJoin.includes('PAGAR') ||
                  nextRowJoin.includes('REALIZAD'))
              ) {
                recalcularMapeamentoBloco(nextRow)
              }
            }
            continue
          }

          // Pular linhas puramente de total, subtotal, saldo ou semana com continue (NUNCA descartar as linhas seguintes)
          const isTotalRow =
            rowTextJoined.startsWith('TOTAL') ||
            rowTextJoined.startsWith('SUBTOTAL') ||
            rowTextJoined.startsWith('SUB TOTAL') ||
            rowTextJoined.startsWith('SALDO') ||
            rowTextJoined.startsWith('SEMANA') ||
            rowTextJoined.includes('TOTAL SEMANA') ||
            rowTextJoined.includes('SUBTOTAL SEMANA') ||
            rowTextJoined.includes('SUBTOTAL 1') ||
            rowTextJoined.includes('SUBTOTAL 2')
          if (isTotalRow) {
            // Se tiver indício de cabeçalho na linha seguinte após subtotal, tentar re-detectar colunas
            if (r + 1 < dataRows.length) {
              const nextRow = dataRows[r + 1]
              const nextRowJoin = nextRow
                .map((c) => normalizarNomeColuna(c))
                .filter(Boolean)
                .join(' ')
              if (
                (nextRowJoin.includes('VENC') || nextRowJoin.includes('DATA')) &&
                (nextRowJoin.includes('VALOR') ||
                  nextRowJoin.includes('PAGAR') ||
                  nextRowJoin.includes('REALIZAD'))
              ) {
                recalcularMapeamentoBloco(nextRow)
              }
            }
            continue
          }

          sheetLidos += 1
          resultSummary.totalLidos += 1

          try {
            const activeVencColIdx = activeVencCol ? activeHeaders.indexOf(activeVencCol) : -1
            const activeDocColIdx = activeDocCol ? activeHeaders.indexOf(activeDocCol) : -1

            let rawVenc = getVal(row, activeVencCol)
            let rawForn = String(getVal(row, activeFornCol) || '').trim()
            let rawDesc = String(getVal(row, activeDescCol) || '').trim()

            // Se fornecedor e descrição vieram vazios, procurar na linha a primeira célula textual representativa
            if (!rawForn && !rawDesc) {
              for (let cIdx = 0; cIdx < row.length; cIdx++) {
                if (cIdx === activeVencColIdx || cIdx === activeDocColIdx) continue
                const cv = row[cIdx]
                if (
                  cv &&
                  typeof cv === 'string' &&
                  cv.trim().length > 1 &&
                  !/^\d+([.,]\d+)?$/.test(cv.trim())
                ) {
                  const cNorm = normalizarNomeColuna(cv)
                  if (
                    !cNorm.startsWith('TOTAL') &&
                    !cNorm.startsWith('SUBTOTAL') &&
                    !cNorm.startsWith('SALDO')
                  ) {
                    rawDesc = cv.trim()
                    break
                  }
                }
              }
            }

            if (!rawForn && rawDesc) {
              rawForn = rawDesc
            }

            const rawValor = parseValorPagar(getVal(row, activeValCol))
            const rawValorPago = activeValPagoCol
              ? parseValorPagar(getVal(row, activeValPagoCol))
              : 0
            const rawDataPag = getVal(row, activeDataPagCol)
            const rawForma = String(getVal(row, activeFormaCol) || '').trim()
            const rawStatus = String(getVal(row, activeStatusCol) || '').toLowerCase()
            const rawCentro = String(getVal(row, activeCentroCol) || '').trim()
            const rawCat = String(getVal(row, activeCatCol) || '').trim()
            const rawDoc = String(getVal(row, activeDocCol) || '').trim()
            const rawCnpj = String(getVal(row, activeCnpjCol) || '').trim()

            // Ignorar se a descrição ou favorecido for totalizador
            const lowerDesc = (rawDesc || rawForn).toLowerCase()
            if (
              lowerDesc.startsWith('total') ||
              lowerDesc.startsWith('subtotal') ||
              lowerDesc.startsWith('saldo') ||
              lowerDesc.startsWith('semana') ||
              lowerDesc.includes('total semanal')
            ) {
              continue
            }

            // Descobrir valor final:
            // 1) Testar coluna mapeada de valor ou valorPago
            // 2) Se não produzir número > 0, varrer as células da linha (pulando a coluna de vencimento e a de documento)
            //    e usar o maior valor monetário positivo encontrado como valor do lançamento
            let valorFinal = rawValor > 0 ? rawValor : rawValorPago
            if (valorFinal <= 0) {
              let maiorValorEncontrado = 0
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                // Pular coluna de vencimento e coluna de documento
                if (colIdx === activeVencColIdx || colIdx === activeDocColIdx) continue

                const cellRaw = row[colIdx]
                // Se a célula contiver formato evidente de documento/NF ou data, não considerar
                if (typeof cellRaw === 'string' && /^(?:NF|DOC|NOTA|DUPL)/i.test(cellRaw.trim()))
                  continue
                if (cellRaw instanceof Date) continue

                const cellVal = parseValorPagar(cellRaw)
                if (cellVal > 0) {
                  const hName = normalizarNomeColuna(activeHeaders[colIdx] || '')
                  // Se o cabeçalho tiver indício explícito de valor, prioriza imediatamente
                  if (
                    hName.includes('VALOR') ||
                    hName.includes('PAGAR') ||
                    hName.includes('REALIZAD') ||
                    hName.includes('PREVIST') ||
                    hName.includes('TOTAL') ||
                    hName.includes('LIQUID') ||
                    hName.includes('BRUTO') ||
                    hName.includes('PAGO') ||
                    hName.includes('DEBIT') ||
                    hName.includes('DESPES')
                  ) {
                    if (cellVal > valorFinal) {
                      valorFinal = cellVal
                    }
                  } else if (cellVal > maiorValorEncontrado) {
                    maiorValorEncontrado = cellVal
                  }
                }
              }
              if (valorFinal <= 0 && maiorValorEncontrado > 0) {
                valorFinal = maiorValorEncontrado
              }
            }

            if (valorFinal <= 0) {
              // Se há descrição ou favorecido mas o valor foi 0, continuar sem abortar
              continue
            }

            // 1. Resolver Fornecedor
            let fornecedorId: string | null = null
            const cnpjLimpo = apenasDigitos(rawCnpj)

            if (cnpjLimpo.length === 14 && fornecedoresCnpjCache.has(cnpjLimpo)) {
              fornecedorId = fornecedoresCnpjCache.get(cnpjLimpo)!.id
            } else if (rawForn) {
              const keyForn = rawForn.toLowerCase()
              if (fornecedoresCache.has(keyForn)) {
                fornecedorId = fornecedoresCache.get(keyForn)!.id
              } else if (criarFornecedoresNaoEncontrados) {
                try {
                  let cnpjConsultaInfo: any = null
                  if (cnpjLimpo.length === 14 && buscarCnpjBrasilApi) {
                    try {
                      cnpjConsultaInfo = await buscarCnpj(cnpjLimpo)
                    } catch {
                      // Silently fall back to manual creation
                    }
                  }

                  await sleep(100)
                  const novoFornecedor = await withRateLimitRetry(
                    () =>
                      pb.collection('fornecedores').create<Fornecedor>({
                        empresa_id: empresaId,
                        nome:
                          cnpjConsultaInfo?.nomeFantasia ||
                          cnpjConsultaInfo?.razaoSocial ||
                          rawForn,
                        cnpj_cpf: cnpjLimpo ? formatarCnpj(cnpjLimpo) : undefined,
                        telefone: cnpjConsultaInfo?.telefone || undefined,
                        email: cnpjConsultaInfo?.email || undefined,
                        endereco: cnpjConsultaInfo?.enderecoCompleto || undefined,
                        cidade: cnpjConsultaInfo?.cidade || undefined,
                        uf: cnpjConsultaInfo?.uf || undefined,
                        cep: cnpjConsultaInfo?.cep || undefined,
                        observacoes: `Criado automaticamente na importação da planilha (aba ${sheetCfg.name})`,
                      }),
                    {
                      onRetry: (tentativa, delayMs) => {
                        setProgressMsg(
                          `Aguardando servidor... limite temporário (429) no fornecedor "${rawForn}". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                        )
                      },
                    },
                  )

                  fornecedoresCache.set(keyForn, novoFornecedor)
                  if (cnpjLimpo) {
                    fornecedoresCnpjCache.set(cnpjLimpo, novoFornecedor)
                  }
                  fornecedorId = novoFornecedor.id
                  if (!resultSummary.fornecedoresCriados.includes(novoFornecedor.nome)) {
                    resultSummary.fornecedoresCriados.push(novoFornecedor.nome)
                  }
                } catch (createFornErr) {
                  console.warn('Erro ao criar fornecedor:', rawForn, createFornErr)
                }
              }
            }

            // 2. Data de Vencimento com herança de bloco e busca por coluna alternativa:
            let dataParaVenc = rawVenc
            const rawVencStr = String(rawVenc ?? '').trim()
            if (!rawVencStr && ultimaDataValida) {
              dataParaVenc = ultimaDataValida
            }

            let dataVencimentoISO = parseDataPagar(dataParaVenc, sheetCfg.ano, sheetCfg.mes)

            // Se ainda não obteve data válida com vencCol, tentar varrer as colunas da linha
            if (!dataVencimentoISO || dataVencimentoISO.startsWith('1970')) {
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                if (colIdx === activeDocColIdx) continue
                const candVal = row[colIdx]
                if (candVal !== null && candVal !== undefined && String(candVal).trim() !== '') {
                  const parsed = parseDataPagar(candVal, sheetCfg.ano, sheetCfg.mes)
                  if (parsed && !parsed.startsWith('1970')) {
                    dataVencimentoISO = parsed
                    rawVenc = candVal
                    break
                  }
                }
              }
            }

            // Fallback resiliente: se a linha tem descrição e valor válidos, herdar data anterior ou dia 01 da competência
            if (!dataVencimentoISO || dataVencimentoISO.startsWith('1970')) {
              if (ultimaDataValida) {
                dataVencimentoISO = parseDataPagar(ultimaDataValida, sheetCfg.ano, sheetCfg.mes)
              }
              if (!dataVencimentoISO || dataVencimentoISO.startsWith('1970')) {
                const y = sheetCfg.ano || 2026
                const m = sheetCfg.mes || 1
                dataVencimentoISO = `${y}-${String(m).padStart(2, '0')}-01T12:00:00.000Z`
              }
            } else {
              ultimaDataValida = rawVenc
            }

            // 3. Descrição
            const docInfo = rawDoc ? ` [NF/Doc: ${rawDoc}]` : ''
            const descFinal = rawDesc || `Despesa ${rawForn || sheetCfg.name}${docInfo}`

            // 4. Verificação de Duplicidade
            const dateOnly = dataVencimentoISO.slice(0, 10)
            const descNorm = descFinal
              .toLowerCase()
              .replace(/[\s\-_]+/g, ' ')
              .trim()
              .slice(0, 30)
            const dedupeKey = `${fornecedorId || ''}_${dateOnly}_${valorFinal.toFixed(2)}_${descNorm}`

            if (detectarDuplicados && existingKeys.has(dedupeKey)) {
              resultSummary.duplicadosPulados += 1
              sheetDuplicados += 1
              continue
            }

            // 5. Determinar Situação (Paga, Parcial ou Aberta)
            let isPaga = false
            let isParcial = false

            if (classificacaoPadrao === 'Paga') {
              isPaga = true
            } else if (classificacaoPadrao === 'Aberta') {
              isPaga = false
            } else {
              if (
                rawStatus.includes('parcial') ||
                (rawValorPago > 0 && valorFinal > 0 && rawValorPago < valorFinal - 0.009)
              ) {
                isParcial = true
              } else if (
                (rawValorPago > 0 && rawValorPago >= valorFinal - 0.009) ||
                rawDataPag ||
                rawStatus.includes('pag') ||
                rawStatus.includes('liquid') ||
                rawStatus.includes('baix') ||
                rawStatus.includes('quit')
              ) {
                isPaga = true
              } else if (
                rawStatus.includes('abert') ||
                rawStatus.includes('pend') ||
                rawStatus.includes('venc')
              ) {
                isPaga = false
              } else {
                isPaga = rawValorPago >= valorFinal && rawValorPago > 0
              }
            }

            const valorEfetivoPago = isPaga
              ? rawValorPago > 0
                ? rawValorPago
                : valorFinal
              : isParcial
                ? rawValorPago
                : 0

            const dataPagamentoISO =
              isPaga || (isParcial && rawValorPago > 0)
                ? parseDataPagar(rawDataPag || rawVenc, sheetCfg.ano, sheetCfg.mes)
                : null

            // 6. Forma de Pagamento
            let finalForma: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' = 'Pix'
            const lowerForma = (rawForma || '').toLowerCase()
            if (lowerForma.includes('bol')) finalForma = 'Boleto'
            else if (
              lowerForma.includes('ted') ||
              lowerForma.includes('doc') ||
              lowerForma.includes('transf')
            )
              finalForma = 'Transferência'
            else if (
              lowerForma.includes('cart') ||
              lowerForma.includes('deb') ||
              lowerForma.includes('cred')
            )
              finalForma = 'Cartão'
            else if (lowerForma.includes('dinh') || lowerForma.includes('espec'))
              finalForma = 'Dinheiro'

            // 7. Centro de Custo
            let finalCentroCustoId: string | null =
              centroCustoPadraoId !== 'none' && centroCustoPadraoId ? centroCustoPadraoId : null

            if (rawCentro) {
              const k = rawCentro.toLowerCase()
              if (centrosCache.has(k)) {
                finalCentroCustoId = centrosCache.get(k)!.id
              }
            }

            // 8. Categoria / Plano de Contas
            let finalCategoriaId: string | null = categoriaPadraoId || null
            if (rawCat) {
              const k = rawCat.toLowerCase()
              if (categoriasCache.has(k)) {
                finalCategoriaId = categoriasCache.get(k)!.id
              }
            }

            // 9. Gravar Conta a Pagar
            const statusFinalGravado = isPaga ? 'Paga' : isParcial ? 'Parcial' : 'Aberta'

            await sleep(100)
            const createdConta = await withRateLimitRetry(
              () =>
                pb.collection('contas_pagar').create<ContaPagar>({
                  empresa_id: empresaId,
                  fornecedor_id: fornecedorId || null,
                  descricao: descFinal,
                  categoria_id: finalCategoriaId,
                  centro_custo_id: finalCentroCustoId,
                  valor: valorFinal,
                  valor_pago: valorEfetivoPago,
                  vencimento: dataVencimentoISO,
                  parcelas: 1,
                  status: statusFinalGravado,
                  data_pagamento: dataPagamentoISO,
                  forma_pagamento: isPaga || isParcial ? finalForma : null,
                  observacoes: `Importado de planilha [Aba: ${sheetCfg.name}]${rawDoc ? ` | Doc: ${rawDoc}` : ''}${isParcial ? ` | Pagamento parcial importado: ${valorEfetivoPago}` : ''}`,
                }),
              {
                onRetry: (tentativa, delayMs) => {
                  setProgressMsg(
                    `Aguardando servidor... limite temporário (429) no lançamento "${descFinal.slice(0, 25)}...". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                  )
                },
              },
            )

            // 10. Se houve pagamento (total ou parcial), gerar movimento financeiro pelo valor efetivo
            if ((isPaga || isParcial) && valorEfetivoPago > 0 && dataPagamentoISO) {
              try {
                await sleep(100)
                await withRateLimitRetry(
                  () =>
                    pb.collection('movimentos_financeiros').create({
                      empresa_id: empresaId,
                      tipo: 'Saida',
                      descricao: `Pagamento${isParcial ? ' parcial' : ''}: ${createdConta.descricao}${rawForn ? ` [${rawForn}]` : ''}`,
                      valor: valorEfetivoPago,
                      data: dataPagamentoISO,
                      categoria_id: finalCategoriaId,
                      centro_custo_id: finalCentroCustoId,
                      origem: 'ContaPagar',
                      referencia_id: createdConta.id,
                      conciliado: false,
                    }),
                  {
                    onRetry: (tentativa, delayMs) => {
                      setProgressMsg(
                        `Aguardando servidor... limite temporário (429) no movimento financeiro. Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                      )
                    },
                  },
                )
              } catch (eMov) {
                console.warn('Erro ao criar movimento financeiro correspondente:', eMov)
              }
            }

            existingKeys.add(dedupeKey)
            resultSummary.importados += 1
            sheetImportados += 1
            if (isPaga) {
              resultSummary.pagasBaixadas += 1
            } else if (isParcial) {
              resultSummary.emAberto += 1
            } else {
              resultSummary.emAberto += 1
            }
          } catch (rowErr: any) {
            sheetErrosCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              motivo: rowErr.message || 'Falha ao processar linha',
            })
          }
        }

        const isVazia = sheetLidos === 0
        resultSummary.detalhesPorAba.push({
          aba: sheetCfg.name,
          linhasLidas: sheetLidos,
          importados: sheetImportados,
          duplicados: sheetDuplicados,
          errosCount: sheetErrosCount,
          vaziaOuSemCabecalho: isVazia,
          motivoVazia: isVazia
            ? `Nenhuma linha útil lida após a linha ${headerIdx}. Verifique se a linha do cabeçalho está correta.`
            : undefined,
        })
      }

      setSummary(resultSummary)
      setStep(5)
      await onImportComplete()
      toast({
        title: 'Importação de Contas a Pagar concluída!',
        description: `${resultSummary.importados} lançamentos foram importados com sucesso.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro geral durante importação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isProcessing) {
          onOpenChange(val)
          if (!val) handleReset()
        }
      }}
    >
      <DialogContent className="sm:max-w-[780px] max-h-[92vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b border-[#ECEAE4] bg-[#FAF9F7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Importador de Planilha de Contas a Pagar (XLSX)
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  Etapa {step} de 5 • Múltiplas abas mensais com detecção de competência e cabeçalho
                </p>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    step === s ? 'bg-teal-700' : step > s ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {/* STEP 1: Upload Arquivo */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#ECEAE4] hover:border-teal-600 rounded-2xl p-8 text-center transition-colors bg-[#FAF9F7]/50">
                <Upload className="w-10 h-10 mx-auto text-teal-700 mb-3" />
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  Selecione sua planilha de despesas/pagamentos (.xlsx ou .xls)
                </h3>
                <p className="text-gray-500 text-xs max-w-lg mx-auto mb-4">
                  Suporta arquivos anuais com abas mensais (ex.:{' '}
                  <em>JANEIRO_2026, MARÇO 2026.2, JANEIRO_2027</em>). A leitura é executada no seu
                  navegador e gravada com segurança no banco.
                </p>
                <label className="cursor-pointer">
                  <span className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Procurar Planilha Excel (.xlsx)
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-teal-950 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-teal-900">
                    Detecção de Abas e Folhas .2:
                  </strong>
                  Identifica o mês e ano pelo título de cada aba (ex: "JANEIRO_2026", "FEVEREIRO
                  2026.2"). Folhas .2 são consolidadas no mesmo mês.
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-amber-950">Deduplicação Inteligente:</strong>
                  Evita lançamentos duplicados caso você reimporte a planilha ou importe arquivos
                  parciais.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Seleção e Competência das Abas */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#ECEAE4]">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Abas Mensais Identificadas ({sheetsConfig.length})
                  </h3>
                  <p className="text-gray-500 text-xs">
                    Confira a competência inferida e desmarque abas que não deseja processar:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => selectAllSheets(true)}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Marcar Todas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => selectAllSheets(false)}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Desmarcar
                  </Button>
                </div>
              </div>

              {/* Lista de abas com mês/ano ajustável */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {sheetsConfig.map((cfg) => (
                  <div
                    key={cfg.name}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
                      cfg.selected
                        ? 'border-teal-400 bg-teal-50/40 text-gray-900'
                        : 'border-[#ECEAE4] bg-[#FAF9F7]/50 text-gray-400'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1"
                      onClick={() => toggleSheetSelected(cfg.name)}
                    >
                      <Checkbox checked={cfg.selected} />
                      <div>
                        <span className="font-semibold text-gray-900 block truncate max-w-[240px]">
                          {cfg.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {cfg.totalRows} linha(s) de dados
                          {cfg.sufixo && ` • (2ª Folha ${cfg.sufixo})`}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-gray-500 whitespace-nowrap">
                          Linha Cab.:
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={cfg.headerRowIndex}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            if (!isNaN(val) && val >= 1) {
                              updateSheetHeaderRow(cfg.name, val)
                            }
                          }}
                          disabled={!cfg.selected}
                          className="h-7 w-16 text-xs bg-white font-mono text-center"
                          title="Linha da planilha onde estão os títulos das colunas"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-gray-500">Mês:</Label>
                        <Select
                          value={String(cfg.mes)}
                          onValueChange={(val) =>
                            updateSheetCompetencia(cfg.name, parseInt(val, 10), cfg.ano)
                          }
                          disabled={!cfg.selected}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MESES_MAP)
                              .filter(([k]) => k.length > 3)
                              .slice(0, 12)
                              .map(([nomeMes, numMes]) => (
                                <SelectItem key={numMes} value={String(numMes)}>
                                  {numMes.toString().padStart(2, '0')} - {nomeMes}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-gray-500">Ano:</Label>
                        <Input
                          type="number"
                          value={cfg.ano}
                          onChange={(e) =>
                            updateSheetCompetencia(
                              cfg.name,
                              cfg.mes,
                              parseInt(e.target.value, 10) || cfg.ano,
                            )
                          }
                          disabled={!cfg.selected}
                          className="h-7 w-20 text-xs bg-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between">
                <span>
                  Arquivo: <strong className="text-gray-800">{file?.name}</strong>
                </span>
                <span className="font-semibold text-teal-800">
                  {selectedSheetsCount} de {sheetsConfig.length} aba(s) selecionada(s)
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Mapeamento de Colunas e Opções */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-teal-950">
                    Mapeamento das Colunas da Planilha
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    Cabeçalhos identificados na primeira linha útil da aba. Corrija o vínculo caso
                    necessário:
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={activeSheetPreview}
                    onValueChange={(sheet) => {
                      setActiveSheetPreview(sheet)
                      const cfg = sheetsConfig.find((s) => s.name === sheet)
                      if (cfg && workbook) carregarPreviaAba(workbook, cfg)
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white border-teal-200">
                      <SelectValue placeholder="Aba base de colunas" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetsConfig
                        .filter((s) => s.selected)
                        .map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="bg-white text-teal-700 border-teal-300">
                    {sheetHeaders.length} colunas
                  </Badge>
                </div>
              </div>

              {/* Grid de Campos Mapeados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Vencimento */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Vencimento *
                  </Label>
                  <Select
                    value={mapping.vencimento}
                    onValueChange={(val) => setMapping({ ...mapping, vencimento: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fornecedor */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Fornecedor / Favorecido *
                  </Label>
                  <Select
                    value={mapping.fornecedor}
                    onValueChange={(val) => setMapping({ ...mapping, fornecedor: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Descrição / Histórico *
                  </Label>
                  <Select
                    value={mapping.descricao}
                    onValueChange={(val) => setMapping({ ...mapping, descricao: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor Total */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Valor Total (R$) *</Label>
                  <Select
                    value={mapping.valor}
                    onValueChange={(val) => setMapping({ ...mapping, valor: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor Pago (opcional) */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Valor Pago / Baixa (opcional)
                  </Label>
                  <Select
                    value={mapping.valorPago || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, valorPago: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Usar valor total" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear (usa valor total)</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Pagamento (opcional) */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Pagamento (opcional)
                  </Label>
                  <Select
                    value={mapping.dataPagamento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, dataPagamento: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Usar data de vencimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear (usa vencimento)</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Forma de Pagamento */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Forma de Pagamento (opcional)
                  </Label>
                  <Select
                    value={mapping.formaPagamento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, formaPagamento: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Padrão: Pix" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Padrão / Não mapear (Pix)</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status / Situação */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Coluna Status (opcional)
                  </Label>
                  <Select
                    value={mapping.status || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, status: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Usar regra automática" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear / Usar regra abaixo</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Centro de Custo Coluna */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Centro de Custo (Coluna)
                  </Label>
                  <Select
                    value={mapping.centroCusto || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, centroCusto: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sem coluna específica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem coluna de centro de custo</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria Coluna */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Categoria Contábil (Coluna)
                  </Label>
                  <Select
                    value={mapping.categoria || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, categoria: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sem coluna específica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem coluna de categoria</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Documento / NF */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Nº Documento / Nota Fiscal
                  </Label>
                  <Select
                    value={mapping.documento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, documento: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem coluna de documento</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* CNPJ / CPF */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    CNPJ / CPF do Fornecedor
                  </Label>
                  <Select
                    value={mapping.cnpj || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, cnpj: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem coluna de CNPJ/CPF</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Regras de Negócio e Padrões */}
              <div className="pt-3 border-t border-[#ECEAE4] space-y-3">
                <h4 className="font-bold text-gray-900 text-xs">
                  Regras de Classificação e Fallbacks
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Situação / Baixa Inicial:
                    </Label>
                    <Select
                      value={classificacaoPadrao}
                      onValueChange={(val: any) => setClassificacaoPadrao(val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          Auto-detectar (baixa se houver valor pago ou data)
                        </SelectItem>
                        <SelectItem value="Paga">Marcar todas como Pagas (Baixadas)</SelectItem>
                        <SelectItem value="Aberta">
                          Marcar todas como Em Aberto (A Pagar)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Centro de Custo Padrão:
                    </Label>
                    <Select value={centroCustoPadraoId} onValueChange={setCentroCustoPadraoId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o centro..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum / Não alocado</SelectItem>
                        {centrosCusto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.codigo} - {cc.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Categoria Contábil Padrão:
                    </Label>
                    <Select value={categoriaPadraoId} onValueChange={setCategoriaPadraoId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione despesa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.codigo} - {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={criarFornecedoresNaoEncontrados}
                      onCheckedChange={(c) => setCriarFornecedoresNaoEncontrados(!!c)}
                    />
                    <span>Cadastrar fornecedores automaticamente caso não existam no sistema</span>
                  </label>

                  {criarFornecedoresNaoEncontrados && (
                    <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer ml-5">
                      <Checkbox
                        checked={buscarCnpjBrasilApi}
                        onCheckedChange={(c) => setBuscarCnpjBrasilApi(!!c)}
                      />
                      <span>Completar dados pela Receita/BrasilAPI se houver coluna de CNPJ</span>
                    </label>
                  )}

                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={detectarDuplicados}
                      onCheckedChange={(c) => setDetectarDuplicados(!!c)}
                    />
                    <span>
                      Idempotência: Pular lançamentos idênticos já existentes (mesmo fornecedor,
                      vencimento e valor)
                    </span>
                  </label>
                </div>
              </div>

              {/* Prévia das primeiras linhas */}
              {previewRows.length > 0 && (
                <div className="pt-2">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Pré-visualização das Primeiras Linhas ({activeSheetPreview}):
                  </span>
                  <div className="border border-[#ECEAE4] rounded-xl overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500">
                        <tr>
                          {mapping.vencimento && <th className="p-2">Vencimento</th>}
                          {mapping.fornecedor && <th className="p-2">Fornecedor</th>}
                          {mapping.descricao && <th className="p-2">Descrição</th>}
                          {mapping.valor && <th className="p-2 text-right">Valor</th>}
                          {mapping.valorPago && <th className="p-2 text-right">Valor Pago</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEAE4]">
                        {previewRows.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            {mapping.vencimento && (
                              <td className="p-2 font-mono">
                                {formatDate(parseDataPagar(r[mapping.vencimento]))}
                              </td>
                            )}
                            {mapping.fornecedor && (
                              <td className="p-2 font-medium">
                                {String(r[mapping.fornecedor] || '—')}
                              </td>
                            )}
                            {mapping.descricao && (
                              <td className="p-2 text-gray-600">
                                {String(r[mapping.descricao] || '—')}
                              </td>
                            )}
                            {mapping.valor && (
                              <td className="p-2 text-right font-mono font-bold text-gray-900">
                                {formatCurrency(parseValorPagar(r[mapping.valor]))}
                              </td>
                            )}
                            {mapping.valorPago && (
                              <td className="p-2 text-right font-mono text-emerald-700">
                                {formatCurrency(parseValorPagar(r[mapping.valorPago]))}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Processando */}
          {step === 4 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-700" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Processando e gravando despesas no banco...
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  {progressMsg || 'Consolidando abas mensais e fornecedores...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Relatório Final */}
          {step === 5 && summary && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-950 text-sm">
                    Importação de Contas a Pagar Concluída!
                  </h3>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Todas as despesas foram validadas e inseridas na base da sua empresa.
                  </p>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Lidos</span>
                  <span className="text-lg font-bold text-gray-800 font-mono">
                    {summary.totalLidos}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">
                    Importados
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {summary.importados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">
                    Pagas (Baixadas)
                  </span>
                  <span className="text-lg font-bold text-teal-700 font-mono">
                    {summary.pagasBaixadas}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">
                    Duplicados Pulados
                  </span>
                  <span className="text-lg font-bold text-amber-700 font-mono">
                    {summary.duplicadosPulados}
                  </span>
                </div>
              </div>

              {/* Detalhamento por Aba (Visibilidade Total) */}
              {summary.detalhesPorAba && summary.detalhesPorAba.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-[#ECEAE4] space-y-2">
                  <span className="font-semibold text-gray-800 block text-xs">
                    Detalhamento por Aba Processada:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {summary.detalhesPorAba.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                          item.vaziaOuSemCabecalho
                            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                            : item.errosCount > 0
                              ? 'bg-red-50/50 border-red-200 text-gray-800'
                              : 'bg-[#FAF9F7] border-[#ECEAE4] text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{item.aba}</span>
                          {item.vaziaOuSemCabecalho ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-100 text-amber-900 border-amber-300"
                            >
                              0 linhas lidas
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-gray-500">
                              {item.linhasLidas} lidas • {item.importados} importadas •{' '}
                              {item.duplicados} duplicadas
                            </span>
                          )}
                        </div>

                        {item.vaziaOuSemCabecalho ? (
                          <span className="text-[11px] font-medium text-amber-800">
                            {item.motivoVazia || 'Aba sem dados detectados'}
                          </span>
                        ) : item.errosCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-red-100 text-red-800 border-red-300"
                          >
                            {item.errosCount} divergência(s)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300"
                          >
                            100% OK
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.fornecedoresCriados.length > 0 && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="font-semibold text-gray-800 block mb-1">
                    Novos Fornecedores Cadastrados ({summary.fornecedoresCriados.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {summary.fornecedoresCriados.map((forn, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] bg-white text-gray-700"
                      >
                        {forn}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {summary.erros.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="font-semibold text-red-900 block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Linhas com Divergências ({summary.erros.length}):
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] text-red-800">
                    {summary.erros.map((err, i) => (
                      <div key={i}>
                        [{err.aba}] Linha {err.linha}: {err.motivo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-[#ECEAE4] bg-[#FAF9F7] flex items-center justify-between">
          {step > 1 && step < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="text-xs border-[#ECEAE4]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>
          )}

          {step === 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
          )}

          {step === 2 && (
            <Button
              type="button"
              size="sm"
              disabled={selectedSheetsCount === 0}
              onClick={() => setStep(3)}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto"
            >
              Avançar p/ Mapeamento
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 3 && (
            <Button
              type="button"
              size="sm"
              disabled={!mapping.valor || !mapping.vencimento}
              onClick={handleExecuteImport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs ml-auto shadow-xs font-semibold"
            >
              Iniciar Importação de {selectedSheetsCount} aba(s)
              <Check className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 5 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                handleReset()
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto"
            >
              Concluir e Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
