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
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
} from 'lucide-react'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import {
  MESES_MAP,
  inferirCompetenciaAba,
  desdobrarCelulasMescladas,
  detectarLinhaCabecalho,
  parseValorReceber,
  parseValorReceberDetalhado,
  parseDataReceber,
  isPadraoNumeroParcela,
  isNumeroChequeOuSerieBancaria,
  LIMIAR_VALOR_SUSPEITO_RECEBER,
  normalizarNomeColuna,
  inferirMesPorDatasDaPlanilha,
  extrairCidadeENota,
  extrairDocumentosDeObservacao,
  isNotaValida,
  detectarStatusNaLinha,
  classificarStatusRecebimento,
  normalizarFormaRecebimento,
  sanitizarNomeCliente,
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
  REGEX_COL_VALOR_COMPRA,
  isColunaCheque,
  extrairNumeroCheque,
  isSuspeitoNumeroNotaFiscal,
  temCorroboracaoMonetariaExplicita,
  isColunaNaoMonetaria,
} from '@/lib/planilhaRecebimentosUtils'
import { withRateLimitRetry, sleep, runParallelPool } from '@/lib/pocketbase/rateLimit'
import { Progress } from '@/components/ui/progress'
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
  duplicadosInternos: number
  divergenciasCount: number
  errosGravacaoCount: number
  vaziaOuSemCabecalho?: boolean
  motivoVazia?: string
}

export interface RecebimentosImportSummary {
  totalLidos: number
  importados: number
  atualizados: number
  duplicadosInternos: number
  duplicadosBanco: number
  recebidasBaixadas: number
  emAberto: number
  antecipados: number
  clientesCriados: string[]
  creditosGerados: number
  erros: { linha: number; aba: string; motivo: string; tipo: 'gravacao' | 'divergencia' }[]
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
  // Filtro de mês: 'todos' ou '1'..'12'
  const [selectedMesFilter, setSelectedMesFilter] = useState<string>('todos')

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
  >('auto')
  const [categoriaPadraoId, setCategoriaPadraoId] = useState<string>(categorias[0]?.id || '')
  const [centroCustoPadraoId, setCentroCustoPadraoId] = useState<string>('none')
  const [detectarDuplicados, setDetectarDuplicados] = useState(true)

  // Execution
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>('')
  const [summary, setSummary] = useState<RecebimentosImportSummary | null>(null)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetsConfig([])
    setSelectedMesFilter('todos')
    setActiveSheetPreview('')
    setSheetHeaders([])
    setPreviewRows([])
    setSummary(null)
    setIsProcessing(false)
    setProgressMsg('')
    setProgressPercent(0)
    setEstimatedTimeLeft('')
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

        // Para Planilha7 ou abas sem nome de mês no título, tentar inferir pelas datas internas.
        // Se for Planilha7 ou aba genérica sem mês claro no nome, iniciar desmarcada por segurança.
        const isAbaGenericaPlanilha = /planilha\s*\d+/i.test(sName)
        let selecionadaPorPadrao = true

        // Abas genéricas como Planilha7 iniciam SEMPRE desmarcadas por segurança (exigem seleção explícita do usuário)
        if (isAbaGenericaPlanilha) {
          selecionadaPorPadrao = false
          const dateComp = inferirMesPorDatasDaPlanilha(matrix, headerRow, comp.ano)
          if (dateComp) {
            mesInferido = dateComp.mes
            anoInferido = dateComp.ano
          }
        }

