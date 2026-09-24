import pb from '@/lib/pocketbase/client'
import type {
  HistoricoAlteracao,
  AcaoHistorico,
  ColecaoOrigemHistorico,
  DetalheAlteracaoCampo,
} from '@/types/erp'
import { formatCurrency, formatDate } from '@/lib/formatters'

export interface RegistrarHistoricoPayload {
  empresaId: string
  colecaoOrigem: ColecaoOrigemHistorico
  registroId: string
  acao: AcaoHistorico
  usuarioId?: string
  usuarioNome: string
  descricao: string
  detalhes?: {
    alteracoes?: DetalheAlteracaoCampo[]
    movimento_inverso?: {
      tipo: 'Entrada' | 'Saida'
      valor: number
      movimento_id?: string
    }
    documento?: string
    valor?: number
    extra?: Record<string, any>
  }
}

/**
 * Utilitário para mapear e comparar campos antes e depois da edição,
 * gerando um diff amigável e legível em português.
 */
export interface CampoConfig {
  label: string
  format?: (val: any) => string
}

export const CAMPOS_CONFIG_PAGAR: Record<string, CampoConfig> = {
  descricao: { label: 'Descrição' },
  valor: { label: 'Valor Total', format: (v) => formatCurrency(Number(v) || 0) },
  valor_pago: { label: 'Valor Pago', format: (v) => formatCurrency(Number(v) || 0) },
  vencimento: { label: 'Data de Vencimento', format: (v) => (v ? formatDate(v) : '—') },
  data_emissao: { label: 'Data de Emissão', format: (v) => (v ? formatDate(v) : '—') },
  data_pagamento: { label: 'Data do Pagamento', format: (v) => (v ? formatDate(v) : '—') },
  forma_pagamento: { label: 'Forma de Pagamento' },
  status: { label: 'Status' },
  fornecedor_id: { label: 'Fornecedor' },
  fornecedor_nome: { label: 'Fornecedor' },
  categoria_id: { label: 'Categoria' },
  categoria_nome: { label: 'Categoria' },
  centro_custo_id: { label: 'Centro de Custo' },
  centro_custo_nome: { label: 'Centro de Custo' },
  parcelas: { label: 'Parcelas' },
  observacoes: { label: 'Observações' },
}

export const CAMPOS_CONFIG_RECEBER: Record<string, CampoConfig> = {
  descricao: { label: 'Descrição' },
  valor: { label: 'Valor Líquido', format: (v) => formatCurrency(Number(v) || 0) },
  valor_bruto: { label: 'Valor Bruto', format: (v) => formatCurrency(Number(v) || 0) },
  tipo_desconto: {
    label: 'Tipo de Desconto',
    format: (v) => (v === 'percentual' ? 'Percentual (%)' : v === 'valor' ? 'Valor (R$)' : '—'),
  },
  desconto_percentual: {
    label: 'Desconto (%)',
    format: (v) => (v !== null && v !== undefined && v !== '' ? `${Number(v).toFixed(2)}%` : '—'),
  },
  valor_desconto: {
    label: 'Valor do Desconto',
    format: (v) =>
      v !== null && v !== undefined && v !== '' ? formatCurrency(Number(v) || 0) : '—',
  },
  valor_recebido: { label: 'Valor Recebido', format: (v) => formatCurrency(Number(v) || 0) },
  vencimento: { label: 'Data de Vencimento', format: (v) => (v ? formatDate(v) : '—') },
  data_emissao: { label: 'Data de Emissão', format: (v) => (v ? formatDate(v) : '—') },
  data_recebimento: { label: 'Data de Recebimento', format: (v) => (v ? formatDate(v) : '—') },
  forma_recebimento: { label: 'Forma de Recebimento' },
  status: { label: 'Status' },
  cliente_id: { label: 'Cliente' },
  cliente_nome: { label: 'Cliente' },
  cliente_depositante: { label: 'Cliente Depositante' },
  nota: { label: 'Nota / Documento' },
  endereco: { label: 'Endereço / Praça' },
  categoria_id: { label: 'Categoria' },
  categoria_nome: { label: 'Categoria' },
  centro_custo_id: { label: 'Centro de Custo' },
  centro_custo_nome: { label: 'Centro de Custo' },
  parcelas: { label: 'Parcelas' },
  observacoes: { label: 'Observações' },
}

