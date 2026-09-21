import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
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
  const [saldoCaixa, setSaldoCaixa] = useState(0)
  const [pagarMes, setPagarMes] = useState(0)
  const [receberMes, setReceberMes] = useState(0)
  const [resultadoMes, setResultadoMes] = useState(0)

  const [movimentosRecentes, setMovimentosRecentes] = useState<any[]>([])
  const [proximosVencimentos, setProximosVencimentos] = useState<any[]>([])
  const [atrasoPagar, setAtrasoPagar] = useState({ count: 0, total: 0 })
  const [atrasoReceber, setAtrasoReceber] = useState({ count: 0, total: 0 })
  const [chartData, setChartData] = useState<any[]>([])

  // Realtime subscriptions
  useRealtime('movimentos_financeiros', () => loadDashboardData())
  useRealtime('contas_pagar', () => loadDashboardData())
  useRealtime('contas_receber', () => loadDashboardData())

  const loadDashboardData = async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()

      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString()
      const endOfMonth = new Date(
        Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59),
      ).toISOString()
      const todayISO = now.toISOString().slice(0, 10)

      // 1. Bancos / Caixas (Saldo total)
      const contasBancarias = await pb.collection('bancos_contas').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
      })
      const saldoInicialTotal = contasBancarias.reduce((acc, c) => acc + (c.saldo_inicial || 0), 0)

      // 2. All Movimentos for cash position and monthly result
      const allMovimentos = await pb.collection('movimentos_financeiros').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}'`,
        sort: '-data',
      })

      let saldoAtual = saldoInicialTotal
      let receitasMes = 0
      let despesasMes = 0

      allMovimentos.forEach((m) => {
        const val = m.valor || 0
        if (m.tipo === 'Entrada') {
          saldoAtual += val
        } else {
          saldoAtual -= val
        }

        const mDate = new Date(m.data)
        if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) {
          if (m.tipo === 'Entrada') {
            receitasMes += val
          } else {
            despesasMes += val
          }
        }
      })

      setSaldoCaixa(saldoAtual)
      setResultadoMes(receitasMes - despesasMes)
      setMovimentosRecentes(allMovimentos.slice(0, 6))

      // 3. Contas a Pagar do Mês
      const cpMesList = await pb.collection('contas_pagar').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}' && vencimento >= '${startOfMonth}' && vencimento <= '${endOfMonth}'`,
      })
      const totalPagarMes = cpMesList
        .filter((cp) => cp.status === 'Aberta' || cp.status === 'Vencida')
        .reduce((sum, cp) => sum + (cp.valor || 0), 0)
      setPagarMes(totalPagarMes)

      // 4. Contas a Receber do Mês
      const crMesList = await pb.collection('contas_receber').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}' && vencimento >= '${startOfMonth}' && vencimento <= '${endOfMonth}'`,
      })
      const totalReceberMes = crMesList
        .filter((cr) => cr.status === 'Aberta' || cr.status === 'Vencida')
        .reduce((sum, cr) => sum + (cr.valor || 0), 0)
      setReceberMes(totalReceberMes)

      // 5. Aging Overdue Summary
      const allCpAbertas = await pb.collection('contas_pagar').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}' && status != 'Paga'`,
      })
      const atrasoPagarItems = allCpAbertas.filter((c) => c.vencimento.slice(0, 10) < todayISO)
      setAtrasoPagar({
        count: atrasoPagarItems.length,
        total: atrasoPagarItems.reduce((acc, c) => acc + (c.valor || 0), 0),
      })

      const allCrAbertas = await pb.collection('contas_receber').getFullList({
        filter: `empresa_id = '${currentEmpresa.id}' && status != 'Recebida'`,
      })
      const atrasoReceberItems = allCrAbertas.filter((c) => c.vencimento.slice(0, 10) < todayISO)
      setAtrasoReceber({
        count: atrasoReceberItems.length,
        total: atrasoReceberItems.reduce((acc, c) => acc + (c.valor || 0), 0),
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
      // 7. Gráfico dos últimos 6 meses
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
      const monthsData = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1)
        const y = d.getFullYear()
        const m = d.getMonth()
        const label = `${monthNames[m]}/${String(y).slice(2)}`

        let ent = 0
        let sai = 0
        allMovimentos.forEach((mov) => {
          const md = new Date(mov.data)
          if (md.getFullYear() === y && md.getMonth() === m) {
            if (mov.tipo === 'Entrada') ent += mov.valor || 0
            else sai += mov.valor || 0
          }
        })

        monthsData.push({
          mes: label,
          Entradas: ent,
          Saídas: sai,
        })
      }
      setChartData(monthsData)
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [currentEmpresa])

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
              className="border-[#ECEAE4] hover:bg-amber-50 hover:text-amber-800 text-gray-700 rounded-xl text-xs h-9"
            >
              <FileCheck2 className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Nova Conciliação
            </Button>
          </div>
        )}
      </div>

      {/* 4 KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Saldo em Caixa */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Saldo em Caixa
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
              {formatCurrency(saldoCaixa)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
              Disponibilidade imediata
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Contas a Pagar no Mês */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              A Pagar no Mês
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-red-600 tabular-nums">
              {formatCurrency(pagarMes)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-gray-400" />
              Vencimento no mês atual
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Contas a Receber no Mês */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              A Receber no Mês
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-teal-700 tabular-nums">
              {formatCurrency(receberMes)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-gray-400" />
              Previsão de faturamento
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Resultado do Mês */}
        <Card className="rounded-2xl border-[#ECEAE4] shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Resultado do Mês
            </CardTitle>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                resultadoMes >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {resultadoMes >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                resultadoMes >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(resultadoMes)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {resultadoMes >= 0 ? 'Superávit operacional' : 'Déficit no período'}
            </p>
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
