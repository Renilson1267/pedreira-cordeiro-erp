import pb from '@/lib/pocketbase/client'
import type { PostoCombustivel } from '@/types/erp'

export interface CreatePostoCombustivelPayload {
  empresa_id: string
  nome: string
  bandeira?: string | null
  cnpj?: string | null
  contato?: string | null
  telefone?: string | null
  cidade?: string | null
  endereco?: string | null
  observacoes?: string | null
  ativo?: boolean
}

export interface UpdatePostoCombustivelPayload extends Partial<CreatePostoCombustivelPayload> {}

export const postosCombustivelService = {
  async listar(empresaId: string, filterExtra?: string): Promise<PostoCombustivel[]> {
    const filter = filterExtra
      ? `empresa_id = '${empresaId}' && (${filterExtra})`
      : `empresa_id = '${empresaId}'`
    return pb.collection('postos_combustivel').getFullList<PostoCombustivel>({
      filter,
      sort: 'nome',
    })
  },

  async obterPorId(id: string): Promise<PostoCombustivel> {
    return pb.collection('postos_combustivel').getOne<PostoCombustivel>(id)
  },

  async criar(payload: CreatePostoCombustivelPayload): Promise<PostoCombustivel> {
    return pb.collection('postos_combustivel').create<PostoCombustivel>(payload)
  },

  async atualizar(id: string, payload: UpdatePostoCombustivelPayload): Promise<PostoCombustivel> {
    return pb.collection('postos_combustivel').update<PostoCombustivel>(id, payload)
  },

  async remover(id: string): Promise<boolean> {
    return pb.collection('postos_combustivel').delete(id)
  },
}
