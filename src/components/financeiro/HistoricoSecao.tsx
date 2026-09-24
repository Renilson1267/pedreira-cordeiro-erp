import React, { useEffect, useState, useMemo } from 'react'
import type { HistoricoAlteracao, AcaoHistorico } from '@/types/erp'
import { historicoService } from '@/services/historico'
import { formatDateTime } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Clock,
  History,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface HistoricoSecaoProps {
  registroId: string
  colecaoOrigem: 'contas_pagar' | 'contas_receber'
  tituloDescricao?: string
  className?: string
}

export const ACOES_CONFIG: Record<
  AcaoHistorico,
  {
    label: string
    badgeClass: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  criar: {
    label: 'Criação',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    icon: PlusCircle,
  },
  editar: {
    label: 'Edição',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
    icon: Edit,
  },
  baixa: {
    label: 'Baixa / Pagamento',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',
    icon: CheckCircle2,
  },
  estorno: {
    label: 'Estorno',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
    icon: RotateCcw,
  },
  excluir: {
    label: 'Exclusão',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
    icon: Trash2,
  },
}

export const HistoricoSecao: React.FC<HistoricoSecaoProps> = ({
  registroId,
  colecaoOrigem,
  className = '',
}) => {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([])
  const [loading, setLoading] = useState(true)
  const [itemExpandido, setItemExpandido] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      setLoading(true)
      try {
        const dados = await historicoService.listarPorRegistro(registroId, colecaoOrigem)
        if (ativo) {
          setHistorico(dados)
          // Se tiver apenas 1 ou edições, podemos deixar o primeiro expandido se tiver detalhes
          if (dados.length > 0 && dados[0].detalhes?.alteracoes?.length) {
            setItemExpandido(dados[0].id)
          }
        }
      } finally {
        if (ativo) setLoading(false)
      }
    }

    if (registroId) {
      carregar()
    } else {
      setHistorico([])
      setLoading(false)
    }

    return () => {
      ativo = false
    }
  }, [registroId, colecaoOrigem])

  const toggleExpand = (id: string) => {
    setItemExpandido((prev) => (prev === id ? null : id))
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
          <History className="w-3.5 h-3.5 text-teal-700" />
          <span>Histórico de Alterações</span>
          {historico.length > 0 && (
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full">
              {historico.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Ordem cronológica
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-400">
          Carregando histórico do título...
        </div>
      ) : historico.length === 0 ? (
        <div className="p-4 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] text-center space-y-1">
          <div className="flex items-center justify-center text-teal-700">
            <Info className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-gray-700">
            Nenhuma alteração registrada para este título.
          </p>
          <p className="text-[11px] text-gray-500">
            O histórico e a trilha de auditoria começam a ser gravados a partir de hoje.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {historico.map((item) => {
            const config = ACOES_CONFIG[item.acao] || ACOES_CONFIG.editar
            const Icon = config.icon
            const temDiff = Boolean(
              item.detalhes?.alteracoes && item.detalhes.alteracoes.length > 0,
            )
            const isExpanded = itemExpandido === item.id

            return (
              <div
                key={item.id}
                className="p-3 bg-[#FAF9F7] hover:bg-[#f6f4ee] transition-colors rounded-xl border border-[#ECEAE4] space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${config.badgeClass}`}
                    >
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                    <span className="font-semibold text-gray-900 text-[11px]">
                      {item.usuario_nome || 'Usuário'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 shrink-0">
                    {formatDateTime(item.created)}
                  </span>
                </div>

                <p className="text-gray-700 text-[11px] leading-relaxed">{item.descricao}</p>

                {/* Movimento de caixa inverso para estorno */}
                {item.detalhes?.movimento_inverso && (
                  <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                    <span>
                      Movimento no Caixa:{' '}
                      <strong>
                        {item.detalhes.movimento_inverso.tipo === 'Entrada'
                          ? 'Entrada (+)'
                          : 'Saída (-)'}
                      </strong>
                    </span>
                    <span className="font-mono font-bold">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(item.detalhes.movimento_inverso.valor)}
                    </span>
                  </div>
                )}

                {/* Bloco de diff campo a campo se for edição */}
                {temDiff && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="text-[10px] text-teal-800 hover:text-teal-950 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Ocultar campos alterados (
                          {item.detalhes!.alteracoes!.length})
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> Ver detalhes das alterações (
                          {item.detalhes!.alteracoes!.length})
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-teal-600/30">
                        {item.detalhes!.alteracoes!.map((diff, idx) => (
                          <div
                            key={idx}
                            className="bg-white/90 p-2 rounded-lg border border-[#ECEAE4] text-[11px]"
                          >
                            <span className="font-semibold text-gray-800 block text-[10px] uppercase text-teal-900">
                              {diff.campo_label || diff.campo}:
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] flex-wrap">
                              <span className="line-through text-red-600 bg-red-50 px-1 py-0.5 rounded">
                                {diff.valor_anterior_formatado || '—'}
                              </span>
                              <span className="text-gray-400 font-sans">→</span>
                              <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-semibold">
                                {diff.valor_novo_formatado || '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
