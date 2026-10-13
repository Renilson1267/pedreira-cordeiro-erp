import pb from '@/lib/pocketbase/client'
import type {
  FechamentoMensal,
  ItemDespesaFechamento,
  ContaPagar,
  ContaReceber,
  Abastecimento,
  Venda,
} from '@/types/erp'

export interface CreateFechamentoMensalPayload {
  empresa_id: string
  filial_nome?: string
  competencia: string // YYYY-MM
  mes?: number
  ano?: number
  faturamento?: number
  producao_m3?: number
  valor_medio_m3?: number
  despesas_itens?: ItemDespesaFechamento[]
  total_despesas?: number
  consumo_cimento_kg?: number
  consumo_brita_kg?: number
  consumo_areia_m3?: number
  consumo_po_pedra?: number
  consumo_aditivo?: number
  consumo_combustivel_litros?: number
  consumo_insumos_detalhes?: Record<string, any>
  investimento?: number
  investimento_descricao?: string
  saldo_apos_investimento?: number
  status?: 'rascunho' | 'fechado' | 'entregue_diretoria'
  observacoes?: string
  responsavel_nome?: string
}

export interface UpdateFechamentoMensalPayload extends Partial<CreateFechamentoMensalPayload> {}

export interface PuxarFinanceiroResultado {
  faturamentoSugerido: number
  totalContasReceber: number
  totalVendas: number
  totalDespesasPagas: number
  totalDespesasGerais: number
  despesasSugeridas: ItemDespesaFechamento[]
  combustivelLitrosTotal: number
  producaoM3Sugerida: number
}

export const ITENS_DESPESAS_PADRAO_DIRETORIA = [
  'PRO LAB GABRIEL',
  'USINA',
  'FOLHA DE PAGAMENTO',
  'COMBUSTÍVEL',
  'PEÇAS E MANUTENÇÃO',
  'ALUGUEL E ENERGIA',
  'IMPOSTOS E TAXAS',
  'ALIMENTAÇÃO / REFEIÇÃO',
  'OUTROS',
]

