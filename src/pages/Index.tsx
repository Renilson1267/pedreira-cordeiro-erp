import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { calcularDatasPeriodoRapido, estaDentroDoPeriodo } from '@/lib/periodo'
import FiltroPeriodoBar from '@/components/financeiro/FiltroPeriodoBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  PlusCircle,
  FileCheck2,
  Clock,
  ArrowRight,
  Truck,
  Wrench,
  Fuel,
  Construction,
  ShieldAlert,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const { currentEmpresa, canEdit } = useCompany()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)

  // Filtro de período no Dashboard (padrão Contas a Pagar/Receber)
  const [opcaoPeriodo, setOpcaoPeriodo] = useState<string>('este_mes')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').inicio
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').fim
  })

  const [saldoCaixa, setSaldoCaixa] = useState(0)
  const [entradasPeriodoTotal, setEntradasPeriodoTotal] = useState(0)
  const [saidasPeriodoTotal, setSaidasPeriodoTotal] = useState(0)
  const [pagarPeriodo, setPagarPeriodo] = useState(0)
  const [receberPeriodo, setReceberPeriodo] = useState(0)
  const [resultadoPeriodo, setResultadoPeriodo] = useState(0)
  const [saldoGeralAcumulado, setSaldoGeralAcumulado] = useState(0)

  const [movimentosRecentes, setMovimentosRecentes] = useState<any[]>([])
  const [proximosVencimentos, setProximosVencimentos] = useState<any[]>([])
  const [atrasoPagar, setAtrasoPagar] = useState({ count: 0, total: 0 })
  const [atrasoReceber, setAtrasoReceber] = useState({ count: 0, total: 0 })
  const [chartData, setChartData] = useState<any[]>([])

  // Frotas state
  const [frotaResumo, setFrotaResumo] = useState({
    totalAtivos: 0,
    totalManutencao: 0,
    custoFrotaMes: 0,
    totalLitrosMes: 0,
  })
  const [alertasRevisao, setAlertasRevisao] = useState<any[]>([])

  // Realtime subscriptions
  useRealtime('movimentos_financeiros', () => loadDashboardData())
  useRealtime('contas_pagar', () => loadDashboardData())
  useRealtime('contas_receber', () => loadDashboardData())
  useRealtime('veiculos', () => loadDashboardData())
  useRealtime('abastecimentos', () => loadDashboardData())
  useRealtime('manutencoes', () => loadDashboardData())

  const loadDashboardData = useCallback(async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const now = new Date()
      const todayISO = now.toISOString().slice(0, 10)

      // 1. Bancos / Caixas (Saldo inicial cadastrado)
      const contasBancarias = await pb.collection('bancos_contas').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
      })
      const saldoInicialTotal = contasBancarias.reduce((acc, c) => acc + (c.saldo_inicial || 0), 0)

      // 2. All Movimentos for cash position and monthly result
      const allMovimentos = await pb.collection('movimentos_financeiros').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
        sort: '-data',
      })

      // Saldo geral acumulado de todas as contas até o momento
      let saldoAcumuladoTotal = saldoInicialTotal
      let entradasPeriodo = 0
      let saidasPeriodo = 0

      // Movimentos filtrados pelo período selecionado
      const movimentosNoPeriodo: any[] = []

      allMovimentos.forEach((m) => {
        const val = m.valor || 0
        if (m.tipo === 'Entrada') {
          saldoAcumuladoTotal += val
        } else {
          saldoAcumuladoTotal -= val
        }

        const noIntervalo = estaDentroDoPeriodo(m.data, dataInicio, dataFim)
        if (noIntervalo) {
          movimentosNoPeriodo.push(m)
          if (m.tipo === 'Entrada') {
            entradasPeriodo += val
          } else {
            saidasPeriodo += val
          }
        }
      })

      setSaldoGeralAcumulado(saldoAcumuladoTotal)
      setEntradasPeriodoTotal(entradasPeriodo)
      setSaidasPeriodoTotal(saidasPeriodo)

      // Saldo em Caixa Real Atual: o saldo disponível total em caixa/bancos até hoje
      setSaldoCaixa(saldoAcumuladoTotal)

      // Resultado do Período / do Mês: entradas menos saídas do período selecionado
      const resultadoCalc = entradasPeriodo - saidasPeriodo
      setResultadoPeriodo(resultadoCalc)
      setMovimentosRecentes(
        (movimentosNoPeriodo.length > 0 ? movimentosNoPeriodo : allMovimentos).slice(0, 6),
      )

      // 3. Contas a Pagar do Período (considerando saldo em aberto)
      const allCp = await pb.collection('contas_pagar').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
      })
      const cpNoPeriodo = allCp.filter((cp) =>
        estaDentroDoPeriodo(cp.vencimento, dataInicio, dataFim),
      )
      const totalPagarPeriodo = cpNoPeriodo
        .filter((cp) => cp.status !== 'Paga')
        .reduce((sum, cp) => {
          const jaPago = cp.valor_pago || 0
          return sum + Math.max(0, (cp.valor || 0) - jaPago)
        }, 0)
      setPagarPeriodo(totalPagarPeriodo)

      // 4. Contas a Receber do Período (considerando saldo em aberto)
      const allCr = await pb.collection('contas_receber').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
      })
      const crNoPeriodo = allCr.filter((cr) =>
        estaDentroDoPeriodo(cr.vencimento, dataInicio, dataFim),
      )
      const totalReceberPeriodo = crNoPeriodo
        .filter((cr) => cr.status !== 'Recebida' && cr.status !== 'Recebimento Antecipado')
        .reduce((sum, cr) => {
          const jaRecebido = cr.valor_recebido || 0
          return sum + Math.max(0, (cr.valor || 0) - jaRecebido)
        }, 0)
      setReceberPeriodo(totalReceberPeriodo)

      // 5. Aging Overdue Summary (saldo restante das vencidas hoje)
      const allCpAbertas = allCp.filter((c) => c.status !== 'Paga')
      const atrasoPagarItems = allCpAbertas.filter(
        (c) => c.vencimento && c.vencimento.slice(0, 10) < todayISO,
      )
      setAtrasoPagar({
        count: atrasoPagarItems.length,
        total: atrasoPagarItems.reduce((acc, c) => {
          const jaPago = c.valor_pago || 0
          return acc + Math.max(0, (c.valor || 0) - jaPago)
        }, 0),
      })

      const allCrAbertas = allCr.filter(
        (c) => c.status !== 'Recebida' && c.status !== 'Recebimento Antecipado',
      )
      const atrasoReceberItems = allCrAbertas.filter(
        (c) => c.vencimento && c.vencimento.slice(0, 10) < todayISO,
      )
      setAtrasoReceber({
        count: atrasoReceberItems.length,
        total: atrasoReceberItems.reduce((acc, c) => {
          const jaRecebido = c.valor_recebido || 0
          return acc + Math.max(0, (c.valor || 0) - jaRecebido)
        }, 0),
      })

      // 6. Próximos 5 Vencimentos (unindo pagar e receber)
      const proximosCp = (allCpAbertas as any[])
        .filter((c) => c.vencimento && c.vencimento.slice(0, 10) >= todayISO)
        .map((c) => ({ ...c, tipoConta: 'pagar' }))
      const proximosCr = (allCrAbertas as any[])
        .filter((c) => c.vencimento && c.vencimento.slice(0, 10) >= todayISO)
        .map((c) => ({ ...c, tipoConta: 'receber' }))

      const unificados = [...proximosCp, ...proximosCr]
        .sort(
          (a: any, b: any) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime(),
        )
        .slice(0, 5)
      setProximosVencimentos(unificados)

      // 7. Gráfico Fluxo de Caixa: se o período selecionado for maior que 1 mês, agrupa por mês desse intervalo;
      // senão mostra últimos 6 meses com destaque ao período.
      const monthNames = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ]

      // Determinar meses a exibir no gráfico
      const mesesLabels: { ano: number; mes: number; label: string }[] = []
      if (dataInicio && dataFim) {
        const dIni = new Date(dataInicio + 'T00:00:00')
        const dFim = new Date(dataFim + 'T23:59:59')
        const diffMeses =
          (dFim.getFullYear() - dIni.getFullYear()) * 12 + (dFim.getMonth() - dIni.getMonth())
        if (diffMeses >= 1 && diffMeses <= 12) {
          for (let m = 0; m <= diffMeses; m++) {
            const dt = new Date(dIni.getFullYear(), dIni.getMonth() + m, 1)
            mesesLabels.push({
              ano: dt.getFullYear(),
              mes: dt.getMonth(),
              label: `${monthNames[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`,
            })
          }
        }
      }

      if (mesesLabels.length === 0) {
        // Padrão: últimos 6 meses
        const baseDate = dataFim ? new Date(dataFim + 'T00:00:00') : now
        const baseYear = baseDate.getFullYear()
        const baseMonth = baseDate.getMonth()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(baseYear, baseMonth - i, 1)
          mesesLabels.push({
            ano: d.getFullYear(),
            mes: d.getMonth(),
            label: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
          })
        }
      }

      const monthsData = mesesLabels.map(({ ano, mes, label }) => {
        let ent = 0
        let sai = 0
        allMovimentos.forEach((mov) => {
          if (!mov.data) return
          const md = new Date(mov.data)
          if (md.getFullYear() === ano && md.getMonth() === mes) {
            if (mov.tipo === 'Entrada') ent += mov.valor || 0
            else sai += mov.valor || 0
          }
        })
        return {
          mes: label,
          Entradas: ent,
          Saídas: sai,
        }
      })
      setChartData(monthsData)

      // 8. Frotas da Pedreira Resumo & Alertas (respeitando o período selecionado quando informado)
      try {
        const [veicList, abastList, manutList] = await Promise.all([
          pb.collection('veiculos').getFullList({
            filter: `empresa_id = '${currentEmpresa.id}'`,
          }),
          pb.collection('abastecimentos').getFullList({
            filter: `empresa_id = '${currentEmpresa.id}'`,
          }),
          pb.collection('manutencoes').getFullList({
            filter: `empresa_id = '${currentEmpresa.id}'`,
          }),
        ])

        const abastFiltrados = abastList.filter((a) =>
          estaDentroDoPeriodo(a.data, dataInicio, dataFim),
        )
        const manutFiltradas = manutList.filter((m) =>
          estaDentroDoPeriodo(m.data, dataInicio, dataFim),
        )

        const totalAtivos = veicList.filter((v) => v.status === 'ativo').length
        const totalManutencao = veicList.filter((v) => v.status === 'manutencao').length
        const custoCombustivel = abastFiltrados.reduce((acc, a) => acc + (a.valor_total || 0), 0)
        const custoManutencao = manutFiltradas.reduce((acc, m) => acc + (m.custo || 0), 0)
        const totalLitros = abastFiltrados.reduce((acc, a) => acc + (a.litros || 0), 0)

        setFrotaResumo({
          totalAtivos,
          totalManutencao,
          custoFrotaMes: custoCombustivel + custoManutencao,
          totalLitrosMes: totalLitros,
        })

        // Buscar manutenções com próxima revisão próxima ou vencida
        const allManutencoes = await pb.collection('manutencoes').getFullList({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'veiculo_id',
          sort: '-created',
        })

        const alertas: any[] = []
        allManutencoes.forEach((m) => {
          if (!m.proxima_revisao_data && !m.proxima_revisao_medidor) return
          const v = veicList.find((ve) => ve.id === m.veiculo_id)
          if (!v) return

          if (m.proxima_revisao_data) {
            const pDate = m.proxima_revisao_data.slice(0, 10)
            const diffDays = Math.ceil(
              (new Date(pDate).getTime() - new Date(todayISO).getTime()) / (1000 * 3600 * 24),
            )
            if (diffDays <= 0) {
              alertas.push({
                codigo: v.codigo_interno,
                modelo: v.modelo,
                mensagem: `Revisão vencida (${pDate})`,
                severidade: 'urgente',
              })
            } else if (diffDays <= 15) {
              alertas.push({
                codigo: v.codigo_interno,
                modelo: v.modelo,
                mensagem: `Revisão em ${diffDays} dias`,
                severidade: 'alerta',
              })
            }
          }
        })
        setAlertasRevisao(alertas.slice(0, 3))
      } catch (fErr) {
        console.error('Error loading frota dashboard cards:', fErr)
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [currentEmpresa, dataInicio, dataFim])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const firstName = useMemo(() => {
    if (!user?.name) return 'Colaborador'
    return user.name.split(' ')[0]
  }, [user])

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#ECEAE4] shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Olá, {firstName} 👋</h1>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {currentEmpresa?.nome_fantasia} • {currentDateFormatted}
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate('/financeiro/pagar?novo=1')}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              Nova Conta a Pagar
            </Button>
            <Button
              onClick={() => navigate('/financeiro/receber?novo=1')}
              variant="outline"
              className="border-[#ECEAE4] hover:bg-teal-50 hover:text-teal-800 text-gray-700 rounded-xl text-xs h-9"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              Nova Conta a Receber
            </Button>
            <Button
              onClick={() => navigate('/financeiro/conciliacao')}
              variant="outline"
              className="border-[#ECEAE4] hover:bg-teal-50 hover:text-teal-800 text-gray-700 rounded-xl text-xs h-9"
            >
              <FileCheck2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              Nova Conciliação
            </Button>
            <Button
              onClick={() => navigate('/frotas/abastecimentos')}
              variant="outline"
              className="border-[#ECEAE4] hover:bg-amber-50 hover:text-amber-800 text-gray-700 rounded-xl text-xs h-9"
            >
              <Fuel className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Abastecer Máquina
            </Button>
          </div>
        )}
      </div>

      {/* Seção Frotas da Pedreira - Resumo Operacional */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Construction className="w-4 h-4 text-teal-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Operação de Pedreira & Gestão de Frotas
            </h2>
          </div>
          <button
            onClick={() => navigate('/frotas/veiculos')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            <span>Ver frota completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Veículos Ativos */}
          <Card
            onClick={() => navigate('/frotas/veiculos?status=ativo')}
            className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 cursor-pointer hover:border-teal-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Frota Operando</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
              {frotaResumo.totalAtivos}{' '}
              <span className="text-xs font-normal text-gray-400">máquinas / caminhões</span>
            </div>
            <p className="text-[11px] text-emerald-600 mt-1 flex items-center">
              ● Liberados para lavra e transporte
            </p>
          </Card>

          {/* Card 2: Em Manutenção */}
          <Card
            onClick={() => navigate('/frotas/manutencoes')}
            className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 cursor-pointer hover:border-amber-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Em Manutenção</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-2 font-mono">
              {frotaResumo.totalManutencao}{' '}
              <span className="text-xs font-normal text-gray-400">unidades paradas</span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Oficina mecânica ou revisão preventiva
            </p>
          </Card>

          {/* Card 3: Custo da Frota no Mês */}
          <Card
            onClick={() => navigate('/frotas/abastecimentos')}
            className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 cursor-pointer hover:border-red-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                Custo da Frota no Mês
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <Fuel className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 mt-2 font-mono tabular-nums">
              {formatCurrency(frotaResumo.custoFrotaMes)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Combustível + Manutenções do período</p>
          </Card>

          {/* Card 4: Alertas de Revisão */}
          <Card
            onClick={() => navigate('/frotas/manutencoes')}
            className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 cursor-pointer hover:border-amber-300 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Revisões Programadas
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>

              {alertasRevisao.length === 0 ? (
                <div className="mt-2 text-xs text-gray-400">
                  Nenhuma revisão crítica vencida neste momento.
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {alertasRevisao.map((alerta, i) => (
                    <div key={i} className="text-[11px] flex items-center justify-between">
                      <span className="font-mono font-bold text-gray-800">{alerta.codigo}</span>
                      <span
                        className={
                          alerta.severidade === 'urgente'
                            ? 'text-red-600 font-semibold text-[10px]'
                            : 'text-amber-800 text-[10px]'
                        }
                      >
                        {alerta.mensagem}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-gray-400 mt-2 pt-1 border-t border-[#ECEAE4]">
              Monitoramento preventivo por horímetro/km
            </p>
          </Card>
        </div>
      </div>

      {/* Barra de Filtro de Período do Dashboard */}
      <div className="bg-white p-4 rounded-2xl border border-[#ECEAE4] shadow-xs">
        <FiltroPeriodoBar
          rotulo="Período do Dashboard:"
          opcaoPeriodo={opcaoPeriodo}
          onOpcaoChange={setOpcaoPeriodo}
          dataInicio={dataInicio}
          onDataInicioChange={setDataInicio}
          dataFim={dataFim}
          onDataFimChange={setDataFim}
          mostrarLimpar={opcaoPeriodo !== 'todos' || Boolean(dataInicio || dataFim)}
          onLimpar={() => {
            setOpcaoPeriodo('todos')
            setDataInicio('')
            setDataFim('')
          }}
        />
        {dataInicio && dataFim && (
          <div className="mt-2 pt-2 border-t border-[#ECEAE4]/60 flex items-center justify-between text-[11px] text-gray-500">
            <span>
              Exibindo dados de <strong>{formatDate(dataInicio)}</strong> até{' '}
              <strong>{formatDate(dataFim)}</strong>
            </span>
            <span className="text-gray-400">
              Saldo geral consolidado em contas:{' '}
              <strong>{formatCurrency(saldoGeralAcumulado)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 4 KPIs Row — Com destaque azul para positivo e vermelho para negativo no Resultado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Saldo em Caixa Real (análise das contas/caixas + movimentos reais) */}
        <Card
          className={`rounded-2xl border shadow-xs transition-colors ${
            saldoCaixa < 0
              ? 'bg-red-50/50 border-red-200'
              : saldoCaixa > 0
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-white border-[#ECEAE4]'
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Saldo em Caixa
            </CardTitle>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                saldoCaixa < 0
                  ? 'bg-red-100 text-red-700'
                  : saldoCaixa > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                saldoCaixa < 0
                  ? 'text-red-600'
                  : saldoCaixa > 0
                    ? 'text-emerald-700'
                    : 'text-gray-900'
              }`}
            >
              {formatCurrency(saldoCaixa)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
              <span>Disponível consolidado</span>
              {dataInicio || dataFim ? (
                <span className="text-[10px] text-gray-400 font-mono">
                  Fluxo no filtro: {entradasPeriodoTotal >= saidasPeriodoTotal ? '+' : ''}
                  {formatCurrency(entradasPeriodoTotal - saidasPeriodoTotal)}
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Contas a Pagar no Período */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              A Pagar no Período
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-red-600 tabular-nums">
              {formatCurrency(pagarPeriodo)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-gray-400" />
              Vencimentos no filtro ativo
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Contas a Receber no Período */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              A Receber no Período
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-teal-700 tabular-nums">
              {formatCurrency(receberPeriodo)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-gray-400" />
              Previsão de faturamento
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Resultado — DESTAQUE VERMELHO quando NEGATIVO e AZUL quando POSITIVO */}
        <Card
          className={`rounded-2xl border shadow-sm transition-all ${
            resultadoPeriodo < 0
              ? 'bg-red-50 border-red-300 ring-2 ring-red-400/50'
              : resultadoPeriodo > 0
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/50'
                : 'bg-white border-[#ECEAE4]'
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle
              className={`text-xs font-bold uppercase tracking-wider ${
                resultadoPeriodo < 0
                  ? 'text-red-800'
                  : resultadoPeriodo > 0
                    ? 'text-blue-900'
                    : 'text-gray-500'
              }`}
            >
              {opcaoPeriodo === 'este_mes'
                ? 'Resultado do Mês'
                : dataInicio || dataFim
                  ? 'Resultado do Período'
                  : 'Resultado do Mês / Período'}
            </CardTitle>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                resultadoPeriodo < 0
                  ? 'bg-red-600 text-white shadow-md shadow-red-200'
                  : resultadoPeriodo > 0
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {resultadoPeriodo < 0 ? (
                <TrendingDown className="w-5 h-5 stroke-[2.5]" />
              ) : resultadoPeriodo > 0 ? (
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-black tracking-tight tabular-nums ${
                resultadoPeriodo < 0
                  ? 'text-red-600'
                  : resultadoPeriodo > 0
                    ? 'text-blue-700'
                    : 'text-gray-900'
              }`}
            >
              {formatCurrency(resultadoPeriodo)}
            </div>
            <div
              className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] font-semibold ${
                resultadoPeriodo < 0
                  ? 'border-red-200 text-red-700'
                  : resultadoPeriodo > 0
                    ? 'border-blue-200 text-blue-700'
                    : 'border-gray-100 text-gray-500'
              }`}
            >
              <span>
                {resultadoPeriodo < 0
                  ? '● Negativo (Déficit operacional)'
                  : resultadoPeriodo > 0
                    ? '● Positivo (Superávit operacional)'
                    : 'Equilíbrio (R$ 0,00)'}
              </span>
              <span className="text-[10px] font-mono opacity-80">
                +{formatCurrency(entradasPeriodoTotal)} / -{formatCurrency(saidasPeriodoTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Atraso Pagar */}
        <div
          onClick={() => navigate('/financeiro/pagar?status=Vencidas')}
          className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/60 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                Contas a Pagar em Atraso
              </div>
              <div className="text-xl font-bold text-amber-950 tabular-nums">
                {formatCurrency(atrasoPagar.total)}{' '}
                <span className="text-xs font-normal text-amber-800">
                  ({atrasoPagar.count} {atrasoPagar.count === 1 ? 'título' : 'títulos'})
                </span>
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-800 group-hover:translate-x-1 transition-transform" />
        </div>

        {/* Atraso Receber */}
        <div
          onClick={() => navigate('/financeiro/receber?status=Vencidas')}
          className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80 hover:bg-orange-100/60 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-orange-900 uppercase tracking-wider">
                Contas a Receber em Atraso
              </div>
              <div className="text-xl font-bold text-orange-950 tabular-nums">
                {formatCurrency(atrasoReceber.total)}{' '}
                <span className="text-xs font-normal text-orange-800">
                  ({atrasoReceber.count} {atrasoReceber.count === 1 ? 'título' : 'títulos'})
                </span>
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-orange-800 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Chart: Entradas vs Saídas últimos 6 meses */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold text-gray-900">
              Fluxo de Caixa — Entradas vs Saídas
            </CardTitle>
            <p className="text-xs text-gray-500">Histórico consolidado dos últimos 6 meses</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEAE4" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={{ stroke: '#ECEAE4' }}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#ECEAE4' }}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    borderColor: '#ECEAE4',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Entradas" fill="#0F766E" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="Saídas" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Section: Próximos Vencimentos + Movimentos Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos 5 Vencimentos */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                Próximos Vencimentos
              </CardTitle>
              <p className="text-xs text-gray-500">Títulos a liquidar nos próximos dias</p>
            </div>
          </CardHeader>
          <CardContent>
            {proximosVencimentos.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                Nenhum vencimento pendente para os próximos dias.
              </div>
            ) : (
              <div className="divide-y divide-[#ECEAE4]">
                {proximosVencimentos.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {item.descricao}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            item.tipoConta === 'pagar'
                              ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                              : 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                          }
                        >
                          {item.tipoConta === 'pagar' ? 'A Pagar' : 'A Receber'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Vence em:{' '}
                        <strong className="text-gray-600">{formatDate(item.vencimento)}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            item.tipoConta === 'pagar' ? 'text-red-600' : 'text-teal-700'
                          }`}
                        >
                          {formatCurrency(item.valor)}
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              item.tipoConta === 'pagar'
                                ? `/financeiro/pagar?id=${item.id}&action=settle`
                                : `/financeiro/receber?id=${item.id}&action=settle`,
                            )
                          }
                          className="h-7 text-xs border-[#ECEAE4] hover:bg-teal-50 hover:text-teal-800"
                        >
                          Baixar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos Movimentos */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                Últimos Movimentos
              </CardTitle>
              <p className="text-xs text-gray-500">Transações efetivadas recentemente</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/relatorios')}
              className="text-xs text-teal-700 hover:text-teal-800"
            >
              Ver todos
            </Button>
          </CardHeader>
          <CardContent>
            {movimentosRecentes.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                Nenhum movimento registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-[#ECEAE4]">
                {movimentosRecentes.map((mov) => (
                  <div key={mov.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{mov.descricao}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(mov.data)} • Origem: {mov.origem}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          mov.tipo === 'Entrada' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {mov.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(mov.valor)}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {mov.conciliado ? '✓ Conciliado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
