import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/formatters'
import { historicoService } from '@/services/historico'
import { ACOES_CONFIG } from '@/components/financeiro/HistoricoSecao'
import type { HistoricoAlteracao, AcaoHistorico, ColecaoOrigemHistorico } from '@/types/erp'
import { History, Search, RefreshCw, ChevronDown, ChevronUp, Clock, Filter } from 'lucide-react'

interface HistoricoGeralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  colecaoPadrao?: ColecaoOrigemHistorico | 'todas'
}

export const HistoricoGeralModal: React.FC<HistoricoGeralModalProps> = ({
  open,
  onOpenChange,
  empresaId,
  colecaoPadrao = 'todas',
}) => {
  const [itens, setItens] = useState<HistoricoAlteracao[]>([])
  const [loading, setLoading] = useState(false)
  const [colecaoFiltro, setColecaoFiltro] = useState<string>(colecaoPadrao)
  const [acaoFiltro, setAcaoFiltro] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [itemExpandido, setItemExpandido] = useState<string | null>(null)

  const carregar = async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const res = await historicoService.listarGeral(empresaId, {
        colecao: colecaoFiltro as any,
        acao: acaoFiltro as any,
        perPage: 100,
      })
      setItens(res.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setColecaoFiltro(colecaoPadrao)
      carregar()
    }
  }, [open, empresaId, colecaoPadrao])

  useEffect(() => {
    if (open) {
      carregar()
    }
  }, [colecaoFiltro, acaoFiltro])

  const itensFiltrados = itens.filter((it) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      it.descricao.toLowerCase().includes(q) ||
      it.usuario_nome.toLowerCase().includes(q) ||
      it.registro_id.toLowerCase().includes(q)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-[#ECEAE4]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Trilha de Auditoria & Histórico de Modificações
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Registro completo e transparente de todas as ações em títulos financeiros
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregar}
              disabled={loading}
              className="text-xs border-[#ECEAE4] rounded-xl h-8 text-gray-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <Input
                placeholder="Filtrar por texto ou usuário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 text-xs bg-[#FAF9F7] border-[#ECEAE4] h-8 rounded-xl"
              />
            </div>

            <Select value={colecaoFiltro} onValueChange={setColecaoFiltro}>
              <SelectTrigger className="text-xs bg-[#FAF9F7] border-[#ECEAE4] h-8 rounded-xl">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os Módulos</SelectItem>
                <SelectItem value="contas_pagar">Contas a Pagar</SelectItem>
                <SelectItem value="contas_receber">Contas a Receber</SelectItem>
              </SelectContent>
            </Select>

            <Select value={acaoFiltro} onValueChange={setAcaoFiltro}>
              <SelectTrigger className="text-xs bg-[#FAF9F7] border-[#ECEAE4] h-8 rounded-xl">
                <SelectValue placeholder="Tipo de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Ações</SelectItem>
                <SelectItem value="criar">Criações</SelectItem>
                <SelectItem value="editar">Edições</SelectItem>
                <SelectItem value="baixa">Baixas / Pagamentos</SelectItem>
                <SelectItem value="estorno">Estornos</SelectItem>
                <SelectItem value="excluir">Exclusões</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Carregando histórico geral...
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <p className="text-xs font-semibold text-gray-700">
                Nenhum registro de histórico encontrado
              </p>
              <p className="text-[11px] text-gray-500">
                As ações executadas a partir de hoje aparecerão automaticamente aqui.
              </p>
            </div>
          ) : (
            itensFiltrados.map((item) => {
              const config = ACOES_CONFIG[item.acao] || ACOES_CONFIG.editar
              const Icon = config.icon
              const temDiff = Boolean(
                item.detalhes?.alteracoes && item.detalhes.alteracoes.length > 0,
              )
              const isExpanded = itemExpandido === item.id

              return (
                <div
                  key={item.id}
                  className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] text-xs space-y-2 hover:bg-[#f6f4ee] transition-colors"
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
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-gray-200/70 text-gray-700 font-medium"
                      >
                        {item.colecao_origem === 'contas_pagar'
                          ? 'Contas a Pagar'
                          : item.colecao_origem === 'contas_receber'
                            ? 'Contas a Receber'
                            : item.colecao_origem === 'vendas'
                              ? 'Vendas Pedreira'
                              : 'Outro'}
                      </Badge>
                      <span className="font-semibold text-gray-900 text-xs">
                        {item.usuario_nome || 'Usuário'}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(item.created)}
                    </span>
                  </div>

                  <p className="text-gray-800 text-[11px] leading-relaxed font-medium">
                    {item.descricao}
                  </p>

                  {item.detalhes?.movimento_inverso && (
                    <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                      <span>
                        Movimento Caixa Inverso:{' '}
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

                  {temDiff && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setItemExpandido(isExpanded ? null : item.id)}
                        className="text-[10px] text-teal-800 hover:text-teal-950 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" /> Ocultar detalhes (
                            {item.detalhes!.alteracoes!.length})
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" /> Ver campos alterados (
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
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
