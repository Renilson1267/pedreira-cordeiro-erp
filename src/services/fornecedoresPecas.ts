import pb from '@/lib/pocketbase/client'
import type { FornecedorPecas } from '@/types/erp'

export interface CreateFornecedorPecasPayload {
  empresa_id: string
  nome: string
  cnpj?: string | null
  contato?: string | null
  telefone?: string | null
  tipo_pecas?: string | null
  cidade?: string | null
  endereco?: string | null
  observacoes?: string | null
  ativo?: boolean
}

export interface UpdateFornecedorPecasPayload extends Partial<CreateFornecedorPecasPayload> {}

export const fornecedoresPecasService = {
  async listar(empresaId: string, filterExtra?: string): Promise<FornecedorPecas[]> {
    const filter = filterExtra
      ? `empresa_id = '${empresaId}' && (${filterExtra})`
      : `empresa_id = '${empresaId}'`
    return pb.collection('fornecedores_pecas').getFullList<FornecedorPecas>({
      filter,
      sort: 'nome',
    })
  },

  async obterPorId(id: string): Promise<FornecedorPecas> {
    return pb.collection('fornecedores_pecas').getOne<FornecedorPecas>(id)
  },

  async criar(payload: CreateFornecedorPecasPayload): Promise<FornecedorPecas> {
    return pb.collection('fornecedores_pecas').create<FornecedorPecas>(payload)
  },

  async atualizar(id: string, payload: UpdateFornecedorPecasPayload): Promise<FornecedorPecas> {
    return pb.collection('fornecedores_pecas').update<FornecedorPecas>(id, payload)
  },

  async remover(id: string): Promise<boolean> {
    return pb.collection('fornecedores_pecas').delete(id)
  },
}
