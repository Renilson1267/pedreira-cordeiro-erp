import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Abastecimento, Veiculo, Fornecedor, PlanoConta } from '@/types/erp'
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
  Fuel,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Gauge,
  Clock,
  ArrowRight,
  Receipt,
  FileCheck2,
  Calendar,
} from 'lucide-react'

export default function Abastecimentos() {
  const { currentEmpresa, canEdit } = useCompany()

  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedVeiculoFilter, setSelectedVeiculoFilter] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [veiculoId, setVeiculoId] = useState('')
  const [dataAbast, setDataAbast] = useState(() => new Date().toISOString().slice(0, 10))
  const [combustivel, setCombustivel] = useState<
    'Diesel S10' | 'Diesel S500' | 'Gasolina' | 'Etanol' | 'Arla 32'
  >('Diesel S10')
  const [litros, setLitros] = useState<number>(0)
  const [precoLitro, setPrecoLitro] = useState<number>(5.89)
  const [medidor, setMedidor] = useState<number>(0)
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [motoristaOperador, setMotoristaOperador] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [gerarFinanceiro, setGerarFinanceiro] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('abastecimentos', () => loadData())
  useRealtime('veiculos', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [abList, veList, forList, plList] = await Promise.all([
        pb.collection('abastecimentos').getFullList<Abastecimento>({
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

      setAbastecimentos(abList)
      setVeiculos(veList)
      setFornecedores(forList)
      setPlanoContas(plList)
    } catch (err) {
      console.error('Error fetching abastecimentos data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Selected veiculo helper
  const currentVeiculo = useMemo(() => {
    return veiculos.find((v) => v.id === veiculoId)
  }, [veiculos, veiculoId])

  // Ultimo abastecimento do veiculo para calcular medidor anterior
  const ultimoAbastecimentoVeiculo = useMemo(() => {
    if (!veiculoId) return null
    return abastecimentos.find((a) => a.veiculo_id === veiculoId)
  }, [abastecimentos, veiculoId])

  const medidorAnterior = useMemo(() => {
    if (ultimoAbastecimentoVeiculo) {
      return ultimoAbastecimentoVeiculo.medidor
    }
    if (currentVeiculo) {
      return currentVeiculo.medidor_atual
    }
    return 0
  }, [ultimoAbastecimentoVeiculo, currentVeiculo])

  // Computed totals & consumo
  const valorTotal = useMemo(() => {
    return Number((litros * precoLitro).toFixed(2))
  }, [litros, precoLitro])

  const distanciaOuHoras = useMemo(() => {
    if (medidor && medidor > medidorAnterior) {
      return Number((medidor - medidorAnterior).toFixed(1))
    }
    return 0
  }, [medidor, medidorAnterior])

  const consumoMedio = useMemo(() => {
    if (litros > 0 && distanciaOuHoras > 0) {
      if (currentVeiculo?.tipo_medidor === 'km') {
        // km / l
        return Number((distanciaOuHoras / litros).toFixed(2))
      } else {
        // Horas: litros por hora (l/h)
        return Number((litros / distanciaOuHoras).toFixed(2))
      }
    }
    return 0
  }, [litros, distanciaOuHoras, currentVeiculo])

  const custoPorUnidade = useMemo(() => {
    if (distanciaOuHoras > 0 && valorTotal > 0) {
      return Number((valorTotal / distanciaOuHoras).toFixed(2))
    }
    return 0
  }, [distanciaOuHoras, valorTotal])

  const openCreateModal = () => {
    const firstVeic = veiculos[0]
    setVeiculoId(firstVeic ? firstVeic.id : '')
    setDataAbast(new Date().toISOString().slice(0, 10))
    setCombustivel((firstVeic?.combustivel_padrao as any) || 'Diesel S10')
    setLitros(100)
    setPrecoLitro(5.89)
    setMedidor(firstVeic ? firstVeic.medidor_atual + 50 : 0)
    // Se existir fornecedor de diesel sugerir
    const posto = fornecedores.find(
      (f) => f.nome.toLowerCase().includes('posto') || f.nome.toLowerCase().includes('combustivel'),
    )
    setFornecedorId(posto ? posto.id : fornecedores[0]?.id || '')
    setMotoristaOperador('')
    setObservacoes('')
    setGerarFinanceiro(true)
    setIsDrawerOpen(true)
  }

  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const v = veiculos.find((item) => item.id === vid)
    if (v) {
      if (v.combustivel_padrao) {
        setCombustivel(v.combustivel_padrao as any)
      }
      setMedidor(v.medidor_atual + (v.tipo_medidor === 'km' ? 100 : 10))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veiculoId) {
      toast({ title: 'Selecione um veículo ou máquina', variant: 'destructive' })
      return
    }
    if (litros <= 0 || precoLitro <= 0) {
      toast({ title: 'Informe uma quantidade de litros e preço válidos', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const v = currentVeiculo!

      let contaPagarId: string | null = null

      // 1. Gerar Conta a Pagar se solicitado
      if (gerarFinanceiro) {
        const catComb =
          planoContas.find((pc) => pc.codigo === '2.2') ||
          planoContas.find((pc) => pc.nome.toLowerCase().includes('combust')) ||
          null

        const payloadConta = {
          empresa_id: currentEmpresa!.id,
          fornecedor_id: fornecedorId || null,
          descricao: `Abastecimento ${v.codigo_interno} (${v.modelo}) - ${litros}L ${combustivel}`,
          categoria_id: catComb?.id || null,
          valor: valorTotal,
          vencimento: new Date(dataAbast).toISOString(),
          parcelas: 1,
          status: 'Aberta',
          observacoes: `Gerado automaticamente pelo Módulo de Frotas. Motorista: ${motoristaOperador || 'Não informado'}`,
        }

        const cp = await pb.collection('contas_pagar').create(payloadConta)
        contaPagarId = cp.id
      }

      // 2. Registrar Abastecimento
      const payloadAbast = {
        empresa_id: currentEmpresa!.id,
        veiculo_id: veiculoId,
        data: new Date(dataAbast).toISOString(),
        combustivel,
        litros: Number(litros),
        preco_litro: Number(precoLitro),
        valor_total: valorTotal,
        medidor: Number(medidor),
        medidor_anterior: medidorAnterior || null,
        distancia_percorrida: distanciaOuHoras || null,
        consumo_medio: consumoMedio || null,
        custo_por_unidade: custoPorUnidade || null,
        fornecedor_id: fornecedorId || null,
        conta_pagar_id: contaPagarId,
        motorista_operador: motoristaOperador.trim() || null,
        observacoes: observacoes.trim() || null,
      }

      await pb.collection('abastecimentos').create(payloadAbast)

      // 3. Atualizar o medidor atual do veículo se for maior
      if (medidor > v.medidor_atual) {
        await pb.collection('veiculos').update(v.id, {
          medidor_atual: Number(medidor),
        })
      }

      toast({
        title: 'Abastecimento registrado com sucesso!',
        description: gerarFinanceiro ? 'Conta a pagar gerada no módulo financeiro.' : undefined,
      })

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar abastecimento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (a: Abastecimento) => {
    if (!confirm('Deseja realmente remover este registro de abastecimento?')) return
    try {
      await pb.collection('abastecimentos').delete(a.id)
      toast({ title: 'Abastecimento excluído com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredAbastecimentos = useMemo(() => {
    return abastecimentos.filter((a) => {
      if (selectedVeiculoFilter !== 'todos' && a.veiculo_id !== selectedVeiculoFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cod = a.expand?.veiculo_id?.codigo_interno?.toLowerCase() || ''
        const mod = a.expand?.veiculo_id?.modelo?.toLowerCase() || ''
        const mot = a.motorista_operador?.toLowerCase() || ''
        return cod.includes(q) || mod.includes(q) || mot.includes(q)
      }
      return true
    })
  }, [abastecimentos, selectedVeiculoFilter, searchQuery])

  // Totais do mês
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth()

  const abastMesAtual = abastecimentos.filter((a) => {
    const d = new Date(a.data)
    return d.getFullYear() === curY && d.getMonth() === curM
  })

  const totalLitrosMes = abastMesAtual.reduce((acc, a) => acc + (a.litros || 0), 0)
  const totalCustoMes = abastMesAtual.reduce((acc, a) => acc + (a.valor_total || 0), 0)
  const precoMedioLitro = totalLitrosMes > 0 ? totalCustoMes / totalLitrosMes : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Controle de Abastecimentos & Combustível
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Diesel & Lubrificantes
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Apuração de consumo (km/l e l/h), custos por quilômetro/hora e integração financeira
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Abastecimento
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Volume no Mês</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalLitrosMes.toLocaleString('pt-BR')}{' '}
            <span className="text-xs font-normal text-gray-500">Litros</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Consumo total da pedreira no mês</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Custo Total de Combustível
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2 font-mono tabular-nums">
            {formatCurrency(totalCustoMes)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Integrado com Contas a Pagar</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Preço Médio / Litro
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono tabular-nums">
            {formatCurrency(precoMedioLitro)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Média ponderada do período</p>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedVeiculoFilter} onValueChange={setSelectedVeiculoFilter}>
              <SelectTrigger className="w-[240px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Filtrar por Máquina/Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Veículos & Máquinas</SelectItem>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.codigo_interno} • {v.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVeiculoFilter !== 'todos' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedVeiculoFilter('todos')}
                className="h-9 text-xs text-gray-500"
              >
                Limpar filtro
              </Button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar por operador, veículo..."
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
                <th className="py-3 px-4">Combustível</th>
                <th className="py-3 px-4 text-right">Litros</th>
                <th className="py-3 px-4 text-right">Preço/L</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-right">Odômetro/Horímetro</th>
                <th className="py-3 px-4 text-right">Consumo Médio</th>
                <th className="py-3 px-4 text-right">Custo / Un.</th>
                <th className="py-3 px-4">Motorista/Operador</th>
                <th className="py-3 px-4 text-center">Financeiro</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredAbastecimentos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    Nenhum abastecimento encontrado.
                  </td>
                </tr>
              ) : (
                filteredAbastecimentos.map((a) => {
                  const veic = a.expand?.veiculo_id
                  const isKm = veic?.tipo_medidor === 'km'
                  const temConta = !!a.conta_pagar_id

                  return (
                    <tr key={a.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(a.data)}
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
                        <Badge variant="outline" className="text-[10px]">
                          {a.combustivel}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                        {a.litros.toFixed(1)} L
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500 tabular-nums">
                        {formatCurrency(a.preco_litro)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                        {formatCurrency(a.valor_total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="font-semibold text-gray-900">
                          {Number(a.medidor).toLocaleString('pt-BR')}
                        </span>{' '}
                        <span className="text-[10px] text-gray-400">{isKm ? 'km' : 'h'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {a.consumo_medio ? (
                          <span className="font-mono font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded">
                            {a.consumo_medio.toFixed(2)} {isKm ? 'km/l' : 'l/h'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {a.custo_por_unidade ? (
                          <span className="font-mono text-gray-700 font-medium">
                            {formatCurrency(a.custo_por_unidade)}/{isKm ? 'km' : 'h'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{a.motorista_operador || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {temConta ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            ✓ A Pagar
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Manual</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(a)}
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
        <SheetContent className="sm:max-w-[540px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Registrar Abastecimento
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Veículo / Máquina de Pedreira *
              </Label>
              <Select value={veiculoId} onValueChange={handleVeiculoChange}>
                <SelectTrigger className="mt-1 font-medium">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.codigo_interno} • {v.modelo} (
                      {v.tipo_medidor === 'km' ? 'Km' : 'Horímetro'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Data do Abastecimento *
                </Label>
                <Input
                  type="date"
                  required
                  value={dataAbast}
                  onChange={(e) => setDataAbast(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Combustível *</Label>
                <Select value={combustivel} onValueChange={(v: any) => setCombustivel(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Diesel S10">Diesel S10 (Pedreira)</SelectItem>
                    <SelectItem value="Diesel S500">Diesel S500</SelectItem>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Etanol">Etanol</SelectItem>
                    <SelectItem value="Arla 32">Arla 32</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Litros *</Label>
                <Input
                  type="number"
                  step="0.1"
                  required
                  value={litros || ''}
                  onChange={(e) => setLitros(parseFloat(e.target.value) || 0)}
                  placeholder="0.0"
                  className="mt-1 font-mono font-bold bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Preço / Litro (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={precoLitro || ''}
                  onChange={(e) => setPrecoLitro(parseFloat(e.target.value) || 0)}
                  placeholder="5.89"
                  className="mt-1 font-mono bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Total (R$)</Label>
                <div className="mt-1 h-9 px-3 flex items-center bg-white rounded-md border border-[#ECEAE4] font-mono font-bold text-red-600">
                  {formatCurrency(valorTotal)}
                </div>
              </div>
            </div>

            {/* Medidor e Cálculo Automático */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-950">
                <span className="flex items-center gap-1.5">
                  {currentVeiculo?.tipo_medidor === 'km' ? (
                    <Gauge className="w-4 h-4 text-amber-700" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-700" />
                  )}
                  {currentVeiculo?.tipo_medidor === 'km'
                    ? 'Odômetro no Momento (Km) *'
                    : 'Horímetro no Momento (Horas) *'}
                </span>
                <span className="text-[11px] text-amber-800 font-normal">
                  Anterior: <strong>{Number(medidorAnterior).toLocaleString('pt-BR')}</strong>
                </span>
              </div>

              <Input
                type="number"
                step="0.1"
                required
                value={medidor || ''}
                onChange={(e) => setMedidor(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 84320"
                className="bg-white font-mono font-bold text-gray-900"
              />

              {distanciaOuHoras > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">Diferença:</span>
                    <strong className="text-gray-900 font-mono">
                      +{distanciaOuHoras} {currentVeiculo?.tipo_medidor === 'km' ? 'km' : 'h'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Consumo Médio:</span>
                    <strong className="text-teal-800 font-mono">
                      {consumoMedio} {currentVeiculo?.tipo_medidor === 'km' ? 'km/l' : 'l/h'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Custo Unitário:</span>
                    <strong className="text-red-700 font-mono">
                      {formatCurrency(custoPorUnidade)}/
                      {currentVeiculo?.tipo_medidor === 'km' ? 'km' : 'h'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Fornecedor / Posto</Label>
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
                <Label className="text-xs font-semibold text-gray-700">Motorista / Operador</Label>
                <Input
                  value={motoristaOperador}
                  onChange={(e) => setMotoristaOperador(e.target.value)}
                  placeholder="Ex: Sebastião (Tião)"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Checkbox Integração Financeiro */}
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-start space-x-3">
              <input
                type="checkbox"
                id="gerarFinanceiro"
                checked={gerarFinanceiro}
                onChange={(e) => setGerarFinanceiro(e.target.checked)}
                className="mt-1 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
              />
              <label htmlFor="gerarFinanceiro" className="cursor-pointer text-xs">
                <span className="font-semibold text-teal-900 block">
                  Gerar Conta a Pagar automaticamente no Financeiro
                </span>
                <span className="text-teal-700 text-[11px] block mt-0.5">
                  Lança o valor total de {formatCurrency(valorTotal)} na categoria "Combustíveis -
                  Frota" vinculada ao fornecedor selecionado.
                </span>
              </label>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Ponto de abastecimento móvel (comboio) na frente de lavra"
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
                {isSubmitting ? 'Salvando...' : 'Confirmar Abastecimento'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
