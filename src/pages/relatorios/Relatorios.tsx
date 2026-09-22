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
  CentroCusto,
  Veiculo,
  Abastecimento,
  Manutencao,
} from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Truck,
  Fuel,
  Wrench,
  Construction,
  Filter,
  X,
  User,
  Users,
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
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros específicos por relatório
  // 1. Frotas: Equipamento e Centro de Custo
  const [frotasVeiculoFilter, setFrotasVeiculoFilter] = useState<string>('todos')
  const [frotasCentroCustoFilter, setFrotasCentroCustoFilter] = useState<string>('todos')

  // 2. Contas a Pagar: Fornecedor
  const [pagarFornecedorFilter, setPagarFornecedorFilter] = useState<string>('todos')

  // 3. Contas a Receber: Cliente
  const [receberClienteFilter, setReceberClienteFilter] = useState<string>('todos')

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [m, cp, cr, f, c, pc, cc, v, ab, mn] = await Promise.all([
        pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'categoria_id,centro_custo_id',
          sort: '-data',
        }),
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'fornecedor_id,categoria_id,centro_custo_id',
        }),
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'cliente_id,categoria_id,centro_custo_id',
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
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        pb.collection('veiculos').getFullList<Veiculo>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo_interno',
        }),
        pb.collection('abastecimentos').getFullList<Abastecimento>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'veiculo_id',
          sort: '-data',
        }),
        pb.collection('manutencoes').getFullList<Manutencao>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'veiculo_id',
          sort: '-data',
        }),
      ])

      setMovimentos(m)
      setContasPagar(cp)
      setContasReceber(cr)
      setFornecedores(f)
      setClientes(c)
      setPlanoContas(pc)
      setCentrosCusto(cc)
      setVeiculos(v)
      setAbastecimentos(ab)
      setManutencoes(mn)
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
      description: 'Demonstrativo visual das despesas e receitas por plano de contas.',
      icon: BarChart2,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      id: 'resultado_centros_custos',
      title: 'Relatório de Centros de Custo',
      description:
        'Apurado por frente operacional (Extração, Transporte, Manutenção, Administrativo) com totalização de receitas e despesas.',
      icon: Layers,
      color: 'bg-teal-50 text-teal-800',
    },
    {
      id: 'movimentacao_periodo',
      title: 'Movimentação por Período (Ledger)',
      description: 'Livro caixa integral com filtros, conciliações, data a data para auditoria.',
      icon: BookOpen,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      id: 'relatorio_frotas',
      title: 'Relatório Operacional de Frotas',
      description:
        'Custo por equipamento na pedreira, combustível vs manutenção, consumo médio e horas/km.',
      icon: Construction,
      color: 'bg-orange-50 text-orange-700',
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

  // Lista de fornecedores presentes em Contas a Pagar (com ID ou nome para filtro)
  const fornecedoresOpcoes = useMemo(() => {
    const map = new Map<string, string>()
    // Do cadastro de fornecedores
    fornecedores.forEach((f) => {
      if (f.id && f.nome) map.set(f.id, f.nome)
    })
    // E de eventuais contas que possam ter expand
    contasPagar.forEach((cp) => {
      if (cp.fornecedor_id && cp.expand?.fornecedor_id?.nome) {
        map.set(cp.fornecedor_id, cp.expand.fornecedor_id.nome)
      } else if (!cp.fornecedor_id) {
        map.set('sem_fornecedor', 'Diversos / Sem Fornecedor')
      }
    })
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [fornecedores, contasPagar])

  // Aggregation for pagar_fornecedor (respeitando filtro de fornecedor)
  const pagarPorFornecedor = useMemo(() => {
    const map: Record<
      string,
      { id: string; nome: string; aberto: number; pago: number; total: number; qtd: number }
    > = {}

    const contasFiltradas = contasPagar.filter((cp) => {
      if (pagarFornecedorFilter === 'todos') return true
      if (pagarFornecedorFilter === 'sem_fornecedor') return !cp.fornecedor_id
      return cp.fornecedor_id === pagarFornecedorFilter
    })

    contasFiltradas.forEach((cp) => {
      const fornecedorId = cp.fornecedor_id || 'sem_fornecedor'
      const nome = cp.expand?.fornecedor_id?.nome || 'Diversos / Sem Fornecedor'
      if (!map[fornecedorId]) {
        map[fornecedorId] = { id: fornecedorId, nome, aberto: 0, pago: 0, total: 0, qtd: 0 }
      }
      map[fornecedorId].qtd += 1
      if (cp.status === 'Paga') {
        map[fornecedorId].pago += cp.valor || 0
      } else {
        map[fornecedorId].aberto += cp.valor || 0
      }
      map[fornecedorId].total += cp.valor || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [contasPagar, pagarFornecedorFilter])

  // Totais consolidados de Contas a Pagar filtradas
  const totaisPagar = useMemo(() => {
    return pagarPorFornecedor.reduce(
      (acc, item) => ({
        aberto: acc.aberto + item.aberto,
        pago: acc.pago + item.pago,
        total: acc.total + item.total,
        qtd: acc.qtd + item.qtd,
      }),
      { aberto: 0, pago: 0, total: 0, qtd: 0 },
    )
  }, [pagarPorFornecedor])

  // Lista de clientes presentes em Contas a Receber (com ID ou nome para filtro)
  const clientesOpcoes = useMemo(() => {
    const map = new Map<string, string>()
    // Do cadastro de clientes
    clientes.forEach((c) => {
      if (c.id && c.nome) map.set(c.id, c.nome)
    })
    // E de contas a receber com cliente vinculado
    contasReceber.forEach((cr) => {
      if (cr.cliente_id && cr.expand?.cliente_id?.nome) {
        map.set(cr.cliente_id, cr.expand.cliente_id.nome)
      } else if (!cr.cliente_id) {
        map.set('sem_cliente', 'Consumidor / Sem Cliente')
      }
    })
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [clientes, contasReceber])

  // Aggregation for receber_cliente (respeitando filtro de cliente)
  const receberPorCliente = useMemo(() => {
    const map: Record<
      string,
      { id: string; nome: string; aberto: number; recebido: number; total: number; qtd: number }
    > = {}

    const contasFiltradas = contasReceber.filter((cr) => {
      if (receberClienteFilter === 'todos') return true
      if (receberClienteFilter === 'sem_cliente') return !cr.cliente_id
      return cr.cliente_id === receberClienteFilter
    })

    contasFiltradas.forEach((cr) => {
      const clienteId = cr.cliente_id || 'sem_cliente'
      const nome = cr.expand?.cliente_id?.nome || 'Consumidor / Sem Cliente'
      if (!map[clienteId]) {
        map[clienteId] = { id: clienteId, nome, aberto: 0, recebido: 0, total: 0, qtd: 0 }
      }
      map[clienteId].qtd += 1
      if (cr.status === 'Recebida') {
        map[clienteId].recebido += cr.valor || 0
      } else {
        map[clienteId].aberto += cr.valor || 0
      }
      map[clienteId].total += cr.valor || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [contasReceber, receberClienteFilter])

  // Totais consolidados de Contas a Receber filtradas
  const totaisReceber = useMemo(() => {
    return receberPorCliente.reduce(
      (acc, item) => ({
        aberto: acc.aberto + item.aberto,
        recebido: acc.recebido + item.recebido,
        total: acc.total + item.total,
        qtd: acc.qtd + item.qtd,
      }),
      { aberto: 0, recebido: 0, total: 0, qtd: 0 },
    )
  }, [receberPorCliente])

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

  // Aggregation for resultado_centros_custos
  const resultadoPorCentrosCusto = useMemo(() => {
    return centrosCusto
      .map((cc) => {
        const movsCentro = filteredMovimentos.filter((m) => m.centro_custo_id === cc.id)
        const entradas = movsCentro
          .filter((m) => m.tipo === 'Entrada')
          .reduce((sum, m) => sum + (m.valor || 0), 0)
        const saidas = movsCentro
          .filter((m) => m.tipo === 'Saida')
          .reduce((sum, m) => sum + (m.valor || 0), 0)
        const saldo = entradas - saidas

        return {
          centro: cc,
          entradas,
          saidas,
          saldo,
          qtd: movsCentro.length,
        }
      })
      .sort((a, b) => b.saidas - a.saidas)
  }, [centrosCusto, filteredMovimentos])

  // Mapa de correspondência ou vínculo entre Veículo e Centro de Custo
  // Critério: se veiculos tiver campo centro_custo_id, usamos; caso contrário mapeamos por setor da pedreira ou nome do centro de custo
  const veiculoPertenceAoCentroCusto = (v: Veiculo, centroId: string): boolean => {
    if (!centroId || centroId === 'todos') return true

    // Caso o veículo tenha centro_custo_id direto
    const vAny = v as any
    if (vAny.centro_custo_id) {
      return vAny.centro_custo_id === centroId
    }

    // Mapeamento semântico pelo setor da pedreira cadastrado no veículo vs código/nome do centro de custo
    const centro = centrosCusto.find((cc) => cc.id === centroId)
    if (!centro) return false

    const ccNome = (centro.nome || '').toLowerCase()
    const ccCod = (centro.codigo || '').toLowerCase()
    const vSetor = (v.setor || '').toLowerCase()

    // 1. Extração / Britagem
    if (ccNome.includes('extra') || ccNome.includes('brita') || ccCod.includes('01')) {
      if (
        vSetor.includes('britagem') ||
        vSetor.includes('extra') ||
        vSetor.includes('lokotrack') ||
        v.tipo === 'britador' ||
        v.tipo === 'peneira' ||
        v.tipo === 'escavadeira' ||
        v.tipo === 'perfuratriz'
      ) {
        return true
      }
    }

    // 2. Transporte / Frota / Entrega
    if (ccNome.includes('transp') || ccNome.includes('frota') || ccCod.includes('02')) {
      if (
        vSetor.includes('entrega') ||
        vSetor.includes('transporte') ||
        v.tipo === 'caminhao' ||
        v.tipo === 'pipa'
      ) {
        return true
      }
    }

    // 3. Manutenção / Equipamentos / Oficina
    if (ccNome.includes('manuten') || ccNome.includes('oficina') || ccCod.includes('03')) {
      if (vSetor.includes('manuten') || vSetor.includes('oficina') || v.status === 'manutencao') {
        return true
      }
    }

    // 4. Administrativo / Comercial / Supervisão
    if (ccNome.includes('admin') || ccNome.includes('comerc') || ccCod.includes('04')) {
      if (
        vSetor.includes('admin') ||
        vSetor.includes('engenharia') ||
        vSetor.includes('supervis') ||
        v.tipo === 'carro_passeio' ||
        v.tipo === 'moto'
      ) {
        return true
      }
    }

    // 5. Concreto / Geral
    if (ccNome.includes('concreto') || vSetor.includes('concreto')) {
      if (
        vSetor.includes('concreto') ||
        v.tipo === 'betoneira' ||
        v.tipo === 'bomba' ||
        v.tipo === 'central_concreto'
      ) {
        return true
      }
    }

    // Operações gerais ou outros
    if (ccNome.includes('geral') || ccNome.includes('apoio') || ccCod.includes('05')) {
      return !v.setor || v.setor === 'Geral' || v.tipo === 'outro'
    }

    return false
  }

  // Aggregation for relatorio_frotas com filtros de Equipamento e Centro de Custo
  const frotasPorVeiculo = useMemo(() => {
    if (!selectedMes) return []
    const [year, month] = selectedMes.split('-')

    // Filtrar abastecimentos e manutenções do mês
    const abMes = abastecimentos.filter((a) => {
      const d = new Date(a.data)
      return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month)
    })
    const manMes = manutencoes.filter((m) => {
      const d = new Date(m.data)
      return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month)
    })

    // Aplicar filtros de Equipamento e Centro de Custo
    const veiculosFiltrados = veiculos.filter((v) => {
      if (frotasVeiculoFilter !== 'todos' && v.id !== frotasVeiculoFilter) {
        return false
      }
      if (
        frotasCentroCustoFilter !== 'todos' &&
        !veiculoPertenceAoCentroCusto(v, frotasCentroCustoFilter)
      ) {
        return false
      }
      return true
    })

    return veiculosFiltrados
      .map((v) => {
        const vAb = abMes.filter((a) => a.veiculo_id === v.id)
        const vMan = manMes.filter((m) => m.veiculo_id === v.id)

        const litrosTotal = vAb.reduce((acc, a) => acc + (a.litros || 0), 0)
        const custoCombustivel = vAb.reduce((acc, a) => acc + (a.valor_total || 0), 0)
        const custoManutencao = vMan.reduce((acc, m) => acc + (m.custo || 0), 0)
        const custoTotal = custoCombustivel + custoManutencao

        // Consumo médio ponderado dos registros com consumo
        const abComConsumo = vAb.filter((a) => a.consumo_medio && a.consumo_medio > 0)
        const mediaConsumo =
          abComConsumo.length > 0
            ? abComConsumo.reduce((acc, a) => acc + (a.consumo_medio || 0), 0) / abComConsumo.length
            : 0

        return {
          veiculo: v,
          litrosTotal,
          custoCombustivel,
          custoManutencao,
          custoTotal,
          mediaConsumo,
          qtdAbastecimentos: vAb.length,
          qtdManutencoes: vMan.length,
        }
      })
      .sort((a, b) => b.custoTotal - a.custoTotal)
  }, [
    veiculos,
    abastecimentos,
    manutencoes,
    selectedMes,
    frotasVeiculoFilter,
    frotasCentroCustoFilter,
    centrosCusto,
  ])

  // Totais consolidados de Frotas
  const totaisFrotas = useMemo(() => {
    return frotasPorVeiculo.reduce(
      (acc, item) => ({
        litros: acc.litros + item.litrosTotal,
        combustivel: acc.combustivel + item.custoCombustivel,
        manutencao: acc.manutencao + item.custoManutencao,
        total: acc.total + item.custoTotal,
        qtdVeiculos: acc.qtdVeiculos + 1,
      }),
      { litros: 0, combustivel: 0, manutencao: 0, total: 0, qtdVeiculos: 0 },
    )
  }, [frotasPorVeiculo])

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
                      const suffix = pagarFornecedorFilter !== 'todos' ? `_Filtrado` : ''
                      exportCSV(
                        `Pagar_Fornecedor_${selectedMes}${suffix}`,
                        [
                          'Fornecedor',
                          'Qtd Títulos',
                          'Em Aberto (R$)',
                          'Pago (R$)',
                          'Total Títulos (R$)',
                        ],
                        pagarPorFornecedor.map((f) => [
                          f.nome,
                          String(f.qtd),
                          f.aberto.toFixed(2),
                          f.pago.toFixed(2),
                          f.total.toFixed(2),
                        ]),
                      )
                    } else if (activeReport === 'receber_cliente') {
                      const suffix = receberClienteFilter !== 'todos' ? `_Filtrado` : ''
                      exportCSV(
                        `Receber_Cliente_${selectedMes}${suffix}`,
                        [
                          'Cliente',
                          'Qtd Títulos',
                          'Em Aberto (R$)',
                          'Recebido (R$)',
                          'Total Faturado (R$)',
                        ],
                        receberPorCliente.map((c) => [
                          c.nome,
                          String(c.qtd),
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
                    } else if (activeReport === 'resultado_centros_custos') {
                      exportCSV(
                        `Centros_Custo_${selectedMes}`,
                        ['Código', 'Centro de Custo', 'Receitas', 'Despesas', 'Saldo'],
                        resultadoPorCentrosCusto.map((item) => [
                          item.centro.codigo,
                          item.centro.nome,
                          item.entradas.toFixed(2),
                          item.saidas.toFixed(2),
                          item.saldo.toFixed(2),
                        ]),
                      )
                    } else if (activeReport === 'relatorio_frotas') {
                      const suffix =
                        frotasVeiculoFilter !== 'todos' || frotasCentroCustoFilter !== 'todos'
                          ? '_Filtrado'
                          : ''
                      exportCSV(
                        `Frotas_Pedreira_${selectedMes}${suffix}`,
                        [
                          'Código',
                          'Modelo',
                          'Tipo',
                          'Setor',
                          'Medidor Atual',
                          'Litros Abastecidos',
                          'Custo Combustível (R$)',
                          'Custo Manutenção (R$)',
                          'Custo Total (R$)',
                          'Consumo Médio',
                        ],
                        frotasPorVeiculo.map((item) => [
                          item.veiculo.codigo_interno,
                          item.veiculo.modelo,
                          item.veiculo.tipo,
                          item.veiculo.setor || 'Geral',
                          `${item.veiculo.medidor_atual} ${item.veiculo.tipo_medidor}`,
                          item.litrosTotal.toFixed(1),
                          item.custoCombustivel.toFixed(2),
                          item.custoManutencao.toFixed(2),
                          item.custoTotal.toFixed(2),
                          item.mediaConsumo > 0
                            ? `${item.mediaConsumo.toFixed(2)} ${item.veiculo.tipo_medidor === 'km' ? 'km/l' : 'l/h'}`
                            : '—',
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
              <div className="space-y-4">
                {/* Barra de Filtro por Fornecedor */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                      <Filter className="w-3.5 h-3.5 text-teal-700" />
                      <span>Filtrar por Fornecedor:</span>
                    </div>
                    <Select value={pagarFornecedorFilter} onValueChange={setPagarFornecedorFilter}>
                      <SelectTrigger className="w-[260px] bg-white border-[#ECEAE4] text-xs h-8">
                        <SelectValue placeholder="Selecione o Fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Fornecedores</SelectItem>
                        {fornecedoresOpcoes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {pagarFornecedorFilter !== 'todos' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPagarFornecedorFilter('todos')}
                        className="h-8 text-xs text-gray-500 hover:text-gray-900"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-800 font-mono">
                      {pagarPorFornecedor.length}
                    </span>{' '}
                    parceiro(s) listado(s)
                  </div>
                </div>

                {/* Cards com Totais Consolidados */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-red-50/60 rounded-xl border border-red-200">
                    <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">
                      Total em Aberto
                    </span>
                    <div className="text-lg font-bold text-red-700 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisPagar.aberto)}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                      Total Pago
                    </span>
                    <div className="text-lg font-bold text-emerald-800 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisPagar.pago)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                      Total de Títulos ({totaisPagar.qtd})
                    </span>
                    <div className="text-lg font-bold text-gray-900 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisPagar.total)}
                    </div>
                  </div>
                </div>

                {/* Tabela de Fornecedores */}
                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Fornecedor</th>
                        <th className="py-2.5 px-4 text-center">Títulos</th>
                        <th className="py-2.5 px-4 text-right">Em Aberto</th>
                        <th className="py-2.5 px-4 text-right">Pago</th>
                        <th className="py-2.5 px-4 text-right">Total Títulos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {pagarPorFornecedor.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">
                            Nenhum título encontrado para o fornecedor selecionado.
                          </td>
                        </tr>
                      ) : (
                        pagarPorFornecedor.map((f, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-semibold text-gray-900">
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{f.nome}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono text-gray-600">
                              {f.qtd}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-red-600 font-mono">
                              {formatCurrency(f.aberto)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700 font-mono">
                              {formatCurrency(f.pago)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900 font-mono">
                              {formatCurrency(f.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {pagarPorFornecedor.length > 0 && (
                      <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold">
                        <tr>
                          <td className="py-2.5 px-4 text-gray-900">TOTAL GERAL</td>
                          <td className="py-2.5 px-4 text-center font-mono text-gray-900">
                            {totaisPagar.qtd}
                          </td>
                          <td className="py-2.5 px-4 text-right text-red-600 font-mono tabular-nums">
                            {formatCurrency(totaisPagar.aberto)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 font-mono tabular-nums">
                            {formatCurrency(totaisPagar.pago)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-900 font-mono tabular-nums">
                            {formatCurrency(totaisPagar.total)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* 3. Contas a Receber por Cliente */}
            {activeReport === 'receber_cliente' && (
              <div className="space-y-4">
                {/* Barra de Filtro por Cliente */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                      <Filter className="w-3.5 h-3.5 text-teal-700" />
                      <span>Filtrar por Cliente:</span>
                    </div>
                    <Select value={receberClienteFilter} onValueChange={setReceberClienteFilter}>
                      <SelectTrigger className="w-[260px] bg-white border-[#ECEAE4] text-xs h-8">
                        <SelectValue placeholder="Selecione o Cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Clientes</SelectItem>
                        {clientesOpcoes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {receberClienteFilter !== 'todos' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReceberClienteFilter('todos')}
                        className="h-8 text-xs text-gray-500 hover:text-gray-900"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-800 font-mono">
                      {receberPorCliente.length}
                    </span>{' '}
                    cliente(s) listado(s)
                  </div>
                </div>

                {/* Cards com Totais Consolidados */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                    <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                      Total a Receber (Em Aberto)
                    </span>
                    <div className="text-lg font-bold text-amber-800 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisReceber.aberto)}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                      Total Recebido
                    </span>
                    <div className="text-lg font-bold text-emerald-800 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisReceber.recebido)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                      Total Faturado ({totaisReceber.qtd})
                    </span>
                    <div className="text-lg font-bold text-gray-900 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisReceber.total)}
                    </div>
                  </div>
                </div>

                {/* Tabela de Clientes */}
                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Cliente</th>
                        <th className="py-2.5 px-4 text-center">Títulos</th>
                        <th className="py-2.5 px-4 text-right">Em Aberto</th>
                        <th className="py-2.5 px-4 text-right">Recebido</th>
                        <th className="py-2.5 px-4 text-right">Total Faturado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {receberPorCliente.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">
                            Nenhum título encontrado para o cliente selecionado.
                          </td>
                        </tr>
                      ) : (
                        receberPorCliente.map((c, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-semibold text-gray-900">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{c.nome}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono text-gray-600">
                              {c.qtd}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-amber-600 font-mono">
                              {formatCurrency(c.aberto)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700 font-mono">
                              {formatCurrency(c.recebido)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900 font-mono">
                              {formatCurrency(c.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {receberPorCliente.length > 0 && (
                      <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold">
                        <tr>
                          <td className="py-2.5 px-4 text-gray-900">TOTAL GERAL</td>
                          <td className="py-2.5 px-4 text-center font-mono text-gray-900">
                            {totaisReceber.qtd}
                          </td>
                          <td className="py-2.5 px-4 text-right text-amber-600 font-mono tabular-nums">
                            {formatCurrency(totaisReceber.aberto)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 font-mono tabular-nums">
                            {formatCurrency(totaisReceber.recebido)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-900 font-mono tabular-nums">
                            {formatCurrency(totaisReceber.total)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Relatório de Centros de Custo */}
            {activeReport === 'resultado_centros_custos' && (
              <div className="space-y-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={resultadoPorCentrosCusto.map((item) => ({
                        nome: item.centro.codigo,
                        Receitas: item.entradas,
                        Despesas: item.saidas,
                      }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEAE4" />
                      <XAxis dataKey="nome" />
                      <YAxis tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                      <Legend />
                      <Bar dataKey="Receitas" fill="#0F766E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Centro de Custo</th>
                        <th className="py-2.5 px-4 text-right">Receitas</th>
                        <th className="py-2.5 px-4 text-right">Despesas</th>
                        <th className="py-2.5 px-4 text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {resultadoPorCentrosCusto.map((item) => (
                        <tr key={item.centro.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-4 font-semibold text-gray-900 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.centro.cor || '#0F766E' }}
                            />
                            <span className="font-mono text-teal-800">{item.centro.codigo}</span>
                            <span>•</span>
                            <span>{item.centro.nome}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-mono text-emerald-700">
                            {formatCurrency(item.entradas)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-mono text-red-600">
                            {formatCurrency(item.saidas)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-mono font-bold">
                            <span className={item.saldo >= 0 ? 'text-teal-700' : 'text-red-600'}>
                              {formatCurrency(item.saldo)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

            {/* 6. Relatório Operacional de Frotas */}
            {activeReport === 'relatorio_frotas' && (
              <div className="space-y-5">
                {/* Controles de Filtro: Equipamento e Centro de Custo */}
                <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                        <Filter className="w-3.5 h-3.5 text-teal-700" />
                        <span>Filtros do Relatório:</span>
                      </div>

                      {/* Dropdown Equipamento */}
                      <div className="flex items-center gap-1">
                        <Select value={frotasVeiculoFilter} onValueChange={setFrotasVeiculoFilter}>
                          <SelectTrigger className="w-[220px] bg-white border-[#ECEAE4] text-xs h-8 font-medium">
                            <SelectValue placeholder="Selecione Equipamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os Equipamentos</SelectItem>
                            {veiculos.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.codigo_interno} • {v.modelo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Dropdown Centro de Custo */}
                      <div className="flex items-center gap-1">
                        <Select
                          value={frotasCentroCustoFilter}
                          onValueChange={setFrotasCentroCustoFilter}
                        >
                          <SelectTrigger className="w-[220px] bg-white border-[#ECEAE4] text-xs h-8 font-medium">
                            <SelectValue placeholder="Centro de Custo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os Centros de Custo</SelectItem>
                            {centrosCusto.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.codigo} • {cc.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {(frotasVeiculoFilter !== 'todos' || frotasCentroCustoFilter !== 'todos') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFrotasVeiculoFilter('todos')
                            setFrotasCentroCustoFilter('todos')
                          }}
                          className="h-8 text-xs text-gray-500 hover:text-gray-900"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Limpar Filtros
                        </Button>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-gray-500 font-mono">
                      {frotasPorVeiculo.length} equipamento(s) selecionado(s)
                    </div>
                  </div>
                </div>

                {/* Cards com Totais Consolidados de Frota */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-[#ECEAE4] shadow-xs">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Volume Combustível
                    </span>
                    <div className="text-lg font-bold text-gray-900 font-mono tabular-nums mt-0.5">
                      {totaisFrotas.litros.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      <span className="text-xs font-normal text-gray-500">L</span>
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200 shadow-xs">
                    <span className="text-[10px] font-semibold text-teal-800 uppercase tracking-wider">
                      Custo Combustível
                    </span>
                    <div className="text-lg font-bold text-teal-800 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisFrotas.combustivel)}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 shadow-xs">
                    <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                      Custo Manutenção
                    </span>
                    <div className="text-lg font-bold text-amber-800 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisFrotas.manutencao)}
                    </div>
                  </div>

                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 shadow-xs">
                    <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">
                      Custo Total Frota
                    </span>
                    <div className="text-lg font-bold text-red-700 font-mono tabular-nums mt-0.5">
                      {formatCurrency(totaisFrotas.total)}
                    </div>
                  </div>
                </div>

                {/* Gráfico Comparativo Combustível vs Manutenção (apenas se houver itens) */}
                {frotasPorVeiculo.length > 0 && (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={frotasPorVeiculo.slice(0, 15).map((item) => ({
                          nome: item.veiculo.codigo_interno,
                          Combustível: item.custoCombustivel,
                          Manutenção: item.custoManutencao,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEAE4" />
                        <XAxis dataKey="nome" />
                        <YAxis tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                        <Legend />
                        <Bar dataKey="Combustível" fill="#0F766E" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Manutenção" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="border border-[#ECEAE4] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Equipamento</th>
                        <th className="py-2.5 px-4">Setor / Área</th>
                        <th className="py-2.5 px-4 text-right">Litros</th>
                        <th className="py-2.5 px-4 text-right">Combustível</th>
                        <th className="py-2.5 px-4 text-right">Manutenção</th>
                        <th className="py-2.5 px-4 text-right">Custo Total</th>
                        <th className="py-2.5 px-4 text-right">Consumo Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE4]">
                      {frotasPorVeiculo.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400">
                            Nenhum equipamento encontrado para a combinação de filtros selecionada.
                          </td>
                        </tr>
                      ) : (
                        frotasPorVeiculo.map((item) => {
                          const isKm = item.veiculo.tipo_medidor === 'km'
                          return (
                            <tr key={item.veiculo.id} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                  <span className="font-mono text-teal-800">
                                    {item.veiculo.codigo_interno}
                                  </span>
                                  <span>•</span>
                                  <span className="text-gray-700">{item.veiculo.modelo}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono">
                                  {Number(item.veiculo.medidor_atual).toLocaleString('pt-BR')}{' '}
                                  {isKm ? 'km' : 'horas'}
                                  {item.veiculo.placa && ` • ${item.veiculo.placa}`}
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-gray-600">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal border-[#ECEAE4] bg-[#FAF9F7]"
                                >
                                  {item.veiculo.setor || 'Geral'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-gray-700">
                                {item.litrosTotal > 0 ? `${item.litrosTotal.toFixed(1)} L` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-teal-800 tabular-nums">
                                {formatCurrency(item.custoCombustivel)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                                {formatCurrency(item.custoManutencao)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                                {formatCurrency(item.custoTotal)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono">
                                {item.mediaConsumo > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold">
                                    {item.mediaConsumo.toFixed(2)} {isKm ? 'km/l' : 'l/h'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    {frotasPorVeiculo.length > 0 && (
                      <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold">
                        <tr>
                          <td className="py-2.5 px-4 text-gray-900" colSpan={2}>
                            TOTAL GERAL ({totaisFrotas.qtdVeiculos} equipamentos)
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-900 tabular-nums">
                            {totaisFrotas.litros.toFixed(1)} L
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-teal-800 tabular-nums">
                            {formatCurrency(totaisFrotas.combustivel)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                            {formatCurrency(totaisFrotas.manutencao)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-red-600 tabular-nums">
                            {formatCurrency(totaisFrotas.total)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-400">—</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
