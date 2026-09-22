import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Manutencao, Veiculo, Fornecedor, PlanoConta } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
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
  Wrench,
  Plus,
  Search,
  Trash2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Gauge,
} from 'lucide-react'

export default function Manutencoes() {
  const { currentEmpresa, canEdit } = useCompany()

  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [veiculoId, setVeiculoId] = useState('')
  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [oficinaNome, setOficinaNome] = useState('')
  const [dataManut, setDataManut] = useState(() => new Date().toISOString().slice(0, 10))

  // CONTROLE DUPLO: Km e Horímetro independentes no momento da manutenção
  const [kmNoMomento, setKmNoMomento] = useState<number>(0)
  const [horimetroNoMomento, setHorimetroNoMomento] = useState<number>(0)

  const [custo, setCusto] = useState<number>(0)
  const [status, setStatus] = useState<'agendada' | 'em_andamento' | 'concluida' | 'cancelada'>(
    'concluida',
  )

  // Próxima revisão (data, km ou horímetro)
  const [proximaRevisaoData, setProximaRevisaoData] = useState('')
  const [proximaRevisaoKm, setProximaRevisaoKm] = useState<number>(0)
  const [proximaRevisaoHorimetro, setProximaRevisaoHorimetro] = useState<number>(0)

  const [gerarFinanceiro, setGerarFinanceiro] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('manutencoes', () => loadData())
  useRealtime('veiculos', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [mList, vList, fList, pList] = await Promise.all([
        pb.collection('manutencoes').getFullList<Manutencao>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
          sort: '-data',
        }),
        pb.collection('veiculos').getFullList<Veiculo>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo_interno',
        }),
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])

      setManutencoes(mList)
      setVeiculos(vList)
      setFornecedores(fList)
      setPlanoContas(pList)
    } catch (err) {
      console.error('Error fetching manutencoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    const firstVeic = veiculos[0]
    setVeiculoId(firstVeic ? firstVeic.id : '')
    setTipo('preventiva')
    setDescricao('')
    const oficina = fornecedores.find(
      (f) =>
        f.nome.toLowerCase().includes('oficina') ||
        f.nome.toLowerCase().includes('mecânica') ||
        f.nome.toLowerCase().includes('peça'),
    )
    setFornecedorId(oficina ? oficina.id : fornecedores[0]?.id || '')
    setOficinaNome('')
    setDataManut(new Date().toISOString().slice(0, 10))

    setKmNoMomento(firstVeic?.km_atual || 0)
    setHorimetroNoMomento(firstVeic?.horimetro_atual || 0)
    setCusto(0)
    setStatus('concluida')

    // Prazos sugeridos de revisão
    const nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth() + 3)
    setProximaRevisaoData(nextDate.toISOString().slice(0, 10))
    setProximaRevisaoKm(firstVeic?.km_atual ? firstVeic.km_atual + 10000 : 0)
    setProximaRevisaoHorimetro(firstVeic?.horimetro_atual ? firstVeic.horimetro_atual + 250 : 0)

    setGerarFinanceiro(true)
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const v = veiculos.find((x) => x.id === vid)
    if (v) {
      setKmNoMomento(v.km_atual || 0)
      setHorimetroNoMomento(v.horimetro_atual || 0)
      setProximaRevisaoKm(v.km_atual ? v.km_atual + 10000 : 0)
      setProximaRevisaoHorimetro(v.horimetro_atual ? v.horimetro_atual + 250 : 0)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veiculoId || !descricao.trim()) {
      toast({ title: 'Selecione o veículo e preencha a descrição', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const v = veiculos.find((item) => item.id === veiculoId)!

      let contaPagarId: string | null = null

      if (gerarFinanceiro && custo > 0 && !editingId) {
        const catManut =
          planoContas.find((pc) => pc.codigo === '2.3') ||
          planoContas.find((pc) => pc.nome.toLowerCase().includes('manuten')) ||
          null

        const payloadConta = {
          empresa_id: currentEmpresa!.id,
          fornecedor_id: fornecedorId || null,
          descricao: `Manutenção ${tipo.toUpperCase()}: ${v.codigo_interno} - ${descricao}`,
          categoria_id: catManut?.id || null,
          valor: Number(custo),
          vencimento: new Date(dataManut).toISOString(),
          parcelas: 1,
          status: 'Aberta',
          observacoes: `Módulo de Frotas. Oficina: ${oficinaNome || 'Oficina própria/credenciada'}. Km: ${kmNoMomento || '—'}, Horas: ${horimetroNoMomento || '—'}`,
        }

        const cp = await pb.collection('contas_pagar').create(payloadConta)
        contaPagarId = cp.id
      }

      const medidorPrincipal = kmNoMomento > 0 ? kmNoMomento : horimetroNoMomento || 0
      const medidorProx = proximaRevisaoKm > 0 ? proximaRevisaoKm : proximaRevisaoHorimetro || 0

      const payloadManut = {
        empresa_id: currentEmpresa!.id,
        veiculo_id: veiculoId,
        tipo,
        descricao: descricao.trim(),
        fornecedor_id: fornecedorId || null,
        oficina_nome: oficinaNome.trim() || null,
        data: new Date(dataManut).toISOString(),
        medidor_no_momento: medidorPrincipal,
        km_no_momento: Number(kmNoMomento) || null,
        horimetro_no_momento: Number(horimetroNoMomento) || null,
        custo: Number(custo) || 0,
        status,
        proxima_revisao_data: proximaRevisaoData
          ? new Date(proximaRevisaoData).toISOString()
          : null,
        proxima_revisao_medidor: medidorProx || null,
        proxima_revisao_km: Number(proximaRevisaoKm) || null,
        proxima_revisao_horimetro: Number(proximaRevisaoHorimetro) || null,
        conta_pagar_id: contaPagarId,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('manutencoes').update(editingId, payloadManut)
        toast({ title: 'Manutenção atualizada com sucesso!' })
      } else {
        await pb.collection('manutencoes').create(payloadManut)

        // Se a manutenção está em andamento, marca o status do veículo como "manutencao"
        if (status === 'em_andamento') {
          await pb.collection('veiculos').update(v.id, { status: 'manutencao' })
        } else if (status === 'concluida' && v.status === 'manutencao') {
          await pb.collection('veiculos').update(v.id, { status: 'ativo' })
        }

        toast({
          title: 'Manutenção registrada!',
          description: contaPagarId ? 'Conta a pagar gerada no módulo financeiro.' : undefined,
        })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar manutenção',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (m: Manutencao) => {
    if (!confirm('Deseja realmente remover esta manutenção?')) return
    try {
      await pb.collection('manutencoes').delete(m.id)
      toast({ title: 'Manutenção excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Alertas de Manutenção Preventiva Próxima ou Vencida (por Data, Km ou Horímetro)
  const alertasList = useMemo(() => {
    const list: Array<{
      veiculo: Veiculo
      motivo: string
      tipoAlerta: 'vencida' | 'proxima'
    }> = []

    const now = new Date()

    veiculos.forEach((v) => {
      // Pega a última manutenção do veículo com próxima revisão definida
      const ultManut = manutencoes.find(
        (m) =>
          m.veiculo_id === v.id &&
          (m.proxima_revisao_data || m.proxima_revisao_km || m.proxima_revisao_horimetro),
      )

      if (!ultManut) return

      // Alerta por Data
      if (ultManut.proxima_revisao_data) {
        const dRev = new Date(ultManut.proxima_revisao_data)
        const diffDays = Math.ceil((dRev.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 0) {
          list.push({
            veiculo: v,
            motivo: `Revisão periódica vencida em ${formatDate(ultManut.proxima_revisao_data)}`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffDays <= 15) {
          list.push({
            veiculo: v,
            motivo: `Revisão agendada em ${diffDays} dias (${formatDate(ultManut.proxima_revisao_data)})`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }

      // Alerta por Km
      if (ultManut.proxima_revisao_km && v.km_atual) {
        const diffKm = ultManut.proxima_revisao_km - v.km_atual
        if (diffKm <= 0) {
          list.push({
            veiculo: v,
            motivo: `Limite de Km atingido (${v.km_atual} / ${ultManut.proxima_revisao_km} km)`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffKm <= 1000) {
          list.push({
            veiculo: v,
            motivo: `Faltam apenas ${diffKm} km para a próxima revisão`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }

      // Alerta por Horímetro
      if (ultManut.proxima_revisao_horimetro && v.horimetro_atual) {
        const diffHoras = ultManut.proxima_revisao_horimetro - v.horimetro_atual
        if (diffHoras <= 0) {
          list.push({
            veiculo: v,
            motivo: `Limite de Horas atingido (${v.horimetro_atual}h / ${ultManut.proxima_revisao_horimetro}h)`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffHoras <= 50) {
          list.push({
            veiculo: v,
            motivo: `Faltam apenas ${diffHoras} horas para a próxima revisão`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }
    })

    return list
  }, [veiculos, manutencoes])

  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter((m) => {
      if (tipoFilter !== 'todos' && m.tipo !== tipoFilter) return false
      if (statusFilter !== 'todos' && m.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cod = m.expand?.veiculo_id?.codigo_interno?.toLowerCase() || ''
        const mod = m.expand?.veiculo_id?.modelo?.toLowerCase() || ''
        const des = m.descricao.toLowerCase()
        const ofi = (m.oficina_nome || '').toLowerCase()
        return cod.includes(q) || mod.includes(q) || des.includes(q) || ofi.includes(q)
      }
      return true
    })
  }, [manutencoes, tipoFilter, statusFilter, searchQuery])

  // KPIs
  const totalGastoManutencao = manutencoes.reduce((acc, m) => acc + (m.custo || 0), 0)
  const totalPreventivas = manutencoes.filter((m) => m.tipo === 'preventiva').length
  const totalCorretivas = manutencoes.filter((m) => m.tipo === 'corretiva').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Manutenção Mecânica & Ordens de Serviço
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Alertas por Km e Horímetro
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Plano preventivo e corretivo para britadores Lokotrack, caminhões caçamba, betoneiras e
            pás
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Manutenção
          </Button>
        )}
      </div>

      {/* Alertas Ativos */}
      {alertasList.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Alertas de Revisão Preventiva da Frota ({alertasList.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {alertasList.map((al, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  al.tipoAlerta === 'vencida'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-white border-amber-200 text-amber-900'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center gap-1">
                    <span className="font-mono">{al.veiculo.codigo_interno}</span>
                    <span>•</span>
                    <span className="truncate max-w-[140px]">{al.veiculo.modelo}</span>
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-90">{al.motivo}</div>
                </div>
                <Badge
                  className={
                    al.tipoAlerta === 'vencida'
                      ? 'bg-red-600 text-white text-[10px]'
                      : 'bg-amber-100 text-amber-800 border-amber-300 text-[10px]'
                  }
                >
                  {al.tipoAlerta === 'vencida' ? 'Vencida' : 'Próxima'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Custo Total</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2 font-mono tabular-nums">
            {formatCurrency(totalGastoManutencao)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Total de serviços e peças</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Preventivas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{totalPreventivas}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Revisões periódicas de rotina</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Corretivas</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2 font-mono">{totalCorretivas}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Reparos e trocas de componentes</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Alertas Ativos</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2 font-mono">
            {alertasList.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Equipamentos a revisar</p>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Tipo de Manutenção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="preventiva">Preventiva</SelectItem>
                <SelectItem value="corretiva">Corretiva</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
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

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar serviço, veículo, oficina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Veículo / Máquina</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Descrição do Serviço</th>
                <th className="py-3 px-4">Oficina / Fornecedor</th>
                <th className="py-3 px-4 text-right">Km / Horímetro no Ato</th>
                <th className="py-3 px-4 text-right">Custo Total</th>
                <th className="py-3 px-4 text-right">Próxima Revisão</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredManutencoes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Nenhuma manutenção registrada.
                  </td>
                </tr>
              ) : (
                filteredManutencoes.map((m) => {
                  const veic = m.expand?.veiculo_id
                  const temConta = !!m.conta_pagar_id
                  const hasKm = (m.km_no_momento || 0) > 0
                  const hasHoras = (m.horimetro_no_momento || 0) > 0

                  return (
                    <tr key={m.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(m.data)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span className="font-mono text-teal-800">{veic?.codigo_interno}</span>
                          <span>•</span>
                          <span className="text-gray-700 truncate max-w-[140px]">
                            {veic?.modelo}
                          </span>
                        </div>
                        {veic?.placa && (
                          <div className="text-[10px] text-gray-400 font-mono">{veic.placa}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            m.tipo === 'preventiva'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                              : 'bg-amber-50 text-amber-800 border-amber-200 text-[10px]'
                          }
                        >
                          {m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800 max-w-[240px] truncate">
                        {m.descricao}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {m.oficina_nome || m.expand?.fornecedor_id?.nome || 'Oficina Própria'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="flex flex-col items-end gap-0.5">
                          {hasKm ? (
                            <span className="text-gray-900 font-semibold">
                              {Number(m.km_no_momento).toLocaleString('pt-BR')} km
                            </span>
                          ) : null}
                          {hasHoras ? (
                            <span className="text-amber-800 font-semibold">
                              {Number(m.horimetro_no_momento).toLocaleString('pt-BR')} h
                            </span>
                          ) : null}
                          {!hasKm && !hasHoras && (
                            <span className="text-gray-400">
                              {m.medidor_no_momento ? `${m.medidor_no_momento} med.` : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                        {formatCurrency(m.custo)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-gray-600">
                        {m.proxima_revisao_data && <div>{formatDate(m.proxima_revisao_data)}</div>}
                        {m.proxima_revisao_km ? (
                          <div className="text-teal-800 font-semibold">
                            {Number(m.proxima_revisao_km).toLocaleString('pt-BR')} km
                          </div>
                        ) : null}
                        {m.proxima_revisao_horimetro ? (
                          <div className="text-amber-800 font-semibold">
                            {Number(m.proxima_revisao_horimetro).toLocaleString('pt-BR')} h
                          </div>
                        ) : null}
                        {!m.proxima_revisao_data &&
                          !m.proxima_revisao_km &&
                          !m.proxima_revisao_horimetro && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === 'concluida'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.status === 'em_andamento'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : m.status === 'agendada'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {m.status === 'concluida'
                            ? '● Concluída'
                            : m.status === 'em_andamento'
                              ? '● Em Serviço'
                              : m.status === 'agendada'
                                ? '● Agendada'
                                : '● Cancelada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(m)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drawer Create Form */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Registrar Manutenção de Frota
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Veículo / Equipamento *</Label>
              <Select value={veiculoId} onValueChange={handleVeiculoChange}>
                <SelectTrigger className="mt-1 font-medium">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.codigo_interno} • {v.modelo} ({v.setor || 'Geral'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Serviço *</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva (Revisão periódica)</SelectItem>
                    <SelectItem value="corretiva">Corretiva (Conserto emergencial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Data da Execução *</Label>
                <Input
                  type="date"
                  required
                  value={dataManut}
                  onChange={(e) => setDataManut(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição do Serviço *</Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Troca de dentes de caçamba, revisão 10.000km, troca de filtros"
                className="mt-1"
              />
            </div>

            {/* CONTROLE DUPLO: KM E HORÍMETRO NO MOMENTO */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                <span>Leitura dos Medidores no Momento (Km & Horímetro)</span>
                <span className="text-[10px] text-amber-800 font-normal">Opcionais</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-teal-700" />
                    <span>Km no Momento</span>
                  </Label>
                  <Input
                    type="number"
                    value={kmNoMomento || ''}
                    onChange={(e) => setKmNoMomento(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Horímetro no Momento (h)</span>
                  </Label>
                  <Input
                    type="number"
                    value={horimetroNoMomento || ''}
                    onChange={(e) => setHorimetroNoMomento(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Custo Total das Peças/Serviço (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={custo || ''}
                  onChange={(e) => setCusto(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-red-600"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status da O.S.</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendada">Agendada</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Fornecedor Vinculado</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Oficina Externa / Mecânico
                </Label>
                <Input
                  value={oficinaNome}
                  onChange={(e) => setOficinaNome(e.target.value)}
                  placeholder="Ex: Oficina Mecânica Sertânia"
                  className="mt-1"
                />
              </div>
            </div>

            {/* PROGRAMAÇÃO DA PRÓXIMA REVISÃO */}
            <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-3">
              <span className="font-semibold text-gray-900 block text-xs">
                Programação da Próxima Revisão Preventiva
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-gray-600">Próxima Data</Label>
                  <Input
                    type="date"
                    value={proximaRevisaoData}
                    onChange={(e) => setProximaRevisaoData(e.target.value)}
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-600">Próximo Km</Label>
                  <Input
                    type="number"
                    value={proximaRevisaoKm || ''}
                    onChange={(e) => setProximaRevisaoKm(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-600">Próximas Horas (h)</Label>
                  <Input
                    type="number"
                    value={proximaRevisaoHorimetro || ''}
                    onChange={(e) => setProximaRevisaoHorimetro(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox Integração Financeiro */}
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-start space-x-3">
              <input
                type="checkbox"
                id="gerarFinanceiroManut"
                checked={gerarFinanceiro}
                onChange={(e) => setGerarFinanceiro(e.target.checked)}
                className="mt-1 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
              />
              <label htmlFor="gerarFinanceiroManut" className="cursor-pointer text-xs">
                <span className="font-semibold text-teal-900 block">
                  Gerar Conta a Pagar automaticamente no Financeiro
                </span>
                <span className="text-teal-700 text-[11px] block mt-0.5">
                  Lança o valor total de {formatCurrency(custo)} na categoria "Manutenção - Frota"
                  vinculada ao fornecedor ou oficina.
                </span>
              </label>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações Técnicas</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Peças substituídas, garantia de 90 dias, notas de peças..."
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
                {isSubmitting ? 'Salvando...' : 'Confirmar Manutenção'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
