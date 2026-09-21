import React, { useState } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getInitials } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
import { Search, Plus, Building2, Check } from 'lucide-react'

interface CompanySwitcherModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const CompanySwitcherModal: React.FC<CompanySwitcherModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { currentEmpresa, empresas, selectEmpresa, reloadEmpresas, isAdmin } = useCompany()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [isFilial, setIsFilial] = useState(false)
  const [empresaPaiId, setEmpresaPaiId] = useState<string>('')

  const filteredEmpresas = empresas.filter(
    (e) => e.nome_fantasia.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search),
  )

  const handleSelect = (id: string) => {
    selectEmpresa(id)
    onOpenChange(false)
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeFantasia.trim() || !cnpj.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const newEmpresa = await pb.collection('empresas').create({
        nome_fantasia: nomeFantasia.trim(),
        razao_social: razaoSocial.trim() || undefined,
        cnpj: cnpj.trim(),
        inscricao_estadual: inscricaoEstadual.trim() || undefined,
        empresa_pai_id: isFilial && empresaPaiId ? empresaPaiId : null,
        cor: '#0F766E',
      })

      // Also create membership as admin
      if (pb.authStore.record?.id) {
        await pb.collection('empresa_membros').create({
          empresa_id: newEmpresa.id,
          usuario_id: pb.authStore.record.id,
          role: 'admin',
        })
      }

      toast({ title: 'Empresa criada com sucesso!' })
      await reloadEmpresas()
      selectEmpresa(newEmpresa.id)
      setShowCreate(false)
      onOpenChange(false)
      // Reset
      setNomeFantasia('')
      setRazaoSocial('')
      setCnpj('')
      setInscricaoEstadual('')
      setIsFilial(false)
      setEmpresaPaiId('')
    } catch (err: any) {
      toast({
        title: 'Erro ao criar empresa',
        description: err.message || 'Verifique se o CNPJ já está cadastrado',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white rounded-2xl border-[#ECEAE4]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 flex items-center justify-between">
            <span>{showCreate ? 'Nova Empresa' : 'Selecionar Empresa'}</span>
            {!showCreate && isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(true)}
                className="text-xs h-8 border-[#ECEAE4] hover:bg-teal-50 hover:text-teal-700"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Empresa
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {!showCreate ? (
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4]"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {filteredEmpresas.map((emp) => {
                const isSelected = currentEmpresa?.id === emp.id
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelect(emp.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50'
                        : 'border-[#ECEAE4] hover:bg-[#FAF9F7] hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-sm"
                        style={{ backgroundColor: emp.cor || '#0F766E' }}
                      >
                        {getInitials(emp.nome_fantasia)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">
                          {emp.nome_fantasia}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">{emp.cnpj}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredEmpresas.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Nenhuma empresa encontrada.
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateCompany} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome Fantasia *</Label>
              <Input
                required
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="Ex: NovaGest Filial Campinas"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Razão Social</Label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: NovaGest Serviços e Tecnologia Ltda"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">CNPJ *</Label>
                <Input
                  required
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Inscrição Estadual</Label>
                <Input
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Isento ou número"
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECEAE4] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    É matriz/filial de outra empresa?
                  </div>
                  <div className="text-xs text-gray-500">
                    Vincule a uma matriz existente no sistema
                  </div>
                </div>
                <Switch checked={isFilial} onCheckedChange={setIsFilial} />
              </div>

              {isFilial && (
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Empresa Matriz</Label>
                  <Select value={empresaPaiId} onValueChange={setEmpresaPaiId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a matriz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome_fantasia} ({e.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 flex justify-between items-center">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Cadastrar Empresa'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
