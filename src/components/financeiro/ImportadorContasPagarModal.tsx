import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { apenasDigitos, formatarCnpj, buscarCnpj } from '@/lib/brasilApi'
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

export interface ContasPagarImportSummary {
  totalLidos: number
  importados: number
  duplicadosPulados: number
  pagasBaixadas: number
  emAberto: number
  fornecedoresCriados: string[]
  erros: { linha: number; aba: string; motivo: string }[]
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
  let ano = currentYear
  const ano4Match = norm.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/)
  if (ano4Match) {
    ano = parseInt(ano4Match[1], 10)
  } else {
    const ano2Match = norm.match(/[_\s-](\d{2})(?:\.|$)/)
    if (ano2Match) {
      const yy = parseInt(ano2Match[1], 10)
      ano = 2000 + yy
    }
  }

  // Se o ano inferido for ano atual mas a planilha ou contexto indicar 2026, respeitar caso esteja em 2026
  if (ano < 2020 || ano > 2035) {
    ano = 2026
  }

  // Inferir mês procurando termos ordenados por especificidade (longest first)
  let mes = new Date().getMonth() + 1
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

export function detectarLinhaCabecalho(matrix: any[][]): number {
  if (!matrix || matrix.length === 0) return 1

  for (let r = 0; r < Math.min(matrix.length, 12); r++) {
    const row = matrix[r] || []
    const texts = row.map((cell) =>
      String(cell || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim(),
    )

    const hasVenc = texts.some(
      (t) =>
        t.includes('VENC') ||
        t.includes('DATA') ||
        t.includes('EMISS') ||
        t.includes('DIA') ||
        t.includes('DT'),
    )
    const hasForn = texts.some(
      (t) =>
        t.includes('FORN') ||
        t.includes('FAVOREC') ||
        t.includes('CREDOR') ||
        t.includes('NOME') ||
        t.includes('EMPRESA') ||
        t.includes('BENEFICI'),
    )
    const hasVal = texts.some(
      (t) =>
        t.includes('VAL') ||
        t.includes('PAGO') ||
        t.includes('TOTAL') ||
        t.includes('BRUTO') ||
        t.includes('LIQUIDO'),
    )
    const hasDesc = texts.some(
      (t) =>
        t.includes('HIST') ||
        t.includes('DESC') ||
        t.includes('REF') ||
        t.includes('CONTA') ||
        t.includes('DISCRIM') ||
        t.includes('ITEM') ||
        t.includes('SERVIC'),
    )

    if (
      (hasVenc && hasVal) ||
      (hasForn && hasVal) ||
      (hasDesc && hasVal) ||
      (hasVenc && hasDesc) ||
      (hasForn && hasDesc)
    ) {
      return r + 1 // 1-based
    }
  }

  return 1
}

export function parseValorPagar(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val)
  if (!val) return 0
  let str = String(val).replace(/R\$/g, '').trim()
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }
  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.abs(num)
}

