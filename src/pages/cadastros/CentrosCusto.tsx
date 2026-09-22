import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDate } from '@/lib/formatters'
import type { CentroCusto, ContaPagar, ContaReceber, MovimentoFinanceiro } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  PieChart,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'

const CORES_PALETA = [
  '#0F766E', // Teal
  '#0284C7', // Sky Blue
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Purple
  '#16A34A', // Green
  '#EA580C', // Orange
  '#475569', // Slate
]

export default function CentrosCusto() {
  const { currentEmpresa, canEdit, isAdmin } = useCompany()

  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState('#0F766E')
  const [ativo, setAtivo] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('centros_custos', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [cList, cpList, crList] = await Promise.all([
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])

      setCentros(cList)
      setContasPagar(cpList)
      setContasReceber(crList)
    } catch (err) {
      console.error('Erro ao carregar centros de custo:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    const nextNum = centros.length + 1
    setCodigo(`CC-0${nextNum}`)
    setNome('')
    setDescricao('')
    setCor(CORES_PALETA[centros.length % CORES_PALETA.length])
    setAtivo(true)
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: CentroCusto) => {
    setEditingId(c.id)
    setCodigo(c.codigo)
    setNome(c.nome)
    setDescricao(c.descricao || '')
    setCor(c.cor || '#0F766E')
    setAtivo(c.ativo !== false)
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      toast({ title: 'Preencha o código e o nome do centro de custo', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        codigo: codigo.trim().toUpperCase(),
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cor: cor || undefined,
        ativo: ativo,
      }

      if (editingId) {
        await pb.collection('centros_custos').update(editingId, payload)
        toast({ title: 'Centro de custo atualizado com sucesso!' })
      } else {
        await pb.collection('centros_custos').create(payload)
        toast({ title: 'Centro de custo criado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar centro de custo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (c: CentroCusto) => {
    // Verificar se há lançamentos vinculados
    const temPagar = contasPagar.some((cp) => cp.centro_custo_id === c.id)
    const temReceber = contasReceber.some((cr) => cr.centro_custo_id === c.id)
    if (temPagar || temReceber) {
      toast({
        title: 'Não é possível excluir',
        description:
          'Existem contas a pagar ou a receber vinculadas a este centro de custo. Desative-o se não desejar mais usá-lo.',
        variant: 'destructive',
      })
      return
    }

    if (!confirm(`Deseja realmente remover o centro de custo "${c.codigo} - ${c.nome}"?`)) return

    try {
      await pb.collection('centros_custos').delete(c.id)
      toast({ title: 'Centro de custo excluído com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Estatísticas de vínculo por centro de custo
  const vinculos = useMemo(() => {
    const map: Record<
      string,
      { pagarCount: number; pagarTotal: number; receberCount: number; receberTotal: number }
    > = {}
    centros.forEach((c) => {
      map[c.id] = { pagarCount: 0, pagarTotal: 0, receberCount: 0, receberTotal: 0 }
    })

    contasPagar.forEach((cp) => {
      if (cp.centro_custo_id && map[cp.centro_custo_id]) {
        map[cp.centro_custo_id].pagarCount += 1
        map[cp.centro_custo_id].pagarTotal += cp.valor || 0
      }
    })

    contasReceber.forEach((cr) => {
      if (cr.centro_custo_id && map[cr.centro_custo_id]) {
        map[cr.centro_custo_id].receberCount += 1
        map[cr.centro_custo_id].receberTotal += cr.valor || 0
      }
    })

    return map
  }, [centros, contasPagar, contasReceber])

  const filteredCentros = useMemo(() => {
    return centros.filter((c) => {
      const q = searchQuery.toLowerCase()
      return (
        c.codigo.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        (c.descricao && c.descricao.toLowerCase().includes(q))
      )
    })
  }, [centros, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-teal-700" />
            Centros de Custo
          </h1>
          <p className="text-xs text-gray-500">
            Segmentação contábil e operacional (Extração, Transporte/Frota, Administrativo,
            Manutenção, etc.)
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Centro de Custo
          </Button>
        )}
      </div>

      {/* Info Card de Pedreira */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
        <Layers className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Estrutura de Centros de Custo Operacional</div>
          <div className="text-amber-800/90 mt-0.5 leading-relaxed">
            Permite apurar resultados, despesas e receitas por frente de trabalho da pedreira:
            Extração/Britagem na jazida, Logística/Transporte de agregados, Oficina de manutenção ou
            Escritório administrativo. O centro de custo pode ser selecionado nos lançamentos de
            Contas a Pagar, Contas a Receber e DRE.
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <Input
          placeholder="Buscar por código, nome ou descrição..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white border-[#ECEAE4] text-xs h-10 rounded-xl"
        />
      </div>

      {/* Lista de Centros em Cards / Tabela */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCentros.map((c) => {
          const dados = vinculos[c.id] || {
            pagarCount: 0,
            pagarTotal: 0,
            receberCount: 0,
            receberTotal: 0,
          }
          const corPill = c.cor || '#0F766E'

          return (
            <Card
              key={c.id}
              className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: corPill }}
                    />
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-bold text-gray-800 border-gray-300"
                    >
                      {c.codigo}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.ativo !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {c.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-base mb-1">{c.nome}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {c.descricao || 'Sem descrição cadastrada.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#ECEAE4] space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-red-500" />
                    Contas a Pagar:
                  </span>
                  <span className="font-mono font-semibold text-gray-800">
                    {dados.pagarCount} títulos
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                    Contas a Receber:
                  </span>
                  <span className="font-mono font-semibold text-gray-800">
                    {dados.receberCount} títulos
                  </span>
                </div>

                {canEdit && (
                  <div className="pt-2 flex items-center justify-end gap-1 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(c)}
                      className="h-8 text-xs text-gray-600 hover:text-gray-900"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(c)}
                      className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {filteredCentros.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs bg-white rounded-2xl border border-[#ECEAE4]">
            Nenhum centro de custo cadastrado ou encontrado na busca.
          </div>
        )}
      </div>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
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
                  placeholder="CC-01"
                  className="mt-1 font-mono uppercase"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Nome do Centro *</Label>
                <Input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Extração e Britagem"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição / Finalidade</Label>
              <Textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Despesas operacionais com britador, peneiras, explosivos e diesel das escavadeiras..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Cor de Identificação
              </Label>
              <div className="flex items-center gap-2">
                {CORES_PALETA.map((hex) => (
                  <button
                    type="button"
                    key={hex}
                    onClick={() => setCor(hex)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      cor === hex
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#ECEAE4]">
              <div>
                <Label className="text-xs font-semibold text-gray-800">Status Ativo</Label>
                <p className="text-[11px] text-gray-500">
                  Centros inativos não aparecem nos novos lançamentos de despesas/receitas
                </p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
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
                {isSubmitting ? 'Salvando...' : 'Salvar Centro de Custo'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
