import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import { calcularDatasPeriodoRapido, estaDentroDoPeriodo } from '@/lib/periodo'
import FiltroPeriodoBar from '@/components/financeiro/FiltroPeriodoBar'
import type {
  Venda,
  Cliente,
  Produto,
  Entrega,
  StatusVenda,
  FormaPagamentoVenda,
} from '@/types/erp'
import { vendasService } from '@/services/vendas'
import { entregasService } from '@/services/entregas'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  Layers,
  Truck,
  ArrowUpRight,
  Receipt,
  Eye,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react'

// 5 Produtos padrão da Pedreira Cordeiro
const PRODUTOS_PEDREIRA_PADRAO = [
  'Brita 12',
  'Brita 19',
  'Pedra rachão',
  'Pó de pedra',
  'Cascalhinho',
]

export default function Vendas() {
  const { currentEmpresa, canEdit } = useCompany()
  const [searchParams] = useSearchParams()

  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClienteFilter, setSelectedClienteFilter] = useState('todos')
  const [selectedProdutoFilter, setSelectedProdutoFilter] = useState('todos')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')

  // Filtro de período padrão Contas a Pagar/Receber
  const [opcaoPeriodo, setOpcaoPeriodo] = useState<string>('este_mes')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').inicio
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').fim
  })

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoNome, setProdutoNome] = useState('Brita 12')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [unidade, setUnidade] = useState<'m³' | 'ton' | 'un' | 'viagem'>('m³')
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)
  const [valorTotal, setValorTotal] = useState<number>(0)
  const [dataVenda, setDataVenda] = useState(() => toInputDate(new Date().toISOString()))
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoVenda>('Pix')
  const [status, setStatus] = useState<StatusVenda>('Pendente')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [gerarReceberAoSalvar, setGerarReceberAoSalvar] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detalhes da Venda & Entregas Vinculadas Modal
  const [detalheVenda, setDetalheVenda] = useState<Venda | null>(null)

  // Modal para Gerar Conta a Receber individual
  const [modalReceberOpen, setModalReceberOpen] = useState(false)
  const [vendaParaReceber, setVendaParaReceber] = useState<Venda | null>(null)
  const [vencimentoReceber, setVencimentoReceber] = useState(() =>
    toInputDate(new Date().toISOString()),
  )
  const [parcelasReceber, setParcelasReceber] = useState<number>(1)

  // Realtime listeners
  useRealtime('vendas', () => loadData())
  useRealtime('entregas', () => loadData())
  useRealtime('contas_receber', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [vList, cList, pList, eList] = await Promise.all([
        vendasService.listar(currentEmpresa.id),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('produtos').getFullList<Produto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        entregasService.listar(currentEmpresa.id),
      ])

      setVendas(vList)
      setClientes(cList)
      setProdutos(pList)
      setEntregas(eList)
    } catch (err) {
      console.error('Erro ao carregar vendas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Abrir criação
  const openCreateModal = () => {
    setEditingId(null)
    setClienteId(clientes[0]?.id || '')

    // Produto padrão Brita 12
    const pPadrao = produtos.find((p) => p.nome.toLowerCase().includes('brita 12')) || produtos[0]
    setProdutoId(pPadrao?.id || '')
    setProdutoNome(pPadrao?.nome || 'Brita 12')
    setUnidade((pPadrao?.unidade as any) || 'm³')
    const preco = pPadrao?.preco_venda || 95
    setPrecoUnitario(preco)
    setQuantidade(14) // Padrão comum de caçamba (14 m³ / ~20 ton)
    setValorTotal(Number((14 * preco).toFixed(2)))
    setDataVenda(toInputDate(new Date().toISOString()))
    setFormaPagamento('Pix')
    setStatus('Pendente')
    setNotaFiscal('')
    setObservacoes('')
    setGerarReceberAoSalvar(false)
    setIsDrawerOpen(true)
  }

  // Quando seleciona produto no cadastro de venda
  const handleProdutoChange = (id: string) => {
    setProdutoId(id)
    const prod = produtos.find((p) => p.id === id)
    if (prod) {
      setProdutoNome(prod.nome)
      setUnidade((prod.unidade as any) || 'm³')
      const pUnit = prod.preco_venda || 0
      setPrecoUnitario(pUnit)
      setValorTotal(Number((quantidade * pUnit).toFixed(2)))
    }
  }

  // Atualização dinâmica de quantidade e preço
  const handleQuantidadeChange = (novaQtd: number) => {
    setQuantidade(novaQtd)
    setValorTotal(Number((novaQtd * precoUnitario).toFixed(2)))
  }

  const handlePrecoUnitarioChange = (novoPreco: number) => {
    setPrecoUnitario(novoPreco)
    setValorTotal(Number((quantidade * novoPreco).toFixed(2)))
  }

  const handleEdit = (v: Venda) => {
    setEditingId(v.id)
    setClienteId(v.cliente_id || '')
    setProdutoId(v.produto_id || '')
    setProdutoNome(v.produto_nome || '')
    setQuantidade(v.quantidade)
    setUnidade(v.unidade)
    setPrecoUnitario(v.preco_unitario)
    setValorTotal(v.valor_total)
    setDataVenda(toInputDate(v.data_venda))
    setFormaPagamento(v.forma_pagamento || 'Pix')
    setStatus(v.status)
    setNotaFiscal(v.nota_fiscal || '')
    setObservacoes(v.observacoes || '')
    setGerarReceberAoSalvar(false)
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) {
      toast({ title: 'Selecione um cliente cadastrado', variant: 'destructive' })
      return
    }
    if (quantidade <= 0 || precoUnitario <= 0 || valorTotal <= 0) {
      toast({ title: 'Informe quantidade e preços válidos', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const cli = clientes.find((c) => c.id === clienteId)
      const dataIso = new Date(`${dataVenda}T12:00:00Z`).toISOString()

      const payload = {
        empresa_id: currentEmpresa!.id,
        cliente_id: clienteId,
        produto_id: produtoId || null,
        produto_nome: produtoNome,
        quantidade: Number(quantidade),
        unidade,
        preco_unitario: Number(precoUnitario),
        valor_total: Number(valorTotal),
        data_venda: dataIso,
        forma_pagamento: formaPagamento,
        status,
        nota_fiscal: notaFiscal.trim() || null,
        observacoes: observacoes.trim() || null,
      }

      let vendaSalva: Venda
      if (editingId) {
        vendaSalva = await vendasService.atualizar(editingId, payload)
        toast({ title: 'Venda atualizada com sucesso!' })
      } else {
        vendaSalva = await vendasService.criar(payload)

        // Se marcou para gerar Conta a Receber automaticamente
        if (gerarReceberAoSalvar) {
          await criarContaReceberParaVenda(vendaSalva, dataVenda, 1)
        }

        toast({ title: 'Venda cadastrada com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar venda',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Gerar Conta a Receber vinculada à Venda
  const criarContaReceberParaVenda = async (
    v: Venda,
    dataVencimentoStr: string,
    numParcelas: number,
  ) => {
    try {
      const cli = clientes.find((c) => c.id === v.cliente_id)
      const desc = `Venda ${v.produto_nome || 'Brita'} - ${v.quantidade} ${v.unidade} (${cli?.nome || 'Cliente'})`
      const vencIso = new Date(`${dataVencimentoStr}T12:00:00Z`).toISOString()

      // Buscar categoria de receita com brita ou vendas
      const categorias = await pb.collection('plano_contas').getFullList({
        filter: `empresa_id = '${currentEmpresa!.id}' && tipo = 'Receita'`,
      })
      const catVendas =
        categorias.find((c) => c.nome.toLowerCase().includes('venda')) || categorias[0]

      const contaCriada = await pb.collection('contas_receber').create({
        empresa_id: currentEmpresa!.id,
        cliente_id: v.cliente_id || null,
        descricao: desc,
        categoria_id: catVendas?.id || null,
        valor: v.valor_total,
        vencimento: vencIso,
        parcelas: numParcelas,
        status: v.status === 'Paga' ? 'Recebida' : 'Aberta',
        forma_recebimento: v.forma_pagamento === 'Pix' ? 'Pix' : 'Boleto',
        venda_id: v.id,
        nota: v.nota_fiscal || '',
        observacoes: `Título gerado a partir da Venda Pedreira #${v.id}. ${v.observacoes || ''}`,
      })

      // Atualizar venda gravando o conta_receber_id para rastreabilidade bidirecional
      await vendasService.atualizar(v.id, {
        conta_receber_id: contaCriada.id,
        status: v.status === 'Paga' ? 'Paga' : 'Faturada',
      })

      toast({
        title: 'Conta a Receber gerada!',
        description: `Título de ${formatCurrency(v.valor_total)} criado e vinculado à venda.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar conta a receber',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (v: Venda) => {
    if (!confirm(`Deseja realmente remover esta venda de ${v.produto_nome}?`)) return
    try {
      await vendasService.remover(v.id)
      toast({ title: 'Venda excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir venda',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      if (selectedClienteFilter !== 'todos' && v.cliente_id !== selectedClienteFilter) {
        return false
      }
      if (selectedProdutoFilter !== 'todos') {
        const prodMatch =
          v.produto_id === selectedProdutoFilter ||
          (v.produto_nome &&
            v.produto_nome.toLowerCase().includes(selectedProdutoFilter.toLowerCase()))
        if (!prodMatch) return false
      }
      if (selectedStatusFilter !== 'todos' && v.status !== selectedStatusFilter) {
        return false
      }
      if (!estaDentroDoPeriodo(v.data_venda, dataInicio, dataFim)) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cliNome = v.expand?.cliente_id?.nome?.toLowerCase() || ''
        const prodNome = (v.produto_nome || '').toLowerCase()
        const nf = (v.nota_fiscal || '').toLowerCase()
        return cliNome.includes(q) || prodNome.includes(q) || nf.includes(q)
      }
      return true
    })
  }, [
    vendas,
    selectedClienteFilter,
    selectedProdutoFilter,
    selectedStatusFilter,
    dataInicio,
    dataFim,
    searchQuery,
  ])

  // KPIs do topo
  const kpis = useMemo(() => {
    const totalQtd = filteredVendas.reduce((acc, v) => acc + (v.quantidade || 0), 0)
    const totalFaturado = filteredVendas.reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const pagasTotal = filteredVendas
      .filter((v) => v.status === 'Paga')
      .reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const pendentesTotal = filteredVendas
      .filter((v) => v.status === 'Pendente' || v.status === 'Faturada')
      .reduce((acc, v) => acc + (v.valor_total || 0), 0)

    return {
      totalVendas: filteredVendas.length,
      totalQtd,
      totalFaturado,
      pagasTotal,
      pendentesTotal,
    }
  }, [filteredVendas])

  // Entregas vinculadas à venda selecionada para detalhes
  const entregasDaVenda = useMemo(() => {
    if (!detalheVenda) return []
    return entregas.filter(
      (e) =>
        e.venda_id === detalheVenda.id ||
        (e.cliente_id === detalheVenda.cliente_id &&
          e.data.slice(0, 10) === detalheVenda.data_venda.slice(0, 10)),
    )
  }, [detalheVenda, entregas])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Gestão de Vendas da Pedreira
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Financeiro Integrado
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cadastro de vendas com amarração direta a Entregas da frota e Contas a Receber
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Venda
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total de Vendas</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{kpis.totalVendas}</div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            {kpis.totalQtd.toLocaleString('pt-BR')} m³ / ton carregados
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Faturamento Total</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-800 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.totalFaturado)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Volume do período filtrado</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Recebido / Pago</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-900 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.pagasTotal)}
          </div>
          <p className="text-[11px] text-blue-600 mt-0.5">Vendas liquidadas</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              A Receber / Aberto
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-900 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.pendentesTotal)}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">Pendentes ou faturadas</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente, produto ou nota fiscal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Cliente */}
            <Select value={selectedClienteFilter} onValueChange={setSelectedClienteFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Produto */}
            <Select value={selectedProdutoFilter} onValueChange={setSelectedProdutoFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Produtos</SelectItem>
                {PRODUTOS_PEDREIRA_PADRAO.map((pNome) => (
                  <SelectItem key={pNome} value={pNome}>
                    {pNome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Status */}
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="w-[140px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Faturada">Faturada</SelectItem>
                <SelectItem value="Paga">Paga</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Barra de Filtro de Período padrão Contas a Pagar/Receber */}
        <FiltroPeriodoBar
          rotulo="Data da venda:"
          opcaoPeriodo={opcaoPeriodo}
          onOpcaoChange={setOpcaoPeriodo}
          dataInicio={dataInicio}
          onDataInicioChange={setDataInicio}
          dataFim={dataFim}
          onDataFimChange={setDataFim}
          mostrarLimpar={
            opcaoPeriodo !== 'todos' ||
            Boolean(dataInicio || dataFim) ||
            selectedClienteFilter !== 'todos' ||
            selectedProdutoFilter !== 'todos' ||
            selectedStatusFilter !== 'todos' ||
            Boolean(searchQuery.trim())
          }
          onLimpar={() => {
            setOpcaoPeriodo('todos')
            setDataInicio('')
            setDataFim('')
            setSelectedClienteFilter('todos')
            setSelectedProdutoFilter('todos')
            setSelectedStatusFilter('todos')
            setSearchQuery('')
          }}
        />
      </Card>

      {/* Tabela de Vendas */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Produto da Pedreira</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4 text-right">Preço Unit.</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Entregas</th>
                <th className="py-3 px-4 text-center">Receber</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Carregando vendas...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Nenhuma venda encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredVendas.map((v) => {
                  const cliNome = v.expand?.cliente_id?.nome || 'Cliente não identificado'
                  const entregasVinculadas = entregas.filter((e) => e.venda_id === v.id)
                  const temContaReceber = !!v.conta_receber_id

                  return (
                    <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(v.data_venda)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 max-w-[220px] truncate">
                        {cliNome}
                        {v.nota_fiscal && (
                          <span className="block text-[10px] text-gray-400 font-mono">
                            NF: {v.nota_fiscal}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Package className="w-3.5 h-3.5 text-teal-700" />
                          <span>{v.produto_nome || 'Brita'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                        {v.quantidade}{' '}
                        <span className="font-normal text-gray-500">{v.unidade}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatCurrency(v.preco_unitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-800 tabular-nums">
                        {formatCurrency(v.valor_total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`text-[10px] uppercase font-semibold ${
                            v.status === 'Paga'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : v.status === 'Faturada'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : v.status === 'Cancelada'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {entregasVinculadas.length > 0 ? (
                          <Badge
                            variant="outline"
                            onClick={() => setDetalheVenda(v)}
                            className="cursor-pointer border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 text-[10px]"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            {entregasVinculadas.length} entrega(s)
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {temContaReceber ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px]"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Gerada
                          </Badge>
                        ) : canEdit && v.status !== 'Cancelada' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVendaParaReceber(v)
                              setVencimentoReceber(toInputDate(new Date().toISOString()))
                              setParcelasReceber(1)
                              setModalReceberOpen(true)
                            }}
                            className="h-7 text-[10px] text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 font-semibold"
                          >
                            <Receipt className="w-3 h-3 mr-1" />
                            Gerar Título
                          </Button>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetalheVenda(v)}
                            title="Ver detalhes e entregas vinculadas"
                            className="h-7 w-7 text-gray-500 hover:text-teal-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(v)}
                                title="Editar venda"
                                className="h-7 w-7 text-gray-500 hover:text-gray-900"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(v)}
                                title="Excluir venda"
                                className="h-7 w-7 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredVendas.length > 0 && (
              <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold text-gray-900">
                <tr>
                  <td colSpan={3} className="py-3 px-4">
                    TOTALIZADOR ({filteredVendas.length} vendas)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {kpis.totalQtd.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400">—</td>
                  <td className="py-3 px-4 text-right font-mono text-teal-900 text-sm">
                    {formatCurrency(kpis.totalFaturado)}
                  </td>
                  <td colSpan={4} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Drawer de Cadastro / Edição de Venda */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-[#ECEAE4]">
            <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-700" />
              <span>{editingId ? 'Editar Venda' : 'Nova Venda da Pedreira'}</span>
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Cliente *</Label>
              <ComboboxPesquisavel
                value={clienteId}
                onChange={setClienteId}
                placeholder="Pesquisar ou selecionar cliente..."
                searchPlaceholder="Digitar nome do cliente..."
                emptyText="Nenhum cliente encontrado."
                triggerClassName="bg-[#FAF9F7] border-[#ECEAE4]"
                options={clientes.map((c) => ({
                  id: c.id,
                  label: c.nome,
                  sublabel: c.cidade || c.cnpj_cpf || undefined,
                }))}
              />
            </div>

            {/* Produto da Pedreira */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Produto da Pedreira *</Label>
                <ComboboxPesquisavel
                  value={produtoId}
                  onChange={handleProdutoChange}
                  placeholder="Pesquisar ou selecionar produto..."
                  searchPlaceholder="Digitar produto..."
                  emptyText="Nenhum produto encontrado."
                  triggerClassName="bg-[#FAF9F7] border-[#ECEAE4]"
                  options={produtos.map((p) => ({
                    id: p.id,
                    label: p.nome,
                    sublabel:
                      p.categoria || (p.preco_venda ? formatCurrency(p.preco_venda) : undefined),
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Unidade de Medida</Label>
                <Select value={unidade} onValueChange={(u: any) => setUnidade(u)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³ (Metro Cúbico)</SelectItem>
                    <SelectItem value="ton">ton (Tonelada)</SelectItem>
                    <SelectItem value="viagem">viagem (Carga Fechada)</SelectItem>
                    <SelectItem value="un">un (Unidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantidade e Preço Unitário */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Quantidade *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantidade}
                  onChange={(e) => handleQuantidadeChange(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Preço Unitário (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoUnitario}
                  onChange={(e) => handlePrecoUnitarioChange(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
                  className="bg-teal-50/70 border-teal-200 text-teal-900 text-xs h-9 font-mono font-bold"
                />
              </div>
            </div>

            {/* Data e Forma de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Data da Venda *</Label>
                <Input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={(f: any) => setFormaPagamento(f)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferência">Transferência / TED</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="A Prazo">A Prazo / Faturado</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status e Nota Fiscal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Status da Venda *</Label>
                <Select value={status} onValueChange={(s: any) => setStatus(s)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Faturada">Faturada</SelectItem>
                    <SelectItem value="Paga">Paga</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Nota Fiscal / Documento</Label>
                <Input
                  placeholder="Ex: NF-e 1420"
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Checkbox para Gerar Conta a Receber automaticamente se for novo */}
            {!editingId && (
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gerarReceberCheck"
                  checked={gerarReceberAoSalvar}
                  onChange={(e) => setGerarReceberAoSalvar(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                />
                <label
                  htmlFor="gerarReceberCheck"
                  className="text-xs text-teal-900 font-medium cursor-pointer"
                >
                  Gerar Conta a Receber automaticamente no Financeiro
                </label>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Observações</Label>
              <Textarea
                placeholder="Detalhes adicionais, instrução de descarregamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="bg-[#FAF9F7] border-[#ECEAE4] text-xs"
              />
            </div>

            <SheetFooter className="pt-4 border-t border-[#ECEAE4]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDrawerOpen(false)}
                className="border-[#ECEAE4] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Venda'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal para Gerar Conta a Receber a partir da Venda */}
      <Dialog open={modalReceberOpen} onOpenChange={setModalReceberOpen}>
        <DialogContent className="max-w-md bg-white border-[#ECEAE4] p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-700" />
              <span>Gerar Conta a Receber da Venda</span>
            </DialogTitle>
          </DialogHeader>

          {vendaParaReceber && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-semibold text-gray-900">
                    {vendaParaReceber.expand?.cliente_id?.nome || 'Cliente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Produto:</span>
                  <span className="font-semibold text-gray-900">
                    {vendaParaReceber.produto_nome} ({vendaParaReceber.quantidade}{' '}
                    {vendaParaReceber.unidade})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor do Título:</span>
                  <span className="font-bold text-teal-800 text-sm font-mono">
                    {formatCurrency(vendaParaReceber.valor_total)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Data de Vencimento</Label>
                <Input
                  type="date"
                  value={vencimentoReceber}
                  onChange={(e) => setVencimentoReceber(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Número de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={parcelasReceber}
                  onChange={(e) => setParcelasReceber(parseInt(e.target.value) || 1)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-[#ECEAE4]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReceberOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (vendaParaReceber) {
                  criarContaReceberParaVenda(vendaParaReceber, vencimentoReceber, parcelasReceber)
                  setModalReceberOpen(false)
                }
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              Confirmar e Gerar Título
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Venda & Entregas Vinculadas */}
      <Dialog open={!!detalheVenda} onOpenChange={(open) => !open && setDetalheVenda(null)}>
        <DialogContent className="max-w-2xl bg-white border-[#ECEAE4] p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
          {detalheVenda && (
            <>
              <DialogHeader className="pb-3 border-b border-[#ECEAE4]">
                <DialogTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-teal-700" />
                    <span>Detalhes da Venda #{detalheVenda.id.slice(0, 8)}</span>
                  </div>
                  <Badge className="bg-teal-100 text-teal-900 text-xs">{detalheVenda.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Resumo da Venda */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Cliente</span>
                    <span className="font-semibold text-gray-900">
                      {detalheVenda.expand?.cliente_id?.nome || 'Cliente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Produto</span>
                    <span className="font-semibold text-gray-900">{detalheVenda.produto_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Quantidade</span>
                    <span className="font-semibold font-mono text-gray-900">
                      {detalheVenda.quantidade} {detalheVenda.unidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Preço Unitário
                    </span>
                    <span className="font-semibold font-mono text-gray-900">
                      {formatCurrency(detalheVenda.preco_unitario)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Valor Total</span>
                    <span className="font-bold font-mono text-teal-800 text-sm">
                      {formatCurrency(detalheVenda.valor_total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Data</span>
                    <span className="font-mono text-gray-900">
                      {formatDate(detalheVenda.data_venda)}
                    </span>
                  </div>
                </div>

                {detalheVenda.observacoes && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-400 block uppercase font-semibold">
                      Observações
                    </span>
                    <p className="text-gray-700 mt-1">{detalheVenda.observacoes}</p>
                  </div>
                )}

                {/* Seção de Entregas Vinculadas */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                      <Truck className="w-4 h-4 text-teal-700" />
                      <span>Entregas Vinculadas a esta Venda ({entregasDaVenda.length})</span>
                    </div>
                  </div>

                  {entregasDaVenda.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-[#ECEAE4] rounded-xl text-gray-400">
                      Nenhuma entrega da frota vinculada a esta venda ainda.
                      <p className="text-[11px] text-gray-500 mt-1">
                        Cadastre na tela de <strong>Entrega</strong> selecionando esta venda.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-[#ECEAE4] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                          <tr>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Veículo / Placa</th>
                            <th className="py-2 px-3">Motorista</th>
                            <th className="py-2 px-3 text-right">Qtd Entregue</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ECEAE4]">
                          {entregasDaVenda.map((e) => (
                            <tr key={e.id}>
                              <td className="py-2 px-3 font-mono">{formatDate(e.data)}</td>
                              <td className="py-2 px-3 font-semibold text-gray-900">
                                {e.expand?.veiculo_id?.codigo_interno || 'Veículo'} •{' '}
                                {e.expand?.veiculo_id?.placa || e.expand?.veiculo_id?.modelo}
                              </td>
                              <td className="py-2 px-3 text-gray-600">
                                {e.motorista || 'Motorista padrão'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-gray-800">
                                {e.quantidade || 0} {e.unidade_medida || 'm³'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  className={`text-[9px] uppercase ${
                                    e.status === 'concluida'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {e.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#ECEAE4]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetalheVenda(null)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
