import { toInputDate } from '@/lib/formatters'

export type OpcaoPeriodoRapido = 'todos' | 'este_mes' | 'mes_passado' | 'este_ano' | 'custom'

export interface IntervaloDatas {
  inicio: string // YYYY-MM-DD ou ''
  fim: string // YYYY-MM-DD ou ''
}

/**
 * Calcula as datas de início e fim baseadas na opção rápida selecionada.
 */
export function calcularDatasPeriodoRapido(opcao: OpcaoPeriodoRapido | string): IntervaloDatas {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()

  if (opcao === 'todos') {
    return { inicio: '', fim: '' }
  }

  if (opcao === 'este_mes') {
    const primeiroDia = new Date(y, m, 1)
    const ultimoDia = new Date(y, m + 1, 0)
    return {
      inicio: toInputDate(primeiroDia.toISOString()),
      fim: toInputDate(ultimoDia.toISOString()),
    }
  }

  if (opcao === 'mes_passado') {
    const primeiroDia = new Date(y, m - 1, 1)
    const ultimoDia = new Date(y, m, 0)
    return {
      inicio: toInputDate(primeiroDia.toISOString()),
      fim: toInputDate(ultimoDia.toISOString()),
    }
  }

  if (opcao === 'este_ano') {
    const primeiroDia = new Date(y, 0, 1)
    const ultimoDia = new Date(y, 11, 31)
    return {
      inicio: toInputDate(primeiroDia.toISOString()),
      fim: toInputDate(ultimoDia.toISOString()),
    }
  }

  return { inicio: '', fim: '' }
}

/**
 * Verifica se uma data em formato ISO ou YYYY-MM-DD está dentro do intervalo [inicio, fim].
 */
export function estaDentroDoPeriodo(
  dataIsoOuString: string | undefined | null,
  dataInicio: string,
  dataFim: string,
): boolean {
  if (!dataInicio && !dataFim) return true
  if (!dataIsoOuString) return false

  const dataCurta = dataIsoOuString.slice(0, 10)
  if (dataInicio && dataCurta < dataInicio) return false
  if (dataFim && dataCurta > dataFim) return false
  return true
}

export const OPCOES_PERIODO_PADRAO = [
  { id: 'todos', label: 'Todo o período' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: 'este_ano', label: 'Este ano' },
] as const