export function calcularDiffAlteracoes(
  anterior: Record<string, any>,
  novo: Record<string, any>,
  configCampos: Record<string, CampoConfig>,
): DetalheAlteracaoCampo[] {
  const diffs: DetalheAlteracaoCampo[] = []

  for (const campo of Object.keys(configCampos)) {
    if (!(campo in anterior) && !(campo in novo)) continue

    const valAnt = anterior[campo]
    const valNov = novo[campo]

    // Normalização para comparação (null vs undefined vs '')
    const normalizar = (v: any) => {
      if (v === null || v === undefined) return ''
      if (typeof v === 'string') return v.trim()
      if (typeof v === 'number') return String(v)
      return v
    }

    const nAnt = normalizar(valAnt)
    const nNov = normalizar(valNov)

    // Se forem datas em ISO, comparar apenas os primeiros 10 caracteres (YYYY-MM-DD) se aplicável
    const ehData =
      typeof nAnt === 'string' &&
      typeof nNov === 'string' &&
      nAnt.length >= 10 &&
      nNov.length >= 10 &&
      (campo.includes('vencimento') || campo.includes('data'))

    const mudou = ehData ? nAnt.slice(0, 10) !== nNov.slice(0, 10) : nAnt !== nNov

    if (mudou) {
      const cfg = configCampos[campo]
      const formatar = (v: any) => {
        if (v === null || v === undefined || v === '') return '—'
        if (cfg.format) return cfg.format(v)
        return String(v)
      }

      diffs.push({
        campo,
        campo_label: cfg.label,
        valor_anterior: valAnt,
        valor_novo: valNov,
        valor_anterior_formatado: formatar(valAnt),
        valor_novo_formatado: formatar(valNov),
      })
    }
  }

  return diffs
}

export const historicoService = {
  /**
   * Grava uma entrada no histórico de alterações.
   * Não lança erro fatal caso a coleção ainda não esteja pronta ou falhe temporariamente,
   * garantindo que a transação principal (pagar/receber) não quebre.
   */
  async registrar(payload: RegistrarHistoricoPayload): Promise<HistoricoAlteracao | null> {
    try {
      const record = await pb.collection('historico_alteracoes').create<HistoricoAlteracao>({
        empresa_id: payload.empresaId,
        colecao_origem: payload.colecaoOrigem,
        registro_id: payload.registroId,
        acao: payload.acao,
        usuario_id: payload.usuarioId || '',
        usuario_nome: payload.usuarioNome || 'Usuário',
        descricao: payload.descricao,
        detalhes: payload.detalhes || null,
      })
      return record
    } catch (err: any) {
      console.warn('Não foi possível gravar histórico de alteração:', err?.message || err)
      return null
    }
  },

  /**
   * Lista o histórico de um título específico, ordenado do mais recente para o mais antigo.
   */
  async listarPorRegistro(
    registroId: string,
    colecaoOrigem?: ColecaoOrigemHistorico,
  ): Promise<HistoricoAlteracao[]> {
    try {
      let filter = `registro_id = '${registroId}'`
      if (colecaoOrigem) {
        filter += ` && colecao_origem = '${colecaoOrigem}'`
      }

      return await pb.collection('historico_alteracoes').getFullList<HistoricoAlteracao>({
        filter,
        sort: '-created',
      })
    } catch (err: any) {
      console.warn('Erro ao consultar histórico:', err?.message || err)
      return []
    }
  },

  /**
   * Lista histórico geral da empresa com paginação e filtro opcional por coleção ou ação.
   */
  async listarGeral(
    empresaId: string,
    options?: {
      colecao?: ColecaoOrigemHistorico | 'todas'
      acao?: AcaoHistorico | 'todas'
      page?: number
      perPage?: number
    },
  ): Promise<{ items: HistoricoAlteracao[]; totalItems: number }> {
    try {
      const filters: string[] = [`empresa_id = '${empresaId}'`]
      if (options?.colecao && options.colecao !== 'todas') {
        filters.push(`colecao_origem = '${options.colecao}'`)
      }
      if (options?.acao && options.acao !== 'todas') {
        filters.push(`acao = '${options.acao}'`)
      }

      const res = await pb
        .collection('historico_alteracoes')
        .getList<HistoricoAlteracao>(options?.page || 1, options?.perPage || 30, {
          filter: filters.join(' && '),
          sort: '-created',
        })
      return { items: res.items, totalItems: res.totalItems }
    } catch (err: any) {
      console.warn('Erro ao listar histórico geral:', err?.message || err)
      return { items: [], totalItems: 0 }
    }
  },
}
