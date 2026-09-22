import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/formatters'
import type { Produto } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, ArrowUpDown } from 'lucide-react'

export default function Produtos() {
  const { currentEmpresa, canEdit } = useCompany()

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [loading, setLoading] = useState(false)

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<Produto['categoria']>('Vendas')
  const [unidade, setUnidade] = useState<Produto['unidade']>('un')
  const [precoCusto, setPrecoCusto] = useState<number>(0)
  const [precoVenda, setPrecoVenda] = useState<number>(0)
  const [estoque, setEstoque] = useState<number>(0)
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(5)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('produtos', () => loadProdutos())

  const loadProdutos = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const res = await pb.collection('produtos').getFullList<Produto>({
        filter: `empresa_id = '${currentEmpresa.id}'`,
        sort: 'codigo',
      })
      setProdutos(res)
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProdutos()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setCodigo(`PRD-00${produtos.length + 1}`)
    setNome('')
    setCategoria('Vendas')
    setUnidade('un')
    setPrecoCusto(0)
    setPrecoVenda(0)
    setEstoque(0)
    setEstoqueMinimo(5)
    setIsDrawerOpen(true)
  }

  const handleEdit = (p: Produto) => {
    setEditingId(p.id)
    setCodigo(p.codigo)
    setNome(p.nome)
    setCategoria(p.categoria)
    setUnidade(p.unidade)
    setPrecoCusto(p.preco_custo || 0)
    setPrecoVenda(p.preco_venda || 0)
    setEstoque(p.estoque || 0)
    setEstoqueMinimo(p.estoque_minimo || 0)
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      toast({ title: 'Preencha o código e nome do item', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        codigo: codigo.trim(),
        nome: nome.trim(),
        categoria,
        unidade,
        preco_custo: Number(precoCusto) || 0,
        preco_venda: Number(precoVenda) || 0,
        estoque: Number(estoque) || 0,
        estoque_minimo: Number(estoqueMinimo) || 0,
      }

      if (editingId) {
        await pb.collection('produtos').update(editingId, payload)
        toast({ title: 'Produto atualizado com sucesso!' })
      } else {
        await pb.collection('produtos').create(payload)
        toast({ title: 'Produto cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadProdutos()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar produto', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este produto?')) return
    try {
      await pb.collection('produtos').delete(id)
      toast({ title: 'Produto excluído com sucesso.' })
      await loadProdutos()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      if (categoryFilter !== 'Todas' && p.categoria !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
      }
      return true
    })
  }, [produtos, categoryFilter, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Produtos e Serviços</h1>
          <p className="text-xs text-gray-500">
            Catálogo de itens comercializáveis, custos, preços e estoques
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Produto / Serviço
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {['Todas', 'Vendas', 'Serviços', 'Mercadorias', 'Operacional', 'Gestão', 'Outros'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70'
                  }`}
                >
                  {cat}
                </button>
              ),
            )}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Buscar por código ou nome..."
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
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nome do Item</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4 text-right">Preço de Custo</th>
                <th className="py-3 px-4 text-right">Preço de Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredProdutos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Nenhum produto cadastrado para a pesquisa atual.
                  </td>
                </tr>
              ) : (
                filteredProdutos.map((p) => {
                  const isLowStock =
                    p.unidade !== 'serv' && (p.estoque || 0) <= (p.estoque_minimo || 0)

                  return (
                    <tr key={p.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-700">{p.codigo}</td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{p.nome}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {p.categoria}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 uppercase text-gray-500 font-mono">{p.unidade}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-600">
                        {formatCurrency(p.preco_custo)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold tabular-nums text-teal-800">
                        {formatCurrency(p.preco_venda)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className={`font-mono font-semibold ${
                              isLowStock ? 'text-red-600 font-bold' : 'text-gray-800'
                            }`}
                          >
                            {p.estoque || 0}
                          </span>
                          {isLowStock && (
                            <span title="Estoque no limite ou abaixo do mínimo!">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(p)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(p.id)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
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
              {editingId ? 'Editar Item' : 'Novo Produto ou Serviço'}
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
                  placeholder="PRD-001"
                  className="mt-1 font-mono uppercase"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">
                  Nome do Produto / Serviço *
                </Label>
                <Input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Consultoria Contábil"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Categoria</Label>
                <Select value={categoria} onValueChange={(v: any) => setCategoria(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vendas">Vendas</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Mercadorias">Mercadorias</SelectItem>
                    <SelectItem value="Operacional">Operacional</SelectItem>
                    <SelectItem value="Gestão">Gestão</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Unidade de Medida</Label>
                <Select value={unidade} onValueChange={(v: any) => setUnidade(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³ (Metro cúbico)</SelectItem>
                    <SelectItem value="ton">ton (Tonelada)</SelectItem>
                    <SelectItem value="un">un (Unidade)</SelectItem>
                    <SelectItem value="serv">serv (Serviço)</SelectItem>
                    <SelectItem value="kg">kg (Quilograma)</SelectItem>
                    <SelectItem value="cx">cx (Caixa)</SelectItem>
                    <SelectItem value="l">l (Litro)</SelectItem>
                    <SelectItem value="m²">m² (Metro quadrado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Preço de Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={precoCusto || ''}
                  onChange={(e) => setPrecoCusto(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Preço de Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={precoVenda || ''}
                  onChange={(e) => setPrecoVenda(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-teal-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Estoque Atual</Label>
                <Input
                  type="number"
                  value={estoque}
                  onChange={(e) => setEstoque(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Estoque Mínimo (Alerta)
                </Label>
                <Input
                  type="number"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(parseInt(e.target.value) || 0)}
                  placeholder="5"
                  className="mt-1 font-mono"
                />
              </div>
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
                {isSubmitting ? 'Salvando...' : 'Salvar Item'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
