import pb from '@/lib/pocketbase/client'
import type { Venda } from '@/types/erp'

export interface CreateVendaPayload {
  empresa_id: string
  cliente_id?: string | null
  produto_id?: string | null
  produto_nome?: string | null
  quantidade: number
  unidade: 'm³' | 'ton' | 'un' | 'viagem'
  preco_unitario: number
  valor_total: number
  data_venda: string
  forma_pagamento?: string | null
  status: 'Pendente' | 'Faturada' | 'Paga' | 'Cancelada'
  nota_fiscal?: string | null
  conta_receber_id?: string | null
  observacoes?: string | null
  tipo_desconto?: 'percentual' | 'valor' | null
  valor_desconto?: number | null
  desconto_percentual?: number | null
  valor_bruto?: number | null
  tipo_entrega?: 'frota_propria' | 'terceiro' | null
}

export interface UpdateVendaPayload extends Partial<CreateVendaPayload> {}

export const vendasService = {
  async obterProximoSequencial(empresaId: string, anoRef?: number): Promise<string> {
    const ano = anoRef || new Date().getFullYear()
    try {
      const records = await pb.collection('contadores_sequenciais').getList(1, 1, {
        filter: `empresa_id = '${empresaId}' && tipo = 'romaneio' && ano = ${ano}`,
      })
      const ultimo = records.items[0]?.ultimo_numero || 0
      const proximo = Number(ultimo) + 1
      return `RMD-${ano}-${String(proximo).padStart(5, '0')}`
    } catch (_) {
      return `RMD-${ano}-00001`
    }
  },

  async listar(empresaId: string, filterExtra?: string): Promise<Venda[]> {
    const filter = filterExtra
      ? `empresa_id = '${empresaId}' && (${filterExtra})`
      : `empresa_id = '${empresaId}'`
    return pb.collection('vendas').getFullList<Venda>({
      filter,
      expand: 'cliente_id,produto_id',
      sort: '-data_venda,-created',
    })
  },

  async obterPorId(id: string): Promise<Venda> {
    return pb.collection('vendas').getOne<Venda>(id, {
      expand: 'cliente_id,produto_id',
    })
  },

  async criar(payload: CreateVendaPayload): Promise<Venda> {
    return pb.collection('vendas').create<Venda>(payload, {
      expand: 'cliente_id,produto_id',
    })
  },

  async atualizar(id: string, payload: UpdateVendaPayload): Promise<Venda> {
    return pb.collection('vendas').update<Venda>(id, payload, {
      expand: 'cliente_id,produto_id',
    })
  },

  async remover(id: string): Promise<boolean> {
    return pb.collection('vendas').delete(id)
  },
}
