import type { ContaReceber, StatusContaReceber } from '@/types/erp'

/**
 * Interface mínima aceita para o cálculo de valores de recebimentos.
 * Permite passar ContaReceber completa ou objetos parciais/leves retornados por consultas.
 */
export interface ItemRecebimentoCalculo {
  id?: string
  valor?: number
  valor_recebido?: number
  valor_desconto?: number
  status?: StatusContaReceber | string
  vencimento?: string
  data_recebimento?: string | null
  forma_recebimento?: string | null
}

export interface TotaisRecebimentos {
  aberto: number
  vencido: number
  recebido: number
  antecipado: number
  totalNominal: number
  totalDesconto: number
  saldoRestante: number
  qtdTotal: number
}

/**
 * Retorna o valor efetivamente recebido de um título:
 * - Se status === 'Recebida': fallback nominal se valor_recebido <= 0 (mesmo padrão de Contas a Pagar).
 * - Se status === 'Parcial': valor_recebido efetivo somado (comum em títulos quitados em frações/Dividido).
 * - Outros status: valor_recebido ou 0.
 */
export function getValorRecebidoEfetivo(c: ItemRecebimentoCalculo): number {
  const valTotal = Number(c.valor || 0)
  const valRec = Number(c.valor_recebido || 0)

  if (c.status === 'Recebida') {
    return valRec > 0 ? valRec : valTotal
  }
  return valRec > 0 ? valRec : 0
}

/**
 * Retorna o saldo restante em aberto de um título:
 * - Se status === 'Recebida': 0 (título já quitado integralmente).
 * - Se status === 'Parcial' ou outro: Math.max(0, valor nominal - valor efetivamente recebido).
 */
export function getSaldoRestante(c: ItemRecebimentoCalculo): number {
  if (c.status === 'Recebida') return 0
  const valTotal = Number(c.valor || 0)
  const jaRecebido = getValorRecebidoEfetivo(c)
  return Math.max(0, valTotal - jaRecebido)
}

/**
 * Verifica se um título está vencido com base na data de corte (formato ISO YYYY-MM-DD).
 */
export function isTituloReceberVencido(c: ItemRecebimentoCalculo, dataCorteISO?: string): boolean {
  if (c.status === 'Recebida' || c.status === 'Recebimento Antecipado') return false
  if (c.status === 'Vencida') return true

  const corte = dataCorteISO || new Date().toISOString().slice(0, 10)
  const venc = c.vencimento ? c.vencimento.slice(0, 10) : ''
  return Boolean(venc && venc < corte)
}

/**
 * Função centralizada de totalização de recebimentos.
 * Usada por:
 * 1. Cards KPI de ContasReceber.tsx (carregarTotaisCards)
 * 2. Totalizadores do rodapé da listagem e totalizadoresRelatorioReceber
 * 3. Impressão A4 (RelatorioListagemImpressaoModal)
 * 4. Fechamento por Centro de Custo / Relatórios
 *
 * Regras implementadas:
 * - Título 'Recebida': valorEfetivo = valor_recebido > 0 ? valor_recebido : valor (fallback nominal).
 * - Título 'Parcial' (comum em Dividido): somar Number(valor_recebido || 0) no card Recebido e o residual Math.max(0, valor - valor_recebido) em Em Aberto/Vencido.
 * - Tratar títulos sem data_recebimento como válidos (nulo/vazio não descarta da soma de recebidos se estiverem quitados).
 */
export function calcularTotaisRecebimentos(
  itens: ItemRecebimentoCalculo[],
  dataCorteISO?: string,
): TotaisRecebimentos {
  const corte = dataCorteISO || new Date().toISOString().slice(0, 10)

  let aberto = 0
  let vencido = 0
  let recebido = 0
  let antecipado = 0
  let totalNominal = 0
  let totalDesconto = 0
  let saldoRestante = 0

  for (const item of itens) {
    const valTotal = Number(item.valor || 0)
    const valDesc = Number(item.valor_desconto || 0)
    const valRecEfetivo = getValorRecebidoEfetivo(item)
    const saldo = getSaldoRestante(item)

    totalNominal += valTotal
    totalDesconto += valDesc
    recebido += valRecEfetivo
    saldoRestante += saldo

    if (item.status === 'Recebimento Antecipado') {
      antecipado += valTotal
    } else if (item.status === 'Recebida') {
      // Título quitado integralmente: já computado em recebido
    } else {
      // Aberto ou Parcial: o saldo residual é classificado em Vencido ou Em Aberto
      const venc = item.vencimento ? item.vencimento.slice(0, 10) : ''
      const isAtrasado = Boolean(venc && venc < corte)

      if (item.status === 'Vencida' || isAtrasado) {
        vencido += saldo
      } else {
        aberto += saldo
      }
    }
  }

  return {
    aberto: Number(aberto.toFixed(2)),
    vencido: Number(vencido.toFixed(2)),
    recebido: Number(recebido.toFixed(2)),
    antecipado: Number(antecipado.toFixed(2)),
    totalNominal: Number(totalNominal.toFixed(2)),
    totalDesconto: Number(totalDesconto.toFixed(2)),
    saldoRestante: Number(saldoRestante.toFixed(2)),
    qtdTotal: itens.length,
  }
}
