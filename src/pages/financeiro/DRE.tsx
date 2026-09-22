import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { MovimentoFinanceiro, PlanoConta, CentroCusto } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react'

export default function DRE() {
  const { currentEmpresa } = useCompany()

  const [selectedMes, setSelectedMes] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [movimentosAtual, setMovimentosAtual] = useState<MovimentoFinanceiro[]>([])
  const [movimentosAnterior, setMovimentosAnterior] = useState<MovimentoFinanceiro[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [selectedCentroCusto, setSelectedCentroCusto] = useState<string>('todos')
  const [visaoQuebraCentro, setVisaoQuebraCentro] = useState(false)
  const [loading, setLoading] = useState(false)

  // Drilldown Drawer
  const [drilldownTitle, setDrilldownTitle] = useState<string | null>(null)
  const [drilldownMovs, setDrilldownMovs] = useState<MovimentoFinanceiro[]>([])

  useRealtime('movimentos_financeiros', () => loadDREData())

  const loadDREData = async () => {
    if (!currentEmpresa || !selectedMes) return

    try {
      setLoading(true)
      const [year, month] = selectedMes.split('-').map(Number)

      // Current Period
      const startCurrent = new Date(Date.UTC(year, month - 1, 1)).toISOString()
      const endCurrent = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString()

      // Previous Period (previous month)
      const prevDate = new Date(year, month - 2, 1)
      const prevYear = prevDate.getFullYear()
      const prevMonth = prevDate.getMonth() + 1
      const startPrev = new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toISOString()
      const endPrev = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59)).toISOString()

      const [resCurrent, resPrev, ccList] = await Promise.all([
        pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
          filter: `empresa_id = '${currentEmpresa.id}' && data >= '${startCurrent}' && data <= '${endCurrent}'`,
          expand: 'categoria_id,centro_custo_id',
          sort: '-data',
        }),
        pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
          filter: `empresa_id = '${currentEmpresa.id}' && data >= '${startPrev}' && data <= '${endPrev}'`,
          expand: 'categoria_id,centro_custo_id',
          sort: '-data',
        }),
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
      ])

      setMovimentosAtual(resCurrent)
      setMovimentosAnterior(resPrev)
      setCentrosCusto(ccList)
    } catch (err) {
      console.error('Error loading DRE:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDREData()
  }, [currentEmpresa, selectedMes])

  // Aggregate structure for a list of movements
  const calculateSections = (movs: MovimentoFinanceiro[]) => {
    let receitaBruta = 0
    let deducoes = 0
    let custos = 0
    let despesasOp = 0
    let resultadoFin = 0

    const listReceita: MovimentoFinanceiro[] = []
    const listDeducoes: MovimentoFinanceiro[] = []
    const listCustos: MovimentoFinanceiro[] = []
    const listDespesasOp: MovimentoFinanceiro[] = []
    const listFin: MovimentoFinanceiro[] = []

    movs.forEach((m) => {
      const tipoCat = m.expand?.categoria_id?.tipo
      const nomeCat = m.expand?.categoria_id?.nome?.toLowerCase() || ''
      const codCat = m.expand?.categoria_id?.codigo || ''
      const val = m.valor || 0

      if (m.tipo === 'Entrada') {
        receitaBruta += val
        listReceita.push(m)
      } else {
        // Saidas categorization
        if (
          nomeCat.includes('imposto') ||
          nomeCat.includes('dedução') ||
          codCat.startsWith('1.9')
        ) {
          deducoes += val
          listDeducoes.push(m)
        } else if (tipoCat === 'Custo' || codCat.startsWith('2')) {
          custos += val
          listCustos.push(m)
        } else if (
          nomeCat.includes('financeira') ||
          nomeCat.includes('juros') ||
          codCat.includes('3.4')
        ) {
          resultadoFin -= val
          listFin.push(m)
        } else {
          // Despesas Operacionais em geral
          despesasOp += val
          listDespesasOp.push(m)
        }
      }
    })

    const receitaLiquida = receitaBruta - deducoes
    const lucroBruto = receitaLiquida - custos
    const resultadoOperacional = lucroBruto - despesasOp
    const resultadoLiquido = resultadoOperacional + resultadoFin

    return {
      receitaBruta,
      deducoes,
      receitaLiquida,
      custos,
      lucroBruto,
      despesasOp,
      resultadoOperacional,
      resultadoFin,
      resultadoLiquido,
      lists: {
        receitaBruta: listReceita,
        deducoes: listDeducoes,
        custos: listCustos,
        despesasOp: listDespesasOp,
        resultadoFin: listFin,
      },
    }
  }

  // Aplicar filtro de centro de custo se selecionado
  const movsAtualFiltrados = useMemo(() => {
    if (selectedCentroCusto === 'todos') return movimentosAtual
    return movimentosAtual.filter((m) => m.centro_custo_id === selectedCentroCusto)
  }, [movimentosAtual, selectedCentroCusto])

  const movsAnteriorFiltrados = useMemo(() => {
    if (selectedCentroCusto === 'todos') return movimentosAnterior
    return movimentosAnterior.filter((m) => m.centro_custo_id === selectedCentroCusto)
  }, [movimentosAnterior, selectedCentroCusto])

  const dreAtual = useMemo(() => calculateSections(movsAtualFiltrados), [movsAtualFiltrados])
  const dreAnterior = useMemo(
    () => calculateSections(movsAnteriorFiltrados),
    [movsAnteriorFiltrados],
  )

  // Quebra por centro de custo no período atual
  const quebraPorCentro = useMemo(() => {
    return centrosCusto.map((cc) => {
      const movsCentro = movimentosAtual.filter((m) => m.centro_custo_id === cc.id)
      const sec = calculateSections(movsCentro)
      return {
        centro: cc,
        receitaLiquida: sec.receitaLiquida,
        custos: sec.custos,
        despesasOp: sec.despesasOp,
        resultadoOperacional: sec.resultadoOperacional,
        resultadoLiquido: sec.resultadoLiquido,
        qtdMovs: movsCentro.length,
      }
    })
  }, [centrosCusto, movimentosAtual])

  const calcVariation = (current: number, prev: number) => {
    if (prev === 0) return current === 0 ? '0%' : '+100%'
    const pct = ((current - prev) / Math.abs(prev)) * 100
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const dreLines = [
    {
      label: 'Receita Operacional Bruta',
      current: dreAtual.receitaBruta,
      prev: dreAnterior.receitaBruta,
      isSubtotal: false,
      isPositiveImpact: true,
      list: dreAtual.lists.receitaBruta,
    },
    {
      label: '(-) Deduções da Receita e Impostos',
      current: -dreAtual.deducoes,
      prev: -dreAnterior.deducoes,
      isSubtotal: false,
      isPositiveImpact: false,
      list: dreAtual.lists.deducoes,
    },
    {
      label: '(=) Receita Operacional Líquida',
      current: dreAtual.receitaLiquida,
      prev: dreAnterior.receitaLiquida,
      isSubtotal: true,
      highlight: false,
    },
    {
      label: '(-) Custos de Mercadorias e Serviços (CPV/CSP)',
      current: -dreAtual.custos,
      prev: -dreAnterior.custos,
      isSubtotal: false,
      isPositiveImpact: false,
      list: dreAtual.lists.custos,
    },
    {
      label: '(=) Lucro Bruto',
      current: dreAtual.lucroBruto,
      prev: dreAnterior.lucroBruto,
      isSubtotal: true,
      highlight: false,
    },
    {
      label: '(-) Despesas Operacionais e Administrativas',
      current: -dreAtual.despesasOp,
      prev: -dreAnterior.despesasOp,
      isSubtotal: false,
      isPositiveImpact: false,
      list: dreAtual.lists.despesasOp,
    },
    {
      label: '(=) Resultado Operacional (EBITDA)',
      current: dreAtual.resultadoOperacional,
      prev: dreAnterior.resultadoOperacional,
      isSubtotal: true,
      highlight: false,
    },
    {
      label: '(+/-) Resultado Financeiro Líquido',
      current: dreAtual.resultadoFin,
      prev: dreAnterior.resultadoFin,
      isSubtotal: false,
      isPositiveImpact: dreAtual.resultadoFin >= 0,
      list: dreAtual.lists.resultadoFin,
    },
    {
      label: '(=) RESULTADO LÍQUIDO DO PERÍODO',
      current: dreAtual.resultadoLiquido,
      prev: dreAnterior.resultadoLiquido,
      isSubtotal: true,
      highlight: true,
    },
  ]

  const handleExportCSV = () => {
    let csv = 'Estrutura DRE;Periodo Atual;Periodo Anterior;Variacao %\r\n'
    dreLines.forEach((l) => {
      csv += `"${l.label}";"${l.current.toFixed(2)}";"${l.prev.toFixed(2)}";"${calcVariation(l.current, l.prev)}"\r\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `DRE_${currentEmpresa?.nome_fantasia}_${selectedMes}.csv`
    link.click()
    toast({ title: 'Exportação CSV gerada com sucesso!' })
  }

  const handleExportPDF = () => {
    window.print()
  }

  const openDrilldown = (line: (typeof dreLines)[0]) => {
    if (line.list && line.list.length > 0) {
      setDrilldownTitle(line.label)
      setDrilldownMovs(line.list)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            DRE — Demonstrativo de Resultado
          </h1>
          <p className="text-xs text-gray-500">
            Relatório contábil gerencial de receitas, custos e apuração de lucro líquido
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-[#ECEAE4] hover:bg-[#FAF9F7] text-gray-700 text-xs rounded-xl shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-teal-700" />
            Exportar CSV
          </Button>
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="border-[#ECEAE4] hover:bg-[#FAF9F7] text-gray-700 text-xs rounded-xl shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Period Selector Card */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Calendar className="w-4 h-4 text-teal-700" />
            <div>
              <div className="text-xs font-semibold text-gray-700">Seletor de Período</div>
              <div className="text-[11px] text-gray-400">
                Comparação automática com o mês imediatamente anterior
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Filtro Centro de Custo */}
            <div className="w-full sm:w-56">
              <select
                value={selectedCentroCusto}
                onChange={(e) => setSelectedCentroCusto(e.target.value)}
                className="w-full h-9 rounded-xl bg-[#FAF9F7] border border-[#ECEAE4] text-xs px-2.5 text-gray-700 font-medium"
              >
                <option value="todos">Todos os Centros de Custo</option>
                {centrosCusto.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-44">
              <Input
                type="month"
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="bg-[#FAF9F7] border-[#ECEAE4] font-mono text-xs h-9"
              ></Input>
            </div>

            <Button
              size="sm"
              variant={visaoQuebraCentro ? 'default' : 'outline'}
              onClick={() => setVisaoQuebraCentro(!visaoQuebraCentro)}
              className={`h-9 text-xs rounded-xl shadow-xs ${
                visaoQuebraCentro
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'border-[#ECEAE4] text-gray-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Quebra p/ Centro de Custo
            </Button>
          </div>
        </div>
      </Card>

      {/* Visão Quebra por Centro de Custo */}
      {visaoQuebraCentro && (
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
          <CardHeader className="bg-[#FAF9F7] border-b border-[#ECEAE4] py-3.5 px-6">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-700" />
              Visão Gerencial por Centro de Custo ({selectedMes})
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Centro de Custo</th>
                  <th className="py-3 px-4 text-right">Rec. Líquida</th>
                  <th className="py-3 px-4 text-right">(-) Custos</th>
                  <th className="py-3 px-4 text-right">(-) Despesas</th>
                  <th className="py-3 px-4 text-right">EBITDA Operacional</th>
                  <th className="py-3 px-6 text-right">Resultado Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE4]">
                {quebraPorCentro.map((item) => (
                  <tr key={item.centro.id} className="hover:bg-teal-50/20">
                    <td className="py-3.5 px-6 font-semibold text-gray-900 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.centro.cor || '#0F766E' }}
                      />
                      <span>
                        <strong className="font-mono text-teal-800">{item.centro.codigo}</strong> —{' '}
                        {item.centro.nome}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold tabular-nums">
                      {formatCurrency(item.receitaLiquida)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-600 tabular-nums">
                      {formatCurrency(item.custos)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                      {formatCurrency(item.despesasOp)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                      <span
                        className={
                          item.resultadoOperacional >= 0 ? 'text-teal-700' : 'text-red-600'
                        }
                      >
                        {formatCurrency(item.resultadoOperacional)}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold tabular-nums">
                      <span
                        className={item.resultadoLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}
                      >
                        {formatCurrency(item.resultadoLiquido)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DRE Structured Report Table */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-6">Estrutura de Contas</th>
                <th className="py-3 px-6 text-right">Período Atual ({selectedMes})</th>
                <th className="py-3 px-6 text-right">Período Anterior</th>
                <th className="py-3 px-6 text-right">Variação %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {dreLines.map((line, idx) => {
                const isClickable = !!line.list && line.list.length > 0
                const isFinal = line.highlight

                let rowStyle = 'hover:bg-teal-50/20'
                if (line.isSubtotal) rowStyle = 'bg-[#FAF9F7]/60 font-semibold'
                if (isFinal) {
                  rowStyle =
                    line.current >= 0 ? 'bg-emerald-50/70 font-bold' : 'bg-red-50/70 font-bold'
                }

                return (
                  <tr
                    key={idx}
                    onClick={() => isClickable && openDrilldown(line)}
                    className={`${rowStyle} transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-teal-50/50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center space-x-2">
                        {isClickable && (
                          <ChevronRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        )}
                        <span
                          className={`${
                            isFinal
                              ? line.current >= 0
                                ? 'text-emerald-900 text-sm'
                                : 'text-red-900 text-sm'
                              : line.isSubtotal
                                ? 'text-gray-900'
                                : 'text-gray-600'
                          }`}
                        >
                          {line.label}
                        </span>
                        {isClickable && (
                          <span className="text-[10px] text-teal-700 font-normal underline ml-1">
                            ({line.list?.length} movs)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-6 text-right tabular-nums">
                      <span
                        className={`font-semibold ${
                          isFinal
                            ? line.current >= 0
                              ? 'text-emerald-700 text-base'
                              : 'text-red-700 text-base'
                            : line.current < 0
                              ? 'text-red-600'
                              : 'text-gray-900'
                        }`}
                      >
                        {formatCurrency(line.current)}
                      </span>
                    </td>

                    <td className="py-3.5 px-6 text-right tabular-nums text-gray-500">
                      {formatCurrency(line.prev)}
                    </td>

                    <td className="py-3.5 px-6 text-right tabular-nums">
                      <span
                        className={`text-xs font-semibold ${
                          line.current >= line.prev ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {calcVariation(line.current, line.prev)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drilldown Drawer */}
      <Sheet open={!!drilldownTitle} onOpenChange={(open) => !open && setDrilldownTitle(null)}>
        <SheetContent className="sm:max-w-[500px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-gray-900">
              Composição de: {drilldownTitle}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-3 text-xs">
            <p className="text-gray-500">
              Movimentações financeiras que compõem este saldo no período selecionado:
            </p>

            <div className="divide-y divide-[#ECEAE4]">
              {drilldownMovs.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{m.descricao}</div>
                    <div className="text-[11px] text-gray-400">
                      Data: {formatDate(m.data)} • Origem: {m.origem}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-bold tabular-nums ${
                        m.tipo === 'Entrada' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(m.valor)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
