import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Lock,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import { getSaldoRestante, getValorRecebidoEfetivo } from '@/lib/calculoRecebimentos'
import type { ContaReceber } from '@/types/erp'
import pb from '@/lib/pocketbase/client'
import { historicoService } from '@/services/historico'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { useToast } from '@/hooks/use-toast'

export interface ItemEdicaoParcela {
  id?: string // se já existe no banco
  numero: number
  vencimento: string // YYYY-MM-DD
  valor: number
  valorRecebido: number
  status: 'Aberta' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado' | 'Parcial'
  isOriginalExistente: boolean
  isReadOnlyQuitada?: boolean
  nota?: string
  descricao?: string
}

export interface EditarParcelasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tituloBase: ContaReceber | null
  onSuccess?: () => void
}

/**
 * Extrai índice de parcela do texto (ex: "(1/3)" -> { atual: 1, total: 3 })
 */
export function extrairInfoParcela(descricao: string): { atual: number; total: number } | null {
  const match = (descricao || '').match(/\((\d+)\/(\d+)\)/)
  if (match) {
    return {
      atual: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
    }
  }
  return null
}

/**
 * Remove o sufixo (X/Y) da descrição base
 */
export function limparDescricaoBase(descricao: string): string {
  return (descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim()
}

export const EditarParcelasModal: React.FC<EditarParcelasModalProps> = ({
  open,
  onOpenChange,
  tituloBase,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { currentEmpresa } = useCompany()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [itensParcelas, setItensParcelas] = useState<ItemEdicaoParcela[]>([])
  const [titulosIrmaosCarregados, setTitulosIrmaosCarregados] = useState<ContaReceber[]>([])
  const [valorTotalGrupo, setValorTotalGrupo] = useState<number>(0)
  const [saldoEmAbertoGrupo, setSaldoEmAbertoGrupo] = useState<number>(0)
  const [baseDescricaoGrupo, setBaseDescricaoGrupo] = useState<string>('')

  // Carrega todas as parcelas irmãs do mesmo grupo
  useEffect(() => {
    if (!open || !tituloBase || !currentEmpresa) return

    let ativo = true

    const carregarGrupo = async () => {
      setLoading(true)
      try {
        const info = extrairInfoParcela(tituloBase.descricao)
        const baseDesc = limparDescricaoBase(tituloBase.descricao)
        setBaseDescricaoGrupo(baseDesc || 'Título')

        let contasIrmas: ContaReceber[] = []

        // Estratégia de busca do grupo:
        // 1. Se tem nota fiscal/doc comum e cliente comum
        // 2. Se tem observações apontando para o id do título original
        // 3. Se a descrição segue o padrão "Base (X/Y)"
        const filtroPartes: string[] = [`empresa_id = '${currentEmpresa.id}'`]

        if (tituloBase.cliente_id) {
          filtroPartes.push(`cliente_id = '${tituloBase.cliente_id}'`)
        }

        const condicoesGrupo: string[] = []
        if (tituloBase.nota && tituloBase.nota.trim()) {
          condicoesGrupo.push(`nota = '${tituloBase.nota.trim()}'`)
        }
        if (baseDesc) {
          condicoesGrupo.push(`descricao ~ '${baseDesc}'`)
        }
        condicoesGrupo.push(`observacoes ~ '${tituloBase.id}'`)
        condicoesGrupo.push(`id = '${tituloBase.id}'`)

        filtroPartes.push(`(${condicoesGrupo.join(' || ')})`)

        const res = await pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: filtroPartes.join(' && '),
          sort: 'vencimento,created',
          expand: 'cliente_id,categoria_id,centro_custo_id',
        })

        // Se o título base for isolado ou não tiver parcelas irmãs encontradas, cria grupo a partir dele
        let grupoContas: ContaReceber[] = []
        if (info) {
          // Filtra as que realmente pertencem a esse grupo de parcelas (mesma baseDesc ou mesma nota)
          grupoContas = res.filter((c) => {
            if (c.id === tituloBase.id) return true
            const cInfo = extrairInfoParcela(c.descricao)
            if (cInfo && cInfo.total === info.total) {
              const cBase = limparDescricaoBase(c.descricao)
              if (cBase === baseDesc) return true
              if (tituloBase.nota && c.nota === tituloBase.nota) return true
            }
            if (c.observacoes && c.observacoes.includes(tituloBase.id)) return true
            if (tituloBase.observacoes && tituloBase.observacoes.includes(c.id)) return true
            return false
          })
        }

        // Se encontrou menos que o total ou nada, garante pelo menos o tituloBase
        if (grupoContas.length === 0) {
          grupoContas = [tituloBase]
        }

        // Ordena por número da parcela (1..N) se disponível, senão por vencimento
        grupoContas.sort((a, b) => {
          const infA = extrairInfoParcela(a.descricao)
          const infB = extrairInfoParcela(b.descricao)
          if (infA && infB) return infA.atual - infB.atual
          return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
        })

        if (!ativo) return

        setTitulosIrmaosCarregados(grupoContas)

        // Mapear para ItemEdicaoParcela
        const totalBruto = grupoContas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
        const totalJaRecebido = grupoContas.reduce((acc, c) => acc + getValorRecebidoEfetivo(c), 0)
        const saldoAberto = Math.max(0, totalBruto - totalJaRecebido)

        setValorTotalGrupo(totalBruto)
        setSaldoEmAbertoGrupo(saldoAberto)

        const itens: ItemEdicaoParcela[] = grupoContas.map((c, idx) => {
          const inf = extrairInfoParcela(c.descricao)
          const num = inf ? inf.atual : idx + 1
          const rec = getValorRecebidoEfetivo(c)
          const isQuitada = c.status === 'Recebida' || rec >= c.valor - 0.009

          return {
            id: c.id,
            numero: num,
            vencimento: toInputDate(c.vencimento),
            valor: Number(c.valor || 0),
            valorRecebido: rec,
            status: c.status,
            isOriginalExistente: true,
            isReadOnlyQuitada: isQuitada,
            nota: c.nota,
            descricao: c.descricao,
          }
        })

        setItensParcelas(itens)
      } catch (err: any) {
        console.error('Erro ao carregar grupo de parcelas:', err)
        toast({
          title: 'Erro ao carregar parcelas',
          description: err.message || 'Falha ao buscar títulos do grupo.',
          variant: 'destructive',
        })
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregarGrupo()

    return () => {
      ativo = false
    }
  }, [open, tituloBase, currentEmpresa, toast])

  // Cálculos de validação em tempo real
  const somaAtualTotal = useMemo(() => {
    return Number(itensParcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0).toFixed(2))
  }, [itensParcelas])

  const diferencaComTotalOriginal = useMemo(() => {
    return Number((valorTotalGrupo - somaAtualTotal).toFixed(2))
  }, [valorTotalGrupo, somaAtualTotal])

  const somaValida = Math.abs(diferencaComTotalOriginal) < 0.01

  // Soma dos valores das parcelas editáveis (não-quitadas)
  const totalRecebidoTravado = useMemo(() => {
    return Number(
      itensParcelas
        .filter((p) => p.isReadOnlyQuitada)
        .reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
        .toFixed(2),
    )
  }, [itensParcelas])

  const saldoAbertoParaDistribuir = useMemo(() => {
    return Number(Math.max(0, valorTotalGrupo - totalRecebidoTravado).toFixed(2))
  }, [valorTotalGrupo, totalRecebidoTravado])

  // Modificar valor de uma parcela individual
  const handleChangeValor = (index: number, novoValor: number) => {
    setItensParcelas((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, valor: Math.max(0, novoValor) } : item)),
    )
  }

  // Modificar data de uma parcela individual
  const handleChangeVencimento = (index: number, novaData: string) => {
    setItensParcelas((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, vencimento: novaData } : item)),
    )
  }

  // Re-ratear o saldo restante igualmente entre as parcelas em aberto
  const handleDistribuirIgualmente = () => {
    const editaveis = itensParcelas.filter((p) => !p.isReadOnlyQuitada)
    if (editaveis.length === 0) return

    const n = editaveis.length
    const totalDistribuir = saldoAbertoParaDistribuir
    const valorUnitario = totalDistribuir > 0 ? Math.floor((totalDistribuir / n) * 100) / 100 : 0

    let contadorEditavel = 0
    setItensParcelas((prev) =>
      prev.map((item) => {
        if (item.isReadOnlyQuitada) return item

        let v = valorUnitario
        if (contadorEditavel === n - 1 && totalDistribuir > 0) {
          const somaAnteriores = Number((valorUnitario * (n - 1)).toFixed(2))
          const diff = Number((totalDistribuir - somaAnteriores).toFixed(2))
          if (diff > 0) v = diff
        }
        contadorEditavel++
        return { ...item, valor: v }
      }),
    )

    toast({
      title: 'Valores distribuídos',
      description: `Saldo de ${formatCurrency(totalDistribuir)} rateado igualmente em ${n} parcela(s).`,
    })
  }

  // Adicionar uma nova parcela ao grupo (aumenta N)
  const handleAdicionarParcela = () => {
    const ultimaParcela = itensParcelas[itensParcelas.length - 1]
    let proxVenc = toInputDate(new Date().toISOString())
    if (ultimaParcela?.vencimento) {
      const parts = ultimaParcela.vencimento.split('-').map(Number)
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
        d.setMonth(d.getMonth() + 1)
        proxVenc = toInputDate(d.toISOString())
      }
    }

    const novoNum = itensParcelas.length + 1
    const nova: ItemEdicaoParcela = {
      numero: novoNum,
      vencimento: proxVenc,
      valor: 0,
      valorRecebido: 0,
      status: 'Aberta',
      isOriginalExistente: false,
      isReadOnlyQuitada: false,
      nota: tituloBase?.nota,
    }

    setItensParcelas([...itensParcelas, nova])
  }

  // Remover parcela criada ou em aberto (se não quitada)
  const handleRemoverParcela = (index: number) => {
    const parc = itensParcelas[index]
    if (parc.isReadOnlyQuitada) {
      toast({
        title: 'Não é possível remover',
        description: 'Parcelas já recebidas/quitadas não podem ser excluídas.',
        variant: 'destructive',
      })
      return
    }

    const novas = itensParcelas.filter((_, idx) => idx !== index)
    // Renumera
    const renumeradas = novas.map((p, idx) => ({ ...p, numero: idx + 1 }))
    setItensParcelas(renumeradas)
  }

  // Salvar alterações no banco de dados
  const handleSalvar = async () => {
    if (!currentEmpresa || !tituloBase) return

    if (!somaValida) {
      toast({
        title: 'Soma inconsistente',
        description:
          diferencaComTotalOriginal > 0
            ? `A soma das parcelas falta ${formatCurrency(diferencaComTotalOriginal)} para fechar ${formatCurrency(valorTotalGrupo)}.`
            : `A soma das parcelas ultrapassa ${formatCurrency(Math.abs(diferencaComTotalOriginal))} do total de ${formatCurrency(valorTotalGrupo)}.`,
        variant: 'destructive',
      })
      return
    }

    // Valida datas
    for (const p of itensParcelas) {
      if (!p.vencimento) {
        toast({
          title: 'Data inválida',
          description: `Preencha o vencimento de todas as parcelas (parcela ${p.numero}ª sem data).`,
          variant: 'destructive',
        })
        return
      }
      if (p.valor <= 0) {
        toast({
          title: 'Valor inválido',
          description: `O valor da parcela ${p.numero}ª deve ser maior que zero.`,
          variant: 'destructive',
        })
        return
      }
    }

    try {
      setSalvando(true)
      const totalParcelasFinal = itensParcelas.length
      const baseLimpa = baseDescricaoGrupo || 'Título a Receber'

      // IDs que existiam no banco mas foram excluídos na interface
      const idsMantidos = new Set(itensParcelas.map((p) => p.id).filter(Boolean) as string[])
      const titulosExcluidos = titulosIrmaosCarregados.filter((t) => !idsMantidos.has(t.id))

      // 1. Excluir títulos removidos
      for (const t of titulosExcluidos) {
        await pb.collection('contas_receber').delete(t.id)
        await historicoService.registrar({
          empresaId: currentEmpresa.id,
          colecaoOrigem: 'contas_receber',
          registroId: t.id,
          acao: 'excluir',
          usuarioId: user?.id,
          usuarioNome: user?.name || user?.email || 'Usuário',
          descricao: `Parcela removida durante a reestruturação do parcelamento (${t.descricao || t.id}).`,
          detalhes: {
            valor: t.valor,
            extra: {
              titulo_base_id: tituloBase.id,
            },
          },
        })
      }

      // 2. Atualizar ou Criar parcelas
      for (let i = 0; i < itensParcelas.length; i++) {
        const p = itensParcelas[i]
        const descParcela =
          totalParcelasFinal > 1 ? `${baseLimpa} (${p.numero}/${totalParcelasFinal})` : baseLimpa

        const vencIso = new Date(`${p.vencimento}T12:00:00Z`).toISOString()

        if (p.id) {
          // Atualiza registro existente
          const registroAntes = titulosIrmaosCarregados.find((t) => t.id === p.id)
          await pb.collection('contas_receber').update(p.id, {
            descricao: descParcela,
            valor: p.valor,
            valor_bruto: p.valor,
            vencimento: vencIso,
            parcelas: totalParcelasFinal,
          })

          await historicoService.registrar({
            empresaId: currentEmpresa.id,
            colecaoOrigem: 'contas_receber',
            registroId: p.id,
            acao: 'editar',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Parcela ${p.numero}/${totalParcelasFinal} atualizada via "Editar parcelas": valor ${formatCurrency(p.valor)}, vencimento ${formatDate(vencIso)}.`,
            detalhes: {
              valor: p.valor,
              extra: {
                valor_anterior: registroAntes?.valor,
                vencimento_anterior: registroAntes?.vencimento,
                titulo_base_id: tituloBase.id,
                total_parcelas: totalParcelasFinal,
              },
            },
          })
        } else {
          // Cria nova parcela
          const novaConta = await pb.collection('contas_receber').create<ContaReceber>({
            empresa_id: currentEmpresa.id,
            cliente_id: tituloBase.cliente_id || null,
            cliente_depositante: tituloBase.cliente_depositante || '',
            categoria_id: tituloBase.categoria_id || null,
            centro_custo_id: tituloBase.centro_custo_id || null,
            descricao: descParcela,
            valor: p.valor,
            valor_bruto: p.valor,
            valor_recebido: 0,
            vencimento: vencIso,
            data_emissao: tituloBase.data_emissao || undefined,
            parcelas: totalParcelasFinal,
            status: 'Aberta',
            forma_recebimento: tituloBase.forma_recebimento || null,
            endereco: tituloBase.endereco || '',
            nota: tituloBase.nota || '',
            observacoes: `[Parcela ${p.numero}/${totalParcelasFinal} adicionada via edição de parcelas do título ${tituloBase.id}]`,
          })

          await historicoService.registrar({
            empresaId: currentEmpresa.id,
            colecaoOrigem: 'contas_receber',
            registroId: novaConta.id,
            acao: 'criar',
            usuarioId: user?.id,
            usuarioNome: user?.name || user?.email || 'Usuário',
            descricao: `Nova parcela ${p.numero}/${totalParcelasFinal} criada no valor de ${formatCurrency(p.valor)} para vencimento em ${formatDate(vencIso)}.`,
            detalhes: {
              valor: p.valor,
              extra: {
                titulo_base_id: tituloBase.id,
                parcela: `${p.numero}/${totalParcelasFinal}`,
              },
            },
          })
        }
      }

      toast({
        title: 'Parcelas atualizadas com sucesso!',
        description: `Todas as ${totalParcelasFinal} parcelas foram salvas e totalizam ${formatCurrency(somaAtualTotal)}.`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Erro ao salvar parcelas:', err)
      toast({
        title: 'Erro ao salvar parcelas',
        description: err.message || 'Falha ao gravar no banco.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-[#ECEAE4]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-800">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Editar Parcelas do Título
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {baseDescricaoGrupo || 'Título a Receber'}
                {tituloBase?.nota ? ` • Doc/NF: ${tituloBase.nota}` : ''}
                {tituloBase?.expand?.cliente_id?.nome
                  ? ` • Cliente: ${tituloBase.expand.cliente_id.nome}`
                  : ''}
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-500">
            Carregando parcelas do título...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* KPI do Grupo */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                  Valor Total do Grupo
                </span>
                <strong className="text-gray-900 font-mono text-sm">
                  {formatCurrency(valorTotalGrupo)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 uppercase font-semibold block">
                  Já Recebido (Travado)
                </span>
                <strong className="text-emerald-800 font-mono text-sm">
                  {formatCurrency(totalRecebidoTravado)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-semibold block">
                  Saldo em Aberto
                </span>
                <strong className="text-amber-800 font-mono text-sm">
                  {formatCurrency(saldoAbertoParaDistribuir)}
                </strong>
              </div>
            </div>

            {/* Barra de Ações Rápidas */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                Grade de Parcelas ({itensParcelas.length})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDistribuirIgualmente}
                  className="h-7 text-xs border-teal-300 text-teal-800 hover:bg-teal-50"
                  title="Distribuir o saldo em aberto igualmente entre as parcelas não quitadas"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Distribuir igualmente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAdicionarParcela}
                  className="h-7 text-xs border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar parcela
                </Button>
              </div>
            </div>

            {/* Listagem com uma linha por parcela */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {itensParcelas.map((parc, idx) => {
                const isQuitada = Boolean(parc.isReadOnlyQuitada)
                return (
                  <div
                    key={parc.id || `nova-${parc.numero}-${idx}`}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                      isQuitada
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="w-16 shrink-0 pl-1">
                      <span className="text-xs font-bold text-gray-700 block">
                        {parc.numero}ª parc.
                      </span>
                      {isQuitada ? (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Quitada
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-gray-300 text-gray-500"
                        >
                          {parc.status}
                        </Badge>
                      )}
                    </div>

                    {/* Vencimento Editável */}
                    <div className="flex-1">
                      <Label className="text-[10px] text-gray-500 block mb-0.5">Vencimento</Label>
                      <Input
                        type="date"
                        required
                        disabled={isQuitada}
                        value={parc.vencimento}
                        onChange={(e) => handleChangeVencimento(idx, e.target.value)}
                        className="h-8 text-xs font-mono bg-gray-50/50 hover:bg-white focus:bg-white"
                        title={isQuitada ? 'Parcela quitada: data bloqueada' : 'Data de vencimento'}
                      />
                    </div>

                    {/* Valor Editável */}
                    <div className="w-32 shrink-0">
                      <Label className="text-[10px] text-gray-500 block mb-0.5">Valor (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-[10px] text-gray-400 font-medium">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          disabled={isQuitada}
                          value={parc.valor !== undefined ? parc.valor : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            handleChangeValor(idx, val)
                          }}
                          className="h-8 pl-7 pr-2 text-xs font-mono font-bold text-right bg-gray-50/50 hover:bg-white focus:bg-white"
                          title={
                            isQuitada ? 'Parcela quitada: valor bloqueado' : 'Valor da parcela'
                          }
                        />
                      </div>
                    </div>

                    {/* Ação Excluir (somente se não quitada e se tiver mais de 1 parcela) */}
                    {!isQuitada && itensParcelas.length > 1 && (
                      <div className="pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoverParcela(idx)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Remover esta parcela"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Validação da Soma em Tempo Real */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                somaValida
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {somaValida ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="font-semibold block">
                    Soma das Parcelas:{' '}
                    <strong className="font-mono">{formatCurrency(somaAtualTotal)}</strong>
                  </span>
                  <span className="text-[11px] text-gray-600">
                    Total original a fechar:{' '}
                    <strong className="font-mono">{formatCurrency(valorTotalGrupo)}</strong>
                  </span>
                </div>
              </div>

              <div className="text-right">
                {somaValida ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                    ✓ Soma Exata
                  </Badge>
                ) : (
                  <div className="text-[11px] font-bold text-amber-900">
                    {diferencaComTotalOriginal > 0 ? (
                      <span>Falta {formatCurrency(diferencaComTotalOriginal)}</span>
                    ) : (
                      <span>Ultrapassa {formatCurrency(Math.abs(diferencaComTotalOriginal))}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!somaValida && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ⚠️ Para salvar, a soma dos valores de todas as parcelas deve coincidir exatamente
                com o saldo total do grupo (diferença atual:{' '}
                {formatCurrency(Math.abs(diferencaComTotalOriginal))}). Use o botão{' '}
                <strong>"Distribuir igualmente"</strong> se desejar que o sistema re-rateie
                automaticamente.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="p-4 bg-gray-50 border-t border-[#ECEAE4] flex justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={salvando}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={salvando || !somaValida || loading}
            onClick={handleSalvar}
            className="bg-teal-700 hover:bg-teal-800 text-white font-medium"
          >
            {salvando ? 'Salvando Parcelas...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
