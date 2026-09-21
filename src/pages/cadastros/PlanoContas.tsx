import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/formatters'
import type { PlanoConta, MovimentoFinanceiro } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import { Layers, Plus, ChevronDown, ChevronRight, Edit2, Trash2, FolderTree } from 'lucide-react'

export default function PlanoContas() {
  const { currentEmpresa, canEdit } = useCompany()

  const [contas, setContas] = useState<PlanoConta[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([])
  const [loading, setLoading] = useState(false)

  // Expanded Groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Receita: true,
    Despesa: true,
    Custo: true,
    Ativo: true,
    Passivo: true,
  })

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PlanoConta['tipo']>('Despesa')
  const [contaPaiId, setContaPaiId] = useState<string>('')
  const [natureza, setNatureza] = useState<PlanoConta['natureza']>('Debito')
  const [ativa, setAtiva] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('plano_contas', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [pcList, movList] = await Promise.all([
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])

      setContas(pcList)
      setMovimentos(movList)
    } catch (err) {
      console.error('Error fetching plano de contas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const openCreateModal = (defaultTipo?: PlanoConta['tipo']) => {
    setEditingId(null)
    setCodigo('')
    setNome('')
    setTipo(defaultTipo || 'Despesa')
    setContaPaiId('')
    setNatureza(defaultTipo === 'Receita' || defaultTipo === 'Passivo' ? 'Credito' : 'Debito')
    setAtiva(true)
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: PlanoConta) => {
    setEditingId(c.id)
    setCodigo(c.codigo)
    setNome(c.nome)
    setTipo(c.tipo)
    setContaPaiId(c.conta_pai_id || '')
    setNatureza(c.natureza)
    setAtiva(c.ativa)
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      toast({ title: 'Informe o código e nome da conta', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        codigo: codigo.trim(),
        nome: nome.trim(),
        tipo,
        conta_pai_id: contaPaiId || null,
        natureza,
        ativa,
      }

      if (editingId) {
        await pb.collection('plano_contas').update(editingId, payload)
        toast({ title: 'Conta atualizada com sucesso!' })
      } else {
        await pb.collection('plano_contas').create(payload)
        toast({ title: 'Conta criada com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar conta', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta conta contábil?')) return
    try {
      await pb.collection('plano_contas').delete(id)
      toast({ title: 'Conta excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Sum of movements by category
  const sumByCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    movimentos.forEach((m) => {
      if (m.categoria_id) {
        map[m.categoria_id] = (map[m.categoria_id] || 0) + (m.valor || 0)
      }
    })
    return map
  }, [movimentos])

  const tiposOrdenados: PlanoConta['tipo'][] = ['Receita', 'Custo', 'Despesa', 'Ativo', 'Passivo']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Plano de Contas</h1>
          <p className="text-xs text-gray-500">
            Estrutura hierárquica contábil agrupada por tipo e natureza das operações
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={() => openCreateModal()}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Conta Contábil
          </Button>
        )}
      </div>

      {/* Tree / Grouped View */}
      <div className="space-y-4">
        {tiposOrdenados.map((tipoName) => {
          const contasDoTipo = contas.filter((c) => c.tipo === tipoName)
          const isExpanded = expandedGroups[tipoName]
          const totalTipo = contasDoTipo.reduce((sum, c) => sum + (sumByCategoria[c.id] || 0), 0)

          return (
            <Card
              key={tipoName}
              className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden"
            >
              <div
                onClick={() => toggleGroup(tipoName)}
                className="p-4 bg-[#FAF9F7] flex items-center justify-between cursor-pointer select-none hover:bg-gray-100/60 transition-colors border-b border-[#ECEAE4]"
              >
                <div className="flex items-center space-x-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                  <h3 className="font-bold text-gray-900 text-sm">{tipoName}s</h3>
                  <Badge variant="outline" className="text-[10px] bg-white">
                    {contasDoTipo.length} {contasDoTipo.length === 1 ? 'conta' : 'contas'}
                  </Badge>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Total Movimentado
                    </span>
                    <span className="text-xs font-bold text-gray-900 tabular-nums">
                      {formatCurrency(totalTipo)}
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="divide-y divide-[#ECEAE4]">
                  {contasDoTipo.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-xs">
                      Nenhuma conta cadastrada para este grupo.
                    </div>
                  ) : (
                    contasDoTipo.map((c) => {
                      const totalConta = sumByCategoria[c.id] || 0
                      return (
                        <div
                          key={c.id}
                          className="p-3.5 px-6 flex items-center justify-between hover:bg-teal-50/20 transition-colors text-xs"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-bold text-teal-800 w-16">
                              {c.codigo}
                            </span>
                            <div>
                              <span className="font-semibold text-gray-900">{c.nome}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">
                                  Natureza: {c.natureza}
                                </span>
                                {!c.ativa && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] bg-gray-100 text-gray-600"
                                  >
                                    Inativa
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <span className="font-bold text-gray-800 tabular-nums">
                                {formatCurrency(totalConta)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(c)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(c.id)}
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Código *</Label>
                <Input
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: 3.5"
                  className="mt-1 font-mono"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Nome da Conta *</Label>
                <Input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Despesas com Marketing"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Conta</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Receita">Receita</SelectItem>
                    <SelectItem value="Custo">Custo</SelectItem>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Passivo">Passivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Natureza</Label>
                <Select value={natureza} onValueChange={(v: any) => setNatureza(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debito">Débito (Devedora)</SelectItem>
                    <SelectItem value="Credito">Crédito (Credora)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Conta Pai (Opcional - Hierarquia)
              </Label>
              <Select value={contaPaiId} onValueChange={setContaPaiId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione caso seja subconta..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Conta Sintética Principal)</SelectItem>
                  {contas.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.codigo} - {ct.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#ECEAE4]">
              <div>
                <div className="font-semibold text-gray-800">Conta Ativa</div>
                <div className="text-[11px] text-gray-400">
                  Permite novos lançamentos financeiros
                </div>
              </div>
              <Switch checked={ativa} onCheckedChange={setAtiva} />
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
                {isSubmitting ? 'Salvando...' : 'Salvar Conta'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
