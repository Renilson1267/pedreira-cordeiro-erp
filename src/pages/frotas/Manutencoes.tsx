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
  Edit2,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Truck,
  Construction,
} from 'lucide-react'

export default function Manutencoes() {
  const { currentEmpresa, canEdit } = useCompany()

  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  const [tipoFilter, setTipoFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [veiculoId, setVeiculoId] = useState('')
  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [oficinaNome, setOficinaNome] = useState('')
  const [dataManut, setDataManut] = useState(() => new Date().toISOString().slice(0, 10))
  const [medidorMomento, setMedidorMomento] = useState<number>(0)
  const [custo, setCusto] = useState<number>(0)
  const [proximaData, setProximaData] = useState('')
  const [proximoMedidor, setProximoMedidor] = useState<number>(0)
  const [status, setStatus] = useState<'agendada' | 'em_andamento' | 'concluida' | 'cancelada'>(
    'concluida',
  )
  const [observacoes, setObservacoes] = useState('')
  const [gerarFinanceiro, setGerarFinanceiro] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('manutencoes', () => loadData())
  useRealtime('veiculos', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [manList, veicList, fornList, plList] = await Promise.all([
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

      setManutencoes(manList)
      setVeiculos(veicList)
      setFornecedores(fornList)
      setPlanoContas(plList)
    } catch (err) {
      console.error('Error fetching manutencoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const currentVeiculo = useMemo(() => {
    return veiculos.find((v) => v.id === veiculoId)
  }, [veiculos, veiculoId])

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
        f.nome.toLowerCase().includes('trator'),
    )
    setFornecedorId(oficina ? oficina.id : fornecedores[0]?.id || '')
    setOficinaNome(oficina ? oficina.nome : '')
    setDataManut(new Date().toISOString().slice(0, 10))
    setMedidorMomento(firstVeic ? firstVeic.medidor_atual : 0)
    setCusto(0)
    setProximaData('')
    setProximoMedidor(
      firstVeic ? firstVeic.medidor_atual + (firstVeic.tipo_medidor === 'km' ? 10000 : 250) : 0,
    )
    setStatus('concluida')
    setObservacoes('')
    setGerarFinanceiro(true)
    setIsDrawerOpen(true)
  }

  const handleEdit = (m: Manutencao) => {
    setEditingId(m.id)
    setVeiculoId(m.veiculo_id)
    setTipo(m.tipo)
    setDescricao(m.descricao)
    setFornecedorId(m.fornecedor_id || '')
    setOficinaNome(m.oficina_nome || '')
    setDataManut(m.data ? m.data.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setMedidorMomento(m.medidor_no_momento || 0)
    setCusto(m.custo || 0)
    setProximaData(m.proxima_revisao_data ? m.proxima_revisao_data.slice(0, 10) : '')
    setProximoMedidor(m.proxima_revisao_medidor || 0)
    setStatus(m.status)
    setObservacoes(m.observacoes || '')
    setGerarFinanceiro(false)
    setIsDrawerOpen(true)
  }

  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const v = veiculos.find((x) => x.id === vid)
    if (v) {
      setMedidorMomento(v.medidor_atual)
      setProximoMedidor(v.medidor_atual + (v.tipo_medidor === 'km' ? 10000 : 250))
    }
  }

  const handleFornecedorChange = (fid: string) => {
    setFornecedorId(fid)
    const forn = fornecedores.find((f) => f.id === fid)
    if (forn) setOficinaNome(forn.nome)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veiculoId || !descricao.trim()) {
      toast({ title: 'Preencha o veículo e a descrição da manutenção', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const v = currentVeiculo!

      let contaPagarId: string | null = null

      if (!editingId && gerarFinanceiro && custo > 0) {
        const catManut =
          planoContas.find((pc) => pc.codigo === '2.3') ||
          planoContas.find((pc) => pc.nome.toLowerCase().includes('manuten')) ||
          null

        const payloadConta = {
          empresa_id: currentEmpresa!.id,
          fornecedor_id: fornecedorId || null,
          descricao: `Manutenção ${v.codigo_interno} (${v.modelo}) - ${descricao.trim()}`,
          categoria_id: catManut?.id || null,
          valor: Number(custo),
          vencimento: new Date(dataManut).toISOString(),
          parcelas: 1,
          status: status === 'concluida' ? 'Paga' : 'Aberta',
          observacoes: `Gerado automaticamente pelo Módulo de Frotas (Manutenção ${tipo})`,
        }

        const cp = await pb.collection('contas_pagar').create(payloadConta)
        contaPagarId = cp.id
      }

      const payloadManut = {
        empresa_id: currentEmpresa!.id,
        veiculo_id: veiculoId,
        tipo,
        descricao: descricao.trim(),
        fornecedor_id: fornecedorId || null,
        oficina_nome: oficinaNome.trim() || null,
        data: new Date(dataManut).toISOString(),
        medidor_no_momento: Number(medidorMomento) || null,
        custo: Number(custo) || 0,
        proxima_revisao_data: proximaData ? new Date(proximaData).toISOString() : null,
        proxima_revisao_medidor: proximoMedidor ? Number(proximoMedidor) : null,
        conta_pagar_id: contaPagarId,
        status,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('manutencoes').update(editingId, payloadManut)
        toast({ title: 'Manutenção atualizada com sucesso!' })
      } else {
        await pb.collection('manutencoes').create(payloadManut)

        // Se status for "em_andamento", podemos atualizar o veículo para "manutencao"
        if (status === 'em_andamento' && v.status !== 'manutencao') {
          await pb.collection('veiculos').update(v.id, { status: 'manutencao' })
        } else if (status === 'concluida' && v.status === 'manutencao') {
          await pb.collection('veiculos').update(v.id, { status: 'ativo' })
        }

        toast({
          title: 'Manutenção registrada com sucesso!',
          description: gerarFinanceiro ? 'Conta a pagar integrada no Financeiro.' : undefined,
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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta manutenção?')) return
    try {
      await pb.collection('manutencoes').delete(id)
      toast({ title: 'Manutenção excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter((m) => {
      if (tipoFilter !== 'todos' && m.tipo !== tipoFilter) return false
      if (statusFilter !== 'todos' && m.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cod = m.expand?.veiculo_id?.codigo_interno?.toLowerCase() || ''
        const mod = m.expand?.veiculo_id?.modelo?.toLowerCase() || ''
        const desc = m.descricao?.toLowerCase() || ''
        const ofi = m.oficina_nome?.toLowerCase() || ''
        return cod.includes(q) || mod.includes(q) || desc.includes(q) || ofi.includes(q)
      }
      return true
    })
  }, [manutencoes, tipoFilter, statusFilter, searchQuery])

  // Alertas de Revisão Próxima ou Vencida
  const todayISO = new Date().toISOString().slice(0, 10)
  const alertasRevisao = useMemo(() => {
    const list: Array<{
      veiculo: Veiculo
      manutencao: Manutencao
      motivo: 'data_vencida' | 'medidor_vencido' | 'proxima'
      diasRestantes?: number
      diferencaMedidor?: number
    }> = []

    manutencoes.forEach((m) => {
      if (!m.proxima_revisao_data && !m.proxima_revisao_medidor) return
      const v = veiculos.find((ve) => ve.id === m.veiculo_id)
      if (!v) return

      // Verificar data
      if (m.proxima_revisao_data) {
        const pDate = m.proxima_revisao_data.slice(0, 10)
        const diffDays = Math.ceil(
          (new Date(pDate).getTime() - new Date(todayISO).getTime()) / (1000 * 3600 * 24),
        )

        if (diffDays <= 0) {
          list.push({ veiculo: v, manutencao: m, motivo: 'data_vencida', diasRestantes: diffDays })
          return
        } else if (diffDays <= 15) {
          list.push({ veiculo: v, manutencao: m, motivo: 'proxima', diasRestantes: diffDays })
          return
        }
      }

      // Verificar medidor (odômetro ou horímetro)
      if (m.proxima_revisao_medidor) {
        const diffMed = m.proxima_revisao_medidor - v.medidor_atual
        if (diffMed <= 0) {
          list.push({
            veiculo: v,
            manutencao: m,
            motivo: 'medidor_vencido',
            diferencaMedidor: diffMed,
          })
        } else if (
          (v.tipo_medidor === 'km' && diffMed <= 1000) ||
          (v.tipo_medidor === 'horas' && diffMed <= 50)
        ) {
          list.push({ veiculo: v, manutencao: m, motivo: 'proxima', diferencaMedidor: diffMed })
        }
      }
    })

    return list
  }, [manutencoes, veiculos, todayISO])

  // Total do Mês
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth()

  const custoTotalMes = manutencoes
    .filter((m) => {
      const d = new Date(m.data)
      return d.getFullYear() === curY && d.getMonth() === curM
    })
    .reduce((acc, m) => acc + (m.custo || 0), 0)

  const preventivasCount = manutencoes.filter((m) => m.tipo === 'preventiva').length
  const corretivasCount = manutencoes.filter((m) => m.tipo === 'corretiva').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Plano de Manutenções & Oficinas
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300">
              Preventiva & Corretiva
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Programação de revisões por data/horímetro, trocas de óleo, reparos mecânicos e faturas
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

      {/* Alertas de Manutenção se houver */}
      {alertasRevisao.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300/80 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Alertas de Revisão & Manutenção Programada</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {alertasRevisao.slice(0, 4).map((alerta, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <span className="font-mono text-teal-800">{alerta.veiculo.codigo_interno}</span>
                    <span>•</span>
                    <span className="text-gray-700">{alerta.veiculo.modelo}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {alerta.motivo === 'data_vencida' ? (
                      <span className="text-red-600 font-semibold">
                        Revisão vencida há {Math.abs(alerta.diasRestantes || 0)} dias!
                      </span>
                    ) : alerta.motivo === 'medidor_vencido' ? (
                      <span className="text-red-600 font-semibold">
                        Limite de {alerta.veiculo.tipo_medidor === 'km' ? 'Km' : 'Horímetro'}{' '}
                        ultrapassado!
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        Revisão próxima prevista para{' '}
                        {formatDate(alerta.manutencao.proxima_revisao_data || '')}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreateModal()}
                  className="h-7 text-[11px] border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  Agendar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Custo de Manutenção no Mês
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2 font-mono tabular-nums">
            {formatCurrency(custoTotalMes)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Peças, lubrificantes e mão de obra</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Preventivas Realizadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{preventivasCount}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Foco em disponibilidade e vida útil</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Corretivas / Emergenciais
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2 font-mono">{corretivasCount}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Quebras imprevistas em campo</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Tipo de Serviço" />
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
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
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
              placeholder="Buscar serviço, máquina, oficina..."
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
                <th className="py-3 px-4">Equipamento</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Descrição do Serviço</th>
                <th className="py-3 px-4">Oficina / Mecânico</th>
                <th className="py-3 px-4 text-right">Horímetro / Km</th>
                <th className="py-3 px-4 text-right">Custo Total</th>
                <th className="py-3 px-4">Próxima Revisão</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredManutencoes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Nenhum registro de manutenção encontrado.
                  </td>
                </tr>
              ) : (
                filteredManutencoes.map((m) => {
                  const veic = m.expand?.veiculo_id
                  const isKm = veic?.tipo_medidor === 'km'

                  return (
                    <tr key={m.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(m.data)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span className="font-mono text-teal-800">{veic?.codigo_interno}</span>
                          <span>•</span>
                          <span className="text-gray-700 truncate max-w-[130px]">
                            {veic?.modelo}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-medium text-gray-900 truncate" title={m.descricao}>
                          {m.descricao}
                        </div>
                        {m.observacoes && (
                          <div className="text-[11px] text-gray-400 truncate">{m.observacoes}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {m.expand?.fornecedor_id?.nome || m.oficina_nome || 'Oficina Interna'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-800">
                        {m.medidor_no_momento
                          ? `${Number(m.medidor_no_momento).toLocaleString('pt-BR')} ${isKm ? 'km' : 'h'}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                        {formatCurrency(m.custo)}
                      </td>
                      <td className="py-3.5 px-4">
                        {m.proxima_revisao_data ? (
                          <div>
                            <div className="font-mono text-gray-800">
                              {formatDate(m.proxima_revisao_data)}
                            </div>
                            {m.proxima_revisao_medidor && (
                              <div className="text-[10px] text-gray-400 font-mono">
                                ou {Number(m.proxima_revisao_medidor).toLocaleString('pt-BR')}{' '}
                                {isKm ? 'km' : 'h'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === 'concluida'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.status === 'em_andamento'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : m.status === 'agendada'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {m.status === 'concluida'
                            ? 'Concluída'
                            : m.status === 'em_andamento'
                              ? 'Em Execução'
                              : m.status === 'agendada'
                                ? 'Agendada'
                                : 'Cancelada'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(m)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(m.id)}
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
        <SheetContent className="sm:max-w-[540px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Ordem de Manutenção' : 'Registrar Manutenção de Equipamento'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Equipamento / Máquina *
                </Label>
                <Select value={veiculoId} onValueChange={handleVeiculoChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.codigo_interno} • {v.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Manutenção *</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva (Revisão Periódica)</SelectItem>
                    <SelectItem value="corretiva">Corretiva (Reparo Emergencial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Descrição dos Serviços Realizados *
              </Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Troca de óleo, filtros, reparo martelete, concha..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento (Na Oficina)</SelectItem>
                    <SelectItem value="agendada">Agendada (Futura)</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  {currentVeiculo?.tipo_medidor === 'km'
                    ? 'Quilometragem (Km)'
                    : 'Horímetro (Horas)'}
                </Label>
                <Input
                  type="number"
                  value={medidorMomento || ''}
                  onChange={(e) => setMedidorMomento(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Custo Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={custo || ''}
                  onChange={(e) => setCusto(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1 font-mono font-bold text-red-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Oficina / Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={handleFornecedorChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Vincular fornecedor" />
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
                  Nome Oficina / Mecânico
                </Label>
                <Input
                  value={oficinaNome}
                  onChange={(e) => setOficinaNome(e.target.value)}
                  placeholder="Ex: TratorPeças ou Equipe Interna"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Próxima Revisão / Alerta */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
              <span className="text-xs font-semibold text-amber-950 block">
                Programação da Próxima Revisão (Gera Alerta no Dashboard)
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700">Data Prevista</Label>
                  <Input
                    type="date"
                    value={proximaData}
                    onChange={(e) => setProximaData(e.target.value)}
                    className="mt-1 bg-white font-mono text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-gray-700">
                    {currentVeiculo?.tipo_medidor === 'km'
                      ? 'No Odômetro (Km)'
                      : 'No Horímetro (Horas)'}
                  </Label>
                  <Input
                    type="number"
                    value={proximoMedidor || ''}
                    onChange={(e) => setProximoMedidor(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 9500"
                    className="mt-1 bg-white font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Integração Financeiro */}
            {!editingId && (
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
                    Lança o valor de {formatCurrency(custo)} na categoria "Manutenção de Máquinas e
                    Caminhões" vinculada ao fornecedor.
                  </span>
                </label>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Peças Utilizadas / Observações Mecânicas
              </Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Filtros trocados, número da NF de peças, garantia..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Manutenção'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
