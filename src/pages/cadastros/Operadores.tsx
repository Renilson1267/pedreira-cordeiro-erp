import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { operadoresService, OperadorItem } from '@/services/operadores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { formatDate, formatDateTime, getInitials } from '@/lib/formatters'
import type { UserRole } from '@/types/erp'
import {
  UserCheck,
  UserX,
  KeyRound,
  Edit2,
  UserPlus,
  ShieldAlert,
  Search,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Lock,
  Building,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function Operadores() {
  const { user } = useAuth()
  const { isAdmin, empresas, currentEmpresa } = useCompany()

  const [operadores, setOperadores] = useState<OperadorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroRole, setFiltroRole] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modais de Criação e Edição
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [operadorEditando, setOperadorEditando] = useState<OperadorItem | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Formulário de Criação
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoRole, setNovoRole] = useState<UserRole>('financeiro')
  const [novaEmpresaId, setNovaEmpresaId] = useState<string>('')
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)

  // Formulário de Edição
  const [editNome, setEditNome] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('leitura')
  const [editEmpresaId, setEditEmpresaId] = useState('')

  // Modal de Confirmação de Ação (Ativar / Desativar)
  const [alertAtivacaoOpen, setAlertAtivacaoOpen] = useState(false)
  const [operadorAlvoAtivacao, setOperadorAlvoAtivacao] = useState<OperadorItem | null>(null)

  // Modal de Senha Temporária
  const [modalSenhaTempOpen, setModalSenhaTempOpen] = useState(false)
  const [senhaTemporariaGerada, setSenhaTemporariaGerada] = useState<{
    senha: string
    nome: string
    email: string
  } | null>(null)
  const [redefinindoSenha, setRedefinindoSenha] = useState(false)
  const [alvoRedefinicao, setAlvoRedefinicao] = useState<OperadorItem | null>(null)
  const [alertRedefinirOpen, setAlertRedefinirOpen] = useState(false)

  const carregarOperadores = useCallback(async () => {
    try {
      setLoading(true)
      const lista = await operadoresService.listar()
      setOperadores(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar operadores',
        description: err.message || 'Verifique suas permissões de administrador.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      carregarOperadores()
    }
  }, [isAdmin, carregarOperadores])

  // Filtragem
  const operadoresFiltrados = useMemo(() => {
    return operadores.filter((op) => {
      const matchSearch =
        op.name.toLowerCase().includes(search.toLowerCase()) ||
        op.email.toLowerCase().includes(search.toLowerCase()) ||
        (op.empresa_nome && op.empresa_nome.toLowerCase().includes(search.toLowerCase()))

      const matchRole = filtroRole === 'todos' || op.role === filtroRole
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativo' && op.ativo) ||
        (filtroStatus === 'inativo' && !op.ativo)

      return matchSearch && matchRole && matchStatus
    })
  }, [operadores, search, filtroRole, filtroStatus])

  // Se não for admin, exibe tela de bloqueio com mensagem clara
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Acesso Restrito ao Administrador</h2>
        <p className="text-sm text-gray-500 max-w-md mt-2">
          Apenas usuários com o papel de Administrador têm autorização para gerenciar e cadastrar
          operadores do sistema.
        </p>
      </div>
    )
  }

  // Submissão do novo operador
  const handleCriarOperador = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    if (novaSenha.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha inicial deve ter pelo menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      await operadoresService.criar({
        name: novoNome.trim(),
        email: novoEmail.trim(),
        password: novaSenha.trim(),
        role: novoRole,
        empresa_id: novaEmpresaId || currentEmpresa?.id,
      })

      toast({
        title: 'Operador cadastrado com sucesso!',
        description: `O colaborador ${novoNome} já pode acessar o sistema com o email cadastrado.`,
      })

      // Reset
      setNovoNome('')
      setNovoEmail('')
      setNovaSenha('')
      setNovoRole('financeiro')
      setNovaEmpresaId('')
      setModalCriarOpen(false)
      carregarOperadores()
    } catch (err: any) {
      toast({
        title: 'Falha ao cadastrar operador',
        description: err.message || 'Verifique se o email já está em uso.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Iniciar edição
  const abrirEdicao = (op: OperadorItem) => {
    setOperadorEditando(op)
    setEditNome(op.name)
    setEditRole(op.role)
    setEditEmpresaId(op.empresa_padrao_id || op.empresa_id || '')
    setModalEditarOpen(true)
  }

  // Salvar edição
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!operadorEditando) return

    // Proteção: não se auto-rebaixar
    if (operadorEditando.id === user?.id && editRole !== 'admin') {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode rebaixar seu próprio papel de administrador.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      await operadoresService.atualizar({
        id: operadorEditando.id,
        name: editNome.trim(),
        role: editRole,
        empresa_id: editEmpresaId,
        empresa_padrao_id: editEmpresaId,
      })

      toast({
        title: 'Operador atualizado com sucesso!',
        description: 'As alterações de papel, nome e empresa padrão foram salvas.',
      })
      setModalEditarOpen(false)
      carregarOperadores()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar operador',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Alternar status (Ativar / Desativar com confirmação)
  const confirmarAlternarStatus = (op: OperadorItem) => {
    if (op.id === user?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode desativar seu próprio acesso.',
        variant: 'destructive',
      })
      return
    }
    setOperadorAlvoAtivacao(op)
    setAlertAtivacaoOpen(true)
  }

  const executarAlternarStatus = async () => {
    if (!operadorAlvoAtivacao) return
    const novoStatus = !operadorAlvoAtivacao.ativo

    try {
      await operadoresService.atualizar({
        id: operadorAlvoAtivacao.id,
        ativo: novoStatus,
      })

      toast({
        title: novoStatus ? 'Operador ativado!' : 'Operador desativado!',
        description: novoStatus
          ? `O operador ${operadorAlvoAtivacao.name} agora pode acessar o sistema.`
          : `O acesso do operador ${operadorAlvoAtivacao.name} foi suspenso com segurança.`,
      })
      carregarOperadores()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setAlertAtivacaoOpen(false)
      setOperadorAlvoAtivacao(null)
    }
  }

  // Redefinir senha temporária com confirmação
  const confirmarRedefinicaoSenha = (op: OperadorItem) => {
    setAlvoRedefinicao(op)
    setAlertRedefinirOpen(true)
  }

  const executarRedefinicaoSenha = async () => {
    if (!alvoRedefinicao) return
    try {
      setRedefinindoSenha(true)
      const res = await operadoresService.redefinirSenha(alvoRedefinicao.id)
      setSenhaTemporariaGerada({
        senha: res.tempPassword,
        nome: res.name || alvoRedefinicao.name,
        email: res.email || alvoRedefinicao.email,
      })
      setAlertRedefinirOpen(false)
      setModalSenhaTempOpen(true)
      toast({
        title: 'Senha temporária gerada!',
        description: 'Copie e envie ao operador com segurança.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao redefinir senha',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setRedefinindoSenha(false)
    }
  }

  const copiarSenha = () => {
    if (!senhaTemporariaGerada) return
    navigator.clipboard.writeText(senhaTemporariaGerada.senha)
    toast({
      title: 'Senha copiada para a área de transferência!',
    })
  }

  const badgePapel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold hover:bg-amber-100">
            Administrador
          </Badge>
        )
      case 'financeiro':
        return (
          <Badge className="bg-teal-100 text-teal-900 border-teal-300 font-semibold hover:bg-teal-100">
            Financeiro
          </Badge>
        )
      case 'leitura':
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-300 font-medium hover:bg-gray-100">
            Somente Leitura
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#ECEAE4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Cadastro de Operadores
            </h1>
            <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-xs">
              Gestão de Usuários
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle de acessos, colaboradores e permissões (Administrador, Financeiro ou Leitura)
            do ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarOperadores}
            disabled={loading}
            className="border-[#ECEAE4] text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => setModalCriarOpen(true)}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Novo Operador
          </Button>
        </div>
      </div>

      {/* Filtros e Busca */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar operador por nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#FAF9F7] border-[#ECEAE4]"
            />
          </div>

          <div>
            <Select value={filtroRole} onValueChange={setFiltroRole}>
              <SelectTrigger className="h-9 text-xs bg-[#FAF9F7] border-[#ECEAE4]">
                <SelectValue placeholder="Filtrar por Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Papéis</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="leitura">Somente Leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 text-xs bg-[#FAF9F7] border-[#ECEAE4]">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="ativo">Apenas Ativos</SelectItem>
                <SelectItem value="inativo">Apenas Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabela de Operadores */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-6">Operador</th>
                <th className="py-3 px-4">Papel de Acesso</th>
                <th className="py-3 px-4">Empresa Padrão</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Data de Cadastro</th>
                <th className="py-3 px-6 text-right">Ações do Administrador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                    Carregando lista de operadores...
                  </td>
                </tr>
              ) : operadoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    Nenhum operador encontrado com os critérios de busca.
                  </td>
                </tr>
              ) : (
                operadoresFiltrados.map((op) => {
                  const isCurrentUser = op.id === user?.id
                  return (
                    <tr
                      key={op.id}
                      className={`hover:bg-[#FAF9F7] transition-colors ${
                        !op.ativo ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Nome e Avatar */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                              op.ativo ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {getInitials(op.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              <span>{op.name}</span>
                              {isCurrentUser && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 border-teal-300 text-teal-700 bg-teal-50"
                                >
                                  Você
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500">{op.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Papel */}
                      <td className="py-3.5 px-4">{badgePapel(op.role)}</td>

                      {/* Empresa */}
                      <td className="py-3.5 px-4 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium truncate max-w-[200px]">
                            {op.empresa_nome || 'Grupo Pedreira Cordeiro'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {op.ativo ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Cadastro */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {formatDate(op.created)}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar operador"
                            onClick={() => abrirEdicao(op)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-teal-700 hover:bg-teal-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Redefinir Senha */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Gerar senha temporária"
                            onClick={() => confirmarRedefinicaoSenha(op)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>

                          {/* Ativar/Desativar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isCurrentUser}
                            title={
                              isCurrentUser
                                ? 'Você não pode desativar a si mesmo'
                                : op.ativo
                                  ? 'Desativar operador'
                                  : 'Ativar operador'
                            }
                            onClick={() => confirmarAlternarStatus(op)}
                            className={`h-8 w-8 p-0 ${
                              op.ativo
                                ? 'text-gray-500 hover:text-red-700 hover:bg-red-50'
                                : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {op.ativo ? (
                              <UserX className="w-3.5 h-3.5 text-red-600" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </Button>
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

      {/* MODAL: NOVO OPERADOR */}
      <Dialog open={modalCriarOpen} onOpenChange={setModalCriarOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-700" />
              Cadastrar Novo Operador
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Preencha os dados do colaborador para liberar seu acesso ao ERP Pedreira Cordeiro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarOperador} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Nome Completo do Operador *
              </Label>
              <Input
                required
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Email Corporativo *</Label>
              <Input
                required
                type="email"
                placeholder="operador@pedreiracordeiro.com.br"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Senha Inicial de Acesso *
              </Label>
              <div className="relative mt-1">
                <Input
                  required
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres (Ex: Skip@Pass2026)"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                O colaborador poderá alterar essa senha depois em seu perfil pessoal.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Papel / Nível *</Label>
                <Select value={novoRole} onValueChange={(val: UserRole) => setNovoRole(val)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financeiro">Financeiro (Edição)</SelectItem>
                    <SelectItem value="leitura">Somente Leitura</SelectItem>
                    <SelectItem value="admin">Administrador (Total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Empresa Padrão</Label>
                <Select value={novaEmpresaId} onValueChange={setNovaEmpresaId}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 flex justify-between items-center">
              <Button type="button" variant="ghost" onClick={() => setModalCriarOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {salvando ? 'Cadastrando...' : 'Cadastrar Operador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR OPERADOR */}
      <Dialog open={modalEditarOpen} onOpenChange={setModalEditarOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-teal-700" />
              Editar Operador
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Modifique o nome, papel de permissão ou empresa vinculada do operador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicao} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome do Operador *</Label>
              <Input
                required
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Email</Label>
              <Input
                disabled
                value={operadorEditando?.email || ''}
                className="mt-1 text-xs bg-gray-100 cursor-not-allowed text-gray-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                O email de login é a identidade do operador e não pode ser alterado diretamente.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Papel de Permissão *</Label>
              <Select value={editRole} onValueChange={(val: UserRole) => setEditRole(val)}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador (Acesso total + Operadores)</SelectItem>
                  <SelectItem value="financeiro">Financeiro (Lançamentos e Baixas)</SelectItem>
                  <SelectItem value="leitura">Somente Leitura (Consulta relatórios)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Empresa Padrão *</Label>
              <Select value={editEmpresaId} onValueChange={setEditEmpresaId}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione a empresa padrão..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 mt-1">
                Define a empresa inicial ao entrar no sistema e o vínculo primário do operador.
              </p>
            </div>

            <DialogFooter className="pt-4 flex justify-between items-center">
              <Button type="button" variant="ghost" onClick={() => setModalEditarOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: ATIVAR / DESATIVAR COM CONFIRMAÇÃO */}
      <AlertDialog open={alertAtivacaoOpen} onOpenChange={setAlertAtivacaoOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {operadorAlvoAtivacao?.ativo ? 'Desativar Operador?' : 'Reativar Operador?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              {operadorAlvoAtivacao?.ativo ? (
                <>
                  Ao desativar o operador{' '}
                  <strong className="text-gray-900">{operadorAlvoAtivacao?.name}</strong>, ele não
                  poderá mais entrar no sistema. Os dados históricos, lançamentos e movimentações
                  feitos por ele permanecem 100% preservados (inativação lógica).
                </>
              ) : (
                <>
                  Deseja reativar o acesso do operador{' '}
                  <strong className="text-gray-900">{operadorAlvoAtivacao?.name}</strong>? Ele
                  voltará a ter permissão de login no ERP.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executarAlternarStatus}
              className={
                operadorAlvoAtivacao?.ativo
                  ? 'bg-red-600 hover:bg-red-700 text-white text-xs'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs'
              }
            >
              {operadorAlvoAtivacao?.ativo ? 'Sim, Desativar Operador' : 'Sim, Reativar Operador'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: CONFIRMAR REDEFINIÇÃO DE SENHA */}
      <AlertDialog open={alertRedefinirOpen} onOpenChange={setAlertRedefinirOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Redefinir Senha do Operador?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              Será gerada uma nova senha temporária para{' '}
              <strong className="text-gray-900">{alvoRedefinicao?.name}</strong> (
              {alvoRedefinicao?.email}). A senha será exibida uma única vez na próxima tela para
              você copiar e repassar ao operador com segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redefinindoSenha}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executarRedefinicaoSenha}
              disabled={redefinindoSenha}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {redefinindoSenha ? 'Gerando Senha...' : 'Gerar Senha Temporária'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL: EXIBIÇÃO DA SENHA TEMPORÁRIA GERADA */}
      <Dialog open={modalSenhaTempOpen} onOpenChange={setModalSenhaTempOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Senha Temporária Gerada
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Passe a senha abaixo ao colaborador para que ele possa efetuar o login no ERP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                Aviso de Segurança:
              </div>
              <p>
                Por segurança, esta senha é exibida apenas uma vez e nunca é registrada no banco de
                dados de forma legível. Copie-a agora.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Operador</Label>
              <div className="text-xs font-semibold text-gray-800">
                {senhaTemporariaGerada?.nome} ({senhaTemporariaGerada?.email})
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500 font-medium">Nova Senha Temporária</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#FAF9F7] border border-[#ECEAE4] rounded-xl px-4 py-2.5 font-mono text-base font-bold tracking-wider text-teal-900 text-center select-all">
                  {senhaTemporariaGerada?.senha}
                </div>
                <Button
                  onClick={copiarSenha}
                  className="bg-teal-700 hover:bg-teal-800 text-white h-11 px-4 rounded-xl text-xs shadow-xs"
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setModalSenhaTempOpen(false)}
              className="bg-gray-900 hover:bg-gray-800 text-white text-xs w-full"
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
