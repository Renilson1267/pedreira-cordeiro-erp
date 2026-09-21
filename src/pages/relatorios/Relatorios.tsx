import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type {
  MovimentoFinanceiro,
  ContaPagar,
  ContaReceber,
  Fornecedor,
  Cliente,
  PlanoConta,
} from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Download,
  LineChart,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Calendar,
  Layers,
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

export default function Relatorios() {
  const { currentEmpresa } = useCompany()

  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [selectedMes, setSelectedMes] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [m, cp, cr, f, c, pc] = await Promise.all([
        pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'categoria_id',
          sort: '-data',
        }),
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'fornecedor_id,categoria_id',
        }),
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'cliente_id,categoria_id',
        }),
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])

      setMovimentos(m)
      setContasPagar(cp)
      setContasReceber(cr)
      setFornecedores(f)
      setClientes(c)
      setPlanoContas(pc)
    } catch (err) {
      console.error('Error fetching reports data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Report cards definition
  const reportCards = [
    {
      id: 'fluxo_caixa',
      title: 'Fluxo de Caixa',
      description: 'Evolução detalhada de entradas e saídas com gráfico interativo e projeção.',
      icon: LineChart,
      color: 'bg-teal-50 text-teal-700',
    },
    {
      id: 'pagar_fornecedor',
      title: 'Contas a Pagar por Fornecedor',
      description:
        'Agrupamento consolidado de obrigações em aberto e pagas por parceiro comercial.',
      icon: ArrowDownLeft,
      color: 'bg-red-50 text-red-600',
    },
    {
      id: 'receber_cliente',
      title: 'Contas a Receber por Cliente',
      description: 'Faturamento, títulos recebidos e créditos pendentes por tomador de serviço.',
      icon: ArrowUpRight,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'resultado_categoria',
      title: 'Resultado por Categoria',
      description:
        'Demonstrativo visual com barras horizontais dos maiores centros de custos e receitas.',
      icon: BarChart2,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      id: 'movimentacao_periodo',
      title: 'Movimentação por Período (Ledger)',
      description: 'Livro caixa integral com filtros, conciliações, data a data para auditoria.',
      icon: BookOpen,
      color: 'bg-blue-50 text-blue-700',
    },
  ]

  // Filtered movements for selected month
  const filteredMovimentos = useMemo(() => {
    if (!selectedMes) return movimentos
    const [year, month] = selectedMes.split('-')
    return movimentos.filter((m) => {
      const d = new Date(m.data)
      return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month)
    })
  }, [movimentos, selectedMes])

  // Aggregation for pagar_fornecedor
  const pagarPorFornecedor = useMemo(() => {
    const map: Record<string, { nome: string; aberto: number; pago: number; total: number }> = {}
    contasPagar.forEach((cp) => {
      const nome = cp.expand?.fornecedor_id?.nome || 'Diversos / Sem Fornecedor'
      if (!map[nome]) map[nome] = { nome, aberto: 0, pago: 0, total: 0 }
      if (cp.status === 'Paga') {
        map[nome].pago += cp.valor || 0
      } else {
        map[nome].aberto += cp.valor || 0
      }
      map[nome].total += cp.valor || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [contasPagar])

  // Aggregation for receber_cliente
  const receberPorCliente = useMemo(() => {
    const map: Record<string, { nome: string; aberto: number; recebido: number; total: number }> =
      {}
    contasReceber.forEach((cr) => {
      const nome = cr.expand?.cliente_id?.nome || 'Consumidor / Sem Cliente'
      if (!map[nome]) map[nome] = { nome, aberto: 0, recebido: 0, total: 0 }
      if (cr.status === 'Recebida') {
        map[nome].recebido += cr.valor || 0
      } else {
        map[nome].aberto += cr.valor || 0
      }
      map[nome].total += cr.valor || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [contasReceber])

  // Aggregation for resultado_categoria
  const resultadoPorCategoria = useMemo(() => {
    const map: Record<string, { nome: string; tipo: string; total: number }> = {}
    filteredMovimentos.forEach((m) => {
      const cat = m.expand?.categoria_id?.nome || 'Sem Categoria'
      const tipo = m.expand?.categoria_id?.tipo || (m.tipo === 'Entrada' ? 'Receita' : 'Despesa')
      if (!map[cat]) map[cat] = { nome: cat, tipo, total: 0 }
      map[cat].total += m.valor || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredMovimentos])

  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    let content = headers.join(';') + '\r\n'
    rows.forEach((r) => {
      content += r.map((cell) => `"${cell}"`).join(';') + '\r\n'
    })
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}.csv`
    link.click()
    toast({ title: 'Relatório CSV exportado com sucesso!' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Central de Relatórios</h1>
          <p className="text-xs text-gray-500">
            Inteligência financeira, demonstrativos consolidados e exportações de dados
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Input
            type="month"
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            className="bg-white border-[#ECEAE4] font-mono text-xs"
          />
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reportCards.map((rc) => {
          const Icon = rc.icon
          return (
            <Card
              key={rc.id}
              onClick={() => setActiveReport(rc.id)}
              className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:shadow-md transition-all cursor-pointer p-6 flex flex-col justify-between group"
            >
              <div>
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${rc.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-base group-hover:text-teal-700 transition-colors">
                  {rc.title}
                </h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{rc.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#ECEAE4] flex items-center justify-between text-xs font-semibold text-teal-700">
                <span>Gerar Relatório</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Modal / Sheet for Active Report Detail */}
      <Sheet open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
        <SheetContent className="sm:max-w-[720px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-[#ECEAE4]">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold text-gray-900">
                {reportCards.find((r) => r.id === activeReport)?.title}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (activeReport === 'fluxo_caixa') {
                      exportCSV(
                        `Fluxo_Caixa_${selectedMes}`,
                        ['Data', 'Descrição', 'Tipo', 'Valor', 'Conciliado'],
                        filteredMovimentos.map((m) => [
                          formatDate(m.data),
                          m.descricao,
                          m.tipo,
                          m.valor.toFixed(2),
                          m.conciliado ? 'Sim' : 'Não',
                        ]),
                      )
                    } else if (activeReport === 'pagar_fornecedor') {
                      exportCSV(
                        `Pagar_Fornecedor_${selectedMes}`,
                        ['Fornecedor', 'Em Aberto', 'Pago', 'Total'],
                        pagarPorFornecedor.map((f) => [
                          f.nome,
                          f.aberto.toFixed(2),
                          f.pago.toFixed(2),
                          f.total.toFixed(2),
                        ]),
                      )
                    } else if (activeReport === 'receber_cliente') {
                      exportCSV(
                        `Receber_Cliente_${selectedMes}`,
                        ['Cliente', 'Em Aberto', 'Recebido', 'Total'],
                        receberPorCliente.map((c) => [
                          c.nome,
                          c.aberto.toFixed(2),
                          c.recebido.toFixed(2),
                          c.total.toFixed(2),
                        ]),
                      )
                    } else if (activeReport === 'resultado_categoria') {
                      exportCSV(
                        `Resultado_Categoria_${selectedMes}`,
                        ['Categoria', 'Tipo', 'Total'],
                        resultadoPorCategoria.map((cat) => [
                          cat.nome,
                          cat.tipo,
                          cat.total.toFixed(2),
                        ]),
                      )
                    } else {
                      exportCSV(
                        `Ledger_${selectedMes}`,
                        ['Data', 'Descrição', 'Tipo', 'Origem', 'Valor'],
                        filteredMovimentos.map((m) => [
                          formatDate(m.data),
                          m.descricao,
                          m.tipo,
                          m.origem,
                          m.valor.toFixed(2),
                        ]),
                      )
                    }
                  }}
                  className="h-8 text-xs border-[#ECEAE4]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-teal-700" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="h-8 text-xs border-[#ECEAE4]"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Imprimir
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Report Body Rendering */}
          <div className="py-6 space-y-6 text-xs">
            {/* 1. Fluxo de Caixa */}
            {activeReport === 'fluxo_caixa' && (
              <div className="space-y-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: selectedMes,
                          Entradas: filteredMovimentos
                            .filter((m) => m.tipo === 'Entrada')
                            .reduce((acc, m) => acc + (m.valor || 0), 0),
                          Saídas: filteredMovimentos
                            .filter((m) => m.tipo === 'Saida')
                            .reduce((acc, m) => acc + (m.valor || 0), 0),
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEAE4" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                      <Legend />
                      <Bar dataKey="Entradas" fill="#0F766E" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Saídas" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Data</th>
                        <th className="py-2.5 px-4">Descrição</th>
                        <th className="py-2.5 px-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {filteredMovimentos.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2 px-4 font-mono">{formatDate(m.data)}</td>
                          <td className="py-2 px-4 font-medium">{m.descricao}</td>
                          <td
                            className={`py-2 px-4 text-right font-bold tabular-nums ${m.tipo === 'Entrada' ? 'text-teal-700' : 'text-red-600'}`}
                          >
                            {m.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(m.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Contas a Pagar por Fornecedor */}
            {activeReport === 'pagar_fornecedor' && (
              <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Fornecedor</th>
                      <th className="py-2.5 px-4 text-right">Em Aberto</th>
                      <th className="py-2.5 px-4 text-right">Pago</th>
                      <th className="py-2.5 px-4 text-right">Total Títulos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE4]">
                    {pagarPorFornecedor.map((f, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 font-semibold text-gray-900">{f.nome}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-red-600">
                          {formatCurrency(f.aberto)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                          {formatCurrency(f.pago)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900">
                          {formatCurrency(f.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Contas a Receber por Cliente */}
            {activeReport === 'receber_cliente' && (
              <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Cliente</th>
                      <th className="py-2.5 px-4 text-right">Em Aberto</th>
                      <th className="py-2.5 px-4 text-right">Recebido</th>
                      <th className="py-2.5 px-4 text-right">Total Faturado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE4]">
                    {receberPorCliente.map((c, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 font-semibold text-gray-900">{c.nome}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-amber-600">
                          {formatCurrency(c.aberto)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                          {formatCurrency(c.recebido)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900">
                          {formatCurrency(c.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Resultado por Categoria */}
            {activeReport === 'resultado_categoria' && (
              <div className="space-y-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={resultadoPorCategoria.slice(0, 8)}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ECEAE4" />
                      <XAxis type="number" tickFormatter={(v) => `R$${v}`} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="total" fill="#0F766E" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Categoria</th>
                        <th className="py-2.5 px-4">Tipo</th>
                        <th className="py-2.5 px-4 text-right">Total Movimentado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {resultadoPorCategoria.map((cat, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-4 font-semibold text-gray-900">{cat.nome}</td>
                          <td className="py-2.5 px-4 text-gray-500">{cat.tipo}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900">
                            {formatCurrency(cat.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Movimentação por Período */}
            {activeReport === 'movimentacao_periodo' && (
              <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Data</th>
                      <th className="py-2.5 px-4">Descrição</th>
                      <th className="py-2.5 px-4">Origem</th>
                      <th className="py-2.5 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE4]">
                    {filteredMovimentos.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2 px-4 font-mono">{formatDate(m.data)}</td>
                        <td className="py-2 px-4 font-medium text-gray-900">{m.descricao}</td>
                        <td className="py-2 px-4 text-gray-500">{m.origem}</td>
                        <td
                          className={`py-2 px-4 text-right font-bold tabular-nums ${m.tipo === 'Entrada' ? 'text-emerald-700' : 'text-red-600'}`}
                        >
                          {m.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(m.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
