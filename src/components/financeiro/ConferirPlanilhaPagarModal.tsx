import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Fornecedor, PlanoConta, CentroCusto, ContaPagar } from '@/types/erp'
import {
  inferirCompetenciaAba,
  detectarLinhaCabecalho,
  desdobrarCelulasMescladas,
  normalizarNomeColuna,
  parseValorPagar,
  parseDataPagar,
  REGEX_COL_VENCIMENTO,
  REGEX_COL_VALOR,
  REGEX_COL_VALOR_PAGO,
  REGEX_COL_DATA_PAGAMENTO,
  REGEX_COL_FORNECEDOR,
  REGEX_COL_DESCRICAO,
  type SheetCompetencia,
  type ColumnMappingPagar,
} from './ImportadorContasPagarModal'
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
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react'

export interface ConferirPlanilhaPagarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  fornecedores: Fornecedor[]
  categorias: PlanoConta[]
  centrosCusto: CentroCusto[]
  contasExistentes: ContaPagar[]
  onDataChanged: () => Promise<void>
}

export type DivergenciaTipo = 'valor' | 'valor_pago' | 'data_pagamento' | 'status'

export interface DivergenciaItem {
  id: string // chave interna unica
  aba: string
  linhaNum: number
  fornecedorNome: string
  descricao: string
  vencimentoPlanilha: string
  valorPlanilha: number
  valorPagoPlanilha: number
  dataPagamentoPlanilha: string | null
  statusPlanilha: 'Aberta' | 'Paga'
  formaPagamentoPlanilha: string | null
  centroCustoTexto: string
  categoriaTexto: string
  documentoTexto: string
  cnpjTexto: string
  // Dados do sistema caso exista
  classificacao: 'conferido' | 'divergente' | 'nao_lancado'
  contaExistente?: ContaPagar
  divergencias: {
    campo: 'valor' | 'valor_pago' | 'data_pagamento' | 'status'
    label: string
    planilha: string
    sistema: string
  }[]
}

export interface ResumoAba {
  aba: string
  totalLinhas: number
  conferidos: number
  divergentes: number
  naoLancados: number
  valorTotalPlanilha: number
}

const MESES_NOMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

