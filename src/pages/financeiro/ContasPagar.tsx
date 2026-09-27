import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type {
  ContaPagar,
  Fornecedor,
  PlanoConta,
  CentroCusto,
  StatusContaPagar,
  FormaRecebimento,
  ChequePredatado,
} from '@/types/erp'
import {
  formasRecebimentoService,
  chequesPredatadosService,
  FORMAS_RECEBIMENTO_PADRAO,
} from '@/services/formasRecebimento'
import { historicoService, calcularDiffAlteracoes, CAMPOS_CONFIG_PAGAR } from '@/services/historico'
import { HistoricoSecao } from '@/components/financeiro/HistoricoSecao'
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
  Filter,
  CheckCircle,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  X,
  History,
  Printer,
  Tag,
  CheckSquare,
} from 'lucide-react'
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

const ImportadorContasPagarModal = React.lazy(() =>
  import('@/components/financeiro/ImportadorContasPagarModal').then((m) => ({
    default: m.ImportadorContasPagarModal,
  })),
)
const ConferirPlanilhaPagarModal = React.lazy(() =>
  import('@/components/financeiro/ConferirPlanilhaPagarModal').then((m) => ({
    default: m.ConferirPlanilhaPagarModal,
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

export default function ContasPagar() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contas, setContas] = useState<ContaPagar[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
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
    pago: 0,
  })

  // Impressão sob demanda
  const [loadingImpressao, setLoadingImpressao] = useState(false)
  const [itensImpressaoCarregados, setItensImpressaoCarregados] = useState<ContaPagar[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    'Todas' | 'Aberta' | 'Parcial' | 'Paga' | 'Vencida'
  >('Todas')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [campoDataFiltro, setCampoDataFiltro] = useState<
    'vencimento' | 'data_emissao' | 'data_pagamento'
  >('vencimento')
  const [dataInicioFilter, setDataInicioFilter] = useState('')
  const [dataFimFilter, setDataFimFilter] = useState('')
  const [opcaoPeriodoRapido, setOpcaoPeriodoRapido] = useState<string>('todos')

  const debouncedSearchQuery = useDebounce(searchQuery, 350)

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false)
  // Conferência Modal
  const [conferirModalOpen, setConferirModalOpen] = useState(false)
  // Histórico Geral Modal
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false)

  const nowISO = new Date().toISOString().slice(0, 10)

  // Cache de auxiliares (fornecedores, plano_contas, centros_custos, formas_recebimento) sob demanda
  const [auxiliaresLoaded, setAuxiliaresLoaded] = useState(false)
  const [loadingAuxiliares, setLoadingAuxiliares] = useState(false)

  // Drawer Create / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [fornecedorId, setFornecedorId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState<number>(0)
  const [dataEmissao, setDataEmissao] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [parcelas, setParcelas] = useState<number>(1)
  const [prazoSelecionado, setPrazoSelecionado] = useState<TipoPrazo>('mensal')
  const [gradeParcelas, setGradeParcelas] = useState<ItemParcela[]>([])
  const [datasCustomizadasManuais, setDatasCustomizadasManuais] = useState(false)
  const [status, setStatus] = useState<'Aberta' | 'Paga'>('Aberta')
  const [observacoes, setObservacoes] = useState('')
  const [formaPagamentoForm, setFormaPagamentoForm] = useState<string>('Pix')
  const [chequesPredatadosForm, setChequesPredatadosForm] = useState<
    Array<{
      id?: string
      data: string
      valor: number
      numero?: string
      banco?: string
    }>
  >([])

  // Settle (Baixar) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaPagar | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [valorPago, setValorPago] = useState<number>(0)
  const [formaPagamento, setFormaPagamento] = useState<string>('Pix')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirmation Alert Dialog State
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive'
    action: () => Promise<void>
  } | null>(null)

  // Read-only Detail Drawer
  const [detailItem, setDetailItem] = useState<ContaPagar | null>(null)
  const [chequesDetail, setChequesDetail] = useState<ChequePredatado[]>([])
  const [loadingChequesDetail, setLoadingChequesDetail] = useState(false)

  // Seleção múltipla para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Modal de Impressão do Relatório
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)

  useRealtime('contas_pagar', () => loadData())

  const loadAuxiliares = async () => {
    if (!currentEmpresa || auxiliaresLoaded || loadingAuxiliares) return
    try {
      setLoadingAuxiliares(true)
      const [fList, pcList, ccList, formasList] = await Promise.all([
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}' && (tipo = 'Despesa' || tipo = 'Custo')`,
          sort: 'codigo',
        }),
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        formasRecebimentoService.listar(currentEmpresa.id, true),
      ])
      setFornecedores(fList)
      setCategorias(pcList)
      setCentrosCusto(ccList)
      setFormasCadastradas(formasList)
      setAuxiliaresLoaded(true)
    } catch (err) {
      console.error('Error loading auxiliares contas a pagar:', err)
    } finally {
      setLoadingAuxiliares(false)
    }
  }

  // Construção de expressão de filtro PocketBase no servidor
  const buildPocketBaseFilter = useCallback(() => {
    if (!currentEmpresa) return ''
    const parts: string[] = [`empresa_id = '${currentEmpresa.id}'`]

    // Status filter
    if (statusFilter === 'Aberta') {
      parts.push(`status = 'Aberta' && vencimento >= '${nowISO}'`)
    } else if (statusFilter === 'Vencida') {
      parts.push(`(status = 'Vencida' || (status != 'Paga' && vencimento < '${nowISO}'))`)
    } else if (statusFilter === 'Parcial') {
      parts.push(`status = 'Parcial'`)
    } else if (statusFilter === 'Paga') {
      parts.push(`status = 'Paga'`)
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
          : 'data_pagamento'

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
        `(descricao ~ '${termo}' || fornecedor_id.nome ~ '${termo}' || observacoes ~ '${termo}')`,
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

  // Carrega a página paginada no servidor
  const loadData = async (targetPage?: number) => {
    if (!currentEmpresa) return

    const pageToLoad = targetPage !== undefined ? targetPage : currentPage

    try {
      setLoading(true)
      const serverFilter = buildPocketBaseFilter()

      const res = await pb.collection('contas_pagar').getList<ContaPagar>(pageToLoad, pageSize, {
        filter: serverFilter,
        sort: 'vencimento',
        expand: 'fornecedor_id,categoria_id,centro_custo_id',
      })

      setContas(res.items)
      setTotalPages(res.totalPages || 1)
      setTotalItems(res.totalItems || 0)
      setCurrentPage(res.page)

      // Handle query params e.g. ?novo=1 or ?id=xyz
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
          if (qAction === 'settle' && canEdit && found.status !== 'Paga') {
            handleOpenSettle(found)
          } else {
            setDetailItem(found)
          }
        }
      }
    } catch (err) {
      console.error('Error loading contas a pagar:', err)
    } finally {
      setLoading(false)
    }
  }

  // Agregação leve dos cards (consulta apenas id,valor,valor_pago,status,vencimento sob os filtros de período e centro)
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
            : 'data_pagamento'

      if (dataInicioFilter) {
        parts.push(`${dataCampo} >= '${dataInicioFilter} 00:00:00.000Z'`)
      }
      if (dataFimFilter) {
        parts.push(`${dataCampo} <= '${dataFimFilter} 23:59:59.999Z'`)
      }

      const rows = await pb
        .collection('contas_pagar')
        .getFullList<Pick<ContaPagar, 'id' | 'valor' | 'valor_pago' | 'status' | 'vencimento'>>({
          filter: parts.join(' && '),
          fields: 'id,valor,valor_pago,status,vencimento',
        })

      let aberto = 0
      let vencido = 0
      let pago = 0

      for (const r of rows) {
        const valTotal = Number(r.valor || 0)
        const valPago = Number(r.valor_pago || 0)
        const saldo = Math.max(0, valTotal - valPago)

        pago += valPago

        if (r.status === 'Paga') {
          // Já quitado
        } else {
          const isAtrasado = (r.vencimento ? r.vencimento.slice(0, 10) : '') < nowISO
          if (r.status === 'Vencida' || isAtrasado) {
            vencido += saldo
          } else {
            aberto += saldo
          }
        }
      }

      setTotaisCards({ aberto, vencido, pago })
    } catch (err) {
      console.warn('Erro ao carregar totais leves dos cards:', err)
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

  // Carregar cheques ao abrir detalhes do título a pagar
  const carregarChequesDoTitulo = async (tituloPagarId: string) => {
    try {
      setLoadingChequesDetail(true)
      const chks = await chequesPredatadosService.listarPorTituloPagar(tituloPagarId)
      setChequesDetail(chks)
    } catch (err) {
      console.warn('Erro ao carregar cheques do título a pagar:', err)
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

  const openCreateModal = () => {
    loadAuxiliares()
    const hoje = toInputDate(new Date().toISOString())
    setEditingId(null)
    setFornecedorId('')
    setCentroCustoId('')
    setDescricao('')
    setCategoriaId(categorias[0]?.id || '')
    setValor(0)
    setDataEmissao(hoje)
    setVencimento(hoje)
    setParcelas(1)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(hoje, 1, 'mensal', 0))
    setFormaPagamentoForm('Pix')
    setChequesPredatadosForm([])
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = async (c: ContaPagar) => {
    loadAuxiliares()
    const venc = toInputDate(c.vencimento)
    const emiss = c.data_emissao ? toInputDate(c.data_emissao) : ''
    const numP = c.parcelas || 1
    setEditingId(c.id)
    setFornecedorId(c.fornecedor_id || '')
    setCentroCustoId(c.centro_custo_id || '')
    setDescricao(c.descricao)
    setCategoriaId(c.categoria_id || '')
    setValor(c.valor)
    setDataEmissao(emiss)
    setVencimento(venc)
    setParcelas(numP)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(venc, numP, 'mensal', c.valor))
    setFormaPagamentoForm(c.forma_pagamento || 'Pix')
    setStatus(c.status === 'Paga' ? 'Paga' : 'Aberta')
    setObservacoes(c.observacoes || '')

    // Carregar cheques pré-datados se houver para este título a pagar
    try {
      const chks = await chequesPredatadosService.listarPorTituloPagar(c.id)
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

  // Handlers para o parcelamento
  const handleChangeVencimentoBase = (novaData: string) => {
    setVencimento(novaData)
    if (!editingId && !datasCustomizadasManuais) {
      setGradeParcelas(gerarGradeParcelas(novaData, parcelas, prazoSelecionado, valor))
    } else if (!editingId && gradeParcelas.length > 0) {
      // Atualiza ao menos a primeira parcela se o usuário mexer na data base
      setGradeParcelas((prev) =>
        prev.map((item, idx) => (idx === 0 ? { ...item, vencimento: novaData } : item)),
      )
    }
  }

  const handleChangeValorTotal = (novoValor: number) => {
    setValor(novoValor)
    if (!editingId && gradeParcelas.length > 0) {
      const n = gradeParcelas.length
      const unit = novoValor > 0 ? Number((novoValor / n).toFixed(2)) : 0
      setGradeParcelas((prev) =>
        prev.map((item, idx) => {
          let v = unit
          if (idx === n - 1 && novoValor > 0) {
            const somaAnt = unit * (n - 1)
            const diff = Number((novoValor - somaAnt).toFixed(2))
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

  // Função para resolver ou cadastrar fornecedor a partir do ID ou da descrição
  const resolverFornecedorId = async (
    fId: string,
    descTexto: string,
    empresaId: string,
  ): Promise<string | null> => {
    if (fId && fId !== 'none') {
      return fId
    }

    const nomeSugerido = descTexto.trim()
    if (!nomeSugerido) {
      return null
    }

    // Verificar se já existe algum fornecedor cadastrado com esse nome
    const fornExistente = fornecedores.find(
      (f) => f.nome.trim().toLowerCase() === nomeSugerido.toLowerCase(),
    )
    if (fornExistente) {
      return fornExistente.id
    }

    // Criar fornecedor automaticamente com o nome da descrição
    try {
      const novoForn = await pb.collection('fornecedores').create<Fornecedor>({
        empresa_id: empresaId,
        nome: nomeSugerido,
        observacoes: 'Cadastrado automaticamente a partir da descrição da Conta a Pagar',
      })
      setFornecedores((prev) => [...prev, novoForn])
      return novoForn.id
    } catch (err) {
      console.warn('Erro ao criar fornecedor automático com a descrição:', err)
      return null
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim() || valor <= 0 || !vencimento) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    const dataEmissaoIso = dataEmissao ? new Date(`${dataEmissao}T12:00:00Z`).toISOString() : null
    const acaoTexto = editingId ? 'atualizar esta conta a pagar' : 'gravar este novo lançamento'

    setConfirmDialogData({
      title: editingId
        ? 'Confirmar alteração de conta a pagar'
        : 'Confirmar criação de conta a pagar',
      description: `Deseja ${acaoTexto} no valor de ${formatCurrency(valor)} para "${descricao.trim()}" com vencimento em ${formatDate(vencimento)}?`,
      confirmLabel: editingId ? 'Atualizar Título' : 'Gravar Título',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)

          // Regra: se o fornecedor não for informado, preenche automaticamente com a descrição
          const finalFornecedorId = await resolverFornecedorId(
            fornecedorId,
            descricao,
            currentEmpresa!.id,
          )

          if (editingId) {
            // Update single record
            const registroAntes = contas.find((c) => c.id === editingId)
            const novoObj = {
              descricao: descricao.trim(),
              fornecedor_id: finalFornecedorId,
              categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
              centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
              valor: Number(valor),
              vencimento: new Date(vencimento).toISOString(),
              data_emissao: dataEmissaoIso,
              parcelas: Number(parcelas),
              status: status,
              forma_pagamento: formaPagamentoForm || null,
              observacoes: observacoes.trim(),
            }

            const updatedRecord = await pb
              .collection('contas_pagar')
              .update<ContaPagar>(editingId, novoObj)

            // Se for cheque pré-datado, salvar lote de cheques a pagar
            if (formaPagamentoForm === 'Cheque Pré-datado' && chequesPredatadosForm.length > 0) {
              await chequesPredatadosService.salvarLotePagar(
                currentEmpresa!.id,
                editingId,
                chequesPredatadosForm,
              )
            }

            // Gravar histórico de alteração com diff
            if (registroAntes) {
              const diffs = calcularDiffAlteracoes(registroAntes, novoObj, CAMPOS_CONFIG_PAGAR)
              const fornecedorNomeNovo =
                fornecedores.find((f) => f.id === finalFornecedorId)?.nome || descricao.trim()

              await historicoService.registrar({
                empresaId: currentEmpresa!.id,
                colecaoOrigem: 'contas_pagar',
                registroId: editingId,
                acao: 'editar',
                usuarioId: user?.id,
                usuarioNome: user?.name || user?.email || 'Usuário',
                descricao: `Título atualizado para "${descricao.trim()}" (${formatCurrency(Number(valor))}) - Fornecedor: ${fornecedorNomeNovo}. ${diffs.length > 0 ? `${diffs.length} campo(s) modificado(s).` : 'Sem alteração de campos chave.'}`,
                detalhes: {
                  alteracoes: diffs,
                  valor: Number(valor),
                },
              })
            }

            toast({ title: 'Conta a pagar atualizada!' })
          } else {
            // Multiple installments support com datas digitadas/calculadas
            const numParcelas = Math.max(1, Number(parcelas))

            const parcelasParaSalvar =
              gradeParcelas.length === numParcelas
                ? gradeParcelas
                : gerarGradeParcelas(vencimento, numParcelas, prazoSelecionado, valor)

            const fornecedorNomeCriado =
              fornecedores.find((f) => f.id === finalFornecedorId)?.nome || descricao.trim()

            for (let i = 0; i < parcelasParaSalvar.length; i++) {
              const item = parcelasParaSalvar[i]
              const dataVencIso = item.vencimento
                ? new Date(`${item.vencimento}T12:00:00Z`).toISOString()
                : new Date(vencimento).toISOString()

              const desc =
                numParcelas > 1 ? `${descricao.trim()} (${i + 1}/${numParcelas})` : descricao.trim()

              const valorParcelaNum =
                Number(item.valor) || Number(valor) / (numParcelas > 1 ? numParcelas : 1)

              const createdRecord = await pb.collection('contas_pagar').create<ContaPagar>({
                empresa_id: currentEmpresa!.id,
                descricao: desc,
                fornecedor_id: finalFornecedorId,
                categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
                centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
                valor: valorParcelaNum,
                vencimento: dataVencIso,
                data_emissao: dataEmissaoIso || undefined,
                parcelas: numParcelas,
                status: status,
                forma_pagamento: formaPagamentoForm || null,
                observacoes: observacoes.trim(),
              })

              // Se for cheque pré-datado na primeira parcela ou única, salvar cheques associados
              if (
                formaPagamentoForm === 'Cheque Pré-datado' &&
                chequesPredatadosForm.length > 0 &&
                i === 0
              ) {
                await chequesPredatadosService.salvarLotePagar(
                  currentEmpresa!.id,
                  createdRecord.id,
                  chequesPredatadosForm,
                )
              }

              // Gravar histórico de criação
              await historicoService.registrar({
                empresaId: currentEmpresa!.id,
                colecaoOrigem: 'contas_pagar',
                registroId: createdRecord.id,
                acao: 'criar',
                usuarioId: user?.id,
                usuarioNome: user?.name || user?.email || 'Usuário',
                descricao: `Título a pagar criado no valor de ${formatCurrency(valorParcelaNum)} com vencimento em ${formatDate(dataVencIso)} para "${fornecedorNomeCriado}".`,
                detalhes: {
                  valor: valorParcelaNum,
                  extra: {
                    parcela: `${i + 1}/${numParcelas}`,
                    descricao: desc,
                  },
                },
              })
            }
            toast({ title: 'Conta a pagar criada com sucesso!' })
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
    const descNome = descricaoAlvo || itemAlvo?.descricao || 'Título a pagar'
    const valTotal = itemAlvo?.valor || 0

    setConfirmDialogData({
      title: 'Confirmar exclusão de conta a pagar',
      description: `Deseja realmente excluir o título "${descNome}"? Esta ação removerá o registro e não poderá ser desfeita.`,
      confirmLabel: 'Excluir Título',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          // Registrar histórico de exclusão antes de deletar
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_pagar',
            registroId: id,
            acao: 'excluir',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Título "${descNome}" no valor de ${formatCurrency(valTotal)} foi excluído do sistema.`,
            detalhes: {
              valor: valTotal,
              extra: {
                descricao: descNome,
                fornecedor: itemAlvo?.expand?.fornecedor_id?.nome,
              },
            },
          })

          await pb.collection('contas_pagar').delete(id)
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

  const getValorPagoEfetivo = (c: ContaPagar) => {
    if (c.status === 'Paga') {
      return c.valor_pago && c.valor_pago > 0 ? c.valor_pago : c.valor
    }
    return c.valor_pago || 0
  }

  const getSaldoRestante = (c: ContaPagar) => {
    if (c.status === 'Paga') return 0
    const jaPago = getValorPagoEfetivo(c)
    return Math.max(0, (c.valor || 0) - jaPago)
  }

  const handleEstorno = (c: ContaPagar) => {
    const valorPagoAtual = getValorPagoEfetivo(c)
    if (valorPagoAtual <= 0 && c.status === 'Aberta') {
      toast({ title: 'Este título não possui baixas para estornar.', variant: 'destructive' })
      return
    }

    const fornecedorNome = c.expand?.fornecedor_id?.nome || c.descricao || 'Título'

    setConfirmDialogData({
      title: 'Confirmar estorno de pagamento',
      description: `Deseja estornar o pagamento de ${formatCurrency(valorPagoAtual)} pago para "${fornecedorNome}"? O título voltará para o status "Aberta", o valor pago e a data de pagamento serão zerados, e será lançado um movimento de caixa inverso (Entrada/Estorno) de mesmo valor para manter os saldos bancários e contábeis consistentes.`,
      confirmLabel: 'Confirmar Estorno',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          setIsSubmitting(true)
          const agora = new Date()
          const dataHojeFormatada = formatDate(agora.toISOString())
          const obsEstorno = ` [Estornado em ${dataHojeFormatada}: revertido ${formatCurrency(valorPagoAtual)}]`

          // 1. Reverter o título para Aberta, zerando valor_pago e data_pagamento
          await pb.collection('contas_pagar').update(c.id, {
            status: 'Aberta',
            valor_pago: 0,
            data_pagamento: null,
            forma_pagamento: null,
            observacoes: (c.observacoes || '') + obsEstorno,
          })

          // 2. Criar movimento financeiro inverso (Entrada no caixa revertendo a saída original)
          let movInversoId: string | undefined
          if (valorPagoAtual > 0) {
            const mov = await pb.collection('movimentos_financeiros').create({
              empresa_id: currentEmpresa!.id,
              tipo: 'Entrada',
              descricao: `Estorno de pagamento: ${c.descricao || fornecedorNome}${c.expand?.centro_custo_id ? ` [${c.expand.centro_custo_id.codigo}]` : ''}`,
              valor: valorPagoAtual,
              data: agora.toISOString(),
              categoria_id: c.categoria_id || null,
              centro_custo_id: c.centro_custo_id || null,
              origem: 'ContaPagar',
              referencia_id: c.id,
              conciliado: false,
            })
            movInversoId = mov.id
          }

          // 3. Registrar histórico de alteração (estorno)
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_pagar',
            registroId: c.id,
            acao: 'estorno',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Pagamento estornado no valor de ${formatCurrency(valorPagoAtual)}. O título retornou para "Aberta" e foi gerado movimento de Entrada no caixa para manter os saldos consistentes.`,
            detalhes: {
              valor: valorPagoAtual,
              movimento_inverso: {
                tipo: 'Entrada',
                valor: valorPagoAtual,
                movimento_id: movInversoId,
              },
            },
          })

          toast({
            title: 'Pagamento estornado com sucesso!',
            description: `Título retornado para Em Aberto e movimento de estorno no caixa registrado no valor de ${formatCurrency(valorPagoAtual)}.`,
          })
          if (detailItem?.id === c.id) {
            setDetailItem(null)
          }
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao estornar pagamento',
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

  const getDocumentoContaPagar = (c: ContaPagar): string => {
    if (!c.observacoes) return ''
    const match = c.observacoes.match(/(?:Doc|NF|Nota|Duplicata)[\s:]*([A-Z0-9/\s\-–]+?)(?:\||$)/i)
    return match && match[1] ? match[1].trim() : ''
  }

  const handleOpenSettle = (conta: ContaPagar) => {
    loadAuxiliares()
    setSettlingConta(conta)
    setDataPagamento(toInputDate(new Date().toISOString()))
    const saldo = getSaldoRestante(conta)
    setValorPago(saldo > 0 ? saldo : conta.valor)
    setFormaPagamento('Pix')
    setSettleModalOpen(true)
  }

  // Ação de compensar cheque pré-datado de conta a pagar
  const handleCompensarCheque = (cheque: ChequePredatado) => {
    if (!detailItem) return
    const dataChequeFormatada = formatDate(cheque.data)

    setConfirmDialogData({
      title: 'Confirmar compensação de cheque pré-datado',
      description: `Deseja marcar como compensado o cheque emitido no valor de ${formatCurrency(cheque.valor)} (Vencimento: ${dataChequeFormatada}${cheque.numero ? `, Nº ${cheque.numero}` : ''}${cheque.banco ? `, Banco: ${cheque.banco}` : ''})? Isso atualizará o status do cheque para Compensado e gerará uma SAÍDA no caixa na data do cheque.`,
      confirmLabel: 'Confirmar Compensação',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const dataCompensacaoIso = cheque.data
            ? new Date(`${toInputDate(cheque.data)}T12:00:00Z`).toISOString()
            : new Date().toISOString()

          // 1. Atualizar cheque no banco via serviço
          await chequesPredatadosService.compensar(cheque.id, dataCompensacaoIso)

          // 2. Gerar movimento de caixa de Saída na data do cheque
          const fornecedorNome =
            detailItem.expand?.fornecedor_id?.nome || detailItem.descricao || 'Título a Pagar'
          const mov = await pb.collection('movimentos_financeiros').create({
            empresa_id: currentEmpresa!.id,
            tipo: 'Saida',
            descricao: `Compensação de cheque pré-datado: ${fornecedorNome}${cheque.numero ? ` [Cheque Nº ${cheque.numero}]` : ''}${cheque.banco ? ` [Banco: ${cheque.banco}]` : ''} - Ref: ${detailItem.descricao}`,
            valor: cheque.valor,
            data: dataCompensacaoIso,
            categoria_id: detailItem.categoria_id || null,
            centro_custo_id: detailItem.centro_custo_id || null,
            origem: 'ContaPagar',
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
            descricao: `Cheque pré-datado de ${formatCurrency(cheque.valor)} compensado em ${formatDate(dataCompensacaoIso)}. Gerado movimento de Saída no caixa ref. título a pagar "${detailItem.descricao}".`,
            detalhes: {
              valor: cheque.valor,
              extra: {
                cheque_id: cheque.id,
                numero: cheque.numero,
                banco: cheque.banco,
                titulo_pagar_id: detailItem.id,
                movimento_financeiro_id: mov.id,
              },
            },
          })

          toast({
            title: 'Cheque compensado com sucesso!',
            description: `Movimento de saída no caixa gerado no valor de ${formatCurrency(cheque.valor)}.`,
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
    const valorBaixa = Number(valorPago)
    if (valorBaixa <= 0) {
      toast({ title: 'Informe um valor válido a pagar', variant: 'destructive' })
      return
    }

    setConfirmDialogData({
      title: 'Confirmar pagamento / baixa',
      description: `Deseja registrar o pagamento de ${formatCurrency(valorBaixa)} em ${dataPagamento ? formatDate(dataPagamento) : 'hoje'} via ${formaPagamento}? Isso atualizará o saldo e lançará a saída correspondente no fluxo financeiro.`,
      confirmLabel: 'Confirmar Pagamento',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const payDateISO = new Date(dataPagamento).toISOString()

          const totalAcumuladoAntes = getValorPagoEfetivo(settlingConta)
          const novoTotalPago = totalAcumuladoAntes + valorBaixa
          const valorTituloTotal = Number(settlingConta.valor || 0)
          const estaQuitado = novoTotalPago >= valorTituloTotal - 0.009
          const novoStatus = estaQuitado ? 'Paga' : 'Parcial'

          const obsBaixa = ` [Baixa ${novoStatus === 'Paga' ? 'total' : 'parcial'} de ${formatCurrency(valorBaixa)} em ${formatDate(payDateISO)}]`

          // 1. Update status to Paga or Parcial and save valor_pago
          await pb.collection('contas_pagar').update(settlingConta.id, {
            status: novoStatus,
            valor_pago: novoTotalPago,
            data_pagamento: payDateISO,
            forma_pagamento: formaPagamento,
            observacoes: (settlingConta.observacoes || '') + obsBaixa,
          })

          // 2. Create financial movement with the exact partial payment amount
          const mov = await pb.collection('movimentos_financeiros').create({
            empresa_id: currentEmpresa!.id,
            tipo: 'Saida',
            descricao: `Pagamento${novoStatus === 'Parcial' ? ' parcial' : ''}: ${settlingConta.descricao}${settlingConta.expand?.centro_custo_id ? ` [${settlingConta.expand.centro_custo_id.codigo}]` : ''}`,
            valor: valorBaixa,
            data: payDateISO,
            categoria_id: settlingConta.categoria_id || null,
            centro_custo_id: settlingConta.centro_custo_id || null,
            origem: 'ContaPagar',
            referencia_id: settlingConta.id,
            conciliado: false,
          })

          // 3. Registrar histórico de alteração (baixa)
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'contas_pagar',
            registroId: settlingConta.id,
            acao: 'baixa',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Baixa ${novoStatus === 'Paga' ? 'total' : 'parcial'} de ${formatCurrency(valorBaixa)} via ${formaPagamento} em ${formatDate(payDateISO)}. Saldo restante a pagar: ${formatCurrency(Math.max(0, valorTituloTotal - novoTotalPago))}.`,
            detalhes: {
              valor: valorBaixa,
              extra: {
                forma_pagamento: formaPagamento,
                data_pagamento: payDateISO,
                status_resultante: novoStatus,
                movimento_financeiro_id: mov.id,
              },
            },
          })

          toast({
            title: estaQuitado
              ? 'Título quitado integralmente!'
              : 'Pagamento parcial registrado com sucesso!',
            description: estaQuitado
              ? `Valor pago: ${formatCurrency(valorBaixa)}`
              : `Pago: ${formatCurrency(valorBaixa)}. Saldo a pagar: ${formatCurrency(Math.max(0, valorTituloTotal - novoTotalPago))}`,
          })
          setSettleModalOpen(false)
          setSearchParams({})
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao baixar título',
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

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Seletor de período rápido
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
    setCampoDataFiltro('vencimento')
    setOpcaoPeriodoRapido('todos')
    setSearchQuery('')
    setSelectedIds([])
  }

  const getContaStatusReal = (c: ContaPagar): StatusContaPagar => {
    if (c.status === 'Paga') return 'Paga'
    const isOverdue = c.vencimento.slice(0, 10) < nowISO
    if (isOverdue) return 'Vencida'
    return c.status
  }

  // Os itens da página atual já vêm filtrados do servidor
  const filteredContas = contas

  // Saldo total em aberto, vencido e pago alimentados pela agregação leve do servidor
  const totalAberto = totaisCards.aberto
  const totalVencido = totaisCards.vencido
  const totalPagoMes = totaisCards.pago

  // Handlers de seleção por checkbox na página atual
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
      const todasDoFiltro = await pb.collection('contas_pagar').getFullList<ContaPagar>({
        filter: serverFilter,
        sort: 'vencimento',
        expand: 'fornecedor_id,categoria_id,centro_custo_id',
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

  // Itens a serem impressos no modal A4
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
            : 'Pagamento'
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
      partes.push('Período: Todos os lançamentos')
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

  // Colunas do relatório de impressão A4
  const colunasRelatorioPagar = useMemo<ColunaRelatorioImpressao<ContaPagar>[]>(() => {
    return [
      {
        key: 'descricao_fornecedor',
        header: 'Descrição / Fornecedor',
        render: (c) => {
          const nomeForn = c.expand?.fornecedor_id?.nome || ''
          return (
            <div>
              <div className="font-semibold text-gray-900">{c.descricao}</div>
              {nomeForn && nomeForn !== c.descricao && (
                <div className="text-[10px] text-gray-500">{nomeForn}</div>
              )}
            </div>
          )
        },
      },
      {
        key: 'documento',
        header: 'Doc / NF',
        className: 'font-mono whitespace-nowrap',
        render: (c) => getDocumentoContaPagar(c) || '—',
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
        className: 'whitespace-nowrap text-xs',
        render: (c) => c.forma_pagamento || '—',
      },
      {
        key: 'valor',
        header: 'Valor (R$)',
        align: 'right',
        className: 'font-mono font-medium text-gray-900 whitespace-nowrap',
        render: (c) => formatCurrency(c.valor),
      },
      {
        key: 'valor_pago',
        header: 'Pago (R$)',
        align: 'right',
        className: 'font-mono text-emerald-800 whitespace-nowrap',
        render: (c) => {
          const pago = getValorPagoEfetivo(c)
          return pago > 0 ? formatCurrency(pago) : '—'
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
                st === 'Paga'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : st === 'Vencida'
                    ? 'bg-red-50 text-red-800 border border-red-300'
                    : st === 'Parcial'
                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
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

  // Totalizadores do rodapé do relatório
  const totalizadoresRelatorioPagar = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaValor = itensParaImpressao.reduce((acc, c) => acc + (c.valor || 0), 0)
    const somaPago = itensParaImpressao.reduce((acc, c) => acc + getValorPagoEfetivo(c), 0)
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
        value: formatCurrency(somaPago),
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

  // Opções memoizadas para ComboboxPesquisavel
  const fornecedoresOptions = useMemo(() => {
    const prefix = descricao.trim()
      ? `Usar a Descrição ("${descricao.trim()}")`
      : 'Mesmo da Descrição (Automático)'
    return [
      { id: 'none', label: prefix },
      ...fornecedores.map((f) => ({
        id: f.id,
        label: f.nome,
        sublabel: f.cnpj_cpf || f.cidade || undefined,
      })),
    ]
  }, [fornecedores, descricao])

  const centrosCustoOptions = useMemo(() => {
    return [
      { id: 'none', label: 'Nenhum / Não alocado' },
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

  const formasOptions = useMemo(() => {
    if (formasCadastradas.length > 0) {
      return formasCadastradas.map((f) => ({
        id: f.nome,
        label: f.nome,
      }))
    }
    return FORMAS_RECEBIMENTO_PADRAO.map((f) => ({
      id: f,
      label: f,
    }))
  }, [formasCadastradas])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Pagar</h1>
          <p className="text-xs text-gray-500">Gestão de obrigações, vencimentos e fornecedores</p>
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
              onClick={() => {
                loadAuxiliares()
                setConferirModalOpen(true)
              }}
              className="border-amber-400 text-amber-900 bg-amber-50/50 hover:bg-amber-100 rounded-xl shadow-xs font-medium"
            >
              <CheckCircle className="w-4 h-4 mr-1.5 text-amber-700" />
              Conferir Planilha (Comparar)
            </Button>
          )}

          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                loadAuxiliares()
                setImportModalOpen(true)
              }}
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
              Nova Conta a Pagar
            </Button>
          )}
        </div>
      </div>

      {/* Summary Pills Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Total em Aberto
            </span>
            <span className="text-xl font-bold text-gray-900 tabular-nums">
              {formatCurrency(totalAberto)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            R$
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider block">
              Total Vencido
            </span>
            <span className="text-xl font-bold text-red-600 tabular-nums">
              {formatCurrency(totalVencido)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            !
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
              Total Pago
            </span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">
              {formatCurrency(totalPagoMes)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 space-y-3">
        {/* Linha 1: Status chips, Centro de custo e busca */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['Todas', 'Aberta', 'Parcial', 'Paga', 'Vencida'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {st === 'Todas' ? 'Todos os Status' : st === 'Parcial' ? 'Parciais' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Centro de Custo Filter */}
            <Select value={centroCustoFilter} onValueChange={setCentroCustoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Centros</SelectItem>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar descrição ou fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Seletor de Período (Opções Rápidas + Intervalo Personalizado de Datas + Botão Imprimir) */}
        <div className="pt-2 border-t border-[#ECEAE4] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center text-gray-600 font-medium text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1 text-teal-700" />
              Filtrar por período:
            </span>

            {/* Campo da data a filtrar */}
            <Select value={campoDataFiltro} onValueChange={(v: any) => setCampoDataFiltro(v)}>
              <SelectTrigger className="w-[155px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento">Vencimento</SelectItem>
                <SelectItem value="data_emissao">Data de Emissão</SelectItem>
                <SelectItem value="data_pagamento">Data de Pagamento</SelectItem>
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

            {/* Datas personalizada de / até */}
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
                  ? `Imprimir os ${selectedIds.length} títulos selecionados`
                  : 'Imprimir relatório dos títulos a pagar filtrados'
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
                    aria-label="Selecionar todas as contas visíveis"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Vencimento</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Emissão</th>
                <th className="py-2.5 px-2.5 min-w-[140px]">Descrição / Fornecedor</th>
                <th className="py-2.5 px-2 whitespace-nowrap">C. Custo</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Categoria</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Valor Total</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Pago</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Saldo</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Forma</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-32">Doc / NF</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400">
                    Nenhuma conta a pagar encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const displayStatus = getContaStatusReal(c)
                  const jaPago = getValorPagoEfetivo(c)
                  const saldoRestante = getSaldoRestante(c)
                  const nomeFornecedor = c.expand?.fornecedor_id?.nome || ''
                  const doc = getDocumentoContaPagar(c)
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
                          aria-label={`Selecionar conta ${c.descricao}`}
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

                      {/* Descrição / Fornecedor */}
                      <td className="py-2 px-2.5 max-w-[260px]">
                        <div className="flex flex-col">
                          <span
                            className="font-semibold text-gray-900 truncate text-xs"
                            title={c.descricao}
                          >
                            {c.descricao}
                          </span>
                          {nomeFornecedor && nomeFornecedor !== c.descricao && (
                            <span
                              className="text-[11px] text-gray-500 truncate"
                              title={nomeFornecedor}
                            >
                              {nomeFornecedor}
                            </span>
                          )}
                        </div>
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

                      {/* Categoria */}
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap text-xs">
                        {c.expand?.categoria_id?.nome ? (
                          <span
                            className="truncate max-w-[120px] inline-block"
                            title={c.expand.categoria_id.nome}
                          >
                            {c.expand.categoria_id.nome}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Valor Total */}
                      <td className="py-2 px-2.5 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap text-xs">
                        {formatCurrency(c.valor)}
                      </td>

                      {/* Já Pago */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap text-xs">
                        {jaPago > 0 ? (
                          formatCurrency(jaPago)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Saldo Restante */}
                      <td className="py-2 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap text-xs">
                        {saldoRestante > 0 ? (
                          <span
                            className={
                              displayStatus === 'Vencida' ? 'text-red-600' : 'text-amber-700'
                            }
                          >
                            {formatCurrency(saldoRestante)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium text-[11px]">Quitado</span>
                        )}
                      </td>

                      {/* Forma */}
                      <td className="py-2 px-2 text-center whitespace-nowrap text-[11px] text-gray-600">
                        {c.forma_pagamento || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0 leading-tight font-medium ${
                            displayStatus === 'Paga'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : displayStatus === 'Parcial'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                : displayStatus === 'Vencida'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {displayStatus}
                        </Badge>
                      </td>

                      {/* Doc / NF */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {doc ? (
                          <span
                            className="inline-flex items-center justify-center w-28 px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold font-mono text-[11px] border border-gray-200/80 whitespace-nowrap text-center"
                            title={doc}
                          >
                            {doc}
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
                          {canEdit && displayStatus !== 'Paga' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSettle(c)}
                              className="h-6 px-2 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {c.status === 'Parcial' ? 'Amortizar' : 'Baixar'}
                            </Button>
                          )}
                          {canEdit &&
                            (displayStatus === 'Paga' || (c.valor_pago && c.valor_pago > 0)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEstorno(c)}
                                className="h-6 px-2 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-50"
                                title="Estornar pagamento e reverter saldo"
                              >
                                <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                                Estornar
                              </Button>
                            )}
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
                              onClick={() => handleDelete(c.id, c.descricao || nomeFornecedor)}
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
              {editingId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição *</Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aluguel do Escritório Central"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">Fornecedor</Label>
                {descricao.trim() && (fornecedorId === 'none' || !fornecedorId) && (
                  <span className="text-[11px] text-teal-700 font-medium">
                    Preenchimento automático: &ldquo;{descricao.trim()}&rdquo;
                  </span>
                )}
              </div>
              <ComboboxPesquisavel
                value={fornecedorId}
                onChange={setFornecedorId}
                placeholder={
                  descricao.trim()
                    ? `Usar descrição: "${descricao.trim()}"`
                    : 'Pesquisar ou selecionar fornecedor...'
                }
                searchPlaceholder="Digitar nome do fornecedor..."
                emptyText="Nenhum fornecedor encontrado."
                className="mt-1"
                options={fornecedoresOptions}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Digite para buscar por nome ou CNPJ. Se não selecionado, receberá o texto da
                Descrição.
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
                  searchPlaceholder="Buscar categoria contábil..."
                  emptyText="Nenhuma categoria encontrada."
                  className="mt-1"
                  options={categoriasOptions}
                />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Forma de Pagamento Prevista
              </Label>
              <ComboboxPesquisavel
                value={formaPagamentoForm}
                onChange={(val) => {
                  setFormaPagamentoForm(val)
                  if (val === 'Cheque Pré-datado' && chequesPredatadosForm.length === 0) {
                    setChequesPredatadosForm([
                      {
                        data: vencimento || toInputDate(new Date().toISOString()),
                        valor: Number(valor) || 0,
                        numero: '',
                        banco: '',
                      },
                    ])
                  }
                  if (val === 'A Prazo' && parcelas <= 1) {
                    handleChangeNumParcelas(2)
                  }
                }}
                placeholder="Selecione a forma de pagamento..."
                searchPlaceholder="Buscar forma de pagamento..."
                emptyText="Nenhuma forma encontrada."
                className="mt-1"
                options={formasOptions}
              />
            </div>

            {/* Painel Cheques Pré-datados */}
            {formaPagamentoForm === 'Cheque Pré-datado' && (
              <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-xs">
                    <Tag className="w-3.5 h-3.5 text-amber-700" />
                    Cheques Pré-datados Emitidos
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setChequesPredatadosForm([
                        ...chequesPredatadosForm,
                        {
                          data: vencimento || toInputDate(new Date().toISOString()),
                          valor: 0,
                          numero: '',
                          banco: '',
                        },
                      ])
                    }}
                    className="h-6 px-2 text-[11px] border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Cheque
                  </Button>
                </div>

                <div className="space-y-2">
                  {chequesPredatadosForm.map((chk, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-lg border border-amber-200"
                    >
                      <div className="col-span-3">
                        <Label className="text-[10px] text-gray-500 font-medium">Vencimento</Label>
                        <Input
                          type="date"
                          value={chk.data}
                          onChange={(e) => {
                            const updated = [...chequesPredatadosForm]
                            updated[idx].data = e.target.value
                            setChequesPredatadosForm(updated)
                          }}
                          className="h-7 text-xs font-mono px-1.5"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] text-gray-500 font-medium">Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={chk.valor || ''}
                          onChange={(e) => {
                            const updated = [...chequesPredatadosForm]
                            updated[idx].valor = parseFloat(e.target.value) || 0
                            setChequesPredatadosForm(updated)
                          }}
                          className="h-7 text-xs font-mono px-1.5 font-semibold"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] text-gray-500 font-medium">Nº Cheque</Label>
                        <Input
                          type="text"
                          placeholder="Ex: 00123"
                          value={chk.numero || ''}
                          onChange={(e) => {
                            const updated = [...chequesPredatadosForm]
                            updated[idx].numero = e.target.value
                            setChequesPredatadosForm(updated)
                          }}
                          className="h-7 text-xs px-1.5"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-gray-500 font-medium">Banco</Label>
                        <Input
                          type="text"
                          placeholder="Ex: BB"
                          value={chk.banco || ''}
                          onChange={(e) => {
                            const updated = [...chequesPredatadosForm]
                            updated[idx].banco = e.target.value
                            setChequesPredatadosForm(updated)
                          }}
                          className="h-7 text-xs px-1.5"
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-center pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = chequesPredatadosForm.filter((_, i) => i !== idx)
                            setChequesPredatadosForm(updated)
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remover cheque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs font-medium text-amber-950 border-t border-amber-200">
                  <span>Total em Cheques:</span>
                  <span className="font-mono font-bold">
                    {formatCurrency(
                      chequesPredatadosForm.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={valor || ''}
                  onChange={(e) => handleChangeValorTotal(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono"
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
            </div>

            {(!editingId || formaPagamentoForm === 'A Prazo') && (
              <SeletorParcelas
                parcelas={parcelas}
                onChangeParcelas={handleChangeNumParcelas}
                prazoSelecionado={prazoSelecionado}
                onSelecionarPrazo={handleSelecionarPrazoRapido}
                listaParcelas={gradeParcelas}
                onChangeDataParcela={handleChangeDataParcelaIndividual}
                valorTotal={valor}
              />
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Status Inicial</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Paga">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais, notas fiscais, etc..."
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

      {/* Settle (Baixar) Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Baixar Conta a Pagar
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {settlingConta && (
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <div className="font-semibold text-gray-900 text-sm">{settlingConta.descricao}</div>
                <div className="text-gray-500">
                  Fornecedor:{' '}
                  <span className="font-medium text-gray-800">
                    {settlingConta.expand?.fornecedor_id?.nome ||
                      settlingConta.descricao ||
                      'Não informado'}
                  </span>
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
                      Já Pago
                    </span>
                    <strong className="text-emerald-700 font-mono text-xs">
                      {formatCurrency(getValorPagoEfetivo(settlingConta))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">
                      Saldo a Pagar
                    </span>
                    <strong className="text-amber-800 font-mono text-xs">
                      {formatCurrency(getSaldoRestante(settlingConta))}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Data de Pagamento *</Label>
              <Input
                type="date"
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
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
                      setValorPago(saldo)
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
                value={valorPago || ''}
                onChange={(e) => setValorPago(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono text-base font-bold text-gray-900"
              />
              {settlingConta && (
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {Number(valorPago) < getSaldoRestante(settlingConta) ? (
                    <span className="text-amber-700 font-medium">
                      ⚠️ Pagamento parcial: restará um saldo a pagar de{' '}
                      <strong>
                        {formatCurrency(
                          Math.max(0, getSaldoRestante(settlingConta) - Number(valorPago)),
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

            <div>
              <Label className="text-xs font-semibold text-gray-700">Forma de Pagamento *</Label>
              <ComboboxPesquisavel
                value={formaPagamento}
                onChange={setFormaPagamento}
                placeholder="Selecione a forma de pagamento..."
                searchPlaceholder="Buscar forma de pagamento..."
                emptyText="Nenhuma forma encontrada."
                className="mt-1"
                options={formasOptions}
              />
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
              {isSubmitting ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Read-Only Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Detalhes da Conta a Pagar
            </SheetTitle>
          </SheetHeader>

          {detailItem && (
            <div className="py-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100 text-center">
                <div>
                  <span className="text-[10px] text-teal-700 font-semibold uppercase block">
                    Valor Total
                  </span>
                  <div className="text-lg font-bold text-teal-950 mt-0.5 tabular-nums">
                    {formatCurrency(detailItem.valor)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase block">
                    Pago
                  </span>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5 tabular-nums">
                    {formatCurrency(getValorPagoEfetivo(detailItem))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-semibold uppercase block">
                    Saldo a Pagar
                  </span>
                  <div className="text-lg font-bold text-amber-900 mt-0.5 tabular-nums">
                    {formatCurrency(getSaldoRestante(detailItem))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#ECEAE4] pt-4">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Descrição:</span>
                  <span className="font-semibold text-gray-900">{detailItem.descricao}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Fornecedor:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.fornecedor_id?.nome ||
                      detailItem.descricao ||
                      'Não informado'}
                  </span>
                </div>
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
                {detailItem.data_pagamento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Último Pagamento:</span>
                    <span className="font-mono text-emerald-700">
                      {formatDate(detailItem.data_pagamento)}
                    </span>
                  </div>
                )}
                {detailItem.forma_pagamento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Forma de Pagamento:</span>
                    <span className="text-gray-800 font-medium">{detailItem.forma_pagamento}</span>
                  </div>
                )}
              </div>

              {/* Seção Cheques Pré-datados Emitidos */}
              {(detailItem.forma_pagamento === 'Cheque Pré-datado' || chequesDetail.length > 0) && (
                <div className="border-t border-[#ECEAE4] pt-4 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      Cheques Pré-datados Vinculados ({chequesDetail.length})
                    </span>
                    {loadingChequesDetail && (
                      <span className="text-[10px] text-gray-400">Carregando cheques...</span>
                    )}
                  </div>

                  {chequesDetail.length === 0 && !loadingChequesDetail ? (
                    <p className="text-[11px] text-gray-400 italic">
                      Nenhum cheque cadastrado para este título.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {chequesDetail.map((chk) => (
                        <div
                          key={chk.id}
                          className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-gray-900 text-xs">
                              {formatCurrency(chk.valor)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                chk.status === 'compensado'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-amber-100/70 text-amber-800 border-amber-300 font-semibold'
                              }`}
                            >
                              {chk.status === 'compensado' ? 'Compensado' : 'Pendente'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div>
                              <span className="text-gray-400 block text-[10px]">
                                Bom para / Venc:
                              </span>
                              <span className="font-mono font-medium text-gray-800">
                                {formatDate(chk.data)}
                              </span>
                            </div>
                            {chk.numero && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">Nº Cheque:</span>
                                <span className="font-mono text-gray-800">{chk.numero}</span>
                              </div>
                            )}
                            {chk.banco && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">Banco:</span>
                                <span>{chk.banco}</span>
                              </div>
                            )}
                            {chk.data_compensacao && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">
                                  Compensado em:
                                </span>
                                <span className="font-mono text-emerald-700">
                                  {formatDate(chk.data_compensacao)}
                                </span>
                              </div>
                            )}
                          </div>

                          {canEdit && chk.status !== 'compensado' && (
                            <div className="pt-1.5 border-t border-amber-200/60 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompensarCheque(chk)}
                                className="h-6 px-2 text-[11px] border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white"
                              >
                                <CheckSquare className="w-3 h-3 mr-1 text-emerald-600" />
                                Marcar como Compensado
                              </Button>
                            </div>
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
                    colecaoOrigem="contas_pagar"
                    tituloDescricao={detailItem.descricao}
                  />
                </div>
              )}

              {canEdit && (
                <div className="pt-4 space-y-2">
                  {detailItem.status !== 'Paga' && (
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
                        : 'Baixar Título Agora'}
                    </Button>
                  )}

                  {(detailItem.status === 'Paga' ||
                    (detailItem.valor_pago && detailItem.valor_pago > 0)) && (
                    <Button
                      variant="outline"
                      className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl"
                      onClick={() => handleEstorno(detailItem)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2 text-amber-600" />
                      Estornar Pagamento
                    </Button>
                  )}

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
                        handleDelete(detailItem.id, detailItem.descricao)
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* AlertDialog de Confirmação para Todas as Modificações */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogData?.title || 'Confirmar ação'}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialogData?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              className={
                confirmDialogData?.confirmVariant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }
              onClick={async (e) => {
                e.preventDefault()
                if (confirmDialogData?.action) {
                  await confirmDialogData.action()
                }
                setConfirmDialogOpen(false)
              }}
            >
              {confirmDialogData?.confirmLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Importador XLSX Contas a Pagar */}
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
          <ImportadorContasPagarModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            empresaId={currentEmpresa?.id || ''}
            fornecedores={fornecedores}
            categorias={categorias}
            centrosCusto={centrosCusto}
            contasExistentes={contas}
            onImportComplete={loadData}
          />
        </React.Suspense>
      )}

      {/* Modal Conferir Planilha (Comparação com Banco) */}
      {conferirModalOpen && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-2 text-xs text-gray-600">
                <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                Carregando conferência...
              </div>
            </div>
          }
        >
          <ConferirPlanilhaPagarModal
            open={conferirModalOpen}
            onOpenChange={setConferirModalOpen}
            empresaId={currentEmpresa?.id || ''}
            fornecedores={fornecedores}
            categorias={categorias}
            centrosCusto={centrosCusto}
            contasExistentes={contas}
            onDataChanged={loadData}
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
            colecaoPadrao="contas_pagar"
          />
        </React.Suspense>
      )}

      {/* Relatório de Impressão A4 das Contas a Pagar */}
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
            titulo="Contas a Pagar — Relatório de Itens"
            subtitulo="Demonstrativo de Obrigações Financeiras, Vencimentos e Fornecedores"
            badgeDestaque="Contas a Pagar"
            empresa={currentEmpresa}
            usuarioNome={user?.name || user?.email || 'Administrador'}
            filtrosDescricao={descricaoFiltrosAplicados}
            itens={itensParaImpressao}
            colunas={colunasRelatorioPagar}
            totais={totalizadoresRelatorioPagar}
            mensagemVazio="Nenhuma conta a pagar encontrada para os filtros ou seleção atual."
          />
        </React.Suspense>
      )}
    </div>
  )
}
