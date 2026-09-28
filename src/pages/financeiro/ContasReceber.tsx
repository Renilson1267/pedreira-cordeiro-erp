import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type {
  ContaReceber,
  Cliente,
  PlanoConta,
  CentroCusto,
  StatusContaReceber,
  CreditoCliente,
} from '@/types/erp'
import {
  historicoService,
  calcularDiffAlteracoes,
  CAMPOS_CONFIG_RECEBER,
} from '@/services/historico'
import { HistoricoSecao } from '@/components/financeiro/HistoricoSecao'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  ColunaRelatorioImpressao,
  TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import {
  SeletorParcelas,
  TipoPrazo,
  ItemParcela,
  gerarGradeParcelas,
} from '@/components/financeiro/SeletorParcelas'
import { useDebounce } from '@/hooks/useDebounce'

const ImportadorRecebimentosModal = React.lazy(() =>
  import('@/components/financeiro/ImportadorRecebimentosModal').then((m) => ({
    default: m.ImportadorRecebimentosModal,
  })),
)
const HistoricoGeralModal = React.lazy(() =>
  import('@/components/financeiro/HistoricoGeralModal').then((m) => ({
    default: m.HistoricoGeralModal,
  })),
)
const RelatorioListagemImpressaoModal = React.lazy(
  () => import('@/components/financeiro/RelatorioListagemImpressaoModal'),
)
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import { toast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  CheckCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  ArrowDownLeft,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  X,
  Filter,
  History,
  Tag,
  Percent,
  CheckSquare,
} from 'lucide-react'
import type { TipoDesconto, FormaRecebimento, ChequePredatado } from '@/types/erp'
import {
  formasRecebimentoService,
  chequesPredatadosService,
  FORMAS_RECEBIMENTO_PADRAO,
} from '@/services/formasRecebimento'

