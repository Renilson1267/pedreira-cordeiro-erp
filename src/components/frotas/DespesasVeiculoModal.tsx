import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type {
  Veiculo,
  DespesaFrota,
  Fornecedor,
  NaturezaDespesaFrota,
  TipoDespesaFrota,
} from '@/types/erp'
import { despesasFrotaService } from '@/services/despesasFrota'
import pb from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
import {
  Receipt,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  DollarSign,
} from 'lucide-react'

interface DespesasVeiculoModalProps {
  veiculo: Veiculo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDespesaAdded?: () => void
}

export const DespesasVeiculoModal: React.FC<DespesasVeiculoModalProps> = ({
  veiculo,
  open,
  onOpenChange,
  onDespesaAdded,
}) => {
  const [despesas, setDespesas] = useState<DespesaFrota[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(false)

  // Form State
  const [showAddForm, setShowAddForm] = useState(false)
  const [natureza, setNatureza] = useState<NaturezaDespesaFrota>('Despesa')
  const [tipo, setTipo] = useState<TipoDespesaFrota>('Manutenção')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState<string>('nenhum')
  const [dataDespesa, setDataDespesa] = useState(() => toInputDate(new Date().toISOString()))
  const [valor, setValor] = useState<number>(0)
  const [status, setStatus] = useState<'Pendente' | 'Pago' | 'Cancelado'>('Pendente')
  const [gerarContaPagar, setGerarContaPagar] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && veiculo) {
      loadDespesas()
    }
  }, [open, veiculo])

  const loadDespesas = async () => {
    if (!veiculo) return
    try {
      setLoading(true)
      const [dList, fList] = await Promise.all([
        despesasFrotaService.listarPorVeiculo(veiculo.empresa_id, veiculo.id),
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${veiculo.empresa_id}'`,
          sort: 'nome',
        }),
      ])
      setDespesas(dList)
      setFornecedores(fList)
    } catch (err) {
      console.error('Erro ao carregar despesas do veículo:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veiculo) return
    if (!descricao.trim()) {
      toast({ title: 'Informe a descrição da despesa ou abatimento', variant: 'destructive' })
      return
    }
    if (valor <= 0) {
      toast({ title: 'Informe um valor maior que zero', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const dataIso = new Date(`${dataDespesa}T12:00:00Z`).toISOString()
      const fornecedorSel =
        fornecedorId !== 'nenhum' ? fornecedores.find((f) => f.id === fornecedorId) : null

      let contaPagarCriadaId: string | null = null

      // Se marcou para gerar Conta a Pagar e for Despesa (não abatimento)
      if (gerarContaPagar && natureza === 'Despesa') {
        const descTitulo = `Frota [${veiculo.codigo_interno}${veiculo.placa ? ' - ' + veiculo.placa : ''}] - ${tipo}: ${descricao}`

        // Buscar categoria de manutenção/combustível
        const categorias = await pb.collection('plano_contas').getFullList({
          filter: `empresa_id = '${veiculo.empresa_id}' && tipo = 'Despesa'`,
        })
        const catFrota =
          categorias.find(
            (c) =>
              c.nome.toLowerCase().includes('frota') ||
              c.nome.toLowerCase().includes('manutenção') ||
              c.nome.toLowerCase().includes('veículo'),
          ) || categorias[0]

        const cp = await pb.collection('contas_pagar').create({
          empresa_id: veiculo.empresa_id,
          fornecedor_id: fornecedorSel ? fornecedorSel.id : null,
          descricao: descTitulo,
          categoria_id: catFrota?.id || null,
          valor: Number(valor),
          vencimento: dataIso,
          parcelas: 1,
          status: status === 'Pago' ? 'Paga' : 'Pendente',
          forma_pagamento: 'Boleto',
          origem_frota: `Frota — ${veiculo.codigo_interno}${veiculo.placa ? ' (' + veiculo.placa + ')' : ''}`,
          veiculo_id: veiculo.id,
          observacoes: `Título gerado pelo módulo Frota para o equipamento ${veiculo.codigo_interno}. ${observacoes}`,
        })
        contaPagarCriadaId = cp.id
      }

      const payload = {
        empresa_id: veiculo.empresa_id,
        veiculo_id: veiculo.id,
        placa_patrimonio: veiculo.placa || veiculo.codigo_interno,
        setor: veiculo.setor || 'Central Britagem',
        natureza,
        tipo,
        descricao: descricao.trim(),
        fornecedor_id: fornecedorSel ? fornecedorSel.id : null,
        fornecedor_nome: fornecedorSel?.nome || null,
        data: dataIso,
        valor: Number(valor),
        status,
        conta_pagar_id: contaPagarCriadaId,
        referencia_origem: `Frota — ${veiculo.codigo_interno}`,
        observacoes: observacoes.trim() || null,
      }

      await despesasFrotaService.criar(payload)

      toast({
        title: natureza === 'Abatimento' ? 'Abatimento registrado!' : 'Despesa vinculada gravada!',
        description: contaPagarCriadaId ? 'Título criado e amarrado em Contas a Pagar.' : undefined,
      })

      // Reset form
      setDescricao('')
      setValor(0)
      setObservacoes('')
      setShowAddForm(false)
      await loadDespesas()
      if (onDespesaAdded) onDespesaAdded()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar despesa',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExcluirDespesa = async (d: DespesaFrota) => {
    if (!confirm('Deseja excluir este lançamento de frota?')) return
    try {
      await despesasFrotaService.remover(d.id)
      toast({ title: 'Lançamento excluído com sucesso.' })
      await loadDespesas()
      if (onDespesaAdded) onDespesaAdded()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir despesa',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Totais do veículo
  const totais = useMemo(() => {
    let totalDespesas = 0
    let totalAbatimentos = 0

    despesas.forEach((d) => {
      if (d.status === 'Cancelado') return
      if (d.natureza === 'Abatimento') {
        totalAbatimentos += d.valor || 0
      } else {
        totalDespesas += d.valor || 0
      }
    })

    const saldoLiquido = totalDespesas - totalAbatimentos
    return { totalDespesas, totalAbatimentos, saldoLiquido }
  }, [despesas])

  if (!veiculo) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-[#ECEAE4] p-6 rounded-2xl">
        <DialogHeader className="pb-3 border-b border-[#ECEAE4]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-700" />
                <span>Despesas & Abatimentos — {veiculo.codigo_interno}</span>
                {veiculo.placa && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs ml-1 border-teal-300 text-teal-800 bg-teal-50"
                  >
                    Placa: {veiculo.placa}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                {veiculo.modelo} • Setor: <strong>{veiculo.setor}</strong> • Consulta individual com
                vínculo a Contas a Pagar
              </DialogDescription>
            </div>

            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {showAddForm ? 'Fechar Formulário' : 'Novo Lançamento'}
            </Button>
          </div>
        </DialogHeader>

        {/* Formulário Retrátil para Adicionar Despesa/Abatimento */}
        {showAddForm && (
          <form
            onSubmit={handleSalvarDespesa}
            className="p-4 bg-teal-50/40 rounded-xl border border-teal-200 space-y-3 text-xs"
          >
            <div className="font-bold text-teal-950 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-teal-700" />
              <span>Novo Lançamento para {veiculo.codigo_interno}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-gray-700 font-medium">Natureza *</Label>
                <Select value={natureza} onValueChange={(n: any) => setNatureza(n)}>
                  <SelectTrigger className="bg-white border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Despesa">Despesa (+)</SelectItem>
                    <SelectItem value="Abatimento">Abatimento / Desconto (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-700 font-medium">Tipo *</Label>
                <Select value={tipo} onValueChange={(t: any) => setTipo(t)}>
                  <SelectTrigger className="bg-white border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manutenção">Manutenção</SelectItem>
                    <SelectItem value="Combustível">Combustível</SelectItem>
                    <SelectItem value="Pneus">Pneus</SelectItem>
                    <SelectItem value="Peças">Peças</SelectItem>
                    <SelectItem value="Seguro">Seguro</SelectItem>
                    <SelectItem value="IPVA / Taxas">IPVA / Taxas</SelectItem>
                    <SelectItem value="Lubrificantes">Lubrificantes</SelectItem>
                    <SelectItem value="Abatimento / Desconto">Abatimento / Desconto</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-700 font-medium">Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                  className="bg-white border-[#ECEAE4] text-xs h-9 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-gray-700 font-medium">Descrição Detalhada *</Label>
                <Input
                  placeholder="Ex: Troca de filtros e óleo hidráulico 68"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="bg-white border-[#ECEAE4] text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-gray-700 font-medium">Fornecedor / Oficina</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger className="bg-white border-[#ECEAE4] text-xs h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    <SelectItem value="nenhum">Nenhum / Não informado</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <Label className="text-gray-700 font-medium">Data do Registro *</Label>
                <Input
                  type="date"
                  value={dataDespesa}
                  onChange={(e) => setDataDespesa(e.target.value)}
                  className="bg-white border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div>
                <Label className="text-gray-700 font-medium">Status de Pagamento</Label>
                <Select value={status} onValueChange={(s: any) => setStatus(s)}>
                  <SelectTrigger className="bg-white border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {natureza === 'Despesa' && (
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="gerarContaPagarCheck"
                    checked={gerarContaPagar}
                    onChange={(e) => setGerarContaPagar(e.target.checked)}
                    className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                  />
                  <label
                    htmlFor="gerarContaPagarCheck"
                    className="text-xs text-gray-800 font-medium cursor-pointer"
                  >
                    Gerar título em <strong>Contas a Pagar</strong>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
              </Button>
            </div>
          </form>
        )}

        {/* Cards de Totais da Placa/Equipamento */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl">
            <span className="text-[10px] text-red-700 font-semibold uppercase block">
              Total de Despesas
            </span>
            <div className="text-lg font-bold text-red-900 font-mono mt-0.5 tabular-nums">
              {formatCurrency(totais.totalDespesas)}
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-[10px] text-emerald-700 font-semibold uppercase block">
              Total de Abatimentos
            </span>
            <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5 tabular-nums">
              {formatCurrency(totais.totalAbatimentos)}
            </div>
          </div>

          <div className="p-3 bg-teal-50 border border-teal-300 rounded-xl">
            <span className="text-[10px] text-teal-800 font-semibold uppercase block">
              Custo Líquido do Equipamento
            </span>
            <div className="text-lg font-extrabold text-teal-950 font-mono mt-0.5 tabular-nums">
              {formatCurrency(totais.saldoLiquido)}
            </div>
          </div>
        </div>

        {/* Lista de Lançamentos */}
        <div className="border border-[#ECEAE4] rounded-xl overflow-hidden mt-2">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Natureza</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Descrição</th>
                <th className="py-2.5 px-3">Fornecedor</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Contas a Pagar</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Carregando lançamentos...
                  </td>
                </tr>
              ) : despesas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Nenhuma despesa ou abatimento registrado para este equipamento ainda.
                  </td>
                </tr>
              ) : (
                despesas.map((d) => {
                  const isAbatimento = d.natureza === 'Abatimento'
                  const fornec = d.fornecedor_nome || d.expand?.fornecedor_id?.nome || '—'

                  return (
                    <tr key={d.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {formatDate(d.data)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-semibold ${
                            isAbatimento
                              ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                              : 'border-red-300 text-red-800 bg-red-50'
                          }`}
                        >
                          {d.natureza}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-700">{d.tipo}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[200px] truncate">
                        {d.descricao}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-[140px] truncate">{fornec}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                          isAbatimento ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isAbatimento ? '- ' : '+ '}
                        {formatCurrency(d.valor)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          className={`text-[9px] uppercase ${
                            d.status === 'Pago'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'Pendente'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {d.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {d.conta_pagar_id ? (
                          <Badge
                            variant="outline"
                            className="bg-teal-50 text-teal-800 border-teal-200 text-[9px]"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-teal-600" />
                            Título #{d.conta_pagar_id.slice(0, 6)}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExcluirDespesa(d)}
                          className="h-6 w-6 text-gray-400 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {despesas.length > 0 && (
              <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold text-gray-900">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3">
                    TOTALIZADOR DO EQUIPAMENTO ({despesas.length} lançamentos)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-teal-900 text-sm">
                    {formatCurrency(totais.saldoLiquido)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <DialogFooter className="pt-3 border-t border-[#ECEAE4]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
