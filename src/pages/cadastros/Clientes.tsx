import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, getInitials } from '@/lib/formatters'
import type { Cliente, ContaReceber, CreditoCliente } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Building,
  Edit2,
  Trash2,
  Eye,
  ArrowUpRight,
} from 'lucide-react'

export default function Clientes() {
  const { currentEmpresa, canEdit, isAdmin } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])
  const [creditos, setCreditos] = useState<CreditoCliente[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Modal Lançar Crédito Manual
  const [creditoModalOpen, setCreditoModalOpen] = useState(false)
  const [creditoClienteId, setCreditoClienteId] = useState<string | null>(null)
  const [creditoValor, setCreditoValor] = useState<number>(0)
  const [creditoDescricao, setCreditoDescricao] = useState('')
  const [creditoOrigem, setCreditoOrigem] = useState('Depósito Identificado / Adiantamento')
  const [isSavingCredito, setIsSavingCredito] = useState(false)

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
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  useRealtime('clientes', () => loadClientes())
  useRealtime('creditos_clientes', () => loadClientes())

  const loadClientes = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [cList, crList, credList] = await Promise.all([
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}' && status != 'Recebida'`,
        }),
        pb.collection('creditos_clientes').getFullList<CreditoCliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: '-created',
        }),
      ])

      setClientes(cList)
      setContasReceber(crList)
      setCreditos(credList)

      const qId = searchParams.get('id')
      if (qId) {
        const found = cList.find((c) => c.id === qId)
        if (found) setSelectedCliente(found)
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
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

  const handleEdit = (c: Cliente, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingId(c.id)
    setNome(c.nome)
    setCnpjCpf(c.cnpj_cpf || '')
    setEmail(c.email || '')
    setTelefone(c.telefone || '')
    setEndereco(c.endereco || '')
    setCidade(c.cidade || '')
    setUf(c.uf || '')
    setCep(c.cep || '')
    setObservacoes(c.observacoes || '')
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
        await pb.collection('clientes').update(editingId, payload)
        toast({ title: 'Cliente atualizado com sucesso!' })
      } else {
        await pb.collection('clientes').create(payload)
        toast({ title: 'Cliente cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar cliente', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Deseja realmente remover este cliente?')) return
    try {
      await pb.collection('clientes').delete(id)
      toast({ title: 'Cliente removido com sucesso.' })
      if (selectedCliente?.id === id) setSelectedCliente(null)
      await loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Compute em aberto e créditos per cliente
  const openByCliente = useMemo(() => {
    const map: Record<string, number> = {}
    contasReceber.forEach((cr) => {
      if (cr.cliente_id && cr.status !== 'Recebimento Antecipado') {
        map[cr.cliente_id] = (map[cr.cliente_id] || 0) + (cr.valor || 0)
      }
    })
    return map
  }, [contasReceber])

  const creditosByCliente = useMemo(() => {
    const map: Record<string, { total: number; saldoDisponivel: number; itens: CreditoCliente[] }> =
      {}
    creditos.forEach((cr) => {
      if (!map[cr.cliente_id]) {
        map[cr.cliente_id] = { total: 0, saldoDisponivel: 0, itens: [] }
      }
      map[cr.cliente_id].total += cr.valor || 0
      map[cr.cliente_id].saldoDisponivel += cr.saldo_restante || 0
      map[cr.cliente_id].itens.push(cr)
    })
    return map
  }, [creditos])

  const handleOpenAddCredito = (clienteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setCreditoClienteId(clienteId)
    setCreditoValor(0)
    setCreditoDescricao('')
    setCreditoOrigem('Depósito identificado sem nota / Adiantamento')
    setCreditoModalOpen(true)
  }

  const handleSaveCredito = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditoClienteId || creditoValor <= 0) {
      toast({ title: 'Informe um valor válido de crédito', variant: 'destructive' })
      return
    }

    try {
      setIsSavingCredito(true)
      await pb.collection('creditos_clientes').create({
        empresa_id: currentEmpresa!.id,
        cliente_id: creditoClienteId,
        valor: Number(creditoValor),
        saldo_restante: Number(creditoValor),
        origem: creditoOrigem.trim(),
        descricao: creditoDescricao.trim() || 'Crédito lançado manualmente',
        data: new Date().toISOString(),
        status: 'disponivel',
      })

      toast({ title: 'Crédito adicionado ao cliente com sucesso!' })
      setCreditoModalOpen(false)
      await loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao lançar crédito', description: err.message, variant: 'destructive' })
    } finally {
      setIsSavingCredito(false)
    }
  }

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      const q = searchQuery.toLowerCase()
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.cnpj_cpf && c.cnpj_cpf.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    })
  }, [clientes, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Clientes</h1>
          <p className="text-xs text-gray-500">
            Base cadastral de clientes, histórico e recebíveis
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Cliente
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
        {filteredClientes.map((c) => {
          const valorAberto = openByCliente[c.id] || 0
          const credInfo = creditosByCliente[c.id]
          const saldoCredito = credInfo?.saldoDisponivel || 0

          return (
            <Card
              key={c.id}
              onClick={() => setSelectedCliente(c)}
              className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(c.nome)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{c.nome}</h3>
                      <p className="text-[11px] text-gray-400 font-mono">
                        {c.cnpj_cpf || 'Documento não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500 pt-1">
                  {c.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.telefone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{c.telefone}</span>
                    </div>
                  )}
                  {c.cidade && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {c.cidade}
                        {c.uf ? `/${c.uf}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#ECEAE4] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                      Em Aberto
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        valorAberto > 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}
                    >
                      {formatCurrency(valorAberto)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold block">
                      Crédito Disponível
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        saldoCredito > 0 ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    >
                      {formatCurrency(saldoCredito)}
                    </span>
                  </div>
                </div>

                <div
                  className="pt-2 flex items-center justify-between border-t border-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleOpenAddCredito(c.id, e)}
                      className="h-7 text-[11px] border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-lg"
                    >
                      + Lançar Crédito
                    </Button>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleEdit(c, e)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDelete(c.id, e)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}

        {filteredClientes.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs bg-white rounded-2xl border border-[#ECEAE4]">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Cliente' : 'Novo Cliente'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome / Razão Social *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Comercial Souza Ltda"
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
                <Label className="text-xs font-semibold text-gray-700">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Email Comercial</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Endereço Completo</Label>
              <Input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, complemento, bairro"
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
                placeholder="Condições especiais, termos acordados, etc..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail Drawer with Accounts Receivable */}
      <Sheet open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <SheetContent className="sm:max-w-[520px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700" />
              {selectedCliente?.nome}
            </SheetTitle>
          </SheetHeader>

          {selectedCliente && (
            <div className="py-4 space-y-5 text-xs">
              <div className="p-4 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Documento:</span>
                  <span className="font-mono font-medium">
                    {selectedCliente.cnpj_cpf || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">E-mail:</span>
                  <span className="text-gray-800">{selectedCliente.email || 'Não informado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Telefone:</span>
                  <span className="text-gray-800">
                    {selectedCliente.telefone || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Endereço:</span>
                  <span className="text-gray-800 text-right">
                    {selectedCliente.endereco
                      ? `${selectedCliente.endereco}, ${selectedCliente.cidade || ''} - ${selectedCliente.uf || ''}`
                      : 'Não informado'}
                  </span>
                </div>
              </div>

              {/* Seção de Créditos do Cliente */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                    >
                      Saldo de Crédito:{' '}
                      {formatCurrency(creditosByCliente[selectedCliente.id]?.saldoDisponivel || 0)}
                    </Badge>
                  </h4>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAddCredito(selectedCliente.id)}
                      className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      + Novo Crédito
                    </Button>
                  )}
                </div>

                {!creditosByCliente[selectedCliente.id] ||
                creditosByCliente[selectedCliente.id].itens.length === 0 ? (
                  <p className="text-gray-400 py-2 text-xs">
                    Nenhum crédito ou adiantamento registrado para este cliente.
                  </p>
                ) : (
                  <div className="space-y-1.5 mb-4">
                    {creditosByCliente[selectedCliente.id].itens.map((cred) => (
                      <div
                        key={cred.id}
                        className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-semibold text-emerald-950">{cred.origem}</div>
                          <div className="text-[11px] text-gray-500">
                            {cred.descricao || 'Adiantamento'} • {formatDate(cred.data)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-800 tabular-nums">
                            Saldo: {formatCurrency(cred.saldo_restante)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Original: {formatCurrency(cred.valor)} ({cred.status})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  Contas a Receber deste Cliente
                </h4>
                {contasReceber.filter((cr) => cr.cliente_id === selectedCliente.id).length === 0 ? (
                  <p className="text-gray-400 py-4 text-center">
                    Nenhum título em aberto no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {contasReceber
                      .filter((cr) => cr.cliente_id === selectedCliente.id)
                      .map((cr) => (
                        <div
                          key={cr.id}
                          className="p-3 rounded-xl border border-[#ECEAE4] bg-white flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold text-gray-800">{cr.descricao}</div>
                            <div className="text-[11px] text-gray-400">
                              Vencimento: {formatDate(cr.vencimento)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-teal-700 tabular-nums">
                              {formatCurrency(cr.valor)}
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {cr.status}
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

      {/* Modal Lançar Crédito Manual */}
      <Sheet open={creditoModalOpen} onOpenChange={setCreditoModalOpen}>
        <SheetContent className="sm:max-w-[440px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Lançar Crédito / Adiantamento
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSaveCredito} className="space-y-4 py-4 text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 leading-relaxed">
              Registra um saldo de crédito para o cliente (ex.: depósito bancário antecipado
              identificado, devolução, bônus ou pagamento antecipado sem nota fiscal prévia). Esse
              saldo poderá ser utilizado para quitar total ou parcialmente contas a receber futuras.
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Valor do Crédito (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                required
                min="0.01"
                value={creditoValor || ''}
                onChange={(e) => setCreditoValor(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="mt-1 font-mono text-base font-bold text-emerald-800"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Origem do Crédito *</Label>
              <Input
                required
                value={creditoOrigem}
                onChange={(e) => setCreditoOrigem(e.target.value)}
                placeholder="Ex: Depósito Pix identificado / Adiantamento de Carga"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição / Referência</Label>
              <Textarea
                rows={3}
                value={creditoDescricao}
                onChange={(e) => setCreditoDescricao(e.target.value)}
                placeholder="Ex: Comprovante de transferência banco Bradesco ref. futuros pedidos de brita..."
                className="mt-1"
              />
            </div>

            <SheetFooter className="pt-4 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setCreditoModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingCredito}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {isSavingCredito ? 'Gravando...' : 'Confirmar Crédito'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
