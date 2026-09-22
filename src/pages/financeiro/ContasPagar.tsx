import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type { ContaPagar, Fornecedor, PlanoConta, CentroCusto } from '@/types/erp'
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
import {
  Plus,
  Search,
  Filter,
  CheckCircle,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import { ImportadorContasPagarModal } from '@/components/financeiro/ImportadorContasPagarModal'

export default function ContasPagar() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contas, setContas] = useState<ContaPagar[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Aberta' | 'Paga' | 'Vencida'>('Todas')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Drawer Create / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [fornecedorId, setFornecedorId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState<number>(0)
  const [vencimento, setVencimento] = useState('')
  const [parcelas, setParcelas] = useState<number>(1)
  const [status, setStatus] = useState<'Aberta' | 'Paga'>('Aberta')
  const [observacoes, setObservacoes] = useState('')

  // Settle (Baixar) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaPagar | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [valorPago, setValorPago] = useState<number>(0)
  const [formaPagamento, setFormaPagamento] = useState<
    'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  >('Pix')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Read-only Detail Drawer
  const [detailItem, setDetailItem] = useState<ContaPagar | null>(null)

  useRealtime('contas_pagar', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const [cpList, fList, pcList, ccList] = await Promise.all([
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'vencimento',
          expand: 'fornecedor_id,categoria_id,centro_custo_id',
        }),
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}' && (tipo = 'Despesa' || tipo = 'Custo')`,
          sort: 'codigo',
        }),
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
      ])

      setContas(cpList)
      setFornecedores(fList)
      setCategorias(pcList)
      setCentrosCusto(ccList)

      // Handle query params e.g. ?novo=1 or ?id=xyz
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
        const found = cpList.find((c) => c.id === qId)
        if (found) {
          if (qAction === 'settle' && canEdit && found.status !== 'Paga') {
            handleOpenSettle(found)
          } else {
            setDetailItem(found)
          }
        }
      }
    } catch (err) {
      console.error('Error loading contas a pagar:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setFornecedorId('')
    setCentroCustoId('')
    setDescricao('')
    setCategoriaId(categorias[0]?.id || '')
    setValor(0)
    setVencimento(toInputDate(new Date().toISOString()))
    setParcelas(1)
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: ContaPagar) => {
    setEditingId(c.id)
    setFornecedorId(c.fornecedor_id || '')
    setCentroCustoId(c.centro_custo_id || '')
    setDescricao(c.descricao)
    setCategoriaId(c.categoria_id || '')
    setValor(c.valor)
    setVencimento(toInputDate(c.vencimento))
    setParcelas(c.parcelas || 1)
    setStatus(c.status === 'Paga' ? 'Paga' : 'Aberta')
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
        // Update single record
        await pb.collection('contas_pagar').update(editingId, {
          descricao: descricao.trim(),
          fornecedor_id: fornecedorId === 'none' || !fornecedorId ? null : fornecedorId,
          categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
          centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
          valor: Number(valor),
          vencimento: new Date(vencimento).toISOString(),
          parcelas: Number(parcelas),
          status: status,
          observacoes: observacoes.trim(),
        })
        toast({ title: 'Conta a pagar atualizada!' })
      } else {
        // Multiple installments support
        const numParcelas = Math.max(1, Number(parcelas))
        const baseDate = new Date(vencimento)

        for (let i = 0; i < numParcelas; i++) {
          const installmentDate = new Date(baseDate)
          installmentDate.setMonth(baseDate.getMonth() + i)

          const desc =
            numParcelas > 1 ? `${descricao.trim()} (${i + 1}/${numParcelas})` : descricao.trim()

          await pb.collection('contas_pagar').create({
            empresa_id: currentEmpresa!.id,
            descricao: desc,
            fornecedor_id: fornecedorId === 'none' || !fornecedorId ? null : fornecedorId,
            categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
            centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
            valor: Number(valor) / (numParcelas > 1 ? numParcelas : 1),
            vencimento: installmentDate.toISOString(),
            parcelas: numParcelas,
            status: status,
            observacoes: observacoes.trim(),
          })
        }
        toast({ title: 'Conta a pagar criada com sucesso!' })
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
      await pb.collection('contas_pagar').delete(id)
      toast({ title: 'Lançamento excluído com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const handleOpenSettle = (conta: ContaPagar) => {
    setSettlingConta(conta)
    setDataPagamento(toInputDate(new Date().toISOString()))
    setValorPago(conta.valor)
    setFormaPagamento('Pix')
    setSettleModalOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settlingConta) return
    try {
      setIsSubmitting(true)
      const payDateISO = new Date(dataPagamento).toISOString()

      // 1. Update status to Paga
      await pb.collection('contas_pagar').update(settlingConta.id, {
        status: 'Paga',
        data_pagamento: payDateISO,
        forma_pagamento: formaPagamento,
      })

      // 2. Create financial movement
      await pb.collection('movimentos_financeiros').create({
        empresa_id: currentEmpresa!.id,
        tipo: 'Saida',
        descricao: `Pagamento: ${settlingConta.descricao}${settlingConta.expand?.centro_custo_id ? ` [${settlingConta.expand.centro_custo_id.codigo}]` : ''}`,
        valor: Number(valorPago),
        data: payDateISO,
        categoria_id: settlingConta.categoria_id || null,
        centro_custo_id: settlingConta.centro_custo_id || null,
        origem: 'ContaPagar',
        referencia_id: settlingConta.id,
        conciliado: false,
      })

      toast({ title: 'Baixa efetuada com sucesso!' })
      setSettleModalOpen(false)
      setSearchParams({})
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao baixar título', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculations for summary pills
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
      .filter((c) => c.status !== 'Paga' && c.vencimento.slice(0, 10) < nowISO)
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas, nowISO])

  const totalPagoMes = useMemo(() => {
    return contas
      .filter((c) => {
        if (c.status !== 'Paga' || !c.data_pagamento) return false
        const d = new Date(c.data_pagamento)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas, currentMonth, currentYear])

  // Filtered List
  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      // Dynamic vencida check
      const isOverdue = c.status !== 'Paga' && c.vencimento.slice(0, 10) < nowISO
      const currentRealStatus = isOverdue ? 'Vencida' : c.status

      if (statusFilter !== 'Todas' && currentRealStatus !== statusFilter) {
        return false
      }
      if (centroCustoFilter !== 'todos' && c.centro_custo_id !== centroCustoFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fornecedorNome = c.expand?.fornecedor_id?.nome?.toLowerCase() || ''
        const matchDesc = c.descricao.toLowerCase().includes(q)
        const matchForn = fornecedorNome.includes(q)
        if (!matchDesc && !matchForn) return false
      }
      return true
    })
  }, [contas, statusFilter, centroCustoFilter, searchQuery, nowISO])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Pagar</h1>
          <p className="text-xs text-gray-500">Gestão de obrigações, vencimentos e fornecedores</p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-teal-700" />
              Importar Planilha XLSX
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Conta a Pagar
            </Button>
          )}
        </div>
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
              Pago no Mês
            </span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">
              {formatCurrency(totalPagoMes)}
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
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['Todas', 'Aberta', 'Paga', 'Vencida'] as const).map((st) => (
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

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Centro de Custo Filter */}
            <Select value={centroCustoFilter} onValueChange={setCentroCustoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Centros</SelectItem>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar descrição ou fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>
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
                <th className="py-3 px-4">Fornecedor</th>
                <th className="py-3 px-4">Centro Custo</th>
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
                    Nenhuma conta a pagar encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const isOverdue = c.status !== 'Paga' && c.vencimento.slice(0, 10) < nowISO
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
                        {c.expand?.fornecedor_id?.nome || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {c.expand?.centro_custo_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: c.expand.centro_custo_id.cor || '#0F766E' }}
                            />
                            {c.expand.centro_custo_id.codigo}
                          </span>
                        ) : (
                          '—'
                        )}
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
                            displayStatus === 'Paga'
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
                          {canEdit && displayStatus !== 'Paga' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSettle(c)}
                              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Baixar
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
              {editingId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição *</Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aluguel do Escritório Central"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Não informado</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Centro de Custo</Label>
                <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o centro..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum / Não alocado</SelectItem>
                    {centrosCusto.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Categoria Contábil</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.codigo} - {cat.nome} ({cat.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <SelectItem value="Paga">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais, notas fiscais, etc..."
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

      {/* Settle (Baixar) Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Baixar Conta a Pagar
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
              <div className="font-semibold text-gray-800 text-sm">{settlingConta?.descricao}</div>
              <div className="text-gray-500 mt-1">
                Fornecedor: {settlingConta?.expand?.fornecedor_id?.nome || 'Não informado'}
              </div>
              <div className="text-gray-500">
                Valor Original:{' '}
                <strong className="text-gray-900">{formatCurrency(settlingConta?.valor)}</strong>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Data de Pagamento *</Label>
              <Input
                type="date"
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Valor Pago (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={valorPago || ''}
                onChange={(e) => setValorPago(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v: any) => setFormaPagamento(v)}>
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
              {isSubmitting ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Read-Only Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Detalhes da Conta a Pagar
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
                  <span className="text-gray-500">Fornecedor:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.fornecedor_id?.nome || 'Não informado'}
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
                {detailItem.data_pagamento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Data de Pagamento:</span>
                    <span className="font-mono text-emerald-700">
                      {formatDate(detailItem.data_pagamento)}
                    </span>
                  </div>
                )}
                {detailItem.forma_pagamento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Forma de Pagamento:</span>
                    <span className="text-gray-800">{detailItem.forma_pagamento}</span>
                  </div>
                )}
              </div>

              {detailItem.observacoes && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] mt-4">
                  <span className="font-semibold text-gray-700 block mb-1">Observações:</span>
                  <p className="text-gray-600">{detailItem.observacoes}</p>
                </div>
              )}

              {canEdit && detailItem.status !== 'Paga' && (
                <div className="pt-6">
                  <Button
                    onClick={() => {
                      const item = detailItem
                      setDetailItem(null)
                      handleOpenSettle(item)
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    Baixar Título Agora
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Importador XLSX Contas a Pagar */}
      <ImportadorContasPagarModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        empresaId={currentEmpresa?.id || ''}
        fornecedores={fornecedores}
        categorias={categorias}
        centrosCusto={centrosCusto}
        contasExistentes={contas}
        onImportComplete={loadData}
      />
    </div>
  )
}
