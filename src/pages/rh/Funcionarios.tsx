import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Funcionario, SetorFuncionario, StatusFuncionario, PlanoConta } from '@/types/erp'
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
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
  UserCheck,
} from 'lucide-react'

const SETOR_COLORS: Record<SetorFuncionario, { bg: string; text: string; border: string }> = {
  Britagem: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  Concreto: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Lokotrack: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Frota: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  Administrativo: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' },
  Outro: { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
}

export default function Funcionarios() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [setorFilter, setSetorFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cargo, setCargo] = useState('')
  const [setor, setSetor] = useState<SetorFuncionario>('Britagem')
  const [dataAdmissao, setDataAdmissao] = useState(() => new Date().toISOString().slice(0, 10))
  const [salario, setSalario] = useState<number>(0)
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<StatusFuncionario>('ativo')
  const [chavePix, setChavePix] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Gerar Conta a Pagar (Folha/Salário)
  const [gerarContaModalOpen, setGerarContaModalOpen] = useState(false)
  const [selectedFuncionarioParaFolha, setSelectedFuncionarioParaFolha] =
    useState<Funcionario | null>(null)
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [vencimentoFolha, setVencimentoFolha] = useState(() => {
    const d = new Date()
    // 5º dia útil do mês seguinte normalmente
    d.setDate(5)
    return d.toISOString().slice(0, 10)
  })
  const [valorFolha, setValorFolha] = useState<number>(0)
  const [gerandoFolha, setGerandoFolha] = useState(false)

  useRealtime('funcionarios', () => loadFuncionarios())

  const loadFuncionarios = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [fList, pList] = await Promise.all([
        pb.collection('funcionarios').getFullList<Funcionario>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])
      setFuncionarios(fList)
      setPlanoContas(pList)
    } catch (err) {
      console.error('Error fetching funcionarios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFuncionarios()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setNome('')
    setCpf('')
    setCargo('')
    setSetor('Britagem')
    setDataAdmissao(new Date().toISOString().slice(0, 10))
    setSalario(0)
    setTelefone('')
    setEmail('')
    setStatus('ativo')
    setChavePix('')
    setBancoConta('')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (f: Funcionario) => {
    setEditingId(f.id)
    setNome(f.nome)
    setCpf(f.cpf || '')
    setCargo(f.cargo)
    setSetor(f.setor)
    setDataAdmissao(f.data_admissao ? f.data_admissao.slice(0, 10) : '')
    setSalario(f.salario || 0)
    setTelefone(f.telefone || '')
    setEmail(f.email || '')
    setStatus(f.status)
    setChavePix(f.chave_pix || '')
    setBancoConta(f.banco_conta || '')
    setObservacoes(f.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !cargo.trim()) {
      toast({ title: 'Preencha o nome completo e o cargo', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        cargo: cargo.trim(),
        setor,
        data_admissao: dataAdmissao ? new Date(dataAdmissao).toISOString() : null,
        salario: Number(salario) || 0,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        status,
        chave_pix: chavePix.trim() || null,
        banco_conta: bancoConta.trim() || null,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('funcionarios').update(editingId, payload)
        toast({ title: 'Colaborador atualizado com sucesso!' })
      } else {
        await pb.collection('funcionarios').create(payload)
        toast({ title: 'Colaborador cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadFuncionarios()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar colaborador',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, nomeFunc: string) => {
    if (!confirm(`Deseja realmente remover o cadastro de ${nomeFunc}?`)) return
    try {
      await pb.collection('funcionarios').delete(id)
      toast({ title: 'Colaborador excluído com sucesso.' })
      await loadFuncionarios()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Abertura do modal de geração de salário a pagar
  const handleOpenGerarFolha = (f: Funcionario) => {
    setSelectedFuncionarioParaFolha(f)
    setValorFolha(f.salario || 0)
    setGerarContaModalOpen(true)
  }

  const handleConfirmarGeracaoFolha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFuncionarioParaFolha || valorFolha <= 0) {
      toast({ title: 'Informe um valor de salário válido', variant: 'destructive' })
      return
    }

    try {
      setGerandoFolha(true)

      // Categoria de folha de pagamento no plano de contas
      const catFolha =
        planoContas.find((pc) => pc.nome.toLowerCase().includes('salário')) ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('pessoal')) ||
        planoContas.find((pc) => pc.codigo === '2.1') ||
        planoContas[0] ||
        null

      const payloadConta = {
        empresa_id: currentEmpresa!.id,
        descricao: `Salário / Folha: ${selectedFuncionarioParaFolha.nome} (${mesReferencia})`,
        categoria_id: catFolha?.id || null,
        valor: Number(valorFolha),
        vencimento: new Date(vencimentoFolha).toISOString(),
        parcelas: 1,
        status: 'Aberta',
        observacoes: `Colaborador: ${selectedFuncionarioParaFolha.nome} | Cargo: ${selectedFuncionarioParaFolha.cargo} | Setor: ${selectedFuncionarioParaFolha.setor}. Chave PIX: ${selectedFuncionarioParaFolha.chave_pix || 'Não cadastrada'}`,
      }

      await pb.collection('contas_pagar').create(payloadConta)

      toast({
        title: 'Conta a Pagar de Folha gerada com sucesso!',
        description: `Lançado no módulo financeiro no valor de ${formatCurrency(valorFolha)}.`,
      })
      setGerarContaModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar conta de folha',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setGerandoFolha(false)
    }
  }

  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((f) => {
      if (setorFilter !== 'todos' && f.setor !== setorFilter) return false
      if (statusFilter !== 'todos' && f.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const n = f.nome.toLowerCase()
        const c = f.cargo.toLowerCase()
        const doc = (f.cpf || '').toLowerCase()
        return n.includes(q) || c.includes(q) || doc.includes(q)
      }
      return true
    })
  }, [funcionarios, setorFilter, statusFilter, searchQuery])

  // KPIs
  const totalAtivos = funcionarios.filter((f) => f.status === 'ativo').length
  const totalFolhaMensal = funcionarios
    .filter((f) => f.status === 'ativo')
    .reduce((acc, f) => acc + (f.salario || 0), 0)
  const totalSetorBritagem = funcionarios.filter((f) => f.setor === 'Britagem').length
  const totalSetorConcreto = funcionarios.filter((f) => f.setor === 'Concreto').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Recursos Humanos & Colaboradores
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">Equipe Operacional</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de funcionários da pedreira, operadores de máquinas pesadas, motoristas e folha
            salarial
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Colaborador
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Equipe Ativa</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{totalAtivos}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Colaboradores ativos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Folha Mensal Base</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-900 mt-2 font-mono tabular-nums">
            {formatCurrency(totalFolhaMensal)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Soma salários equipe ativa</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Britagem & Lavra</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalSetorBritagem}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Operadores e técnicos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Usinas de Concreto
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalSetorConcreto}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Encarregados e dosadores</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Setor / Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Setores</SelectItem>
                <SelectItem value="Britagem">Britagem</SelectItem>
                <SelectItem value="Concreto">Concreto</SelectItem>
                <SelectItem value="Lokotrack">Lokotrack</SelectItem>
                <SelectItem value="Frota">Frota</SelectItem>
                <SelectItem value="Administrativo">Administrativo</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
                <SelectItem value="demitido">Demitido</SelectItem>
              </SelectContent>
            </Select>

            {(setorFilter !== 'todos' || statusFilter !== 'todos' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSetorFilter('todos')
                  setStatusFilter('todos')
                  setSearchQuery('')
                }}
                className="h-9 text-xs text-gray-500"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar colaborador, cargo, CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>
      </Card>

      {/* Table of Employees */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4">Nome do Colaborador</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4">CPF / Contato</th>
                <th className="py-3 px-4">Admissão</th>
                <th className="py-3 px-4 text-right">Salário Base</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações & Folha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredFuncionarios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Nenhum colaborador encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredFuncionarios.map((f) => {
                  const sColor = SETOR_COLORS[f.setor] || SETOR_COLORS.Outro
                  return (
                    <tr key={f.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{f.nome}</div>
                        {f.chave_pix && (
                          <div className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                            PIX: {f.chave_pix}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700">{f.cargo}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${sColor.bg} ${sColor.text} ${sColor.border}`}
                        >
                          {f.setor}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-gray-700">{f.cpf || '—'}</div>
                        {f.telefone && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{f.telefone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">
                        {f.data_admissao ? formatDate(f.data_admissao) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 tabular-nums">
                        {f.salario ? formatCurrency(f.salario) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            f.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : f.status === 'ferias'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : f.status === 'afastado'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {f.status === 'ativo'
                            ? '● Ativo'
                            : f.status === 'ferias'
                              ? '● Férias'
                              : f.status === 'afastado'
                                ? '● Afastado'
                                : '● Demitido'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenGerarFolha(f)}
                              className="h-7 px-2 text-[11px] text-teal-800 border-teal-200 hover:bg-teal-50"
                              title="Lançar Salário / Conta a Pagar"
                            >
                              <Receipt className="w-3 h-3 mr-1" />
                              Lançar Salário
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(f)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(f.id, f.nome)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Excluir"
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
        <SheetContent className="sm:max-w-[520px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Sebastião Antunes"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">CPF</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Cargo / Função *</Label>
                <Input
                  required
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Operador de Escavadeira"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Setor / Área *</Label>
                <Select value={setor} onValueChange={(v: SetorFuncionario) => setSetor(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Britagem">Central Britagem</SelectItem>
                    <SelectItem value="Concreto">Central Concreto</SelectItem>
                    <SelectItem value="Lokotrack">Britagem Lokotrack</SelectItem>
                    <SelectItem value="Frota">Frota & Transporte</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status</Label>
                <Select value={status} onValueChange={(v: StatusFuncionario) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="demitido">Demitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Data de Admissão</Label>
                <Input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Salário Base Mensal (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salario || ''}
                  onChange={(e) => setSalario(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-teal-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(83) 98899-0000"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@gcpedreira.com.br"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Chave PIX</Label>
                <Input
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, email ou telefone"
                  className="mt-1 bg-white font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Conta Bancária</Label>
                <Input
                  value={bancoConta}
                  onChange={(e) => setBancoConta(e.target.value)}
                  placeholder="Banco, agência e conta"
                  className="mt-1 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Observações / Informações Complementares
              </Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: CNH categoria E, cursos NR-12, NR-11, histórico..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Colaborador'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal Gerar Folha a Pagar */}
      <Sheet open={gerarContaModalOpen} onOpenChange={setGerarContaModalOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Lançar Folha / Salário a Pagar
            </SheetTitle>
          </SheetHeader>

          {selectedFuncionarioParaFolha && (
            <form onSubmit={handleConfirmarGeracaoFolha} className="space-y-4 py-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-[#ECEAE4]">
                <div className="font-semibold text-gray-900 text-sm">
                  {selectedFuncionarioParaFolha.nome}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedFuncionarioParaFolha.cargo} • {selectedFuncionarioParaFolha.setor}
                </div>
                {selectedFuncionarioParaFolha.chave_pix && (
                  <div className="text-[11px] text-teal-700 font-mono mt-1">
                    PIX: {selectedFuncionarioParaFolha.chave_pix}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Mês de Referência *</Label>
                <Input
                  required
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  placeholder="Ex: 2026-09 ou Setembro/2026"
                  className="mt-1 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Vencimento *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={vencimentoFolha}
                    onChange={(e) => setVencimentoFolha(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Valor do Salário *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={valorFolha || ''}
                    onChange={(e) => setValorFolha(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="mt-1 font-mono font-bold text-red-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                Esta ação gerará uma nova <strong>Conta a Pagar</strong> no módulo financeiro,
                permitindo acompanhar a liquidação, baixa bancária e histórico de pagamentos do
                colaborador.
              </div>

              <SheetFooter className="pt-4 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setGerarContaModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={gerandoFolha}
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                >
                  {gerandoFolha ? 'Gerando...' : 'Confirmar Lançamento'}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
