import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { getInitials } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  User,
  KeyRound,
  Building,
  Mail,
  Shield,
  Upload,
  Lock,
  LogOut,
  UserPlus,
  Send,
} from 'lucide-react'

export default function Perfil() {
  const { user, refreshUser, logout } = useAuth()
  const { currentRole, currentEmpresa, empresas, membros, reloadEmpresas, isAdmin } = useCompany()
  const [searchParams] = useSearchParams()

  // Name state
  const [name, setName] = useState(user?.name || '')
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  // Email Change Modal
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [isSendingEmailChange, setIsSendingEmailChange] = useState(false)

  // Password Change Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(
    searchParams.get('tab') === 'seguranca',
  )
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Invite Member Modal (Admin)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'financeiro' | 'leitura'>('financeiro')
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [createdInviteLink, setCreatedInviteLink] = useState('')

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setIsUpdatingName(true)
      await pb.collection('users').update(user!.id, {
        name: name.trim(),
      })
      await refreshUser()
      toast({ title: 'Perfil atualizado com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar nome', description: err.message, variant: 'destructive' })
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    try {
      setIsSendingEmailChange(true)
      await pb.collection('users').requestEmailChange(newEmail.trim())
      toast({
        title: 'Confirmação enviada!',
        description: `Enviamos um link para ${newEmail}. Confirme para atualizar seu e-mail.`,
      })
      setEmailModalOpen(false)
      setNewEmail('')
    } catch (err: any) {
      toast({
        title: 'Erro ao solicitar alteração',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSendingEmailChange(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== passwordConfirm) {
      toast({ title: 'As novas senhas não coincidem', variant: 'destructive' })
      return
    }
    if (newPassword.length < 8) {
      toast({ title: 'A nova senha deve ter no mínimo 8 caracteres', variant: 'destructive' })
      return
    }

    try {
      setIsChangingPassword(true)
      await pb.collection('users').update(user!.id, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: passwordConfirm,
      })
      toast({ title: 'Senha alterada com sucesso!' })
      setPasswordModalOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirm('')
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: err.message || 'Verifique a senha atual informada',
        variant: 'destructive',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !currentEmpresa) return

    try {
      setIsSendingInvite(true)
      const res = await pb.send('/backend/v1/convites', {
        method: 'POST',
        body: {
          empresa_id: currentEmpresa.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      })

      if (res?.convite?.token) {
        const link = `${window.location.origin}/convite?token=${res.convite.token}`
        setCreatedInviteLink(link)
        toast({ title: 'Convite gerado com sucesso!' })
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar convite', description: err.message, variant: 'destructive' })
    } finally {
      setIsSendingInvite(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Meu Perfil</h1>
        <p className="text-xs text-gray-500">
          Dados cadastrais, segurança da conta e organizações vinculadas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card Left */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xl border-4 border-white shadow-md">
            {getInitials(user?.name)}
          </div>
          <h2 className="font-bold text-gray-900 text-base mt-3">{user?.name}</h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{user?.email}</p>

          <div className="mt-3 flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-xs uppercase font-bold px-2 py-0.5 ${
                currentRole === 'admin'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : currentRole === 'financeiro'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              Papel: {currentRole}
            </Badge>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-[#ECEAE4] space-y-2">
            <Button
              variant="outline"
              onClick={() => setPasswordModalOpen(true)}
              className="w-full text-xs rounded-xl border-[#ECEAE4] hover:bg-gray-50 justify-start"
            >
              <KeyRound className="w-4 h-4 mr-2 text-amber-600" />
              Alterar Senha
            </Button>
            <Button
              variant="outline"
              onClick={() => setEmailModalOpen(true)}
              className="w-full text-xs rounded-xl border-[#ECEAE4] hover:bg-gray-50 justify-start"
            >
              <Mail className="w-4 h-4 mr-2 text-teal-600" />
              Alterar E-mail
            </Button>
          </div>
        </Card>

        {/* Edit Details Right */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold text-gray-900">Dados Pessoais</CardTitle>
            </CardHeader>
            <form onSubmit={handleUpdateName} className="space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nome Completo</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Email Atual</Label>
                <Input
                  disabled
                  value={user?.email || ''}
                  className="mt-1 bg-gray-50 text-gray-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Para alterar o endereço de e-mail, utilize a opção lateral com confirmação.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isUpdatingName}
                  className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs"
                >
                  {isUpdatingName ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Companies List */}
          <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#ECEAE4]">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Organizações Vinculadas
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Empresas que você possui acesso</p>
              </div>

              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreatedInviteLink('')
                    setInviteEmail('')
                    setInviteModalOpen(true)
                  }}
                  className="text-xs border-[#ECEAE4] hover:bg-teal-50 text-teal-800"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Convidar Membro
                </Button>
              )}
            </div>

            <div className="divide-y divide-[#ECEAE4] mt-2">
              {empresas.map((emp) => {
                const userMembro = membros.find((m) => m.empresa_id === emp.id)
                const roleInEmp = userMembro?.role || (isAdmin ? 'admin' : 'leitura')

                return (
                  <div key={emp.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-xs"
                        style={{ backgroundColor: emp.cor || '#0F766E' }}
                      >
                        {getInitials(emp.nome_fantasia)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-xs">
                          {emp.nome_fantasia}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">{emp.cnpj}</div>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[10px] capitalize">
                      {roleInEmp}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Alterar Senha */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Alterar Senha</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-3.5 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha Atual</Label>
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Nova Senha (mín. 8 dígitos)
              </Label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Confirmar Nova Senha</Label>
              <Input
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setPasswordModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isChangingPassword ? 'Salvando...' : 'Confirmar Nova Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Email */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Alterar E-mail</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRequestEmailChange} className="space-y-4 py-2 text-xs">
            <p className="text-gray-500">
              Um link de confirmação será enviado para o novo endereço. Após confirmar, você deverá
              entrar novamente no sistema com a nova credencial.
            </p>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Novo E-mail Corporativo</Label>
              <Input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo.email@empresa.com.br"
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setEmailModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSendingEmailChange}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isSendingEmailChange ? 'Enviando link...' : 'Enviar Confirmação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Convidar Membro (Admin) */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Convidar Colaborador
            </DialogTitle>
          </DialogHeader>

          {!createdInviteLink ? (
            <form onSubmit={handleCreateInvite} className="space-y-4 py-2 text-xs">
              <p className="text-gray-500">
                Gere um convite para permitir que outro colaborador acesse{' '}
                <strong>{currentEmpresa?.nome_fantasia}</strong> com o papel selecionado.
              </p>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  E-mail do Colaborador *
                </Label>
                <Input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colega@empresa.com.br"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Papel / Permissões</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-1 w-full h-9 rounded-xl border border-[#ECEAE4] bg-[#FAF9F7] px-3 text-xs"
                >
                  <option value="financeiro">
                    Financeiro (CRUD financeiro, relatórios, leitura cadastros)
                  </option>
                  <option value="admin">Administrador (Acesso total)</option>
                  <option value="leitura">Somente Leitura (Visualização geral sem edições)</option>
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setInviteModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingInvite}
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                >
                  {isSendingInvite ? 'Gerando...' : 'Gerar Convite'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-4 text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800">
                Convite gerado com sucesso! Compartilhe o link abaixo com o colaborador:
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Link de Convite Único</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    readOnly
                    value={createdInviteLink}
                    className="font-mono text-xs bg-gray-50"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(createdInviteLink)
                      toast({ title: 'Link copiado para a área de transferência!' })
                    }}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs shrink-0"
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
