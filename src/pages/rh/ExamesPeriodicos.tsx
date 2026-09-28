import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDate } from '@/lib/formatters'
import type {
  Funcionario,
  ExamePeriodico,
  TipoExameOcupacional,
  ResultadoExameOcupacional,
  StatusCalculadoExame,
} from '@/types/erp'
import {
  examesPeriodicosService,
  TIPOS_EXAME_LABELS,
  RESULTADOS_EXAME_LABELS,
  PERIODICIDADE_PADRAO_MESES,
  calcularDataProximoExame,
  calcularStatusExame,
  calcularDiasRestantes,
} from '@/services/examesPeriodicos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  RelatorioListagemImpressaoModal,
  type ColunaRelatorioImpressao,
  type TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import { toast } from '@/hooks/use-toast'
import {
  HeartPulse,
  Plus,
  Search,
  Printer,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  Users,
  Edit2,
  X,
  Stethoscope,
  Activity,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

const BADGES_STATUS: Record<
  StatusCalculadoExame,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<any> }
> = {
  em_dia: {
    label: 'Em Dia',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  vence_em_breve: {
    label: 'Vence em Breve',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertTriangle,
  },
  vencido: {
    label: 'Vencido',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: AlertCircle,
  },
}

const BADGES_RESULTADO: Record<
  ResultadoExameOcupacional,
  { label: string; bg: string; text: string; border: string }
> = {
  apto: {
    label: 'Apto',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
  apto_com_restricao: {
    label: 'Apto c/ Restrição',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  inapto: {
    label: 'Inapto',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-300',
  },
}

export default function ExamesPeriodicosPage() {
  const { user } = useAuth()
  const { currentEmpresa, canEdit } = useCompany()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [exames, setExames] = useState<ExamePeriodico[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 250)
  const [funcionarioFilter, setFuncionarioFilter] = useState(() => {
    return searchParams.get('funcionario') || 'todos'
  })
  const [tipoFilter, setTipoFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dataInicioFilter, setDataInicioFilter] = useState('')
  const [dataFimFilter, setDataFimFilter] = useState('')

  // Seleção para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [impressaoOpen, setImpressaoOpen] = useState(false)

  // Drawer Form
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [formFuncionarioId, setFormFuncionarioId] = useState('')
  const [formTipoExame, setFormTipoExame] = useState<TipoExameOcupacional>('periodico')
  const [formDataExame, setFormDataExame] = useState(() => new Date().toISOString().slice(0, 10))
  const [formResultado, setFormResultado] = useState<ResultadoExameOcupacional>('apto')
  const [formClinica, setFormClinica] = useState('')
  const [formCrm, setFormCrm] = useState('')
  const [formPeriodicidade, setFormPeriodicidade] = useState<number>(12)
  const [formDataProximo, setFormDataProximo] = useState('')
  const [formProximoManual, setFormProximoManual] = useState(false)
  const [formObservacoes, setFormObservacoes] = useState('')

  // Realtime updates
  useRealtime('exames_periodicos', () => loadDados())
  useRealtime('funcionarios', () => loadDados())

  const loadDados = useCallback(async () => {
    if (!currentEmpresa?.id) return
    try {
      setLoading(true)
      const [exList, fList] = await Promise.all([
        examesPeriodicosService.listByEmpresa(currentEmpresa.id),
        pb.collection('funcionarios').getFullList<Funcionario>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
      ])
      setExames(exList)
      setFuncionarios(fList)
    } catch (err: any) {
      console.error('Erro ao carregar exames periódicos:', err)
      toast({
        title: 'Erro ao carregar exames',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [currentEmpresa?.id])

  useEffect(() => {
    loadDados()
  }, [loadDados])

  // Recalcula data do próximo exame quando muda a data do exame ou periodicidade (a menos que o usuário tenha alterado manualmente)
  useEffect(() => {
    if (!formProximoManual && formDataExame && formPeriodicidade > 0) {
      const calc = calcularDataProximoExame(formDataExame, formPeriodicidade)
      setFormDataProximo(calc)
    }
  }, [formDataExame, formPeriodicidade, formProximoManual])

  // Quando muda o tipo de exame, define periodicidade padrão (ex: periódico=12, demissional=0)
  const handleTipoExameChange = (tipo: TipoExameOcupacional) => {
    setFormTipoExame(tipo)
    const padrao = PERIODICIDADE_PADRAO_MESES[tipo]
    setFormPeriodicidade(padrao)
    if (!formProximoManual) {
      if (padrao > 0 && formDataExame) {
        setFormDataProximo(calcularDataProximoExame(formDataExame, padrao))
      } else {
        setFormDataProximo('')
      }
    }
  }

  // Abertura do formulário de criação
  const handleOpenNovo = (funcionarioIdPre?: string) => {
    setEditingId(null)
    setFormFuncionarioId(funcionarioIdPre || '')
    setFormTipoExame('periodico')
    const hojeStr = new Date().toISOString().slice(0, 10)
    setFormDataExame(hojeStr)
    setFormResultado('apto')
    setFormClinica('')
    setFormCrm('')
    setFormPeriodicidade(12)
    setFormDataProximo(calcularDataProximoExame(hojeStr, 12))
    setFormProximoManual(false)
    setFormObservacoes('')
    setDrawerOpen(true)
  }

  // Abertura do formulário de edição
  const handleEdit = (ex: ExamePeriodico) => {
    setEditingId(ex.id)
    setFormFuncionarioId(ex.funcionario_id)
    setFormTipoExame(ex.tipo_exame)
    setFormDataExame(ex.data_exame ? ex.data_exame.slice(0, 10) : '')
    setFormResultado(ex.resultado)
    setFormClinica(ex.clinica_medico || '')
    setFormCrm(ex.crm || '')
    setFormPeriodicidade(ex.periodicidade_meses ?? 12)
    setFormDataProximo(ex.data_proximo_exame ? ex.data_proximo_exame.slice(0, 10) : '')
    setFormProximoManual(true) // no modo edição, preserva a data cadastrada
    setFormObservacoes(ex.observacoes || '')
    setDrawerOpen(true)
  }

  // Salvar exame (criação / edição)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmpresa) return

    if (!formFuncionarioId) {
      toast({ title: 'Selecione o colaborador', variant: 'destructive' })
      return
    }

    if (!formDataExame) {
      toast({ title: 'Informe a data de realização do exame', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)
      const payload = {
        empresa_id: currentEmpresa.id,
        funcionario_id: formFuncionarioId,
        tipo_exame: formTipoExame,
        data_exame: new Date(formDataExame).toISOString(),
        resultado: formResultado,
        clinica_medico: formClinica.trim() || null,
        crm: formCrm.trim() || null,
        periodicidade_meses: Number(formPeriodicidade) || null,
        data_proximo_exame: formDataProximo ? new Date(formDataProximo).toISOString() : null,
        observacoes: formObservacoes.trim() || null,
      }

      if (editingId) {
        await examesPeriodicosService.update(editingId, payload)
        toast({ title: 'Exame ocupacional atualizado com sucesso!' })
      } else {
        await examesPeriodicosService.create(payload)
        toast({ title: 'Exame ocupacional cadastrado com sucesso!' })
      }

      setDrawerOpen(false)
      await loadDados()
    } catch (err: any) {
      console.error('Erro ao salvar exame:', err)
      toast({
        title: 'Erro ao salvar exame',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Exclusão com confirmação
  const handleDelete = async (id: string, nomeFunc: string) => {
    if (!confirm(`Deseja realmente excluir o registro do exame de ${nomeFunc}?`)) return
    try {
      await examesPeriodicosService.delete(id)
      toast({ title: 'Exame excluído com sucesso.' })
      await loadDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir exame',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Mapa rápido de funcionários por ID para acesso otimizado
  const funcionariosMap = useMemo(() => {
    const map = new Map<string, Funcionario>()
    funcionarios.forEach((f) => map.set(f.id, f))
    return map
  }, [funcionarios])

  // Itens enriquecidos com status calculado e dias restantes
  const examesEnriquecidos = useMemo(() => {
    return exames.map((ex) => {
      const func = ex.expand?.funcionario_id || funcionariosMap.get(ex.funcionario_id)
      const statusCalculado = calcularStatusExame(ex.data_proximo_exame, ex.tipo_exame)
      const diasRestantes = calcularDiasRestantes(ex.data_proximo_exame)
      return {
        ...ex,
        funcionario: func,
        statusCalculado,
        diasRestantes,
      }
    })
  }, [exames, funcionariosMap])

  // Estatísticas e contadores gerais (painel de vencimentos do topo)
  const kpis = useMemo(() => {
    let vencidos = 0
    let vencemBreve = 0
    let emDia = 0
    let inaptos = 0

    examesEnriquecidos.forEach((ex) => {
      if (ex.statusCalculado === 'vencido') vencidos++
      else if (ex.statusCalculado === 'vence_em_breve') vencemBreve++
      else emDia++

      if (ex.resultado === 'inapto') inaptos++
    })

    return {
      total: examesEnriquecidos.length,
      vencidos,
      vencemBreve,
      emDia,
      inaptos,
    }
  }, [examesEnriquecidos])

  // Lista dos mais urgentes para o painel de alerta rápido do topo (vencidos e que vencem em 30 dias)
  const examesUrgentes = useMemo(() => {
    return examesEnriquecidos
      .filter((ex) => ex.statusCalculado === 'vencido' || ex.statusCalculado === 'vence_em_breve')
      .sort((a, b) => {
        const da = a.data_proximo_exame || '9999-12-31'
        const db = b.data_proximo_exame || '9999-12-31'
        return da.localeCompare(db)
      })
      .slice(0, 5)
  }, [examesEnriquecidos])

  // Filtragem da lista
  const filteredExames = useMemo(() => {
    return examesEnriquecidos.filter((ex) => {
      if (funcionarioFilter !== 'todos' && ex.funcionario_id !== funcionarioFilter) {
        return false
      }
      if (tipoFilter !== 'todos' && ex.tipo_exame !== tipoFilter) {
        return false
      }
      if (statusFilter !== 'todos' && ex.statusCalculado !== statusFilter) {
        return false
      }
      if (dataInicioFilter) {
        const dExame = (ex.data_exame || '').slice(0, 10)
        if (dExame < dataInicioFilter) return false
      }
      if (dataFimFilter) {
        const dExame = (ex.data_exame || '').slice(0, 10)
        if (dExame > dataFimFilter) return false
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase()
        const n = (ex.funcionario?.nome || '').toLowerCase()
        const c = (ex.funcionario?.cargo || '').toLowerCase()
        const clinica = (ex.clinica_medico || '').toLowerCase()
        const crm = (ex.crm || '').toLowerCase()
        const obs = (ex.observacoes || '').toLowerCase()
        return (
          n.includes(q) ||
          c.includes(q) ||
          clinica.includes(q) ||
          crm.includes(q) ||
          obs.includes(q)
        )
      }
      return true
    })
  }, [
    examesEnriquecidos,
    funcionarioFilter,
    tipoFilter,
    statusFilter,
    dataInicioFilter,
    dataFimFilter,
    debouncedSearch,
  ])

  // Handlers de seleção por checkbox
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredExames.length && filteredExames.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredExames.map((ex) => ex.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Itens para impressão
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return filteredExames.filter((ex) => set.has(ex.id))
    }
    return filteredExames
  }, [filteredExames, selectedIds])

  // Descrição legível dos filtros aplicados
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (funcionarioFilter !== 'todos') {
      const f = funcionariosMap.get(funcionarioFilter)
      partes.push(`Colaborador: ${f?.nome || funcionarioFilter}`)
    } else {
      partes.push('Colaboradores: Todos')
    }
    if (tipoFilter !== 'todos') {
      partes.push(`Tipo: ${TIPOS_EXAME_LABELS[tipoFilter as TipoExameOcupacional] || tipoFilter}`)
    }
    if (statusFilter !== 'todos') {
      partes.push(
        `Status: ${BADGES_STATUS[statusFilter as StatusCalculadoExame]?.label || statusFilter}`,
      )
    }
    if (dataInicioFilter || dataFimFilter) {
      partes.push(
        `Período do Exame: ${dataInicioFilter ? formatDate(dataInicioFilter) : 'Início'} até ${
          dataFimFilter ? formatDate(dataFimFilter) : 'Fim'
        }`,
      )
    }
    if (searchQuery.trim()) {
      partes.push(`Busca: "${searchQuery.trim()}"`)
    }
    if (selectedIds.length > 0) {
      partes.push(`Seleção ativa: ${selectedIds.length} exame(s) selecionado(s)`)
    }
    return partes.join(' · ')
  }, [
    funcionarioFilter,
    tipoFilter,
    statusFilter,
    dataInicioFilter,
    dataFimFilter,
    searchQuery,
    selectedIds.length,
    funcionariosMap,
  ])

  // Colunas do relatório A4 de impressão
  const colunasRelatorio = useMemo<ColunaRelatorioImpressao<(typeof examesEnriquecidos)[0]>[]>(
    () => [
      {
        key: 'funcionario',
        header: 'Colaborador / Cargo',
        render: (item) => (
          <div>
            <div className="font-bold text-gray-900">{item.funcionario?.nome || '—'}</div>
            <div className="text-[10px] text-gray-500">
              {item.funcionario?.cargo || 'Sem cargo'} • {item.funcionario?.setor || 'Geral'}
            </div>
          </div>
        ),
      },
      {
        key: 'tipo_exame',
        header: 'Tipo de Exame',
        align: 'center',
        render: (item) => (
          <span className="font-medium text-gray-800">
            {TIPOS_EXAME_LABELS[item.tipo_exame] || item.tipo_exame}
          </span>
        ),
      },
      {
        key: 'data_exame',
        header: 'Data Realização',
        align: 'center',
        className: 'font-mono whitespace-nowrap text-gray-800',
        render: (item) => (item.data_exame ? formatDate(item.data_exame) : '—'),
      },
      {
        key: 'resultado',
        header: 'Resultado / Parecer',
        align: 'center',
        render: (item) => {
          const cfg = BADGES_RESULTADO[item.resultado] || BADGES_RESULTADO.apto
          return (
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              {cfg.label}
            </span>
          )
        },
      },
      {
        key: 'clinica',
        header: 'Clínica / Médico / CRM',
        render: (item) => (
          <div className="text-gray-700">
            <div>{item.clinica_medico || '—'}</div>
            {item.crm && <div className="text-[10px] text-gray-400 font-mono">CRM: {item.crm}</div>}
          </div>
        ),
      },
      {
        key: 'proximo',
        header: 'Próximo Exame',
        align: 'center',
        className: 'font-mono whitespace-nowrap font-bold text-gray-900',
        render: (item) =>
          item.data_proximo_exame ? formatDate(item.data_proximo_exame) : 'Não aplicável',
      },
      {
        key: 'status',
        header: 'Situação',
        align: 'center',
        className: 'whitespace-nowrap',
        render: (item) => {
          const cfg = BADGES_STATUS[item.statusCalculado] || BADGES_STATUS.em_dia
          return (
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              {cfg.label}
            </span>
          )
        },
      },
    ],
    [],
  )

  // Totalizadores do rodapé do relatório impresso
  const totalizadoresRelatorio = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const vencidosCount = itensParaImpressao.filter((i) => i.statusCalculado === 'vencido').length
    const vencemCount = itensParaImpressao.filter(
      (i) => i.statusCalculado === 'vence_em_breve',
    ).length
    const emDiaCount = itensParaImpressao.filter((i) => i.statusCalculado === 'em_dia').length

    return [
      {
        label: 'TOTAL DE EXAMES:',
        value: `${itensParaImpressao.length} registro(s)`,
        colSpan: 4,
        align: 'left',
      },
      {
        label: 'SITUAÇÃO:',
        value: `${vencidosCount} vencido(s) · ${vencemCount} a vencer (30d) · ${emDiaCount} em dia`,
        colSpan: 3,
        align: 'right',
        className: 'text-teal-950 font-bold',
      },
    ]
  }, [itensParaImpressao])

  const temFiltroAtivo =
    funcionarioFilter !== 'todos' ||
    tipoFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    Boolean(dataInicioFilter) ||
    Boolean(dataFimFilter) ||
    searchQuery.trim().length > 0 ||
    selectedIds.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Exames Ocupacionais &amp; Periódicos
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Saúde do Trabalho (PCMSO / NR-7)
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle de exames periódicos, admissionais, demissionais e retorno de toda a equipe da
            pedreira
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/rh/funcionarios')}
              className="border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl shadow-xs text-xs"
            >
              <Users className="w-4 h-4 mr-1.5 text-teal-700" />
              Equipe de Colaboradores
            </Button>
            <Button
              onClick={() => handleOpenNovo()}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Exame Ocupacional
            </Button>
          </div>
        )}
      </div>

      {/* Painel de Vencimentos (KPIs + Alertas rápidos) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1: Vencidos (Vermelho) */}
        <Card
          onClick={() => setStatusFilter('vencido')}
          className="rounded-2xl border-red-200 bg-red-50/40 hover:bg-red-50/70 p-4 shadow-xs cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">
              Exames Vencidos
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
              <AlertCircle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-700 mt-2 font-mono tabular-nums">
            {kpis.vencidos}
          </div>
          <p className="text-[11px] text-red-600 mt-0.5">
            {kpis.vencidos === 0 ? 'Nenhum exame vencido' : 'Requer agendamento urgente'}
          </p>
        </Card>

        {/* KPI 2: Vencem em breve (30 dias - Amarelo) */}
        <Card
          onClick={() => setStatusFilter('vence_em_breve')}
          className="rounded-2xl border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 p-4 shadow-xs cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Vencem em 30 Dias
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2 font-mono tabular-nums">
            {kpis.vencemBreve}
          </div>
          <p className="text-[11px] text-amber-700 mt-0.5">Agendar exames preventivamente</p>
        </Card>

        {/* KPI 3: Em dia (Verde) */}
        <Card
          onClick={() => setStatusFilter('em_dia')}
          className="rounded-2xl border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 p-4 shadow-xs cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Exames em Dia
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2 font-mono tabular-nums">
            {kpis.emDia}
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">Colaboradores com ASO regular</p>
        </Card>

        {/* KPI 4: Total de Exames Registrados */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Cadastrado
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <HeartPulse className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono tabular-nums">
            {kpis.total}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {funcionarios.length} colaboradores na base da pedreira
          </p>
        </Card>
      </div>

      {/* Lista rápida de exames mais urgentes (quando houver vencidos ou vencendo) */}
      {examesUrgentes.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Atenção Imediata — Próximos Vencimentos de ASO
              </span>
            </div>
            <span className="text-[11px] text-amber-700">
              {examesUrgentes.length} colaborador(es) prioritário(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
            {examesUrgentes.map((item) => {
              const isVencido = item.statusCalculado === 'vencido'
              return (
                <div
                  key={item.id}
                  onClick={() => handleEdit(item)}
                  className={`p-3 rounded-xl border bg-white flex items-center justify-between cursor-pointer hover:shadow-xs transition-all ${
                    isVencido
                      ? 'border-red-300 hover:border-red-400'
                      : 'border-amber-300 hover:border-amber-400'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-gray-900 text-xs truncate">
                      {item.funcionario?.nome || 'Colaborador'}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {item.funcionario?.cargo || '—'} •{' '}
                      {TIPOS_EXAME_LABELS[item.tipo_exame] || item.tipo_exame}
                    </div>
                    <div className="text-[11px] font-mono mt-0.5">
                      Vencimento:{' '}
                      <strong className={isVencido ? 'text-red-700' : 'text-amber-800'}>
                        {item.data_proximo_exame ? formatDate(item.data_proximo_exame) : '—'}
                      </strong>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                      isVencido ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {isVencido
                      ? 'Vencido'
                      : item.diasRestantes !== null
                        ? `${item.diasRestantes}d`
                        : 'A vencer'}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Filtros Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Colaborador via Combobox Pesquisável */}
            <ComboboxPesquisavel
              value={funcionarioFilter}
              onChange={setFuncionarioFilter}
              placeholder="Colaborador: Todos"
              searchPlaceholder="Pesquisar colaborador..."
              emptyText="Nenhum colaborador encontrado."
              className="w-[220px]"
              triggerClassName="bg-[#FAF9F7] border-[#ECEAE4] h-9 rounded-xl text-xs"
              aria-label="Filtrar por colaborador"
              options={[
                { id: 'todos', label: 'Todos os Colaboradores' },
                ...funcionarios.map((f) => ({
                  id: f.id,
                  label: f.nome,
                  sublabel: `${f.cargo} • ${f.setor}`,
                  keywords: [f.nome, f.cargo, f.setor],
                })),
              ]}
            />

            {/* Filtro Tipo de Exame */}
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[170px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Tipo de Exame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="periodico">Periódico</SelectItem>
                <SelectItem value="admissional">Admissional</SelectItem>
                <SelectItem value="demissional">Demissional</SelectItem>
                <SelectItem value="retorno_trabalho">Retorno ao Trabalho</SelectItem>
                <SelectItem value="mudanca_funcao">Mudança de Função</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Situação / Vencimento */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Status do Exame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Situações</SelectItem>
                <SelectItem value="em_dia">● Em Dia</SelectItem>
                <SelectItem value="vence_em_breve">● Vence em Breve (30d)</SelectItem>
                <SelectItem value="vencido">● Vencido</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Período de Realização */}
            <div className="flex items-center gap-1 bg-[#FAF9F7] border border-[#ECEAE4] rounded-xl px-2 h-9 text-xs">
              <Calendar className="w-3.5 h-3.5 text-gray-400 mr-1" />
              <input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => setDataInicioFilter(e.target.value)}
                className="bg-transparent text-[11px] font-mono text-gray-700 outline-none w-26"
                title="Data inicial do exame"
              />
              <span className="text-gray-400">até</span>
              <input
                type="date"
                value={dataFimFilter}
                onChange={(e) => setDataFimFilter(e.target.value)}
                className="bg-transparent text-[11px] font-mono text-gray-700 outline-none w-26"
                title="Data final do exame"
              />
            </div>

            {temFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFuncionarioFilter('todos')
                  setTipoFilter('todos')
                  setStatusFilter('todos')
                  setDataInicioFilter('')
                  setDataFimFilter('')
                  setSearchQuery('')
                  setSelectedIds([])
                }}
                className="h-8 px-2 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar por colaborador, clínica, CRM, parecer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImpressaoOpen(true)}
              className={`h-9 px-3 text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 ${
                selectedIds.length > 0
                  ? 'bg-teal-700 text-white hover:bg-teal-800 border-teal-700'
                  : 'border-teal-300 text-teal-800 bg-teal-50/60 hover:bg-teal-100/80 hover:text-teal-950'
              }`}
              title={
                selectedIds.length > 0
                  ? `Imprimir os ${selectedIds.length} exames selecionados`
                  : 'Imprimir relatório dos exames ocupacionais'
              }
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {selectedIds.length > 0
                ? `Imprimir Selecionados (${selectedIds.length})`
                : 'Imprimir'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabela de Exames */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-3 text-center w-8">
                  <Checkbox
                    checked={
                      filteredExames.length > 0 && selectedIds.length === filteredExames.length
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Selecionar todos os exames"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Tipo de Exame</th>
                <th className="py-3 px-4">Data do Exame</th>
                <th className="py-3 px-4 text-center">Resultado</th>
                <th className="py-3 px-4">Clínica / Médico</th>
                <th className="py-3 px-4">Próximo Exame</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Carregando exames ocupacionais...
                  </td>
                </tr>
              ) : filteredExames.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Nenhum exame ocupacional encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredExames.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  const statusCfg = BADGES_STATUS[item.statusCalculado] || BADGES_STATUS.em_dia
                  const StatusIcon = statusCfg.icon
                  const resCfg = BADGES_RESULTADO[item.resultado] || BADGES_RESULTADO.apto

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/60 hover:bg-teal-50/80' : 'hover:bg-teal-50/20'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(item.id)}
                          aria-label={`Selecionar exame de ${item.funcionario?.nome || ''}`}
                          className="border-gray-300"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {item.funcionario?.nome || '—'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {item.funcionario?.cargo || 'Sem cargo'} •{' '}
                          {item.funcionario?.setor || 'Geral'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {TIPOS_EXAME_LABELS[item.tipo_exame] || item.tipo_exame}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-700">
                        {item.data_exame ? formatDate(item.data_exame) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${resCfg.bg} ${resCfg.text} ${resCfg.border}`}
                        >
                          {resCfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-gray-800">{item.clinica_medico || '—'}</div>
                        {item.crm && (
                          <div className="text-[10px] text-gray-400 font-mono">CRM: {item.crm}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-gray-900">
                          {item.data_proximo_exame
                            ? formatDate(item.data_proximo_exame)
                            : 'Não aplicável'}
                        </div>
                        {item.periodicidade_meses ? (
                          <div className="text-[10px] text-gray-400">
                            A cada {item.periodicidade_meses} meses
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusCfg.label}</span>
                        </span>
                        {item.diasRestantes !== null && (
                          <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                            {item.diasRestantes < 0
                              ? `Vencido há ${Math.abs(item.diasRestantes)}d`
                              : item.diasRestantes === 0
                                ? 'Vence hoje'
                                : `Faltam ${item.diasRestantes}d`}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar exame"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDelete(item.id, item.funcionario?.nome || 'colaborador')
                              }
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Excluir exame"
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
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[540px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-700" />
              <span>{editingId ? 'Editar Exame Ocupacional' : 'Novo Exame Ocupacional'}</span>
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            {/* Colaborador */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Colaborador / Funcionário *
              </Label>
              <div className="mt-1">
                <ComboboxPesquisavel
                  value={formFuncionarioId}
                  onChange={setFormFuncionarioId}
                  placeholder="Selecione o funcionário..."
                  searchPlaceholder="Pesquisar por nome ou cargo..."
                  emptyText="Nenhum colaborador encontrado."
                  options={funcionarios.map((f) => ({
                    id: f.id,
                    label: f.nome,
                    sublabel: `${f.cargo} • ${f.setor}`,
                    keywords: [f.nome, f.cargo, f.setor],
                  }))}
                />
              </div>
            </div>

            {/* Tipo de exame e data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Exame *</Label>
                <Select
                  value={formTipoExame}
                  onValueChange={(v: TipoExameOcupacional) => handleTipoExameChange(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="periodico">Periódico</SelectItem>
                    <SelectItem value="admissional">Admissional</SelectItem>
                    <SelectItem value="demissional">Demissional</SelectItem>
                    <SelectItem value="retorno_trabalho">Retorno ao Trabalho</SelectItem>
                    <SelectItem value="mudanca_funcao">Mudança de Função</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Data do Exame *</Label>
                <Input
                  required
                  type="date"
                  value={formDataExame}
                  onChange={(e) => setFormDataExame(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* Resultado do exame */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">Resultado / Parecer *</Label>
              <Select
                value={formResultado}
                onValueChange={(v: ResultadoExameOcupacional) => setFormResultado(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apto">Apto</SelectItem>
                  <SelectItem value="apto_com_restricao">Apto com Restrição</SelectItem>
                  <SelectItem value="inapto">Inapto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clínica / Médico / CRM */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Clínica / Médico</Label>
                <Input
                  value={formClinica}
                  onChange={(e) => setFormClinica(e.target.value)}
                  placeholder="Ex: Clínica MedTrabalho / Dr. Silva"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">CRM / Registro Médico</Label>
                <Input
                  value={formCrm}
                  onChange={(e) => setFormCrm(e.target.value)}
                  placeholder="Ex: CRM-PB 12345"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* Periodicidade e Próximo Exame */}
            <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-teal-900 text-xs">
                  Periodicidade &amp; Próximo Exame
                </span>
                <span className="text-[10px] text-teal-700 font-mono">Padrão: 12 meses</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Periodicidade (meses)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={formPeriodicidade || ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 0
                      setFormPeriodicidade(v)
                    }}
                    placeholder="Ex: 12"
                    className="mt-1 bg-white font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Data Próximo Exame</Label>
                  <Input
                    type="date"
                    value={formDataProximo}
                    onChange={(e) => {
                      setFormDataProximo(e.target.value)
                      setFormProximoManual(true)
                    }}
                    className="mt-1 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Calculada automaticamente pela periodicidade selecionada.</span>
                {formProximoManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormProximoManual(false)
                      if (formDataExame && formPeriodicidade > 0) {
                        setFormDataProximo(
                          calcularDataProximoExame(formDataExame, formPeriodicidade),
                        )
                      }
                    }}
                    className="text-teal-700 underline hover:text-teal-900 cursor-pointer text-[10px]"
                  >
                    Recalcular pela regra
                  </button>
                )}
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Observações / Detalhes do ASO
              </Label>
              <Textarea
                rows={3}
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Ex: Atestado emitido com restrição para trabalho em altura; exames complementares: audiometria e acuidade visual normais..."
                className="mt-1 text-xs"
              />
            </div>

            <SheetFooter className="pt-4 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar Exame'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal de Impressão A4 */}
      <RelatorioListagemImpressaoModal
        open={impressaoOpen}
        onOpenChange={setImpressaoOpen}
        titulo="Relatório de Exames Ocupacionais & Periódicos"
        subtitulo="Controle de Saúde Ocupacional (PCMSO) - Pedreira Cordeiro"
        empresa={currentEmpresa}
        usuarioNome={user?.name || user?.email}
        filtrosDescricao={descricaoFiltrosAplicados}
        itens={itensParaImpressao}
        colunas={colunasRelatorio}
        totais={totalizadoresRelatorio}
        mensagemVazio="Nenhum exame ocupacional encontrado para impressão."
        orientacao="landscape"
        badgeDestaque="RH / SAÚDE DO TRABALHO"
      />
    </div>
  )
}