export default function ContasReceber() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [contas, setContas] = useState<ContaReceber[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [creditos, setCreditos] = useState<CreditoCliente[]>([])
  const [formasCadastradas, setFormasCadastradas] = useState<FormaRecebimento[]>([])
  const [loading, setLoading] = useState(true)

  // Paginação no servidor
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalItems, setTotalItems] = useState<number>(0)
  const pageSize = 50

  // Totais agregados leves dos cards
  const [totaisCards, setTotaisCards] = useState({
    aberto: 0,
    vencido: 0,
    recebido: 0,
    antecipado: 0,
  })

  // Impressão sob demanda
  const [loadingImpressao, setLoadingImpressao] = useState(false)
  const [itensImpressaoCarregados, setItensImpressaoCarregados] = useState<ContaReceber[]>([])

  const nowISO = new Date().toISOString().slice(0, 10)

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    'Todas' | 'Aberta' | 'Parcial' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado'
  >('Todas')
  const [campoDataFiltro, setCampoDataFiltro] = useState<
    'vencimento' | 'data_emissao' | 'data_recebimento'
  >('vencimento')
  const [dataInicioFilter, setDataInicioFilter] = useState<string>('')
  const [dataFimFilter, setDataFimFilter] = useState<string>('')
  const [opcaoPeriodoRapido, setOpcaoPeriodoRapido] = useState<string>('todos')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 350)

  // Seleção múltipla para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Modal de Impressão do Relatório
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false)
  // Histórico Geral Modal
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false)

  // Drawer Create / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [clienteId, setClienteId] = useState('')
  const [clienteDepositante, setClienteDepositante] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState<number>(0) // Valor Líquido final
  const [valorBruto, setValorBruto] = useState<number>(0) // Valor Bruto digitado
  const [tipoDesconto, setTipoDesconto] = useState<TipoDesconto>('percentual')
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [descontoValor, setDescontoValor] = useState<number>(0)
  const [vencimento, setVencimento] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [parcelas, setParcelas] = useState<number>(1)
  const [prazoSelecionado, setPrazoSelecionado] = useState<TipoPrazo>('mensal')
  const [gradeParcelas, setGradeParcelas] = useState<ItemParcela[]>([])
  const [datasCustomizadasManuais, setDatasCustomizadasManuais] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [nota, setNota] = useState('')
  const [status, setStatus] = useState<
    'Aberta' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado'
  >('Aberta')
  const [formaRecebimentoForm, setFormaRecebimentoForm] = useState<string>('Pix')
  const [chequesPredatadosForm, setChequesPredatadosForm] = useState<
    Array<{ id?: string; data: string; valor: number; numero: string; banco: string }>
  >([])
  const [observacoes, setObservacoes] = useState('')

  // Settle (Receber) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaReceber | null>(null)
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [valorRecebido, setValorRecebido] = useState<number>(0)
  const [formaRecebimento, setFormaRecebimento] = useState<string>('Pix')
  const [usarCreditoCliente, setUsarCreditoCliente] = useState(false)
  const [valorCreditoUsado, setValorCreditoUsado] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Read-only Detail Drawer & Cheques
  const [detailItem, setDetailItem] = useState<ContaReceber | null>(null)
  const [chequesDetail, setChequesDetail] = useState<ChequePredatado[]>([])
  const [loadingChequesDetail, setLoadingChequesDetail] = useState(false)

  // Confirmation Alert Dialog State
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive'
    action: () => Promise<void> | void
  } | null>(null)

  useRealtime('contas_receber', () => loadData())
  useRealtime('cheques_predatados', () => {
    if (detailItem) {
      carregarChequesDoTitulo(detailItem.id)
    }
  })

  // Construção de expressão de filtro PocketBase no servidor
  const buildPocketBaseFilter = useCallback(() => {
    if (!currentEmpresa) return ''
    const parts: string[] = [`empresa_id = '${currentEmpresa.id}'`]

    // Status filter
    if (statusFilter === 'Aberta') {
      parts.push(`status = 'Aberta' && vencimento >= '${nowISO}'`)
    } else if (statusFilter === 'Vencida') {
      parts.push(
        `(status = 'Vencida' || (status != 'Recebida' && status != 'Recebimento Antecipado' && vencimento < '${nowISO}'))`,
      )
    } else if (statusFilter === 'Parcial') {
      parts.push(`status = 'Parcial'`)
    } else if (statusFilter === 'Recebida') {
      parts.push(`status = 'Recebida'`)
    } else if (statusFilter === 'Recebimento Antecipado') {
      parts.push(`status = 'Recebimento Antecipado'`)
    }

    // Centro de custo
    if (centroCustoFilter !== 'todos') {
      parts.push(`centro_custo_id = '${centroCustoFilter}'`)
    }

    // Filtro de período por campo
    const dataCampo =
      campoDataFiltro === 'vencimento'
        ? 'vencimento'
        : campoDataFiltro === 'data_emissao'
          ? 'data_emissao'
          : 'data_recebimento'

    if (dataInicioFilter) {
      parts.push(`${dataCampo} >= '${dataInicioFilter} 00:00:00.000Z'`)
    }
    if (dataFimFilter) {
      parts.push(`${dataCampo} <= '${dataFimFilter} 23:59:59.999Z'`)
    }

    // Busca textual
    const termo = debouncedSearchQuery.trim().replace(/'/g, "\\'")
    if (termo) {
      parts.push(
        `(descricao ~ '${termo}' || cliente_id.nome ~ '${termo}' || cliente_depositante ~ '${termo}' || nota ~ '${termo}' || endereco ~ '${termo}' || observacoes ~ '${termo}')`,
      )
    }

    return parts.join(' && ')
  }, [
    currentEmpresa,
    statusFilter,
    centroCustoFilter,
    campoDataFiltro,
    dataInicioFilter,
    dataFimFilter,
    debouncedSearchQuery,
    nowISO,
  ])

  // Carrega listas auxiliares (clientes, categorias, centros, formas, créditos) uma vez por empresa
  const [auxiliaresLoaded, setAuxiliaresLoaded] = useState(false)
  const carregarAuxiliares = useCallback(async () => {
    if (!currentEmpresa || auxiliaresLoaded) return
    try {
      const [cList, pcList, ccList, credList, fList] = await Promise.all([
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}' && (tipo = 'Receita' || tipo = 'Outro')`,
          sort: 'codigo',
        }),
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        pb.collection('creditos_clientes').getFullList<CreditoCliente>({
          filter: `empresa_id = '${currentEmpresa.id}' && status != 'utilizado'`,
          sort: 'data',
        }),
        formasRecebimentoService.listar(currentEmpresa.id, true),
      ])

      setClientes(cList)
      setCategorias(pcList)
      setCentrosCusto(ccList)
      setCreditos(credList)
      setFormasCadastradas(fList)
      setAuxiliaresLoaded(true)
    } catch (err) {
      console.error('Error loading auxiliares contas a receber:', err)
    }
  }, [currentEmpresa, auxiliaresLoaded])

  // Carrega dados da página paginada no servidor
  const loadData = async (targetPage?: number) => {
    if (!currentEmpresa) return

    const pageToLoad = targetPage !== undefined ? targetPage : currentPage

    try {
      setLoading(true)
      await carregarAuxiliares()
      const serverFilter = buildPocketBaseFilter()

      const res = await pb
        .collection('contas_receber')
        .getList<ContaReceber>(pageToLoad, pageSize, {
          filter: serverFilter,
          sort: 'vencimento',
          expand: 'cliente_id,categoria_id,centro_custo_id',
        })

      setContas(res.items)
      setTotalPages(res.totalPages || 1)
      setTotalItems(res.totalItems || 0)
      setCurrentPage(res.page)

      const qNovo = searchParams.get('novo')
      const qId = searchParams.get('id')
      const qAction = searchParams.get('action')
      const qStatus = searchParams.get('status')

      if (qStatus === 'Vencidas' && statusFilter !== 'Vencida') {
        setStatusFilter('Vencida')
      }

      if (qNovo && canEdit) {
        openCreateModal()
      } else if (qId) {
        const found = res.items.find((c) => c.id === qId)
        if (found) {
          if (qAction === 'settle' && canEdit && found.status !== 'Recebida') {
            handleOpenSettle(found)
          } else {
            setDetailItem(found)
          }
        }
      }
    } catch (err) {
      console.error('Error loading contas a receber:', err)
    } finally {
      setLoading(false)
    }
  }

  // Agregação leve dos cards de Contas a Receber
  const carregarTotaisCards = useCallback(async () => {
    if (!currentEmpresa) return
    try {
      const parts: string[] = [`empresa_id = '${currentEmpresa.id}'`]
      if (centroCustoFilter !== 'todos') {
        parts.push(`centro_custo_id = '${centroCustoFilter}'`)
      }
      const dataCampo =
        campoDataFiltro === 'vencimento'
          ? 'vencimento'
          : campoDataFiltro === 'data_emissao'
            ? 'data_emissao'
            : 'data_recebimento'

      if (dataInicioFilter) {
        parts.push(`${dataCampo} >= '${dataInicioFilter} 00:00:00.000Z'`)
      }
      if (dataFimFilter) {
        parts.push(`${dataCampo} <= '${dataFimFilter} 23:59:59.999Z'`)
      }

      const rows = await pb
        .collection('contas_receber')
        .getFullList<
          Pick<ContaReceber, 'id' | 'valor' | 'valor_recebido' | 'status' | 'vencimento'>
        >({
          filter: parts.join(' && '),
          fields: 'id,valor,valor_recebido,status,vencimento',
        })

      let aberto = 0
      let vencido = 0
      let recebido = 0
      let antecipado = 0

      for (const r of rows) {
        const valTotal = Number(r.valor || 0)
        const valRec = Number(r.valor_recebido || 0)
        const saldo = Math.max(0, valTotal - valRec)

        recebido += valRec

        if (r.status === 'Recebimento Antecipado') {
          antecipado += valTotal
        } else if (r.status === 'Recebida') {
          // Já quitada
        } else {
          const isAtrasado = (r.vencimento ? r.vencimento.slice(0, 10) : '') < nowISO
          if (r.status === 'Vencida' || isAtrasado) {
            vencido += saldo
          } else {
            aberto += saldo
          }
        }
      }

      setTotaisCards({ aberto, vencido, recebido, antecipado })
    } catch (err) {
      console.warn('Erro ao carregar totais leves dos cards contas a receber:', err)
    }
  }, [currentEmpresa, centroCustoFilter, campoDataFiltro, dataInicioFilter, dataFimFilter, nowISO])

  // Ao mudar filtros, reseta para página 1 e recarrega dados + cards
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
    loadData(1)
    carregarTotaisCards()
  }, [
    currentEmpresa,
    statusFilter,
    centroCustoFilter,
    campoDataFiltro,
    dataInicioFilter,
    dataFimFilter,
    debouncedSearchQuery,
  ])

  // Ao trocar de página manualmente
  const handlePageChange = (novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > totalPages || novaPagina === currentPage) return
    setCurrentPage(novaPagina)
    loadData(novaPagina)
  }

  // Carregar cheques ao abrir detalhes do título
  const carregarChequesDoTitulo = async (tituloId: string) => {
    try {
      setLoadingChequesDetail(true)
      const chks = await chequesPredatadosService.listarPorTitulo(tituloId)
      setChequesDetail(chks)
    } catch (err) {
      console.warn('Erro ao carregar cheques do título:', err)
    } finally {
      setLoadingChequesDetail(false)
    }
  }

  useEffect(() => {
    if (detailItem?.id) {
      carregarChequesDoTitulo(detailItem.id)
    } else {
      setChequesDetail([])
    }
  }, [detailItem?.id])

  const [centroCustoId, setCentroCustoId] = useState('')

  // Cálculos de desconto para Contas a Receber
  const valorDescontoCalc = useMemo(() => {
    const vb = Math.max(0, Number(valorBruto || 0))
    if (tipoDesconto === 'percentual') {
      const perc = Math.min(100, Math.max(0, Number(descontoPercentual || 0)))
      return Number(((vb * perc) / 100).toFixed(2))
    } else {
      const vd = Math.max(0, Number(descontoValor || 0))
      return Number(Math.min(vb, vd).toFixed(2))
    }
  }, [valorBruto, tipoDesconto, descontoPercentual, descontoValor])

  const valorLiquidoCalc = useMemo(() => {
    const vb = Math.max(0, Number(valorBruto || 0))
    return Number(Math.max(0, vb - valorDescontoCalc).toFixed(2))
  }, [valorBruto, valorDescontoCalc])

  const openCreateModal = () => {
    const hoje = toInputDate(new Date().toISOString())
    setEditingId(null)
    setClienteId('')
    setClienteDepositante('')
    setCentroCustoId('')
    setDescricao('')
    setCategoriaId(categorias[0]?.id || '')
    setValorBruto(0)
    setTipoDesconto('percentual')
    setDescontoPercentual(0)
    setDescontoValor(0)
    setValor(0)
    setVencimento(hoje)
    setDataEmissao('')
    setParcelas(1)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(hoje, 1, 'mensal', 0))
    setFormaRecebimentoForm('Pix')
    setChequesPredatadosForm([])
    setEndereco('')
    setNota('')
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = async (c: ContaReceber) => {
    const venc = toInputDate(c.vencimento)
    const numP = c.parcelas || 1
    const vBrutoInit = Number(c.valor_bruto || c.valor || 0)
    const tipoDescInit = c.tipo_desconto || 'percentual'
    const descPercInit = Number(c.desconto_percentual || 0)
    const descValInit = Number(c.valor_desconto || 0)

    setEditingId(c.id)
    setClienteId(c.cliente_id || '')
    setClienteDepositante(c.cliente_depositante || '')
    setCentroCustoId(c.centro_custo_id || '')
    setDescricao(c.descricao)
    setCategoriaId(c.categoria_id || '')
    setValorBruto(vBrutoInit)
    setTipoDesconto(tipoDescInit)
    setDescontoPercentual(descPercInit)
    setDescontoValor(descValInit)
    setValor(c.valor)
    setVencimento(venc)
    setDataEmissao(c.data_emissao ? toInputDate(c.data_emissao) : '')
    setParcelas(numP)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(venc, numP, 'mensal', c.valor))
    setFormaRecebimentoForm(c.forma_recebimento || 'Pix')
    setEndereco(c.endereco || '')
    setNota(c.nota || '')
    setStatus(c.status === 'Recebida' ? 'Recebida' : 'Aberta')
    setObservacoes(c.observacoes || '')

    // Carregar cheques pré-datados se houver para este título
    try {
      const chks = await chequesPredatadosService.listarPorTitulo(c.id)
      setChequesPredatadosForm(
        chks.map((chk) => ({
          id: chk.id,
          data: toInputDate(chk.data),
          valor: chk.valor,
          numero: chk.numero || '',
          banco: chk.banco || '',
        })),
      )
    } catch (_) {
      setChequesPredatadosForm([])
    }

    setIsDrawerOpen(true)
  }

  // Handlers para parcelamento com prazos rápidos e datas livres
  const handleChangeVencimentoBase = (novaData: string) => {
    setVencimento(novaData)
    if (!editingId && !datasCustomizadasManuais) {
      setGradeParcelas(gerarGradeParcelas(novaData, parcelas, prazoSelecionado, valor))
    } else if (!editingId && gradeParcelas.length > 0) {
      setGradeParcelas((prev) =>
        prev.map((item, idx) => (idx === 0 ? { ...item, vencimento: novaData } : item)),
      )
    }
  }

  const handleChangeValorBruto = (novoBruto: number) => {
    setValorBruto(novoBruto)
    // Recalcula o valor líquido com o desconto atual
    let desc = 0
    if (tipoDesconto === 'percentual') {
      const perc = Math.min(100, Math.max(0, Number(descontoPercentual || 0)))
      desc = Number(((novoBruto * perc) / 100).toFixed(2))
    } else {
      desc = Number(Math.min(novoBruto, Math.max(0, Number(descontoValor || 0))).toFixed(2))
    }
    const liq = Number(Math.max(0, novoBruto - desc).toFixed(2))
    setValor(liq)

    if (!editingId && gradeParcelas.length > 0) {
      const n = gradeParcelas.length
      const unit = liq > 0 ? Number((liq / n).toFixed(2)) : 0
      setGradeParcelas((prev) =>
        prev.map((item, idx) => {
          let v = unit
          if (idx === n - 1 && liq > 0) {
            const somaAnt = unit * (n - 1)
            const diff = Number((liq - somaAnt).toFixed(2))
            if (diff > 0) v = diff
          }
          return { ...item, valor: v }
        }),
      )
    }
  }

  // Atualizar grade quando o desconto ou valor líquido mudar
  const sincronizarGradeComLiquido = (liq: number) => {
    setValor(liq)
    if (!editingId && gradeParcelas.length > 0) {
      const n = gradeParcelas.length
      const unit = liq > 0 ? Number((liq / n).toFixed(2)) : 0
      setGradeParcelas((prev) =>
        prev.map((item, idx) => {
          let v = unit
          if (idx === n - 1 && liq > 0) {
            const somaAnt = unit * (n - 1)
            const diff = Number((liq - somaAnt).toFixed(2))
            if (diff > 0) v = diff
          }
          return { ...item, valor: v }
        }),
      )
    }
  }

  const handleChangeNumParcelas = (novoNum: number) => {
    setParcelas(novoNum)
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(vencimento, novoNum, prazoSelecionado, valor))
  }

  const handleSelecionarPrazoRapido = (novoPrazo: TipoPrazo) => {
    setPrazoSelecionado(novoPrazo)
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(vencimento, parcelas, novoPrazo, valor))
  }

  const handleChangeDataParcelaIndividual = (index: number, novaData: string) => {
    setDatasCustomizadasManuais(true)
    setGradeParcelas((prev) => {
      const novaGrade = prev.map((item, idx) =>
        idx === index ? { ...item, vencimento: novaData } : item,
      )
      return novaGrade
    })
    if (index === 0) {
      setVencimento(novaData)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorFinalLiquido = valorLiquidoCalc
    const valorFinalBruto = Number(valorBruto || 0)
    const valorFinalDesconto = valorDescontoCalc

    if (valorFinalBruto <= 0) {
      toast({ title: 'Informe um valor bruto válido', variant: 'destructive' })
      return
    }

    if (tipoDesconto === 'percentual') {
      if (descontoPercentual < 0 || descontoPercentual > 100) {
        toast({
          title: 'Desconto inválido',
          description: 'O desconto percentual deve estar entre 0% e 100%.',
          variant: 'destructive',
        })
        return
      }
    } else {
      if (descontoValor < 0) {
        toast({
          title: 'Desconto inválido',
          description: 'O valor do desconto não pode ser negativo.',
          variant: 'destructive',
        })
        return
      }
      if (descontoValor > valorFinalBruto) {
        toast({
          title: 'Desconto excede o valor bruto',
          description: `O desconto (${formatCurrency(descontoValor)}) não pode exceder o valor bruto (${formatCurrency(valorFinalBruto)}).`,
          variant: 'destructive',
        })
        return
      }
    }

    if (valorFinalLiquido <= 0) {
      toast({
        title: 'Valor líquido inválido',
        description: 'O valor líquido do título deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (!vencimento) {
      toast({ title: 'Preencha a data de vencimento', variant: 'destructive' })
      return
    }

    const descFinal = descricao.trim() || 'Título a Receber'
    const isEdit = Boolean(editingId)
    setConfirmDialogData({
      title: isEdit ? 'Confirmar alteração de título' : 'Confirmar inclusão de título a receber',
      description: isEdit
        ? `Deseja salvar as alterações no título "${descFinal}"? Valor Bruto: ${formatCurrency(valorFinalBruto)}, Desconto: ${formatCurrency(valorFinalDesconto)}, Valor Líquido: ${formatCurrency(valorFinalLiquido)}.`
        : `Deseja criar ${parcelas > 1 ? `${parcelas} parcelas` : 'o título'} de "${descFinal}" no valor líquido total de ${formatCurrency(valorFinalLiquido)}?${valorFinalDesconto > 0 ? ` (Desconto: ${formatCurrency(valorFinalDesconto)})` : ''}`,
      confirmLabel: isEdit ? 'Confirmar Alteração' : 'Criar Título',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const dataEmissaoIso = dataEmissao
            ? new Date(`${dataEmissao}T12:00:00Z`).toISOString()
            : null

          if (editingId) {
            const registroAntes = contas.find((c) => c.id === editingId)
            const novoObj = {
              descricao: descFinal,
              cliente_id: clienteId === 'none' || !clienteId ? null : clienteId,
              cliente_depositante: clienteDepositante.trim() || '',
              categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
              centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
              valor_bruto: valorFinalBruto,
              tipo_desconto: valorFinalDesconto > 0 ? tipoDesconto : null,
              desconto_percentual:
                valorFinalDesconto > 0 && tipoDesconto === 'percentual'
                  ? Number(descontoPercentual)
                  : null,
              valor_desconto: valorFinalDesconto > 0 ? valorFinalDesconto : 0,
              valor: valorFinalLiquido, // Grava líquido no título
              vencimento: new Date(vencimento).toISOString(),
              data_emissao: dataEmissaoIso,
              parcelas: Number(parcelas),
              status: status,
              forma_recebimento: formaRecebimentoForm || null,
              endereco: endereco.trim(),
              nota: nota.trim(),
              observacoes: observacoes.trim(),
            }

            await pb.collection('contas_receber').update(editingId, novoObj)

            // Se for cheque pré-datado, sincronizar cheques
            if (formaRecebimentoForm === 'Cheque Pré-datado' && chequesPredatadosForm.length > 0) {
              await chequesPredatadosService.salvarLote(
                currentEmpresa!.id,
                editingId,
                chequesPredatadosForm,
              )
            }

            // Gravar histórico de alteração com diff
            if (registroAntes) {
              const diffs = calcularDiffAlteracoes(registroAntes, novoObj, CAMPOS_CONFIG_RECEBER)
              const clienteNomeNovo =
                clientes.find((cli) => cli.id === (clienteId === 'none' ? '' : clienteId))?.nome ||
                descFinal

              await historicoService.registrar({
                empresaId: currentEmpresa!.id,
                colecaoOrigem: 'contas_receber',
                registroId: editingId,
                acao: 'editar',
                usuarioId: user?.id,
                usuarioNome: user?.name || user?.email || 'Usuário',
                descricao: `Título atualizado para "${descFinal}" (${formatCurrency(valorFinalLiquido)}) - Cliente: ${clienteNomeNovo}. ${diffs.length > 0 ? `${diffs.length} campo(s) modificado(s).` : 'Sem alteração de campos chave.'}`,
                detalhes: {
                  alteracoes: diffs,
                  valor: valorFinalLiquido,
                  extra: {
                    valor_bruto: valorFinalBruto,
                    valor_desconto: valorFinalDesconto,
                    desconto_percentual: descontoPercentual,
                    tipo_desconto: tipoDesconto,
                    forma_recebimento: formaRecebimentoForm,
                  },
                },
              })
            }

            toast({ title: 'Conta a receber atualizada!' })
          } else {
            const numParcelas = Math.max(1, Number(parcelas))
            const parcelasParaSalvar =
              gradeParcelas.length === numParcelas
                ? gradeParcelas
                : gerarGradeParcelas(vencimento, numParcelas, prazoSelecionado, valorFinalLiquido)

            const clienteNomeCriado =
              clientes.find((cli) => cli.id === (clienteId === 'none' ? '' : clienteId))?.nome ||
              descFinal

            for (let i = 0; i < parcelasParaSalvar.length; i++) {
              const item = parcelasParaSalvar[i]
              const dataVencIso = item.vencimento
                ? new Date(`${item.vencimento}T12:00:00Z`).toISOString()
                : new Date(vencimento).toISOString()

              const parcelValue =
                Number(item.valor) ||
                Number(valorFinalLiquido) / (numParcelas > 1 ? numParcelas : 1)

              const parcelBruto = Number((valorFinalBruto / numParcelas).toFixed(2))
              const parcelDesconto = Number((valorFinalDesconto / numParcelas).toFixed(2))

              const desc = numParcelas > 1 ? `${descFinal} (${i + 1}/${numParcelas})` : descFinal

              const createdConta = await pb.collection('contas_receber').create<ContaReceber>({
                empresa_id: currentEmpresa!.id,
                descricao: desc,
                cliente_id: clienteId === 'none' || !clienteId ? null : clienteId,
                cliente_depositante: clienteDepositante.trim() || '',
                categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
                centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
                valor_bruto: parcelBruto,
                tipo_desconto: valorFinalDesconto > 0 ? tipoDesconto : null,
                desconto_percentual:
                  valorFinalDesconto > 0 && tipoDesconto === 'percentual'
                    ? Number(descontoPercentual)
                    : null,
                valor_desconto: parcelDesconto,
                valor: parcelValue, // Valor líquido
                vencimento: dataVencIso,
                data_emissao: dataEmissaoIso || undefined,
                parcelas: numParcelas,
                status: status,
                forma_recebimento: formaRecebimentoForm || null,
                endereco: endereco.trim(),
                nota: nota.trim(),
                observacoes: observacoes.trim(),
                data_recebimento: status === 'Recebimento Antecipado' ? dataVencIso : undefined,
              })

              // Se for cheque pré-datado na primeira ou única parcela, salvar cheques associados
              if (
                formaRecebimentoForm === 'Cheque Pré-datado' &&
                chequesPredatadosForm.length > 0 &&
                i === 0
              ) {
                await chequesPredatadosService.salvarLote(
                  currentEmpresa!.id,
                  createdConta.id,
                  chequesPredatadosForm,
                )
              }

              // Gravar histórico de criação
              await historicoService.registrar({
                empresaId: currentEmpresa!.id,
                colecaoOrigem: 'contas_receber',
                registroId: createdConta.id,
                acao: 'criar',
                usuarioId: user?.id,
                usuarioNome: user?.name || user?.email || 'Usuário',
                descricao: `Título a receber criado no valor de ${formatCurrency(parcelValue)} (Bruto: ${formatCurrency(parcelBruto)}${parcelDesconto > 0 ? `, Desc: ${formatCurrency(parcelDesconto)}` : ''}) com vencimento em ${formatDate(dataVencIso)} para "${clienteNomeCriado}".`,
                detalhes: {
                  valor: parcelValue,
                  extra: {
                    parcela: `${i + 1}/${numParcelas}`,
                    nota: nota.trim() || undefined,
                    descricao: desc,
                    valor_bruto: parcelBruto,
                    valor_desconto: parcelDesconto,
                  },
                },
              })

              if (status === 'Recebimento Antecipado' && clienteId && clienteId !== 'none') {
                await pb.collection('creditos_clientes').create({
                  empresa_id: currentEmpresa!.id,
                  cliente_id: clienteId,
                  valor: parcelValue,
                  saldo_restante: parcelValue,
                  origem: 'Recebimento Antecipado',
                  descricao: `Depósito/Adiantamento ref. ${desc}`,
                  data: dataVencIso,
                  status: 'disponivel',
                  referencia_conta_id: createdConta.id,
                })
              }
            }
            toast({ title: 'Conta a receber criada com sucesso!' })
          }

          setIsDrawerOpen(false)
          setSearchParams({})
          await loadData()
        } catch (err: any) {
          toast({ title: 'Erro ao salvar conta', description: err.message, variant: 'destructive' })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const handleDelete = (id: string, descricaoAlvo?: string) => {
    const itemAlvo = contas.find((c) => c.id === id)
    const descNome = descricaoAlvo || itemAlvo?.descricao || 'Título a receber'
    const valTotal = itemAlvo?.valor || 0

    setConfirmDialogData({
      title: 'Confirmar exclusão de conta a receber',
      description: `Deseja realmente excluir o título "${descNome}"? Esta ação removerá o registro e não poderá ser desfeita.`,
      confirmLabel: 'Excluir Título',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          // Gravar histórico de exclusão antes de deletar
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_receber',
            registroId: id,
            acao: 'excluir',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Título "${descNome}" no valor de ${formatCurrency(valTotal)} foi excluído do sistema.`,
            detalhes: {
              valor: valTotal,
              extra: {
                descricao: descNome,
                cliente: itemAlvo?.expand?.cliente_id?.nome,
                nota: itemAlvo?.nota,
              },
            },
          })

          await pb.collection('contas_receber').delete(id)
          toast({ title: 'Lançamento excluído com sucesso.' })
          if (detailItem?.id === id) setDetailItem(null)
          await loadData()
        } catch (err: any) {
          toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
        }
      },
    })
    setConfirmDialogOpen(true)
  }
  const handleEstorno = (c: ContaReceber) => {
    const valorRecebidoAtual = getValorRecebidoEfetivo(c)
    if (valorRecebidoAtual <= 0 && c.status === 'Aberta') {
      toast({ title: 'Este título não possui baixas para estornar.', variant: 'destructive' })
      return
    }

    const clienteNome = c.expand?.cliente_id?.nome || c.descricao || 'Título'

    setConfirmDialogData({
      title: 'Confirmar estorno de recebimento',
      description: `Deseja estornar o recebimento de ${formatCurrency(valorRecebidoAtual)} de "${clienteNome}"? O título voltará para o status "Aberta", o valor recebido e data serão zerados, e será lançado um movimento de caixa inverso (Saída/Estorno) de mesmo valor para manter os saldos bancários e contábeis consistentes.`,
      confirmLabel: 'Confirmar Estorno',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          setIsSubmitting(true)
          const agora = new Date()
          const dataHojeFormatada = formatDate(agora.toISOString())
          const obsEstorno = ` [Estornado em ${dataHojeFormatada}: revertido ${formatCurrency(valorRecebidoAtual)}]`

          // 1. Reverter o título para Aberta, zerando valor_recebido e data_recebimento
          await pb.collection('contas_receber').update(c.id, {
            status: 'Aberta',
            valor_recebido: 0,
            data_recebimento: null,
            forma_recebimento: null,
            observacoes: (c.observacoes || '') + obsEstorno,
          })

          // 2. Criar movimento financeiro inverso (Saída no valor estornado)
          let movInversoId: string | undefined
          if (valorRecebidoAtual > 0) {
            const mov = await pb.collection('movimentos_financeiros').create({
              empresa_id: currentEmpresa!.id,
              tipo: 'Saida',
              descricao: `Estorno de recebimento: ${c.descricao || clienteNome}${c.nota ? ` [Doc: ${c.nota}]` : ''}`,
              valor: valorRecebidoAtual,
              data: agora.toISOString(),
              categoria_id: c.categoria_id || null,
              centro_custo_id: c.centro_custo_id || null,
              origem: 'ContaReceber',
              referencia_id: c.id,
              conciliado: false,
            })
            movInversoId = mov.id
          }

          // 3. Registrar histórico de alteração (estorno)
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_receber',
            registroId: c.id,
            acao: 'estorno',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Recebimento estornado no valor de ${formatCurrency(valorRecebidoAtual)}. O título retornou para "Aberta" e foi gerado movimento de Saída no caixa para manter a conciliação consistente.`,
            detalhes: {
              valor: valorRecebidoAtual,
              movimento_inverso: {
                tipo: 'Saida',
                valor: valorRecebidoAtual,
                movimento_id: movInversoId,
              },
            },
          })

          toast({
            title: 'Recebimento estornado com sucesso!',
            description: `Título retornado para Em Aberto e movimento de saída gerado no valor de ${formatCurrency(valorRecebidoAtual)}.`,
          })
          if (detailItem?.id === c.id) {
            setDetailItem(null)
          }
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao estornar recebimento',
            description: err.message,
            variant: 'destructive',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  // Crédito disponível para o cliente da conta selecionada para baixa
  const creditosDisponiveisCliente = useMemo(() => {
    if (!settlingConta?.cliente_id) return []
    return creditos.filter((c) => c.cliente_id === settlingConta.cliente_id && c.saldo_restante > 0)
  }, [settlingConta])

  const totalCreditoDisponivelCliente = useMemo(() => {
    return creditosDisponiveisCliente.reduce((sum, c) => sum + (c.saldo_restante || 0), 0)
  }, [creditosDisponiveisCliente])

  const getValorRecebidoEfetivo = (c: ContaReceber) => {
    if (c.status === 'Recebida') {
      return c.valor_recebido && c.valor_recebido > 0 ? c.valor_recebido : c.valor
    }
    return c.valor_recebido || 0
  }

  const getSaldoRestante = (c: ContaReceber) => {
    if (c.status === 'Recebida') return 0
    const jaRecebido = getValorRecebidoEfetivo(c)
    return Math.max(0, (c.valor || 0) - jaRecebido)
  }

  const handleImprimirComprovante = (c: ContaReceber) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900')
    if (!printWindow) {
      toast({
        title: 'Bloqueador de popups ativo',
        description: 'Permita popups para imprimir o comprovante.',
        variant: 'destructive',
      })
      return
    }

    const clienteComprador = c.expand?.cliente_id?.nome || c.descricao || 'Não informado'
    const clienteDepositanteTexto = c.cliente_depositante?.trim() || ''
    const documento = c.nota?.trim() || '—'
    const vencimentoFormatado = formatDate(c.vencimento)
    const valorBrutoFormatado = formatCurrency(c.valor_bruto || c.valor)
    const valorDescontoFormatado =
      c.valor_desconto && c.valor_desconto > 0 ? formatCurrency(c.valor_desconto) : null
    const descontoInfoTexto =
      c.valor_desconto && c.valor_desconto > 0
        ? `${formatCurrency(c.valor_desconto)} (${c.desconto_percentual ? `${c.desconto_percentual}%` : c.tipo_desconto === 'percentual' ? '%' : 'R$'})`
        : 'Sem desconto'
    const valorTotalFormatado = formatCurrency(c.valor)
    const displayStatus = getContaStatusReal(c)
    const recebimentoFormatado = c.data_recebimento ? formatDate(c.data_recebimento) : '—'
    const formaRecebimentoTexto = c.forma_recebimento || '—'
    const centroCustoTexto = c.expand?.centro_custo_id
      ? `${c.expand.centro_custo_id.codigo} - ${c.expand.centro_custo_id.nome}`
      : '—'
    const categoriaTexto = c.expand?.categoria_id?.nome || '—'
    const observacoesTexto = c.observacoes?.trim() || 'Sem observações registradas.'
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const horaEmissao = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante de Conta a Receber - ${documento !== '—' ? documento : c.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #fff;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 {
      margin: 0;
      font-size: 17px;
      color: #0f766e;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header .subtitle {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #4b5563;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header .meta {
      font-size: 11px;
      color: #6b7280;
      text-align: right;
    }
    .badge-status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #d1d5db;
    }
    .badge-recebida {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }
    .badge-aberta {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .badge-vencida {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    .badge-parcial {
      background: #fffbeb;
      color: #b45309;
      border-color: #fde68a;
    }
    .badge-antecipado {
      background: #f0fdfa;
      color: #0f766e;
      border-color: #99f6e4;
    }
    .card-destaque-teal {
      background: #f0fdfa;
      border: 1.5px solid #0d9488;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .card-destaque-teal .titulo-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #0f766e;
      margin-bottom: 2px;
    }
    .card-destaque-teal .nome-depositante {
      font-size: 15px;
      font-weight: 700;
      color: #115e59;
    }
    .card-destaque-teal .aviso {
      font-size: 11px;
      color: #0f766e;
      margin-top: 2px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 20px;
      margin-bottom: 18px;
    }
    .field {
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 6px;
    }
    .field-full {
      grid-column: span 2;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }
    .field-value.mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .field-value.destaque {
      font-size: 17px;
      color: #0f766e;
      font-weight: 800;
    }
    .box-obs {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 6px;
      padding: 10px 12px;
      margin-top: 14px;
    }
    .box-obs .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #78716c;
      margin-bottom: 4px;
    }
    .box-obs .content {
      font-size: 12px;
      color: #44403c;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px dashed #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #9ca3af;
    }
    .assinatura-block {
      margin-top: 48px;
      display: flex;
      justify-content: space-around;
      gap: 30px;
    }
    .linha-assinatura {
      width: 220px;
      border-top: 1px solid #9ca3af;
      padding-top: 4px;
      text-align: center;
      font-size: 11px;
      color: #4b5563;
      font-weight: 600;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>GRUPO PEDREIRA CORDEIRO</h1>
      <div class="subtitle">Comprovante de Conta a Receber / Antecipação</div>
    </div>
    <div class="meta">
      <div>Emissão: ${dataEmissao} às ${horaEmissao}</div>
      <div style="margin-top: 4px;">ID Título: <span style="font-family: monospace;">${c.id}</span></div>
    </div>
  </div>

  ${
    clienteDepositanteTexto
      ? `<div class="card-destaque-teal">
          <div class="titulo-label">Cliente Depositante (Terceiro Pagador Identificado)</div>
          <div class="nome-depositante">${clienteDepositanteTexto}</div>
          <div class="aviso">Depósito/Transferência bancária efetuada por depositante terceiro em favor do cliente comprador.</div>
        </div>`
      : ''
  }

  <div class="grid">
    <div class="field">
      <div class="field-label">Cliente Comprador</div>
      <div class="field-value">${clienteComprador}</div>
    </div>

    <div class="field">
      <div class="field-label">Documento / NF</div>
      <div class="field-value mono">${documento}</div>
    </div>

    <div class="field">
      <div class="field-label">Situação / Status</div>
      <div class="field-value">
        <span class="badge-status ${
          displayStatus === 'Recebida'
            ? 'badge-recebida'
            : displayStatus === 'Vencida'
              ? 'badge-vencida'
              : displayStatus === 'Parcial'
                ? 'badge-parcial'
                : displayStatus === 'Recebimento Antecipado'
                  ? 'badge-antecipado'
                  : 'badge-aberta'
        }">${displayStatus}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-label">Data de Vencimento</div>
      <div class="field-value mono">${vencimentoFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Valor Bruto</div>
      <div class="field-value mono">${valorBrutoFormatado}</div>
    </div>

    ${
      valorDescontoFormatado
        ? `<div class="field">
            <div class="field-label">Desconto Concedido</div>
            <div class="field-value mono" style="color: #b45309; font-weight: 700;">− ${descontoInfoTexto}</div>
          </div>`
        : ''
    }

    <div class="field">
      <div class="field-label">Valor Líquido (A Receber)</div>
      <div class="field-value destaque mono">${valorTotalFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Data de Recebimento / Baixa</div>
      <div class="field-value mono">${recebimentoFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Forma de Recebimento</div>
      <div class="field-value">${formaRecebimentoTexto}</div>
    </div>

    <div class="field">
      <div class="field-label">Centro de Custo</div>
      <div class="field-value">${centroCustoTexto}</div>
    </div>

    ${
      c.endereco
        ? `<div class="field field-full">
            <div class="field-label">Cidade / Endereço</div>
            <div class="field-value">${c.endereco}</div>
          </div>`
        : ''
    }

    <div class="field field-full">
      <div class="field-label">Categoria Contábil</div>
      <div class="field-value">${categoriaTexto}</div>
    </div>
  </div>

  <div class="box-obs">
    <div class="label">Observações / Detalhes</div>
    <div class="content">${observacoesTexto}</div>
  </div>

  <div class="assinatura-block">
    <div class="linha-assinatura">Responsável Financeiro</div>
    <div class="linha-assinatura">Cliente / Depositante</div>
  </div>

  <div class="footer">
    <div>Grupo Pedreira Cordeiro — Sistema ERP de Gestão Integrada</div>
    <div>Página 1 de 1</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleOpenSettle = (conta: ContaReceber) => {
    setSettlingConta(conta)
    setDataRecebimento(toInputDate(new Date().toISOString()))
    const saldo = getSaldoRestante(conta)
    setValorRecebido(saldo > 0 ? saldo : conta.valor)
    setFormaRecebimento(conta.forma_recebimento || 'Pix')
    setUsarCreditoCliente(false)
    setValorCreditoUsado(0)
    setSettleModalOpen(true)
  }

  // Ação de compensar cheque pré-datado
  const handleCompensarCheque = (cheque: ChequePredatado) => {
    if (!detailItem) return
    const dataChequeFormatada = formatDate(cheque.data)

    setConfirmDialogData({
      title: 'Confirmar compensação de cheque pré-datado',
      description: `Deseja marcar como compensado o cheque de ${formatCurrency(cheque.valor)} (Vencimento: ${dataChequeFormatada}${cheque.numero ? `, Nº ${cheque.numero}` : ''}${cheque.banco ? `, Banco: ${cheque.banco}` : ''})? Isso atualizará o status do cheque para Compensado e gerará uma entrada no caixa na data de compensação.`,
      confirmLabel: 'Confirmar Compensação',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const dataCompensacaoIso = new Date().toISOString()

          // 1. Atualizar cheque no banco
          await chequesPredatadosService.atualizar(cheque.id, {
            status: 'compensado',
            data_compensacao: dataCompensacaoIso,
          })

          // 2. Gerar movimento de caixa de Entrada na data do cheque/compensação
          const clienteNome =
            detailItem.expand?.cliente_id?.nome || detailItem.descricao || 'Título'
          const mov = await pb.collection('movimentos_financeiros').create({
            empresa_id: currentEmpresa!.id,
            tipo: 'Entrada',
            descricao: `Compensação de cheque pré-datado: ${clienteNome}${cheque.numero ? ` [Cheque Nº ${cheque.numero}]` : ''}${cheque.banco ? ` [Banco: ${cheque.banco}]` : ''} - Ref: ${detailItem.descricao}`,
            valor: cheque.valor,
            data: dataCompensacaoIso,
            categoria_id: detailItem.categoria_id || null,
            centro_custo_id: detailItem.centro_custo_id || null,
            origem: 'ContaReceber',
            referencia_id: detailItem.id,
            conciliado: false,
          })

          // 3. Registrar no histórico de alterações
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'cheques_predatados',
            registroId: cheque.id,
            acao: 'baixa',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Cheque pré-datado de ${formatCurrency(cheque.valor)} compensado em ${formatDate(dataCompensacaoIso)}. Gerado movimento de Entrada no caixa ref. título "${detailItem.descricao}".`,
            detalhes: {
              valor: cheque.valor,
              extra: {
                cheque_id: cheque.id,
                numero: cheque.numero,
                banco: cheque.banco,
                titulo_id: detailItem.id,
                movimento_financeiro_id: mov.id,
              },
            },
          })

          toast({
            title: 'Cheque compensado com sucesso!',
            description: `Movimento de entrada gerado no valor de ${formatCurrency(cheque.valor)}.`,
          })

          await carregarChequesDoTitulo(detailItem.id)
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao compensar cheque',
            description: err.message,
            variant: 'destructive',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settlingConta) return
    const valorBaixa = Number(valorRecebido)
    if (valorBaixa <= 0) {
      toast({ title: 'Informe um valor válido a receber', variant: 'destructive' })
      return
    }

    setConfirmDialogData({
      title: 'Confirmar recebimento / baixa',
      description: `Deseja registrar o recebimento de ${formatCurrency(valorBaixa)} em ${dataRecebimento ? formatDate(dataRecebimento) : 'hoje'} via ${formaRecebimento}? Isso atualizará o saldo e lançará a entrada no caixa.`,
      confirmLabel: 'Confirmar Recebimento',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const recDateISO = new Date(dataRecebimento).toISOString()

          // Abatimento de crédito se selecionado
          let formaFinal = formaRecebimento
          if (usarCreditoCliente && valorCreditoUsado > 0) {
            formaFinal = 'Crédito do Cliente' as any
            let restanteParaAbater = valorCreditoUsado

            for (const cred of creditosDisponiveisCliente) {
              if (restanteParaAbater <= 0) break
              const abatimento = Math.min(cred.saldo_restante, restanteParaAbater)
              const novoSaldo = cred.saldo_restante - abatimento
              const novoStatus = novoSaldo <= 0.001 ? 'utilizado' : 'parcial'

              await pb.collection('creditos_clientes').update(cred.id, {
                saldo_restante: novoSaldo,
                status: novoStatus,
              })

              restanteParaAbater -= abatimento
            }
          }

          const totalAcumuladoAntes = getValorRecebidoEfetivo(settlingConta)
          const novoTotalRecebido = totalAcumuladoAntes + valorBaixa
          const valorTituloTotal = Number(settlingConta.valor || 0)
          const estaQuitado = novoTotalRecebido >= valorTituloTotal - 0.009
          const novoStatus = estaQuitado ? 'Recebida' : 'Parcial'

          const obsBaixa = ` [Baixa ${novoStatus === 'Recebida' ? 'total' : 'parcial'} de ${formatCurrency(valorBaixa)} em ${formatDate(recDateISO)}${usarCreditoCliente ? ` (Crédito: ${formatCurrency(valorCreditoUsado)})` : ''}]`

          await pb.collection('contas_receber').update(settlingConta.id, {
            status: novoStatus,
            valor_recebido: novoTotalRecebido,
            data_recebimento: recDateISO,
            forma_recebimento: formaFinal,
            observacoes: (settlingConta.observacoes || '') + obsBaixa,
          })

          const clienteNomeTitulo = settlingConta.expand?.cliente_id?.nome || ''
          const rotuloTitulo = settlingConta.descricao
            ? `${settlingConta.descricao}${clienteNomeTitulo ? ` [${clienteNomeTitulo}]` : ''}`
            : clienteNomeTitulo || 'Recebimento'

          const mov = await pb.collection('movimentos_financeiros').create({
            empresa_id: currentEmpresa!.id,
            tipo: 'Entrada',
            descricao: `Recebimento${novoStatus === 'Parcial' ? ' parcial' : ''}: ${rotuloTitulo}${usarCreditoCliente ? ' (Compensado via Crédito)' : ''}${settlingConta.expand?.centro_custo_id ? ` [${settlingConta.expand.centro_custo_id.codigo}]` : ''}`,
            valor: valorBaixa,
            data: recDateISO,
            categoria_id: settlingConta.categoria_id || null,
            centro_custo_id: settlingConta.centro_custo_id || null,
            origem: 'ContaReceber',
            referencia_id: settlingConta.id,
            conciliado: false,
          })

          // 3. Registrar histórico de baixa
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_receber',
            registroId: settlingConta.id,
            acao: 'baixa',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Baixa ${novoStatus === 'Recebida' ? 'total' : 'parcial'} de ${formatCurrency(valorBaixa)} via ${formaFinal} em ${formatDate(recDateISO)}${usarCreditoCliente ? ` (Crédito usado: ${formatCurrency(valorCreditoUsado)})` : ''}. Saldo restante: ${formatCurrency(Math.max(0, valorTituloTotal - novoTotalRecebido))}.`,
            detalhes: {
              valor: valorBaixa,
              extra: {
                forma_recebimento: formaFinal,
                data_recebimento: recDateISO,
                status_resultante: novoStatus,
                usar_credito_cliente: usarCreditoCliente,
                valor_credito_usado: valorCreditoUsado,
                movimento_financeiro_id: mov.id,
              },
            },
          })

          toast({
            title: estaQuitado
              ? 'Título quitado integralmente!'
              : 'Recebimento parcial registrado com sucesso!',
            description: estaQuitado
              ? `Valor recebido: ${formatCurrency(valorBaixa)}`
              : `Recebido: ${formatCurrency(valorBaixa)}. Saldo restante: ${formatCurrency(Math.max(0, valorTituloTotal - novoTotalRecebido))}`,
          })
          setSettleModalOpen(false)
          setSearchParams({})
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao liquidar recebimento',
            description: err.message,
            variant: 'destructive',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const getContaStatusReal = (c: ContaReceber): StatusContaReceber => {
    // Decisão permanente v0.0.65: títulos "Aberta" exibem SEMPRE status Aberta (vencida/aberta/próximo de vencer = Aberta).
    // O controle gerencial de atraso é feito visualmente (destaque vermelho/âmbar) e no KPI de Vencidos.
    if (c.status === 'Aberta') return 'Aberta'
    return c.status
  }

  // Os itens da página atual já vêm filtrados do servidor
  const filteredContas = contas

  // Saldo total em aberto, vencido, recebido e antecipado alimentados pela agregação leve do servidor
  const totalAberto = totaisCards.aberto
  const totalVencido = totaisCards.vencido
  const totalRecebido = totaisCards.recebido
  const totalAntecipado = totaisCards.antecipado

  const handleSelecionarPeriodoRapido = (opcao: string) => {
    setOpcaoPeriodoRapido(opcao)
    const hoje = new Date()
    const y = hoje.getFullYear()
    const m = hoje.getMonth()

    if (opcao === 'todos') {
      setDataInicioFilter('')
      setDataFimFilter('')
    } else if (opcao === 'este_mes') {
      const primeiroDia = new Date(y, m, 1)
      const ultimoDia = new Date(y, m + 1, 0)
      setDataInicioFilter(toInputDate(primeiroDia.toISOString()))
      setDataFimFilter(toInputDate(ultimoDia.toISOString()))
    } else if (opcao === 'mes_passado') {
      const primeiroDia = new Date(y, m - 1, 1)
      const ultimoDia = new Date(y, m, 0)
      setDataInicioFilter(toInputDate(primeiroDia.toISOString()))
      setDataFimFilter(toInputDate(ultimoDia.toISOString()))
    } else if (opcao === 'este_ano') {
      const primeiroDia = new Date(y, 0, 1)
      const ultimoDia = new Date(y, 11, 31)
      setDataInicioFilter(toInputDate(primeiroDia.toISOString()))
      setDataFimFilter(toInputDate(ultimoDia.toISOString()))
    }
  }

  const handleLimparFiltros = () => {
    setStatusFilter('Todas')
    setCentroCustoFilter('todos')
    setDataInicioFilter('')
    setDataFimFilter('')
    setOpcaoPeriodoRapido('todos')
    setCampoDataFiltro('vencimento')
    setSearchQuery('')
    setSelectedIds([])
  }

  // Handlers de seleção por checkbox
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredContas.length && filteredContas.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredContas.map((c) => c.id))
    }
  }

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Abertura do relatório sob demanda: busca todos os registros do filtro ativo no servidor se necessário
  const handleAbrirRelatorioImpressao = async () => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      setItensImpressaoCarregados(contas.filter((c) => set.has(c.id)))
      setRelatorioImpressaoOpen(true)
      return
    }

    try {
      setLoadingImpressao(true)
      const serverFilter = buildPocketBaseFilter()
      const todasDoFiltro = await pb.collection('contas_receber').getFullList<ContaReceber>({
        filter: serverFilter,
        sort: 'vencimento',
        expand: 'cliente_id,categoria_id,centro_custo_id',
      })
      setItensImpressaoCarregados(todasDoFiltro)
      setRelatorioImpressaoOpen(true)
    } catch (err) {
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível buscar a listagem completa dos filtros.',
        variant: 'destructive',
      })
    } finally {
      setLoadingImpressao(false)
    }
  }

  // Itens para impressão: selecionados quando houver, senão os do filtro completo sob demanda
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return (itensImpressaoCarregados.length > 0 ? itensImpressaoCarregados : contas).filter((c) =>
        set.has(c.id),
      )
    }
    return itensImpressaoCarregados.length > 0 ? itensImpressaoCarregados : contas
  }, [itensImpressaoCarregados, contas, selectedIds])

  // Descrição legível dos filtros aplicados
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (dataInicioFilter || dataFimFilter) {
      const campoNome =
        campoDataFiltro === 'vencimento'
          ? 'Vencimento'
          : campoDataFiltro === 'data_emissao'
            ? 'Emissão'
            : 'Recebimento'
      const de = dataInicioFilter ? formatDate(dataInicioFilter) : 'Início'
      const ate = dataFimFilter ? formatDate(dataFimFilter) : 'Fim'
      partes.push(`Período: ${de} a ${ate} (Base: ${campoNome})`)
    } else if (opcaoPeriodoRapido && opcaoPeriodoRapido !== 'todos') {
      const labels: Record<string, string> = {
        este_mes: 'Este mês',
        mes_passado: 'Mês passado',
        este_ano: 'Este ano',
      }
      partes.push(`Período: ${labels[opcaoPeriodoRapido] || opcaoPeriodoRapido}`)
    } else {
      partes.push('Período: Todos os recebimentos')
    }

    if (statusFilter !== 'Todas') {
      partes.push(`Status: ${statusFilter}`)
    }
    if (centroCustoFilter !== 'todos') {
      const cc = centrosCusto.find((c) => c.id === centroCustoFilter)
      if (cc) partes.push(`C. Custo: ${cc.codigo} - ${cc.nome}`)
    }
    if (debouncedSearchQuery.trim()) {
      partes.push(`Busca: "${debouncedSearchQuery.trim()}"`)
    }
    if (selectedIds.length > 0) {
      partes.push(`Seleção ativa: ${selectedIds.length} item(ns) marcado(s)`)
    }
    return partes.join(' · ')
  }, [
    dataInicioFilter,
    dataFimFilter,
    campoDataFiltro,
    opcaoPeriodoRapido,
    statusFilter,
    centroCustoFilter,
    centrosCusto,
    debouncedSearchQuery,
    selectedIds.length,
  ])

  // Colunas do relatório de impressão A4 para Contas a Receber
  const colunasRelatorioReceber = useMemo<ColunaRelatorioImpressao<ContaReceber>[]>(() => {
    return [
      {
        key: 'cliente_descricao',
        header: 'Cliente / Sacado',
        render: (c) => {
          const nomeCli = c.expand?.cliente_id?.nome || ''
          return (
            <div>
              <div className="font-semibold text-gray-900">
                {nomeCli || c.descricao || 'Cliente não informado'}
              </div>
              {c.cliente_depositante && (
                <div className="text-[10px] text-teal-800 font-medium">
                  Depositante: {c.cliente_depositante}
                </div>
              )}
              {c.descricao && nomeCli && (
                <div className="text-[10px] text-gray-500">{c.descricao}</div>
              )}
            </div>
          )
        },
      },
      {
        key: 'documento',
        header: 'Doc / NF',
        className: 'font-mono whitespace-nowrap',
        render: (c) => c.nota || '—',
      },
      {
        key: 'emissao',
        header: 'Emissão',
        className: 'font-mono whitespace-nowrap',
        render: (c) => (c.data_emissao ? formatDate(c.data_emissao) : '—'),
      },
      {
        key: 'vencimento',
        header: 'Vencimento',
        className: 'font-mono whitespace-nowrap font-medium',
        render: (c) => formatDate(c.vencimento),
      },
      {
        key: 'forma',
        header: 'Forma',
        render: (c) => c.forma_recebimento || '—',
      },
      {
        key: 'valor',
        header: 'Valor (R$)',
        align: 'right',
        className: 'font-mono font-medium text-gray-900 whitespace-nowrap',
        render: (c) => formatCurrency(c.valor),
      },
      {
        key: 'desconto',
        header: 'Desc. (R$)',
        align: 'right',
        className: 'font-mono text-amber-700 whitespace-nowrap',
        render: (c) =>
          c.valor_desconto && c.valor_desconto > 0 ? formatCurrency(c.valor_desconto) : '—',
      },
      {
        key: 'recebido',
        header: 'Recebido (R$)',
        align: 'right',
        className: 'font-mono text-emerald-800 whitespace-nowrap',
        render: (c) => {
          const rec = getValorRecebidoEfetivo(c)
          return rec > 0 ? formatCurrency(rec) : '—'
        },
      },
      {
        key: 'saldo',
        header: 'Saldo (R$)',
        align: 'right',
        className: 'font-mono font-bold whitespace-nowrap',
        render: (c) => {
          const saldo = getSaldoRestante(c)
          return saldo > 0 ? formatCurrency(saldo) : 'R$ 0,00'
        },
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (c) => {
          const st = getContaStatusReal(c)
          return (
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                st === 'Recebida'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : st === 'Vencida'
                    ? 'bg-red-50 text-red-800 border border-red-300'
                    : st === 'Parcial'
                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
                      : st === 'Recebimento Antecipado'
                        ? 'bg-teal-50 text-teal-800 border border-teal-300'
                        : 'bg-blue-50 text-blue-900 border border-blue-300'
              }`}
            >
              {st}
            </span>
          )
        },
      },
    ]
  }, [])

  // Opções memoizadas para ComboboxPesquisavel
  const clientesOptions = useMemo(() => {
    return [
      { id: 'none', label: 'Nenhum / Não informado' },
      ...clientes.map((cli) => ({
        id: cli.id,
        label: cli.nome,
        sublabel: cli.cnpj_cpf || cli.cidade || undefined,
      })),
    ]
  }, [clientes])

  const centrosCustoOptions = useMemo(() => {
    return [
      { id: 'none', label: 'Nenhum / Não alocado' },
      ...centrosCusto.map((cc) => ({
        id: cc.id,
        label: `${cc.codigo} - ${cc.nome}`,
      })),
    ]
  }, [centrosCusto])

  const centrosCustoFiltroOptions = useMemo(() => {
    return [
      { id: 'todos', label: 'Todos os Centros de Custo' },
      ...centrosCusto.map((cc) => ({
        id: cc.id,
        label: `${cc.codigo} - ${cc.nome}`,
      })),
    ]
  }, [centrosCusto])

  const categoriasOptions = useMemo(() => {
    return categorias.map((cat) => ({
      id: cat.id,
      label: `${cat.codigo} - ${cat.nome}`,
      sublabel: cat.tipo,
    }))
  }, [categorias])

  const formasRecebimentoFormOptions = useMemo(() => {
    if (formasCadastradas.length > 0) {
      return formasCadastradas.map((f) => ({ id: f.nome, label: f.nome }))
    }
    return FORMAS_RECEBIMENTO_PADRAO.map((f) => ({ id: f, label: f }))
  }, [formasCadastradas])

  const formasRecebimentoSettleOptions = useMemo(() => {
    if (usarCreditoCliente) {
      return [
        {
          id: 'Crédito do Cliente',
          label: 'Crédito do Cliente (Saldo Antecipado)',
        },
      ]
    }
    const base =
      formasCadastradas.length > 0
        ? formasCadastradas.map((f) => ({ id: f.nome, label: f.nome }))
        : FORMAS_RECEBIMENTO_PADRAO.map((f) => ({ id: f, label: f }))
    return [
      ...base,
      {
        id: 'Crédito do Cliente',
        label: 'Crédito do Cliente (Saldo Antecipado)',
      },
    ]
  }, [usarCreditoCliente, formasCadastradas])

  // Totalizadores do rodapé do relatório
  const totalizadoresRelatorioReceber = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaValor = itensParaImpressao.reduce((acc, c) => acc + (c.valor || 0), 0)
    const somaDesc = itensParaImpressao.reduce((acc, c) => acc + (c.valor_desconto || 0), 0)
    const somaRecebido = itensParaImpressao.reduce((acc, c) => acc + getValorRecebidoEfetivo(c), 0)
    const somaSaldo = itensParaImpressao.reduce((acc, c) => acc + getSaldoRestante(c), 0)

    return [
      {
        label: 'TOTAIS:',
        value: `${itensParaImpressao.length} item(ns)`,
        colSpan: 6,
        align: 'left',
      },
      {
        label: '',
        value: formatCurrency(somaValor),
        colSpan: 1,
        align: 'right',
        className: 'text-gray-900',
      },
      {
        label: '',
        value: somaDesc > 0 ? formatCurrency(somaDesc) : '—',
        colSpan: 1,
        align: 'right',
        className: 'text-amber-800',
      },
      {
        label: '',
        value: formatCurrency(somaRecebido),
        colSpan: 1,
        align: 'right',
        className: 'text-emerald-800',
      },
      {
        label: '',
        value: formatCurrency(somaSaldo),
        colSpan: 1,
        align: 'right',
        className: 'text-teal-950 font-extrabold',
      },
      {
        label: '',
        value: '',
        colSpan: 1,
        align: 'center',
      },
    ]
  }, [itensParaImpressao])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Receber</h1>
          <p className="text-xs text-gray-500">Gestão de faturamento, recebíveis e clientes</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setHistoricoModalOpen(true)}
            className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl shadow-xs"
            title="Ver trilha de auditoria e histórico de todas as modificações"
          >
            <History className="w-4 h-4 mr-1.5 text-teal-700" />
            Trilha de Auditoria
          </Button>

          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-teal-700" />
              Importar Planilha XLSX
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Conta a Receber
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Recebido</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalRecebido)}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Aberto</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalAberto)}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Vencido</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalVencido)}
          </p>
        </Card>

        <Card className="rounded-2xl border-teal-200 bg-teal-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800 uppercase">
              Recebimento Antecipado
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-teal-900 mt-2 font-mono">
            {formatCurrency(totalAntecipado)}
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 space-y-3">
        {/* Linha 1: Status e busca rápida */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(
              [
                'Todas',
                'Aberta',
                'Parcial',
                'Recebida',
                'Vencida',
                'Recebimento Antecipado',
              ] as const
            ).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {st === 'Todas'
                  ? 'Todos os Status'
                  : st === 'Parcial'
                    ? 'Parciais'
                    : st === 'Recebimento Antecipado'
                      ? 'Antecipados'
                      : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Centro de Custo Filter pesquisável */}
            <div className="w-full sm:w-[220px]">
              <ComboboxPesquisavel
                value={centroCustoFilter}
                onChange={(val) => setCentroCustoFilter(val || 'todos')}
                options={centrosCustoFiltroOptions}
                placeholder="Centro de Custo"
                searchPlaceholder="Pesquisar centro de custo..."
                emptyText="Nenhum centro encontrado"
                className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Filtro de Período (Opções Rápidas + De / Até) com seleção de campo de data e botão limpar */}
        <div className="pt-2 border-t border-[#ECEAE4] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center text-gray-600 font-medium text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1 text-teal-700" />
              Filtrar por período:
            </span>

            <Select value={campoDataFiltro} onValueChange={(v: any) => setCampoDataFiltro(v)}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento">Vencimento</SelectItem>
                <SelectItem value="data_emissao">Data de Emissão</SelectItem>
                <SelectItem value="data_recebimento">Data de Recebimento</SelectItem>
              </SelectContent>
            </Select>

            {/* Opções Rápidas */}
            <div className="flex items-center gap-1 bg-[#FAF9F7] p-0.5 rounded-lg border border-[#ECEAE4]">
              {[
                { id: 'todos', label: 'Todo o período' },
                { id: 'este_mes', label: 'Este mês' },
                { id: 'mes_passado', label: 'Mês passado' },
                { id: 'este_ano', label: 'Este ano' },
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => handleSelecionarPeriodoRapido(op.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    opcaoPeriodoRapido === op.id
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-gray-400 text-[11px]">De:</span>
              <Input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => {
                  setOpcaoPeriodoRapido('custom')
                  setDataInicioFilter(e.target.value)
                }}
                className="w-36 h-8 text-xs font-mono bg-[#FAF9F7] border-[#ECEAE4] rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">Até:</span>
              <Input
                type="date"
                value={dataFimFilter}
                onChange={(e) => {
                  setOpcaoPeriodoRapido('custom')
                  setDataFimFilter(e.target.value)
                }}
                className="w-36 h-8 text-xs font-mono bg-[#FAF9F7] border-[#ECEAE4] rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingImpressao}
              onClick={handleAbrirRelatorioImpressao}
              className={`h-8 px-2.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                selectedIds.length > 0
                  ? 'bg-teal-700 text-white hover:bg-teal-800 border-teal-700'
                  : 'border-teal-300 text-teal-800 bg-teal-50/60 hover:bg-teal-100/80 hover:text-teal-950'
              }`}
              title={
                selectedIds.length > 0
                  ? `Imprimir os ${selectedIds.length} recebimentos selecionados`
                  : 'Imprimir relatório dos recebimentos filtrados'
              }
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {loadingImpressao
                ? 'Carregando relatório...'
                : selectedIds.length > 0
                  ? `Imprimir Selecionados (${selectedIds.length})`
                  : 'Imprimir'}
            </Button>
            {(statusFilter !== 'Todas' ||
              centroCustoFilter !== 'todos' ||
              dataInicioFilter ||
              dataFimFilter ||
              searchQuery ||
              selectedIds.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimparFiltros}
                className="h-8 px-2 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table / Cards List */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        {/* Barra superior de paginação e contagem */}
        <div className="px-4 py-2.5 bg-[#FAF9F7] border-b border-[#ECEAE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">
              {totalItems} {totalItems === 1 ? 'registro' : 'registros'}
            </span>
            {totalItems > 0 && (
              <span className="text-gray-400">
                · Página {currentPage} de {totalPages} (50 por página)
              </span>
            )}
            {loading && (
              <span className="text-teal-700 animate-pulse font-medium">
                · Atualizando dados...
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || loading}
                onClick={() => handlePageChange(currentPage - 1)}
                className="h-7 px-2 text-xs border-gray-200"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1
                  if (totalPages > 5) {
                    if (currentPage > 3 && currentPage < totalPages - 2) {
                      pageNum = currentPage - 2 + i
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      disabled={loading}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || loading}
                onClick={() => handlePageChange(currentPage + 1)}
                className="h-7 px-2 text-xs border-gray-200"
              >
                Próxima
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-2.5 px-2 text-center w-8">
                  <Checkbox
                    checked={
                      filteredContas.length > 0 && selectedIds.length === filteredContas.length
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Selecionar todas as contas a receber visíveis"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Vencimento</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Emissão</th>
                <th className="py-2.5 px-2.5 min-w-[140px]">Cliente / Pagador</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Cidade</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Forma</th>
                <th className="py-2.5 px-2 whitespace-nowrap">C. Custo</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Valor Total</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Recebido</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Saldo</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-32">Doc / NF</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400">
                    Nenhuma conta a receber encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const displayStatus = getContaStatusReal(c)
                  const jaRecebido = getValorRecebidoEfetivo(c)
                  const saldoRestante = getSaldoRestante(c)
                  const nomeCliente = c.expand?.cliente_id?.nome || ''
                  const temDescricao = Boolean(c.descricao && c.descricao.trim())
                  const isSelected = selectedIds.includes(c.id)

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailItem(c)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50/60 hover:bg-teal-50/80' : 'hover:bg-teal-50/20'
                      }`}
                    >
                      {/* Checkbox de seleção */}
                      <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(c.id)}
                          aria-label={`Selecionar recebimento ${c.descricao || nomeCliente}`}
                          className="border-gray-300"
                        />
                      </td>

                      {/* Vencimento */}
                      <td className="py-2 px-2.5 font-mono font-medium text-gray-800 whitespace-nowrap text-xs">
                        {formatDate(c.vencimento)}
                      </td>

                      {/* Emissão */}
                      <td className="py-2 px-2.5 font-mono text-gray-500 whitespace-nowrap text-xs">
                        {c.data_emissao ? formatDate(c.data_emissao) : '—'}
                      </td>

                      {/* Cliente / Descrição */}
                      <td className="py-2 px-2.5 max-w-[240px]">
                        <div className="flex flex-col">
                          <span
                            className="font-semibold text-gray-900 truncate text-xs"
                            title={nomeCliente || c.descricao || 'Cliente não informado'}
                          >
                            {nomeCliente || (temDescricao ? c.descricao : '—')}
                          </span>
                          {c.cliente_depositante && (
                            <span
                              className="inline-block mt-0.5 max-w-[200px] truncate text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded font-medium border border-teal-100"
                              title={`Depositante: ${c.cliente_depositante}`}
                            >
                              Depositante: {c.cliente_depositante}
                            </span>
                          )}
                          {temDescricao && nomeCliente && (
                            <span
                              className="text-[11px] text-gray-500 truncate mt-0.5"
                              title={c.descricao}
                            >
                              {c.descricao}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cidade / Endereço */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                        {c.endereco ? (
                          <span className="truncate max-w-[100px] inline-block" title={c.endereco}>
                            {c.endereco}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Forma de Recebimento */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                        {c.forma_recebimento ? (
                          <span className="text-gray-700">{c.forma_recebimento}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Centro de Custo */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                        {c.expand?.centro_custo_id ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded"
                            title={`${c.expand.centro_custo_id.codigo} - ${c.expand.centro_custo_id.nome}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: c.expand.centro_custo_id.cor || '#0F766E' }}
                            />
                            {c.expand.centro_custo_id.codigo}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Valor Total / Líquido */}
                      <td className="py-2 px-2.5 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap text-xs">
                        <div>{formatCurrency(c.valor)}</div>
                        {c.valor_desconto && c.valor_desconto > 0 ? (
                          <div className="text-[10px] text-amber-700 font-normal flex items-center justify-end gap-1">
                            <span>Desc: -{formatCurrency(c.valor_desconto)}</span>
                            {c.desconto_percentual ? (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-semibold">
                                {c.desconto_percentual}%
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>

                      {/* Já Recebido */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap text-xs">
                        {jaRecebido > 0 ? (
                          formatCurrency(jaRecebido)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Saldo Restante */}
                      <td className="py-2 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap text-xs">
                        {saldoRestante > 0 ? (
                          <span
                            className={
                              c.vencimento.slice(0, 10) < nowISO && c.status === 'Aberta'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }
                          >
                            {formatCurrency(saldoRestante)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium text-[11px]">Quitado</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {(() => {
                          const isAtrasado =
                            c.vencimento.slice(0, 10) < nowISO &&
                            (c.status === 'Aberta' || c.status === 'Parcial')
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[11px] px-1.5 py-0 leading-tight font-medium ${
                                displayStatus === 'Recebida'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : displayStatus === 'Parcial'
                                    ? isAtrasado
                                      ? 'bg-amber-50 text-red-700 border-red-300 font-semibold'
                                      : 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                    : displayStatus === 'Recebimento Antecipado'
                                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-semibold'
                                      : isAtrasado
                                        ? 'bg-red-50 text-red-700 border-red-300 font-semibold'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {displayStatus}
                            </Badge>
                          )
                        })()}
                      </td>

                      {/* Doc / Nota */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {c.nota ? (
                          <span
                            className="inline-flex items-center justify-center w-28 px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold font-mono text-[11px] border border-gray-200/80 whitespace-nowrap text-center"
                            title={c.nota}
                          >
                            {c.nota}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-28 text-gray-300 text-center font-mono">
                            —
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td
                        className="py-2 px-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && displayStatus !== 'Recebida' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSettle(c)}
                              className="h-6 px-2 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {c.status === 'Parcial' ? 'Amortizar' : 'Receber'}
                            </Button>
                          )}
                          {canEdit &&
                            (displayStatus === 'Recebida' ||
                              (c.valor_recebido && c.valor_recebido > 0)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEstorno(c)}
                                className="h-6 px-2 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-50"
                                title="Estornar recebimento e reverter saldo"
                              >
                                <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                                Estornar
                              </Button>
                            )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleImprimirComprovante(c)}
                            className="h-6 w-6 p-0 text-teal-700 hover:text-teal-900 hover:bg-teal-50"
                            title="Imprimir Comprovante"
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(c)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-900"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDelete(c.id, c.descricao || c.expand?.cliente_id?.nome)
                              }
                              className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de paginação inferior */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-[#FAF9F7] border-t border-[#ECEAE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600">
            <span className="text-gray-500">
              Mostrando {contas.length} de {totalItems} registros (Página {currentPage} de{' '}
              {totalPages})
            </span>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || loading}
                onClick={() => handlePageChange(currentPage - 1)}
                className="h-7 px-2.5 text-xs border-gray-200"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1
                  if (totalPages > 5) {
                    if (currentPage > 3 && currentPage < totalPages - 2) {
                      pageNum = currentPage - 2 + i
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      disabled={loading}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || loading}
                onClick={() => handlePageChange(currentPage + 1)}
                className="h-7 px-2.5 text-xs border-gray-200"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição (opcional)</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional — identificador ou detalhe do título"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nota / Documento</Label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex: NF 90566 ou Doc 91721"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Cidade / Endereço</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: PATOS ou SJE"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Cliente</Label>
              <ComboboxPesquisavel
                value={clienteId}
                onChange={setClienteId}
                placeholder="Pesquisar ou selecionar cliente..."
                searchPlaceholder="Digitar nome do cliente..."
                emptyText="Nenhum cliente encontrado."
                className="mt-1"
                options={clientesOptions}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Cliente Depositante (Opcional)
              </Label>
              <Input
                value={clienteDepositante}
                onChange={(e) => setClienteDepositante(e.target.value)}
                placeholder="Ex: Nome da pessoa ou empresa que realizou o depósito"
                list="clientes-depositantes-list"
                className="mt-1"
              />
              <datalist id="clientes-depositantes-list">
                {clientes.map((cli) => (
                  <option key={cli.id} value={cli.nome} />
                ))}
              </datalist>
              <p className="text-[11px] text-gray-500 mt-1">
                Preencha caso o depósito/transferência tenha sido feito por um terceiro diferente do
                cliente comprador.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Centro de Custo</Label>
                <ComboboxPesquisavel
                  value={centroCustoId}
                  onChange={setCentroCustoId}
                  placeholder="Selecione o centro..."
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado."
                  className="mt-1"
                  options={centrosCustoOptions}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Categoria Contábil</Label>
                <ComboboxPesquisavel
                  value={categoriaId}
                  onChange={setCategoriaId}
                  placeholder="Selecione a categoria..."
                  searchPlaceholder="Buscar categoria..."
                  emptyText="Nenhuma categoria encontrada."
                  className="mt-1"
                  options={categoriasOptions}
                />
              </div>
            </div>

            {/* Valor Bruto e Datas */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Bruto (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={valorBruto || ''}
                  onChange={(e) => handleChangeValorBruto(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Data de Emissão</Label>
                <Input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  {editingId || parcelas <= 1 ? 'Vencimento *' : '1º Vencimento *'}
                </Label>
                <Input
                  type="date"
                  required
                  value={vencimento}
                  onChange={(e) => handleChangeVencimentoBase(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Forma de Recebimento</Label>
                <div className="mt-1">
                  <ComboboxPesquisavel
                    options={formasRecebimentoFormOptions}
                    value={formaRecebimentoForm}
                    onChange={(val) => {
                      setFormaRecebimentoForm(val)
                      if (val === 'A Prazo' && Number(parcelas) <= 1 && !editingId) {
                        setParcelas(2)
                        setGradeParcelas(
                          gerarGradeParcelas(vencimento, 2, prazoSelecionado, valorLiquidoCalc),
                        )
                      } else if (
                        val === 'Cheque Pré-datado' &&
                        chequesPredatadosForm.length === 0
                      ) {
                        setChequesPredatadosForm([
                          {
                            data: vencimento || toInputDate(new Date().toISOString()),
                            valor: valorLiquidoCalc > 0 ? valorLiquidoCalc : 0,
                            numero: '',
                            banco: '',
                          },
                        ])
                      }
                    }}
                    placeholder="Selecione a forma..."
                    searchPlaceholder="Buscar forma de recebimento..."
                    emptyText="Nenhuma forma encontrada"
                  />
                </div>
              </div>
            </div>

            {/* Painel / Aba de Cheques Pré-datados */}
            {formaRecebimentoForm === 'Cheque Pré-datado' && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-700" />
                      Aba de Cheques Pré-datados ({chequesPredatadosForm.length})
                    </span>
                    <p className="text-[11px] text-amber-700/90 mt-0.5">
                      Cadastre as datas de compensação, valores e números de cada cheque
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const totalAtual = chequesPredatadosForm.reduce(
                        (acc, c) => acc + (Number(c.valor) || 0),
                        0,
                      )
                      const restante = Math.max(0, valorLiquidoCalc - totalAtual)
                      setChequesPredatadosForm([
                        ...chequesPredatadosForm,
                        {
                          data: vencimento || toInputDate(new Date().toISOString()),
                          valor: restante,
                          numero: '',
                          banco: '',
                        },
                      ])
                    }}
                    className="h-7 text-[11px] border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 rounded-lg"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Cheque
                  </Button>
                </div>

                {chequesPredatadosForm.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-amber-800 bg-white/70 rounded-lg border border-amber-200">
                    Nenhum cheque cadastrado. Clique em "Adicionar Cheque" acima.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chequesPredatadosForm.map((chk, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white border border-amber-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                      >
                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-gray-500 block mb-0.5">
                            Data / Vencimento
                          </Label>
                          <Input
                            type="date"
                            required
                            value={chk.data}
                            onChange={(e) => {
                              const arr = [...chequesPredatadosForm]
                              arr[idx].data = e.target.value
                              setChequesPredatadosForm(arr)
                            }}
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-gray-500 block mb-0.5">
                            Valor (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={chk.valor || ''}
                            onChange={(e) => {
                              const arr = [...chequesPredatadosForm]
                              arr[idx].valor = parseFloat(e.target.value) || 0
                              setChequesPredatadosForm(arr)
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="0,00"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-gray-500 block mb-0.5">
                            Nº Cheque
                          </Label>
                          <Input
                            value={chk.numero}
                            onChange={(e) => {
                              const arr = [...chequesPredatadosForm]
                              arr[idx].numero = e.target.value
                              setChequesPredatadosForm(arr)
                            }}
                            placeholder="Opcional"
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-gray-500 block mb-0.5">
                            Banco / Emissor
                          </Label>
                          <Input
                            value={chk.banco}
                            onChange={(e) => {
                              const arr = [...chequesPredatadosForm]
                              arr[idx].banco = e.target.value
                              setChequesPredatadosForm(arr)
                            }}
                            placeholder="Ex: BB, Itaú"
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end items-end pt-3 sm:pt-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const arr = chequesPredatadosForm.filter((_, i) => i !== idx)
                              setChequesPredatadosForm(arr)
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="Remover cheque"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Resumo de totais dos cheques */}
                    {(() => {
                      const totalCheques = chequesPredatadosForm.reduce(
                        (acc, c) => acc + (Number(c.valor) || 0),
                        0,
                      )
                      const dif = Math.abs(totalCheques - valorLiquidoCalc)
                      const divergente = dif > 0.01 && valorLiquidoCalc > 0

                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] p-2 bg-amber-100/60 rounded-lg text-amber-950 font-medium gap-1">
                          <div className="flex items-center gap-2">
                            <span>Total dos Cheques: {formatCurrency(totalCheques)}</span>
                            <span>•</span>
                            <span>Valor do Título: {formatCurrency(valorLiquidoCalc)}</span>
                          </div>
                          {divergente && (
                            <span className="text-amber-800 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Divergência de {formatCurrency(dif)} (não bloqueia gravação)
                            </span>
                          )}
                          {!divergente && valorLiquidoCalc > 0 && (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Soma dos cheques confere
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Bloco de Desconto */}
            <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-xs">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Desconto no Título</span>
                </div>
                {/* Seletor Tipo: Percentual (%) ou Valor (R$) */}
                <div className="inline-flex rounded-lg border border-amber-300 bg-white p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoDesconto('percentual')
                      const vb = Number(valorBruto || 0)
                      if (vb > 0 && descontoValor > 0) {
                        const perc = Number(((descontoValor / vb) * 100).toFixed(2))
                        setDescontoPercentual(Math.min(100, perc))
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tipoDesconto === 'percentual'
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoDesconto('valor')
                      const vb = Number(valorBruto || 0)
                      if (vb > 0 && descontoPercentual > 0) {
                        const val = Number(((vb * descontoPercentual) / 100).toFixed(2))
                        setDescontoValor(Math.min(vb, val))
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tipoDesconto === 'valor'
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Valor (R$)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                {tipoDesconto === 'percentual' ? (
                  <div className="space-y-1">
                    <Label className="text-gray-700 font-medium text-[11px]">
                      Percentual de Desconto (0–100%)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={descontoPercentual || ''}
                        onChange={(e) => {
                          const perc = parseFloat(e.target.value) || 0
                          setDescontoPercentual(perc)
                          const vb = Number(valorBruto || 0)
                          const desc = Number(
                            ((vb * Math.min(100, Math.max(0, perc))) / 100).toFixed(2),
                          )
                          const liq = Number(Math.max(0, vb - desc).toFixed(2))
                          sincronizarGradeComLiquido(liq)
                        }}
                        placeholder="0.00"
                        className="bg-white border-amber-300 text-xs h-8 font-mono pr-7"
                      />
                      <Percent className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-gray-700 font-medium text-[11px]">
                      Valor do Desconto (R$)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Number(valorBruto || 0)}
                        value={descontoValor || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setDescontoValor(val)
                          const vb = Number(valorBruto || 0)
                          const desc = Number(Math.min(vb, Math.max(0, val)).toFixed(2))
                          const liq = Number(Math.max(0, vb - desc).toFixed(2))
                          sincronizarGradeComLiquido(liq)
                        }}
                        placeholder="0,00"
                        className="bg-white border-amber-300 text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="text-right pb-1">
                  <span className="text-[10px] text-gray-500 block uppercase">
                    Desconto Concedido
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-800">
                    {valorDescontoCalc > 0 ? `− ${formatCurrency(valorDescontoCalc)}` : 'R$ 0,00'}
                  </span>
                </div>
              </div>

              {/* Box de Totais em Tempo Real */}
              <div className="pt-2 border-t border-amber-200/80 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-medium">
                    Valor Bruto
                  </span>
                  <span className="text-xs font-mono font-semibold text-gray-800">
                    {formatCurrency(Number(valorBruto || 0))}
                  </span>
                </div>
                <div className="bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-800 uppercase block font-medium">
                    Desconto
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900">
                    {valorDescontoCalc > 0 ? `− ${formatCurrency(valorDescontoCalc)}` : 'R$ 0,00'}
                  </span>
                </div>
                <div className="bg-teal-50 p-2 rounded-lg border border-teal-200">
                  <span className="text-[10px] text-teal-800 uppercase block font-bold">
                    Valor Líquido
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-900">
                    {formatCurrency(valorLiquidoCalc)}
                  </span>
                </div>
              </div>
            </div>

            {!editingId && (
              <SeletorParcelas
                parcelas={parcelas}
                onChangeParcelas={handleChangeNumParcelas}
                prazoSelecionado={prazoSelecionado}
                onSelecionarPrazo={handleSelecionarPrazoRapido}
                listaParcelas={gradeParcelas}
                onChangeDataParcela={handleChangeDataParcelaIndividual}
                valorTotal={valorLiquidoCalc}
              />
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Situação / Status *</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta (A Receber no Vencimento)</SelectItem>
                  <SelectItem value="Recebida">Recebida (Baixada)</SelectItem>
                  <SelectItem value="Recebimento Antecipado">
                    Recebimento Antecipado (Gera Crédito ao Cliente)
                  </SelectItem>
                  <SelectItem value="Vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
              {status === 'Recebimento Antecipado' && (
                <p className="text-[11px] text-teal-700 mt-1">
                  💡 Um saldo de crédito equivalente será adicionado à conta do cliente para ser
                  abatido em futuras entregas/vendas.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes da cobrança, notas fiscais, contrato..."
                className="mt-1"
              />
            </div>

            <SheetFooter className="pt-4 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setIsDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Título'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Settle (Receber) Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Registrar Recebimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {settlingConta && (
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <div className="font-semibold text-gray-900 text-sm">
                  {settlingConta.expand?.cliente_id?.nome ||
                    settlingConta.descricao ||
                    'Título a Receber'}
                </div>
                {settlingConta.descricao && settlingConta.expand?.cliente_id?.nome && (
                  <div className="text-gray-500 text-xs">
                    Descrição:{' '}
                    <span className="font-medium text-gray-800">{settlingConta.descricao}</span>
                  </div>
                )}
                <div className="text-gray-500">
                  Cliente:{' '}
                  <span className="font-medium text-gray-800">
                    {settlingConta.expand?.cliente_id?.nome || 'Não informado'}
                  </span>
                  {settlingConta.nota && (
                    <span className="ml-2 font-mono text-[11px] bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">
                      Doc: {settlingConta.nota}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#ECEAE4] text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                      Valor Total
                    </span>
                    <strong className="text-gray-900 font-mono text-xs">
                      {formatCurrency(settlingConta.valor)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold block">
                      Já Recebido
                    </span>
                    <strong className="text-emerald-700 font-mono text-xs">
                      {formatCurrency(getValorRecebidoEfetivo(settlingConta))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">
                      Saldo em Aberto
                    </span>
                    <strong className="text-amber-800 font-mono text-xs">
                      {formatCurrency(getSaldoRestante(settlingConta))}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Data de Recebimento *</Label>
              <Input
                type="date"
                required
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">
                  Valor Desta Baixa (R$) *
                </Label>
                {settlingConta && (
                  <button
                    type="button"
                    onClick={() => {
                      const saldo = getSaldoRestante(settlingConta)
                      setValorRecebido(saldo)
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                  >
                    Quitar Saldo Total (
                    {settlingConta ? formatCurrency(getSaldoRestante(settlingConta)) : ''})
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valorRecebido || ''}
                onChange={(e) => setValorRecebido(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono text-base font-bold text-gray-900"
              />
              {settlingConta && (
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {Number(valorRecebido) < getSaldoRestante(settlingConta) ? (
                    <span className="text-amber-700 font-medium">
                      ⚠️ Baixa parcial: restará um saldo em aberto de{' '}
                      <strong>
                        {formatCurrency(
                          Math.max(0, getSaldoRestante(settlingConta) - Number(valorRecebido)),
                        )}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      ✓ Quitação integral do saldo restante
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Opção: Usar Crédito do Cliente */}
            {totalCreditoDisponivelCliente > 0 && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usarCreditoCliente}
                    onChange={(e) => {
                      const chk = e.target.checked
                      setUsarCreditoCliente(chk)
                      if (chk) {
                        const saldo = settlingConta ? getSaldoRestante(settlingConta) : 0
                        const valorAbater = Math.min(saldo, totalCreditoDisponivelCliente)
                        setValorCreditoUsado(valorAbater)
                        setValorRecebido(valorAbater)
                        setFormaRecebimento('Crédito do Cliente' as any)
                      } else {
                        setValorCreditoUsado(0)
                        setFormaRecebimento('Pix')
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-emerald-950 text-xs">
                    Usar Crédito Disponível deste Cliente (Saldo:{' '}
                    {formatCurrency(totalCreditoDisponivelCliente)})
                  </span>
                </label>

                {usarCreditoCliente && (
                  <div className="space-y-2 pt-1 border-t border-emerald-200">
                    <div>
                      <Label className="text-[11px] text-emerald-900 font-medium">
                        Valor do Crédito a Utilizar (R$):
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        max={Math.min(
                          settlingConta ? getSaldoRestante(settlingConta) : 0,
                          totalCreditoDisponivelCliente,
                        )}
                        value={valorCreditoUsado}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setValorCreditoUsado(val)
                          setValorRecebido(val)
                        }}
                        className="mt-1 font-mono font-bold text-emerald-900 h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Forma de Recebimento</Label>
              <div className="mt-1">
                <ComboboxPesquisavel
                  options={formasRecebimentoSettleOptions}
                  value={formaRecebimento}
                  onChange={(v) => setFormaRecebimento(v)}
                  placeholder="Selecione a forma..."
                  searchPlaceholder="Buscar forma de recebimento..."
                  emptyText="Nenhuma forma encontrada"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setSettleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSettle}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Read-Only Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Detalhes da Conta a Receber
            </SheetTitle>
          </SheetHeader>

          {detailItem && (
            <div className="py-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100 text-center">
                <div>
                  <span className="text-[10px] text-teal-700 font-semibold uppercase block">
                    Valor Líquido
                  </span>
                  <div className="text-lg font-bold text-teal-950 mt-0.5 tabular-nums">
                    {formatCurrency(detailItem.valor)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase block">
                    Recebido
                  </span>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5 tabular-nums">
                    {formatCurrency(getValorRecebidoEfetivo(detailItem))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-semibold uppercase block">
                    Saldo Restante
                  </span>
                  <div className="text-lg font-bold text-amber-900 mt-0.5 tabular-nums">
                    {formatCurrency(getSaldoRestante(detailItem))}
                  </div>
                </div>
              </div>

              {/* Informações de Desconto nos Detalhes */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-medium">
                    Valor Bruto
                  </span>
                  <span className="font-semibold font-mono text-gray-900">
                    {formatCurrency(detailItem.valor_bruto || detailItem.valor)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-800 uppercase block font-semibold">
                    Desconto
                  </span>
                  <span className="font-bold font-mono text-amber-900">
                    {detailItem.valor_desconto && detailItem.valor_desconto > 0
                      ? `− ${formatCurrency(detailItem.valor_desconto)} (${detailItem.desconto_percentual ? `${detailItem.desconto_percentual}%` : detailItem.tipo_desconto === 'percentual' ? '%' : 'R$'})`
                      : 'Nenhum'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#ECEAE4] pt-4">
                {detailItem.descricao && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Descrição:</span>
                    <span className="font-semibold text-gray-900">{detailItem.descricao}</span>
                  </div>
                )}
                {detailItem.nota && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Nota / Documento:</span>
                    <span className="font-mono font-semibold text-gray-800">{detailItem.nota}</span>
                  </div>
                )}
                {detailItem.endereco && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Cidade / Endereço:</span>
                    <span className="font-medium text-gray-800">{detailItem.endereco}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.cliente_id?.nome || 'Não informado'}
                  </span>
                </div>
                {detailItem.cliente_depositante && (
                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-teal-50/70 border border-teal-200 rounded-lg">
                    <span className="text-teal-800 font-semibold text-[11px]">
                      Cliente Depositante:
                    </span>
                    <span className="font-bold text-teal-950 text-xs">
                      {detailItem.cliente_depositante}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Categoria Contábil:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.categoria_id?.nome || 'Geral'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Data de Emissão:</span>
                  <span className="font-mono text-gray-800">
                    {detailItem.data_emissao ? formatDate(detailItem.data_emissao) : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Data de Vencimento:</span>
                  <span className="font-mono text-gray-800">
                    {formatDate(detailItem.vencimento)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Status:</span>
                  <Badge variant="outline">{detailItem.status}</Badge>
                </div>
                {detailItem.data_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Último Recebimento:</span>
                    <span className="font-mono text-emerald-700">
                      {formatDate(detailItem.data_recebimento)}
                    </span>
                  </div>
                )}
                {detailItem.forma_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Forma de Recebimento:</span>
                    <span className="text-gray-800 font-semibold">
                      {detailItem.forma_recebimento}
                    </span>
                  </div>
                )}
              </div>

              {/* Cheques Pré-datados Vinculados ao Título */}
              {(detailItem.forma_recebimento === 'Cheque Pré-datado' ||
                chequesDetail.length > 0) && (
                <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-700" />
                      Cheques Pré-datados ({chequesDetail.length})
                    </span>
                    <span className="text-[10px] text-amber-800">
                      Total:{' '}
                      {formatCurrency(
                        chequesDetail.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
                      )}
                    </span>
                  </div>

                  {loadingChequesDetail ? (
                    <div className="py-2 text-center text-[11px] text-amber-800">
                      Carregando cheques...
                    </div>
                  ) : chequesDetail.length === 0 ? (
                    <div className="text-[11px] text-amber-800 bg-white/70 p-2 rounded-lg border border-amber-200 text-center">
                      Nenhum cheque cadastrado para este título.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chequesDetail.map((chk) => (
                        <div
                          key={chk.id}
                          className="p-2.5 bg-white rounded-xl border border-amber-200/90 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-gray-900 font-mono">
                                {formatCurrency(chk.valor)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  chk.status === 'compensado'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {chk.status === 'compensado' ? 'Compensado' : 'Pendente'}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Venc:{' '}
                              <strong className="text-gray-800 font-mono">
                                {formatDate(chk.data)}
                              </strong>
                              {chk.numero && ` • Nº ${chk.numero}`}
                              {chk.banco && ` • Banco: ${chk.banco}`}
                            </div>
                            {chk.status === 'compensado' && chk.data_compensacao && (
                              <div className="text-[10px] text-emerald-700">
                                Compensado em: {formatDate(chk.data_compensacao)} (Entrada no caixa
                                gerada)
                              </div>
                            )}
                          </div>

                          {canEdit && chk.status !== 'compensado' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleCompensarCheque(chk)}
                              disabled={isSubmitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 rounded-lg shrink-0 shadow-xs"
                            >
                              <CheckSquare className="w-3.5 h-3.5 mr-1" />
                              Compensar
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailItem.observacoes && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] mt-4">
                  <span className="font-semibold text-gray-700 block mb-1">Observações:</span>
                  <p className="text-gray-600 whitespace-pre-wrap">{detailItem.observacoes}</p>
                </div>
              )}

              {/* Seção de Histórico de Alterações do Título */}
              {detailItem && (
                <div className="border-t border-[#ECEAE4] pt-4 mt-2">
                  <HistoricoSecao
                    registroId={detailItem.id}
                    colecaoOrigem="contas_receber"
                    tituloDescricao={detailItem.descricao}
                  />
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleImprimirComprovante(detailItem)}
                  className="w-full border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl"
                >
                  <Printer className="w-4 h-4 mr-2 text-teal-700" />
                  Imprimir Comprovante
                </Button>

                {canEdit && detailItem.status !== 'Recebida' && (
                  <Button
                    onClick={() => {
                      const item = detailItem
                      setDetailItem(null)
                      handleOpenSettle(item)
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    {detailItem.status === 'Parcial'
                      ? 'Registrar Nova Baixa / Quitar'
                      : 'Receber Título Agora'}
                  </Button>
                )}

                {canEdit &&
                  (detailItem.status === 'Recebida' ||
                    (detailItem.valor_recebido && detailItem.valor_recebido > 0)) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const item = detailItem
                        handleEstorno(item)
                      }}
                      className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl"
                    >
                      <RotateCcw className="w-4 h-4 mr-2 text-amber-600" />
                      Estornar Recebimento
                    </Button>
                  )}

                {canEdit && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="border-[#ECEAE4] rounded-xl text-gray-700"
                      onClick={() => {
                        const item = detailItem
                        setDetailItem(null)
                        handleEdit(item)
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => {
                        handleDelete(
                          detailItem.id,
                          detailItem.descricao || detailItem.expand?.cliente_id?.nome,
                        )
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Diálogo de Confirmação Obrigatório */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4] max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              {confirmDialogData?.title || 'Confirmar ação'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              {confirmDialogData?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isSubmitting} className="text-xs rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async (e) => {
                e.preventDefault()
                if (confirmDialogData?.action) {
                  await confirmDialogData.action()
                }
                setConfirmDialogOpen(false)
              }}
              className={`text-xs rounded-xl text-white ${
                confirmDialogData?.confirmVariant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {isSubmitting ? 'Processando...' : confirmDialogData?.confirmLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Importador XLSX */}
      {importModalOpen && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-2 text-xs text-gray-600">
                <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                Carregando importador...
              </div>
            </div>
          }
        >
          <ImportadorRecebimentosModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            empresaId={currentEmpresa?.id || ''}
            clientes={clientes}
            categorias={categorias}
            centrosCusto={centrosCusto}
            contasExistentes={contas}
            onImportComplete={loadData}
          />
        </React.Suspense>
      )}

      {/* Modal de Trilha de Auditoria Geral */}
      {historicoModalOpen && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-2 text-xs text-gray-600">
                <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                Carregando histórico...
              </div>
            </div>
          }
        >
          <HistoricoGeralModal
            open={historicoModalOpen}
            onOpenChange={setHistoricoModalOpen}
            empresaId={currentEmpresa?.id || ''}
            colecaoPadrao="contas_receber"
          />
        </React.Suspense>
      )}

      {/* Relatório de Impressão A4 das Contas a Receber */}
      {relatorioImpressaoOpen && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-2 text-xs text-gray-600">
                <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                Carregando relatório de impressão...
              </div>
            </div>
          }
        >
          <RelatorioListagemImpressaoModal
            open={relatorioImpressaoOpen}
            onOpenChange={setRelatorioImpressaoOpen}
            titulo="Contas a Receber — Relatório de Itens"
            subtitulo="Demonstrativo de Direitos Creditórios, Faturamento e Clientes"
            badgeDestaque="Contas a Receber"
            empresa={currentEmpresa}
            usuarioNome={user?.name || user?.email || 'Administrador'}
            filtrosDescricao={descricaoFiltrosAplicados}
            itens={itensParaImpressao}
            colunas={colunasRelatorioReceber}
            totais={totalizadoresRelatorioReceber}
            mensagemVazio="Nenhuma conta a receber encontrada para os filtros ou seleção atual."
          />
        </React.Suspense>
      )}
    </div>
  )
}