        return {
          name: sName,
          selected: selecionadaPorPadrao,
          ano: anoInferido,
          mes: mesInferido,
          sufixo: comp.sufixo,
          headerRowIndex: headerRow,
          headers,
          totalRows: Math.max(0, matrix.length - headerRow),
        }
      })

      setSheetsConfig(configs)
      setSelectedMesFilter('todos')

      // Primeira aba como prévia inicial
      const firstConfig = configs[0]
      setActiveSheetPreview(firstConfig?.name || '')
      if (firstConfig) {
        carregarPreviaAba(wb, firstConfig)
      }

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
    // Suporta TANTO a estrutura antiga (coluna de sacado/cliente separada)
    // QUANTO a nova estrutura (cliente via coluna DESCRIÇÃO, forma via TIPO DE PAGAMENTO, status via SITUAÇÃO)
    const findCol = (regex: RegExp) =>
      headers.find((h) => regex.test(normalizarNomeColuna(h)) || regex.test(h)) || ''
    const descColFound = findCol(REGEX_COL_DESCRICAO) || ''
    const cliColFound = findCol(REGEX_COL_CLIENTE) || ''
    const formaColFound = findCol(REGEX_COL_FORMA_RECEBIMENTO) || ''
    const statusColFound = findCol(REGEX_COL_STATUS) || ''

    // Se houver coluna DESCRIÇÃO e NÃO houver coluna de cliente/sacado separada (ou forem a mesma),
    // a nova regra mapeia DESCRIÇÃO -> cliente e deixa o campo de descrição limpo/vazio
    const clienteSugerido = cliColFound || descColFound || ''

    const colDataSugerida = findCol(REGEX_COL_DATA) || ''
    // Prioridade máxima para "VALOR DA COMPRA" e nunca selecionar coluna de cheque
    const valorSugerido =
      headers.find(
        (h) => !isColunaCheque(h) && REGEX_COL_VALOR_COMPRA.test(normalizarNomeColuna(h)),
      ) ||
      headers.find((h) => !isColunaCheque(h) && REGEX_COL_VALOR.test(normalizarNomeColuna(h))) ||
      ''

    setMapping((prev) => ({
      data: prev.data && headers.includes(prev.data) ? prev.data : colDataSugerida,
      cliente: prev.cliente && headers.includes(prev.cliente) ? prev.cliente : clienteSugerido,
      descricao:
        prev.descricao && headers.includes(prev.descricao)
          ? prev.descricao
          : cliColFound && descColFound && cliColFound !== descColFound
            ? descColFound
            : '',
      valor:
        prev.valor && headers.includes(prev.valor) && !isColunaCheque(prev.valor)
          ? prev.valor
          : valorSugerido,
      valorRecebido:
        prev.valorRecebido &&
        headers.includes(prev.valorRecebido) &&
        !isColunaCheque(prev.valorRecebido)
          ? prev.valorRecebido
          : findCol(REGEX_COL_VALOR_RECEBIDO) || '',
      dataRecebimento:
        prev.dataRecebimento && headers.includes(prev.dataRecebimento)
          ? prev.dataRecebimento
          : findCol(REGEX_COL_DATA_RECEBIMENTO) || '',
      formaRecebimento:
        prev.formaRecebimento && headers.includes(prev.formaRecebimento)
          ? prev.formaRecebimento
          : formaColFound || '',
      status: prev.status && headers.includes(prev.status) ? prev.status : statusColFound || '',
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

  // Handler de mudança de filtro de mês
  const handleMesFilterChange = (filtro: string) => {
    setSelectedMesFilter(filtro)

    if (filtro === 'todos') {
      // Volta a listar todas as abas, mantendo a regra padrão (Planilha7 desmarcada por padrão)
      setSheetsConfig((prev) =>
        prev.map((s) => {
          const isAbaGenericaPlanilha = /planilha\s*\d+/i.test(s.name)
          return {
            ...s,
            selected: !isAbaGenericaPlanilha,
          }
        }),
      )
    } else {
      const numMes = parseInt(filtro, 10)
      // Marca automaticamente abas daquele mês e desmarca as demais
      setSheetsConfig((prev) =>
        prev.map((s) => ({
          ...s,
          selected: s.mes === numMes,
        })),
      )
    }
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
      duplicadosInternos: 0,
      duplicadosBanco: 0,
      recebidasBaixadas: 0,
      emAberto: 0,
      antecipados: 0,
      clientesCriados: [],
      creditosGerados: 0,
      erros: [],
      detalhesPorAba: [],
    }

    try {
      setProgressMsg('Consultando base de títulos e clientes no servidor...')

      // Recarregar a lista de títulos existentes DIRETO do PocketBase para evitar cache desatualizado
      let contasAtuaisDoBanco: ContaReceber[] = []
      try {
        contasAtuaisDoBanco = await pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = "${empresaId}"`,
          sort: '-created',
        })
      } catch (loadErr) {
        console.warn(
          'Não foi possível recarregar contas_receber do servidor, usando prop:',
          loadErr,
        )
        contasAtuaisDoBanco = contasExistentes
      }

      // Recarregar clientes atualizados do banco para garantir cache fresco
      const clientesCache = new Map<string, Cliente>()
      try {
        const clientesDoBanco = await pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = "${empresaId}"`,
        })
        clientesDoBanco.forEach((c) => {
          clientesCache.set(c.nome.trim().toLowerCase(), c)
        })
      } catch (_) {
        clientes.forEach((c) => {
          clientesCache.set(c.nome.trim().toLowerCase(), c)
        })
      }

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
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[\s\-_/\\.,;:()]+/g, ' ')
          .trim()

      // Mapa de cliente_id -> nome normalizado para indexação rápida
      const clienteIdParaNomeNorm = new Map<string, string>()
      clientesCache.forEach((cli) => {
        if (cli.id && cli.nome) {
          clienteIdParaNomeNorm.set(cli.id, normalizarTextoComparacao(cli.nome).slice(0, 30))
        }
      })

      // Ordenar contas existentes priorizando registros em Aberta/Parcial para serem reconciliados primeiro
      // Se houver um registro Aberta e outro Recebida com mesmo doc/cliente+valor, a preferência é atualizar o Aberta.
      const contasOrdenadasParaIndexacao = [...contasAtuaisDoBanco].sort((a, b) => {
        const pesoStatus = (st: string) => (st === 'Aberta' ? 1 : st === 'Parcial' ? 2 : 3)
        return pesoStatus(a.status) - pesoStatus(b.status)
      })

      // Contagem de ocorrências por cliente_id + valor
      const countPorClienteEValor = new Map<string, number>()
      contasOrdenadasParaIndexacao.forEach((c) => {
        if (c.cliente_id) {
          const vStr = Number(c.valor || 0).toFixed(2)
          const k = `cli_${c.cliente_id}_${vStr}`
          countPorClienteEValor.set(k, (countPorClienteEValor.get(k) || 0) + 1)
        }
      })

      contasOrdenadasParaIndexacao.forEach((c) => {
        const d = c.vencimento.slice(0, 10)
        const descNorm = normalizarTextoComparacao(c.descricao).slice(0, 30)
        const notaNorm = normalizarTextoComparacao(c.nota || '')
        const valorStr = Number(c.valor || 0).toFixed(2)

        const exactKey = `${c.cliente_id || ''}_${d}_${valorStr}_${descNorm}`
        existingExactKeys.add(exactKey)

        // Indexar por documento estruturado (c.nota) COM cliente_id
        if (notaNorm) {
          const flexKeyDoc = `doc_${c.cliente_id || ''}_${valorStr}_${notaNorm}`
          if (!existingFlexRecords.has(flexKeyDoc)) {
            existingFlexRecords.set(flexKeyDoc, c)
          }
          // Indexar por nota global por empresa (mesmo se cliente_id for vazio ou divergir levemente)
          const flexKeyGlobalDoc = `globaldoc_${valorStr}_${notaNorm}`
          if (!existingFlexRecords.has(flexKeyGlobalDoc)) {
            existingFlexRecords.set(flexKeyGlobalDoc, c)
          }
          // Indexar somente pela nota (sem amarrar a valor) para reconciliar alterações
          const flexKeyOnlyDoc = `onlydoc_${notaNorm}`
          if (!existingFlexRecords.has(flexKeyOnlyDoc)) {
            existingFlexRecords.set(flexKeyOnlyDoc, c)
          }
        }

        // Extração de documento(s) a partir de c.observacoes quando c.nota vazio ou complementar
        // Ex.: "Importado de planilha [Aba: JANEIRO_26] | Obs: NF9551/94824"
        const docsDaObs = extrairDocumentosDeObservacao(c.observacoes)
        docsDaObs.forEach((docCand) => {
          const docCandNorm = normalizarTextoComparacao(docCand)
          if (docCandNorm) {
            const flexKeyObsDoc = `doc_${c.cliente_id || ''}_${valorStr}_${docCandNorm}`
            if (!existingFlexRecords.has(flexKeyObsDoc)) {
              existingFlexRecords.set(flexKeyObsDoc, c)
            }
            const flexKeyObsGlobalDoc = `globaldoc_${valorStr}_${docCandNorm}`
            if (!existingFlexRecords.has(flexKeyObsGlobalDoc)) {
              existingFlexRecords.set(flexKeyObsGlobalDoc, c)
            }
            const flexKeyObsOnlyDoc = `onlydoc_${docCandNorm}`
            if (!existingFlexRecords.has(flexKeyObsOnlyDoc)) {
              existingFlexRecords.set(flexKeyObsOnlyDoc, c)
            }
          }
        })

        // Indexar por descrição caso preenchida
        if (descNorm) {
          const flexKeyDesc = `desc_${c.cliente_id || ''}_${valorStr}_${descNorm}`
          if (!existingFlexRecords.has(flexKeyDesc)) {
            existingFlexRecords.set(flexKeyDesc, c)
          }
        }

        // Indexar por cliente_id + valor + nome do cliente normalizado
        if (c.cliente_id) {
          const cliNorm = clienteIdParaNomeNorm.get(c.cliente_id) || ''
          if (cliNorm) {
            const flexKeyCli = `cli_${c.cliente_id}_${valorStr}_${cliNorm}`
            if (!existingFlexRecords.has(flexKeyCli)) {
              existingFlexRecords.set(flexKeyCli, c)
            }
          }

          // Fallback por cliente_id + valor: sempre disponível como candidato de reconciliação
          // Prioriza o registro com status Aberta (que veio primeiro na ordenação)
          const fallbackKey = `cli_${c.cliente_id}_${valorStr}`
          if (!existingFlexRecords.has(fallbackKey)) {
            existingFlexRecords.set(fallbackKey, c)
          }
        }
      })

      // Mapa de promessas de criação em voo para evitar criar o mesmo cliente 2x em paralelo
      const clientesCreationInFlight = new Map<string, Promise<Cliente | null>>()

      // Resolver cliente de forma segura e cacheada em memória com retentativas e reuso de promessa
      const getOrCreateCliente = async (nomeCli: string, sheetName: string): Promise<string> => {
        const rawTrim = sanitizarNomeCliente(nomeCli)
        if (!rawTrim) {
          throw new Error('Nome do cliente vazio ou não informado')
        }
        const keyCli = rawTrim.toLowerCase()

        if (clientesCache.has(keyCli)) {
          return clientesCache.get(keyCli)!.id
        }

        // Busca flexível no cache existente (ex.: nome sem pontuação final ou contido)
        for (const [cacheKey, cli] of clientesCache.entries()) {
          const sanCacheKey = sanitizarNomeCliente(cacheKey).toLowerCase()
          if (sanCacheKey === keyCli || (keyCli.length >= 8 && sanCacheKey.startsWith(keyCli))) {
            return cli.id
          }
        }

        if (!criarClientesNaoEncontrados) {
          throw new Error(
            `Cliente "${rawTrim}" não encontrado no cadastro e a opção de criar novos clientes está desativada`,
          )
        }

        // Se já houver uma criação em andamento para este cliente, aguardar a mesma promessa
        if (clientesCreationInFlight.has(keyCli)) {
          const res = await clientesCreationInFlight.get(keyCli)
          if (res && res.id) return res.id
        }

        const createPromise = (async (): Promise<Cliente> => {
          try {
            const novoCliente = await withRateLimitRetry(
              async () => {
                // Checar novamente no cache antes de criar
                if (clientesCache.has(keyCli)) {
                  return clientesCache.get(keyCli)!
                }
                return await pb.collection('clientes').create<Cliente>({
                  empresa_id: empresaId,
                  nome: rawTrim,
                  observacoes: `Criado automaticamente na importação da planilha (aba ${sheetName})`,
                })
              },
              {
                maxRetries: 8,
                initialDelayMs: 400,
                maxDelayMs: 8000,
                onRetry: (tentativa, delayMs) => {
                  setProgressMsg(
                    `Aguardando servidor... limite temporário (429) no cliente "${rawTrim}". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                  )
                },
              },
            )
            clientesCache.set(keyCli, novoCliente)
            if (!resultSummary.clientesCriados.includes(novoCliente.nome)) {
              resultSummary.clientesCriados.push(novoCliente.nome)
            }
            return novoCliente
          } catch (createCliErr: any) {
            console.warn('Erro ao criar cliente automaticamente:', rawTrim, createCliErr)
            // Se falhou por conflito ou rede, verificar se o cliente foi criado em outra thread
            if (clientesCache.has(keyCli)) {
              return clientesCache.get(keyCli)!
            }
            throw new Error(
              `Falha ao cadastrar cliente "${rawTrim}": ${createCliErr?.message || 'Erro no servidor'}`,
            )
          } finally {
            clientesCreationInFlight.delete(keyCli)
          }
        })()

        clientesCreationInFlight.set(keyCli, createPromise)
        const clienteCriado = await createPromise
        return clienteCriado.id
      }

      const sheetsToImport = sheetsConfig.filter((s) => s.selected)

      // Cálculo de linhas totais estimadas para barra de progresso com tempo restante
      let totalLinhasGerais = 0
      sheetsToImport.forEach((s) => {
        const ws = workbook.Sheets[s.name]
        if (ws && ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref'])
          totalLinhasGerais += Math.max(0, range.e.r - (s.headerRowIndex || 1) + 1)
        }
      })
      if (totalLinhasGerais === 0) totalLinhasGerais = 1
      let linhasProcessadasGlobal = 0
      const startTime = Date.now()

      const formatTimeEstimate = (ms: number): string => {
        if (!isFinite(ms) || ms <= 0) return ''
        const seg = Math.ceil(ms / 1000)
        if (seg < 60) return `${seg}s`
        const min = Math.floor(seg / 60)
        const restSec = seg % 60
        return `${min}m ${restSec}s`
      }

      for (const sheetCfg of sheetsToImport) {
        setProgressMsg(`Processando aba: ${sheetCfg.name}...`)
        const ws = workbook.Sheets[sheetCfg.name]
        if (ws) {
          desdobrarCelulasMescladas(ws)
        }
        if (!ws) {
          resultSummary.detalhesPorAba.push({
            aba: sheetCfg.name,
            linhasLidas: 0,
            importados: 0,
            atualizados: 0,
            duplicadosInternos: 0,
            divergenciasCount: 0,
            errosGravacaoCount: 0,
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
            duplicadosInternos: 0,
            divergenciasCount: 0,
            errosGravacaoCount: 0,
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
        const isAbaGenericaPlanilha = /planilha\s*\d+/i.test(sheetCfg.name)

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

        const dataColFound = findColInSheet(REGEX_COL_DATA)
        const dataCol = matchColWithFallback(mapping.data, REGEX_COL_DATA, dataColFound || '')

        const rawCliColFound = findColInSheet(REGEX_COL_CLIENTE)
        const rawDescColFound = findColInSheet(REGEX_COL_DESCRICAO)

        const cliCol = matchColWithFallback(
          mapping.cliente,
          REGEX_COL_CLIENTE,
          rawCliColFound || rawDescColFound || '',
        )

        const descCol = matchColWithFallback(
          mapping.descricao,
          REGEX_COL_DESCRICAO,
          rawCliColFound && rawDescColFound && rawCliColFound !== rawDescColFound
            ? rawDescColFound
            : '',
        )

        // Localizar a coluna "VALOR DA COMPRA" e variações com prioridade máxima
        // e IGNORAR qualquer coluna de cheque
        const colValorIdentificada =
          findColInSheet(REGEX_COL_VALOR_COMPRA) ||
          currentSheetHeaders.find(
            (h) => !isColunaCheque(h) && REGEX_COL_VALOR.test(normalizarNomeColuna(h)),
          ) ||
          ''

        let valCol = matchColWithFallback(
          mapping.valor && !isColunaCheque(mapping.valor) ? mapping.valor : '',
          REGEX_COL_VALOR_COMPRA,
          colValorIdentificada,
        )
        if (isColunaCheque(valCol)) {
          valCol = colValorIdentificada
        }

        const valRecCol = matchColWithFallback(
          mapping.valorRecebido && !isColunaCheque(mapping.valorRecebido)
            ? mapping.valorRecebido
            : '',
          REGEX_COL_VALOR_RECEBIDO,
          findColInSheet(REGEX_COL_VALOR_RECEBIDO),
        )

        const docCol = matchColWithFallback(
          mapping.documento,
          REGEX_COL_DOCUMENTO,
          findColInSheet(REGEX_COL_DOCUMENTO),
        )

        // Validação de densidade de números decimais válidos na coluna de valor mapeada.
        // Evita selecionar colunas de documento, telefone, datas ou código como coluna de valor.
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
            const hNorm = normalizarNomeColuna(h)
            if (
              isColunaCheque(h) ||
              h === dataCol ||
              h === valRecCol ||
              h === docCol ||
              hNorm.includes('DOC') ||
              hNorm.includes('NOTA') ||
              hNorm.includes('TEL') ||
              hNorm.includes('FONE')
            ) {
              continue
            }
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
        let sheetDuplicadosInternos = 0
        let sheetDivergenciasCount = 0
        let sheetErrosGravacaoCount = 0

        // Data herdada em bloco: se a linha tem descrição e valor válidos mas a célula de data está vazia (mesclagem),
        // herdar a data do lançamento anterior válido da mesma aba (apenas dentro do bloco visual imediato)
        let ultimaDataValida: { val: any; r: number } | null = null

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

            const blockDataFound = findColInBlock(REGEX_COL_DATA)
            const blockDataRecFound = findColInBlock(REGEX_COL_DATA_RECEBIMENTO)
            const blockCliFound = findColInBlock(REGEX_COL_CLIENTE)
            const blockDescFound = findColInBlock(REGEX_COL_DESCRICAO)
            const blockValRecFound = findColInBlock(REGEX_COL_VALOR_RECEBIDO)
            const blockFormaFound = findColInBlock(REGEX_COL_FORMA_RECEBIMENTO)
            const blockStatusFound = findColInBlock(REGEX_COL_STATUS)
            const blockCentroFound = findColInBlock(REGEX_COL_CENTRO_CUSTO)
            const blockCatFound = findColInBlock(REGEX_COL_CATEGORIA)
            const blockDocFound = findColInBlock(REGEX_COL_DOCUMENTO)

            // REGRA: quando o sub-bloco não encontrar um rótulo, HERDAR a coluna ativa prévia ou o cabeçalho principal
            // em vez de resetar para vazio.
            activeDataCol =
              matchColInBlock(mapping.data, REGEX_COL_DATA, blockDataFound || '') ||
              activeDataCol ||
              dataCol
            activeDataRecCol =
              matchColInBlock(
                mapping.dataRecebimento,
                REGEX_COL_DATA_RECEBIMENTO,
                blockDataRecFound || '',
              ) ||
              activeDataRecCol ||
              dataRecCol

            activeCliCol =
              matchColInBlock(
                mapping.cliente,
                REGEX_COL_CLIENTE,
                blockCliFound || blockDescFound || '',
              ) ||
              activeCliCol ||
              cliCol
            activeDescCol =
              matchColInBlock(
                mapping.descricao,
                REGEX_COL_DESCRICAO,
                blockCliFound && blockDescFound && blockCliFound !== blockDescFound
                  ? blockDescFound
                  : '',
              ) ||
              activeDescCol ||
              descCol

            const blockValCompra =
              findColInBlock(REGEX_COL_VALOR_COMPRA) ||
              activeHeaders.find(
                (h) => !isColunaCheque(h) && REGEX_COL_VALOR.test(normalizarNomeColuna(h)),
              ) ||
              ''
            activeValCol =
              matchColInBlock(
                mapping.valor && !isColunaCheque(mapping.valor) ? mapping.valor : '',
                REGEX_COL_VALOR_COMPRA,
                blockValCompra,
              ) ||
              activeValCol ||
              valCol
            if (isColunaCheque(activeValCol)) {
              activeValCol = blockValCompra || valCol
            }

            activeValRecCol =
              matchColInBlock(
                mapping.valorRecebido,
                REGEX_COL_VALOR_RECEBIDO,
                blockValRecFound || '',
              ) ||
              activeValRecCol ||
              valRecCol
            activeFormaCol =
              matchColInBlock(
                mapping.formaRecebimento,
                REGEX_COL_FORMA_RECEBIMENTO,
                blockFormaFound || '',
              ) ||
              activeFormaCol ||
              formaCol
            activeStatusCol =
              matchColInBlock(mapping.status, REGEX_COL_STATUS, blockStatusFound || '') ||
              activeStatusCol ||
              statusCol
            activeCentroCol =
              matchColInBlock(
                mapping.centroCusto,
                REGEX_COL_CENTRO_CUSTO,
                blockCentroFound || '',
              ) ||
              activeCentroCol ||
              centroCol
            activeCatCol =
              matchColInBlock(mapping.categoria, REGEX_COL_CATEGORIA, blockCatFound || '') ||
              activeCatCol ||
              catCol
            activeDocCol =
              matchColInBlock(mapping.documento, REGEX_COL_DOCUMENTO, blockDocFound || '') ||
              activeDocCol ||
              docCol
          }
        }

        // Helper de checagem sanitária para aceitar célula como data
        const isValidaSanitaria = (val: any) => {
          if (val === null || val === undefined || String(val).trim() === '') return false
          // Células com números de telefone, celular ou strings longas sem separador não são datas
          const strVal = String(val).trim()
          if (/\(\d{2}\)/.test(strVal) || /^\d{10,}$/.test(strVal)) return false
          const parsed = parseDataReceber(val, sheetCfg.ano, sheetCfg.mes)
          if (!parsed || parsed.startsWith('1970')) return false
          const yMatch = parsed.match(/^(\d{4})/)
          if (!yMatch) return false
          const y = parseInt(yMatch[1], 10)
          return y >= 2024 && y <= 2028
        }

        // FASE 1: Varredura sequencial da planilha para herança correta de blocos/datas e preparo dos itens a gravar
        interface PreparedItemReceber {
          numLinha: number
          rawCli: string
          descFinal: string
          dataVencimentoISO: string
          notaFinal: string
          enderecoFinal: string
          textoLivreExtra: string
          valorFinal: number
          rawValorRec: number
          rawDataRec: any
          rawForma: string
          rawStatus: string
          rawRow?: any[]
          rawCentro: string
          rawCat: string
          notaNorm: string
          descNorm: string
          cliNorm: string
          valorStr: string
          dateOnly: string
        }

        const preparedItems: PreparedItemReceber[] = []

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
            // Varre as próximas linhas para reidentificar um novo cabeçalho de bloco se houver
            for (let ahead = 1; ahead <= 3 && r + ahead < dataRows.length; ahead++) {
              const candRow = dataRows[r + ahead]
              const candRowJoin = candRow
                .map((c) => normalizarNomeColuna(c))
                .filter(Boolean)
                .join(' ')
              const candHasData =
                candRowJoin.includes('DATA') ||
                candRowJoin.includes('VENC') ||
                candRowJoin.includes('DT')
              const candHasVal =
                candRowJoin.includes('VALOR') ||
                candRowJoin.includes('RECEB') ||
                candRowJoin.includes('TOTAL') ||
                candRowJoin.includes('CREDIT')
              const candHasCli =
                candRowJoin.includes('CLIENTE') ||
                candRowJoin.includes('SACAD') ||
                candRowJoin.includes('HIST') ||
                candRowJoin.includes('DESC')
              if ((candHasData && candHasVal) || (candHasData && candHasCli)) {
                recalcularMapeamentoBloco(candRow)
                break
              }
            }
            continue
          }

          sheetLidos += 1
          resultSummary.totalLidos += 1

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

          // Parsing primário de valor da coluna mapeada (ex.: "VALOR DA COMPRA")
          // Barreira anti-parcela e anti-cheque: se a célula contiver padrão de parcela ou cheque, zera.
          const rawValCell = getVal(row, activeValCol)
          let rawValor = 0
          if (
            isPadraoNumeroParcela(rawValCell) ||
            isNumeroChequeOuSerieBancaria(rawValCell).ehCheque
          ) {
            rawValor = 0
          } else {
            const valParsed = parseValorReceberDetalhado(rawValCell)
            if (valParsed.invalidoOuAbsurdo) {
              rawValor = 0
            } else {
              rawValor = valParsed.valor
            }
          }

          let rawValorRec = 0
          if (activeValRecCol) {
            const rawRecCell = getVal(row, activeValRecCol)
            if (
              isPadraoNumeroParcela(rawRecCell) ||
              isNumeroChequeOuSerieBancaria(rawRecCell).ehCheque
            ) {
              rawValorRec = 0
            } else {
              const recParsed = parseValorReceberDetalhado(rawRecCell)
              if (!recParsed.invalidoOuAbsurdo) {
                rawValorRec = recParsed.valor
              }
            }
          }

          const rawDataRec = getVal(row, activeDataRecCol)
          const rawForma = String(getVal(row, activeFormaCol) || '').trim()
          const rawStatus = String(getVal(row, activeStatusCol) || '').trim()
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

          // Descobrir valor final: PRIMARIAMENTE da coluna mapeada ("VALOR DA COMPRA" ou "VALOR RECEBIDO").
          // REGRA ESTRITA: Se a coluna de "VALOR DA COMPRA" (activeValCol) existir na aba mas a célula da linha estiver vazia/zerada:
          // NÃO deve inventar valor por varredura quando existir qualquer coluna de documento/nota na linha.
          // Nesse caso vira divergência explícita no resumo ("valor vazio — linha X, cliente Y"), NUNCA grava.
          let valorFinal = rawValor > 0 ? rawValor : rawValorRec

          const temAlgumaColunaDocumentoNaLinha = Boolean(
            activeDocCol ||
            activeHeaders.some((h) => {
              const hn = normalizarNomeColuna(h)
              return REGEX_COL_DOCUMENTO.test(hn) || hn.includes('NOTA') || hn.includes('NF')
            }),
          )

          // Se a coluna de valor foi mapeada (ex.: "VALOR DA COMPRA") mas a célula desta linha está vazia:
          // Se houver qualquer coluna de documento/nota na linha, PROIBIDO fazer varredura de fallback.
          const linhaComValorCompraMapeadoMasVazio = Boolean(activeValCol && valorFinal <= 0)

          if (valorFinal <= 0 && !activeValCol && !linhaComValorCompraMapeadoMasVazio) {
            // Varredura de linha apenas quando NÃO HÁ coluna de cabeçalho de valor reconhecível na aba
            let maiorValorEncontrado = 0
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
              if (colIdx === activeDataColIdx || colIdx === activeDocColIdx) continue
              const rawH = activeHeaders[colIdx] || ''
              const hName = normalizarNomeColuna(rawH)
              // O fallback de varredura só pode considerar células que não sejam colunas de nota/documento/cheque/parcela/data/telefone
              if (isColunaNaoMonetaria(rawH) || isColunaNaoMonetaria(hName)) continue

              const cellRaw = row[colIdx]
              if (typeof cellRaw === 'string' && /^(?:NF|DOC|NOTA|DUPL)/i.test(cellRaw.trim()))
                continue
              if (cellRaw instanceof Date) continue

              if (isPadraoNumeroParcela(cellRaw)) continue // ignora números de parcela na varredura
              if (isNumeroChequeOuSerieBancaria(cellRaw).ehCheque) continue // ignora cheques
              if (isSuspeitoNumeroNotaFiscal(cellRaw, rawH).ehNota) continue // ignora números de NF na varredura

              const cellDet = parseValorReceberDetalhado(cellRaw, rawH)
              if (cellDet.invalidoOuAbsurdo) continue // ignora telefones/docs na varredura
              const cellVal = cellDet.valor
              if (cellVal > 0) {
                if (isPadraoNumeroParcela(cellVal)) continue
                if (isNumeroChequeOuSerieBancaria(cellVal).ehCheque) continue
                if (isSuspeitoNumeroNotaFiscal(cellVal, rawH).ehNota) continue
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

          // Se a linha tem a célula de VALOR DA COMPRA vazia e tem documento/nota na linha,
          // registrar divergência explícita e NUNCA inventar valor
          if (
            linhaComValorCompraMapeadoMasVazio &&
            temAlgumaColunaDocumentoNaLinha &&
            valorFinal <= 0
          ) {
            sheetDivergenciasCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              tipo: 'divergencia',
              motivo: `Aba ${sheetCfg.name}: valor vazio — linha ${numLinha}, cliente: "${rawCli || rawDesc || 'não informado'}" (documento presente na linha, valor não inventado por varredura). Registro não gravado.`,
            })
            continue
          }

          // Barreira anti-cheque e anti-série bancária (faixa 800.000–899.999 / datas compactas)
          const chequeCheck = isNumeroChequeOuSerieBancaria(valorFinal)
          if (chequeCheck.ehCheque) {
            sheetDivergenciasCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              tipo: 'divergencia',
              motivo: `Aba ${sheetCfg.name}: Linha ${numLinha}: Valor suspeito (${valorFinal}) identificado como número de cheque/série bancária — não é valor de título. Registro não gravado.`,
            })
            continue
          }

          // Barreira anti-nota fiscal na faixa 80.000 a 99.999 sem corroboração monetária explícita
          const notaSuspeitaCheck = isSuspeitoNumeroNotaFiscal(valorFinal, activeValCol)
          if (notaSuspeitaCheck.ehNota) {
            const rawValStr = String(rawValCell ?? '')
            const temCorroboracao = temCorroboracaoMonetariaExplicita(rawValStr, activeValCol)
            if (!temCorroboracao) {
              sheetDivergenciasCount += 1
              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: numLinha,
                tipo: 'divergencia',
                motivo: `Aba ${sheetCfg.name}: Linha ${numLinha}: Valor ${valorFinal} suspeito de número de nota fiscal (faixa 80k–99k sem corroboração monetária explícita). Registro não gravado.`,
              })
              continue
            }
          }

          // Barreira de valor suspeito >= R$ 100.000 sem corroboração explícita
          if (valorFinal >= LIMIAR_VALOR_SUSPEITO_RECEBER) {
            const rawValStr = String(rawValCell ?? '')
            const temCorroboracao = temCorroboracaoMonetariaExplicita(rawValStr, activeValCol)
            if (!temCorroboracao) {
              sheetDivergenciasCount += 1
              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: numLinha,
                tipo: 'divergencia',
                motivo: `Aba ${sheetCfg.name}: Linha ${numLinha}: Valor de R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} suspeito (>= 100k sem corroboração monetária explícita). Registro não gravado.`,
              })
              continue
            }
          }

          // Barreira anti-parcela definitiva e incondicional sobre qualquer extração de valor
          if (isPadraoNumeroParcela(valorFinal)) {
            sheetDivergenciasCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              tipo: 'divergencia',
              motivo: `Aba ${sheetCfg.name}: Linha ${numLinha}: Valor final extraído (${valorFinal}) corresponde a número de parcela (padrão anti-parcela X.Y). Registro não gravado.`,
            })
            continue
          }

          if (valorFinal <= 0) {
            // Toda linha com situação legível ou documento mas sem valor legível aparece como divergência no resumo
            const temSituacao = Boolean(String(getVal(row, activeStatusCol) || '').trim())
            if (temSituacao || rawCli || rawDesc) {
              sheetDivergenciasCount += 1
              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: numLinha,
                tipo: 'divergencia',
                motivo: `Aba ${sheetCfg.name}: Linha ${numLinha}: Lançamento sem valor financeiro legível (cliente: "${rawCli || rawDesc || 'não informado'}"). Não gravado.`,
              })
            }
            continue
          }

          // Barreira: valores individuais > R$ 2 milhões em recebimento de pedra viram divergência cadastral visível no resumo
          if (valorFinal > 2_000_000) {
            sheetDivergenciasCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              tipo: 'divergencia',
              motivo: `Aba ${sheetCfg.name}: Valor de R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} excede o teto individual de R$ 2.000.000 para recebimento de pedra. Registro não gravado diretamente.`,
            })
            continue
          }

          // Leitura estrita de data linha a linha:
          // 1º: A célula da coluna mapeada de data da linha atual
          // 2º: Outras colunas da linha atual que contenham data sanitária
          // 3º: Células mescladas já foram desdobradas (desdobrarCelulasMescladas).
          // Se a linha ainda assim não tiver data legível na própria linha:
          // PROIBIDO usar "1º dia do mês da aba" como data de título — linha sem data legível vira divergência no resumo.
          // Herança entre linhas só é permitida se houver bloco contíguo IMEDIATO com distância visual máxima de 5 linhas.
          let teveDataPropriaNaLinha = false
          let dataVencimentoISO = ''

          const rawDataStr = String(rawData ?? '').trim()
          if (rawDataStr && isValidaSanitaria(rawData)) {
            const parsed = parseDataReceber(rawData, sheetCfg.ano, sheetCfg.mes)
            if (parsed && !parsed.startsWith('1970')) {
              teveDataPropriaNaLinha = true
              dataVencimentoISO = parsed
              ultimaDataValida = { val: rawData, r }
            }
          }

          // Se a coluna de data mapeada não continha data válida, inspecionar colunas alternativas na PRÓPRIA linha
          if (!teveDataPropriaNaLinha) {
            const activeValColIdx = activeValCol ? activeHeaders.indexOf(activeValCol) : -1
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
              if (colIdx === activeDocColIdx || colIdx === activeValColIdx) continue
              const colHeader = normalizarNomeColuna(activeHeaders[colIdx] || '')
              if (
                colHeader.includes('VALOR') ||
                colHeader.includes('CLIENTE') ||
                colHeader.includes('SACADO') ||
                colHeader.includes('DOC') ||
                colHeader.includes('NOTA') ||
                colHeader.includes('TEL') ||
                colHeader.includes('FONE') ||
                colHeader.includes('SITUACAO') ||
                colHeader.includes('STATUS') ||
                colHeader.includes('FORMA') ||
                colHeader.includes('TIPO DE PAG')
              ) {
                continue
              }
              const candVal = row[colIdx]
              if (candVal !== null && candVal !== undefined && String(candVal).trim() !== '') {
                if (isValidaSanitaria(candVal)) {
                  const parsed = parseDataReceber(candVal, sheetCfg.ano, sheetCfg.mes)
                  if (parsed && !parsed.startsWith('1970')) {
                    dataVencimentoISO = parsed
                    rawData = candVal
                    teveDataPropriaNaLinha = true
                    ultimaDataValida = { val: candVal, r }
                    break
                  }
                }
              }
            }
          }

          // Se ainda não tiver data própria na linha mas houver última data válida do bloco contíguo visual imediato (<= 5 linhas)
          if (!teveDataPropriaNaLinha) {
            if (
              ultimaDataValida &&
              ultimaDataValida.val &&
              r - ultimaDataValida.r <= 5 &&
              isValidaSanitaria(ultimaDataValida.val)
            ) {
              dataVencimentoISO = parseDataReceber(ultimaDataValida.val, sheetCfg.ano, sheetCfg.mes)
            } else {
              // NUNCA usar "primeiro dia do mês da aba" como data de um título se a linha não tiver data legível:
              // PROIBIDO usar "1º dia do mês da aba" como fallback — vira divergência no resumo explícita com nome do cliente.
              sheetDivergenciasCount += 1
              const cliNomeExibicao = rawCli || rawDesc || 'cliente não identificado'
              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: numLinha,
                tipo: 'divergencia',
                motivo: `vencimento ilegível — linha ${numLinha}, cliente ${cliNomeExibicao}`,
              })
              continue
            }
          }

          // Se for aba genérica como Planilha7 e não tiver cliente resolvível (nem cliente nem descrição válidos)
          if (isAbaGenericaPlanilha && !rawCli && !rawDesc) {
            sheetDivergenciasCount += 1
            resultSummary.erros.push({
              aba: sheetCfg.name,
              linha: numLinha,
              tipo: 'divergencia',
              motivo: `Aba ${sheetCfg.name}: Linha sem cliente resolvível nem descrição válida. Registro não importado.`,
            })
            continue
          }

          // 3. Descrição e extração de cidade e nota
          // Regra do usuário ("descrição limpa"): a descrição gravada permanece VAZIA (""),
          // exceto se houver uma coluna de descrição dedicada DIFERENTE da coluna de cliente.
          // A cidade identificada vai para o campo Endereço e o número de nota vai para o campo Nota.
          // Nota só aceita conteúdo numérico/documento; se for texto livre, vira observação.
          // Sanitização do nome do cliente removendo pontuação/hífen final (ex.: "GAMARRA CONSTRUTORA E LOCADORA LTDA -")
          rawCli = sanitizarNomeCliente(rawCli)
          rawDesc = sanitizarNomeCliente(rawDesc)

          // Extrair informações de cheque se houver coluna de cheque ou célula com menção a cheque
          let chequeInfoLinha: string = ''
          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const h = activeHeaders[cIdx]
            if (isColunaCheque(h)) {
              const chExt = extrairNumeroCheque(row[cIdx])
              if (chExt && chExt.numero) {
                chequeInfoLinha = chExt.textoCompleto
                break
              }
            }
          }

          const textoParaExtracao = `${rawCli || ''} ${rawDesc || ''}${rawDoc ? ` [Doc: ${rawDoc}]` : ''}`
          const extraidos = extrairCidadeENota(textoParaExtracao)
          const notaFinal = (rawDoc && isNotaValida(rawDoc) ? rawDoc : extraidos.nota || '').trim()
          const enderecoFinal = (extraidos.cidade || '').trim()
          const baseTextoLivre =
            extraidos.textoLivreObservacao || (!isNotaValida(rawDoc) ? rawDoc : '')
          const textoLivreExtra = [baseTextoLivre, chequeInfoLinha].filter(Boolean).join(' | ')
          // Se rawDesc for igual a rawCli (ou não houver coluna de descrição dedicada), grava vazio ("")
          const descFinal = (rawDesc && rawDesc !== rawCli ? rawDesc : '').trim()

          const dateOnly = dataVencimentoISO.slice(0, 10)
          const cliNorm = normalizarTextoComparacao(rawCli || sheetCfg.name).slice(0, 30)
          const descNorm = normalizarTextoComparacao(descFinal).slice(0, 30)
          const notaNorm = normalizarTextoComparacao(notaFinal || '')
          const valorStr = valorFinal.toFixed(2)

          preparedItems.push({
            numLinha,
            rawCli,
            descFinal,
            dataVencimentoISO,
            notaFinal,
            enderecoFinal,
            textoLivreExtra,
            valorFinal,
            rawValorRec,
            rawDataRec,
            rawForma,
            rawStatus,
            rawRow: row,
            rawCentro,
            rawCat,
            notaNorm,
            descNorm,
            cliNorm,
            valorStr,
            dateOnly,
          })
        }

        // FASE 1.5: Pré-deduplicação interna dos itens da própria planilha
        // Duplicatas na mesma aba: mesma nota (se nota presente) OU mesma data+valor+cliente/desc
        const itensUnicosParaGravar: PreparedItemReceber[] = []
        if (detectarDuplicados) {
          const preBatchKeys = new Set<string>()
          const preBatchDocs = new Set<string>()
          for (const item of preparedItems) {
            const batchKey = `${item.dateOnly}_${item.valorStr}_${item.cliNorm}_${item.descNorm}_${item.notaNorm}`
            const docKey = item.notaNorm ? `doc_${item.notaNorm}` : null
            if (preBatchKeys.has(batchKey) || (docKey && preBatchDocs.has(docKey))) {
              sheetDuplicadosInternos += 1
              resultSummary.duplicadosInternos += 1
            } else {
              preBatchKeys.add(batchKey)
              if (docKey) preBatchDocs.add(docKey)
              itensUnicosParaGravar.push(item)
            }
          }
        } else {
          itensUnicosParaGravar.push(...preparedItems)
        }

        // FASE 2: Processamento concorrente com pool de 3 requisições em paralelo
        await runParallelPool(
          itensUnicosParaGravar,
          async (item) => {
            try {
              // 1. Resolver cliente com cache rápido em memória
              // Se item.rawCli existir, exige resolução sem retornar vazio (lança erro se falhar)
              let clienteId: string | null = null
              if (item.rawCli) {
                clienteId = await getOrCreateCliente(item.rawCli, sheetCfg.name)
              }

              // Chave exata primária e chave secundária por nota para evitar duplicação simultânea no pool
              const exactKey = `${clienteId || ''}_${item.dateOnly}_${item.valorStr}_${item.descNorm || item.cliNorm}`
              const docLockKey = item.notaNorm
                ? `lock_doc_${clienteId || ''}_${item.valorStr}_${item.notaNorm}`
                : null
              const globalDocLockKey = item.notaNorm ? `lock_globaldoc_${item.notaNorm}` : null

              // Se existir EXATAMENTE com mesma data, cliente, valor e descrição => duplicata real já gravada no banco
              if (detectarDuplicados) {
                if (
                  existingExactKeys.has(exactKey) ||
                  (docLockKey && existingExactKeys.has(docLockKey)) ||
                  (globalDocLockKey && existingExactKeys.has(globalDocLockKey))
                ) {
                  resultSummary.duplicadosBanco += 1
                  return
                }
                // RESERVA ATÔMICA DA CHAVE ANTES DE GRAVAR NO BANCO:
                // Garante que se outra promise em voo do mesmo lote tentar a mesma linha, ela já encontra a chave reservada
                existingExactKeys.add(exactKey)
                if (docLockKey) existingExactKeys.add(docLockKey)
                if (globalDocLockKey) existingExactKeys.add(globalDocLockKey)
              }

              // Determinar Situação e valores preliminares para uso em caso de criação OU reconciliação/atualização
              const classificacaoResult = classificarStatusRecebimento({
                rawStatus: item.rawStatus,
                row: item.rawRow,
                descFinal: item.descFinal,
                valorPrevisto: item.valorFinal,
                valorRecebido: item.rawValorRec,
                temColunaValorRecebido: Boolean(activeValRecCol),
                temColunaDataRecebimento: Boolean(activeDataRecCol),
                rawDataRecebimentoValida: isValidaSanitaria(item.rawDataRec),
                classificacaoPadrao,
              })

              const finalStatus: 'Recebida' | 'Aberta' | 'Parcial' | 'Recebimento Antecipado' =
                classificacaoResult.status

              const valorEfetivoRecebido = classificacaoResult.valorEfetivoRecebido

              const temDataRecLegivel = isValidaSanitaria(item.rawDataRec)
              let dataRecebimentoISO: string | null = null

              if (finalStatus !== 'Aberta') {
                if (temDataRecLegivel) {
                  dataRecebimentoISO =
                    parseDataReceber(item.rawDataRec, sheetCfg.ano, sheetCfg.mes) || null
                } else {
                  // Data de pagamento ilegível/ausente na planilha:
                  // NUNCA inventar data. Mantém dataRecebimentoISO = null e registra divergência explícita no resumo
                  dataRecebimentoISO = null
                  sheetDivergenciasCount += 1
                  resultSummary.erros.push({
                    aba: sheetCfg.name,
                    linha: item.numLinha,
                    tipo: 'divergencia',
                    motivo: `data de pagamento ilegível — linha ${item.numLinha}, cliente ${item.rawCli || item.descFinal || 'não identificado'} (status Recebida gravado com data de recebimento vazia)`,
                  })
                }
              }

              const finalForma = normalizarFormaRecebimento(
                item.rawForma,
                item.descFinal || item.rawCli,
              )

              // Se existir registro prévio com mesma nota/doc ou mesma desc/cli + cliente + valor,
              // reconciliar e atualizar vencimento, data_recebimento, forma, status, nota e endereço quando divergirem.
              // Hierarquia de casamento estrita conforme especificação:
              // (a) nota/doc
              // (b) cliente_id + valor (ignorando vencimento)
              // (c) desc/cli + valor ou nota global
              let existingRecordToUpdate: ContaReceber | null = null
              let matchedFlexKey: string | null = null

              if (detectarDuplicados) {
                // (a) Por nota/doc (com cliente_id ou global na empresa)
                if (item.notaNorm) {
                  const flexKeyDoc = `doc_${clienteId || ''}_${item.valorStr}_${item.notaNorm}`
                  const flexKeyOnlyDoc = `onlydoc_${item.notaNorm}`
                  if (existingFlexRecords.has(flexKeyDoc)) {
                    existingRecordToUpdate = existingFlexRecords.get(flexKeyDoc)!
                    matchedFlexKey = flexKeyDoc
                  } else if (existingFlexRecords.has(flexKeyOnlyDoc)) {
                    existingRecordToUpdate = existingFlexRecords.get(flexKeyOnlyDoc)!
                    matchedFlexKey = flexKeyOnlyDoc
                  } else {
                    const flexKeyGlobalDoc = `globaldoc_${item.valorStr}_${item.notaNorm}`
                    if (existingFlexRecords.has(flexKeyGlobalDoc)) {
                      existingRecordToUpdate = existingFlexRecords.get(flexKeyGlobalDoc)!
                      matchedFlexKey = flexKeyGlobalDoc
                    }
                  }
                }

                // (b) Por cliente_id + valor (ignorando vencimento)
                if (!existingRecordToUpdate && clienteId) {
                  const fallbackKey = `cli_${clienteId}_${item.valorStr}`
                  if (existingFlexRecords.has(fallbackKey)) {
                    existingRecordToUpdate = existingFlexRecords.get(fallbackKey)!
                    matchedFlexKey = fallbackKey
                  }
                }

                // (c) Por cliente normalizado + valor
                if (!existingRecordToUpdate && item.cliNorm) {
                  const flexKeyCli = `cli_${clienteId || ''}_${item.valorStr}_${item.cliNorm}`
                  if (existingFlexRecords.has(flexKeyCli)) {
                    existingRecordToUpdate = existingFlexRecords.get(flexKeyCli)!
                    matchedFlexKey = flexKeyCli
                  }
                }

                // (d) Por descrição + valor
                if (!existingRecordToUpdate && item.descNorm) {
                  const flexKeyDesc = `desc_${clienteId || ''}_${item.valorStr}_${item.descNorm}`
                  if (existingFlexRecords.has(flexKeyDesc)) {
                    existingRecordToUpdate = existingFlexRecords.get(flexKeyDesc)!
                    matchedFlexKey = flexKeyDesc
                  }
                }
              }

              if (existingRecordToUpdate) {
                const prevDateOnly = (existingRecordToUpdate.vencimento || '').slice(0, 10)
                const dataMudou = prevDateOnly !== item.dateOnly
                const notaDiverge = Boolean(
                  item.notaFinal && item.notaFinal !== (existingRecordToUpdate.nota || ''),
                )
                const enderecoDiverge = Boolean(
                  item.enderecoFinal &&
                  item.enderecoFinal !== (existingRecordToUpdate.endereco || ''),
                )

                const prevStatus = existingRecordToUpdate.status
                const statusDiverge = finalStatus !== prevStatus

                const prevForma = existingRecordToUpdate.forma_recebimento || null
                const formaDiverge =
                  finalStatus !== 'Aberta' && finalForma && finalForma !== prevForma

                const prevDataRecOnly = (existingRecordToUpdate.data_recebimento || '').slice(0, 10)
                const targetDataRecOnly = (dataRecebimentoISO || '').slice(0, 10)
                const dataRecDiverge = targetDataRecOnly !== prevDataRecOnly

                const prevValorRec = Number(existingRecordToUpdate.valor_recebido || 0)
                const valorRecDiverge = Math.abs(prevValorRec - valorEfetivoRecebido) > 0.01

                const prevValorPrevisto = Number(existingRecordToUpdate.valor || 0)
                const valorPrevistoDiverge = Math.abs(prevValorPrevisto - item.valorFinal) > 0.01

                // Detecção de legado congelado no dia 1 do mês da aba (ex.: 2026-01-01)
                const mesAbaPad = String(sheetCfg.mes).padStart(2, '0')
                const diaPrimeiroAba = `${sheetCfg.ano}-${mesAbaPad}-01`
                const ehLegadoDiaPrimeiro =
                  prevDateOnly === diaPrimeiroAba &&
                  (existingRecordToUpdate.observacoes || '').includes(sheetCfg.name)

                // Se houver qualquer divergência em vencimento, status, data de pagamento, forma, nota, endereço ou valor,
                // ou se for um registro legado que estava no dia 01 da aba e agora tem data real, ATUALIZAR
                if (
                  dataMudou ||
                  notaDiverge ||
                  enderecoDiverge ||
                  statusDiverge ||
                  formaDiverge ||
                  dataRecDiverge ||
                  valorRecDiverge ||
                  valorPrevistoDiverge ||
                  ehLegadoDiaPrimeiro
                ) {
                  const updatedConta = await withRateLimitRetry(
                    () =>
                      pb
                        .collection('contas_receber')
                        .update<ContaReceber>(existingRecordToUpdate!.id, {
                          ...(dataMudou || ehLegadoDiaPrimeiro
                            ? { vencimento: item.dataVencimentoISO }
                            : {}),
                          ...(notaDiverge ? { nota: item.notaFinal } : {}),
                          ...(enderecoDiverge ? { endereco: item.enderecoFinal } : {}),
                          ...(statusDiverge ? { status: finalStatus } : {}),
                          ...(formaDiverge || (finalStatus !== 'Aberta' && finalForma)
                            ? { forma_recebimento: finalForma }
                            : {}),
                          ...(dataRecDiverge ? { data_recebimento: dataRecebimentoISO } : {}),
                          ...(valorRecDiverge || finalStatus === 'Recebida'
                            ? { valor_recebido: valorEfetivoRecebido }
                            : {}),
                          ...(valorPrevistoDiverge ? { valor: item.valorFinal } : {}),
                          observacoes: `Atualizado via reimportação de planilha [Aba: ${sheetCfg.name}]${item.notaFinal ? ` | Doc: ${item.notaFinal}` : ''}${item.textoLivreExtra ? ` | Obs: ${item.textoLivreExtra}` : ''}`,
                        }),
                    {
                      maxRetries: 8,
                      initialDelayMs: 400,
                      maxDelayMs: 8000,
                      onRetry: (tentativa, delayMs) => {
                        setProgressMsg(
                          `Aguardando servidor... limite temporário (429) na atualização do título "${item.descFinal.slice(0, 25)}...". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                        )
                      },
                    },
                  )

                  // Se atualizou de "Aberta" para "Recebida", "Parcial" ou "Recebimento Antecipado",
                  // gerar movimento financeiro correspondente (se ainda não existir movimento para esta conta)
                  if (
                    prevStatus === 'Aberta' &&
                    (finalStatus === 'Recebida' ||
                      finalStatus === 'Parcial' ||
                      finalStatus === 'Recebimento Antecipado') &&
                    valorEfetivoRecebido > 0
                  ) {
                    try {
                      // Verifica se já existe movimento para não duplicar
                      const movExistente = await pb
                        .collection('movimentos_financeiros')
                        .getFirstListItem(`referencia_id = "${existingRecordToUpdate.id}"`)
                        .catch(() => null)

                      if (!movExistente) {
                        const dataMovimento = dataRecebimentoISO || item.dataVencimentoISO
                        const descMovimento = updatedConta.descricao
                          ? `Recebimento${finalStatus === 'Parcial' ? ' parcial' : ''}: ${updatedConta.descricao}${item.rawCli ? ` [${item.rawCli}]` : ''}`
                          : `Recebimento${finalStatus === 'Parcial' ? ' parcial' : ''}${item.rawCli ? `: ${item.rawCli}` : ''}`

                        await withRateLimitRetry(
                          () =>
                            pb.collection('movimentos_financeiros').create({
                              empresa_id: empresaId,
                              tipo: 'Entrada',
                              descricao: descMovimento,
                              valor: valorEfetivoRecebido,
                              data: dataMovimento,
                              categoria_id: updatedConta.categoria_id || null,
                              centro_custo_id: updatedConta.centro_custo_id || null,
                              origem: 'ContaReceber',
                              referencia_id: updatedConta.id,
                              conciliado: false,
                            }),
                          {
                            maxRetries: 8,
                            initialDelayMs: 400,
                            maxDelayMs: 8000,
                          },
                        )
                      }
                    } catch (movErr) {
                      console.warn(
                        'Erro ao gerar movimento de caixa na reconciliação para Recebida:',
                        movErr,
                      )
                    }
                  }

                  if (matchedFlexKey) {
                    existingFlexRecords.delete(matchedFlexKey)
                  }
                  if (item.notaNorm) {
                    existingFlexRecords.delete(
                      `doc_${clienteId || ''}_${item.valorStr}_${item.notaNorm}`,
                    )
                    existingFlexRecords.delete(`globaldoc_${item.valorStr}_${item.notaNorm}`)
                    existingFlexRecords.delete(`onlydoc_${item.notaNorm}`)
                  }
                  if (item.descNorm) {
                    existingFlexRecords.delete(
                      `desc_${clienteId || ''}_${item.valorStr}_${item.descNorm}`,
                    )
                  }
                  if (item.cliNorm) {
                    existingFlexRecords.delete(
                      `cli_${clienteId || ''}_${item.valorStr}_${item.cliNorm}`,
                    )
                  }
                  if (clienteId) {
                    existingFlexRecords.delete(`cli_${clienteId}_${item.valorStr}`)
                  }

                  resultSummary.atualizados += 1
                  sheetAtualizados += 1
                  if (finalStatus === 'Recebida') {
                    resultSummary.recebidasBaixadas += 1
                  }
                  return
                } else {
                  // Se não houve divergência, considerar duplicado idêntico
                  resultSummary.duplicadosBanco += 1
                  return
                }
              }

              // (Passos 5 e 6 já foram avaliados acima para a lógica de reconciliação e criação)

              // 7. Centro de Custo
              let finalCentroCustoId: string | null =
                centroCustoPadraoId !== 'none' && centroCustoPadraoId ? centroCustoPadraoId : null

              if (item.rawCentro) {
                const k = item.rawCentro.toLowerCase()
                if (centrosCache.has(k)) {
                  finalCentroCustoId = centrosCache.get(k)!.id
                }
              }

              // 8. Categoria / Plano de Contas
              let finalCategoriaId: string | null = categoriaPadraoId || null
              if (item.rawCat) {
                const k = item.rawCat.toLowerCase()
                if (categoriasCache.has(k)) {
                  finalCategoriaId = categoriasCache.get(k)!.id
                }
              }

              // 9. Gravar Conta a Receber no PocketBase
              const createdConta = await withRateLimitRetry(
                () =>
                  pb.collection('contas_receber').create<ContaReceber>({
                    empresa_id: empresaId,
                    cliente_id: clienteId || null,
                    descricao: item.descFinal,
                    categoria_id: finalCategoriaId,
                    centro_custo_id: finalCentroCustoId,
                    valor: item.valorFinal,
                    valor_recebido: valorEfetivoRecebido,
                    vencimento: item.dataVencimentoISO,
                    parcelas: 1,
                    status: finalStatus,
                    data_recebimento: dataRecebimentoISO,
                    forma_recebimento: finalStatus !== 'Aberta' ? finalForma : null,
                    endereco: item.enderecoFinal || undefined,
                    nota: item.notaFinal || undefined,
                    observacoes: `Importado de planilha [Aba: ${sheetCfg.name}]${item.notaFinal ? ` | Doc: ${item.notaFinal}` : ''}${item.textoLivreExtra ? ` | Obs: ${item.textoLivreExtra}` : ''}${finalStatus === 'Parcial' ? ` | Recebimento parcial importado: ${valorEfetivoRecebido}` : ''}`,
                  }),
                {
                  maxRetries: 8,
                  initialDelayMs: 400,
                  maxDelayMs: 8000,
                  onRetry: (tentativa, delayMs) => {
                    setProgressMsg(
                      `Aguardando servidor... limite temporário (429) no título "${item.descFinal.slice(0, 25)}...". Tentativa ${tentativa} em ${(delayMs / 1000).toFixed(1)}s`,
                    )
                  },
                },
              )

              // Registra nos índices em memória para evitar duplicações subsequentes no mesmo lote
              if (item.notaNorm) {
                existingFlexRecords.set(
                  `doc_${clienteId || ''}_${item.valorStr}_${item.notaNorm}`,
                  createdConta,
                )
                existingFlexRecords.set(`globaldoc_${item.valorStr}_${item.notaNorm}`, createdConta)
                existingFlexRecords.set(`onlydoc_${item.notaNorm}`, createdConta)
              }
              // 10. Se for Recebimento Antecipado, gera crédito correspondente para o cliente
              if (finalStatus === 'Recebimento Antecipado' && clienteId) {
                try {
                  await withRateLimitRetry(
                    () =>
                      pb.collection('creditos_clientes').create({
                        empresa_id: empresaId,
                        cliente_id: clienteId,
                        valor: item.valorFinal,
                        saldo_restante: item.valorFinal,
                        origem: `Recebimento Antecipado (${sheetCfg.name})`,
                        descricao: `Depósito/Adiantamento ref. ${item.descFinal} [Conta ${createdConta.id}]`,
                        data: dataRecebimentoISO || item.dataVencimentoISO,
                        status: 'disponivel',
                        referencia_conta_id: createdConta.id,
                      }),
                    {
                      maxRetries: 8,
                      initialDelayMs: 400,
                      maxDelayMs: 8000,
                    },
                  )
                  resultSummary.creditosGerados += 1
                } catch (credErr) {
                  console.warn('Erro ao criar crédito do cliente:', credErr)
                }
              }

              // 11. Se for Recebida, Parcial ou Recebimento Antecipado, gera movimento financeiro
              if (
                (finalStatus === 'Recebida' ||
                  finalStatus === 'Recebimento Antecipado' ||
                  finalStatus === 'Parcial') &&
                valorEfetivoRecebido > 0
              ) {
                try {
                  const dataMov = dataRecebimentoISO || item.dataVencimentoISO
                  const descMovimento = createdConta.descricao
                    ? `Recebimento${finalStatus === 'Parcial' ? ' parcial' : ''}: ${createdConta.descricao}${item.rawCli ? ` [${item.rawCli}]` : ''}`
                    : `Recebimento${finalStatus === 'Parcial' ? ' parcial' : ''}${item.rawCli ? `: ${item.rawCli}` : ''}`

                  await withRateLimitRetry(
                    () =>
                      pb.collection('movimentos_financeiros').create({
                        empresa_id: empresaId,
                        tipo: 'Entrada',
                        descricao: descMovimento,
                        valor: valorEfetivoRecebido,
                        data: dataMov,
                        categoria_id: finalCategoriaId,
                        centro_custo_id: finalCentroCustoId,
                        origem: 'ContaReceber',
                        referencia_id: createdConta.id,
                        conciliado: false,
                      }),
                    {
                      maxRetries: 8,
                      initialDelayMs: 400,
                      maxDelayMs: 8000,
                    },
                  )
                } catch (movErr) {
                  console.warn('Erro ao criar movimento financeiro correspondente:', movErr)
                }
              }

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
              sheetErrosGravacaoCount += 1
              // Extrair mensagem real do servidor / campos com falha de validação
              const fieldErrs = extractFieldErrors(rowErr)
              let detalheMsg = ''
              if (Object.keys(fieldErrs).length > 0) {
                detalheMsg = Object.entries(fieldErrs)
                  .map(([f, m]) => `${f}: ${m}`)
                  .join('; ')
              } else {
                detalheMsg = rowErr?.message || 'Falha ao gravar registro'
              }

              resultSummary.erros.push({
                aba: sheetCfg.name,
                linha: item.numLinha,
                tipo: 'gravacao',
                motivo: `Erro de gravação no servidor: ${detalheMsg}`,
              })
            } finally {
              linhasProcessadasGlobal += 1
              const percent = Math.min(
                99,
                Math.round((linhasProcessadasGlobal / totalLinhasGerais) * 100),
              )
              setProgressPercent(percent)
              const elapsed = Date.now() - startTime
              const msPerItem = elapsed / Math.max(1, linhasProcessadasGlobal)
              const remainingMs = msPerItem * (totalLinhasGerais - linhasProcessadasGlobal)
              setEstimatedTimeLeft(formatTimeEstimate(remainingMs))
              setProgressMsg(
                `Aba ${sheetCfg.name}: linha ${item.numLinha} (${linhasProcessadasGlobal}/${totalLinhasGerais} linhas processadas)`,
              )
            }
          },
          { concurrency: 3 },
        )

        const isVazia = sheetLidos === 0
        resultSummary.detalhesPorAba.push({
          aba: sheetCfg.name,
          linhasLidas: sheetLidos,
          importados: sheetImportados,
          atualizados: sheetAtualizados,
          duplicadosInternos: sheetDuplicadosInternos,
          divergenciasCount: sheetDivergenciasCount,
          errosGravacaoCount: sheetErrosGravacaoCount,
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
              {/* Seletor de Mês e Controles do Topo */}
              <div className="p-3.5 bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-transparent rounded-2xl border border-teal-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                      <span>Escolher Mês para Importação:</span>
                    </Label>
                    <p className="text-[11px] text-teal-900/80 mt-0.5">
                      Filtre e selecione diretamente o mês desejado sem precisar marcar/desmarcar
                      abas manualmente.
                    </p>
                  </div>

                  <div className="w-full sm:w-72 shrink-0">
                    <Select value={selectedMesFilter} onValueChange={handleMesFilterChange}>
                      <SelectTrigger className="h-8 text-xs bg-white border-teal-300 font-medium text-teal-950 shadow-xs focus:ring-teal-500">
                        <SelectValue placeholder="Selecione o mês..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="font-semibold text-teal-900">
                          Todos os meses (automático)
                        </SelectItem>
                        <SelectItem value="1">01 - Janeiro (2026)</SelectItem>
                        <SelectItem value="2">02 - Fevereiro (2026)</SelectItem>
                        <SelectItem value="3">03 - Março (2026)</SelectItem>
                        <SelectItem value="4">04 - Abril (2026)</SelectItem>
                        <SelectItem value="5">05 - Maio (2026)</SelectItem>
                        <SelectItem value="6">06 - Junho (2026)</SelectItem>
                        <SelectItem value="7">07 - Julho (2026)</SelectItem>
                        <SelectItem value="8">08 - Agosto (2026)</SelectItem>
                        <SelectItem value="9">09 - Setembro (2026)</SelectItem>
                        <SelectItem value="10">10 - Outubro (2026)</SelectItem>
                        <SelectItem value="11">11 - Novembro (2026)</SelectItem>
                        <SelectItem value="12">12 - Dezembro (2026)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedMesFilter !== 'todos' && (
                  <div className="flex items-center justify-between text-[11px] text-teal-900 bg-white/70 px-2.5 py-1.5 rounded-lg border border-teal-200">
                    <span>
                      Filtrando abas de{' '}
                      <strong>
                        {
                          [
                            '',
                            'Janeiro',
                            'Fevereiro',
                            'Março',
                            'Abril',
                            'Maio',
                            'Junho',
                            'Julho',
                            'Agosto',
                            'Setembro',
                            'Outubro',
                            'Novembro',
                            'Dezembro',
                          ][parseInt(selectedMesFilter, 10)]
                        }
                      </strong>{' '}
                      — apenas as abas deste mês serão processadas.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMesFilterChange('todos')}
                      className="text-teal-700 hover:text-teal-900 font-semibold underline underline-offset-2 ml-2 cursor-pointer"
                    >
                      Ver todas as abas
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#ECEAE4]">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {selectedMesFilter === 'todos'
                      ? `Abas Identificadas (${sheetsConfig.length})`
                      : `Abas Filtradas (${sheetsConfig.filter((s) => s.mes === parseInt(selectedMesFilter, 10)).length} de ${sheetsConfig.length})`}
                  </h3>
                  <p className="text-gray-500 text-xs">
                    {selectedMesFilter === 'todos'
                      ? 'Confira a competência inferida para 2026 e desmarque abas que não deseja processar:'
                      : 'Abas selecionadas automaticamente para a competência escolhida:'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedMesFilter === 'todos') {
                        selectAllSheets(true)
                      } else {
                        const m = parseInt(selectedMesFilter, 10)
                        setSheetsConfig((prev) =>
                          prev.map((s) => (s.mes === m ? { ...s, selected: true } : s)),
                        )
                      }
                    }}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Marcar Todas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedMesFilter === 'todos') {
                        selectAllSheets(false)
                      } else {
                        const m = parseInt(selectedMesFilter, 10)
                        setSheetsConfig((prev) =>
                          prev.map((s) => (s.mes === m ? { ...s, selected: false } : s)),
                        )
                      }
                    }}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Desmarcar
                  </Button>
                </div>
              </div>

              {/* Lista de abas com mês/ano ajustável */}
              {(() => {
                const abasExibidas =
                  selectedMesFilter === 'todos'
                    ? sheetsConfig
                    : sheetsConfig.filter((s) => s.mes === parseInt(selectedMesFilter, 10))

                if (abasExibidas.length === 0) {
                  return (
                    <div className="p-6 text-center rounded-xl border border-dashed border-[#ECEAE4] bg-[#FAF9F7] space-y-2">
                      <p className="text-xs text-gray-600 font-medium">
                        Nenhuma aba identificada para o mês selecionado.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleMesFilterChange('todos')}
                        className="text-xs"
                      >
                        Voltar para todos os meses
                      </Button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {abasExibidas.map((cfg) => (
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
                )
              })()}

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
            <div className="py-10 max-w-md mx-auto text-center space-y-5">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-700" />
              <div className="space-y-1">
                <h3 className="font-bold text-gray-900 text-sm">
                  Processando e gravando recebimentos no banco...
                </h3>
                <p className="text-gray-500 text-xs min-h-[20px]">
                  {progressMsg || 'Consolidando abas mensais e clientes...'}
                </p>
              </div>

              {/* Barra de Progresso com Percentual e Tempo Restante */}
              <div className="space-y-2 bg-[#FAF9F7] p-3.5 rounded-xl border border-[#ECEAE4] text-left">
                <div className="flex items-center justify-between text-[11px] font-medium text-gray-700">
                  <span>Progresso geral</span>
                  <span className="font-mono text-teal-800 font-bold">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-gray-200" />
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                  <span>Pool paralelo de requisições ativo</span>
                  {estimatedTimeLeft && (
                    <span className="text-teal-700 font-medium">
                      Restante aprox.: {estimatedTimeLeft}
                    </span>
                  )}
                </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div className="p-2.5 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Lidos</span>
                  <span className="text-base font-bold text-gray-800 font-mono">
                    {summary.totalLidos}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-emerald-200 rounded-xl text-center bg-emerald-50/20">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                    Novos
                  </span>
                  <span className="text-base font-bold text-emerald-700 font-mono">
                    {summary.importados}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-blue-200 rounded-xl text-center bg-blue-50/20">
                  <span className="text-[10px] text-blue-700 font-bold uppercase block">
                    Atualizados
                  </span>
                  <span className="text-base font-bold text-blue-700 font-mono">
                    {summary.atualizados}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-teal-700 font-bold uppercase block">
                    Baixados
                  </span>
                  <span className="text-base font-bold text-teal-700 font-mono">
                    {summary.recebidasBaixadas}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-amber-200 rounded-xl text-center bg-amber-50/20">
                  <span
                    className="text-[10px] text-amber-700 font-bold uppercase block"
                    title="Linhas repetidas da própria planilha somadas na pré-deduplicação"
                  >
                    Duplicadas
                  </span>
                  <span className="text-base font-bold text-amber-700 font-mono">
                    {summary.duplicadosInternos}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-red-200 rounded-xl text-center bg-red-50/20">
                  <span className="text-[10px] text-red-700 font-bold uppercase block">Erros</span>
                  <span className="text-base font-bold text-red-700 font-mono">
                    {summary.erros.filter((e) => e.tipo === 'gravacao').length}
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
                    {summary.detalhesPorAba.map((item, idx) => {
                      const temErroGravacao = item.errosGravacaoCount > 0
                      const temDivergencia = item.divergenciasCount > 0

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                            item.vaziaOuSemCabecalho
                              ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                              : temErroGravacao
                                ? 'bg-red-50/50 border-red-200 text-gray-800'
                                : temDivergencia
                                  ? 'bg-amber-50/50 border-amber-200 text-gray-800'
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
                                {item.linhasLidas} lidas • {item.importados} novos
                                {item.atualizados > 0 && ` • ${item.atualizados} atualizados`}
                                {item.duplicadosInternos > 0 &&
                                  ` • ${item.duplicadosInternos} duplicadas (da própria planilha)`}
                              </span>
                            )}
                          </div>

                          {item.vaziaOuSemCabecalho ? (
                            <span className="text-[11px] font-medium text-amber-800">
                              {item.motivoVazia || 'Aba sem dados detectados'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {temErroGravacao && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-red-100 text-red-800 border-red-300 font-semibold"
                                >
                                  {item.errosGravacaoCount} erro(s) de gravação
                                </Badge>
                              )}
                              {temDivergencia && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-100 text-amber-800 border-amber-300"
                                >
                                  {item.divergenciasCount} divergência(s) cadastrais
                                </Badge>
                              )}
                              {!temErroGravacao && !temDivergencia && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300"
                                >
                                  100% OK
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
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

              {/* Erros de gravação no servidor */}
              {summary.erros.filter((e) => e.tipo === 'gravacao').length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="font-semibold text-red-900 block mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Erros de Gravação no Servidor (
                    {summary.erros.filter((e) => e.tipo === 'gravacao').length}):
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] text-red-800">
                    {summary.erros
                      .filter((e) => e.tipo === 'gravacao')
                      .map((err, i) => (
                        <div key={i}>
                          [{err.aba}] Linha {err.linha}: {err.motivo}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Divergências de validação cadastral / dados da planilha */}
              {summary.erros.filter((e) => e.tipo === 'divergencia').length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="font-semibold text-amber-900 block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Divergências Cadastrais da Planilha (
                    {summary.erros.filter((e) => e.tipo === 'divergencia').length}):
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] text-amber-800">
                    {summary.erros
                      .filter((e) => e.tipo === 'divergencia')
                      .map((err, i) => (
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
