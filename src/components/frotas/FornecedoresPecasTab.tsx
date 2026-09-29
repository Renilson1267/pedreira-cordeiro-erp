import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Wrench,
  MapPin,
  Phone,
  CheckCircle2,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { fornecedoresPecasService } from '@/services/fornecedoresPecas'
import type { FornecedorPecas } from '@/types/erp'

interface FornecedoresPecasTabProps {
  empresaId: string
  fornecedoresPecas: FornecedorPecas[]
  canEdit: boolean
  onReload: () => Promise<void> | void
}

export function FornecedoresPecasTab({
  empresaId,
  fornecedoresPecas,
  canEdit,
  onReload,
}: FornecedoresPecasTabProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingItem, setEditingItem] = useState<FornecedorPecas | null>(null)

  // Form fields
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contato, setContato] = useState('')
  const [telefone, setTelefone] = useState('')
  const [tipoPecas, setTipoPecas] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const openCreate = () => {
    setEditingItem(null)
    setNome('')
    setCnpj('')
    setContato('')
    setTelefone('')
    setTipoPecas('')
    setCidade('')
    setEndereco('')
    setObservacoes('')
    setModalOpen(true)
  }

  const openEdit = (f: FornecedorPecas) => {
    setEditingItem(f)
    setNome(f.nome)
    setCnpj(f.cnpj || '')
    setContato(f.contato || '')
    setTelefone(f.telefone || '')
    setTipoPecas(f.tipo_pecas || '')
    setCidade(f.cidade || '')
    setEndereco(f.endereco || '')
    setObservacoes(f.observacoes || '')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({ title: 'Informe a razão social ou nome da oficina', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: empresaId,
        nome: nome.trim(),
        cnpj: cnpj.trim() || null,
        contato: contato.trim() || null,
        telefone: telefone.trim() || null,
        tipo_pecas: tipoPecas.trim() || null,
        cidade: cidade.trim() || null,
        endereco: endereco.trim() || null,
        observacoes: observacoes.trim() || null,
        ativo: true,
      }

      if (editingItem) {
        await fornecedoresPecasService.atualizar(editingItem.id, payload)
        toast({ title: 'Fornecedor/Oficina atualizado com sucesso!' })
      } else {
        await fornecedoresPecasService.criar(payload)
        toast({ title: 'Fornecedor/Oficina cadastrado com sucesso!' })
      }

      setModalOpen(false)
      await onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar registro',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (f: FornecedorPecas) => {
    if (!confirm(`Deseja realmente remover "${f.nome}"?`)) return
    try {
      await fornecedoresPecasService.remover(f.id)
      toast({ title: 'Registro removido com sucesso.' })
      await onReload()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fornecedoresPecas
    return fornecedoresPecas.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        (f.tipo_pecas || '').toLowerCase().includes(q) ||
        (f.cidade || '').toLowerCase().includes(q) ||
        (f.cnpj || '').toLowerCase().includes(q),
    )
  }, [fornecedoresPecas, search])

  return (
    <div className="space-y-4">
      {/* Barra de Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#ECEAE4]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <Input
            placeholder="Buscar por oficina, peças, cidade, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
          />
        </div>

        {canEdit && (
          <Button
            onClick={openCreate}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Cadastrar Fornecedor / Oficina
          </Button>
        )}
      </div>

      {/* Grid de Itens */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-400 bg-white rounded-2xl border-[#ECEAE4]">
          <Wrench className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">
            Nenhum fornecedor de peças ou oficina cadastrado
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Cadastre tornearias, oficinas hidráulicas, fornecedores de filtros e pneus para vincular
            às Ordens de Manutenção e gerar lançamentos no Contas a Pagar.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <Card
              key={f.id}
              className="p-4 rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:border-teal-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{f.nome}</h3>
                    {f.tipo_pecas && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] bg-amber-50 text-amber-900 border-amber-300"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {f.tipo_pecas}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(f)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-teal-700 hover:bg-teal-50"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(f)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  {f.cnpj && (
                    <div className="font-mono text-[11px] text-gray-500">CNPJ/CPF: {f.cnpj}</div>
                  )}
                  {f.cidade && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">
                        {f.cidade} {f.endereco ? `— ${f.endereco}` : ''}
                      </span>
                    </div>
                  )}
                  {(f.contato || f.telefone) && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {f.contato} {f.telefone ? `(${f.telefone})` : ''}
                      </span>
                    </div>
                  )}
                  {f.observacoes && (
                    <p className="text-[11px] text-gray-400 italic pt-1">{f.observacoes}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#ECEAE4] flex items-center justify-between text-[11px] text-teal-800">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-teal-600" /> Disponível nas manutenções
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {editingItem
                ? 'Editar Fornecedor / Oficina'
                : 'Cadastrar Fornecedor de Peças & Oficina'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Nome da Oficina / Razão Social *
              </Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Tornearia São José / Auto Peças Sertão"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Especialidade / Tipo de Peça
                </Label>
                <Input
                  value={tipoPecas}
                  onChange={(e) => setTipoPecas(e.target.value)}
                  placeholder="Ex: Pneus, Filtros, Hidráulica, Motor"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">CNPJ / CPF</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Contato / Mecânico Chefe
                </Label>
                <Input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Ex: Mestre Vicente"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(87) 98888-8888"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Cidade</Label>
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Sertânia - PE"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Endereço</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: Distrito Industrial, Galpão 03"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações Técnicas</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Atendimento de socorro mecânico na pedreira aos finais de semana..."
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
