import pb from '@/lib/pocketbase/client'
import type { DespesaFrota, NaturezaDespesaFrota, TipoDespesaFrota } from '@/types/erp'

export interface CreateDespesaFrotaPayload {
  empresa_id: string
  veiculo_id: string
  placa_patrimonio?: string | null
  setor: string
  natureza: NaturezaDespesaFrota
  tipo: TipoDespesaFrota
  descricao: string
  fornecedor_id?: string | null
  fornecedor_nome?: string | null
  data: string
  valor: number
  status: 'Pendente' | 'Pago' | 'Cancelado'
  conta_pagar_id?: string | null
  referencia_origem?: string | null
  observacoes?: string | null
}

export interface UpdateDespesaFrotaPayload extends Partial<CreateDespesaFrotaPayload> {}

export const despesasFrotaService = {
  async listar(empresaId: string, filterExtra?: string): Promise<DespesaFrota[]> {
    const filter = filterExtra
      ? `empresa_id = '${empresaId}' && (${filterExtra})`
      : `empresa_id = '${empresaId}'`
    return pb.collection('despesas_frota').getFullList<DespesaFrota>({
      filter,
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
      sort: '-data,-created',
    })
  },

  async listarPorVeiculo(empresaId: string, veiculoId: string): Promise<DespesaFrota[]> {
    return pb.collection('despesas_frota').getFullList<DespesaFrota>({
      filter: `empresa_id = '${empresaId}' && veiculo_id = '${veiculoId}'`,
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
      sort: '-data,-created',
    })
  },

  async listarPorSetor(empresaId: string, setor: string): Promise<DespesaFrota[]> {
    return pb.collection('despesas_frota').getFullList<DespesaFrota>({
      filter: `empresa_id = '${empresaId}' && setor = '${setor}'`,
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
      sort: '-data,-created',
    })
  },

  async obterPorId(id: string): Promise<DespesaFrota> {
    return pb.collection('despesas_frota').getOne<DespesaFrota>(id, {
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
    })
  },

  async criar(payload: CreateDespesaFrotaPayload): Promise<DespesaFrota> {
    return pb.collection('despesas_frota').create<DespesaFrota>(payload, {
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
    })
  },

  async atualizar(id: string, payload: UpdateDespesaFrotaPayload): Promise<DespesaFrota> {
    return pb.collection('despesas_frota').update<DespesaFrota>(id, payload, {
      expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
    })
  },

  async remover(id: string): Promise<boolean> {
    return pb.collection('despesas_frota').delete(id)
  },
}