export function parseDataPagar(val: any, anoFallback?: number, mesFallback?: number): string {
  if (!val) {
    if (anoFallback && mesFallback) {
      const d = new Date(Date.UTC(anoFallback, mesFallback - 1, 10, 12, 0, 0))
      return d.toISOString()
    }
    return new Date().toISOString()
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString()
  }

  if (typeof val === 'number') {
    // Número serial Excel
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  const str = String(val).trim()
  // Dia apenas (ex.: 5, 12, 28) acompanhado de competência
  if (/^\d{1,2}$/.test(str) && anoFallback && mesFallback) {
    const dia = Math.min(31, Math.max(1, parseInt(str, 10)))
    const d = new Date(Date.UTC(anoFallback, mesFallback - 1, dia, 12, 0, 0))
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // DD/MM/YYYY ou DD/MM/YY
  const brMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (brMatch) {
    const d = parseInt(brMatch[1], 10)
    const m = parseInt(brMatch[2], 10) - 1
    let y = parseInt(brMatch[3], 10)
    if (y < 100) y += 2000
    const date = new Date(Date.UTC(y, m, d, 12, 0, 0))
    if (!isNaN(date.getTime())) return date.toISOString()
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10) - 1
    const d = parseInt(isoMatch[3], 10)
    const date = new Date(Date.UTC(y, m, d, 12, 0, 0))
    if (!isNaN(date.getTime())) return date.toISOString()
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString()

  if (anoFallback && mesFallback) {
    return new Date(Date.UTC(anoFallback, mesFallback - 1, 10, 12, 0, 0)).toISOString()
  }
  return new Date().toISOString()
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

  // Carrega cabeçalhos e primeiras linhas de uma aba específica
  const carregarPreviaAba = (wb: XLSX.WorkBook, config: SheetCompetencia) => {
    const ws = wb.Sheets[config.name]
    if (!ws) return

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

    // Heurística de sugestão de mapeamento inteligente
    const findCol = (regex: RegExp) => headers.find((h) => regex.test(h)) || ''
    const descColFound = findCol(/hist|desc|serv|prod|refer[eê]ncia|item|discrim/i) || ''
    const fornColFound = findCol(/forn|favorec|credor|benefici[aá]rio|empresa/i) || ''

    setMapping((prev) => ({
      vencimento:
        prev.vencimento && headers.includes(prev.vencimento)
          ? prev.vencimento
          : findCol(/venc|data_venc|dt_venc|data|dia/i) || headers[0] || '',
      fornecedor:
        prev.fornecedor && headers.includes(prev.fornecedor)
          ? prev.fornecedor
          : fornColFound || descColFound || '',
      descricao:
        prev.descricao && headers.includes(prev.descricao)
          ? prev.descricao
          : descColFound || fornColFound || '',
      valor:
        prev.valor && headers.includes(prev.valor)
          ? prev.valor
          : findCol(/val|total|bruto|a pagar/i) || '',
      valorPago:
        prev.valorPago && headers.includes(prev.valorPago)
          ? prev.valorPago
          : findCol(/pago|pg|liquid|valor_pago/i) || '',
      dataPagamento:
        prev.dataPagamento && headers.includes(prev.dataPagamento)
          ? prev.dataPagamento
          : findCol(/dt_pag|data_pag|baixa|liquid/i) || '',
      formaPagamento:
        prev.formaPagamento && headers.includes(prev.formaPagamento)
          ? prev.formaPagamento
          : findCol(/forma|meio|tipo_pag/i) || '',
      status:
        prev.status && headers.includes(prev.status)
          ? prev.status
          : findCol(/status|situa[cç][aã]o|cond/i) || '',
      centroCusto:
        prev.centroCusto && headers.includes(prev.centroCusto)
          ? prev.centroCusto
          : findCol(/centro|cc|custo|frente|setor/i) || '',
      categoria:
        prev.categoria && headers.includes(prev.categoria)
          ? prev.categoria
          : findCol(/categ|plano|conta/i) || '',
      documento:
        prev.documento && headers.includes(prev.documento)
          ? prev.documento
          : findCol(/doc|nf|nota|duplicata|fatura/i) || '',
      cnpj: prev.cnpj && headers.includes(prev.cnpj) ? prev.cnpj : findCol(/cnpj|cpf|insc/i) || '',
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

      // Deduplicação: fornecedor_id + data(YYYY-MM-DD) + valor + descricao
      const existingKeys = new Set<string>()
      contasExistentes.forEach((c) => {
        const d = c.vencimento.slice(0, 10)
        const descNorm = (c.descricao || '').trim().toLowerCase().slice(0, 30)
        const key = `${c.fornecedor_id || ''}_${d}_${Number(c.valor).toFixed(2)}_${descNorm}`
        existingKeys.add(key)
      })

      const sheetsToImport = sheetsConfig.filter((s) => s.selected)

      for (const sheetCfg of sheetsToImport) {
        setProgressMsg(`Processando aba: ${sheetCfg.name}...`)
        const ws = workbook.Sheets[sheetCfg.name]
        if (!ws) continue

        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        const headerIdx = sheetCfg.headerRowIndex || 1
        const headers =
          matrix[headerIdx - 1]?.map((c, i) => String(c || '').trim() || `Coluna_${i + 1}`) || []
        const dataRows = matrix.slice(headerIdx)

        const getVal = (row: any[], headerName: string): any => {
          if (!headerName) return ''
          const colIdx = headers.indexOf(headerName)
          if (colIdx === -1) return ''
          return row[colIdx] ?? ''
        }

        for (let r = 0; r < dataRows.length; r++) {
          const row = dataRows[r]
          resultSummary.totalLidos += 1

          try {
            const rawVenc = getVal(row, mapping.vencimento)
            let rawForn = String(getVal(row, mapping.fornecedor) || '').trim()
            const rawDesc = String(getVal(row, mapping.descricao) || '').trim()
            // Regra: se o campo Fornecedor vier vazio (ou não mapeado), usar o conteúdo da coluna Descrição
            if (!rawForn && rawDesc) {
              rawForn = rawDesc
            }
            const rawValor = parseValorPagar(getVal(row, mapping.valor))
            const rawValorPago = mapping.valorPago
              ? parseValorPagar(getVal(row, mapping.valorPago))
              : 0
            const rawDataPag = getVal(row, mapping.dataPagamento)
            const rawForma = String(getVal(row, mapping.formaPagamento) || '').trim()
            const rawStatus = String(getVal(row, mapping.status) || '').toLowerCase()
            const rawCentro = String(getVal(row, mapping.centroCusto) || '').trim()
            const rawCat = String(getVal(row, mapping.categoria) || '').trim()
            const rawDoc = String(getVal(row, mapping.documento) || '').trim()
            const rawCnpj = String(getVal(row, mapping.cnpj) || '').trim()

            // Linha vazia ou totalizador sem valor e sem descrição válida
            if (rawValor <= 0 && rawValorPago <= 0 && !rawDesc && !rawForn) {
              continue
            }

            // Ignorar linhas de cabeçalho repetidas ou rótulos de totais
            const lowerDesc = rawDesc.toLowerCase()
            if (
              lowerDesc.startsWith('total') ||
              lowerDesc.startsWith('saldo') ||
              lowerDesc.startsWith('subtotal')
            ) {
              continue
            }

            const valorFinal = rawValor > 0 ? rawValor : rawValorPago
            if (valorFinal <= 0) {
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
                // Cadastrar novo fornecedor
                try {
                  let cnpjConsultaInfo: any = null
                  if (cnpjLimpo.length === 14 && buscarCnpjBrasilApi) {
                    try {
                      cnpjConsultaInfo = await buscarCnpj(cnpjLimpo)
                    } catch {
                      // Silently fall back to manual creation
                    }
                  }

                  const novoFornecedor = await pb.collection('fornecedores').create<Fornecedor>({
                    empresa_id: empresaId,
                    nome:
                      cnpjConsultaInfo?.nomeFantasia || cnpjConsultaInfo?.razaoSocial || rawForn,
                    cnpj_cpf: cnpjLimpo ? formatarCnpj(cnpjLimpo) : undefined,
                    telefone: cnpjConsultaInfo?.telefone || undefined,
                    email: cnpjConsultaInfo?.email || undefined,
                    endereco: cnpjConsultaInfo?.enderecoCompleto || undefined,
                    cidade: cnpjConsultaInfo?.cidade || undefined,
                    uf: cnpjConsultaInfo?.uf || undefined,
                    cep: cnpjConsultaInfo?.cep || undefined,
                    observacoes: `Criado automaticamente na importação da planilha (aba ${sheetCfg.name})`,
                  })

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

            // 2. Data de Vencimento
            const dataVencimentoISO = parseDataPagar(rawVenc, sheetCfg.ano, sheetCfg.mes)

            // 3. Descrição
            const docInfo = rawDoc ? ` [NF/Doc: ${rawDoc}]` : ''
            const descFinal = rawDesc || `Despesa ${rawForn || sheetCfg.name}${docInfo}`

            // 4. Verificação de Duplicidade
            const dateOnly = dataVencimentoISO.slice(0, 10)
            const descNorm = descFinal.toLowerCase().slice(0, 30)
            const dedupeKey = `${fornecedorId || ''}_${dateOnly}_${valorFinal.toFixed(2)}_${descNorm}`

            if (detectarDuplicados && existingKeys.has(dedupeKey)) {
              resultSummary.duplicadosPulados += 1
              continue
            }

            // 5. Determinar Situação (Paga ou Aberta)
            let isPaga = false
            if (classificacaoPadrao === 'Paga') {
              isPaga = true
            } else if (classificacaoPadrao === 'Aberta') {
              isPaga = false
            } else {
              // Auto-detectar
              if (
                rawValorPago > 0 ||
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
                // Se a data de vencimento for bem passada e não houver status aberto, a pedreira frequentemente lista despesas realizadas
                // Mas sendo cauteloso: se há valor pago ou data pag, marca como paga; senão se rawValorPago == rawValor, paga.
                isPaga = rawValorPago >= valorFinal && rawValorPago > 0
              }
            }

            const dataPagamentoISO = isPaga
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
            const createdConta = await pb.collection('contas_pagar').create<ContaPagar>({
              empresa_id: empresaId,
              fornecedor_id: fornecedorId || null,
              descricao: descFinal,
              categoria_id: finalCategoriaId,
              centro_custo_id: finalCentroCustoId,
              valor: valorFinal,
              vencimento: dataVencimentoISO,
              parcelas: 1,
              status: isPaga ? 'Paga' : 'Aberta',
              data_pagamento: isPaga ? dataPagamentoISO : null,
              forma_pagamento: isPaga ? finalForma : null,
              observacoes: `Importado de planilha [Aba: ${sheetCfg.name}]${rawDoc ? ` | Doc: ${rawDoc}` : ''}`,
            })

            // 10. Se baixada/paga, gerar movimento financeiro de saída
            if (isPaga && dataPagamentoISO) {
              try {
                await pb.collection('movimentos_financeiros').create({
                  empresa_id: empresaId,
                  tipo: 'Saida',
                  descricao: `Pagamento: ${createdConta.descricao}${rawForn ? ` [${rawForn}]` : ''}`,
                  valor: valorFinal,
                  data: dataPagamentoISO,
                  categoria_id: finalCategoriaId,
                  centro_custo_id: finalCentroCustoId,
                  origem: 'ContaPagar',
                  referencia_id: createdConta.id,
                  conciliado: false,
                })
              } catch (eMov) {
                console.warn('Erro ao criar movimento financeiro correspondente:', eMov)
              }
            }

            existingKeys.add(dedupeKey)
            resultSummary.importados += 1
            if (isPaga) {
              resultSummary.pagasBaixadas += 1
            } else {
              resultSummary.emAberto += 1
            }
          } catch (rowErr: any) {
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: r + headerIdx + 1,
              motivo: rowErr.message || 'Falha ao processar linha',
            })
          }
        }
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
                          {cfg.totalRows} linhas • Cabeçalho na linha {cfg.headerRowIndex}
                          {cfg.sufixo && ` (2ª Folha ${cfg.sufixo})`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                  <div className="space-y-1 max-h-28 overflow-y-auto text-[11px] text-red-800">
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
