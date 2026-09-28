import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Printer,
  Building,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Empresa, CentroCusto, ContaPagar } from '@/types/erp'

export interface FechamentoMensalCentroCustoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmpresa: Empresa | null
  usuarioNome?: string
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

interface TopFornecedor {
  nome: string
  valor: number
}

export interface ItemFechamentoCentroCusto {
  id: string
  codigo: string
  nome: string
  cor?: string
  totalAberto: number
  totalPago: number
  totalVencido: number
  totalGeral: number
  percentual: number
  qtdTitulos: number
  topFornecedores: TopFornecedor[]
  totalMesAnterior: number
  variacaoPercentual: number | null
}

export function FechamentoMensalCentroCustoModal({
  open,
  onOpenChange,
  currentEmpresa,
  usuarioNome,
}: FechamentoMensalCentroCustoModalProps) {
  const agora = new Date()
  const [mes, setMes] = useState<number>(agora.getMonth() + 1)
  const [ano, setAno] = useState<number>(agora.getFullYear())
  const [empresaFiltroId, setEmpresaFiltroId] = useState<string>('')
  const [centroCustoFiltroId, setCentroCustoFiltroId] = useState<string>('todos')

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [contasMesAtual, setContasMesAtual] = useState<ContaPagar[]>([])
  const [contasMesAnterior, setContasMesAnterior] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(false)

  // Sincronizar empresa selecionada padrao
  useEffect(() => {
    if (currentEmpresa && !empresaFiltroId) {
      setEmpresaFiltroId(currentEmpresa.id)
    }
  }, [currentEmpresa, empresaFiltroId])

  // Carregar lista de empresas disponiveis
  useEffect(() => {
    if (!open) return
    const carregarEmpresas = async () => {
      try {
        const emps = await pb.collection('empresas').getFullList<Empresa>({ sort: 'nome_fantasia' })
        setEmpresas(emps)
      } catch (err) {
        console.warn('Erro ao carregar empresas para filtro:', err)
      }
    }
    carregarEmpresas()
  }, [open])

  // Obter intervalo de competencia (ano, mes)
  const getIntervaloMes = (targetAno: number, targetMes: number) => {
    const mStr = String(targetMes).padStart(2, '0')
    const inicioStr = `${targetAno}-${mStr}-01 00:00:00.000Z`
    const ultimoDia = new Date(targetAno, targetMes, 0).getDate()
    const fimStr = `${targetAno}-${mStr}-${String(ultimoDia).padStart(2, '0')} 23:59:59.999Z`
    return { inicioStr, fimStr }
  }

  // Carregar dados de contas a pagar e centros de custos
  const carregarDados = useCallback(async () => {
    if (!open) return
    const targetEmpresaId = empresaFiltroId || currentEmpresa?.id
    if (!targetEmpresaId) return

    try {
      setLoading(true)

      // 1. Centros de Custo da empresa
      const ccList = await pb.collection('centros_custos').getFullList<CentroCusto>({
        filter: `empresa_id = '${targetEmpresaId}'`,
        sort: 'codigo',
      })
      setCentrosCusto(ccList)

      // 2. Contas a Pagar do Mes Selecionado (vencimento)
      const { inicioStr: iniAtual, fimStr: fimAtual } = getIntervaloMes(ano, mes)
      const filterMesAtual = `empresa_id = '${targetEmpresaId}' && vencimento >= '${iniAtual}' && vencimento <= '${fimAtual}'`

      const contasAtual = await pb.collection('contas_pagar').getFullList<ContaPagar>({
        filter: filterMesAtual,
        expand: 'fornecedor_id,centro_custo_id',
        sort: 'vencimento',
      })
      setContasMesAtual(contasAtual)

      // 3. Contas a Pagar do Mes Anterior (para comparativo)
      let anoAnt = ano
      let mesAnt = mes - 1
      if (mesAnt === 0) {
        mesAnt = 12
        anoAnt = ano - 1
      }
      const { inicioStr: iniAnt, fimStr: fimAnt } = getIntervaloMes(anoAnt, mesAnt)
      const filterMesAnt = `empresa_id = '${targetEmpresaId}' && vencimento >= '${iniAnt}' && vencimento <= '${fimAnt}'`

      const contasAnt = await pb.collection('contas_pagar').getFullList<ContaPagar>({
        filter: filterMesAnt,
        expand: 'centro_custo_id',
      })
      setContasMesAnterior(contasAnt)
    } catch (err) {
      console.error('Erro ao carregar fechamento mensal por centro de custo:', err)
    } finally {
      setLoading(false)
    }
  }, [open, empresaFiltroId, currentEmpresa, ano, mes])

  useEffect(() => {
    if (open) {
      carregarDados()
    }
  }, [open, carregarDados])

  // Logica exata de ContasPagar.tsx para valores
  const getValorPagoEfetivo = (c: ContaPagar) => {
    if (c.status === 'Paga') {
      return c.valor_pago && c.valor_pago > 0 ? Number(c.valor_pago) : Number(c.valor || 0)
    }
    return Number(c.valor_pago || 0)
  }

  const getSaldoRestante = (c: ContaPagar) => {
    if (c.status === 'Paga') return 0
    const jaPago = getValorPagoEfetivo(c)
    return Math.max(0, Number(c.valor || 0) - jaPago)
  }

  const nowISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Agrupar dados por centro de custo
  const dadosAgrupados = useMemo(() => {
    const mapaCentros = new Map<string, CentroCusto>()
    centrosCusto.forEach((cc) => {
      mapaCentros.set(cc.id, cc)
    })

    interface Acumulador {
      id: string
      codigo: string
      nome: string
      cor?: string
      totalAberto: number
      totalPago: number
      totalVencido: number
      totalGeral: number
      qtdTitulos: number
      fornecedoresMap: Map<string, number>
      totalMesAnterior: number
    }

    const mapAcum = new Map<string, Acumulador>()

    const getOuCriar = (ccId: string | null | undefined): Acumulador => {
      const chave = ccId && mapaCentros.has(ccId) ? ccId : 'sem_centro'
      if (!mapAcum.has(chave)) {
        if (chave === 'sem_centro') {
          mapAcum.set(chave, {
            id: 'sem_centro',
            codigo: 'S/C',
            nome: 'Não Alocado / Geral',
            cor: '#64748B',
            totalAberto: 0,
            totalPago: 0,
            totalVencido: 0,
            totalGeral: 0,
            qtdTitulos: 0,
            fornecedoresMap: new Map(),
            totalMesAnterior: 0,
          })
        } else {
          const cc = mapaCentros.get(chave)!
          mapAcum.set(chave, {
            id: cc.id,
            codigo: cc.codigo || '—',
            nome: cc.nome || 'Centro Sem Nome',
            cor: cc.cor || '#0F766E',
            totalAberto: 0,
            totalPago: 0,
            totalVencido: 0,
            totalGeral: 0,
            qtdTitulos: 0,
            fornecedoresMap: new Map(),
            totalMesAnterior: 0,
          })
        }
      }
      return mapAcum.get(chave)!
    }

    centrosCusto.forEach((cc) => {
      getOuCriar(cc.id)
    })

    contasMesAtual.forEach((c) => {
      const acum = getOuCriar(c.centro_custo_id)
      const valTotal = Number(c.valor || 0)
      const valPago = getValorPagoEfetivo(c)
      const saldo = getSaldoRestante(c)

      acum.totalGeral += valTotal
      acum.totalPago += valPago
      acum.qtdTitulos += 1

      if (c.status === 'Paga') {
        // quitada
      } else {
        const isAtrasado = (c.vencimento ? c.vencimento.slice(0, 10) : '') < nowISO
        if (c.status === 'Vencida' || isAtrasado) {
          acum.totalVencido += saldo
        } else {
          acum.totalAberto += saldo
        }
      }

      const nomeForn = c.expand?.fornecedor_id?.nome || c.descricao || 'Diversos / Sem Fornecedor'
      const valorAtualForn = acum.fornecedoresMap.get(nomeForn) || 0
      acum.fornecedoresMap.set(nomeForn, valorAtualForn + valTotal)
    })

    contasMesAnterior.forEach((c) => {
      const acum = getOuCriar(c.centro_custo_id)
      acum.totalMesAnterior += Number(c.valor || 0)
    })

    let somaTotalMesGeral = 0
    mapAcum.forEach((acum) => {
      somaTotalMesGeral += acum.totalGeral
    })

    const resultado: ItemFechamentoCentroCusto[] = []
    mapAcum.forEach((acum) => {
      if (centroCustoFiltroId !== 'todos') {
        if (acum.id !== centroCustoFiltroId) {
          return
        }
      }

      const topFornecedores: TopFornecedor[] = Array.from(acum.fornecedoresMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 3)

      const percentual = somaTotalMesGeral > 0 ? (acum.totalGeral / somaTotalMesGeral) * 100 : 0

      let variacaoPercentual: number | null = null
      if (acum.totalMesAnterior > 0) {
        variacaoPercentual =
          ((acum.totalGeral - acum.totalMesAnterior) / acum.totalMesAnterior) * 100
      } else if (acum.totalGeral > 0 && acum.totalMesAnterior === 0) {
        variacaoPercentual = 100
      } else if (acum.totalGeral === 0 && acum.totalMesAnterior === 0) {
        variacaoPercentual = 0
      }

      resultado.push({
        id: acum.id,
        codigo: acum.codigo,
        nome: acum.nome,
        cor: acum.cor,
        totalAberto: acum.totalAberto,
        totalPago: acum.totalPago,
        totalVencido: acum.totalVencido,
        totalGeral: acum.totalGeral,
        percentual,
        qtdTitulos: acum.qtdTitulos,
        topFornecedores,
        totalMesAnterior: acum.totalMesAnterior,
        variacaoPercentual,
      })
    })

    return resultado.sort((a, b) => {
      if (b.totalGeral !== a.totalGeral) return b.totalGeral - a.totalGeral
      return a.codigo.localeCompare(b.codigo)
    })
  }, [centrosCusto, contasMesAtual, contasMesAnterior, centroCustoFiltroId, nowISO])

  // Totais consolidados
  const totaisGerais = useMemo(() => {
    return dadosAgrupados.reduce(
      (acc, item) => ({
        totalAberto: acc.totalAberto + item.totalAberto,
        totalPago: acc.totalPago + item.totalPago,
        totalVencido: acc.totalVencido + item.totalVencido,
        totalGeral: acc.totalGeral + item.totalGeral,
        qtdTitulos: acc.qtdTitulos + item.qtdTitulos,
        totalMesAnterior: acc.totalMesAnterior + item.totalMesAnterior,
      }),
      {
        totalAberto: 0,
        totalPago: 0,
        totalVencido: 0,
        totalGeral: 0,
        qtdTitulos: 0,
        totalMesAnterior: 0,
      },
    )
  }, [dadosAgrupados])

  // Variacao global
  const variacaoGlobal = useMemo(() => {
    if (totaisGerais.totalMesAnterior > 0) {
      return (
        ((totaisGerais.totalGeral - totaisGerais.totalMesAnterior) /
          totaisGerais.totalMesAnterior) *
        100
      )
    }
    return null
  }, [totaisGerais])

  const empresaAtiva = useMemo(() => {
    if (empresaFiltroId) {
      return empresas.find((e) => e.id === empresaFiltroId) || currentEmpresa
    }
    return currentEmpresa
  }, [empresaFiltroId, empresas, currentEmpresa])

  const mesNome = useMemo(() => {
    return MESES.find((m) => m.value === mes)?.label || ''
  }, [mes])

  const handlePrint = () => {
    window.print()
  }

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear()
    return [atual - 2, atual - 1, atual, atual + 1]
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-documento-impressao="fechamento-centro-custo"
        className="max-w-[96vw] lg:max-w-7xl max-h-[94vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4] print:static print:transform-none print:max-w-full print:p-0 print:border-none print:shadow-none print:bg-white print:overflow-visible print-landscape"
        aria-describedby="fechamento-mensal-desc"
      >
        <DialogHeader className="border-b pb-3 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-700" />
                <span>Fechamento Mensal por Centro de Custo</span>
                <Badge
                  variant="outline"
                  className="bg-teal-50 text-teal-800 border-teal-300 font-mono text-xs"
                >
                  {mesNome} / {ano}
                </Badge>
              </DialogTitle>
              <DialogDescription
                id="fechamento-mensal-desc"
                className="text-xs text-gray-500 mt-0.5"
              >
                Demonstrativo gerencial objetivo de Contas a Pagar por centro de custo para
                prestação de contas à diretoria.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={carregarDados}
                disabled={loading}
                className="h-9 px-3 text-xs border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl"
                title="Recarregar dados"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-teal-700' : ''}`}
                />
                Atualizar
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4 font-semibold"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Relatório (A4 Paisagem)
              </Button>
            </div>
          </div>

          {/* BARRA DE FILTROS NA TELA (no-print) */}
          <div className="mt-3 pt-3 border-t border-[#ECEAE4] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Competência:</span>

              {/* Seletor Mes */}
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="w-[130px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Seletor Ano */}
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[90px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Seletor Empresa */}
              {empresas.length > 1 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-gray-500 text-xs">Empresa:</span>
                  <Select value={empresaFiltroId} onValueChange={(val) => setEmpresaFiltroId(val)}>
                    <SelectTrigger className="w-[200px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg truncate">
                      <SelectValue placeholder="Selecione a Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome_fantasia || e.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Seletor Centro de Custo */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-gray-500 text-xs">Centro:</span>
                <Select
                  value={centroCustoFiltroId}
                  onValueChange={(val) => setCentroCustoFiltroId(val)}
                >
                  <SelectTrigger className="w-[190px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg">
                    <SelectValue placeholder="Todos os centros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Centros</SelectItem>
                    {centrosCusto.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="sem_centro">S/C - Não Alocado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-gray-500 font-mono text-[11px]">
              {totaisGerais.qtdTitulos} títulos a pagar apurados
            </div>
          </div>
        </DialogHeader>

        {/* CARDS RESUMIDOS NA TELA (no-print) */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
          <div className="p-3 rounded-xl bg-white border border-[#ECEAE4] shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 text-[11px] font-semibold uppercase">
              <span>Total Pago</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-700 tabular-nums mt-0.5">
              {formatCurrency(totaisGerais.totalPago)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {totaisGerais.totalGeral > 0
                ? `${((totaisGerais.totalPago / totaisGerais.totalGeral) * 100).toFixed(1)}% do total`
                : '0% do total'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#ECEAE4] shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 text-[11px] font-semibold uppercase">
              <span>Em Aberto</span>
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-base sm:text-lg font-bold text-gray-900 tabular-nums mt-0.5">
              {formatCurrency(totaisGerais.totalAberto)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Saldo vincendo no mês</div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#ECEAE4] shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 text-[11px] font-semibold uppercase">
              <span>Total Vencido</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div className="text-base sm:text-lg font-bold text-red-600 tabular-nums mt-0.5">
              {formatCurrency(totaisGerais.totalVencido)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Pendente de regularização</div>
          </div>

          <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 shadow-2xs">
            <div className="flex items-center justify-between text-teal-900 text-[11px] font-bold uppercase">
              <span>Total do Mês</span>
              <DollarSign className="w-3.5 h-3.5 text-teal-700" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-teal-950 tabular-nums mt-0.5">
              {formatCurrency(totaisGerais.totalGeral)}
            </div>
            <div className="text-[10px] text-teal-800 flex items-center gap-1 mt-0.5 font-medium">
              {variacaoGlobal !== null ? (
                <>
                  {variacaoGlobal > 0 ? (
                    <span className="text-red-700 font-bold flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />+{variacaoGlobal.toFixed(1)}%
                    </span>
                  ) : variacaoGlobal < 0 ? (
                    <span className="text-emerald-700 font-bold flex items-center">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      {variacaoGlobal.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-600 flex items-center">
                      <Minus className="w-3 h-3 mr-0.5" /> 0%
                    </span>
                  )}
                  <span>vs mês anterior</span>
                </>
              ) : (
                <span>Sem histórico anterior</span>
              )}
            </div>
          </div>
        </div>

        {/* AREA OFICIAL DO RELATORIO A4 */}
        <div className="print-only-container mt-1">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-relaxed text-xs print-landscape">
            {/* CABECALHO OFICIAL DO ERP */}
            <div className="border-b-2 border-teal-800 pb-3 mb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-lg print:text-teal-900 print:bg-transparent print:border print:border-teal-900 shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-teal-950 uppercase leading-snug">
                    {empresaAtiva?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'}
                  </h1>
                  <div className="text-[11px] text-gray-700 font-semibold">
                    {empresaAtiva?.razao_social || 'G C DO AMARAL SERTANIA'} • CNPJ:{' '}
                    <span className="font-mono">{empresaAtiva?.cnpj || '05.581.899/0001-05'}</span>
                  </div>
                  <div className="text-[11px] text-gray-600 font-medium mt-0.5 flex items-center gap-2">
                    <span>Relatório Gerencial de Fechamento Mensal de Obrigações</span>
                    <span>•</span>
                    <span className="font-bold text-teal-900">
                      Competência: {mesNome} de {ano}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-2.5 py-1 bg-teal-50 border border-teal-300 text-teal-900 font-bold text-[11px] uppercase tracking-wider rounded">
                  Fechamento por Centro de Custo
                </div>
                <div className="text-[11px] text-gray-600 mt-1">
                  Emissão: <strong>{formatDate(agora.toISOString())}</strong> às{' '}
                  <strong>
                    {agora.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </div>
                {usuarioNome && (
                  <div className="text-[10px] text-gray-500">
                    Emitido por: <strong>{usuarioNome}</strong>
                  </div>
                )}
                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                  Base de data: <strong>Vencimento dos títulos</strong>
                </div>
              </div>
            </div>

            {/* BARRA DE PARAMETROS / FILTROS NO DOCUMENTO */}
            <div className="mb-3 px-3 py-1.5 bg-gray-50 print:bg-gray-100 rounded-lg border border-gray-200 text-[11px] text-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-gray-900">Parâmetros: </span>
                <span>
                  Competência {mesNome}/{ano} • Empresa: {empresaAtiva?.nome_fantasia || 'Todas'} •
                  Centro de Custo:{' '}
                  {centroCustoFiltroId === 'todos'
                    ? 'Todos os Centros de Custo'
                    : centrosCusto.find((c) => c.id === centroCustoFiltroId)?.nome || 'Não Alocado'}
                </span>
              </div>
              <div className="text-gray-500 font-mono text-[10px] shrink-0">
                {totaisGerais.qtdTitulos} títulos • {dadosAgrupados.length} centros listados
              </div>
            </div>

            {/* TABELA PRINCIPAL POR CENTRO DE CUSTO */}
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] border border-gray-300 folha-print-table">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-2 px-2 text-center w-10">Cód.</th>
                    <th className="py-2 px-2.5 min-w-[130px]">Centro de Custo</th>
                    <th className="py-2 px-2 text-center w-12">Qtd</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Em Aberto</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Pago</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Vencido</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Total do Mês</th>
                    <th className="py-2 px-2 text-right w-14">% Part.</th>
                    <th className="py-2 px-2 text-right w-20 whitespace-nowrap">Var. Mês Ant.</th>
                    <th className="py-2 px-2.5 min-w-[210px]">Principais Fornecedores (Top 3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dadosAgrupados.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-400 text-xs">
                        <FileText className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                        Nenhuma conta a pagar encontrada para este período.
                      </td>
                    </tr>
                  ) : (
                    dadosAgrupados.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Codigo */}
                        <td className="py-2 px-2 text-center font-mono font-bold text-gray-700 text-[10px] whitespace-nowrap">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                            style={{
                              backgroundColor: item.cor ? `${item.cor}15` : '#F1F5F9',
                              color: item.cor || '#0F766E',
                              border: `1px solid ${item.cor || '#CBD5E1'}40`,
                            }}
                          >
                            {item.codigo}
                          </span>
                        </td>

                        {/* Nome do Centro de Custo */}
                        <td className="py-2 px-2.5 font-semibold text-gray-900">{item.nome}</td>

                        {/* Quantidade de titulos */}
                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {item.qtdTitulos > 0 ? (
                            item.qtdTitulos
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Em Aberto */}
                        <td className="py-2 px-2.5 text-right font-mono text-gray-800 whitespace-nowrap">
                          {item.totalAberto > 0 ? (
                            formatCurrency(item.totalAberto)
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Pago */}
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-emerald-800 whitespace-nowrap">
                          {item.totalPago > 0 ? (
                            formatCurrency(item.totalPago)
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Vencido */}
                        <td className="py-2 px-2.5 text-right font-mono font-semibold whitespace-nowrap">
                          {item.totalVencido > 0 ? (
                            <span className="text-red-700">
                              {formatCurrency(item.totalVencido)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Total Geral do Mes */}
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-950 whitespace-nowrap bg-gray-50/60 print:bg-transparent">
                          {formatCurrency(item.totalGeral)}
                        </td>

                        {/* % de Participacao */}
                        <td className="py-2 px-2 text-right font-mono text-gray-700 whitespace-nowrap">
                          {item.totalGeral > 0 ? (
                            <span className="font-semibold">{item.percentual.toFixed(1)}%</span>
                          ) : (
                            <span className="text-gray-300">0%</span>
                          )}
                        </td>

                        {/* Variacao em relacao ao mes anterior */}
                        <td className="py-2 px-2 text-right font-mono whitespace-nowrap text-[10px]">
                          {item.variacaoPercentual !== null ? (
                            item.variacaoPercentual > 0 ? (
                              <span className="text-red-700 font-semibold">
                                +{item.variacaoPercentual.toFixed(1)}%
                              </span>
                            ) : item.variacaoPercentual < 0 ? (
                              <span className="text-emerald-700 font-semibold">
                                {item.variacaoPercentual.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-500">0,0%</span>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Top 3 Fornecedores */}
                        <td className="py-2 px-2.5 text-[10px] text-gray-700">
                          {item.topFornecedores.length > 0 ? (
                            <div className="space-y-0.5">
                              {item.topFornecedores.map((tf, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-1 leading-tight"
                                >
                                  <span
                                    className="truncate max-w-[150px] text-gray-800"
                                    title={tf.nome}
                                  >
                                    {idx + 1}. {tf.nome}
                                  </span>
                                  <span className="font-mono text-gray-600 font-medium shrink-0">
                                    {formatCurrency(tf.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300 italic">Sem despesas</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* LINHA DE TOTAL GERAL DESTACADA */}
                <tfoot className="bg-gray-100 print:bg-gray-200 border-t-2 border-gray-400 font-bold text-gray-950">
                  <tr>
                    <td
                      colSpan={2}
                      className="py-2.5 px-2.5 text-left uppercase text-teal-950 font-extrabold text-[11px]"
                    >
                      TOTAL GERAL:
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-gray-900">
                      {totaisGerais.qtdTitulos}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrency(totaisGerais.totalAberto)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                      {formatCurrency(totaisGerais.totalPago)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-red-700 whitespace-nowrap">
                      {formatCurrency(totaisGerais.totalVencido)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-black text-teal-950 text-xs whitespace-nowrap bg-teal-50/60 print:bg-transparent">
                      {formatCurrency(totaisGerais.totalGeral)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                      100,0%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold whitespace-nowrap text-[10px]">
                      {variacaoGlobal !== null ? (
                        variacaoGlobal > 0 ? (
                          <span className="text-red-700">+{variacaoGlobal.toFixed(1)}%</span>
                        ) : variacaoGlobal < 0 ? (
                          <span className="text-emerald-700">{variacaoGlobal.toFixed(1)}%</span>
                        ) : (
                          <span>0,0%</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-[10px] text-gray-600 font-normal">
                      Mês Anterior:{' '}
                      <span className="font-mono font-semibold">
                        {formatCurrency(totaisGerais.totalMesAnterior)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SINTESE EXECUTIVA PARA GERENCIA */}
            <div className="mt-3 p-2.5 bg-gray-50 print:bg-transparent border border-gray-200 rounded-lg text-[10px] text-gray-700 page-break-inside-avoid">
              <div className="font-bold text-gray-900 uppercase tracking-wider mb-1">
                Síntese para Diretoria / Fechamento Mensal
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  • <strong>Liquidação no mês:</strong> {formatCurrency(totaisGerais.totalPago)}{' '}
                  pagos de um total programado de {formatCurrency(totaisGerais.totalGeral)} (
                  {totaisGerais.totalGeral > 0
                    ? ((totaisGerais.totalPago / totaisGerais.totalGeral) * 100).toFixed(1)
                    : 0}
                  % de adimplência).
                </div>
                <div>
                  • <strong>Obrigações Pendentes:</strong>{' '}
                  {formatCurrency(totaisGerais.totalAberto)} a vencer e{' '}
                  {formatCurrency(totaisGerais.totalVencido)} vencidas.
                </div>
                <div>
                  • <strong>Comparativo Mensal:</strong> Total de despesas oscilou em{' '}
                  {variacaoGlobal !== null
                    ? `${variacaoGlobal > 0 ? '+' : ''}${variacaoGlobal.toFixed(1)}%`
                    : '0%'}{' '}
                  frente a {formatCurrency(totaisGerais.totalMesAnterior)} do mês anterior.
                </div>
              </div>
            </div>

            {/* RODAPE DO DOCUMENTO */}
            <div className="pt-3 mt-3 border-t border-gray-200 flex items-center justify-between text-[9px] text-gray-400 page-break-inside-avoid">
              <div>
                {empresaAtiva?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'} •{' '}
                {empresaAtiva?.razao_social || 'G C DO AMARAL SERTANIA'} • CNPJ:{' '}
                {empresaAtiva?.cnpj || '05.581.899/0001-05'}
              </div>
              <div>
                Documento de Fechamento Mensal • Gerado em {formatDate(agora.toISOString())} às{' '}
                {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {usuarioNome ? ` por ${usuarioNome}` : ''}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FechamentoMensalCentroCustoModal
