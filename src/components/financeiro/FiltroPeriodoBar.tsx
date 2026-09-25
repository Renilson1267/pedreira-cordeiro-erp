import React from 'react'
import { Calendar, X, Printer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  OPCOES_PERIODO_PADRAO,
  calcularDatasPeriodoRapido,
  type OpcaoPeriodoRapido,
} from '@/lib/periodo'

export interface CampoDataOpcao {
  value: string
  label: string
}

export interface FiltroPeriodoBarProps {
  /** Opção rápida selecionada: 'todos' | 'este_mes' | 'mes_passado' | 'este_ano' | 'custom' */
  opcaoPeriodo: string
  onOpcaoChange: (novaOpcao: string) => void

  /** Data início YYYY-MM-DD */
  dataInicio: string
  onDataInicioChange: (data: string) => void

  /** Data fim YYYY-MM-DD */
  dataFim: string
  onDataFimChange: (data: string) => void

  /** Campo de data selecionado (opcional - usado quando há mais de uma data, ex: Vencimento vs Emissão) */
  campoData?: string
  onCampoDataChange?: (campo: string) => void
  camposDataOpcoes?: CampoDataOpcao[]

  /** Ação ao clicar em limpar filtros */
  onLimpar?: () => void
  mostrarLimpar?: boolean

  /** Ação ao clicar em imprimir relatório dos itens */
  onImprimir?: () => void
  /** Rótulo do botão imprimir (ex: "Imprimir selecionados (3)" ou "Imprimir") */
  rotuloImprimir?: string
  /** Quantidade de itens selecionados por checkbox (se houver) */
  totalSelecionados?: number

  /** Rótulo principal */
  rotulo?: string

  /** Classe extra para o container */
  className?: string
}

export const FiltroPeriodoBar: React.FC<FiltroPeriodoBarProps> = ({
  opcaoPeriodo,
  onOpcaoChange,
  dataInicio,
  onDataInicioChange,
  dataFim,
  onDataFimChange,
  campoData,
  onCampoDataChange,
  camposDataOpcoes,
  onLimpar,
  mostrarLimpar,
  onImprimir,
  rotuloImprimir,
  totalSelecionados,
  rotulo = 'Filtrar por período:',
  className = '',
}) => {
  const handleSelecionarRapido = (opcaoId: string) => {
    onOpcaoChange(opcaoId)
    const { inicio, fim } = calcularDatasPeriodoRapido(opcaoId as OpcaoPeriodoRapido)
    onDataInicioChange(inicio)
    onDataFimChange(fim)
  }

  const temFiltroAtivo = Boolean(
    dataInicio || dataFim || (opcaoPeriodo && opcaoPeriodo !== 'todos'),
  )
  const exibirBotaoLimpar = mostrarLimpar !== undefined ? mostrarLimpar : temFiltroAtivo

  return (
    <div
      className={`pt-2 border-t border-[#ECEAE4] flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center text-gray-600 font-medium text-xs">
          <Calendar className="w-3.5 h-3.5 mr-1 text-teal-700" />
          {rotulo}
        </span>

        {/* Seletor de campo de data (ex.: Vencimento / Emissão / Pagamento) */}
        {campoData && onCampoDataChange && camposDataOpcoes && camposDataOpcoes.length > 0 && (
          <Select value={campoData} onValueChange={onCampoDataChange}>
            <SelectTrigger className="w-[155px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-8 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {camposDataOpcoes.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Botões Rápidos */}
        <div className="flex items-center gap-1 bg-[#FAF9F7] p-0.5 rounded-lg border border-[#ECEAE4]">
          {OPCOES_PERIODO_PADRAO.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => handleSelecionarRapido(op.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                opcaoPeriodo === op.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {/* Datas personalizada de / até */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-gray-400 text-[11px]">De:</span>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              onOpcaoChange('custom')
              onDataInicioChange(e.target.value)
            }}
            className="w-36 h-8 text-xs font-mono bg-[#FAF9F7] border-[#ECEAE4] rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 text-[11px]">Até:</span>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => {
              onOpcaoChange('custom')
              onDataFimChange(e.target.value)
            }}
            className="w-36 h-8 text-xs font-mono bg-[#FAF9F7] border-[#ECEAE4] rounded-lg"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onImprimir && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImprimir}
            className={`h-8 px-2.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
              totalSelecionados && totalSelecionados > 0
                ? 'bg-teal-700 text-white hover:bg-teal-800 border-teal-700'
                : 'border-teal-300 text-teal-800 bg-teal-50/60 hover:bg-teal-100/80 hover:text-teal-950'
            }`}
            title={
              totalSelecionados && totalSelecionados > 0
                ? `Imprimir os ${totalSelecionados} itens selecionados`
                : 'Imprimir relatório dos itens filtrados na listagem'
            }
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            {rotuloImprimir ||
              (totalSelecionados && totalSelecionados > 0
                ? `Imprimir Selecionados (${totalSelecionados})`
                : 'Imprimir')}
          </Button>
        )}

        {exibirBotaoLimpar && onLimpar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLimpar}
            className="h-8 px-2 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  )
}
export default FiltroPeriodoBar
