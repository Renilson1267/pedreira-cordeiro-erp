import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, getInitials } from '@/lib/formatters'
import type { Fornecedor, ContaPagar } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  Truck,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  ArrowDownLeft,
} from 'lucide-react'

export default function Fornecedores() {
  const { currentEmpresa, canEdit } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [cep, setCep] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detail Drawer State
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null)

  useRealtime('fornecedores', () => loadFornecedores())

  const loadFornecedores = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [fList, cpList] = await Promise.all([
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('contas_pagar').getFullList<ContaPagar>({
          filter: `empresa_id = '${currentEmpresa.id}' && status != 'Paga'`,
        }),
      ])

      setFornecedores(fList)
      setContasPagar(cpList)

      const qId = searchParams.get('id')
      if (qId) {
        const found = fList.find((f) => f.id === qId)
        if (found) setSelectedFornecedor(found)
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFornecedores()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setNome('')
    setCnpjCpf('')
    setEmail('')
    setTelefone('')
    setEndereco('')
    setCidade('')
    setUf('')
    setCep('')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (f: Fornecedor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingId(f.id)
    setNome(f.nome)
    setCnpjCpf(f.cnpj_cpf || '')
    setEmail(f.email || '')
    setTelefone(f.telefone || '')
    setEndereco(f.endereco || '')
    setCidade(f.cidade || '')
    setUf(f.uf || '')
    setCep(f.cep || '')
    setObservacoes(f.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({ title: 'Informe o nome ou razão social', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        nome: nome.trim(),
        cnpj_cpf: cnpjCpf.trim() || undefined,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        endereco: endereco.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim() || undefined,
        cep: cep.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      }

      if (editingId) {
        await pb.collection('fornecedores').update(editingId, payload)
        toast({ title: 'Fornecedor atualizado com sucesso!' })
      } else {
        await pb.collection('fornecedores').create(payload)
        toast({ title: 'Fornecedor cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadFornecedores()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar fornecedor',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Deseja realmente remover este fornecedor?')) return
    try {
      await pb.collection('fornecedores').delete(id)
      toast({ title: 'Fornecedor removido com sucesso.' })
      if (selectedFornecedor?.id === id) setSelectedFornecedor(null)
      await loadFornecedores()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Compute em aberto per fornecedor
  const openByFornecedor = useMemo(() => {
    const map: Record<string, number> = {}
    contasPagar.forEach((cp) => {
      if (cp.fornecedor_id) {
        map[cp.fornecedor_id] = (map[cp.fornecedor_id] || 0) + (cp.valor || 0)
      }
    })
    return map
  }, [contasPagar])

  const filteredFornecedores = useMemo(() => {
    return fornecedores.filter((f) => {
      const q = searchQuery.toLowerCase()
      return (
        f.nome.toLowerCase().includes(q) ||
        (f.cnpj_cpf && f.cnpj_cpf.includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q))
      )
    })
  }, [fornecedores, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Fornecedores</h1>
          <p className="text-xs text-gray-500">
            Gestão de parceiros, fornecedores e contas a pagar
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Fornecedor
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <Input
          placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white border-[#ECEAE4] text-xs h-10 rounded-xl"
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFornecedores.map((f) => {
          const valorAberto = openByFornecedor[f.id] || 0
          return (
            <Card
              key={f.id}
              onClick={() => setSelectedFornecedor(f)}
              className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(f.nome)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{f.nome}</h3>
                      <p className="text-[11px] text-gray-400 font-mono">
                        {f.cnpj_cpf || 'Documento não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500 pt-1">
                  {f.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{f.email}</span>
                    </div>
                  )}
                  {f.telefone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{f.telefone}</span>
                    </div>
                  )}
                  {f.cidade && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {f.cidade}
                        {f.uf ? `/${f.uf}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#ECEAE4] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                    A Pagar em Aberto
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      valorAberto > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}
                  >
                    {formatCurrency(valorAberto)}
                  </span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleEdit(f, e)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDelete(f.id, e)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}

        {filteredFornecedores.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs bg-white rounded-2xl border border-[#ECEAE4]">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Razão Social / Nome *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Companhia de Energia Elétrica S/A"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">CNPJ / CPF</Label>
                <Input
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telefone</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 4004-0000"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Email Financeiro / Contato
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="faturamento@fornecedor.com.br"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Endereço Completo</Label>
              <Input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Avenida Comercial, 500"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Cidade</Label>
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">UF</Label>
                <Input
                  value={uf}
                  maxLength={2}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="mt-1 uppercase text-center"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">CEP</Label>
              <Input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações Gerais</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Dados bancários para pagamento, chave Pix, contrato..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Fornecedor'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail Drawer with Accounts Payable */}
      <Sheet
        open={!!selectedFornecedor}
        onOpenChange={(open) => !open && setSelectedFornecedor(null)}
      >
        <SheetContent className="sm:max-w-[520px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-700" />
              {selectedFornecedor?.nome}
            </SheetTitle>
          </SheetHeader>

          {selectedFornecedor && (
            <div className="py-4 space-y-5 text-xs">
              <div className="p-4 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Documento:</span>
                  <span className="font-mono font-medium">
                    {selectedFornecedor.cnpj_cpf || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">E-mail:</span>
                  <span className="text-gray-800">
                    {selectedFornecedor.email || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Telefone:</span>
                  <span className="text-gray-800">
                    {selectedFornecedor.telefone || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Endereço:</span>
                  <span className="text-gray-800 text-right">
                    {selectedFornecedor.endereco
                      ? `${selectedFornecedor.endereco}, ${selectedFornecedor.cidade || ''} - ${selectedFornecedor.uf || ''}`
                      : 'Não informado'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-red-600" />
                  Contas a Pagar para este Fornecedor
                </h4>

                {contasPagar.filter((cp) => cp.fornecedor_id === selectedFornecedor.id).length ===
                0 ? (
                  <p className="text-gray-400 py-4 text-center">
                    Nenhum título em aberto no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {contasPagar
                      .filter((cp) => cp.fornecedor_id === selectedFornecedor.id)
                      .map((cp) => (
                        <div
                          key={cp.id}
                          className="p-3 rounded-xl border border-[#ECEAE4] bg-white flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold text-gray-800">{cp.descricao}</div>
                            <div className="text-[11px] text-gray-400">
                              Vencimento: {formatDate(cp.vencimento)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600 tabular-nums">
                              {formatCurrency(cp.valor)}
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {cp.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