export const fechamentosMensaisService = {
  async listar(empresaId?: string): Promise<FechamentoMensal[]> {
    const filter = empresaId ? `empresa_id = '${empresaId}'` : ''
    return pb.collection('fechamentos_mensais').getFullList<FechamentoMensal>({
      filter,
      sort: '-competencia',
      expand: 'empresa_id',
    })
  },

  async buscarPorId(id: string): Promise<FechamentoMensal> {
    return pb.collection('fechamentos_mensais').getOne<FechamentoMensal>(id, {
      expand: 'empresa_id',
    })
  },

  async buscarPorCompetencia(
    empresaId: string,
    competencia: string,
  ): Promise<FechamentoMensal | null> {
    try {
      const records = await pb.collection('fechamentos_mensais').getFullList<FechamentoMensal>({
        filter: `empresa_id = '${empresaId}' && competencia = '${competencia}'`,
        limit: 1,
        expand: 'empresa_id',
      })
      return records[0] || null
    } catch {
      return null
    }
  },

  async criar(payload: CreateFechamentoMensalPayload): Promise<FechamentoMensal> {
    return pb.collection('fechamentos_mensais').create<FechamentoMensal>(payload)
  },

  async atualizar(id: string, payload: UpdateFechamentoMensalPayload): Promise<FechamentoMensal> {
    return pb.collection('fechamentos_mensais').update<FechamentoMensal>(id, payload)
  },

  async excluir(id: string): Promise<boolean> {
    return pb.collection('fechamentos_mensais').delete(id)
  },

  /**
   * Puxa do módulo financeiro (Contas a Receber, Contas a Pagar, Abastecimentos e Vendas)
   * tudo o que estiver registrado para a filial na competência solicitada (ex: 2026-09).
   */
  async puxarDoFinanceiro(
    empresaId: string,
    ano: number,
    mes: number,
  ): Promise<PuxarFinanceiroResultado> {
    const mStr = String(mes).padStart(2, '0')
    const inicioStr = `${ano}-${mStr}-01 00:00:00.000Z`
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fimStr = `${ano}-${mStr}-${String(ultimoDia).padStart(2, '0')} 23:59:59.999Z`

    // 1. Contas a receber no mês (recebidas ou com vencimento no mês)
    const [contasReceber, contasPagar, abastecimentos, vendas] = await Promise.all([
      pb
        .collection('contas_receber')
        .getFullList<ContaReceber>({
          filter: `empresa_id = '${empresaId}' && ((data_recebimento >= '${inicioStr}' && data_recebimento <= '${fimStr}') || (data_recebimento = '' && vencimento >= '${inicioStr}' && vencimento <= '${fimStr}'))`,
        })
        .catch(() => [] as ContaReceber[]),

      // 2. Contas a pagar no mês
      pb
        .collection('contas_pagar')
        .getFullList<ContaPagar>({
          filter: `empresa_id = '${empresaId}' && ((data_pagamento >= '${inicioStr}' && data_pagamento <= '${fimStr}') || (data_pagamento = '' && vencimento >= '${inicioStr}' && vencimento <= '${fimStr}'))`,
          expand: 'categoria_id,centro_custo_id,fornecedor_id',
        })
        .catch(() => [] as ContaPagar[]),

      // 3. Abastecimentos no mês
      pb
        .collection('abastecimentos')
        .getFullList<Abastecimento>({
          filter: `empresa_id = '${empresaId}' && data >= '${inicioStr}' && data <= '${fimStr}'`,
        })
        .catch(() => [] as Abastecimento[]),

      // 4. Vendas no mês para sugestão de volume m³ e faturamento
      pb
        .collection('vendas')
        .getFullList<Venda>({
          filter: `empresa_id = '${empresaId}' && data_venda >= '${inicioStr}' && data_venda <= '${fimStr}'`,
        })
        .catch(() => [] as Venda[]),
    ])

    // Calcular Faturamento a partir de contas recebidas/receber e vendas
    let somaRecebimentos = 0
    contasReceber.forEach((cr) => {
      const vRec = Number(cr.valor_recebido || 0)
      somaRecebimentos += vRec > 0 ? vRec : Number(cr.valor || 0)
    })

    let somaVendasValor = 0
    let somaProducaoM3 = 0
    vendas.forEach((v) => {
      somaVendasValor += Number(v.valor_total || 0)
      if (v.unidade === 'm³') {
        somaProducaoM3 += Number(v.quantidade || 0)
      }
    })

    const faturamentoSugerido = somaRecebimentos > 0 ? somaRecebimentos : somaVendasValor

    // Agrupar despesas por centro de custo ou categoria
    const mapaDespesas: Record<string, number> = {}
    let totalDespesasPagas = 0
    let totalDespesasGerais = 0

    contasPagar.forEach((cp) => {
      const v = Number(cp.valor || 0)
      const vPago = Number(cp.valor_pago || (cp.status === 'Paga' ? cp.valor : 0))
      totalDespesasGerais += v
      totalDespesasPagas += vPago

      const nomeGrupo =
        cp.expand?.centro_custo_id?.nome?.toUpperCase() ||
        cp.expand?.categoria_id?.nome?.toUpperCase() ||
        cp.descricao?.toUpperCase() ||
        'DIVERSOS'

      mapaDespesas[nomeGrupo] = (mapaDespesas[nomeGrupo] || 0) + (vPago > 0 ? vPago : v)
    })

    // Construir itens de despesa formatados
    // Garantir que os itens chave do modelo estejam presentes
    const despesasSugeridas: ItemDespesaFechamento[] = []
    let ordemCounter = 1

    // Itens padrão requeridos
    despesasSugeridas.push({
      id: 'pro-lab-gabriel',
      nome: 'PRO LAB GABRIEL',
      valor: mapaDespesas['PROLABORE'] || mapaDespesas['PRO LABORE'] || 0,
      ordem: ordemCounter++,
    })

    despesasSugeridas.push({
      id: 'usina',
      nome: 'USINA',
      valor: mapaDespesas['USINA'] || mapaDespesas['CENTRAL DE CONCRETO'] || 0,
      ordem: ordemCounter++,
    })

    // Outras despesas agrupadas do financeiro
    Object.entries(mapaDespesas).forEach(([nome, valor]) => {
      if (nome.includes('PROLABORE') || nome.includes('USINA')) return
      despesasSugeridas.push({
        id: `desp-${ordemCounter}`,
        nome,
        valor: Math.round(valor * 100) / 100,
        ordem: ordemCounter++,
      })
    })

    // Recalcular percentuais
    const somaTotal = despesasSugeridas.reduce((acc, it) => acc + (it.valor || 0), 0)
    despesasSugeridas.forEach((it) => {
      it.percentual = somaTotal > 0 ? Number(((it.valor / somaTotal) * 100).toFixed(2)) : 0
    })

    // Combustível total em litros
    const combustivelLitrosTotal = abastecimentos.reduce((acc, a) => acc + Number(a.litros || 0), 0)

    return {
      faturamentoSugerido,
      totalContasReceber: somaRecebimentos,
      totalVendas: somaVendasValor,
      totalDespesasPagas,
      totalDespesasGerais,
      despesasSugeridas,
      combustivelLitrosTotal,
      producaoM3Sugerida: Math.round(somaProducaoM3 * 100) / 100,
    }
  },
}
