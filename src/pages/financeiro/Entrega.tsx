import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type { Entrega, Venda, Veiculo, Cliente, Produto, Funcionario } from '@/types/erp'
import { entregasService } from '@/services/entregas'
import { vendasService } from '@/services/vendas'
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
import { RomaneioEntregaImpressaoModal } from '@/components/frotas/RomaneioEntregaImpressaoModal'
import { toast } from '@/hooks/use-toast'
import {
  Truck,
  Plus,
  Search,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  Layers,
  FileText,
  DollarSign,
  TrendingUp,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  Link as LinkIcon,
} from 'lucide-react'

export default function EntregaPage() {
  const { currentEmpresa, canEdit } = useCompany()

  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')
  const [selectedVeiculoFilter, setSelectedVeiculoFilter] = useState('todos')
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Modal Romaneio Impressão
  const [entregaParaImprimir, setEntregaParaImprimir] = useState<Entrega | null>(null)
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false)

  // Drawer Cadastro / Edição
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [vendaId, setVendaId] = useState<string>('nenhuma')
  const [veiculoId, setVeiculoId] = useState<string>('')
  const [motorista, setMotorista] = useState<string>('')
  const [clienteNome, setClienteNome] = useState<string>('')
  const [origem, setOrigem] = useState<string>('Pedreira Cordeiro - Sertânia/PE')
  const [destino, setDestino] = useState<string>('')
  const [dataEntrega, setDataEntrega] = useState(() => toInputDate(new Date().toISOString()))
  const [produtoNome, setProdutoNome] = useState<string>('')
  const [quantidade, setQuantidade] = useState<number>(0)
  const [unidadeMedida, setUnidadeMedida] = useState<'m³' | 'ton' | 'viagem'>('m³')
  const [kmRodado, setKmRodado] = useState<number>(0)
  const [status, setStatus] = useState<'concluida' | 'em_transito' | 'cancelada'>('concluida')
  const [valorVenda, setValorVenda] = useState<number>(0)
  const [custoEstimado, setCustoEstimado] = useState<number>(0)
  const [observacoes, setObservacoes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Realtime
  useRealtime('entregas', () => loadData())
  useRealtime('vendas', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [eList, vList, veicList, cList, pList, funcList] = await Promise.all([
        entregasService.listar(currentEmpresa.id),
        vendasService.listar(currentEmpresa.id),
        pb.collection('veiculos').getFullList<Veiculo>({
          filter: `empresa_id = '${currentEmpresa.id}' && status = 'Ativo'`,
          sort: 'codigo_interno',
        }),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('produtos').getFullList<Produto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('funcionarios').getFullList<Funcionario>({
          filter: `empresa_id = '${currentEmpresa.id}' && status = 'Ativo'`,
          sort: 'nome',
        }),
      ])

      setEntregas(eList)
      setVendas(vList)
      setVeiculos(veicList)
      setClientes(cList)
      setProdutos(pList)
      setFuncionarios(funcList)
    } catch (err) {
      console.error('Erro ao carregar entregas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Abertura de modal
  const openCreateModal = () => {
    setEditingId(null)
    setVendaId('nenhuma')
    setVeiculoId(veiculos[0]?.id || '')
    setMotorista('')
    setClienteNome('')
    setOrigem('Pedreira Cordeiro - Sertânia/PE')
    setDestino('')
    setDataEntrega(toInputDate(new Date().toISOString()))
    setProdutoNome('Brita 12')
    setQuantidade(14)
    setUnidadeMedida('m³')
    setKmRodado(60)
    setStatus('concluida')
    setValorVenda(0)
    setCustoEstimado(150)
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  // Ao selecionar uma venda no seletor
  const handleVendaSelect = (vId: string) => {
    setVendaId(vId)
    if (vId === 'nenhuma') {
      return
    }
    const venda = vendas.find((v) => v.id === vId)
    if (venda) {
      const cli = clientes.find((c) => c.id === venda.cliente_id)
      setClienteNome(cli?.nome || venda.expand?.cliente_id?.nome || '')
      setDestino(cli?.cidade ? `${cli.nome} - ${cli.cidade}` : cli?.nome || '')
      setProdutoNome(venda.produto_nome || '')
      setQuantidade(venda.quantidade || 0)
      setUnidadeMedida((venda.unidade as any) || 'm³')
      setValorVenda(venda.valor_total || 0)
      if (venda.data_venda) {
        setDataEntrega(toInputDate(venda.data_venda))
      }
    }
  }

  const handleEdit = (e: Entrega) => {
    setEditingId(e.id)
    setVendaId(e.venda_id || 'nenhuma')
    setVeiculoId(e.veiculo_id)
    setMotorista(e.motorista || '')
    setClienteNome(e.cliente_nome || e.expand?.cliente_id?.nome || '')
    setOrigem(e.origem || 'Pedreira Cordeiro - Sertânia/PE')
    setDestino(e.destino || '')
    setDataEntrega(toInputDate(e.data))
    setProdutoNome(e.produto_nome || '')
    setQuantidade(e.quantidade || 0)
    setUnidadeMedida((e.unidade_medida as any) || 'm³')
    setKmRodado(e.km_rodado || 0)
    setStatus((e.status as any) || 'concluida')
    setValorVenda(e.valor_venda || 0)
    setCustoEstimado(e.custo_estimado || 0)
    setObservacoes(e.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleSave = async (evt: React.FormEvent) => {
    evt.preventDefault()
    if (!veiculoId) {
      toast({ title: 'Selecione um veículo da frota', variant: 'destructive' })
      return
    }
    if (!destino.trim() && !clienteNome.trim()) {
      toast({ title: 'Informe o destino ou cliente da entrega', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const dataIso = new Date(`${dataEntrega}T12:00:00Z`).toISOString()

      const vSelected = vendaId !== 'nenhuma' ? vendas.find((v) => v.id === vendaId) : null

      const payload = {
        empresa_id: currentEmpresa!.id,
        veiculo_id: veiculoId,
        venda_id: vSelected ? vSelected.id : null,
        cliente_id: vSelected?.cliente_id || null,
        cliente_nome: clienteNome.trim() || vSelected?.expand?.cliente_id?.nome || destino,
        data: dataIso,
        origem: origem.trim() || 'Pedreira Cordeiro',
        destino: destino.trim() || clienteNome,
        km_rodado: Number(kmRodado) || 0,
        motorista: motorista.trim() || null,
        produto_nome: produtoNome.trim() || null,
        quantidade: Number(quantidade) || 0,
        unidade_medida: unidadeMedida,
        valor_venda: Number(valorVenda) || null,
        custo_estimado: Number(custoEstimado) || 0,
        status,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await entregasService.atualizar(editingId, payload)
        toast({ title: 'Entrega atualizada com sucesso!' })
      } else {
        await entregasService.criar(payload)
        toast({ title: 'Entrega vinculada e registrada com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar entrega',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (e: Entrega) => {
    if (!confirm('Deseja realmente remover esta entrega?')) return
    try {
      await entregasService.remover(e.id)
      toast({ title: 'Entrega excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir entrega',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const filteredEntregas = useMemo(() => {
    return entregas.filter((e) => {
      if (selectedStatusFilter !== 'todos' && e.status !== selectedStatusFilter) {
        return false
      }
      if (selectedVeiculoFilter !== 'todos' && e.veiculo_id !== selectedVeiculoFilter) {
        return false
      }
      if (selectedPeriodo) {
        const eDate = e.data.slice(0, 7)
        if (eDate !== selectedPeriodo) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const dest = (e.destino || '').toLowerCase()
        const mot = (e.motorista || '').toLowerCase()
        const cli = (e.cliente_nome || e.expand?.cliente_id?.nome || '').toLowerCase()
        const prod = (e.produto_nome || '').toLowerCase()
        const placa = (e.expand?.veiculo_id?.placa || '').toLowerCase()
        const cod = (e.expand?.veiculo_id?.codigo_interno || '').toLowerCase()
        return (
          dest.includes(q) ||
          mot.includes(q) ||
          cli.includes(q) ||
          prod.includes(q) ||
          placa.includes(q) ||
          cod.includes(q)
        )
      }
      return true
    })
  }, [entregas, selectedStatusFilter, selectedVeiculoFilter, selectedPeriodo, searchQuery])

  // KPIs
  const kpis = useMemo(() => {
    const totalEntregas = filteredEntregas.length
    const totalQtd = filteredEntregas.reduce((acc, e) => acc + (e.quantidade || 0), 0)
    const totalKm = filteredEntregas.reduce((acc, e) => acc + (e.km_rodado || 0), 0)
    const totalValor = filteredEntregas.reduce(
      (acc, e) => acc + (e.valor_venda || e.expand?.venda_id?.valor_total || 0),
      0,
    )

    return {
      totalEntregas,
      totalQtd,
      totalKm,
      totalValor,
    }
  }, [filteredEntregas])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Controle de Entregas & Romaneios
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">Frota × Vendas</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Relação direta com Vendas da pedreira, vinculação do equipamento da frota e emissão do
            Romaneio A4 oficial
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Entrega
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Entregas</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {kpis.totalEntregas}
          </div>
          <p className="text-[11px] text-teal-700 mt-0.5">Viagens registradas</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Volume Entregue</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-900 mt-2 font-mono tabular-nums">
            {kpis.totalQtd.toLocaleString('pt-BR')} m³ / ton
          </div>
          <p className="text-[11px] text-blue-600 mt-0.5">Agregados transportados</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Km Total Rodado</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-900 mt-2 font-mono tabular-nums">
            {kpis.totalKm.toLocaleString('pt-BR')} km
          </div>
          <p className="text-[11px] text-indigo-600 mt-0.5">Quilometragem acumulada</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Valor das Cargas</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-900 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.totalValor)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Valor faturado associado</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por destino, cliente, motorista, produto ou placa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Input
                type="month"
                value={selectedPeriodo}
                onChange={(e) => setSelectedPeriodo(e.target.value)}
                className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
              />
            </div>

            <Select value={selectedVeiculoFilter} onValueChange={setSelectedVeiculoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Veículos</SelectItem>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.codigo_interno} • {v.placa || v.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="w-[140px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="concluida">Entregue / Concluída</SelectItem>
                <SelectItem value="em_transito">Em Trânsito</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabela de Entregas */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Venda Vinculada</th>
                <th className="py-3 px-4">Cliente / Destino</th>
                <th className="py-3 px-4">Equipamento / Placa</th>
                <th className="py-3 px-4">Motorista</th>
                <th className="py-3 px-4 text-right">Qtd Entregue</th>
                <th className="py-3 px-4 text-right">Valor Venda</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Carregando entregas...
                  </td>
                </tr>
              ) : filteredEntregas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Nenhuma entrega encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEntregas.map((e) => {
                  const veic = e.expand?.veiculo_id
                  const venda = e.expand?.venda_id
                  const clienteFinal =
                    e.cliente_nome ||
                    e.expand?.cliente_id?.nome ||
                    venda?.expand?.cliente_id?.nome ||
                    e.destino

                  const valorFinal = e.valor_venda || venda?.valor_total || 0

                  return (
                    <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(e.data)}
                      </td>
                      <td className="py-3 px-4">
                        {venda ? (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-mono"
                            >
                              <LinkIcon className="w-2.5 h-2.5 mr-1" />
                              Venda #{venda.id.slice(0, 6)}
                            </Badge>
                          </div>
                        ) : e.venda_id ? (
                          <Badge
                            variant="outline"
                            className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-mono"
                          >
                            <LinkIcon className="w-2.5 h-2.5 mr-1" />
                            Venda #{e.venda_id.slice(0, 6)}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">
                            Avulsa / Sem venda
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900 block truncate max-w-[200px]">
                          {clienteFinal}
                        </span>
                        {e.destino && e.destino !== clienteFinal && (
                          <span className="text-[10px] text-gray-500 block truncate max-w-[200px]">
                            {e.destino}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900 block font-mono">
                          {veic?.codigo_interno || 'Equipamento'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {veic?.placa ? `Placa: ${veic.placa}` : veic?.modelo || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {e.motorista || e.expand?.funcionario_id?.nome || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                        {e.quantidade || 0}{' '}
                        <span className="font-normal text-gray-500">
                          {e.unidade_medida || 'm³'}
                        </span>
                        {e.produto_nome && (
                          <span className="block text-[10px] text-teal-700 font-normal">
                            {e.produto_nome}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 tabular-nums">
                        {valorFinal > 0 ? formatCurrency(valorFinal) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`text-[10px] uppercase font-semibold ${
                            e.status === 'concluida'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : e.status === 'em_transito'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {e.status === 'concluida'
                            ? 'Entregue'
                            : e.status === 'em_transito'
                              ? 'Em Trânsito'
                              : 'Cancelada'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEntregaParaImprimir(e)
                              setModalImprimirOpen(true)
                            }}
                            title="Imprimir Romaneio A4 Grupo Pedreira Cordeiro"
                            className="h-7 w-7 text-teal-700 hover:text-teal-900 hover:bg-teal-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(e)}
                                title="Editar entrega"
                                className="h-7 w-7 text-gray-500 hover:text-gray-900"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(e)}
                                title="Excluir entrega"
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
            {filteredEntregas.length > 0 && (
              <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold text-gray-900">
                <tr>
                  <td colSpan={5} className="py-3 px-4">
                    TOTALIZADOR ({filteredEntregas.length} entregas)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {kpis.totalQtd.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-900 text-sm">
                    {formatCurrency(kpis.totalValor)}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Drawer de Cadastro / Edição */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-[#ECEAE4]">
            <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-700" />
              <span>{editingId ? 'Editar Entrega' : 'Cadastrar Entrega da Pedreira'}</span>
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            {/* Seletor de Venda Vinculada */}
            <div className="space-y-1.5 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
              <Label className="text-teal-900 font-bold flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-teal-700" />
                Venda Vinculada (Puxe os dados da venda)
              </Label>
              <ComboboxPesquisavel
                value={vendaId}
                onChange={handleVendaSelect}
                placeholder="Pesquisar venda para vincular..."
                searchPlaceholder="Buscar por cliente, produto ou #ID..."
                emptyText="Nenhuma venda encontrada."
                triggerClassName="bg-white border-[#ECEAE4]"
                options={[
                  { id: 'nenhuma', label: 'Nenhuma (Entrega avulsa)' },
                  ...vendas.map((v) => ({
                    id: v.id,
                    label: `#${v.id.slice(0, 6)} • ${v.expand?.cliente_id?.nome || 'Cliente'} — ${v.produto_nome}`,
                    sublabel: `${v.quantidade} ${v.unidade} - ${formatCurrency(v.valor_total)}`,
                    keywords: [v.expand?.cliente_id?.nome || '', v.produto_nome || '', v.id],
                  })),
                ]}
              />
              <p className="text-[11px] text-teal-700">
                Ao selecionar a venda, cliente, produto, quantidade e valor são preenchidos
                automaticamente.
              </p>
            </div>

            {/* Veículo da Frota e Motorista */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Equipamento / Placa da Frota *</Label>
                <ComboboxPesquisavel
                  value={veiculoId}
                  onChange={setVeiculoId}
                  placeholder="Pesquisar veículo..."
                  searchPlaceholder="Buscar por código, placa ou modelo..."
                  emptyText="Nenhum veículo encontrado."
                  triggerClassName="bg-[#FAF9F7] border-[#ECEAE4] font-mono"
                  options={veiculos.map((v) => ({
                    id: v.id,
                    label: `${v.codigo_interno} • ${v.placa ? `${v.placa} (${v.modelo})` : v.modelo}`,
                    sublabel: v.setor || undefined,
                    keywords: [v.codigo_interno, v.placa || '', v.modelo],
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Motorista / Condutor</Label>
                <Input
                  placeholder="Nome do motorista"
                  value={motorista}
                  onChange={(e) => setMotorista(e.target.value)}
                  list="funcionarios-motoristas-list"
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
                />
                <datalist id="funcionarios-motoristas-list">
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.nome}>
                      {f.cargo ? `${f.cargo} - ${f.setor}` : f.setor}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Cliente / Destino */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Cliente</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Destino / Local de Descarrego</Label>
                <Input
                  placeholder="Ex: Obra Centro Sertânia"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
                />
              </div>
            </div>

            {/* Data e Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Data da Entrega *</Label>
                <Input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Status da Entrega *</Label>
                <Select value={status} onValueChange={(s: any) => setStatus(s)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concluida">Entregue / Concluída</SelectItem>
                    <SelectItem value="em_transito">Em Trânsito</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Produto e Quantidade Entregue */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Produto</Label>
                <Input
                  placeholder="Ex: Brita 19"
                  value={produtoNome}
                  onChange={(e) => setProdutoNome(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Qtd Entregue *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Unidade</Label>
                <Select value={unidadeMedida} onValueChange={(u: any) => setUnidadeMedida(u)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="ton">ton</SelectItem>
                    <SelectItem value="viagem">viagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Km e Custos */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Km Rodado</Label>
                <Input
                  type="number"
                  value={kmRodado}
                  onChange={(e) => setKmRodado(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Custo Estimado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={custoEstimado}
                  onChange={(e) => setCustoEstimado(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Valor da Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(parseFloat(e.target.value) || 0)}
                  className="bg-emerald-50/70 border-emerald-200 text-emerald-900 text-xs h-9 font-mono font-bold"
                />
              </div>
            </div>

            {/* Origem */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Origem da Carga</Label>
              <Input
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Observações da Entrega</Label>
              <Textarea
                placeholder="Observações do motorista, condições do acesso..."
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
                {isSubmitting
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar Alterações'
                    : 'Cadastrar Entrega'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal Impressão A4 de Romaneio */}
      <RomaneioEntregaImpressaoModal
        entrega={entregaParaImprimir}
        empresa={currentEmpresa}
        open={modalImprimirOpen}
        onOpenChange={setModalImprimirOpen}
      />
    </div>
  )
}
