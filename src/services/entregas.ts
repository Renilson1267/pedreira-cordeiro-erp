import pb from '@/lib/pocketbase/client'
import type { Entrega, UnidadeMedidaCarga, StatusEntrega } from '@/types/erp'

export interface CreateEntregaPayload {
  empresa_id: string
  veiculo_id?: string | null
  venda_id?: string | null
  cliente_id?: string | null
  cliente_nome?: string | null
  data: string
  origem: string
  destino: string
  km_rodado?: number | null
  km_rota?: number | null
  km_inicial?: number | null
  km_final?: number | null
  motorista?: string | null
  funcionario_id?: string | null
  produto_id?: string | null
  produto_nome?: string | null
  quantidade?: number | null
  unidade_medida?: UnidadeMedidaCarga | null
  consumo_estimado_km_l?: number | null
  preco_combustivel_litro?: number | null
  litros_estimados?: number | null
  custo_estimado?: number | null
  custo_por_km?: number | null
  valor_venda?: number | null
  preco_unitario_venda?: number | null
  status?: StatusEntrega
  conta_pagar_id?: string | null
  observacoes?: string | null
}
export interface UpdateEntregaPayload extends Partial<CreateEntregaPayload> {}

export const entregasService = {
  async listar(empresaId: string, filterExtra?: string): Promise<Entrega[]> {
    const filter = filterExtra
      ? `empresa_id = '${empresaId}' && (${filterExtra})`
      : `empresa_id = '${empresaId}'`
    return pb.collection('entregas').getFullList<Entrega>({
      filter,
      expand: 'veiculo_id,funcionario_id,produto_id,conta_pagar_id,venda_id,cliente_id',
      sort: '-data,-created',
    })
  },

  async obterPorId(id: string): Promise<Entrega> {
    return pb.collection('entregas').getOne<Entrega>(id, {
      expand: 'veiculo_id,funcionario_id,produto_id,conta_pagar_id,venda_id,cliente_id',
    })
  },

  async criar(payload: CreateEntregaPayload): Promise<Entrega> {
    return pb.collection('entregas').create<Entrega>(payload, {
      expand: 'veiculo_id,funcionario_id,produto_id,conta_pagar_id,venda_id,cliente_id',
    })
  },

  async atualizar(id: string, payload: UpdateEntregaPayload): Promise<Entrega> {
    return pb.collection('entregas').update<Entrega>(id, payload, {
      expand: 'veiculo_id,funcionario_id,produto_id,conta_pagar_id,venda_id,cliente_id',
    })
  },

  async remover(id: string): Promise<boolean> {
    return pb.collection('entregas').delete(id)
  },
}
