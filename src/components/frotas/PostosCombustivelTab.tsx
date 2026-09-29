import { useState, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, Fuel, MapPin, Phone, CheckCircle2 } from 'lucide-react'
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
import { postosCombustivelService } from '@/services/postosCombustivel'
import type { PostoCombustivel } from '@/types/erp'

interface PostosCombustivelTabProps {
  empresaId: string
  postos: PostoCombustivel[]
  canEdit: boolean
  onReload: () => Promise<void> | void
}

export function PostosCombustivelTab({
  empresaId,
  postos,
  canEdit,
  onReload,
}: PostosCombustivelTabProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingPosto, setEditingPosto] = useState<PostoCombustivel | null>(null)

  // Form fields
  const [nome, setNome] = useState('')
  const [bandeira, setBandeira] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contato, setContato] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const openCreate = () => {
    setEditingPosto(null)
    setNome('')
    setBandeira('')
    setCnpj('')
    setContato('')
    setTelefone('')
    setCidade('')
    setEndereco('')
    setObservacoes('')
    setModalOpen(true)
  }

  const openEdit = (p: PostoCombustivel) => {
    setEditingPosto(p)
    setNome(p.nome)
    setBandeira(p.bandeira || '')
    setCnpj(p.cnpj || '')
    setContato(p.contato || '')
    setTelefone(p.telefone || '')
    setCidade(p.cidade || '')
    setEndereco(p.endereco || '')
    setObservacoes(p.observacoes || '')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({ title: 'Informe o nome do posto', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: empresaId,
        nome: nome.trim(),
        bandeira: bandeira.trim() || null,
        cnpj: cnpj.trim() || null,
        contato: contato.trim() || null,
        telefone: telefone.trim() || null,
        cidade: cidade.trim() || null,
        endereco: endereco.trim() || null,
        observacoes: observacoes.trim() || null,
        ativo: true,
      }

      if (editingPosto) {
        await postosCombustivelService.atualizar(editingPosto.id, payload)
        toast({ title: 'Posto atualizado com sucesso!' })
      } else {
        await postosCombustivelService.criar(payload)
        toast({ title: 'Posto cadastrado com sucesso!' })
      }

      setModalOpen(false)
      await onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar posto',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (p: PostoCombustivel) => {
    if (!confirm(`Deseja realmente remover o posto "${p.nome}"?`)) return
    try {
      await postosCombustivelService.remover(p.id)
      toast({ title: 'Posto removido com sucesso.' })
      await onReload()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const filteredPostos = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return postos
    return postos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.bandeira || '').toLowerCase().includes(q) ||
        (p.cidade || '').toLowerCase().includes(q) ||
        (p.cnpj || '').toLowerCase().includes(q),
    )
  }, [postos, search])

  return (
    <div className="space-y-4">
      {/* Barra de Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#ECEAE4]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <Input
            placeholder="Buscar por nome, bandeira, cidade, CNPJ..."
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
            Cadastrar Novo Posto
          </Button>
        )}
      </div>

      {/* Grid de Postos */}
      {filteredPostos.length === 0 ? (
        <Card className="p-8 text-center text-gray-400 bg-white rounded-2xl border-[#ECEAE4]">
          <Fuel className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">Nenhum posto cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">
            Cadastre os postos de combustível parceiros para agilizar os lançamentos e a integração
            com o Contas a Pagar.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPostos.map((p) => (
            <Card
              key={p.id}
              className="p-4 rounded-2xl border-[#ECEAE4] bg-white shadow-xs hover:border-teal-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{p.nome}</h3>
                    {p.bandeira && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] bg-teal-50 text-teal-800 border-teal-200"
                      >
                        {p.bandeira}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-teal-700 hover:bg-teal-50"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(p)}
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
                  {p.cnpj && (
                    <div className="font-mono text-[11px] text-gray-500">CNPJ: {p.cnpj}</div>
                  )}
                  {p.cidade && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">
                        {p.cidade} {p.endereco ? `— ${p.endereco}` : ''}
                      </span>
                    </div>
                  )}
                  {(p.contato || p.telefone) && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {p.contato} {p.telefone ? `(${p.telefone})` : ''}
                      </span>
                    </div>
                  )}
                  {p.observacoes && (
                    <p className="text-[11px] text-gray-400 italic pt-1">{p.observacoes}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#ECEAE4] flex items-center justify-between text-[11px] text-teal-800">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-teal-600" /> Disponível nos abastecimentos
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
              {editingPosto ? 'Editar Posto de Combustível' : 'Cadastrar Posto de Combustível'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome do Posto *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Auto Posto Sertânia Ltda"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Bandeira</Label>
                <Input
                  value={bandeira}
                  onChange={(e) => setBandeira(e.target.value)}
                  placeholder="Ex: Ipiranga, Petrobras, Shell, Branca"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">CNPJ</Label>
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
                <Label className="text-xs font-semibold text-gray-700">Contato / Gerente</Label>
                <Input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Ex: Carlos"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(87) 99999-9999"
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
                <Label className="text-xs font-semibold text-gray-700">Endereço / Rodovia</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: BR-232, Km 280"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Faturamento quinzenal via boleto, desconto de 3% no diesel..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Posto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
