import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/formatters'
import type { Produto } from '@/types/erp'
import {
  produtosService,
  sugerirDensidadePorNome,
  converterM3ParaToneladas,
  converterToneladasParaM3,
  formatarNumeroBR,
  DENSIDADES_TIPICAS_PEDREIRA,
} from '@/services/produtos'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  Calculator,
  Scale,
  Info,
  Sparkles,
} from 'lucide-react'

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
  const [unidade, setUnidade] = useState<Produto['unidade']>('m³')
  const [precoCusto, setPrecoCusto] = useState<number>(0)
  const [precoVenda, setPrecoVenda] = useState<number>(0)
  const [estoque, setEstoque] = useState<number>(0)
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(5)
  const [densidade, setDensidade] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick Converter Modal State
  const [isConverterOpen, setIsConverterOpen] = useState(false)
  const [converterProduto, setConverterProduto] = useState<Produto | null>(null)
  const [converterDensidade, setConverterDensidade] = useState<number>(1.5)
  const [converterM3, setConverterM3] = useState<string>('1')
  const [converterTon, setConverterTon] = useState<string>('1.5')
  const [lastEditedMode, setLastEditedMode] = useState<'m3' | 'ton'>('m3')

  useRealtime('produtos', () => loadProdutos())

  const loadProdutos = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const res = await produtosService.listByEmpresa(currentEmpresa.id)
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
    setUnidade('m³')
    setPrecoCusto(0)
    setPrecoVenda(0)
    setEstoque(0)
    setEstoqueMinimo(5)
    setDensidade('')
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
    setDensidade(p.densidade !== undefined && p.densidade !== null ? String(p.densidade) : '')
    setIsDrawerOpen(true)
  }

  // Pre-fill suggestion when typing name in create mode
  const handleNomeChange = (novoNome: string) => {
    setNome(novoNome)
    if (!editingId && !densidade) {
      const sugerida = sugerirDensidadePorNome(novoNome)
      if (sugerida !== null) {
        setDensidade(String(sugerida))
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      toast({ title: 'Preencha o código e nome do item', variant: 'destructive' })
      return
    }

    const densidadeNum = densidade.trim() ? parseFloat(densidade.replace(',', '.')) : undefined

    if (densidadeNum !== undefined && (isNaN(densidadeNum) || densidadeNum < 0)) {
      toast({
        title: 'Densidade inválida',
        description: 'Informe um número positivo (ex: 1.5)',
        variant: 'destructive',
      })
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
        densidade: densidadeNum !== undefined && !isNaN(densidadeNum) ? densidadeNum : undefined,
      }

      if (editingId) {
        await produtosService.update(editingId, payload)
        toast({ title: 'Produto atualizado com sucesso!' })
      } else {
        await produtosService.create(payload)
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
      await produtosService.delete(id)
      toast({ title: 'Produto excluído com sucesso.' })
      await loadProdutos()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Quick Converter Modal helpers
  const openConverter = (p?: Produto) => {
    if (p) {
      setConverterProduto(p)
      const dens = p.densidade && p.densidade > 0 ? p.densidade : 1.5
      setConverterDensidade(dens)
      setConverterM3('1')
      setConverterTon(formatarNumeroBR(dens, 3))
    } else {
      // Find first product with density or default
      const prodWithDens =
        produtos.find((item) => item.densidade && item.densidade > 0) || produtos[0] || null
      setConverterProduto(prodWithDens)
      const dens =
        prodWithDens?.densidade && prodWithDens.densidade > 0 ? prodWithDens.densidade : 1.5
      setConverterDensidade(dens)
      setConverterM3('1')
      setConverterTon(formatarNumeroBR(dens, 3))
    }
    setLastEditedMode('m3')
    setIsConverterOpen(true)
  }

  const handleConverterProdutoChange = (produtoId: string) => {
    const prod = produtos.find((p) => p.id === produtoId) || null
    setConverterProduto(prod)
    if (prod && prod.densidade && prod.densidade > 0) {
      setConverterDensidade(prod.densidade)
      if (lastEditedMode === 'm3') {
        const m3Val = parseFloat(converterM3.replace(',', '.')) || 0
        setConverterTon(formatarNumeroBR(converterM3ParaToneladas(m3Val, prod.densidade), 3))
      } else {
        const tonVal = parseFloat(converterTon.replace(',', '.')) || 0
        setConverterM3(formatarNumeroBR(converterToneladasParaM3(tonVal, prod.densidade), 3))
      }
    }
  }

  const handleConverterM3Change = (valStr: string) => {
    setConverterM3(valStr)
    setLastEditedMode('m3')
    const val = parseFloat(valStr.replace(',', '.'))
    if (!isNaN(val) && converterDensidade > 0) {
      const tonCalc = converterM3ParaToneladas(val, converterDensidade)
      setConverterTon(formatarNumeroBR(tonCalc, 3))
    } else {
      setConverterTon('0')
    }
  }

  const handleConverterTonChange = (valStr: string) => {
    setConverterTon(valStr)
    setLastEditedMode('ton')
    const val = parseFloat(valStr.replace(',', '.'))
    if (!isNaN(val) && converterDensidade > 0) {
      const m3Calc = converterToneladasParaM3(val, converterDensidade)
      setConverterM3(formatarNumeroBR(m3Calc, 3))
    } else {
      setConverterM3('0')
    }
  }

  const handleConverterDensidadeChange = (densStr: string) => {
    const densVal = parseFloat(densStr.replace(',', '.')) || 0
    setConverterDensidade(densVal)
    if (densVal > 0) {
      if (lastEditedMode === 'm3') {
        const m3Val = parseFloat(converterM3.replace(',', '.')) || 0
        setConverterTon(formatarNumeroBR(converterM3ParaToneladas(m3Val, densVal), 3))
      } else {
        const tonVal = parseFloat(converterTon.replace(',', '.')) || 0
        setConverterM3(formatarNumeroBR(converterToneladasParaM3(tonVal, densVal), 3))
      }
    }
  }

  // Live conversion in Drawer form
  const formDensidadeNum = parseFloat(densidade.replace(',', '.'))
  const isFormDensidadeValid = !isNaN(formDensidadeNum) && formDensidadeNum > 0
  const form1m3ToTon = isFormDensidadeValid ? formatarNumeroBR(formDensidadeNum, 3) : null
  const form1tonToM3 = isFormDensidadeValid ? formatarNumeroBR(1 / formDensidadeNum, 3) : null

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

  // Count products with density configured
  const countWithDensidade = useMemo(() => {
    return produtos.filter((p) => p.densidade && p.densidade > 0).length
  }, [produtos])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Produtos e Serviços</h1>
            <Badge
              variant="outline"
              className="border-teal-300 text-teal-800 bg-teal-50 text-[11px]"
            >
              Pedreira Cordeiro
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Catálogo de agregados e serviços, controle de densidade (t/m³), estoques e conversões
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Converter Quick Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => openConverter()}
            className="border-teal-200 text-teal-800 hover:bg-teal-50 hover:text-teal-900 rounded-xl shadow-xs"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5 text-teal-600" />
            Converter Unidades (m³ ⇄ t)
          </Button>

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
      </div>

      {/* Quick summary banner on pedreira conversion */}
      <Card className="rounded-2xl border-teal-100 bg-gradient-to-r from-teal-50/70 via-emerald-50/40 to-white shadow-xs p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100/80 text-teal-800 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                  Conversão de Unidades: Metro Cúbico (m³) e Tonelada (t)
                </span>
                <Badge className="bg-teal-700 text-white text-[10px]">
                  {countWithDensidade} de {produtos.length} com densidade
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Defina a densidade (t/m³) de cada agregado para calcular automaticamente o peso em
                toneladas a partir do volume em m³, ou vice-versa.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openConverter()}
            className="text-xs bg-white border border-teal-200 text-teal-800 hover:bg-teal-50 shrink-0 rounded-lg shadow-2xs"
          >
            <Calculator className="w-3.5 h-3.5 mr-1 text-teal-600" />
            Abrir Calculadora
          </Button>
        </div>
      </Card>

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
                <th className="py-3 px-4">Densidade (t/m³)</th>
                <th className="py-3 px-4 text-right">Preço de Custo</th>
                <th className="py-3 px-4 text-right">Preço de Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredProdutos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    {loading
                      ? 'Carregando produtos...'
                      : 'Nenhum produto cadastrado para a pesquisa atual.'}
                  </td>
                </tr>
              ) : (
                filteredProdutos.map((p) => {
                  const isLowStock =
                    p.unidade !== 'serv' && (p.estoque || 0) <= (p.estoque_minimo || 0)
                  const hasDensidade =
                    p.densidade !== undefined && p.densidade !== null && p.densidade > 0

                  return (
                    <tr key={p.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-700">{p.codigo}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{p.nome}</div>
                        {hasDensidade && (
                          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <span className="text-teal-700">
                              1 m³ = {formatarNumeroBR(p.densidade!)} t
                            </span>
                            <span className="text-gray-300">•</span>
                            <span>1 t ≈ {formatarNumeroBR(1 / p.densidade!)} m³</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {p.categoria}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 uppercase text-gray-500 font-mono font-semibold">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                          {p.unidade}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {hasDensidade ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200 font-mono font-semibold">
                              {formatarNumeroBR(p.densidade!, 2)} t/m³
                            </Badge>
                            <button
                              type="button"
                              onClick={() => openConverter(p)}
                              title="Converter este produto"
                              className="text-gray-400 hover:text-teal-700 transition-colors"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-mono text-[11px]">—</span>
                        )}
                      </td>
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
                          {p.unidade && (
                            <span className="text-[10px] text-gray-400 font-mono">{p.unidade}</span>
                          )}
                          {isLowStock && (
                            <span title="Estoque no limite ou abaixo do mínimo!">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasDensidade && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openConverter(p)}
                              title="Converter unidades (m³ ⇄ t)"
                              className="h-7 w-7 p-0 text-teal-600 hover:text-teal-900 hover:bg-teal-50"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(p)}
                              title="Editar"
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
                              title="Excluir"
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
        <SheetContent className="sm:max-w-[500px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
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
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Ex: Brita 12"
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

            {/* DENSIDADE FIELD & LIVE CONVERSION */}
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-teal-700" />
                  <Label className="text-xs font-bold text-teal-950">Densidade (t/m³)</Label>
                  <span className="text-[10px] text-gray-500 font-normal">(Opcional)</span>
                </div>
                {nome && !densidade && sugerirDensidadePorNome(nome) && (
                  <button
                    type="button"
                    onClick={() => setDensidade(String(sugerirDensidadePorNome(nome)))}
                    className="text-[11px] font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    <Sparkles className="w-3 h-3" />
                    Sugerir {sugerirDensidadePorNome(nome)} t/m³
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={densidade}
                    onChange={(e) => setDensidade(e.target.value)}
                    placeholder="Ex: 1.50"
                    className="font-mono bg-white border-teal-200 focus:border-teal-600 focus:ring-teal-600 pr-14"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-mono pointer-events-none">
                    t/m³
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-600 leading-tight">
                Permite converter entre m³ e toneladas (ex.: 1,5 t/m³ → 1 m³ = 1,5 t).
              </p>

              {/* Botões rápidos de densidades típicas */}
              <div className="pt-1">
                <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                  Valores típicos de pedreira:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[
                    { label: 'Brita (1,50)', val: '1.5' },
                    { label: 'Rachão (1,50)', val: '1.5' },
                    { label: 'Pó de pedra (1,50)', val: '1.5' },
                    { label: 'Cascalhinho (1,60)', val: '1.6' },
                    { label: 'Areia (1,45)', val: '1.45' },
                  ].map((sug) => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => setDensidade(sug.val)}
                      className="px-2 py-0.5 rounded-md text-[11px] bg-white border border-teal-200 text-teal-900 hover:bg-teal-100 transition-colors"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LIVE CONVERSION PREVIEW */}
              {isFormDensidadeValid && (
                <div className="mt-2 p-2.5 rounded-lg bg-teal-100/60 border border-teal-200/80 text-[11px] text-teal-950 space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-teal-900">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-teal-700" />
                    <span>Conversão ao vivo para {nome || 'este item'}:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div className="bg-white/80 p-1.5 rounded border border-teal-200">
                      <span className="text-gray-500 block text-[10px]">Volume → Massa</span>
                      <strong className="text-teal-900 font-bold">
                        1 m³ = {form1m3ToTon} toneladas
                      </strong>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded border border-teal-200">
                      <span className="text-gray-500 block text-[10px]">Massa → Volume</span>
                      <strong className="text-teal-900 font-bold">
                        1 tonelada = {form1tonToM3} m³
                      </strong>
                    </div>
                  </div>
                </div>
              )}
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

      {/* QUICK CONVERTER MODAL */}
      <Dialog open={isConverterOpen} onOpenChange={setIsConverterOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border border-[#ECEAE4] rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Conversor de Unidades (m³ ⇄ Tonelada)
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Calculadora ágil baseada na densidade do agregado para pesagem e carregamento
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-xs">
            {/* Produto Selector */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Selecione o Produto da Pedreira
              </Label>
              <Select
                value={converterProduto?.id || ''}
                onValueChange={handleConverterProdutoChange}
              >
                <SelectTrigger className="mt-1 bg-[#FAF9F7]">
                  <SelectValue placeholder="Escolha um produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}{' '}
                      {p.densidade ? `(${formatarNumeroBR(p.densidade)} t/m³)` : '(sem densidade)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Densidade input */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Densidade de Cálculo (t/m³)
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={converterDensidade}
                    onChange={(e) => handleConverterDensidadeChange(e.target.value)}
                    className="font-mono bg-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-mono pointer-events-none">
                    t/m³
                  </span>
                </div>
              </div>

              {/* Botões rápidos */}
              <div className="flex gap-1.5 pb-0.5">
                {[1.5, 1.6].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleConverterDensidadeChange(String(d))}
                    className="h-9 text-xs px-2.5 border-teal-200 text-teal-800 hover:bg-teal-50"
                  >
                    Usar {d.toFixed(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Converter Inputs (m³ ⇄ ton) */}
            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* m³ */}
                <div>
                  <Label className="text-xs font-semibold text-teal-950 flex items-center justify-between">
                    <span>Volume em Metro Cúbico</span>
                    <Badge variant="outline" className="border-teal-300 text-teal-800 text-[10px]">
                      m³
                    </Badge>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={converterM3}
                    onChange={(e) => handleConverterM3Change(e.target.value)}
                    placeholder="1"
                    className="mt-1 font-mono font-bold text-gray-900 bg-white border-teal-300 text-sm"
                  />
                </div>

                {/* Tonelada */}
                <div>
                  <Label className="text-xs font-semibold text-teal-950 flex items-center justify-between">
                    <span>Massa em Toneladas</span>
                    <Badge variant="outline" className="border-teal-300 text-teal-800 text-[10px]">
                      t
                    </Badge>
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={converterTon}
                    onChange={(e) => handleConverterTonChange(e.target.value)}
                    placeholder="1.5"
                    className="mt-1 font-mono font-bold text-teal-900 bg-white border-teal-300 text-sm"
                  />
                </div>
              </div>

              {/* Resultado descritivo */}
              <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between text-xs text-teal-900">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-700" />
                  <span>
                    Fator: <strong>1 m³ = {formatarNumeroBR(converterDensidade, 3)} t</strong>
                  </span>
                </span>
                <span className="text-gray-600">
                  (1 t ={' '}
                  {converterDensidade > 0 ? formatarNumeroBR(1 / converterDensidade, 3) : '0'} m³)
                </span>
              </div>
            </div>

            {/* Tabela de referência rápida de caçambas */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-gray-700 block mb-1.5">
                Cargas típicas de caminhões basculantes (com densidade{' '}
                {formatarNumeroBR(converterDensidade)} t/m³):
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Toco (6 m³)</span>
                  <span className="font-bold text-gray-900">
                    {formatarNumeroBR(6 * converterDensidade, 1)} t
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Truck (12 m³)</span>
                  <span className="font-bold text-gray-900">
                    {formatarNumeroBR(12 * converterDensidade, 1)} t
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Carreta (25 m³)</span>
                  <span className="font-bold text-gray-900">
                    {formatarNumeroBR(25 * converterDensidade, 1)} t
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
