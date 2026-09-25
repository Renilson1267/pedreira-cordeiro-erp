import React, { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { formasRecebimentoService, FORMAS_RECEBIMENTO_PADRAO } from '@/services/formasRecebimento'
import { historicoService } from '@/services/historico'
import type { FormaRecebimento } from '@/types/erp'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
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
import { CreditCard, Plus, Edit2, Trash2, CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react'

export default function FormasRecebimento() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const { user } = useAuth()

  const [formas, setFormas] = useState<FormaRecebimento[]>([])
  const [loading, setLoading] = useState(false)

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [ordem, setOrdem] = useState<number>(10)
  const [ativo, setAtivo] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Confirmation Alert Dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive'
    action: () => Promise<void> | void
  } | null>(null)

  useRealtime('formas_recebimento', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const list = await formasRecebimentoService.listar(currentEmpresa.id)
      if (list.length === 0) {
        // Garantir as 7 formas padrão se ainda não existirem
        const seeded = await formasRecebimentoService.garantirFormasPadrao(currentEmpresa.id)
        setFormas(seeded)
      } else {
        setFormas(list)
      }
    } catch (err) {
      console.error('Erro ao carregar formas de recebimento:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setNome('')
    const maxOrdem = formas.reduce((max, f) => Math.max(max, f.ordem || 0), 0)
    setOrdem(maxOrdem + 10)
    setAtivo(true)
    setIsDrawerOpen(true)
  }

  const handleEdit = (f: FormaRecebimento) => {
    setEditingId(f.id)
    setNome(f.nome)
    setOrdem(f.ordem || 10)
    setAtivo(f.ativo !== false)
    setIsDrawerOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) {
      toast({ title: 'Informe o nome da forma de recebimento', variant: 'destructive' })
      return
    }

    const isEdit = Boolean(editingId)
    setConfirmDialogData({
      title: isEdit
        ? 'Confirmar alteração de forma de recebimento'
        : 'Confirmar inclusão de forma de recebimento',
      description: isEdit
        ? `Deseja salvar as alterações na forma de recebimento "${nomeLimpo}"?`
        : `Deseja cadastrar a nova forma de recebimento "${nomeLimpo}" para a empresa ${currentEmpresa?.nome_fantasia}?`,
      confirmLabel: isEdit ? 'Salvar Alteração' : 'Cadastrar Forma',
      action: async () => {
        try {
          setIsSubmitting(true)
          if (editingId) {
            const anterior = formas.find((f) => f.id === editingId)
            await formasRecebimentoService.atualizar(editingId, {
              nome: nomeLimpo,
              ordem: Number(ordem) || 10,
              ativo,
            })

            await historicoService.registrar({
              empresaId: currentEmpresa!.id,
              colecaoOrigem: 'outros',
              registroId: editingId,
              acao: 'editar',
              usuarioId: user?.id,
              usuarioNome: user?.name || user?.email || 'Usuário',
              descricao: `Forma de recebimento alterada: de "${anterior?.nome}" para "${nomeLimpo}" (${ativo ? 'Ativa' : 'Inativa'}, Ordem: ${ordem}).`,
              detalhes: {
                extra: { nome_anterior: anterior?.nome, nome_novo: nomeLimpo, ativo, ordem },
              },
            })

            toast({ title: 'Forma de recebimento atualizada com sucesso!' })
          } else {
            const criada = await formasRecebimentoService.criar({
              empresa_id: currentEmpresa!.id,
              nome: nomeLimpo,
              ordem: Number(ordem) || 10,
              ativo,
            })

            await historicoService.registrar({
              empresaId: currentEmpresa!.id,
              colecaoOrigem: 'outros',
              registroId: criada.id,
              acao: 'criar',
              usuarioId: user?.id,
              usuarioNome: user?.name || user?.email || 'Usuário',
              descricao: `Forma de recebimento criada: "${nomeLimpo}" (${ativo ? 'Ativa' : 'Inativa'}, Ordem: ${ordem}).`,
              detalhes: {
                extra: { nome: nomeLimpo, ativo, ordem },
              },
            })

            toast({ title: 'Forma de recebimento criada com sucesso!' })
          }

          setIsDrawerOpen(false)
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao salvar forma de recebimento',
            description: err.message,
            variant: 'destructive',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const handleToggleAtivo = async (forma: FormaRecebimento) => {
    if (!canEdit) return
    const novoAtivo = !forma.ativo
    try {
      await formasRecebimentoService.atualizar(forma.id, { ativo: novoAtivo })
      await historicoService.registrar({
        empresaId: currentEmpresa!.id,
        colecaoOrigem: 'outros',
        registroId: forma.id,
        acao: 'editar',
        usuarioId: user?.id,
        usuarioNome: user?.name || user?.email || 'Usuário',
        descricao: `Forma de recebimento "${forma.nome}" foi ${novoAtivo ? 'ativada' : 'desativada'}.`,
        detalhes: { extra: { id: forma.id, nome: forma.nome, ativo: novoAtivo } },
      })
      toast({
        title: novoAtivo ? 'Forma ativada com sucesso!' : 'Forma desativada!',
      })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = (forma: FormaRecebimento) => {
    setConfirmDialogData({
      title: 'Confirmar exclusão de forma de recebimento',
      description: `Deseja realmente excluir a forma de recebimento "${forma.nome}"? Registros anteriores que utilizaram este nome continuarão intactos como histórico.`,
      confirmLabel: 'Excluir Forma',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          await historicoService.registrar({
            empresaId: currentEmpresa!.id,
            colecaoOrigem: 'outros',
            registroId: forma.id,
            acao: 'excluir',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Forma de recebimento "${forma.nome}" foi excluída.`,
            detalhes: { extra: { id: forma.id, nome: forma.nome } },
          })
          await formasRecebimentoService.excluir(forma.id)
          toast({ title: 'Forma de recebimento excluída com sucesso.' })
          await loadData()
        } catch (err: any) {
          toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const handleRestaurarPadrao = () => {
    setConfirmDialogData({
      title: 'Restaurar formas de recebimento padrão',
      description:
        'Deseja garantir que todas as 7 formas padrão (Pix, Cheque Pré-datado, Depósito, Dinheiro, A Prazo, Cartão, Transferência Bancária) estejam cadastradas e ativas?',
      confirmLabel: 'Restaurar Padrões',
      action: async () => {
        try {
          await formasRecebimentoService.garantirFormasPadrao(currentEmpresa!.id)
          toast({ title: 'Formas de recebimento padrão garantidas com sucesso!' })
          await loadData()
        } catch (err: any) {
          toast({ title: 'Erro ao restaurar', description: err.message, variant: 'destructive' })
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Formas de Recebimento</h1>
          <p className="text-xs text-gray-500">
            Catálogo de meios de pagamento aceitos nas Contas a Receber e vendas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={handleRestaurarPadrao}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl shadow-xs"
            >
              Garantir Padrões (7 Formas)
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Forma de Recebimento
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card className="rounded-2xl border-teal-200 bg-teal-50/40 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="text-xs text-teal-900 space-y-1">
            <p className="font-semibold text-sm text-teal-950">
              Formas de Recebimento Integradas ao ERP
            </p>
            <p className="text-teal-800 leading-relaxed">
              As formas ativas aqui cadastradas alimentam o combobox pesquisável no formulário de
              Contas a Receber e na tela de baixa. A seleção de <strong>Cheque Pré-datado</strong>{' '}
              abre automaticamente a aba para cadastro das datas e valores de cada cheque, e a opção{' '}
              <strong>A Prazo</strong> integra com o parcelador.
            </p>
          </div>
        </div>
      </Card>

      {/* Lista de Formas */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAF9F7] border-b border-[#ECEAE4] flex items-center justify-between text-xs font-semibold text-gray-700">
          <span>Formas Cadastradas ({formas.length})</span>
          <span className="text-gray-400 font-normal text-[11px]">
            Empresa: {currentEmpresa?.nome_fantasia}
          </span>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">Carregando catálogo...</div>
          ) : formas.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              Nenhuma forma de recebimento cadastrada. Clique em "Garantir Padrões" para iniciar.
            </div>
          ) : (
            formas.map((f) => {
              const isPadrao = (FORMAS_RECEBIMENTO_PADRAO as readonly string[]).includes(f.nome)
              return (
                <div
                  key={f.id}
                  className="p-4 px-6 flex items-center justify-between hover:bg-[#FAF9F7] transition-colors text-xs"
                >
                  <div className="flex items-center space-x-3.5">
                    <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 font-mono font-bold flex items-center justify-center text-[11px] shrink-0 border border-teal-200">
                      {f.ordem || 10}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{f.nome}</span>
                        {isPadrao && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-teal-50 text-teal-700 border-teal-200"
                          >
                            Padrão
                          </Badge>
                        )}
                        {f.nome === 'Cheque Pré-datado' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-amber-50 text-amber-800 border-amber-200"
                          >
                            Aba de Datas
                          </Badge>
                        )}
                        {f.nome === 'A Prazo' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-blue-50 text-blue-800 border-blue-200"
                          >
                            Parcelamento
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        {f.ativo ? 'Disponível para seleção' : 'Inativo / Oculto nas opções'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <Switch
                        disabled={!canEdit}
                        checked={f.ativo}
                        onCheckedChange={() => handleToggleAtivo(f)}
                      />
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(f)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-800 rounded-lg"
                          title="Editar forma"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(f)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Excluir forma"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[440px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Forma de Recebimento' : 'Nova Forma de Recebimento'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome da Forma *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Pix, Cheque Pré-datado, Depósito..."
                className="mt-1"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Nome exibido no ERP ao cadastrar títulos e baixar recebimentos.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Ordem de Exibição</Label>
              <Input
                type="number"
                min="1"
                value={ordem}
                onChange={(e) => setOrdem(parseInt(e.target.value) || 10)}
                placeholder="10"
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Menor número aparece primeiro na lista de seleção.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#ECEAE4]">
              <div>
                <div className="font-semibold text-gray-800">Forma Ativa</div>
                <div className="text-[11px] text-gray-400">
                  Permite novos recebimentos com esta forma
                </div>
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
                className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Forma'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4] max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              {confirmDialogData?.title || 'Confirmar ação'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              {confirmDialogData?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isSubmitting} className="text-xs rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async (e) => {
                e.preventDefault()
                if (confirmDialogData?.action) {
                  await confirmDialogData.action()
                }
                setConfirmDialogOpen(false)
              }}
              className={`text-xs rounded-xl text-white ${
                confirmDialogData?.confirmVariant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {isSubmitting ? 'Processando...' : confirmDialogData?.confirmLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