export function ConferirPlanilhaPagarModal({
  open,
  onOpenChange,
  empresaId,
  fornecedores,
  categorias,
  centrosCusto,
  contasExistentes,
  onDataChanged,
}: ConferirPlanilhaPagarModalProps) {
  // Wizard steps:
  // 1: Upload da planilha
  // 2: Seleção e Competência das Abas
  // 3: Mapeamento de Colunas
  // 4: Processando comparação em lote (memória)
  // 5: Dashboard e Tabela de Resultados
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

  // Comparison Options
  const [toleranciaCentavos, setToleranciaCentavos] = useState<number>(0.05) // R$ 0,05 de tolerância
  const [classificacaoPadrao, setClassificacaoPadrao] = useState<'auto' | 'Paga' | 'Aberta'>('auto')

  // Execution State
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [progressLabel, setProgressLabel] = useState<string>('')

  // Results
  const [itensComparados, setItensComparados] = useState<DivergenciaItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  // Filters on Results screen
  const [filterAba, setFilterAba] = useState<string>('todas')
  const [filterTipo, setFilterTipo] = useState<
    'todas' | 'conferido' | 'divergente' | 'nao_lancado'
  >('todas')
  const [filterSearch, setFilterSearch] = useState<string>('')

  // Action in progress state
  const [isExecutingAction, setIsExecutingAction] = useState(false)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetsConfig([])
    setActiveSheetPreview('')
    setSheetHeaders([])
    setPreviewRows([])
    setItensComparados([])
    setSelectedItemIds(new Set())
    setProgressPercent(0)
    setProgressLabel('')
    setIsExecutingAction(false)
    setFilterAba('todas')
    setFilterTipo('todas')
    setFilterSearch('')
  }

  // 1. Upload
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

      // Configurar abas
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

      const firstConfig = configs[0]
      setActiveSheetPreview(firstConfig.name)
      carregarPreviaAba(wb, firstConfig)

      setStep(2)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir planilha Excel',
        description: err.message || 'Verifique se o arquivo é um .xlsx válido.',
        variant: 'destructive',
      })
    }
  }

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

    // Sugestão de mapeamento inteligente com normalização profunda
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

  const toggleSheetSelected = (sheetName: string) => {
    setSheetsConfig((prev) =>
      prev.map((s) => (s.name === sheetName ? { ...s, selected: !s.selected } : s)),
    )
  }

  const selectAllSheets = (selected: boolean) => {
    setSheetsConfig((prev) => prev.map((s) => ({ ...s, selected })))
  }

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

  const updateSheetCompetencia = (sheetName: string, mes: number, ano: number) => {
    setSheetsConfig((prev) => prev.map((s) => (s.name === sheetName ? { ...s, mes, ano } : s)))
  }

  const selectedSheets = useMemo(() => sheetsConfig.filter((s) => s.selected), [sheetsConfig])

  // Normalização de string para chave
  const normalizarTexto = (txt: string) => {
    return (txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }

  // 4. Executar Conferência em Lote (Memória)
  const executarConferencia = async () => {
    if (!workbook) return
    setStep(4)
    setProgressPercent(0)
    setProgressLabel('Construindo índice das contas já lançadas no sistema...')

    // Pequeno delay para a UI renderizar o spinner
    await new Promise((r) => setTimeout(r, 60))

    try {
      // 1. Indexar as contas existentes no sistema
      // Mapear por múltiplas estratégias para tolerância a pequenos desvios:
      // A) Chave exata: fornecedorNomeNorm + date(YYYY-MM-DD) + valorFormatado + descNorm
      // B) Chave aproximada: date(YYYY-MM-DD) + valorFormatado (para localizar candidatos)
      // C) Chave fornecedor + data
      const contasMapByExactKey = new Map<string, ContaPagar[]>()
      const contasMapByDateAndValue = new Map<string, ContaPagar[]>()
      const contasMapByDescAndValue = new Map<string, ContaPagar[]>()

      for (const c of contasExistentes) {
        const dateIso = (c.vencimento || '').slice(0, 10)
        const fornNome = c.expand?.fornecedor_id?.nome || ''
        const fornNorm = normalizarTexto(fornNome)
        const descNorm = normalizarTexto(c.descricao)
        const valorFixed = Number(c.valor || 0).toFixed(2)

        // Exact
        const exactKey = `${fornNorm}_${dateIso}_${valorFixed}_${descNorm.slice(0, 20)}`
        if (!contasMapByExactKey.has(exactKey)) contasMapByExactKey.set(exactKey, [])
        contasMapByExactKey.get(exactKey)!.push(c)

        // Date + Value
        const dvKey = `${dateIso}_${valorFixed}`
        if (!contasMapByDateAndValue.has(dvKey)) contasMapByDateAndValue.set(dvKey, [])
        contasMapByDateAndValue.get(dvKey)!.push(c)

        // Desc + Value
        const dscValKey = `${descNorm.slice(0, 20)}_${valorFixed}`
        if (!contasMapByDescAndValue.has(dscValKey)) contasMapByDescAndValue.set(dscValKey, [])
        contasMapByDescAndValue.get(dscValKey)!.push(c)
      }

      // 2. Mapeamento de fornecedores existentes
      const fornecedoresMap = new Map<string, Fornecedor>()
      fornecedores.forEach((f) => {
        fornecedoresMap.set(normalizarTexto(f.nome), f)
      })

      const itensResultado: DivergenciaItem[] = []
      const usedContaIds = new Set<string>()

      const totalSheets = selectedSheets.length
      for (let sIdx = 0; sIdx < totalSheets; sIdx++) {
        const sheetCfg = selectedSheets[sIdx]
        setProgressLabel(
          `Conferindo aba ${sIdx + 1} de ${totalSheets}: ${sheetCfg.name} (${sheetCfg.totalRows} linhas)...`,
        )
        setProgressPercent(Math.round(((sIdx + 1) / totalSheets) * 100))
        // Yield to browser event loop
        await new Promise((r) => setTimeout(r, 10))

        const ws = workbook.Sheets[sheetCfg.name]
        if (!ws) continue

        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        // Redetectar a linha de cabeçalho dinamicamente para CADA aba
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
          let melhorCol = valCol
          let maiorDensidade = 0

          for (let cIdx = 0; cIdx < currentSheetHeaders.length; cIdx++) {
            const h = currentSheetHeaders[cIdx]
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

          // Checar se a linha inteira está vazia
          const temConteudo = row.some((c) => String(c ?? '').trim().length > 0)
          if (!temConteudo) continue

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
          const rawValorPago = activeValPagoCol ? parseValorPagar(getVal(row, activeValPagoCol)) : 0
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
          // 2) Se não produzir número > 0, varrer as células da linha (pulando vencimento e doc)
          let valorFinal = rawValor > 0 ? rawValor : rawValorPago
          if (valorFinal <= 0) {
            let maiorValorEncontrado = 0
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
              if (colIdx === activeVencColIdx || colIdx === activeDocColIdx) continue

              const cellRaw = row[colIdx]
              if (typeof cellRaw === 'string' && /^(?:NF|DOC|NOTA|DUPL)/i.test(cellRaw.trim()))
                continue
              if (cellRaw instanceof Date) continue

              const cellVal = parseValorPagar(cellRaw)
              if (cellVal > 0) {
                const hName = normalizarNomeColuna(activeHeaders[colIdx] || '')
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

          if (valorFinal <= 0) continue

          // Data Vencimento Planilha com barreira sanitária estrita (2024-2028), herança e busca segura
          let dataParaVenc = rawVenc
          const rawVencStr = String(rawVenc ?? '').trim()

          const isValidaSanitariaConf = (val: any) => {
            if (val === null || val === undefined || String(val).trim() === '') return false
            const parsed = parseDataPagar(val, sheetCfg.ano, sheetCfg.mes)
            if (!parsed || parsed.startsWith('1970')) return false
            const yMatch = parsed.match(/^(\d{4})/)
            if (!yMatch) return false
            const y = parseInt(yMatch[1], 10)
            return y >= 2024 && y <= 2028
          }

          let teveDataPropriaConf = false
          if (rawVencStr && isValidaSanitariaConf(rawVenc)) {
            teveDataPropriaConf = true
            ultimaDataValida = rawVenc
          }

          if (!teveDataPropriaConf && ultimaDataValida && isValidaSanitariaConf(ultimaDataValida)) {
            dataParaVenc = ultimaDataValida
          }

          let vencIso = parseDataPagar(dataParaVenc, sheetCfg.ano, sheetCfg.mes)
          if (!vencIso || vencIso.startsWith('1970') || !isValidaSanitariaConf(vencIso)) {
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
              if (colIdx === activeDocColIdx) continue
              const colHeader = normalizarNomeColuna(activeHeaders[colIdx] || '')
              if (
                colHeader.includes('VALOR') ||
                colHeader.includes('FORNEC') ||
                colHeader.includes('FAVOREC') ||
                colHeader.includes('DOC') ||
                colHeader.includes('NOTA')
              ) {
                continue
              }
              const candVal = row[colIdx]
              if (candVal !== null && candVal !== undefined && String(candVal).trim() !== '') {
                if (isValidaSanitariaConf(candVal)) {
                  vencIso = parseDataPagar(candVal, sheetCfg.ano, sheetCfg.mes)
                  rawVenc = candVal
                  teveDataPropriaConf = true
                  ultimaDataValida = candVal
                  break
                }
              }
            }
          }

          if (!vencIso || vencIso.startsWith('1970') || !isValidaSanitariaConf(vencIso)) {
            if (ultimaDataValida && isValidaSanitariaConf(ultimaDataValida)) {
              vencIso = parseDataPagar(ultimaDataValida, sheetCfg.ano, sheetCfg.mes)
            }
            if (!vencIso || vencIso.startsWith('1970') || !isValidaSanitariaConf(vencIso)) {
              const y = sheetCfg.ano || 2026
              const m = sheetCfg.mes || 1
              vencIso = `${y}-${String(m).padStart(2, '0')}-01T12:00:00.000Z`
            }
          } else if (rawVencStr && !teveDataPropriaConf && isValidaSanitariaConf(rawVenc)) {
            ultimaDataValida = rawVenc
            teveDataPropriaConf = true
          }

          const vencDateOnly = vencIso.slice(0, 10)

          // Status Planilha
          let isPagaPlanilha = false
          if (classificacaoPadrao === 'Paga') {
            isPagaPlanilha = true
          } else if (classificacaoPadrao === 'Aberta') {
            isPagaPlanilha = false
          } else {
            if (
              rawValorPago > 0 ||
              rawDataPag ||
              rawStatus.includes('pag') ||
              rawStatus.includes('liquid') ||
              rawStatus.includes('baix') ||
              rawStatus.includes('quit')
            ) {
              isPagaPlanilha = true
            } else if (
              rawStatus.includes('abert') ||
              rawStatus.includes('pend') ||
              rawStatus.includes('venc')
            ) {
              isPagaPlanilha = false
            } else {
              isPagaPlanilha = rawValorPago >= valorFinal && rawValorPago > 0
            }
          }

          const rawPagParaParseConf = isValidaSanitariaConf(rawDataPag)
            ? rawDataPag
            : isValidaSanitariaConf(rawVenc)
              ? rawVenc
              : vencIso

          const dataPagIso = isPagaPlanilha
            ? parseDataPagar(rawPagParaParseConf, sheetCfg.ano, sheetCfg.mes)
            : null

          const docInfo = rawDoc ? ` [NF/Doc: ${rawDoc}]` : ''
          const descFinal = rawDesc || `Despesa ${rawForn || sheetCfg.name}${docInfo}`

          const fornNorm = normalizarTexto(rawForn)
          const descNorm = normalizarTexto(descFinal)
          const valFixed = valorFinal.toFixed(2)

          // Buscar correspondente no sistema
          let matchingConta: ContaPagar | undefined = undefined

          // 1. Chave exata
          const exactKey = `${fornNorm}_${vencDateOnly}_${valFixed}_${descNorm.slice(0, 20)}`
          const exactCandidates = contasMapByExactKey.get(exactKey)
          if (exactCandidates && exactCandidates.length > 0) {
            // Pegar o primeiro ainda não usado
            matchingConta = exactCandidates.find((c) => !usedContaIds.has(c.id))
          }

          // 2. Se não achou exato, buscar por data + valor e testar similaridade do nome/descrição
          if (!matchingConta) {
            const dvCandidates = contasMapByDateAndValue.get(`${vencDateOnly}_${valFixed}`)
            if (dvCandidates) {
              matchingConta = dvCandidates.find((c) => {
                if (usedContaIds.has(c.id)) return false
                const cForn = normalizarTexto(c.expand?.fornecedor_id?.nome || '')
                const cDesc = normalizarTexto(c.descricao)
                return (
                  cForn.includes(fornNorm) ||
                  fornNorm.includes(cForn) ||
                  cDesc.includes(descNorm.slice(0, 15)) ||
                  descNorm.includes(cDesc.slice(0, 15))
                )
              })
            }
          }

          // 3. Se não achou, buscar por descrição + valor com tolerância de data (mesmo mês/ano)
          if (!matchingConta) {
            const descCandidates = contasMapByDescAndValue.get(
              `${descNorm.slice(0, 20)}_${valFixed}`,
            )
            if (descCandidates) {
              matchingConta = descCandidates.find((c) => {
                if (usedContaIds.has(c.id)) return false
                // Checar se é o mesmo ano e mês
                const cVenc = (c.vencimento || '').slice(0, 7)
                return cVenc === vencDateOnly.slice(0, 7)
              })
            }
          }

          // 4. Se não achou, buscar por fornecedor + vencimento onde o valor difere (para detectar DIVERGÊNCIA DE VALOR!)
          if (!matchingConta) {
            matchingConta = contasExistentes.find((c) => {
              if (usedContaIds.has(c.id)) return false
              const cDate = (c.vencimento || '').slice(0, 10)
              if (cDate !== vencDateOnly) return false
              const cForn = normalizarTexto(c.expand?.fornecedor_id?.nome || '')
              const cDesc = normalizarTexto(c.descricao)
              const fornMatch =
                (fornNorm && (cForn.includes(fornNorm) || fornNorm.includes(cForn))) ||
                (descNorm &&
                  (cDesc.includes(descNorm.slice(0, 15)) || descNorm.includes(cDesc.slice(0, 15))))
              return !!fornMatch
            })
          }

          // Classificação e Divergências
          const divergencias: DivergenciaItem['divergencias'] = []
          let classificacao: 'conferido' | 'divergente' | 'nao_lancado' = 'nao_lancado'

          if (matchingConta) {
            usedContaIds.add(matchingConta.id)

            // Comparar Valor Total (com tolerância)
            const diffValor = Math.abs((matchingConta.valor || 0) - valorFinal)
            if (diffValor > toleranciaCentavos) {
              divergencias.push({
                campo: 'valor',
                label: 'Valor Total',
                planilha: formatCurrency(valorFinal),
                sistema: formatCurrency(matchingConta.valor),
              })
            }

            // Comparar Status (Paga vs Aberta)
            const sysStatus = matchingConta.status === 'Paga' ? 'Paga' : 'Aberta'
            const planStatus = isPagaPlanilha ? 'Paga' : 'Aberta'
            if (sysStatus !== planStatus) {
              divergencias.push({
                campo: 'status',
                label: 'Situação / Baixa',
                planilha: planStatus,
                sistema: sysStatus,
              })
            }

            // Comparar Data de Pagamento se ambos forem pagos
            if (isPagaPlanilha && sysStatus === 'Paga') {
              const planPagDate = dataPagIso ? dataPagIso.slice(0, 10) : null
              const sysPagDate = matchingConta.data_pagamento
                ? matchingConta.data_pagamento.slice(0, 10)
                : null

              if (planPagDate && sysPagDate && planPagDate !== sysPagDate) {
                divergencias.push({
                  campo: 'data_pagamento',
                  label: 'Data de Pagamento',
                  planilha: formatDate(planPagDate),
                  sistema: formatDate(sysPagDate),
                })
              }
            }

            // Comparar Valor Pago (se houver coluna de valor pago na planilha)
            if (rawValorPago > 0) {
              const valorPagoSys =
                matchingConta.valor_pago !== undefined && matchingConta.valor_pago !== null
                  ? matchingConta.valor_pago
                  : matchingConta.status === 'Paga'
                    ? matchingConta.valor || 0
                    : 0
              const diffPago = Math.abs(rawValorPago - valorPagoSys)
              if (diffPago > toleranciaCentavos) {
                divergencias.push({
                  campo: 'valor_pago',
                  label: 'Valor Pago',
                  planilha: formatCurrency(rawValorPago),
                  sistema: formatCurrency(valorPagoSys),
                })
              }
            }

            if (divergencias.length > 0) {
              classificacao = 'divergente'
            } else {
              classificacao = 'conferido'
            }
          } else {
            classificacao = 'nao_lancado'
          }

          itensResultado.push({
            id: `${sheetCfg.name}_${r + headerIdx + 1}_${Date.now()}_${Math.random()}`,
            aba: sheetCfg.name,
            linhaNum: r + headerIdx + 1,
            fornecedorNome: rawForn,
            descricao: descFinal,
            vencimentoPlanilha: vencIso,
            valorPlanilha: valorFinal,
            valorPagoPlanilha: rawValorPago,
            dataPagamentoPlanilha: dataPagIso,
            statusPlanilha: isPagaPlanilha ? 'Paga' : 'Aberta',
            formaPagamentoPlanilha: rawForma || 'Pix',
            centroCustoTexto: rawCentro,
            categoriaTexto: rawCat,
            documentoTexto: rawDoc,
            cnpjTexto: rawCnpj,
            classificacao,
            contaExistente: matchingConta,
            divergencias,
          })
        }
      }

      setItensComparados(itensResultado)
      setStep(5)
      toast({
        title: 'Conferência de planilha finalizada!',
        description: `${itensResultado.length} linhas analisadas contra a base do sistema.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro durante a conferência',
        description: err.message || 'Falha ao processar comparação.',
        variant: 'destructive',
      })
      setStep(3)
    }
  }

  // Estatísticas e KPIs consolidados
  const kpis = useMemo(() => {
    let conferidos = 0
    let divergentes = 0
    let naoLancados = 0
    let valorPlanilha = 0
    let valorSistema = 0

    itensComparados.forEach((item) => {
      valorPlanilha += item.valorPlanilha || 0
      if (item.classificacao === 'conferido') {
        conferidos++
        valorSistema += item.contaExistente?.valor || item.valorPlanilha
      } else if (item.classificacao === 'divergente') {
        divergentes++
        valorSistema += item.contaExistente?.valor || 0
      } else {
        naoLancados++
      }
    })

    const diferenca = valorPlanilha - valorSistema

    return {
      total: itensComparados.length,
      conferidos,
      divergentes,
      naoLancados,
      valorPlanilha,
      valorSistema,
      diferenca,
    }
  }, [itensComparados])

  // Resumo por Aba / Competência
  const resumoPorAba = useMemo((): ResumoAba[] => {
    const map = new Map<string, ResumoAba>()
    itensComparados.forEach((item) => {
      if (!map.has(item.aba)) {
        map.set(item.aba, {
          aba: item.aba,
          totalLinhas: 0,
          conferidos: 0,
          divergentes: 0,
          naoLancados: 0,
          valorTotalPlanilha: 0,
        })
      }
      const entry = map.get(item.aba)!
      entry.totalLinhas++
      entry.valorTotalPlanilha += item.valorPlanilha
      if (item.classificacao === 'conferido') entry.conferidos++
      else if (item.classificacao === 'divergente') entry.divergentes++
      else entry.naoLancados++
    })
    return Array.from(map.values())
  }, [itensComparados])

  // Lista filtrada para exibição
  const filteredItens = useMemo(() => {
    return itensComparados.filter((item) => {
      if (filterAba !== 'todas' && item.aba !== filterAba) return false
      if (filterTipo !== 'todas' && item.classificacao !== filterTipo) return false
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase()
        const matchForn = item.fornecedorNome.toLowerCase().includes(q)
        const matchDesc = item.descricao.toLowerCase().includes(q)
        const matchDoc = item.documentoTexto.toLowerCase().includes(q)
        if (!matchForn && !matchDesc && !matchDoc) return false
      }
      return true
    })
  }, [itensComparados, filterAba, filterTipo, filterSearch])

  // Toggle de seleção de linhas
  const toggleSelectRow = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedItemIds(new Set(filteredItens.map((i) => i.id)))
    } else {
      setSelectedItemIds(new Set())
    }
  }

  // AÇÕES SOBRE O RESULTADO:
  // 1. Importar itens "Não lançados" selecionados
  const handleImportarNaoLancados = async () => {
    const itensParaImportar = itensComparados.filter(
      (item) => item.classificacao === 'nao_lancado' && selectedItemIds.has(item.id),
    )

    if (itensParaImportar.length === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Selecione as linhas "Não lançado" que deseja importar.',
      })
      return
    }

    if (
      !confirm(
        `Confirma a importação de ${itensParaImportar.length} lançamento(s) não cadastrado(s) para o banco de dados?`,
      )
    ) {
      return
    }

    setIsExecutingAction(true)
    try {
      let importados = 0
      const fornecedoresCache = new Map<string, Fornecedor>()
      fornecedores.forEach((f) => fornecedoresCache.set(f.nome.trim().toLowerCase(), f))

      for (const item of itensParaImportar) {
        // Resolver ou criar fornecedor
        let fornecedorId: string | null = null
        const nomeForn = item.fornecedorNome.trim() || item.descricao.trim()
        const keyForn = nomeForn.toLowerCase()

        if (fornecedoresCache.has(keyForn)) {
          fornecedorId = fornecedoresCache.get(keyForn)!.id
        } else if (nomeForn) {
          try {
            const novoForn = await pb.collection('fornecedores').create<Fornecedor>({
              empresa_id: empresaId,
              nome: nomeForn,
              observacoes: `Cadastrado via Conferência de Planilha (aba ${item.aba})`,
            })
            fornecedoresCache.set(keyForn, novoForn)
            fornecedorId = novoForn.id
          } catch (e) {
            console.warn('Erro ao criar fornecedor:', e)
          }
        }

        const isPaga = item.statusPlanilha === 'Paga'
        const valorPagoItem = item.valorPagoPlanilha || (isPaga ? item.valorPlanilha : 0)
        const isParcial = !isPaga && valorPagoItem > 0 && valorPagoItem < item.valorPlanilha - 0.009
        const statusItem = isPaga ? 'Paga' : isParcial ? 'Parcial' : 'Aberta'

        const novaConta = await pb.collection('contas_pagar').create<ContaPagar>({
          empresa_id: empresaId,
          fornecedor_id: fornecedorId || null,
          descricao: item.descricao,
          categoria_id: categorias[0]?.id || null,
          centro_custo_id: null,
          valor: item.valorPlanilha,
          valor_pago: valorPagoItem,
          vencimento: item.vencimentoPlanilha,
          parcelas: 1,
          status: statusItem,
          data_pagamento: isPaga || isParcial ? item.dataPagamentoPlanilha : null,
          forma_pagamento:
            isPaga || isParcial ? (item.formaPagamentoPlanilha as any) || 'Pix' : null,
          observacoes: `Lançado via Conferência de Planilha [Aba: ${item.aba}]${
            item.documentoTexto ? ` | Doc: ${item.documentoTexto}` : ''
          }`,
        })

        if ((isPaga || isParcial) && valorPagoItem > 0 && item.dataPagamentoPlanilha) {
          try {
            await pb.collection('movimentos_financeiros').create({
              empresa_id: empresaId,
              tipo: 'Saida',
              descricao: `Pagamento${isParcial ? ' parcial' : ''}: ${novaConta.descricao}${nomeForn ? ` [${nomeForn}]` : ''}`,
              valor: valorPagoItem,
              data: item.dataPagamentoPlanilha,
              origem: 'ContaPagar',
              referencia_id: novaConta.id,
              conciliado: false,
            })
          } catch (eMov) {
            console.warn('Erro ao criar movimento:', eMov)
          }
        }

        // Atualizar estado em memória do item
        item.classificacao = 'conferido'
        item.contaExistente = novaConta
        importados++
      }

      setItensComparados([...itensComparados])
      setSelectedItemIds(new Set())
      await onDataChanged()

      toast({
        title: 'Lançamentos importados com sucesso!',
        description: `${importados} contas foram criadas no sistema.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao importar itens',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsExecutingAction(false)
    }
  }

  // 2. Atualizar lançamentos divergentes com dados da planilha
  const handleAtualizarDivergentes = async () => {
    const itensParaAtualizar = itensComparados.filter(
      (item) =>
        item.classificacao === 'divergente' && item.contaExistente && selectedItemIds.has(item.id),
    )

    if (itensParaAtualizar.length === 0) {
      toast({
        title: 'Nenhum item divergente selecionado',
        description:
          'Selecione os itens divergentes que deseja atualizar com os dados da planilha.',
      })
      return
    }

    if (
      !confirm(
        `Confirma a atualização de ${itensParaAtualizar.length} lançamento(s) no sistema com os dados da planilha? Esta ação não pode ser desfeita.`,
      )
    ) {
      return
    }

    setIsExecutingAction(true)
    try {
      let atualizados = 0
      for (const item of itensParaAtualizar) {
        const conta = item.contaExistente!
        const isPaga = item.statusPlanilha === 'Paga'

        await pb.collection('contas_pagar').update(conta.id, {
          valor: item.valorPlanilha,
          vencimento: item.vencimentoPlanilha,
          status: isPaga ? 'Paga' : 'Aberta',
          data_pagamento: isPaga ? item.dataPagamentoPlanilha : null,
          forma_pagamento: isPaga ? (item.formaPagamentoPlanilha as any) || 'Pix' : null,
        })

        // Atualizar memória
        conta.valor = item.valorPlanilha
        conta.vencimento = item.vencimentoPlanilha
        conta.status = isPaga ? 'Paga' : 'Aberta'
        conta.data_pagamento = isPaga ? item.dataPagamentoPlanilha || undefined : undefined
        item.classificacao = 'conferido'
        item.divergencias = []
        atualizados++
      }

      setItensComparados([...itensComparados])
      setSelectedItemIds(new Set())
      await onDataChanged()

      toast({
        title: 'Lançamentos atualizados!',
        description: `${atualizados} contas a pagar foram alinhadas com a planilha.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar lançamentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsExecutingAction(false)
    }
  }

  // 3. Exportar CSV
  const handleExportarCsv = () => {
    if (itensComparados.length === 0) return

    const rows = [
      [
        'Aba',
        'Linha',
        'Classificacao',
        'Fornecedor Planilha',
        'Descricao',
        'Vencimento Planilha',
        'Valor Planilha',
        'Situacao Planilha',
        'Data Pagamento Planilha',
        'Valor Sistema',
        'Situacao Sistema',
        'Data Pagamento Sistema',
        'Divergencias Detalhadas',
      ],
    ]

    itensComparados.forEach((item) => {
      const divDesc = item.divergencias
        .map((d) => `${d.label}: Planilha [${d.planilha}] vs Sistema [${d.sistema}]`)
        .join(' | ')

      rows.push([
        item.aba,
        String(item.linhaNum),
        item.classificacao,
        item.fornecedorNome,
        item.descricao,
        formatDate(item.vencimentoPlanilha),
        item.valorPlanilha.toFixed(2),
        item.statusPlanilha,
        item.dataPagamentoPlanilha ? formatDate(item.dataPagamentoPlanilha) : '',
        item.contaExistente ? Number(item.contaExistente.valor).toFixed(2) : '',
        item.contaExistente ? item.contaExistente.status : '',
        item.contaExistente?.data_pagamento ? formatDate(item.contaExistente.data_pagamento) : '',
        divDesc,
      ])
    })

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `relatorio_conferencia_pagar_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 4. Imprimir Relatório A4
  const handleImprimirRelatorio = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast({ title: 'Permita popups para imprimir o relatório', variant: 'destructive' })
      return
    }

    const agora = new Date()
    const dataHoraStr =
      agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR')

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Conferência - Contas a Pagar</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; color: #1e293b; margin: 0; padding: 0; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px; }
          .empresa-title { font-size: 14px; font-weight: bold; color: #0f766e; text-transform: uppercase; }
          .sub-header { font-size: 9px; color: #64748b; margin-top: 2px; }
          .report-title { font-size: 13px; font-weight: bold; margin-top: 8px; color: #0f172a; }
          .kpi-container { display: flex; gap: 8px; margin-bottom: 14px; }
          .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
          .kpi-label { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #64748b; }
          .kpi-val { font-size: 12px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-top: 8px; }
          th { background: #f1f5f9; text-align: left; padding: 4px 6px; border-bottom: 1px solid #cbd5e1; font-weight: bold; }
          td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .badge { display: inline-block; padding: 1px 4px; border-radius: 4px; font-size: 7.5px; font-weight: bold; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-div { background: #fef3c7; color: #92400e; }
          .badge-nl { background: #fee2e2; color: #991b1b; }
          .diff-box { font-size: 7.5px; color: #b45309; background: #fffbeb; padding: 2px 4px; border-radius: 3px; margin-top: 2px; }
          .footer { margin-top: 16px; font-size: 8px; color: #94a3b8; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 6px; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="empresa-title">G C DO AMARAL SERTANIA — GRUPO PEDREIRA CORDEIRO</div>
          <div class="sub-header">CNPJ: 05.581.899/0001-05 • Sistema Integrado de Gestão NovaGest Pedreira</div>
          <div class="report-title">RELATÓRIO DE CONFERÊNCIA DE PLANILHA CONTRA BANCO (CONTAS A PAGAR)</div>
          <div class="sub-header">Arquivo: ${file?.name || 'PEDREIRA - 2026.xlsx'} • Gerado em: ${dataHoraStr}</div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card">
            <div class="kpi-label">Linhas Lidas</div>
            <div class="kpi-val">${kpis.total}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">100% Conferidos</div>
            <div class="kpi-val" style="color: #166534;">${kpis.conferidos}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Divergentes</div>
            <div class="kpi-val" style="color: #b45309;">${kpis.divergentes}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Não Lançados</div>
            <div class="kpi-val" style="color: #991b1b;">${kpis.naoLancados}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Planilha</div>
            <div class="kpi-val">${formatCurrency(kpis.valorPlanilha)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Diferença R$</div>
            <div class="kpi-val" style="color: ${kpis.diferenca !== 0 ? '#b91c1c' : '#166534'};">${formatCurrency(kpis.diferenca)}</div>
          </div>
        </div>

        <div style="font-weight: bold; font-size: 10px; margin-top: 10px; color: #0f172a;">
          RESUMO POR ABA / COMPETÊNCIA:
        </div>
        <table>
          <thead>
            <tr>
              <th>Aba / Folha</th>
              <th style="text-align: right;">Total Linhas</th>
              <th style="text-align: right;">Conferidos</th>
              <th style="text-align: right;">Divergentes</th>
              <th style="text-align: right;">Não Lançados</th>
              <th style="text-align: right;">Valor Planilha</th>
            </tr>
          </thead>
          <tbody>
            ${resumoPorAba
              .map(
                (r) => `
              <tr>
                <td><strong>${r.aba}</strong></td>
                <td style="text-align: right;">${r.totalLinhas}</td>
                <td style="text-align: right; color: #166534; font-weight: bold;">${r.conferidos}</td>
                <td style="text-align: right; color: #b45309; font-weight: bold;">${r.divergentes}</td>
                <td style="text-align: right; color: #991b1b; font-weight: bold;">${r.naoLancados}</td>
                <td style="text-align: right; font-weight: bold;">${formatCurrency(r.valorTotalPlanilha)}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>

        <div style="font-weight: bold; font-size: 10px; margin-top: 14px; color: #0f172a;">
          DETALHAMENTO DAS DIVERGÊNCIAS E LANÇAMENTOS PENDENTES (Amostra / Principais):
        </div>
        <table>
          <thead>
            <tr>
              <th>Aba/Linha</th>
              <th>Status</th>
              <th>Fornecedor / Descrição</th>
              <th>Vencimento</th>
              <th style="text-align: right;">Valor Planilha</th>
              <th style="text-align: right;">Valor Sistema</th>
              <th>Divergência / Detalhe</th>
            </tr>
          </thead>
          <tbody>
            ${itensComparados
              .filter((i) => i.classificacao !== 'conferido')
              .slice(0, 150)
              .map(
                (item) => `
              <tr>
                <td>${item.aba} (L${item.linhaNum})</td>
                <td>
                  <span class="badge ${item.classificacao === 'divergente' ? 'badge-div' : 'badge-nl'}">
                    ${item.classificacao === 'divergente' ? 'Divergente' : 'Não lançado'}
                  </span>
                </td>
                <td>
                  <strong>${item.fornecedorNome || item.descricao}</strong>
                  ${item.fornecedorNome !== item.descricao ? `<br/><span style="color:#64748b;">${item.descricao}</span>` : ''}
                </td>
                <td>${formatDate(item.vencimentoPlanilha)}</td>
                <td style="text-align: right; font-weight: bold;">${formatCurrency(item.valorPlanilha)}</td>
                <td style="text-align: right;">${item.contaExistente ? formatCurrency(item.contaExistente.valor) : '—'}</td>
                <td>
                  ${
                    item.divergencias.length > 0
                      ? item.divergencias
                          .map(
                            (d) =>
                              `<div class="diff-box"><strong>${d.label}:</strong> Planilha: ${d.planilha} | Sistema: ${d.sistema}</div>`,
                          )
                          .join('')
                      : '<span style="color:#94a3b8;">Ausente no sistema</span>'
                  }
                </td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          Grupo Pedreira Cordeiro — Relatório gerado eletronicamente em ${dataHoraStr}. Página 1 de 1.
        </div>
      </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isExecutingAction && step !== 4) {
          onOpenChange(val)
          if (!val) handleReset()
        }
      }}
    >
      <DialogContent className="sm:max-w-[1040px] max-h-[94vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden">
        {/* Header Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-[#ECEAE4] bg-[#FAF9F7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>Conferência de Planilha (Comparar com Lançamentos)</span>
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200">
                    Modo Somente Leitura
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  Etapa {step} de 5 • Compara cada linha da planilha contra o banco sem alterar nada
                  automaticamente
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-xs">
          {/* STEP 1: Upload Arquivo */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#ECEAE4] hover:border-teal-600 rounded-2xl p-8 text-center transition-colors bg-[#FAF9F7]/50">
                <Upload className="w-10 h-10 mx-auto text-teal-700 mb-3" />
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  Selecione a planilha para conferir com os lançamentos existentes
                </h3>
                <p className="text-gray-500 text-xs max-w-xl mx-auto mb-4">
                  Suporta arquivos anuais com até 21 abas mensais (ex.:{' '}
                  <em>PEDREIRA - 2026 com JANEIRO_2026, JANEIRO 2026.2 até DEZEMBRO_2026</em>
                  ). A conferência roda 100% no seu navegador em lote pela chave composta
                  (fornecedor + vencimento + valor + descrição).
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    100% Seguro (Sem Gravação):
                  </strong>
                  Nenhum dado é gravado no banco sem a sua confirmação explícita. O comparador
                  apenas audita as diferenças.
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Detecção de Divergências:
                  </strong>
                  Destaca conflitos de valor total, valor pago, data de pagamento e situação (Aberta
                  × Paga).
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-950 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-blue-900 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    Abas e 2ª Folhas (.2):
                  </strong>
                  Consolida automaticamente abas com sufixo .2 no respectivo mês de competência da
                  pedreira.
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
                    Confira as competências e desmarque eventuais abas que não deseja auditar:
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

              {/* Lista de abas com scroll */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {sheetsConfig.map((cfg) => (
                  <div
                    key={cfg.name}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                      cfg.selected
                        ? 'border-teal-400 bg-teal-50/40 text-gray-900'
                        : 'border-[#ECEAE4] bg-[#FAF9F7]/50 text-gray-400'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => toggleSheetSelected(cfg.name)}
                    >
                      <Checkbox checked={cfg.selected} />
                      <div className="truncate">
                        <span className="font-semibold text-gray-900 block truncate">
                          {cfg.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {cfg.totalRows} linhas de dados
                          {cfg.sufixo && ` • (2ª Folha ${cfg.sufixo})`}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-1.5"
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
                          className="h-7 w-16 text-[11px] bg-white font-mono text-center"
                          title="Linha da planilha onde estão os títulos das colunas"
                        />
                      </div>

                      <Select
                        value={String(cfg.mes)}
                        onValueChange={(val) =>
                          updateSheetCompetencia(cfg.name, parseInt(val, 10), cfg.ano)
                        }
                        disabled={!cfg.selected}
                      >
                        <SelectTrigger className="h-7 w-24 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES_NOMES.map((nome, idx) => (
                            <SelectItem key={idx + 1} value={String(idx + 1)}>
                              {(idx + 1).toString().padStart(2, '0')} - {nome.slice(0, 3)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

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
                        className="h-7 w-16 text-[11px] bg-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between border-t border-[#ECEAE4]">
                <span>
                  Arquivo: <strong className="text-gray-800">{file?.name}</strong>
                </span>
                <span className="font-semibold text-teal-800">
                  {selectedSheets.length} de {sheetsConfig.length} aba(s) selecionada(s) para
                  conferência
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Mapeamento de Colunas e Parâmetros */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-teal-950">
                    Mapeamento das Colunas para Conferência
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    Cabeçalhos detectados. Confirme as colunas que servirão de base para auditar:
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
                      {selectedSheets.map((s) => (
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

              {/* Grid Colunas */}
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

                {/* Valor Pago */}
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
                      <SelectItem value="none">Não mapear</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Pagamento */}
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
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Coluna de Status / Situação (opcional)
                  </Label>
                  <Select
                    value={mapping.status || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, status: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Auto-detectar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear (auto-detectar)</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tolerância de Centavos */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Tolerância de Centavos (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={toleranciaCentavos}
                    onChange={(e) => setToleranciaCentavos(parseFloat(e.target.value) || 0)}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Diferenças menores que este valor são consideradas conferidas.
                  </p>
                </div>

                {/* Classificação Padrão de Baixa */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Interpretação da Situação:
                  </Label>
                  <Select
                    value={classificacaoPadrao}
                    onValueChange={(val: any) => setClassificacaoPadrao(val)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (paga se houver valor pago ou data)</SelectItem>
                      <SelectItem value="Paga">Considerar todas da planilha como Pagas</SelectItem>
                      <SelectItem value="Aberta">
                        Considerar todas da planilha como Em Aberto
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Prévia das primeiras linhas */}
              {previewRows.length > 0 && (
                <div className="pt-2">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Amostra das Linhas ({activeSheetPreview}):
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

          {/* STEP 4: Processando Comparação */}
          {step === 4 && (
            <div className="py-14 text-center space-y-4 max-w-md mx-auto">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-700" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Conferindo planilha contra o banco de dados...
                </h3>
                <p className="text-gray-500 text-xs mt-1">{progressLabel}</p>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="text-[11px] text-gray-400">{progressPercent}% concluído</div>
            </div>
          )}

          {/* STEP 5: Dashboard de Resultados e Lista de Divergências */}
          {step === 5 && (
            <div className="space-y-4">
              {/* KPIs Gerais */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div className="p-3 bg-[#FAF9F7] border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">
                    Linhas Lidas
                  </span>
                  <span className="text-base font-bold text-gray-900 font-mono">{kpis.total}</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conferidos
                  </span>
                  <span className="text-base font-bold text-emerald-800 font-mono">
                    {kpis.conferidos}
                  </span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <span className="text-[10px] text-amber-700 font-bold uppercase block flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Divergentes
                  </span>
                  <span className="text-base font-bold text-amber-800 font-mono">
                    {kpis.divergentes}
                  </span>
                </div>

                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <span className="text-[10px] text-red-700 font-bold uppercase block flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" /> Não Lançados
                  </span>
                  <span className="text-base font-bold text-red-800 font-mono">
                    {kpis.naoLancados}
                  </span>
                </div>

                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">
                    Planilha (R$)
                  </span>
                  <span className="text-xs font-bold text-gray-900 font-mono block truncate">
                    {formatCurrency(kpis.valorPlanilha)}
                  </span>
                </div>

                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">
                    Diferença (R$)
                  </span>
                  <span
                    className={`text-xs font-bold font-mono block truncate ${
                      Math.abs(kpis.diferenca) > 0.1 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(kpis.diferenca)}
                  </span>
                </div>
              </div>

              {/* Botões de Ação Superior (Exportar CSV, Imprimir A4) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleExportarCsv}
                    className="h-8 text-xs bg-white border-[#ECEAE4]"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-teal-700" />
                    Exportar Relatório CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleImprimirRelatorio}
                    className="h-8 text-xs bg-white border-[#ECEAE4]"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1 text-teal-700" />
                    Imprimir Relatório A4 (Pedreira Cordeiro)
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {kpis.naoLancados > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleImportarNaoLancados}
                      disabled={isExecutingAction || selectedItemIds.size === 0}
                      className="h-8 text-xs bg-teal-700 hover:bg-teal-800 text-white"
                    >
                      {isExecutingAction ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1" />
                      )}
                      Importar Selecionados ({selectedItemIds.size})
                    </Button>
                  )}

                  {kpis.divergentes > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAtualizarDivergentes}
                      disabled={isExecutingAction || selectedItemIds.size === 0}
                      className="h-8 text-xs border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1 text-amber-700" />
                      Atualizar Lançamentos ({selectedItemIds.size})
                    </Button>
                  )}
                </div>
              </div>

              {/* Filtros da Tabela */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['todas', 'divergente', 'nao_lancado', 'conferido'] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setFilterTipo(tp)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        filterTipo === tp
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70 border border-[#ECEAE4]'
                      }`}
                    >
                      {tp === 'todas'
                        ? `Todas (${kpis.total})`
                        : tp === 'divergente'
                          ? `⚠️ Divergentes (${kpis.divergentes})`
                          : tp === 'nao_lancado'
                            ? `❌ Não Lançados (${kpis.naoLancados})`
                            : `✅ Conferidos (${kpis.conferidos})`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={filterAba} onValueChange={setFilterAba}>
                    <SelectTrigger className="h-8 w-44 text-xs bg-white border-[#ECEAE4]">
                      <SelectValue placeholder="Filtrar por Aba" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Abas ({resumoPorAba.length})</SelectItem>
                      {resumoPorAba.map((r) => (
                        <SelectItem key={r.aba} value={r.aba}>
                          {r.aba} ({r.totalLinhas})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <Input
                      placeholder="Buscar fornecedor/desc..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-white border-[#ECEAE4]"
                    />
                  </div>
                </div>
              </div>

              {/* Tabela de Resultados */}
              <div className="border border-[#ECEAE4] rounded-xl overflow-hidden max-h-[380px] overflow-y-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-600 uppercase text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <Checkbox
                          checked={
                            filteredItens.length > 0 &&
                            selectedItemIds.size === filteredItens.length
                          }
                          onCheckedChange={(c) => selectAllFiltered(!!c)}
                        />
                      </th>
                      <th className="py-2.5 px-3">Aba / Linha</th>
                      <th className="py-2.5 px-3">Classificação</th>
                      <th className="py-2.5 px-3">Fornecedor / Descrição</th>
                      <th className="py-2.5 px-3">Vencimento</th>
                      <th className="py-2.5 px-3 text-right">Planilha</th>
                      <th className="py-2.5 px-3 text-right">Sistema</th>
                      <th className="py-2.5 px-3">Detalhe da Divergência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE4]">
                    {filteredItens.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400">
                          Nenhum lançamento corresponde aos filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredItens.slice(0, 300).map((item) => {
                        const isSelected = selectedItemIds.has(item.id)
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-teal-50/20 transition-colors ${
                              item.classificacao === 'divergente'
                                ? 'bg-amber-50/30'
                                : item.classificacao === 'nao_lancado'
                                  ? 'bg-red-50/20'
                                  : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectRow(item.id)}
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              <span className="font-semibold text-gray-900 block truncate max-w-[120px]">
                                {item.aba}
                              </span>
                              <span className="text-[10px] text-gray-400">L{item.linhaNum}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {item.classificacao === 'conferido' && (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                >
                                  ✅ Conferido
                                </Badge>
                              )}
                              {item.classificacao === 'divergente' && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                >
                                  ⚠️ Divergente
                                </Badge>
                              )}
                              {item.classificacao === 'nao_lancado' && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 text-[10px]"
                                >
                                  ❌ Não lançado
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-[220px]">
                              <span className="font-semibold text-gray-900 block truncate">
                                {item.fornecedorNome || item.descricao}
                              </span>
                              {item.fornecedorNome !== item.descricao && (
                                <span className="text-[10px] text-gray-500 block truncate">
                                  {item.descricao}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              {formatDate(item.vencimentoPlanilha)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                              <div>{formatCurrency(item.valorPlanilha)}</div>
                              <div className="text-[10px] font-normal text-gray-500">
                                {item.statusPlanilha}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                              {item.contaExistente ? (
                                <>
                                  <div className="font-bold text-gray-800">
                                    {formatCurrency(item.contaExistente.valor)}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {item.contaExistente.status}
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.divergencias.length > 0 ? (
                                <div className="space-y-1">
                                  {item.divergencias.map((div, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className="p-1 px-1.5 rounded bg-amber-100/70 border border-amber-200 text-amber-950 text-[10px] leading-tight flex items-center justify-between gap-1"
                                    >
                                      <strong className="text-amber-900">{div.label}:</strong>
                                      <span>
                                        Planilha: <b className="text-red-700">{div.planilha}</b> ×
                                        Sistema: <b className="text-teal-800">{div.sistema}</b>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : item.classificacao === 'conferido' ? (
                                <span className="text-emerald-700 text-[11px] flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% igual ao banco
                                </span>
                              ) : (
                                <span className="text-red-600 text-[11px] flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> Não encontrado no banco
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredItens.length > 300 && (
                <div className="text-center text-[11px] text-gray-400">
                  Mostrando os primeiros 300 de {filteredItens.length} lançamentos. Filtre por aba
                  ou use a busca para refinar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t border-[#ECEAE4] bg-[#FAF9F7] flex items-center justify-between">
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
              disabled={selectedSheets.length === 0}
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
              onClick={executarConferencia}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto shadow-xs font-semibold"
            >
              Iniciar Conferência de {selectedSheets.length} aba(s)
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
              Fechar Conferência
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
