import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type { ContaPagar, Fornecedor, PlanoConta, CentroCusto, StatusContaPagar } from '@/types/erp'
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
import { ImportadorContasPagarModal } from '@/components/financeiro/ImportadorContasPagarModal'
import { ConferirPlanilhaPagarModal } from '@/components/financeiro/ConferirPlanilhaPagarModal'
import {
  SeletorParcelas,
  TipoPrazo,
  ItemParcela,
  gerarGradeParcelas,
} from '@/components/financeiro/SeletorParcelas'

export default function ContasPagar() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contas, setContas] = useState<ContaPagar[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(true)

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

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false)
  // Conferência Modal
  const [conferirModalOpen, setConferirModalOpen] = useState(false)

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

  // Settle (Baixar) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaPagar | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [valorPago, setValorPago] = useState<number>(0)
  const [formaPagamento, setFormaPagamento] = useState<
    'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  >('Pix')
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

  useRealtime('contas_pagar', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const [cpList, fList, pcList, ccList] = await Promise.all([
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'vencimento',
          expand: 'fornecedor_id,categoria_id,centro_custo_id',
        }),
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
      ])

      setContas(cpList)
      setFornecedores(fList)
      setCategorias(pcList)
      setCentrosCusto(ccList)

      // Handle query params e.g. ?novo=1 or ?id=xyz
      const qNovo = searchParams.get('novo')
      const qId = searchParams.get('id')
      const qAction = searchParams.get('action')
      const qStatus = searchParams.get('status')

      if (qStatus === 'Vencidas') {
        setStatusFilter('Vencida')
      }

      if (qNovo && canEdit) {
        openCreateModal()
      } else if (qId) {
        const found = cpList.find((c) => c.id === qId)
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

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
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
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: ContaPagar) => {
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
    setStatus(c.status === 'Paga' ? 'Paga' : 'Aberta')
    setObservacoes(c.observacoes || '')
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
            await pb.collection('contas_pagar').update(editingId, {
              descricao: descricao.trim(),
              fornecedor_id: finalFornecedorId,
              categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
              centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
              valor: Number(valor),
              vencimento: new Date(vencimento).toISOString(),
              data_emissao: dataEmissaoIso,
              parcelas: Number(parcelas),
              status: status,
              observacoes: observacoes.trim(),
            })
            toast({ title: 'Conta a pagar atualizada!' })
          } else {
            // Multiple installments support com datas digitadas/calculadas
            const numParcelas = Math.max(1, Number(parcelas))

            const parcelasParaSalvar =
              gradeParcelas.length === numParcelas
                ? gradeParcelas
                : gerarGradeParcelas(vencimento, numParcelas, prazoSelecionado, valor)

            for (let i = 0; i < parcelasParaSalvar.length; i++) {
              const item = parcelasParaSalvar[i]
              const dataVencIso = item.vencimento
                ? new Date(`${item.vencimento}T12:00:00Z`).toISOString()
                : new Date(vencimento).toISOString()

              const desc =
                numParcelas > 1 ? `${descricao.trim()} (${i + 1}/${numParcelas})` : descricao.trim()

              await pb.collection('contas_pagar').create({
                empresa_id: currentEmpresa!.id,
                descricao: desc,
                fornecedor_id: finalFornecedorId,
                categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
                centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
                valor: Number(item.valor) || Number(valor) / (numParcelas > 1 ? numParcelas : 1),
                vencimento: dataVencIso,
                data_emissao: dataEmissaoIso || undefined,
                parcelas: numParcelas,
                status: status,
                observacoes: observacoes.trim(),
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
    setConfirmDialogData({
      title: 'Confirmar exclusão de conta a pagar',
      description: `Deseja realmente excluir o título ${descricaoAlvo ? `"${descricaoAlvo}"` : ''}? Esta ação removerá o registro e não poderá ser desfeita.`,
      confirmLabel: 'Excluir Título',
      confirmVariant: 'destructive',
      action: async () => {
        try {
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
          if (valorPagoAtual > 0) {
            await pb.collection('movimentos_financeiros').create({
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
          }

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
    setSettlingConta(conta)
    setDataPagamento(toInputDate(new Date().toISOString()))
    const saldo = getSaldoRestante(conta)
    setValorPago(saldo > 0 ? saldo : conta.valor)
    setFormaPagamento('Pix')
    setSettleModalOpen(true)
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
          await pb.collection('movimentos_financeiros').create({
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

  const nowISO = new Date().toISOString().slice(0, 10)
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
  }

  const getContaStatusReal = (c: ContaPagar): StatusContaPagar => {
    if (c.status === 'Paga') return 'Paga'
    const isOverdue = c.vencimento.slice(0, 10) < nowISO
    if (isOverdue) return 'Vencida'
    return c.status
  }

  // Filtered List com suporte a período de vencimento/emissão/pagamento
  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const currentRealStatus = getContaStatusReal(c)

      if (statusFilter !== 'Todas') {
        if (statusFilter === 'Aberta') {
          if (c.status !== 'Aberta' || currentRealStatus === 'Vencida') return false
        } else if (statusFilter === 'Parcial') {
          if (c.status !== 'Parcial') return false
        } else if ((currentRealStatus as string) !== (statusFilter as string)) {
          return false
        }
      }
      if (centroCustoFilter !== 'todos' && c.centro_custo_id !== centroCustoFilter) {
        return false
      }

      // Filtro de período por campo selecionado
      if (dataInicioFilter || dataFimFilter) {
        let campoValorData: string | undefined
        if (campoDataFiltro === 'vencimento') {
          campoValorData = c.vencimento ? c.vencimento.slice(0, 10) : undefined
        } else if (campoDataFiltro === 'data_emissao') {
          campoValorData = c.data_emissao ? c.data_emissao.slice(0, 10) : undefined
        } else if (campoDataFiltro === 'data_pagamento') {
          campoValorData = c.data_pagamento ? c.data_pagamento.slice(0, 10) : undefined
        }

        if (!campoValorData) return false
        if (dataInicioFilter && campoValorData < dataInicioFilter) return false
        if (dataFimFilter && campoValorData > dataFimFilter) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fornecedorNome = c.expand?.fornecedor_id?.nome?.toLowerCase() || ''
        const matchDesc = c.descricao.toLowerCase().includes(q)
        const matchForn = fornecedorNome.includes(q)
        if (!matchDesc && !matchForn) return false
      }
      return true
    })
  }, [
    contas,
    statusFilter,
    centroCustoFilter,
    campoDataFiltro,
    dataInicioFilter,
    dataFimFilter,
    searchQuery,
    nowISO,
  ])

  // Calculations for summary pills aplicando os filtros do período
  // Saldo total em aberto (não vencido) nos títulos filtrados
  const totalAberto = useMemo(() => {
    return filteredContas
      .filter(
        (c) =>
          (c.status === 'Aberta' || c.status === 'Parcial') && c.vencimento.slice(0, 10) >= nowISO,
      )
      .reduce((sum, c) => sum + getSaldoRestante(c), 0)
  }, [filteredContas, nowISO])

  // Saldo total vencido nos títulos filtrados
  const totalVencido = useMemo(() => {
    return filteredContas
      .filter(
        (c) =>
          c.status === 'Vencida' ||
          ((c.status === 'Aberta' || c.status === 'Parcial') && c.vencimento.slice(0, 10) < nowISO),
      )
      .reduce((sum, c) => sum + getSaldoRestante(c), 0)
  }, [filteredContas, nowISO])

  // Total pago nos títulos filtrados
  const totalPagoMes = useMemo(() => {
    return filteredContas.reduce((sum, c) => sum + getValorPagoEfetivo(c), 0)
  }, [filteredContas])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Pagar</h1>
          <p className="text-xs text-gray-500">Gestão de obrigações, vencimentos e fornecedores</p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setConferirModalOpen(true)}
              className="border-amber-400 text-amber-900 bg-amber-50/50 hover:bg-amber-100 rounded-xl shadow-xs font-medium"
            >
              <CheckCircle className="w-4 h-4 mr-1.5 text-amber-700" />
              Conferir Planilha (Comparar)
            </Button>
          )}

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

        {/* Linha 2: Seletor de Período (Opções Rápidas + Intervalo Personalizado de Datas) */}
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

          {(statusFilter !== 'Todas' ||
            centroCustoFilter !== 'todos' ||
            dataInicioFilter ||
            dataFimFilter ||
            searchQuery) && (
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
      </Card>

      {/* Table / Cards List */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-2.5 px-2.5 whitespace-nowrap">Vencimento</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Emissão</th>
                <th className="py-2.5 px-2.5 min-w-[140px]">Descrição / Fornecedor</th>
                <th className="py-2.5 px-2 whitespace-nowrap">C. Custo</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Categoria</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Valor Total</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Pago</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Saldo</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-32">Doc / NF</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
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

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailItem(c)}
                      className="hover:bg-teal-50/20 cursor-pointer transition-colors"
                    >
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
                options={[
                  {
                    id: 'none',
                    label: descricao.trim()
                      ? `Usar a Descrição ("${descricao.trim()}")`
                      : 'Mesmo da Descrição (Automático)',
                  },
                  ...fornecedores.map((f) => ({
                    id: f.id,
                    label: f.nome,
                    sublabel: f.cnpj_cpf || f.cidade || undefined,
                  })),
                ]}
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
                  options={[
                    { id: 'none', label: 'Nenhum / Não alocado' },
                    ...centrosCusto.map((cc) => ({
                      id: cc.id,
                      label: `${cc.codigo} - ${cc.nome}`,
                    })),
                  ]}
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
                  options={categorias.map((cat) => ({
                    id: cat.id,
                    label: `${cat.codigo} - ${cat.nome}`,
                    sublabel: cat.tipo,
                  }))}
                />
              </div>
            </div>

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

            {!editingId && (
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
              <Label className="text-xs font-semibold text-gray-700">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v: any) => setFormaPagamento(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="Transferência">Transferência (TED/DOC)</SelectItem>
                  <SelectItem value="Cartão">Cartão de Crédito/Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro em Espécie</SelectItem>
                </SelectContent>
              </Select>
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
                    <span className="text-gray-800">{detailItem.forma_pagamento}</span>
                  </div>
                )}
              </div>

              {detailItem.observacoes && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] mt-4">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Observações e Histórico:
                  </span>
                  <p className="text-gray-600 whitespace-pre-wrap">{detailItem.observacoes}</p>
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

      {/* Modal Conferir Planilha (Comparação com Banco) */}
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
    </div>
  )
}
