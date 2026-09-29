import React from 'react'
import { Calendar, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

export interface ItemParcela {
  numero: number
  vencimento: string // YYYY-MM-DD
  valor: number
}

export type TipoPrazo = 'mensal' | '7' | '15' | '21' | '28'

export interface SeletorParcelasProps {
  parcelas: number
  onChangeParcelas: (num: number) => void
  prazoSelecionado: TipoPrazo
  onSelecionarPrazo: (prazo: TipoPrazo) => void
  listaParcelas: ItemParcela[]
  onChangeDataParcela: (index: number, novaData: string) => void
  onChangeValorParcela?: (index: number, novoValor: number) => void
  valorTotal: number
}

// Utilitários para datas (sem timezone offset pitfalls)
export function parseDateInput(str: string): Date {
  const parts = str.split('-').map(Number)
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
  }
  return new Date()
}

export function formatDateInput(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Gera as datas e valores das parcelas a partir da data base e do tipo de prazo.
 * Se prazo for '7', '15', '21' ou '28':
 *   parcela 1 = baseDate
 *   parcela 2 = baseDate + intervalo
 *   parcela 3 = baseDate + 2*intervalo
 * Se for 'mensal':
 *   parcela 1 = baseDate
 *   parcela i = baseDate com + (i - 1) meses
 */
export function gerarGradeParcelas(
  baseDateStr: string,
  numParcelas: number,
  tipoPrazo: TipoPrazo,
  valorTotal: number,
): ItemParcela[] {
  const total = Math.max(0, valorTotal || 0)
  const n = Math.max(1, Math.min(36, numParcelas || 1))
  // Parcelas 1..n-1 usam floor((total/n)*100)/100; a última parcela absorve os centavos restantes
  const valorUnitario = total > 0 ? Math.floor((total / n) * 100) / 100 : 0

  const baseDate = parseDateInput(baseDateStr || formatDateInput(new Date()))

  const itens: ItemParcela[] = []

  for (let i = 0; i < n; i++) {
    const d = new Date(baseDate.getTime())

    if (tipoPrazo === 'mensal') {
      d.setMonth(baseDate.getMonth() + i)
    } else {
      const diasIntervalo = Number(tipoPrazo)
      d.setDate(baseDate.getDate() + i * diasIntervalo)
    }

    // Ajusta centavos na última parcela para somar exatamente o total
    let valorParcela = valorUnitario
    if (i === n - 1 && total > 0) {
      const somaAnteriores = Number((valorUnitario * (n - 1)).toFixed(2))
      const diff = Number((total - somaAnteriores).toFixed(2))
      if (diff > 0) {
        valorParcela = diff
      }
    }

    itens.push({
      numero: i + 1,
      vencimento: formatDateInput(d),
      valor: valorParcela,
    })
  }

  return itens
}

export const PRAZOS_RAPIDOS: { label: string; valor: TipoPrazo; descricao: string }[] = [
  { label: '7 dias', valor: '7', descricao: 'A cada 7 dias (ex.: semanal)' },
  { label: '15 dias', valor: '15', descricao: 'A cada 15 dias (quinzenal)' },
  { label: '21 dias', valor: '21', descricao: 'A cada 21 dias' },
  { label: '28 dias', valor: '28', descricao: 'A cada 28 dias (4 semanas)' },
  { label: 'Mensal (30d)', valor: 'mensal', descricao: 'Mesmo dia nos meses seguintes' },
]

export const SeletorParcelas: React.FC<SeletorParcelasProps> = ({
  parcelas,
  onChangeParcelas,
  prazoSelecionado,
  onSelecionarPrazo,
  listaParcelas,
  onChangeDataParcela,
  valorTotal,
}) => {
  return (
    <div className="space-y-3 p-3.5 bg-gray-50/75 rounded-2xl border border-gray-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Label className="text-xs font-semibold text-gray-800">Número de Parcelas</Label>
          <p className="text-[11px] text-gray-500">
            Define a divisão do valor e a quantidade de vencimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max="36"
            value={parcelas}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1
              onChangeParcelas(Math.max(1, Math.min(36, val)))
            }}
            className="w-24 font-mono font-semibold text-center bg-white h-9"
          />
          <span className="text-xs text-gray-500">
            {parcelas > 1 ? 'parcelas' : 'parcela (1x)'}
          </span>
        </div>{' '}
      </div>

      {parcelas > 1 && (
        <>
          {/* Prazos Rápidos: 7, 15, 21, 28 dias e Mensal */}
          <div className="space-y-1.5 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                Intervalo / Prazos Rápidos
              </span>
              <span className="text-[11px] text-gray-500">
                Selecione para calcular os vencimentos
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {PRAZOS_RAPIDOS.map((p) => {
                const isActive = prazoSelecionado === p.valor
                return (
                  <Button
                    key={p.valor}
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => onSelecionarPrazo(p.valor)}
                    className={`h-8 text-xs font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                    title={p.descricao}
                  >
                    {p.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Grade de Parcelas com Datas Editáveis/Digitáveis */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>Vencimentos das Parcelas</span>
              </div>
              <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md font-medium border border-teal-200">
                ✍️ Datas liberadas para digitação
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 rounded-lg">
              {listaParcelas.map((parc, idx) => (
                <div
                  key={parc.numero}
                  className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-200 hover:border-teal-300 transition-colors shadow-2xs"
                >
                  <span className="w-14 text-[11px] font-bold text-gray-600 pl-1 shrink-0">
                    {parc.numero}ª parc.
                  </span>

                  <div className="flex-1">
                    <Input
                      type="date"
                      required
                      value={parc.vencimento}
                      onChange={(e) => onChangeDataParcela(idx, e.target.value)}
                      className="h-8 text-xs font-mono font-medium bg-gray-50/50 hover:bg-white focus:bg-white"
                      title={`Data de vencimento da ${parc.numero}ª parcela`}
                    />
                  </div>

                  <div className="w-24 text-right pr-1 shrink-0">
                    <span className="text-xs font-bold text-gray-800 tabular-nums">
                      {formatCurrency(parc.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-gray-500 pt-1">
              <Info className="w-3 h-3 shrink-0 text-gray-400" />
              <span>
                Você pode alterar livremente a data de qualquer parcela acima. O sistema respeita as
                datas digitadas.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
