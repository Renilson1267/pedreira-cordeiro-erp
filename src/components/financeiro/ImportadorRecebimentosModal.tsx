import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Cliente, PlanoConta, CentroCusto, ContaReceber } from '@/types/erp'
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
} from 'lucide-react'
import {
  MESES_MAP,
  inferirCompetenciaAba,
  desdobrarCelulasMescladas,
  detectarLinhaCabecalho,
  parseValorReceber,
  parseDataReceber,
  normalizarNomeColuna,
  inferirMesPorDatasDaPlanilha,
  extrairCidadeENota,
  REGEX_COL_DATA,
  REGEX_COL_CLIENTE,
  REGEX_COL_DESCRICAO,
  REGEX_COL_VALOR,
  REGEX_COL_VALOR_RECEBIDO,
  REGEX_COL_DATA_RECEBIMENTO,
  REGEX_COL_FORMA_RECEBIMENTO,
  REGEX_COL_STATUS,
  REGEX_COL_CENTRO_CUSTO,
  REGEX_COL_CATEGORIA,
  REGEX_COL_DOCUMENTO,
} from '@/lib/planilhaRecebimentosUtils'
import { withRateLimitRetry, sleep } from '@/lib/pocketbase/rateLimit'
export interface ImportadorRecebimentosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  clientes: Cliente[]
  categorias: PlanoConta[]
  centrosCusto: CentroCusto[]
  contasExistentes: ContaReceber[]
  onImportComplete: () => Promise<void>
}

export interface ColumnMappingReceber {
  data: string
  cliente: string
  descricao: string
  valor: string
  valorRecebido: string
  dataRecebimento: string
  formaRecebimento: string
  status: string
  centroCusto: string
  categoria: string
  documento: string
}

export interface SheetCompetenciaReceber {
  name: string
  selected: boolean
  ano: number
  mes: number // 1 a 12
  sufixo: string
  headerRowIndex: number // 1-based
  headers: string[]
  totalRows: number
}

export interface SheetReceberImportResult {
  aba: string
  linhasLidas: number
  importados: number
  atualizados: number
  duplicados: number
  errosCount: number
  vaziaOuSemCabecalho?: boolean
  motivoVazia?: string
}

export interface RecebimentosImportSummary {
  totalLidos: number
  importados: number
  atualizados: number
  duplicadosPulados: number
  recebidasBaixadas: number
  emAberto: number
  antecipados: number
  clientesCriados: string[]
  creditosGerados: number
  erros: { linha: number; aba: string; motivo: string }[]
  detalhesPorAba: SheetReceberImportResult[]
}

