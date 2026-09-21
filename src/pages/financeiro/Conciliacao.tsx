import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { BancoConta, Conciliacao, MovimentoFinanceiro } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  Landmark,
  Plus,
  Upload,
  CheckCircle2,
  Undo2,
  Sparkles,
  FileCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react'

export default function ConciliacaoBancaria() {
  const { currentEmpresa, canEdit } = useCompany()

  const [bancos, setBancos] = useState<BancoConta[]>([])
  const [selectedBancoId, setSelectedBancoId] = useState<string>('')
  const [selectedMes, setSelectedMes] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([])
  const [selectedMovIds, setSelectedMovIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Bank Account Modal
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false)
  const [nomeConta, setNomeConta] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [agencia, setAgencia] = useState('')
  const [contaNum, setContaNum] = useState('')
  const [saldoInicial, setSaldoInicial] = useState<number>(0)

  // Upload Statement Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Realtime subscriptions
  useRealtime('movimentos_financeiros', () => loadMovimentos())
  useRealtime('bancos_contas', () => loadBancos())

  const loadBancos = async () => {
    if (!currentEmpresa) return
    try {
      const res = await pb.collection('bancos_contas').getFullList<BancoConta>({
        filter: `empresa_id = '${currentEmpresa.id}'`,
        sort: 'nome',
      })
      setBancos(res)
      if (res.length > 0 && !selectedBancoId) {
        setSelectedBancoId(res[0].id)
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err)
    }
  }

  const loadMovimentos = async () => {
    if (!currentEmpresa || !selectedMes) return
    try {
      setLoading(true)
      const [year, month] = selectedMes.split('-')
      const startDate = `${year}-${month}-01 00:00:00.000Z`
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay} 23:59:59.000Z`

      const res = await pb.collection('movimentos_financeiros').getFullList<MovimentoFinanceiro>({
        filter: `empresa_id = '${currentEmpresa.id}' && data >= '${startDate}' && data <= '${endDate}'`,
        sort: '-data',
        expand: 'categoria_id',
      })

      setMovimentos(res)
      setSelectedMovIds([])
    } catch (err) {
      console.error('Error fetching movements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBancos()
  }, [currentEmpresa])

  useEffect(() => {
    loadMovimentos()
  }, [currentEmpresa, selectedMes])

  const handleCreateBanco = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeConta.trim()) {
      toast({ title: 'Informe o nome identificador da conta', variant: 'destructive' })
      return
    }

    try {
      const newBanco = await pb.collection('bancos_contas').create({
        empresa_id: currentEmpresa!.id,
        nome: nomeConta.trim(),
        banco: bancoNome.trim(),
        agencia: agencia.trim(),
        conta: contaNum.trim(),
        saldo_inicial: Number(saldoInicial) || 0,
      })

      toast({ title: 'Conta bancária criada com sucesso!' })
      setIsBancoModalOpen(false)
      await loadBancos()
      setSelectedBancoId(newBanco.id)

      setNomeConta('')
      setBancoNome('')
      setAgencia('')
      setContaNum('')
      setSaldoInicial(0)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar conta bancária',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleUploadExtrato = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileToUpload || !selectedBancoId) {
      toast({
        title: 'Selecione um arquivo de extrato válido (CSV, OFX ou PDF)',
        variant: 'destructive',
      })
      return
    }

    if (fileToUpload.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (máximo 10MB)', variant: 'destructive' })
      return
    }

    try {
      setIsUploading(true)

      // Save conciliacao record
      const formData = new FormData()
      formData.append('empresa_id', currentEmpresa!.id)
      formData.append('banco_conta_id', selectedBancoId)
      formData.append('mes', selectedMes)
      formData.append('arquivo', fileToUpload)
      formData.append('status', 'EmAndamento')

      await pb.collection('conciliacoes').create(formData)

      // If text/csv file, call hook to suggest candidates
      if (fileToUpload.name.endsWith('.csv') || fileToUpload.type.includes('text')) {
        const text = await fileToUpload.text()
        const hookRes = await pb.send('/backend/v1/importar-movimentos', {
          method: 'POST',
          body: {
            empresa_id: currentEmpresa!.id,
            conteudo: text,
          },
        })

        if (hookRes?.itens?.length > 0) {
          const autoMatchedIds = hookRes.itens
            .filter((it: any) => it.casado && it.movimento_casado?.id)
            .map((it: any) => it.movimento_casado.id)

          if (autoMatchedIds.length > 0) {
            setSelectedMovIds(autoMatchedIds)
            toast({
              title: 'Extrato importado!',
              description: `${autoMatchedIds.length} movimentações pré-selecionadas pelo assistente de conciliação.`,
            })
          } else {
            toast({ title: 'Extrato importado com sucesso!' })
          }
        }
      } else {
        toast({ title: 'Comprovante/Extrato anexado à conciliação com sucesso!' })
      }

      setIsUploadModalOpen(false)
      setFileToUpload(null)
      await loadMovimentos()
    } catch (err: any) {
      toast({ title: 'Erro ao enviar extrato', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleToggleSelectMov = (id: string) => {
    setSelectedMovIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMovIds(movimentos.map((m) => m.id))
    } else {
      setSelectedMovIds([])
    }
  }

  const handleConciliarSelecionados = async () => {
    if (selectedMovIds.length === 0) return
    try {
      await Promise.all(
        selectedMovIds.map((id) =>
          pb.collection('movimentos_financeiros').update(id, {
            conciliado: true,
          }),
        ),
      )
      toast({ title: `${selectedMovIds.length} movimentos conciliados com sucesso!` })
      setSelectedMovIds([])
      await loadMovimentos()
    } catch (err: any) {
      toast({ title: 'Erro ao conciliar', description: err.message, variant: 'destructive' })
    }
  }

  const handleDesfazerConciliacao = async () => {
    if (selectedMovIds.length === 0) return
    try {
      await Promise.all(
        selectedMovIds.map((id) =>
          pb.collection('movimentos_financeiros').update(id, {
            conciliado: false,
          }),
        ),
      )
      toast({ title: 'Conciliação desfeita para os registros selecionados.' })
      setSelectedMovIds([])
      await loadMovimentos()
    } catch (err: any) {
      toast({ title: 'Erro ao desfazer', description: err.message, variant: 'destructive' })
    }
  }

  const handleAutoSuggest = () => {
    // Select all unconciliated records
    const unconciliated = movimentos.filter((m) => !m.conciliado).map((m) => m.id)
    if (unconciliated.length === 0) {
      toast({ title: 'Todos os movimentos já estão conciliados neste mês!' })
      return
    }
    setSelectedMovIds(unconciliated)
    toast({
      title: 'Sugestão automática aplicada',
      description: `${unconciliated.length} registros selecionados para conferência.`,
    })
  }

  // Progress metrics
  const totalMovimentos = movimentos.length
  const conciliadosCount = useMemo(() => {
    return movimentos.filter((m) => m.conciliado).length
  }, [movimentos])

  const percentConciliado =
    totalMovimentos > 0 ? Math.round((conciliadosCount / totalMovimentos) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Conciliação Bancária</h1>
          <p className="text-xs text-gray-500">
            Conferência entre extrato da instituição financeira e lançamentos internos
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              variant="outline"
              className="border-[#ECEAE4] hover:bg-teal-50 text-teal-800 rounded-xl text-xs shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload de Extrato
            </Button>
            <Button
              onClick={() => setIsBancoModalOpen(true)}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Adicionar Conta Bancária
            </Button>
          </div>
        )}
      </div>

      {/* Selectors Card */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Conta Bancária / Caixa</Label>
            <Select value={selectedBancoId} onValueChange={setSelectedBancoId}>
              <SelectTrigger className="mt-1 bg-[#FAF9F7] border-[#ECEAE4]">
                <SelectValue placeholder="Selecione a conta..." />
              </SelectTrigger>
              <SelectContent>
                {bancos.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome} ({b.banco || 'Geral'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-700">Mês de Competência</Label>
            <Input
              type="month"
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
              className="mt-1 bg-[#FAF9F7] border-[#ECEAE4] font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-gray-600">Progresso da Conciliação</span>
              <span className="text-teal-700 tabular-nums">
                {conciliadosCount} de {totalMovimentos} ({percentConciliado}%)
              </span>
            </div>
            <Progress value={percentConciliado} className="h-2.5 bg-gray-100" />
          </div>
        </div>
      </Card>

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#ECEAE4] shadow-xs">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Checkbox
            checked={selectedMovIds.length > 0 && selectedMovIds.length === movimentos.length}
            onCheckedChange={handleSelectAll}
            id="select-all"
          />
          <Label htmlFor="select-all" className="text-xs text-gray-600 cursor-pointer">
            Selecionar todos ({selectedMovIds.length} marcados)
          </Label>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoSuggest}
              className="text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Sugestão Automática
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedMovIds.length === 0}
              onClick={handleDesfazerConciliacao}
              className="text-xs border-[#ECEAE4] hover:bg-gray-100"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              Desfazer Conciliação
            </Button>
            <Button
              size="sm"
              disabled={selectedMovIds.length === 0}
              onClick={handleConciliarSelecionados}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Conciliar Selecionados
            </Button>
          </div>
        )}
      </div>

      {/* Movements Table */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {movimentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Nenhum movimento registrado para o mês selecionado.
                  </td>
                </tr>
              ) : (
                movimentos.map((m) => {
                  const isChecked = selectedMovIds.includes(m.id)
                  return (
                    <tr
                      key={m.id}
                      onClick={() => handleToggleSelectMov(m.id)}
                      className={`hover:bg-teal-50/20 cursor-pointer transition-colors ${
                        isChecked ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleSelectMov(m.id)}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-gray-700">
                        {formatDate(m.data)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{m.descricao}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {m.expand?.categoria_id?.nome || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{m.origem}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span
                          className={m.tipo === 'Entrada' ? 'text-emerald-600' : 'text-red-600'}
                        >
                          {m.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(m.valor)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={
                            m.conciliado
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {m.conciliado ? '✓ Conciliado' : 'Pendente'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Bank Modal */}
      <Dialog open={isBancoModalOpen} onOpenChange={setIsBancoModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Adicionar Conta Bancária
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateBanco} className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome Identificador *</Label>
              <Input
                required
                value={nomeConta}
                onChange={(e) => setNomeConta(e.target.value)}
                placeholder="Ex: Santander - Conta Principal"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Banco / Instituição</Label>
              <Input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: 033 - Santander Brasil"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Agência</Label>
                <Input
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  placeholder="0001"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Número da Conta</Label>
                <Input
                  value={contaNum}
                  onChange={(e) => setContaNum(e.target.value)}
                  placeholder="123456-7"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Saldo Inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={saldoInicial || ''}
                onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsBancoModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white">
                Cadastrar Conta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Extrato Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Upload de Extrato Bancário
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUploadExtrato} className="space-y-4 py-2 text-xs">
            <p className="text-gray-500">
              Envie o extrato em formato <strong>CSV</strong>, <strong>OFX</strong> ou{' '}
              <strong>PDF</strong> para validação e cruzamento automático com os lançamentos do mês
              de {selectedMes}.
            </p>

            <div className="border-2 border-dashed border-[#ECEAE4] rounded-xl p-6 text-center hover:border-teal-600 transition-colors bg-[#FAF9F7]">
              <Upload className="w-8 h-8 text-teal-700 mx-auto mb-2" />
              <Label
                htmlFor="file-extrato"
                className="cursor-pointer text-sm font-semibold text-teal-700 block"
              >
                Clique para selecionar o arquivo
              </Label>
              <p className="text-[11px] text-gray-400 mt-1">
                Formatos aceitos: .csv, .ofx, .pdf (Máx: 10MB)
              </p>
              <input
                id="file-extrato"
                type="file"
                accept=".csv,.ofx,.pdf,text/plain"
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                className="hidden"
              />
              {fileToUpload && (
                <div className="mt-3 p-2 bg-teal-50 rounded-lg text-teal-800 font-medium text-xs flex items-center justify-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  {fileToUpload.name} ({(fileToUpload.size / 1024).toFixed(0)} KB)
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!fileToUpload || isUploading}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isUploading ? 'Processando...' : 'Iniciar Conciliação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
