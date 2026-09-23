import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/formatters'
import type { Veiculo, TipoVeiculo, TipoMedidor, StatusVeiculo } from '@/types/erp'
import {
  SETORES_FROTA,
  SETORES_PEDREIRA,
  TIPO_LABELS,
  normalizarSetorFrota,
  veiculoCorrespondeAoSetor,
} from '@/lib/frota'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Gauge,
  Clock,
  Wrench,
  CheckCircle2,
  Construction,
  Filter,
  DollarSign,
  Layers,
  Receipt,
} from 'lucide-react'
import { DespesasVeiculoModal } from '@/components/frotas/DespesasVeiculoModal'

// Re-exporta para compatibilidade reversa caso outros módulos importem daqui
export { SETORES_PEDREIRA, TIPO_LABELS }

export default function Veiculos() {
  const { currentEmpresa, canEdit } = useCompany()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [setorFilter, setSetorFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalDespesasVeiculoOpen, setModalDespesasVeiculoOpen] = useState(false)
  const [veiculoParaDespesas, setVeiculoParaDespesas] = useState<Veiculo | null>(null)

  const [codigoInterno, setCodigoInterno] = useState('')
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState<TipoVeiculo>('caminhao')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState<number>(new Date().getFullYear())
  const [setor, setSetor] = useState('Central Britagem')
  const [valorEstimado, setValorEstimado] = useState<number>(0)
  const [tipoMedidor, setTipoMedidor] = useState<TipoMedidor>('ambos')
  const [kmAtual, setKmAtual] = useState<number>(0)
  const [horimetroAtual, setHorimetroAtual] = useState<number>(0)
  const [combustivelPadrao, setCombustivelPadrao] = useState('Diesel S10')
  const [status, setStatus] = useState<StatusVeiculo>('ativo')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('veiculos', () => loadVeiculos())

  const loadVeiculos = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const res = await pb.collection('veiculos').getFullList<Veiculo>({
        filter: `empresa_id = '${currentEmpresa.id}'`,
        sort: 'codigo_interno',
      })
      setVeiculos(res)
    } catch (err) {
      console.error('Error fetching veiculos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVeiculos()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setCodigoInterno(`EQ-${String(veiculos.length + 1).padStart(2, '0')}`)
    setPlaca('')
    setTipo('caminhao')
    setMarca('')
    setModelo('')
    setAno(new Date().getFullYear())
    setSetor('Central Britagem')
    setValorEstimado(0)
    setTipoMedidor('ambos')
    setKmAtual(0)
    setHorimetroAtual(0)
    setCombustivelPadrao('Diesel S10')
    setStatus('ativo')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (v: Veiculo) => {
    setEditingId(v.id)
    setCodigoInterno(v.codigo_interno)
    setPlaca(v.placa || '')
    setTipo(v.tipo)
    setMarca(v.marca || '')
    setModelo(v.modelo)
    setAno(v.ano || new Date().getFullYear())
    setSetor(v.setor || 'Central Britagem')
    setValorEstimado(v.valor_estimado || 0)
    setTipoMedidor(v.tipo_medidor || 'ambos')
    setKmAtual(v.km_atual || 0)
    setHorimetroAtual(v.horimetro_atual || 0)
    setCombustivelPadrao(v.combustivel_padrao || 'Diesel S10')
    setStatus(v.status)
    setObservacoes(v.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigoInterno.trim() || !modelo.trim()) {
      toast({ title: 'Preencha o código interno e o modelo', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        codigo_interno: codigoInterno.trim().toUpperCase(),
        placa: placa.trim().toUpperCase() || null,
        tipo,
        marca: marca.trim() || null,
        modelo: modelo.trim(),
        ano: Number(ano) || null,
        setor,
        valor_estimado: Number(valorEstimado) || 0,
        tipo_medidor: tipoMedidor,
        km_atual: Number(kmAtual) || 0,
        horimetro_atual: Number(horimetroAtual) || 0,
        medidor_atual: Number(kmAtual) > 0 ? Number(kmAtual) : Number(horimetroAtual) || 0,
        combustivel_padrao: combustivelPadrao,
        status,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('veiculos').update(editingId, payload)
        toast({ title: 'Veículo/equipamento atualizado com sucesso!' })
      } else {
        await pb.collection('veiculos').create(payload)
        toast({ title: 'Veículo/equipamento cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadVeiculos()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar veículo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, codigo: string) => {
    if (!confirm(`Deseja realmente remover o equipamento ${codigo}?`)) return
    try {
      await pb.collection('veiculos').delete(id)
      toast({ title: 'Equipamento excluído com sucesso.' })
      await loadVeiculos()
    } catch (err: any) {
      toast({
        title: 'Não foi possível excluir',
        description:
          err.message || 'Verifique se existem abastecimentos ou manutenções vinculados.',
        variant: 'destructive',
      })
    }
  }

  const filteredVeiculos = useMemo(() => {
    return veiculos.filter((v) => {
      if (tipoFilter !== 'todos' && v.tipo !== tipoFilter) return false
      if (setorFilter !== 'todos' && !veiculoCorrespondeAoSetor(v.setor, setorFilter)) return false
      if (statusFilter !== 'todos' && v.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          v.codigo_interno.toLowerCase().includes(q) ||
          v.modelo.toLowerCase().includes(q) ||
          (v.marca && v.marca.toLowerCase().includes(q)) ||
          (v.placa && v.placa.toLowerCase().includes(q)) ||
          (v.setor && v.setor.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [veiculos, tipoFilter, setorFilter, statusFilter, searchQuery])

  // Contagem de equipamentos por setor principal da pedreira
  const contagemPorSetor = useMemo(() => {
    const counts: Record<string, number> = {
      todos: veiculos.length,
      Entrega: 0,
      'Central Britagem': 0,
      'Central de Concreto': 0,
      'Central Britagem Lokotrack': 0,
      'Engenharia / Supervisão': 0,
    }
    veiculos.forEach((v) => {
      const norm = normalizarSetorFrota(v.setor)
      if (counts[norm] !== undefined) {
        counts[norm] += 1
      } else if (v.setor && counts[v.setor] !== undefined) {
        counts[v.setor] += 1
      }
    })
    return counts
  }, [veiculos])

  // KPIs
  const totalEquipamentos = veiculos.length
  const totalAtivos = veiculos.filter((v) => v.status === 'ativo').length
  const totalManutencao = veiculos.filter((v) => v.status === 'manutencao').length
  const valorTotalFrota = veiculos.reduce((acc, v) => acc + (v.valor_estimado || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Frota & Maquinário Real da Pedreira
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300">
              Grupo Pedreira Cordeiro
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle duplo independente por Km (odômetro) e Horas (horímetro) em todas as áreas
            operacionais (Britagem, Entrega, Concreto, Lokotrack e Supervisão)
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Equipamento
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Frota Total</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Construction className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{totalEquipamentos}</div>
          <p className="text-[11px] text-teal-700 mt-0.5">Veículos & Máquinas reais</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Operação</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{totalAtivos}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Equipamentos ativos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Manutenção</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2 font-mono">{totalManutencao}</div>
          <p className="text-[11px] text-amber-700 mt-0.5">Parados em oficina</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Patrimônio Avaliado
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-900 mt-2 font-mono tabular-nums truncate">
            {formatCurrency(valorTotalFrota)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Valor da frota cadastrada</p>
        </Card>
      </div>

      {/* Setores da Frota - Barra de Navegação Rápida por Setor (Badges/Filtros) */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
          <Layers className="w-3.5 h-3.5 text-teal-700" />
          <span>Setor / Operação:</span>
        </span>
        <button
          type="button"
          onClick={() => setSetorFilter('todos')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            setorFilter === 'todos'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-white border border-[#ECEAE4] text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>Todos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              setorFilter === 'todos' ? 'bg-teal-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {contagemPorSetor.todos || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSetorFilter('Entrega')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            setorFilter === 'Entrega' || setorFilter === 'Entrega de Brita'
              ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/50'
              : 'bg-amber-50/70 border border-amber-200 text-amber-900 hover:bg-amber-100/70'
          }`}
        >
          <span>🚛 Entrega</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              setorFilter === 'Entrega' || setorFilter === 'Entrega de Brita'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {contagemPorSetor['Entrega'] || 0}
          </span>
        </button>

        {SETORES_FROTA.filter((s) => s !== 'Entrega').map((s) => {
          const isSelected = setorFilter === s
          const count = contagemPorSetor[s] || 0
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSetorFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white border border-[#ECEAE4] text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{s}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-teal-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="w-[220px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Setor / Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Setores (Áreas)</SelectItem>
                <SelectItem value="Entrega">Entrega (Caminhões e Caçambas)</SelectItem>
                <SelectItem value="Central Britagem">Central Britagem</SelectItem>
                <SelectItem value="Central de Concreto">Central de Concreto</SelectItem>
                <SelectItem value="Central Britagem Lokotrack">
                  Central Britagem Lokotrack
                </SelectItem>
                <SelectItem value="Engenharia / Supervisão">Engenharia / Supervisão</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Tipo de Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="escavadeira">Escavadeiras Hidráulicas</SelectItem>
                <SelectItem value="carregadeira">Pás Carregadeiras</SelectItem>
                <SelectItem value="caminhao">Caminhões de Entrega / Caçambas</SelectItem>
                <SelectItem value="betoneira">Caminhões Betoneira</SelectItem>
                <SelectItem value="pipa">Caminhões Pipa</SelectItem>
                <SelectItem value="bomba">Bombas de Concreto</SelectItem>
                <SelectItem value="britador">Lokotrack / Britadores</SelectItem>
                <SelectItem value="peneira">Peneiras Classificadoras</SelectItem>
                <SelectItem value="central_concreto">Centrais de Concreto</SelectItem>
                <SelectItem value="carro_passeio">Carros / Pickups</SelectItem>
                <SelectItem value="moto">Motos</SelectItem>
                <SelectItem value="outro">Outros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativo / Liberado</SelectItem>
                <SelectItem value="manutencao">Em Manutenção</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            {(tipoFilter !== 'todos' ||
              setorFilter !== 'todos' ||
              statusFilter !== 'todos' ||
              searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTipoFilter('todos')
                  setSetorFilter('todos')
                  setStatusFilter('todos')
                  setSearchQuery('')
                }}
                className="h-9 text-xs text-gray-500"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar código, modelo, placa, área..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Table of Equipment */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Cód. Interno</th>
                <th className="py-3 px-4">Equipamento / Modelo</th>
                <th className="py-3 px-4">Área / Setor</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Placa</th>
                <th className="py-3 px-4 text-right">Km (Odômetro)</th>
                <th className="py-3 px-4 text-right">Horímetro (Horas)</th>
                <th className="py-3 px-4 text-right">Valor Avaliado</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredVeiculos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Nenhum veículo ou equipamento encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredVeiculos.map((v) => {
                  const hasKm = (v.km_atual || 0) > 0
                  const hasHoras = (v.horimetro_atual || 0) > 0

                  return (
                    <tr key={v.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-800">
                        {v.codigo_interno}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{v.modelo}</div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          {v.marca && <span>{v.marca}</span>}
                          {v.ano && <span>• Ano {v.ano}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            normalizarSetorFrota(v.setor) === 'Entrega'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {v.setor || 'Geral'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px]">
                          <span>{TIPO_LABELS[v.tipo]?.icon || '🚛'}</span>
                          <span className="truncate max-w-[120px]">
                            {TIPO_LABELS[v.tipo]?.label.split('/')[0] || v.tipo}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase text-gray-600">
                        {v.placa || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {hasKm ? (
                          <div className="font-mono font-bold text-gray-900 tabular-nums">
                            {Number(v.km_atual).toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] text-gray-500 font-normal">km</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {hasHoras ? (
                          <div className="font-mono font-bold text-amber-800 tabular-nums">
                            {Number(v.horimetro_atual).toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] text-amber-600 font-normal">h</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-gray-800 tabular-nums">
                        {v.valor_estimado ? formatCurrency(v.valor_estimado) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            v.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : v.status === 'manutencao'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {v.status === 'ativo'
                            ? '● Ativo'
                            : v.status === 'manutencao'
                              ? '● Em Manutenção'
                              : '● Inativo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVeiculoParaDespesas(v)
                              setModalDespesasVeiculoOpen(true)
                            }}
                            className="h-7 px-2 text-teal-700 hover:text-teal-900 hover:bg-teal-50 text-[10px] font-semibold"
                            title="Ver todas as despesas e abatimentos deste equipamento"
                          >
                            <Receipt className="w-3 h-3 mr-1" />
                            Despesas
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(v)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar Equipamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(v.id, v.codigo_interno)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Equipamento / Veículo' : 'Novo Equipamento da Frota'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Código Interno *</Label>
                <Input
                  required
                  value={codigoInterno}
                  onChange={(e) => setCodigoInterno(e.target.value)}
                  placeholder="Ex: CBR-ESC-01, ENT-CAC-01"
                  className="mt-1 font-mono uppercase"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Placa / Registro</Label>
                <Input
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="Ex: OEZ-4I27 ou PC24/CE"
                  className="mt-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Área / Setor *</Label>
                <Select value={setor} onValueChange={setSetor}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrega">Entrega (Caminhões de Brita / Caçambas)</SelectItem>
                    <SelectItem value="Central Britagem">Central Britagem</SelectItem>
                    <SelectItem value="Central de Concreto">Central de Concreto</SelectItem>
                    <SelectItem value="Central Britagem Lokotrack">
                      Central Britagem Lokotrack
                    </SelectItem>
                    <SelectItem value="Engenharia / Supervisão">Engenharia / Supervisão</SelectItem>
                    {/* Opções legadas caso o veículo já tenha gravado outro texto */}
                    {![
                      'Entrega',
                      'Central Britagem',
                      'Central de Concreto',
                      'Central Britagem Lokotrack',
                      'Engenharia / Supervisão',
                    ].includes(setor) &&
                      setor && <SelectItem value={setor}>{setor}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Equipamento *</Label>
                <Select value={tipo} onValueChange={(v: TipoVeiculo) => setTipo(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caminhao">
                      Caminhão de Entrega / Basculante / Caçamba
                    </SelectItem>
                    <SelectItem value="escavadeira">Escavadeira Hidráulica</SelectItem>
                    <SelectItem value="carregadeira">Pá Carregadeira</SelectItem>
                    <SelectItem value="betoneira">Caminhão Betoneira</SelectItem>
                    <SelectItem value="pipa">Caminhão Pipa</SelectItem>
                    <SelectItem value="bomba">Bomba de Concreto</SelectItem>
                    <SelectItem value="britador">Lokotrack / Britador</SelectItem>
                    <SelectItem value="peneira">Peneira Classificadora</SelectItem>
                    <SelectItem value="central_concreto">Central de Concreto (Usina)</SelectItem>
                    <SelectItem value="carro_passeio">Carro / Pickup 4x4</SelectItem>
                    <SelectItem value="moto">Motocicleta</SelectItem>
                    <SelectItem value="perfuratriz">Perfuratriz</SelectItem>
                    <SelectItem value="trator">Trator / Motoniveladora</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Modelo *</Label>
                <Input
                  required
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: Escavadeira CAT 336 / Volvo VM 290"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Marca</Label>
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: CAT, Volvo"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Ano de Fabricação</Label>
                <Input
                  type="number"
                  value={ano || ''}
                  onChange={(e) => setAno(parseInt(e.target.value) || 0)}
                  placeholder="2022"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Avaliado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorEstimado || ''}
                  onChange={(e) => setValorEstimado(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* SEÇÃO DUPLA: CONTROLE POR KM E HORÍMETRO */}
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                  <Gauge className="w-4 h-4 text-amber-700" />
                  <span>Controle Duplo: Odômetro (Km) & Horímetro (Horas)</span>
                </span>
                <Badge variant="outline" className="bg-white text-[10px] text-amber-900">
                  Independentes
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800">
                Preencha um ou ambos os medidores. Caminhões e máquinas podem registrar Km e/ou
                horas de operação simultaneamente.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/80">
                  <Label className="text-[11px] font-semibold text-gray-800 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-teal-700" />
                    <span>Odômetro Atual (Km)</span>
                  </Label>
                  <Input
                    type="number"
                    value={kmAtual || ''}
                    onChange={(e) => setKmAtual(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono font-bold text-gray-900 h-8"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Distância percorrida em rodovias ou lavra
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-200/80">
                  <Label className="text-[11px] font-semibold text-gray-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Horímetro Atual (Horas)</span>
                  </Label>
                  <Input
                    type="number"
                    value={horimetroAtual || ''}
                    onChange={(e) => setHorimetroAtual(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono font-bold text-amber-900 h-8"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Horas de motor/britagem em funcionamento
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Combustível Padrão</Label>
                <Select value={combustivelPadrao} onValueChange={setCombustivelPadrao}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Diesel S10">Diesel S10 (Pedreira)</SelectItem>
                    <SelectItem value="Diesel S500">Diesel S500</SelectItem>
                    <SelectItem value="Gasolina">Gasolina Comum</SelectItem>
                    <SelectItem value="Etanol">Etanol</SelectItem>
                    <SelectItem value="Arla 32">Arla 32</SelectItem>
                    <SelectItem value="Eletrico">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status Operacional</Label>
                <Select value={status} onValueChange={(v: StatusVeiculo) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo / Operação Normal</SelectItem>
                    <SelectItem value="manutencao">Em Manutenção / Oficina</SelectItem>
                    <SelectItem value="inativo">Inativo / Desmobilizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Observações / Especificações
              </Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Capacidade 20m³, marroeiro Lokotrack, local de operação..."
                className="mt-1 text-xs"
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
                {isSubmitting ? 'Salvando...' : 'Salvar Equipamento'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal Consulta e Lançamento de Despesas por Placa/Equipamento */}
      <DespesasVeiculoModal
        veiculo={veiculoParaDespesas}
        open={modalDespesasVeiculoOpen}
        onOpenChange={setModalDespesasVeiculoOpen}
        onDespesaAdded={() => loadVeiculos()}
      />
    </div>
  )
}
