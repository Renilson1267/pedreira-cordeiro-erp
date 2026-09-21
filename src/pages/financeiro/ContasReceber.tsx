import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type { ContaReceber, Cliente, PlanoConta } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Plus, Search, CheckCircle, Trash2, Edit2, Calendar, AlertCircle } from 'lucide-react'

export default function ContasReceber() {
  const { currentEmpresa, canEdit } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contas, setContas] = useState<ContaReceber[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Aberta' | 'Recebida' | 'Vencida'>(
    'Todas',
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer Create / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState<number>(0)
  const [vencimento, setVencimento] = useState('')
  const [parcelas, setParcelas] = useState<number>(1)
  const [status, setStatus] = useState<'Aberta' | 'Recebida'>('Aberta')
  const [observacoes, setObservacoes] = useState('')

  // Settle (Receber) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaReceber | null>(null)
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [valorRecebido, setValorRecebido] = useState<number>(0)
  const [formaRecebimento, setFormaRecebimento] = useState<
    'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  >('Pix')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Read-only Detail Drawer
  const [detailItem, setDetailItem] = useState<ContaReceber | null>(null)

  useRealtime('contas_receber', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const [crList, cList, pcList] = await Promise.all([
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'vencimento',
          expand: 'cliente_id,categoria_id',
        }),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}' && tipo = 'Receita'`,
          sort: 'codigo',
        }),
      ])

      setContas(crList)
      setClientes(cList)
      setCategorias(pcList)

      const qNovo = searchParams.get('novo')
      const qId = searchParams.get('id')
      const qAction = searchParams.get('action')
      const qStatus = searchParams.get('status')

      if (qStatus === 'Vencidas') {
        setStatusFilter('Vencida')
      }

      if (qNovo && canEdit) {
        openCreateModal()
      } else if (qId) {
        const found = crList.find((c) => c.id === qId)
        if (found) {
          if (qAction === 'settle' && canEdit && found.status !== 'Recebida') {
            handleOpenSettle(found)
          } else {
            setDetailItem(found)
          }
        }
      }
    } catch (err) {
      console.error('Error loading contas a receber:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setClienteId('')
    setDescricao('')
    setCategoriaId(categorias[0]?.id || '')
    setValor(0)
    setVencimento(toInputDate(new Date().toISOString()))
    setParcelas(1)
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: ContaReceber) => {
    setEditingId(c.id)
    setClienteId(c.cliente_id || '')
    setDescricao(c.descricao)
    setCategoriaId(c.categoria_id || '')
    setValor(c.valor)
    setVencimento(toInputDate(c.vencimento))
    setParcelas(c.parcelas || 1)
    setStatus(c.status === 'Recebida' ? 'Recebida' : 'Aberta')
    setObservacoes(c.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim() || valor <= 0 || !vencimento) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)

      if (editingId) {
        await pb.collection('contas_receber').update(editingId, {
          descricao: descricao.trim(),
          cliente_id: clienteId || null,
          categoria_id: categoriaId || null,
          valor: Number(valor),
          vencimento: new Date(vencimento).toISOString(),
          parcelas: Number(parcelas),
          status: status,
          observacoes: observacoes.trim(),
        })
        toast({ title: 'Conta a receber atualizada!' })
      } else {
        const numParcelas = Math.max(1, Number(parcelas))
        const baseDate = new Date(vencimento)

        for (let i = 0; i < numParcelas; i++) {
          const installmentDate = new Date(baseDate)
          installmentDate.setMonth(baseDate.getMonth() + i)

          const desc =
            numParcelas > 1 ? `${descricao.trim()} (${i + 1}/${numParcelas})` : descricao.trim()

          await pb.collection('contas_receber').create({
            empresa_id: currentEmpresa!.id,
            descricao: desc,
            cliente_id: clienteId || null,
            categoria_id: categoriaId || null,
            valor: Number(valor) / (numParcelas > 1 ? numParcelas : 1),
            vencimento: installmentDate.toISOString(),
            parcelas: numParcelas,
            status: status,
            observacoes: observacoes.trim(),
          })
        }
        toast({ title: 'Conta a receber criada com sucesso!' })
      }

      setIsDrawerOpen(false)
      setSearchParams({})
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar conta', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return
    try {
      await pb.collection('contas_receber').delete(id)
      toast({ title: 'Lançamento excluído com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const handleOpenSettle = (conta: ContaReceber) => {
    setSettlingConta(conta)
    setDataRecebimento(toInputDate(new Date().toISOString()))
    setValorRecebido(conta.valor)
    setFormaRecebimento('Pix')
    setSettleModalOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settlingConta) return
    try {
      setIsSubmitting(true)
      const recDateISO = new Date(dataRecebimento).toISOString()

      await pb.collection('contas_receber').update(settlingConta.id, {
        status: 'Recebida',
        data_recebimento: recDateISO,
        forma_recebimento: formaRecebimento,
      })

      await pb.collection('movimentos_financeiros').create({
        empresa_id: currentEmpresa!.id,
        tipo: 'Entrada',
        descricao: `Recebimento: ${settlingConta.descricao}`,
        valor: Number(valorRecebido),
        data: recDateISO,
        categoria_id: settlingConta.categoria_id || null,
        origem: 'ContaReceber',
        referencia_id: settlingConta.id,
        conciliado: false,
      })

      toast({ title: 'Recebimento registrado com sucesso!' })
      setSettleModalOpen(false)
      setSearchParams({})
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao liquidar recebimento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nowISO = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const totalAberto = useMemo(() => {
    return contas
      .filter((c) => c.status === 'Aberta' && c.vencimento.slice(0, 10) >= nowISO)
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas, nowISO])

  const totalVencido = useMemo(() => {
    return contas
      .filter((c) => c.status !== 'Recebida' && c.vencimento.slice(0, 10) < nowISO)
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas, nowISO])

  const totalRecebidoMes = useMemo(() => {
    return contas
      .filter((c) => {
        if (c.status !== 'Recebida' || !c.data_recebimento) return false
        const d = new Date(c.data_recebimento)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas, currentMonth, currentYear])

  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const isOverdue = c.status !== 'Recebida' && c.vencimento.slice(0, 10) < nowISO
      const currentRealStatus = isOverdue ? 'Vencida' : c.status

      if (statusFilter !== 'Todas' && currentRealStatus !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const clienteNome = c.expand?.cliente_id?.nome?.toLowerCase() || ''
        const matchDesc = c.descricao.toLowerCase().includes(q)
        const matchCli = clienteNome.includes(q)
        if (!matchDesc && !matchCli) return false
      }
      return true
    })
  }, [contas, statusFilter, searchQuery, nowISO])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Receber</h1>
          <p className="text-xs text-gray-500">Gestão de faturamento, recebíveis e clientes</p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Conta a Receber
          </Button>
        )}
      </div>

      {/* Summary Pills Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Total em Aberto
            </span>
            <span className="text-xl font-bold text-gray-900 tabular-nums">
              {formatCurrency(totalAberto)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            R$
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider block">
              Total Vencido
            </span>
            <span className="text-xl font-bold text-red-600 tabular-nums">
              {formatCurrency(totalVencido)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            !
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
              Recebido no Mês
            </span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">
              {formatCurrency(totalRecebidoMes)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['Todas', 'Aberta', 'Recebida', 'Vencida'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {st === 'Todas' ? 'Todos os Status' : st}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Buscar descrição ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Table / Cards List */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Nenhuma conta a receber encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const isOverdue = c.status !== 'Recebida' && c.vencimento.slice(0, 10) < nowISO
                  const displayStatus = isOverdue ? 'Vencida' : c.status

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailItem(c)}
                      className="hover:bg-teal-50/20 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-700">
                        {formatDate(c.vencimento)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{c.descricao}</td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {c.expand?.cliente_id?.nome || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {c.expand?.categoria_id?.nome || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 tabular-nums">
                        {formatCurrency(c.valor)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={
                            displayStatus === 'Recebida'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : displayStatus === 'Vencida'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                          }
                        >
                          {displayStatus}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && displayStatus !== 'Recebida' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSettle(c)}
                              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Receber
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(c)}
                              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(c.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
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
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição *</Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Fatura Mensalidade de Serviços"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Não informado</SelectItem>
                  {clientes.map((cli) => (
                    <SelectItem key={cli.id} value={cli.id}>
                      {cli.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Categoria (Plano de Contas)
              </Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a categoria de receita..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.codigo} - {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={valor || ''}
                  onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Vencimento *</Label>
                <Input
                  type="date"
                  required
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {!editingId && (
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Parcelas (Gera lançamentos mensais automáticos)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="48"
                  value={parcelas}
                  onChange={(e) => setParcelas(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Status Inicial</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Recebida">Recebida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes da cobrança, notas fiscais, contrato..."
                className="mt-1"
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
                {isSubmitting ? 'Salvando...' : 'Salvar Título'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Settle (Receber) Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Registrar Recebimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
              <div className="font-semibold text-gray-800 text-sm">{settlingConta?.descricao}</div>
              <div className="text-gray-500 mt-1">
                Cliente: {settlingConta?.expand?.cliente_id?.nome || 'Não informado'}
              </div>
              <div className="text-gray-500">
                Valor a Receber:{' '}
                <strong className="text-gray-900">{formatCurrency(settlingConta?.valor)}</strong>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Data de Recebimento *</Label>
              <Input
                type="date"
                required
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Valor Recebido (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={valorRecebido || ''}
                onChange={(e) => setValorRecebido(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Forma de Recebimento</Label>
              <Select value={formaRecebimento} onValueChange={(v: any) => setFormaRecebimento(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="Transferência">Transferência (TED/DOC)</SelectItem>
                  <SelectItem value="Cartão">Cartão de Crédito/Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro em Espécie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setSettleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSettle}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Read-Only Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Detalhes da Conta a Receber
            </SheetTitle>
          </SheetHeader>

          {detailItem && (
            <div className="py-6 space-y-4 text-xs">
              <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100">
                <span className="text-[11px] text-teal-700 font-semibold uppercase">
                  Valor do Título
                </span>
                <div className="text-2xl font-bold text-teal-900 mt-0.5 tabular-nums">
                  {formatCurrency(detailItem.valor)}
                </div>
              </div>

              <div className="space-y-2 border-t border-[#ECEAE4] pt-4">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Descrição:</span>
                  <span className="font-semibold text-gray-900">{detailItem.descricao}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.cliente_id?.nome || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Categoria Contábil:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.categoria_id?.nome || 'Geral'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Data de Vencimento:</span>
                  <span className="font-mono text-gray-800">
                    {formatDate(detailItem.vencimento)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Status:</span>
                  <Badge variant="outline">{detailItem.status}</Badge>
                </div>
                {detailItem.data_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Data de Recebimento:</span>
                    <span className="font-mono text-emerald-700">
                      {formatDate(detailItem.data_recebimento)}
                    </span>
                  </div>
                )}
                {detailItem.forma_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Forma de Recebimento:</span>
                    <span className="text-gray-800">{detailItem.forma_recebimento}</span>
                  </div>
                )}
              </div>

              {detailItem.observacoes && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] mt-4">
                  <span className="font-semibold text-gray-700 block mb-1">Observações:</span>
                  <p className="text-gray-600">{detailItem.observacoes}</p>
                </div>
              )}

              {canEdit && detailItem.status !== 'Recebida' && (
                <div className="pt-6">
                  <Button
                    onClick={() => {
                      const item = detailItem
                      setDetailItem(null)
                      handleOpenSettle(item)
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    Receber Título Agora
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
