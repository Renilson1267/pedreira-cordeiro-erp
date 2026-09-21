import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type { Veiculo, TipoVeiculo, TipoMedidor, StatusVeiculo } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertCircle,
  Construction,
  Filter,
} from 'lucide-react'

const TIPO_LABELS: Record<TipoVeiculo, { label: string; icon: string }> = {
  caminhao: { label: 'Caminhão Basculante', icon: '🚛' },
  escavadeira: { label: 'Escavadeira Hidráulica', icon: '🚜' },
  carregadeira: { label: 'Pá Carregadeira', icon: '🚜' },
  perfuratriz: { label: 'Perfuratriz Hidráulica', icon: '⚙️' },
  trator: { label: 'Trator / Motoniveladora', icon: '🚜' },
  outro: { label: 'Outro Equipamento', icon: '🏗️' },
}

export default function Veiculos() {
  const { currentEmpresa, canEdit } = useCompany()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [codigoInterno, setCodigoInterno] = useState('')
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState<TipoVeiculo>('caminhao')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState<number>(new Date().getFullYear())
  const [tipoMedidor, setTipoMedidor] = useState<TipoMedidor>('km')
  const [medidorAtual, setMedidorAtual] = useState<number>(0)
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
    setTipoMedidor('km')
    setMedidorAtual(0)
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
    setTipoMedidor(v.tipo_medidor)
    setMedidorAtual(v.medidor_atual)
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
        tipo_medidor: tipoMedidor,
        medidor_atual: Number(medidorAtual) || 0,
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
    if (!confirm(`Deseja realmente remover o veículo/máquina ${codigo}?`)) return
    try {
      await pb.collection('veiculos').delete(id)
      toast({ title: 'Veículo excluído com sucesso.' })
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
      if (statusFilter !== 'todos' && v.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          v.codigo_interno.toLowerCase().includes(q) ||
          v.modelo.toLowerCase().includes(q) ||
          (v.marca && v.marca.toLowerCase().includes(q)) ||
          (v.placa && v.placa.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [veiculos, tipoFilter, statusFilter, searchQuery])

  // KPIs
  const totalAtivos = veiculos.filter((v) => v.status === 'ativo').length
  const totalManutencao = veiculos.filter((v) => v.status === 'manutencao').length
  const totalCaminhoes = veiculos.filter((v) => v.tipo === 'caminhao').length
  const totalMaquinas = veiculos.filter((v) => v.tipo !== 'caminhao').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Veículos & Equipamentos de Pedreira
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300">
              Operação de Lavra
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de frota pesada: caminhões traçados, escavadeiras, pás carregadeiras e
            perfuratrizes
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Veículo / Máquina
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Operação</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{totalAtivos}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Veículos e máquinas ativos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Manutenção</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">{totalManutencao}</div>
          <p className="text-[11px] text-amber-700 mt-0.5">Parados na oficina</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Caminhões</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{totalCaminhoes}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Basculantes / Rodoviários</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Máquinas de Linha</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Construction className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{totalMaquinas}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Escavadeiras, Carregadeiras...</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Tipo de Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="caminhao">Caminhões</SelectItem>
                <SelectItem value="escavadeira">Escavadeiras</SelectItem>
                <SelectItem value="carregadeira">Pás Carregadeiras</SelectItem>
                <SelectItem value="perfuratriz">Perfuratrizes</SelectItem>
                <SelectItem value="trator">Tratores / Motoniveladoras</SelectItem>
                <SelectItem value="outro">Outros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativo / Liberado</SelectItem>
                <SelectItem value="manutencao">Em Manutenção</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            {(tipoFilter !== 'todos' || statusFilter !== 'todos' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTipoFilter('todos')
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
              placeholder="Buscar código, modelo, placa..."
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
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Placa / Chassi</th>
                <th className="py-3 px-4">Ano</th>
                <th className="py-3 px-4 text-right">Horímetro / Km Atual</th>
                <th className="py-3 px-4 text-center">Combustível</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredVeiculos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Nenhum veículo ou equipamento encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredVeiculos.map((v) => {
                  const isKm = v.tipo_medidor === 'km'
                  return (
                    <tr key={v.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-800">
                        {v.codigo_interno}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{v.modelo}</div>
                        {v.marca && <div className="text-[11px] text-gray-400">{v.marca}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px]">
                          <span>{TIPO_LABELS[v.tipo]?.icon || '🚛'}</span>
                          <span>{TIPO_LABELS[v.tipo]?.label || v.tipo}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase text-gray-600">
                        {v.placa || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-mono">{v.ano || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-gray-900 tabular-nums">
                          {Number(v.medidor_atual).toLocaleString('pt-BR')}{' '}
                          <span className="text-[10px] text-gray-500 font-normal">
                            {isKm ? 'km' : 'horas'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1">
                          {isKm ? <Gauge className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{isKm ? 'Odômetro' : 'Horímetro'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {v.combustivel_padrao || 'Diesel'}
                        </Badge>
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
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(v)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar Veículo"
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
        <SheetContent className="sm:max-w-[520px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Veículo / Máquina' : 'Novo Veículo ou Equipamento'}
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
                  placeholder="Ex: CAM-01, ESC-02"
                  className="mt-1 font-mono uppercase"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Placa / Registro</Label>
                <Input
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="Ex: BRA2E19 ou ESC-01"
                  className="mt-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Equipamento *</Label>
                <Select
                  value={tipo}
                  onValueChange={(v: TipoVeiculo) => {
                    setTipo(v)
                    // Se for máquina de lavra, padrão costuma ser horas (horímetro)
                    if (['escavadeira', 'carregadeira', 'perfuratriz', 'trator'].includes(v)) {
                      setTipoMedidor('horas')
                    } else if (v === 'caminhao') {
                      setTipoMedidor('km')
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caminhao">Caminhão Basculante</SelectItem>
                    <SelectItem value="escavadeira">Escavadeira Hidráulica</SelectItem>
                    <SelectItem value="carregadeira">Pá Carregadeira</SelectItem>
                    <SelectItem value="perfuratriz">Perfuratriz Hidráulica</SelectItem>
                    <SelectItem value="trator">Trator / Motoniveladora</SelectItem>
                    <SelectItem value="outro">Outro Equipamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Marca / Fabricante</Label>
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: Caterpillar, Volvo, Komatsu"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Modelo *</Label>
                <Input
                  required
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: FMX 500 8x4 / CAT 336D"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Ano</Label>
                <Input
                  type="number"
                  value={ano || ''}
                  onChange={(e) => setAno(parseInt(e.target.value) || 0)}
                  placeholder="2022"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200">
              <div>
                <Label className="text-xs font-semibold text-gray-800">Tipo de Medidor *</Label>
                <Select value={tipoMedidor} onValueChange={(v: TipoMedidor) => setTipoMedidor(v)}>
                  <SelectTrigger className="mt-1 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">Quilometragem (Km - Odômetro)</SelectItem>
                    <SelectItem value="horas">Horas Trabalhadas (Horímetro)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Caminhões usam Km; escavadeiras e britagem usam Horímetro.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-800">Medidor Atual *</Label>
                <Input
                  type="number"
                  required
                  value={medidorAtual}
                  onChange={(e) => setMedidorAtual(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 bg-white font-mono font-bold"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Valor atual ({tipoMedidor === 'km' ? 'km' : 'horas'}).
                </span>
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
                    <SelectItem value="Arla 32">Arla 32 (Aditivo)</SelectItem>
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
                Observações / Especificações de Pedreira
              </Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Caçamba de rocha Hardox 450, capacidade 20m³, pneus OTR reforçados..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Veículo / Máquina'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