export function ImportadorRecebimentosModal({
  open,
  onOpenChange,
  empresaId,
  clientes,
  categorias,
  centrosCusto,
  contasExistentes,
  onImportComplete,
}: ImportadorRecebimentosModalProps) {
  // Wizard:
  // 1: Upload Arquivo
  // 2: Seleção e Competência das Abas (JANEIRO_26...DEZEMBRO_26, Planilha7)
  // 3: Mapeamento de Colunas e Regras
  // 4: Processando e Gravando
  // 5: Resumo e Conclusão
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetsConfig, setSheetsConfig] = useState<SheetCompetenciaReceber[]>([])

  // Raw preview
  const [activeSheetPreview, setActiveSheetPreview] = useState<string>('')
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])

  // Column Mapping
  const [mapping, setMapping] = useState<ColumnMappingReceber>({
    data: '',
    cliente: '',
    descricao: '',
    valor: '',
    valorRecebido: '',
    dataRecebimento: '',
    formaRecebimento: '',
    status: '',
    centroCusto: '',
    categoria: '',
    documento: '',
  })

  // Business options
  const [criarClientesNaoEncontrados, setCriarClientesNaoEncontrados] = useState(true)
  const [classificacaoPadrao, setClassificacaoPadrao] = useState<
    'auto' | 'Recebida' | 'Aberta' | 'Recebimento Antecipado'
  >('Recebida')
  const [categoriaPadraoId, setCategoriaPadraoId] = useState<string>(categorias[0]?.id || '')
  const [centroCustoPadraoId, setCentroCustoPadraoId] = useState<string>('none')
  const [detectarDuplicados, setDetectarDuplicados] = useState(true)

  // Execution
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [summary, setSummary] = useState<RecebimentosImportSummary | null>(null)

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
      data: '',
      cliente: '',
      descricao: '',
      valor: '',
      valorRecebido: '',
      dataRecebimento: '',
      formaRecebimento: '',
      status: '',
      centroCusto: '',
      categoria: '',
      documento: '',
    })
  }

  // 1. Upload do Arquivo XLSX
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

      // Desdobrar células mescladas em todas as abas (para datas em bloco valerem para todo o conjunto)
      wb.SheetNames.forEach((sName) => {
        const ws = wb.Sheets[sName]
        if (ws) {
          desdobrarCelulasMescladas(ws)
        }
      })

      // Analisar cada aba
      const configs: SheetCompetenciaReceber[] = wb.SheetNames.map((sName) => {
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

        let mesInferido = comp.mes
        let anoInferido = comp.ano

        // Para Planilha7 ou abas sem nome de mês no título, tentar inferir pelas datas internas
        if (/planilha\s*\d+/i.test(sName)) {
          const dateComp = inferirMesPorDatasDaPlanilha(matrix, headerRow, comp.ano)
          if (dateComp) {
            mesInferido = dateComp.mes
            anoInferido = dateComp.ano
          }
        }

        return {
          name: sName,
          selected: true,
          ano: anoInferido,
          mes: mesInferido,
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
  const carregarPreviaAba = (wb: XLSX.WorkBook, config: SheetCompetenciaReceber) => {
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
    const cliColFound = findCol(REGEX_COL_CLIENTE) || ''

    setMapping((prev) => ({
      data:
        prev.data && headers.includes(prev.data)
          ? prev.data
          : findCol(REGEX_COL_DATA) || headers[0] || '',
      cliente:
        prev.cliente && headers.includes(prev.cliente)
          ? prev.cliente
          : cliColFound || descColFound || '',
      descricao:
        prev.descricao && headers.includes(prev.descricao)
          ? prev.descricao
          : descColFound || cliColFound || '',
      valor:
        prev.valor && headers.includes(prev.valor) ? prev.valor : findCol(REGEX_COL_VALOR) || '',
      valorRecebido:
        prev.valorRecebido && headers.includes(prev.valorRecebido)
          ? prev.valorRecebido
          : findCol(REGEX_COL_VALOR_RECEBIDO) || '',
      dataRecebimento:
        prev.dataRecebimento && headers.includes(prev.dataRecebimento)
          ? prev.dataRecebimento
          : findCol(REGEX_COL_DATA_RECEBIMENTO) || '',
      formaRecebimento:
        prev.formaRecebimento && headers.includes(prev.formaRecebimento)
          ? prev.formaRecebimento
          : findCol(REGEX_COL_FORMA_RECEBIMENTO) || '',
      status:
        prev.status && headers.includes(prev.status)
          ? prev.status
          : findCol(REGEX_COL_STATUS) || '',
      centroCusto:
        prev.centroCusto && headers.includes(prev.centroCusto)
          ? prev.centroCusto
          : findCol(REGEX_COL_CENTRO_CUSTO) || '',
      categoria:
        prev.categoria && headers.includes(prev.categoria)
          ? prev.categoria
          : findCol(REGEX_COL_CATEGORIA) || '',
      documento:
        prev.documento && headers.includes(prev.documento)
          ? prev.documento
          : findCol(REGEX_COL_DOCUMENTO) || '',
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

    const resultSummary: RecebimentosImportSummary = {
      totalLidos: 0,
      importados: 0,
      atualizados: 0,
      duplicadosPulados: 0,
      recebidasBaixadas: 0,
      emAberto: 0,
      antecipados: 0,
      clientesCriados: [],
      creditosGerados: 0,
      erros: [],
      detalhesPorAba: [],
    }

    try {
      // 1. Caches para otimizar busca e evitar duplicidade
      const clientesCache = new Map<string, Cliente>()
      clientes.forEach((c) => {
        clientesCache.set(c.nome.trim().toLowerCase(), c)
      })

      // Centros de custo cache
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

      // Deduplicação inteligente e suporte a atualização de datas saneadas:
      // A chave exata inclui data (YYYY-MM-DD)
      const existingExactKeys = new Set<string>()
      // A chave flexível (nota/doc ou descrição + cliente + valor) guarda o registro existente
      // para podermos atualizar a data caso seja diferente (ex.: saneada genericamente em 07/04)
      const existingFlexRecords = new Map<string, ContaReceber>()

      const normalizarTextoComparacao = (txt: string) =>
        (txt || '')
          .toLowerCase()
          .replace(/[\s\-_/\\.,;:()]+/g, ' ')
          .trim()

      contasExistentes.forEach((c) => {
        const d = c.vencimento.slice(0, 10)
        const descNorm = normalizarTextoComparacao(c.descricao).slice(0, 30)
        const notaNorm = normalizarTextoComparacao(c.nota || '')
        const valorStr = Number(c.valor || 0).toFixed(2)

        const exactKey = `${c.cliente_id || ''}_${d}_${valorStr}_${descNorm}`
        existingExactKeys.add(exactKey)

        if (notaNorm) {
          const flexKeyDoc = `doc_${c.cliente_id || ''}_${valorStr}_${notaNorm}`
          if (!existingFlexRecords.has(flexKeyDoc)) {
            existingFlexRecords.set(flexKeyDoc, c)
          }
        }
        const flexKeyDesc = `desc_${c.cliente_id || ''}_${valorStr}_${descNorm}`
        if (!existingFlexRecords.has(flexKeyDesc)) {
          existingFlexRecords.set(flexKeyDesc, c)
        }
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
            atualizados: 0,
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
            atualizados: 0,
            duplicados: 0,
            errosCount: 0,
            vaziaOuSemCabecalho: true,
            motivoVazia: 'Aba sem dados ou linhas em branco',
          })
          continue
        }

        // Redetectar a linha de cabeçalho dinamicamente para CADA aba (mesmo se o usuário configurou o wizard baseado na primeira aba)
        // Isso resolve quando abas como OUTUBRO_26, NOVEMBRO_26, DEZEMBRO_26 ou Planilha7 têm cabeçalho em linha diferente
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

        const dataCol = matchColWithFallback(
          mapping.data,
          REGEX_COL_DATA,
          findColInSheet(REGEX_COL_DATA) || currentSheetHeaders[0] || '',
        )

        const cliCol = matchColWithFallback(
          mapping.cliente,
          REGEX_COL_CLIENTE,
          findColInSheet(REGEX_COL_CLIENTE),
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

        const valRecCol = matchColWithFallback(
          mapping.valorRecebido,
          REGEX_COL_VALOR_RECEBIDO,
          findColInSheet(REGEX_COL_VALOR_RECEBIDO),
        )

        // Validação de densidade de números decimais válidos na coluna de valor mapeada.
        const contarValoresPositivosNaColuna = (colName: string): number => {
          if (!colName) return 0
          const cIdx = currentSheetHeaders.indexOf(colName)
          if (cIdx === -1) return 0
          let count = 0
          for (let r = 0; r < Math.min(dataRows.length, 60); r++) {
            const v = parseValorReceber(dataRows[r]?.[cIdx])
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
            if (h === dataCol) continue
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

        const dataRecCol = matchColWithFallback(
          mapping.dataRecebimento,
          REGEX_COL_DATA_RECEBIMENTO,
          findColInSheet(REGEX_COL_DATA_RECEBIMENTO),
        )

        const formaCol = matchColWithFallback(
          mapping.formaRecebimento,
          REGEX_COL_FORMA_RECEBIMENTO,
          findColInSheet(REGEX_COL_FORMA_RECEBIMENTO),
        )

        const statusCol = matchColWithFallback(
          mapping.status,
          REGEX_COL_STATUS,
          findColInSheet(REGEX_COL_STATUS),
        )

        const centroCol = matchColWithFallback(
          mapping.centroCusto,
          REGEX_COL_CENTRO_CUSTO,
          findColInSheet(REGEX_COL_CENTRO_CUSTO),
        )

        const catCol = matchColWithFallback(
          mapping.categoria,
          REGEX_COL_CATEGORIA,
          findColInSheet(REGEX_COL_CATEGORIA),
        )

        const docCol = matchColWithFallback(
          mapping.documento,
          REGEX_COL_DOCUMENTO,
          findColInSheet(REGEX_COL_DOCUMENTO),
        )

        // Estado mutável de colunas ativas para suporte a múltiplos blocos ou subtotais na mesma aba
        let activeHeaders = [...currentSheetHeaders]
        let activeDataCol = dataCol
        let activeCliCol = cliCol
        let activeDescCol = descCol
        let activeValCol = valCol
        let activeValRecCol = valRecCol
        let activeDataRecCol = dataRecCol
        let activeFormaCol = formaCol
        let activeStatusCol = statusCol
        let activeCentroCol = centroCol
        let activeCatCol = catCol
        let activeDocCol = docCol

        const getVal = (row: any[], headerName: string): any => {
          if (!headerName) return ''
          const colIdx = activeHeaders.indexOf(headerName)
          if (colIdx === -1) return ''
          return row[colIdx] ?? ''
        }

        let sheetLidos = 0
        let sheetImportados = 0
        let sheetAtualizados = 0
        let sheetDuplicados = 0
        let sheetErrosCount = 0

        // Data herdada em bloco: se a linha tem descrição e valor válidos mas a célula de data está vazia (mesclagem),
        // herdar a data do lançamento anterior válido da mesma aba
        let ultimaDataValida: any = null

        // Função para recalcular mapeamento de colunas em um novo bloco
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

            activeDataCol = matchColInBlock(
              mapping.data,
              REGEX_COL_DATA,
              findColInBlock(REGEX_COL_DATA) || activeHeaders[0] || '',
            )
            activeCliCol = matchColInBlock(
              mapping.cliente,
              REGEX_COL_CLIENTE,
              findColInBlock(REGEX_COL_CLIENTE),
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
            activeValRecCol = matchColInBlock(
              mapping.valorRecebido,
              REGEX_COL_VALOR_RECEBIDO,
              findColInBlock(REGEX_COL_VALOR_RECEBIDO),
            )
            activeDataRecCol = matchColInBlock(
              mapping.dataRecebimento,
              REGEX_COL_DATA_RECEBIMENTO,
              findColInBlock(REGEX_COL_DATA_RECEBIMENTO),
            )
            activeFormaCol = matchColInBlock(
              mapping.formaRecebimento,
              REGEX_COL_FORMA_RECEBIMENTO,
              findColInBlock(REGEX_COL_FORMA_RECEBIMENTO),
            )
            activeStatusCol = matchColInBlock(
              mapping.status,
              REGEX_COL_STATUS,
              findColInBlock(REGEX_COL_STATUS),
            )
            activeCentroCol = matchColInBlock(
              mapping.centroCusto,
              REGEX_COL_CENTRO_CUSTO,
              findColInBlock(REGEX_COL_CENTRO_CUSTO),
            )
            activeCatCol = matchColInBlock(
              mapping.categoria,
              REGEX_COL_CATEGORIA,
              findColInBlock(REGEX_COL_CATEGORIA),
            )
            activeDocCol = matchColInBlock(
              mapping.documento,
              REGEX_COL_DOCUMENTO,
              findColInBlock(REGEX_COL_DOCUMENTO),
            )
          }
        }

        for (let r = 0; r < dataRows.length; r++) {
          const row = dataRows[r]
          const numLinha = r + headerIdx + 1

          const temConteudo = row.some((c) => String(c ?? '').trim().length > 0)
          if (!temConteudo) continue

          const rowTextJoined = row
            .map((c) => normalizarNomeColuna(c))
            .filter(Boolean)
            .join(' ')

          // Detectar separador ou fechamento de quinzena/bloco semanal
          const isQuinzenaOrSemanaSeparator =
            rowTextJoined.includes('QUINZENA') ||
            rowTextJoined.includes('2A QUINZENA') ||
            rowTextJoined.includes('2 QUINZENA') ||
            rowTextJoined.includes('1A QUINZENA') ||
            rowTextJoined.includes('1 QUINZENA') ||
            rowTextJoined.includes('SEGUNDA QUINZENA') ||
            rowTextJoined.includes('PRIMEIRA QUINZENA') ||
            rowTextJoined.includes('1A SEMANA') ||
            rowTextJoined.includes('2A SEMANA') ||
            rowTextJoined.includes('3A SEMANA') ||
            rowTextJoined.includes('4A SEMANA') ||
            rowTextJoined.includes('5A SEMANA') ||
            rowTextJoined.startsWith('SEMANA DE') ||
            rowTextJoined.startsWith('BLOCO')

          // Detectar cabeçalho repetido ou parcial no meio da aba (mais tolerante, não exige DATA && VALOR && CLIENTE juntos)
          const hasDataTerm =
            rowTextJoined.includes('DATA') ||
            rowTextJoined.includes('VENC') ||
            rowTextJoined.includes('DT') ||
            rowTextJoined.includes('DIA')
          const hasValTerm =
            rowTextJoined.includes('VALOR') ||
            rowTextJoined.includes('RECEB') ||
            rowTextJoined.includes('TOTAL') ||
            rowTextJoined.includes('CREDIT') ||
            rowTextJoined.includes('ENTRAD') ||
            rowTextJoined.includes('RECEIT')
          const hasCliOrDescTerm =
            rowTextJoined.includes('CLIENTE') ||
            rowTextJoined.includes('SACAD') ||
            rowTextJoined.includes('HIST') ||
            rowTextJoined.includes('DESC') ||
            rowTextJoined.includes('NOME') ||
            rowTextJoined.includes('DOC') ||
            rowTextJoined.includes('NF')

          const isRepeatedHeader =
            (hasDataTerm && hasValTerm) ||
            (hasDataTerm && hasCliOrDescTerm) ||
            (hasValTerm && hasCliOrDescTerm)

          if (isQuinzenaOrSemanaSeparator || isRepeatedHeader) {
            // Se a linha em si for cabeçalho, recalcula imediatamente
            if (isRepeatedHeader) {
              recalcularMapeamentoBloco(row)
              // Ao mudar de bloco/quinzena/semana, zera a última data válida para evitar arrastar data do bloco anterior (ex.: 07/04)
              ultimaDataValida = null
            } else if (r + 1 < dataRows.length) {
              // Se for linha de separador (ex: "2ª QUINZENA"), checar se a próxima linha é o cabeçalho do bloco
              const nextRow = dataRows[r + 1]
              const nextRowJoin = nextRow
                .map((c) => normalizarNomeColuna(c))
                .filter(Boolean)
                .join(' ')
              const nextHasData =
                nextRowJoin.includes('DATA') ||
                nextRowJoin.includes('VENC') ||
                nextRowJoin.includes('DT')
              const nextHasVal =
                nextRowJoin.includes('VALOR') ||
                nextRowJoin.includes('RECEB') ||
                nextRowJoin.includes('TOTAL') ||
                nextRowJoin.includes('CREDIT') ||
                nextRowJoin.includes('ENTRAD')
              if (nextHasData || nextHasVal) {
                recalcularMapeamentoBloco(nextRow)
                ultimaDataValida = null
              }
            }
            continue
          }

          // Pular linhas puramente de total, subtotal, saldo ou semana com continue (NUNCA abortar a leitura)
          const isTotalRow =
            rowTextJoined.startsWith('TOTAL') ||
            rowTextJoined.startsWith('SUBTOTAL') ||
            rowTextJoined.startsWith('SUB TOTAL') ||
            rowTextJoined.startsWith('SALDO') ||
            rowTextJoined.startsWith('SEMANA') ||
            rowTextJoined.includes('TOTAL SEMANA') ||
            rowTextJoined.includes('SUBTOTAL SEMANA') ||
            rowTextJoined.includes('SUBTOTAL 1') ||
            rowTextJoined.includes('SUBTOTAL 2') ||
            rowTextJoined.includes('TOTAL MES') ||
            rowTextJoined.includes('TOTAL GERAL')
          if (isTotalRow) {
            // Ao atingir um subtotal/total de bloco, a data do bloco terminou
            ultimaDataValida = null
            if (r + 1 < dataRows.length) {
              const nextRow = dataRows[r + 1]
              const nextRowJoin = nextRow
                .map((c) => normalizarNomeColuna(c))
                .filter(Boolean)
                .join(' ')
              const nextHasData =
                nextRowJoin.includes('DATA') ||
                nextRowJoin.includes('VENC') ||
                nextRowJoin.includes('DT')
              const nextHasVal =
                nextRowJoin.includes('VALOR') ||
                nextRowJoin.includes('RECEB') ||
                nextRowJoin.includes('TOTAL') ||
                nextRowJoin.includes('CREDIT')
              if (nextHasData || nextHasVal) {
                recalcularMapeamentoBloco(nextRow)
              }
            }
            continue
          }

          sheetLidos += 1
          resultSummary.totalLidos += 1

          try {
            const activeDataColIdx = activeDataCol ? activeHeaders.indexOf(activeDataCol) : -1
            const activeDocColIdx = activeDocCol ? activeHeaders.indexOf(activeDocCol) : -1

            let rawData = getVal(row, activeDataCol)
            let rawCli = String(getVal(row, activeCliCol) || '').trim()
            let rawDesc = String(getVal(row, activeDescCol) || '').trim()

            // Se cliente e descrição vierem vazios, procurar na linha a primeira célula textual representativa
            if (!rawCli && !rawDesc) {
              for (let cIdx = 0; cIdx < row.length; cIdx++) {
                if (cIdx === activeDataColIdx || cIdx === activeDocColIdx) continue
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

            // Fornecedor aqui vira CLIENTE: se a linha não tiver cliente, usar a descrição para localizar/criar o cliente
            if (!rawCli && rawDesc) {
              rawCli = rawDesc
            }

            const rawValor = parseValorReceber(getVal(row, activeValCol))
            const rawValorRec = activeValRecCol
              ? parseValorReceber(getVal(row, activeValRecCol))
              : 0
            const rawDataRec = getVal(row, activeDataRecCol)
            const rawForma = String(getVal(row, activeFormaCol) || '').trim()
            const rawStatus = String(getVal(row, activeStatusCol) || '').toLowerCase()
            const rawCentro = String(getVal(row, activeCentroCol) || '').trim()
            const rawCat = String(getVal(row, activeCatCol) || '').trim()
            const rawDoc = String(getVal(row, activeDocCol) || '').trim()

            const lowerDesc = (rawDesc || rawCli).toLowerCase()
            if (
              lowerDesc.startsWith('total') ||
              lowerDesc.startsWith('subtotal') ||
              lowerDesc.startsWith('saldo') ||
              lowerDesc.startsWith('semana') ||
              lowerDesc.includes('total semanal')
            ) {
              continue
            }

            // Descobrir valor final: coluna mapeada de valor ou valorRecebido ou varredura de linha
            let valorFinal = rawValor > 0 ? rawValor : rawValorRec
            if (valorFinal <= 0) {
              let maiorValorEncontrado = 0
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                if (colIdx === activeDataColIdx || colIdx === activeDocColIdx) continue

                const cellRaw = row[colIdx]
                if (typeof cellRaw === 'string' && /^(?:NF|DOC|NOTA|DUPL)/i.test(cellRaw.trim()))
                  continue
                if (cellRaw instanceof Date) continue

                const cellVal = parseValorReceber(cellRaw)
                if (cellVal > 0) {
                  const hName = normalizarNomeColuna(activeHeaders[colIdx] || '')
                  if (
                    hName.includes('VALOR') ||
                    hName.includes('RECEB') ||
                    hName.includes('TOTAL') ||
                    hName.includes('CREDIT') ||
                    hName.includes('LIQUID') ||
                    hName.includes('BRUTO')
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
              continue
            }

            // 1. Resolver Cliente (ou cadastrar automaticamente com a descrição/nome sacado)
            let clienteId: string | null = null
            if (rawCli) {
              const keyCli = rawCli.toLowerCase()
              if (clientesCache.has(keyCli)) {
                clienteId = clientesCache.get(keyCli)!.id
              } else if (criarClientesNaoEncontrados) {
                try {
                  await sleep(100)
                  const novoCliente = await withRateLimitRetry(
                    () =>
                      pb.collection('clientes').create<Cliente>({
                        empresa_id: empresaId,
                        nome: rawCli,
                        observacoes: `Criado automaticamente na importação da planilha (aba ${sheetCfg.name})`,
                      }),
                    {
                      onRetry: (tentativa, delayMs) => {
                        setProgressMsg(
                          `Aguardando servidor... limite temporário (429) no cliente "${rawCli}". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                        )
                      },
                    },
                  )
                  clientesCache.set(keyCli, novoCliente)
                  clienteId = novoCliente.id
                  if (!resultSummary.clientesCriados.includes(novoCliente.nome)) {
                    resultSummary.clientesCriados.push(novoCliente.nome)
                  }
                } catch (createCliErr) {
                  console.warn('Erro ao criar cliente automaticamente:', rawCli, createCliErr)
                }
              }
            }

            // 2. Data com barreira sanitária estrita, herança de bloco e busca segura
            let dataParaVenc = rawData
            const rawDataStr = String(rawData ?? '').trim()
            let teveDataPropriaNaLinha = false

            // Helper de checagem sanitária para aceitar célula como data
            const isValidaSanitaria = (val: any) => {
              if (val === null || val === undefined || String(val).trim() === '') return false
              const parsed = parseDataReceber(val, sheetCfg.ano, sheetCfg.mes)
              if (!parsed || parsed.startsWith('1970')) return false
              const yMatch = parsed.match(/^(\d{4})/)
              if (!yMatch) return false
              const y = parseInt(yMatch[1], 10)
              return y >= 2024 && y <= 2028
            }

            // Se a célula de data da linha atual tiver conteúdo
            if (rawDataStr && isValidaSanitaria(rawData)) {
              teveDataPropriaNaLinha = true
              ultimaDataValida = rawData
            } else if (rawDataStr && !isValidaSanitaria(rawData)) {
              // Data absurda ou fora de faixa (ex.: número de nota/telefone na coluna de data)
              // Registrar divergência na aba e descartar como data própria
              sheetErrosCount += 1
              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: numLinha,
                motivo: `Data na linha ("${rawDataStr.slice(0, 30)}") fora do intervalo sanitário plausível (2024-2028). Aplicada data herdada da competência.`,
              })
            }

            if (
              !teveDataPropriaNaLinha &&
              ultimaDataValida &&
              isValidaSanitaria(ultimaDataValida)
            ) {
              dataParaVenc = ultimaDataValida
            }

            let dataVencimentoISO = parseDataReceber(dataParaVenc, sheetCfg.ano, sheetCfg.mes)

            if (
              !dataVencimentoISO ||
              dataVencimentoISO.startsWith('1970') ||
              !isValidaSanitaria(dataVencimentoISO)
            ) {
              // Buscar apenas em colunas que NÃO sejam doc, cliente ou valores
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                if (colIdx === activeDocColIdx) continue
                const colHeader = normalizarNomeColuna(activeHeaders[colIdx] || '')
                if (
                  colHeader.includes('VALOR') ||
                  colHeader.includes('CLIENTE') ||
                  colHeader.includes('SACADO') ||
                  colHeader.includes('DOC') ||
                  colHeader.includes('NOTA')
                ) {
                  continue
                }
                const candVal = row[colIdx]
                if (candVal !== null && candVal !== undefined && String(candVal).trim() !== '') {
                  if (isValidaSanitaria(candVal)) {
                    dataVencimentoISO = parseDataReceber(candVal, sheetCfg.ano, sheetCfg.mes)
                    rawData = candVal
                    teveDataPropriaNaLinha = true
                    ultimaDataValida = candVal
                    break
                  }
                }
              }
            }

            if (
              !dataVencimentoISO ||
              dataVencimentoISO.startsWith('1970') ||
              !isValidaSanitaria(dataVencimentoISO)
            ) {
              if (ultimaDataValida && isValidaSanitaria(ultimaDataValida)) {
                dataVencimentoISO = parseDataReceber(ultimaDataValida, sheetCfg.ano, sheetCfg.mes)
              }
              if (
                !dataVencimentoISO ||
                dataVencimentoISO.startsWith('1970') ||
                !isValidaSanitaria(dataVencimentoISO)
              ) {
                const y = sheetCfg.ano || 2026
                const m = sheetCfg.mes || 1
                dataVencimentoISO = `${y}-${String(m).padStart(2, '0')}-01T12:00:00.000Z`
              }
            } else if (rawDataStr && !teveDataPropriaNaLinha && isValidaSanitaria(rawData)) {
              ultimaDataValida = rawData
              teveDataPropriaNaLinha = true
            }

            // 3. Descrição e extração de cidade e nota
            const docInfo = rawDoc ? ` [Doc: ${rawDoc}]` : ''
            const descFinal = rawDesc || `Recebimento ${rawCli || sheetCfg.name}${docInfo}`

            // Extrair cidade e nota tanto da descrição quanto do campo documento
            const extraidos = extrairCidadeENota(descFinal)
            const notaFinal = (rawDoc || extraidos.nota || '').trim()
            const enderecoFinal = (extraidos.cidade || '').trim()

            // 4. Verificação de Duplicidade e Atualização Inteligente (Vencimento)
            const dateOnly = dataVencimentoISO.slice(0, 10)
            const descNorm = normalizarTextoComparacao(descFinal).slice(0, 30)
            const notaNorm = normalizarTextoComparacao(notaFinal || '')
            const valorStr = valorFinal.toFixed(2)

            const exactKey = `${clienteId || ''}_${dateOnly}_${valorStr}_${descNorm}`

            // Se existir EXATAMENTE com mesma data, cliente, valor e descrição => duplicata real, pular
            if (detectarDuplicados && existingExactKeys.has(exactKey)) {
              resultSummary.duplicadosPulados += 1
              sheetDuplicados += 1
              continue
            }

            // Se existir registro prévio com mesma nota/doc (ou mesma desc) + cliente + valor,
            // mas com DATA DIFERENTE (ex: data saneada genericamente em 07/04), ATUALIZAR a data correta no banco
            let existingRecordToUpdate: ContaReceber | null = null
            if (detectarDuplicados) {
              if (notaNorm) {
                const flexKeyDoc = `doc_${clienteId || ''}_${valorStr}_${notaNorm}`
                if (existingFlexRecords.has(flexKeyDoc)) {
                  existingRecordToUpdate = existingFlexRecords.get(flexKeyDoc)!
                }
              }
              if (!existingRecordToUpdate) {
                const flexKeyDesc = `desc_${clienteId || ''}_${valorStr}_${descNorm}`
                if (existingFlexRecords.has(flexKeyDesc)) {
                  existingRecordToUpdate = existingFlexRecords.get(flexKeyDesc)!
                }
              }
            }

            if (existingRecordToUpdate) {
              const prevDateOnly = existingRecordToUpdate.vencimento.slice(0, 10)
              // Se a data existente for diferente da nova data da planilha, atualizamos o registro com os dados corretos!
              if (prevDateOnly !== dateOnly) {
                await sleep(100)
                await withRateLimitRetry(
                  () =>
                    pb.collection('contas_receber').update(existingRecordToUpdate!.id, {
                      vencimento: dataVencimentoISO,
                      nota: notaFinal || existingRecordToUpdate!.nota || undefined,
                      endereco: enderecoFinal || existingRecordToUpdate!.endereco || undefined,
                      observacoes: `Atualizado via reimportação de planilha [Aba: ${sheetCfg.name}]${notaFinal ? ` | Doc: ${notaFinal}` : ''}`,
                    }),
                  {
                    onRetry: (tentativa, delayMs) => {
                      setProgressMsg(
                        `Aguardando servidor... limite temporário (429) na atualização do título "${descFinal.slice(0, 25)}...". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                      )
                    },
                  },
                )

                // Atualiza chaves do cache para não atualizar/duplicar novamente
                existingExactKeys.add(exactKey)
                existingFlexRecords.delete(`doc_${clienteId || ''}_${valorStr}_${notaNorm}`)
                existingFlexRecords.delete(`desc_${clienteId || ''}_${valorStr}_${descNorm}`)

                resultSummary.atualizados += 1
                sheetAtualizados += 1
                continue
              } else {
                // Se até a data coincidir exatamente, é duplicado
                resultSummary.duplicadosPulados += 1
                sheetDuplicados += 1
                continue
              }
            }

            // 5. Determinar Situação (Recebida, Aberta, Parcial, Recebimento Antecipado)
            let finalStatus: 'Recebida' | 'Aberta' | 'Parcial' | 'Recebimento Antecipado' =
              'Recebida'

            if (classificacaoPadrao === 'Recebida') {
              finalStatus = 'Recebida'
            } else if (classificacaoPadrao === 'Aberta') {
              finalStatus = 'Aberta'
            } else if (classificacaoPadrao === 'Recebimento Antecipado') {
              finalStatus = 'Recebimento Antecipado'
            } else {
              // auto
              if (
                rawStatus.includes('antecip') ||
                rawStatus.includes('adiant') ||
                lowerDesc.includes('antecip') ||
                lowerDesc.includes('deposito') ||
                lowerDesc.includes('crédito') ||
                lowerDesc.includes('credito')
              ) {
                finalStatus = 'Recebimento Antecipado'
              } else if (
                rawStatus.includes('parcial') ||
                (rawValorRec > 0 && valorFinal > 0 && rawValorRec < valorFinal - 0.009)
              ) {
                finalStatus = 'Parcial'
              } else if (
                rawStatus.includes('abert') ||
                rawStatus.includes('pend') ||
                rawStatus.includes('a vencer')
              ) {
                finalStatus = 'Aberta'
              } else {
                finalStatus = 'Recebida'
              }
            }

            const valorEfetivoRecebido =
              finalStatus === 'Recebida'
                ? rawValorRec > 0
                  ? rawValorRec
                  : valorFinal
                : finalStatus === 'Parcial'
                  ? rawValorRec
                  : finalStatus === 'Recebimento Antecipado'
                    ? valorFinal
                    : 0

            const rawRecebimentoParaParse = isValidaSanitaria(rawDataRec)
              ? rawDataRec
              : isValidaSanitaria(rawData)
                ? rawData
                : dataVencimentoISO

            const dataRecebimentoISO =
              finalStatus !== 'Aberta'
                ? parseDataReceber(rawRecebimentoParaParse, sheetCfg.ano, sheetCfg.mes)
                : null

            // 6. Forma de Pagamento / Recebimento
            let finalForma: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' = 'Pix'
            const lowerForma = (rawForma || '').toLowerCase()
            const lowerDescricaoGeral = descFinal.toLowerCase()
            if (lowerForma.includes('bol') || lowerDescricaoGeral.includes('boleto')) {
              finalForma = 'Boleto'
            } else if (
              lowerForma.includes('ted') ||
              lowerForma.includes('doc') ||
              lowerForma.includes('transf') ||
              lowerDescricaoGeral.includes('ted') ||
              lowerDescricaoGeral.includes('transf')
            ) {
              finalForma = 'Transferência'
            } else if (
              lowerForma.includes('cart') ||
              lowerForma.includes('deb') ||
              lowerForma.includes('cred')
            ) {
              finalForma = 'Cartão'
            } else if (lowerForma.includes('dinh') || lowerForma.includes('espec')) {
              finalForma = 'Dinheiro'
            } else if (
              lowerForma.includes('santander') ||
              lowerForma.includes('bradesco') ||
              lowerDescricaoGeral.includes('santander') ||
              lowerDescricaoGeral.includes('bradesco') ||
              lowerDescricaoGeral.includes('banco')
            ) {
              // Menções bancárias na descrição da planilha sem outra especificação padrão boleto/transferência
              finalForma = 'Boleto'
            }

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

            // 9. Gravar Conta a Receber no PocketBase com endereco e nota extraídos
            // Espaçamento preventivo e retry com backoff exponencial para evitar 429
            await sleep(100)
            const createdConta = await withRateLimitRetry(
              () =>
                pb.collection('contas_receber').create<ContaReceber>({
                  empresa_id: empresaId,
                  cliente_id: clienteId || null,
                  descricao: descFinal,
                  categoria_id: finalCategoriaId,
                  centro_custo_id: finalCentroCustoId,
                  valor: valorFinal,
                  valor_recebido: valorEfetivoRecebido,
                  vencimento: dataVencimentoISO,
                  parcelas: 1,
                  status: finalStatus,
                  data_recebimento: dataRecebimentoISO,
                  forma_recebimento: finalStatus !== 'Aberta' ? finalForma : null,
                  endereco: enderecoFinal || undefined,
                  nota: notaFinal || undefined,
                  observacoes: `Importado de planilha [Aba: ${sheetCfg.name}]${notaFinal ? ` | Doc: ${notaFinal}` : ''}${finalStatus === 'Parcial' ? ` | Recebimento parcial importado: ${valorEfetivoRecebido}` : ''}`,
                }),
              {
                onRetry: (tentativa, delayMs) => {
                  setProgressMsg(
                    `Aguardando servidor... limite temporário (429) no título "${descFinal.slice(0, 25)}...". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                  )
                },
              },
            )

            // 10. Se for Recebimento Antecipado, gera crédito correspondente para o cliente
            if (finalStatus === 'Recebimento Antecipado' && clienteId) {
              try {
                await sleep(100)
                await withRateLimitRetry(
                  () =>
                    pb.collection('creditos_clientes').create({
                      empresa_id: empresaId,
                      cliente_id: clienteId,
                      valor: valorFinal,
                      saldo_restante: valorFinal,
                      origem: `Recebimento Antecipado (${sheetCfg.name})`,
                      descricao: `Depósito/Adiantamento ref. ${descFinal} [Conta ${createdConta.id}]`,
                      data: dataRecebimentoISO || dataVencimentoISO,
                      status: 'disponivel',
                      referencia_conta_id: createdConta.id,
                    }),
                  {
                    onRetry: (tentativa, delayMs) => {
                      setProgressMsg(
                        `Aguardando servidor... limite temporário (429) gerando crédito. Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                      )
                    },
                  },
                )
                resultSummary.creditosGerados += 1
              } catch (credErr) {
                console.warn('Erro ao criar crédito do cliente:', credErr)
              }
            }

            // 11. Se for Recebida, Parcial ou Recebimento Antecipado, gera movimento financeiro de entrada
            if (
              (finalStatus === 'Recebida' ||
                finalStatus === 'Recebimento Antecipado' ||
                finalStatus === 'Parcial') &&
              valorEfetivoRecebido > 0 &&
              dataRecebimentoISO
            ) {
              try {
                await sleep(100)
                await withRateLimitRetry(
                  () =>
                    pb.collection('movimentos_financeiros').create({
                      empresa_id: empresaId,
                      tipo: 'Entrada',
                      descricao: `Recebimento${finalStatus === 'Parcial' ? ' parcial' : ''}: ${createdConta.descricao}${rawCli ? ` [${rawCli}]` : ''}`,
                      valor: valorEfetivoRecebido,
                      data: dataRecebimentoISO,
                      categoria_id: finalCategoriaId,
                      centro_custo_id: finalCentroCustoId,
                      origem: 'ContaReceber',
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
              } catch (movErr) {
                console.warn('Erro ao criar movimento financeiro correspondente:', movErr)
              }
            }

            existingExactKeys.add(exactKey)
            resultSummary.importados += 1
            sheetImportados += 1

            if (finalStatus === 'Recebida') {
              resultSummary.recebidasBaixadas += 1
            } else if (finalStatus === 'Recebimento Antecipado') {
              resultSummary.antecipados += 1
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
          atualizados: sheetAtualizados,
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
        title: 'Importação de Contas a Receber concluída!',
        description: `${resultSummary.importados} títulos foram importados com sucesso.`,
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
                  Importador de Planilha de Recebimentos (XLSX)
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
                  Selecione sua planilha de recebimentos (.xlsx ou .xls)
                </h3>
                <p className="text-gray-500 text-xs max-w-lg mx-auto mb-4">
                  Suporta arquivos anuais com abas mensais (ex.:{' '}
                  <em>JANEIRO_26, MARÇO_26, Planilha7...</em>). A leitura é executada no seu
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
                    Detecção Inteligente de Competências:
                  </strong>
                  Mapeia abas no padrão <em>JANEIRO_26</em> a <em>DEZEMBRO_26</em> para o ano de
                  2026 e identifica automaticamente a competência da <em>Planilha7</em> pelas datas
                  da aba.
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <strong className="block mb-0.5 text-amber-950">
                    Deduplicação e Células Mescladas:
                  </strong>
                  Expande células mescladas de data para o bloco e evita duplicidades caso você
                  reimporte a mesma planilha.
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
                    Abas Identificadas ({sheetsConfig.length})
                  </h3>
                  <p className="text-gray-500 text-xs">
                    Confira a competência inferida para 2026 e desmarque abas que não deseja
                    processar:
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
                          {cfg.sufixo && ` • (${cfg.sufixo})`}
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
                    Cabeçalhos identificados na linha útil da aba. Corrija o vínculo caso
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
                {/* Data */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Vencimento / Emissão *
                  </Label>
                  <Select
                    value={mapping.data}
                    onValueChange={(val) => setMapping({ ...mapping, data: val })}
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

                {/* Cliente */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Cliente / Sacado *</Label>
                  <Select
                    value={mapping.cliente}
                    onValueChange={(val) => setMapping({ ...mapping, cliente: val })}
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

                {/* Valor Recebido (opcional) */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Valor Recebido / Baixa (opcional)
                  </Label>
                  <Select
                    value={mapping.valorRecebido || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, valorRecebido: val === 'none' ? '' : val })
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

                {/* Data de Recebimento (opcional) */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Recebimento (opcional)
                  </Label>
                  <Select
                    value={mapping.dataRecebimento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, dataRecebimento: val === 'none' ? '' : val })
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

                {/* Forma de Recebimento */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Forma de Recebimento (opcional)
                  </Label>
                  <Select
                    value={mapping.formaRecebimento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, formaRecebimento: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Padrão: Pix/Boleto" />
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
                        <SelectItem value="Recebida">
                          Marcar todas como Recebida (Baixada)
                        </SelectItem>
                        <SelectItem value="auto">
                          Auto-detectar (Recebida, Aberta ou Recebimento Antecipado)
                        </SelectItem>
                        <SelectItem value="Aberta">
                          Marcar todas como Em Aberto (A Receber)
                        </SelectItem>
                        <SelectItem value="Recebimento Antecipado">
                          Recebimento Antecipado (Gera Crédito ao Cliente)
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
                        <SelectValue placeholder="Selecione receita..." />
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
                      checked={criarClientesNaoEncontrados}
                      onCheckedChange={(c) => setCriarClientesNaoEncontrados(!!c)}
                    />
                    <span>
                      Cadastrar clientes automaticamente caso não existam no sistema (usa a
                      descrição/sacado se não houver coluna de cliente)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={detectarDuplicados}
                      onCheckedChange={(c) => setDetectarDuplicados(!!c)}
                    />
                    <span>
                      Idempotência: Pular lançamentos idênticos já existentes (mesmo cliente,
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
                          {mapping.data && <th className="p-2">Data</th>}
                          {mapping.cliente && <th className="p-2">Cliente</th>}
                          {mapping.descricao && <th className="p-2">Descrição</th>}
                          {mapping.valor && <th className="p-2 text-right">Valor</th>}
                          {mapping.valorRecebido && (
                            <th className="p-2 text-right">Valor Recebido</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEAE4]">
                        {previewRows.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            {mapping.data && (
                              <td className="p-2 font-mono">
                                {formatDate(parseDataReceber(r[mapping.data]))}
                              </td>
                            )}
                            {mapping.cliente && (
                              <td className="p-2 font-medium">
                                {String(r[mapping.cliente] || '—')}
                              </td>
                            )}
                            {mapping.descricao && (
                              <td className="p-2 text-gray-600">
                                {String(r[mapping.descricao] || '—')}
                              </td>
                            )}
                            {mapping.valor && (
                              <td className="p-2 text-right font-mono font-bold text-gray-900">
                                {formatCurrency(parseValorReceber(r[mapping.valor]))}
                              </td>
                            )}
                            {mapping.valorRecebido && (
                              <td className="p-2 text-right font-mono text-emerald-700">
                                {formatCurrency(parseValorReceber(r[mapping.valorRecebido]))}
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
                  Processando e gravando recebimentos no banco...
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  {progressMsg || 'Consolidando abas mensais e clientes...'}
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
                    Importação de Contas a Receber Concluída!
                  </h3>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Todos os recebimentos foram validados e inseridos na base da sua empresa.
                  </p>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Lidos</span>
                  <span className="text-lg font-bold text-gray-800 font-mono">
                    {summary.totalLidos}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">
                    Novos
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {summary.importados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-blue-600 font-bold uppercase block">
                    Atualizados
                  </span>
                  <span className="text-lg font-bold text-blue-700 font-mono">
                    {summary.atualizados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">
                    Baixados
                  </span>
                  <span className="text-lg font-bold text-teal-700 font-mono">
                    {summary.recebidasBaixadas}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">
                    Duplicados
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
                              {item.linhasLidas} lidas • {item.importados} novos •{' '}
                              {item.atualizados > 0 && `${item.atualizados} atualizados • `}
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

              {summary.clientesCriados.length > 0 && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="font-semibold text-gray-800 block mb-1">
                    Novos Clientes Cadastrados ({summary.clientesCriados.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {summary.clientesCriados.map((cli, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] bg-white text-gray-700"
                      >
                        {cli}
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
              disabled={!mapping.valor || !mapping.data}
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
