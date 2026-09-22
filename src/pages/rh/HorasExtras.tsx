import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Funcionario, FolhaHorasExtras, ModoCalculoHorasExtras, PlanoConta } from '@/types/erp'
import { folhaHorasExtrasService } from '@/services/folhaHorasExtras'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  Clock,
  Plus,
  Search,
  Printer,
  Trash2,
  DollarSign,
  Calendar,
  UserCheck,
  Receipt,
  FileText,
  Calculator,
  ArrowRight,
  Sparkles,
  Briefcase,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { ReciboHorasExtrasModal } from '@/components/rh/ReciboHorasExtrasModal'
import { FolhaHorasExtrasImpressaoModal } from '@/components/rh/FolhaHorasExtrasImpressaoModal'

export default function HorasExtras() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const navigate = useNavigate()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [folhas, setFolhas] = useState<FolhaHorasExtras[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros da listagem
  const [searchQuery, setSearchQuery] = useState('')
  const [mesFiltro, setMesFiltro] = useState<string>('todos')
  const [modoFiltro, setModoFiltro] = useState<string>('todos')

  // Drawer / Formulário de Cálculo
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('')
  const [salarioManual, setSalarioManual] = useState<number | ''>('')
  const [mesReferencia, setMesReferencia] = useState<string>(() => {
    const hoje = new Date()
    const meses = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    return `${meses[hoje.getMonth()]}/${hoje.getFullYear()}`
  })
  const [modoCalculo, setModoCalculo] = useState<ModoCalculoHorasExtras>('padrao_50')

  // Inputs de horas, gratificação e adiantamento
  const [horas50Todas, setHoras50Todas] = useState<number | ''>('')
  const [horasCltUteis50, setHorasCltUteis50] = useState<number | ''>('')
  const [horasCltDomingos100, setHorasCltDomingos100] = useState<number | ''>('')
  const [gratificacao, setGratificacao] = useState<number | ''>('')
  const [adiantamento, setAdiantamento] = useState<number | ''>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Modal de Impressão / Recibo Individual
  const [reciboModalOpen, setReciboModalOpen] = useState(false)
  const [selectedFolhaParaRecibo, setSelectedFolhaParaRecibo] = useState<FolhaHorasExtras | null>(
    null,
  )

  // Modal de Impressão da Folha Completa (A4 Paisagem com todos os funcionários que couberem)
  const [folhaCompletaModalOpen, setFolhaCompletaModalOpen] = useState(false)

  // Modal / Ação de Lançar no Financeiro (Conta a Pagar)
  const [lancandoContaId, setLancandoContaId] = useState<string | null>(null)

  // Realtime
  useRealtime('folha_horas_extras', () => loadDados())
  useRealtime('funcionarios', () => loadDados())

  const loadDados = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [fList, folhasList, pList] = await Promise.all([
        pb.collection('funcionarios').getFullList<Funcionario>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        folhaHorasExtrasService.listByEmpresa(currentEmpresa.id),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])
      setFuncionarios(fList)
      setFolhas(folhasList)
      setPlanoContas(pList)
    } catch (err: any) {
      console.error('Erro ao carregar dados de horas extras:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDados()
  }, [currentEmpresa])

  // Colaborador atualmente selecionado no formulário
  const funcionarioAtual = useMemo(() => {
    return funcionarios.find((f) => f.id === selectedFuncionarioId) || null
  }, [funcionarios, selectedFuncionarioId])

  // Salário efetivo considerado no cálculo
  const salarioEfetivo = useMemo(() => {
    if (salarioManual !== '' && Number(salarioManual) > 0) {
      return Number(salarioManual)
    }
    return funcionarioAtual?.salario || 0
  }, [salarioManual, funcionarioAtual])

  // Memória de cálculo ao vivo
  const memoriaCalculo = useMemo(() => {
    return folhaHorasExtrasService.calcular({
      salario: salarioEfetivo,
      modo: modoCalculo,
      horasTotais50: Number(horas50Todas) || 0,
      horasUteis50: Number(horasCltUteis50) || 0,
      horasDomingos100: Number(horasCltDomingos100) || 0,
      gratificacao: Number(gratificacao) || 0,
      adiantamento: Number(adiantamento) || 0,
    })
  }, [
    salarioEfetivo,
    modoCalculo,
    horas50Todas,
    horasCltUteis50,
    horasCltDomingos100,
    gratificacao,
    adiantamento,
  ])

  // Abertura do formulário
  const handleOpenNovoCalculo = (funcionarioId?: string) => {
    if (funcionarioId) {
      setSelectedFuncionarioId(funcionarioId)
      const f = funcionarios.find((item) => item.id === funcionarioId)
      setSalarioManual(f?.salario ? f.salario : '')
    } else {
      setSelectedFuncionarioId(funcionarios[0]?.id || '')
      setSalarioManual(funcionarios[0]?.salario ? funcionarios[0].salario : '')
    }
    setHoras50Todas('')
    setHorasCltUteis50('')
    setHorasCltDomingos100('')
    setGratificacao('')
    setAdiantamento('')
    setObservacoes('')
    setDrawerOpen(true)
  }

  // Mudança do funcionário no Select
  const handleFuncionarioSelectChange = (funcId: string) => {
    setSelectedFuncionarioId(funcId)
    const f = funcionarios.find((item) => item.id === funcId)
    if (f?.salario) {
      setSalarioManual(f.salario)
    } else {
      setSalarioManual('')
    }
  }

  // Salvar registro de horas extras
  const handleSalvarCalculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmpresa) return

    if (!selectedFuncionarioId) {
      toast({ title: 'Selecione um colaborador', variant: 'destructive' })
      return
    }

    if (salarioEfetivo <= 0) {
      toast({
        title: 'Informe um salário válido para o cálculo',
        description: 'O salário base mensal é necessário para apurar o valor da hora normal.',
        variant: 'destructive',
      })
      return
    }

    if (memoriaCalculo.totalHoras <= 0) {
      toast({
        title: 'Informe a quantidade de horas extras realizadas',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)
      const novoRegistro = await folhaHorasExtrasService.create({
        empresa_id: currentEmpresa.id,
        funcionario_id: selectedFuncionarioId,
        mes_referencia: mesReferencia.trim(),
        modo_calculo: modoCalculo,
        salario_base: salarioEfetivo,
        valor_hora_normal: memoriaCalculo.valorHoraNormal,
        horas_50: memoriaCalculo.horas50,
        valor_horas_50: memoriaCalculo.valorHoras50,
        horas_100: memoriaCalculo.horas100,
        valor_horas_100: memoriaCalculo.valorHoras100,
        total_horas: memoriaCalculo.totalHoras,
        total_valor: memoriaCalculo.totalValor,
        gratificacao: memoriaCalculo.gratificacao,
        adiantamento: memoriaCalculo.adiantamento,
        valor_liquido: memoriaCalculo.valorLiquido,
        status: 'calculado',
        observacoes: observacoes.trim() || undefined,
      })

      toast({
        title: 'Cálculo de horas extras salvo com sucesso!',
        description: `Total de ${memoriaCalculo.totalHoras}h apuradas • Líquido a pagar: ${formatCurrency(
          memoriaCalculo.valorLiquido,
        )}.`,
      })

      setDrawerOpen(false)
      await loadDados()

      // Abre automaticamente para visualização/impressão se desejado
      setSelectedFolhaParaRecibo(novoRegistro)
      setReciboModalOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar horas extras',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Excluir registro
  const handleDeleteFolha = async (id: string) => {
    if (!confirm('Deseja realmente remover este lançamento de horas extras?')) return
    try {
      await folhaHorasExtrasService.delete(id)
      toast({ title: 'Lançamento de horas extras removido com sucesso.' })
      await loadDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover lançamento',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Lançar no Financeiro (gerar Conta a Pagar pelo VALOR LÍQUIDO)
  const handleLancarNoFinanceiro = async (folha: FolhaHorasExtras) => {
    if (!currentEmpresa) return
    const fNome = folha.expand?.funcionario_id?.nome || 'Colaborador'
    const valorLiquido =
      typeof folha.valor_liquido === 'number'
        ? folha.valor_liquido
        : Number(
            (folha.total_valor + (folha.gratificacao || 0) - (folha.adiantamento || 0)).toFixed(2),
          )

    if (
      !confirm(
        `Deseja gerar uma Conta a Pagar no valor LÍQUIDO de ${formatCurrency(
          valorLiquido,
        )} referente às horas extras de ${fNome} (Mês: ${folha.mes_referencia})?`,
      )
    ) {
      return
    }

    try {
      setLancandoContaId(folha.id)

      // Categoria de despesas com folha/pessoal
      const catFolha =
        planoContas.find((pc) => pc.nome.toLowerCase().includes('hora extra')) ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('salário')) ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('pessoal')) ||
        planoContas[0] ||
        null

      // Vencimento padrão: 5º dia útil próximo
      const dVenc = new Date()
      dVenc.setDate(5)
      dVenc.setMonth(dVenc.getMonth() + 1)

      const detalhesMemoria: string[] = [
        `Bruto HE: ${formatCurrency(folha.total_valor)} (${folha.total_horas}h)`,
      ]
      if (folha.gratificacao && folha.gratificacao > 0) {
        detalhesMemoria.push(`Gratificação (+): ${formatCurrency(folha.gratificacao)}`)
      }
      if (folha.adiantamento && folha.adiantamento > 0) {
        detalhesMemoria.push(`Adiantamento (-): ${formatCurrency(folha.adiantamento)}`)
      }
      detalhesMemoria.push(`Líquido: ${formatCurrency(valorLiquido)}`)

      const payloadConta = {
        empresa_id: currentEmpresa.id,
        descricao: `Horas Extras (${folha.total_horas}h) - Líquido a Pagar: ${fNome} [${folha.mes_referencia}]`,
        categoria_id: catFolha?.id || null,
        valor: valorLiquido,
        vencimento: dVenc.toISOString(),
        parcelas: 1,
        status: 'Aberta',
        observacoes: `Apuração de Horas Extras de ${folha.mes_referencia}. Colaborador: ${fNome}. Salário base: ${formatCurrency(
          folha.salario_base,
        )}. Memória: ${detalhesMemoria.join(' | ')}. Modo: ${
          folha.modo_calculo === 'padrao_50' ? '50% Geral' : 'Regra CLT 50%/100%'
        }.`,
      }

      const contaCriada = await pb.collection('contas_pagar').create(payloadConta)

      // Atualiza o registro de horas extras como aprovado/vinculado e garante os campos
      await folhaHorasExtrasService.update(folha.id, {
        status: 'aprovado',
        conta_pagar_id: contaCriada.id,
        valor_liquido: valorLiquido,
      })

      toast({
        title: 'Conta a Pagar de Horas Extras gerada com sucesso!',
        description: `Lançado no Contas a Pagar pelo valor líquido de ${formatCurrency(valorLiquido)}.`,
      })

      await loadDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao lançar no financeiro',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLancandoContaId(null)
    }
  }

  // Filtragem dos registros
  const folhasFiltradas = useMemo(() => {
    return folhas.filter((item) => {
      if (mesFiltro !== 'todos' && item.mes_referencia !== mesFiltro) return false
      if (modoFiltro !== 'todos' && item.modo_calculo !== modoFiltro) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fNome = (item.expand?.funcionario_id?.nome || '').toLowerCase()
        const cargo = (item.expand?.funcionario_id?.cargo || '').toLowerCase()
        const setor = (item.expand?.funcionario_id?.setor || '').toLowerCase()
        const mes = item.mes_referencia.toLowerCase()
        return fNome.includes(q) || cargo.includes(q) || setor.includes(q) || mes.includes(q)
      }
      return true
    })
  }, [folhas, mesFiltro, modoFiltro, searchQuery])

  // Lista única de meses para o filtro
  const listaMeses = useMemo(() => {
    const setMeses = new Set<string>()
    folhas.forEach((f) => setMeses.add(f.mes_referencia))
    return Array.from(setMeses)
  }, [folhas])

  // KPIs
  const totalLancamentos = folhasFiltradas.length
  const totalHorasGeral = folhasFiltradas.reduce((acc, f) => acc + (f.total_horas || 0), 0)
  const totalBrutoGeral = folhasFiltradas.reduce((acc, f) => acc + (f.total_valor || 0), 0)
  const totalGratificacoes = folhasFiltradas.reduce((acc, f) => acc + (f.gratificacao || 0), 0)
  const totalAdiantamentos = folhasFiltradas.reduce((acc, f) => acc + (f.adiantamento || 0), 0)
  const totalLiquidoGeral = folhasFiltradas.reduce((acc, f) => {
    const liq =
      typeof f.valor_liquido === 'number'
        ? f.valor_liquido
        : f.total_valor + (f.gratificacao || 0) - (f.adiantamento || 0)
    return acc + liq
  }, 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Folha de Horas Extras
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300">Apuração & CLT</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cálculo de horas suplementares (50% ou CLT 50%/100%), gratificações, adiantamentos e
            apuração do valor líquido a pagar com comprovante A4 Paisagem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/rh/funcionarios')}
            className="border-[#ECEAE4] text-gray-700 hover:bg-gray-50 rounded-xl shadow-xs text-xs"
          >
            <UserCheck className="w-4 h-4 mr-1.5 text-teal-700" />
            Ver Colaboradores
          </Button>

          <Button
            variant="outline"
            onClick={() => setFolhaCompletaModalOpen(true)}
            className="border-teal-300 bg-teal-50/60 text-teal-900 hover:bg-teal-100/70 rounded-xl shadow-xs text-xs"
            title="Imprimir folha completa A4 Paisagem com a lista de funcionários do mês"
          >
            <Printer className="w-4 h-4 mr-1.5 text-teal-700" />
            Imprimir Folha Completa
          </Button>

          {canEdit && (
            <Button
              onClick={() => handleOpenNovoCalculo()}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Calcular Horas Extras
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Lançamentos</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{totalLancamentos}</div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            {totalHorasGeral.toFixed(1)}h extras somadas
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Bruto HE</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono tabular-nums">
            {formatCurrency(totalBrutoGeral)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Sem bônus / descontos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Bônus & Descontos</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs mt-2 space-y-0.5">
            <div className="flex items-center justify-between text-emerald-700 font-semibold font-mono">
              <span>Gratificação (+):</span>
              <span>{formatCurrency(totalGratificacoes)}</span>
            </div>
            <div className="flex items-center justify-between text-red-600 font-semibold font-mono">
              <span>Adiantamento (−):</span>
              <span>{formatCurrency(totalAdiantamentos)}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Ajustes da folha</p>
        </Card>

        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/40 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900 uppercase">Total Líquido</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2 font-mono tabular-nums">
            {formatCurrency(totalLiquidoGeral)}
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Valor efetivo a pagar</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="w-[190px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Mês de Referência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Meses</SelectItem>
                {listaMeses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={modoFiltro} onValueChange={setModoFiltro}>
              <SelectTrigger className="w-[190px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Modo de Cálculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Modos</SelectItem>
                <SelectItem value="padrao_50">50% para Todas as Horas</SelectItem>
                <SelectItem value="clt_vigente">CLT Atual (50% / 100%)</SelectItem>
              </SelectContent>
            </Select>

            {(mesFiltro !== 'todos' || modoFiltro !== 'todos' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMesFiltro('todos')
                  setModoFiltro('todos')
                  setSearchQuery('')
                }}
                className="h-9 text-xs text-gray-500"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar por colaborador, setor, cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Tabela de Lançamentos Salvos */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Colaborador / Função</th>
                <th className="py-3 px-4">Mês Ref.</th>
                <th className="py-3 px-4">Critério</th>
                <th className="py-3 px-4 text-right">Salário Base</th>
                <th className="py-3 px-4 text-center">Horas</th>
                <th className="py-3 px-4 text-right">Bruto HE</th>
                <th className="py-3 px-4 text-right">Gratificação (+)</th>
                <th className="py-3 px-4 text-right">Adiantamento (−)</th>
                <th className="py-3 px-4 text-right text-emerald-900 bg-emerald-50/50">
                  Líquido a Pagar
                </th>
                <th className="py-3 px-4 text-center">Status / Financeiro</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    Carregando apurações de horas extras...
                  </td>
                </tr>
              ) : folhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    Nenhuma folha de horas extras cadastrada ou encontrada para os filtros.
                  </td>
                </tr>
              ) : (
                folhasFiltradas.map((folha) => {
                  const func = folha.expand?.funcionario_id
                  const grat = folha.gratificacao || 0
                  const adiant = folha.adiantamento || 0
                  const liq =
                    typeof folha.valor_liquido === 'number'
                      ? folha.valor_liquido
                      : folha.total_valor + grat - adiant

                  return (
                    <tr key={folha.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {func?.nome || 'Colaborador não identificado'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {func?.cargo || '—'} • {func?.setor || 'Geral'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {folha.mes_referencia}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {folha.modo_calculo === 'padrao_50' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            50% Todas
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            CLT 50%/100%
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-gray-700 tabular-nums">
                        {formatCurrency(folha.salario_base)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="font-mono font-bold text-gray-900">
                          {folha.total_horas?.toFixed(1)}h
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          50%: {folha.horas_50 || 0}h
                          {folha.modo_calculo === 'clt_vigente' && (
                            <span> | 100%: {folha.horas_100 || 0}h</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-800 tabular-nums">
                        {formatCurrency(folha.total_valor)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-emerald-700 tabular-nums">
                        {grat > 0 ? (
                          `+ ${formatCurrency(grat)}`
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-red-600 tabular-nums">
                        {adiant > 0 ? (
                          `- ${formatCurrency(adiant)}`
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-950 text-sm tabular-nums bg-emerald-50/50">
                        {formatCurrency(liq)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {folha.conta_pagar_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● Lançado no Financeiro
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            ● Calculado / Pendente
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Imprimir A4 Paisagem */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedFolhaParaRecibo(folha)
                              setReciboModalOpen(true)
                            }}
                            className="h-7 px-2 text-[11px] text-teal-900 border-teal-300 hover:bg-teal-50"
                            title="Imprimir Comprovante para Assinatura (A4 Paisagem)"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1 text-teal-700" />
                            Imprimir Recibo
                          </Button>

                          {/* Botão Lançar no Financeiro */}
                          {canEdit && !folha.conta_pagar_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={lancandoContaId === folha.id}
                              onClick={() => handleLancarNoFinanceiro(folha)}
                              className="h-7 px-2 text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                              title="Lançar como Conta a Pagar"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-1" />
                              Lançar Financeiro
                            </Button>
                          )}

                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteFolha(folha.id)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Excluir Lançamento"
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

      {/* DRAWER / FORMULÁRIO DE CÁLCULO DE HORAS EXTRAS */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-teal-700" />
              Cálculo de Folha de Horas Extras
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSalvarCalculo} className="space-y-4 py-4 text-xs">
            {/* 1. SELEÇÃO DO FUNCIONÁRIO */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Colaborador / Funcionário *
              </Label>
              <Select value={selectedFuncionarioId} onValueChange={handleFuncionarioSelectChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o funcionário..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} — {f.cargo} ({f.setor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. SALÁRIO E PERÍODO */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Salário Base Mensal (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={salarioManual}
                  onChange={(e) =>
                    setSalarioManual(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                  }
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-teal-800"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Puxado do cadastro; pode ser editado.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Mês de Referência *</Label>
                <Input
                  required
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  placeholder="Ex: Novembro/2025"
                  className="mt-1 font-medium"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Identifica o mês da folha.
                </span>
              </div>
            </div>

            {/* 3. OPÇÕES DE CÁLCULO (EXATAMENTE AS DUAS SOLICITADAS) */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <Label className="text-xs font-bold text-gray-800 block">
                Modo de Cálculo de Horas Extras:
              </Label>
              <RadioGroup
                value={modoCalculo}
                onValueChange={(v) => setModoCalculo(v as ModoCalculoHorasExtras)}
                className="space-y-2.5 pt-1"
              >
                <div className="flex items-start space-x-2.5 p-2 rounded-lg bg-white border border-[#ECEAE4] hover:border-teal-300 transition-colors">
                  <RadioGroupItem value="padrao_50" id="opt-50" className="mt-0.5 text-teal-700" />
                  <label htmlFor="opt-50" className="cursor-pointer text-xs flex-1">
                    <span className="font-bold text-gray-900 block">50% para todas as horas</span>
                    <span className="text-gray-500 text-[11px] block mt-0.5 leading-tight">
                      Aplica adicional fixo de 50% sobre o valor da hora normal em todas as horas
                      informadas.
                    </span>
                  </label>
                </div>

                <div className="flex items-start space-x-2.5 p-2 rounded-lg bg-white border border-[#ECEAE4] hover:border-teal-300 transition-colors">
                  <RadioGroupItem
                    value="clt_vigente"
                    id="opt-clt"
                    className="mt-0.5 text-teal-700"
                  />
                  <label htmlFor="opt-clt" className="cursor-pointer text-xs flex-1">
                    <span className="font-bold text-gray-900 block">
                      Aplicar a lei trabalhista atual (CLT)
                    </span>
                    <span className="text-gray-500 text-[11px] block mt-0.5 leading-tight">
                      Aplica adicional legal: <strong>50%</strong> para dias úteis (segunda a
                      sábado) e <strong>100%</strong> para domingos e feriados (CLT Art. 59 / Lei
                      605).
                    </span>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* 4. QUANTIDADE DE HORAS INFORMADAS */}
            {modoCalculo === 'padrao_50' ? (
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
                <Label className="text-xs font-semibold text-blue-950">
                  Quantidade Total de Horas Extras (50%) *
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  required
                  min="0.1"
                  value={horas50Todas}
                  onChange={(e) =>
                    setHoras50Todas(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                  }
                  placeholder="Ex: 15.5"
                  className="mt-1 bg-white font-mono font-bold text-base text-blue-900"
                />
                <span className="text-[10px] text-blue-700 mt-1 block">
                  Informe o número decimal de horas (ex: 15.5 equivale a 15h e 30min).
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 border border-purple-200 rounded-xl">
                <div>
                  <Label className="text-xs font-semibold text-purple-950">
                    Horas em Dias Úteis (50%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={horasCltUteis50}
                    onChange={(e) =>
                      setHorasCltUteis50(
                        e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="Ex: 12"
                    className="mt-1 bg-white font-mono font-bold text-purple-900"
                  />
                  <span className="text-[10px] text-purple-700 mt-0.5 block">Segunda a sábado</span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-purple-950">
                    Horas Domingos/Feriados (100%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={horasCltDomingos100}
                    onChange={(e) =>
                      setHorasCltDomingos100(
                        e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="Ex: 6"
                    className="mt-1 bg-white font-mono font-bold text-purple-900"
                  />
                  <span className="text-[10px] text-purple-700 mt-0.5 block">
                    Domingos & Feriados
                  </span>
                </div>
              </div>
            )}

            {/* 5. GRATIFICAÇÃO (+) E ADIANTAMENTO (−) */}
            <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                  Gratificação (+) e Adiantamento (−)
                </span>
                <span className="text-[10px] text-amber-800">Ajustes da Folha</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
                    Gratificação / Bônus (R$)
                    <span className="text-[10px] font-normal text-emerald-700">(Soma +)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={gratificacao}
                    onChange={(e) =>
                      setGratificacao(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    placeholder="0,00"
                    className="mt-1 font-mono font-bold text-emerald-800 bg-white"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Prêmio, bônus ou adicional extraordinário.
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-red-900 flex items-center gap-1">
                    Adiantamento (R$)
                    <span className="text-[10px] font-normal text-red-700">(Desconta −)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adiantamento}
                    onChange={(e) =>
                      setAdiantamento(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    placeholder="0,00"
                    className="mt-1 font-mono font-bold text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Vales ou adiantamentos já pagos no período.
                  </span>
                </div>
              </div>
            </div>

            {/* 6. MEMÓRIA DE CÁLCULO DETALHADA AO VIVO */}
            <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-teal-200 pb-1.5">
                <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  Memória de Cálculo (Jornada 220h)
                </span>
                <span className="text-[10px] text-teal-700 font-mono">Base: Salário ÷ 220</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-gray-500 block text-[10px]">Hora Normal:</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {formatCurrency(memoriaCalculo.valorHoraNormal)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Hora c/ 50%:</span>
                  <span className="font-mono font-semibold text-blue-700">
                    {formatCurrency(memoriaCalculo.valorHoraExtra50)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Hora c/ 100%:</span>
                  <span className="font-mono font-semibold text-purple-700">
                    {formatCurrency(memoriaCalculo.valorHoraExtra100)}
                  </span>
                </div>
              </div>

              <div className="border-t border-teal-200 pt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Total de Horas Extras:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {memoriaCalculo.totalHoras.toFixed(1)} horas
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Total Bruto Horas Extras:</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {formatCurrency(memoriaCalculo.totalValor)}
                  </span>
                </div>

                {memoriaCalculo.gratificacao > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-800">
                    <span>(+) Gratificação / Bônus:</span>
                    <span className="font-mono font-semibold">
                      +{formatCurrency(memoriaCalculo.gratificacao)}
                    </span>
                  </div>
                )}

                {memoriaCalculo.adiantamento > 0 && (
                  <div className="flex items-center justify-between text-xs text-red-700">
                    <span>(−) Adiantamento:</span>
                    <span className="font-mono font-semibold">
                      -{formatCurrency(memoriaCalculo.adiantamento)}
                    </span>
                  </div>
                )}

                <div className="border-t border-teal-300 pt-2 flex items-center justify-between bg-teal-100/60 p-2 rounded-lg">
                  <div>
                    <span className="text-xs font-bold text-teal-950 block">
                      Valor Líquido a Pagar:
                    </span>
                    <span className="text-[10px] text-teal-800">
                      Bruto + Gratificação − Adiantamento
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-xl text-teal-950 tabular-nums">
                      {formatCurrency(memoriaCalculo.valorLiquido)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. OBSERVAÇÕES OPCIONAIS */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Observações Operacionais (Opcional)
              </Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Turno de manutenção preventiva noturna no britador Lokotrack..."
                className="mt-1 text-xs"
              />
            </div>

            <SheetFooter className="pt-3 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
              >
                {isSaving ? 'Gravando...' : 'Salvar & Gerar Recibo'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* MODAL DE IMPRESSÃO INDIVIDUAL A4 PAISAGEM */}
      {selectedFolhaParaRecibo && (
        <ReciboHorasExtrasModal
          open={reciboModalOpen}
          onOpenChange={setReciboModalOpen}
          item={selectedFolhaParaRecibo}
          empresa={currentEmpresa}
          funcionario={selectedFolhaParaRecibo.expand?.funcionario_id}
        />
      )}

      {/* MODAL DE IMPRESSÃO DA FOLHA COMPLETA A4 PAISAGEM */}
      <FolhaHorasExtrasImpressaoModal
        open={folhaCompletaModalOpen}
        onOpenChange={setFolhaCompletaModalOpen}
        itens={folhasFiltradas}
        empresa={currentEmpresa}
        mesReferenciaFiltro={mesFiltro}
        modoCalculoFiltro={modoFiltro}
      />
    </div>
  )
}
