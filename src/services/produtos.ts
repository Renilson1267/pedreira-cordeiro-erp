import pb from '@/lib/pocketbase/client'
import type { Produto } from '@/types/erp'

export interface CreateProdutoPayload {
  empresa_id: string
  codigo: string
  nome: string
  categoria: Produto['categoria']
  unidade: Produto['unidade']
  preco_custo: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  densidade?: number
}

export type UpdateProdutoPayload = Partial<CreateProdutoPayload>

export {
  DENSIDADES_TIPICAS_PEDREIRA,
  DENSIDADE_PADRAO_PEDREIRA,
  sugerirDensidadePorNome,
  obterDensidadeEfetiva,
  converterM3ParaToneladas,
  converterToneladasParaM3,
  formatarNumeroBR,
  calcularConversaoVenda,
} from '@/lib/unidades'

export const produtosService = {
  async listByEmpresa(empresaId: string): Promise<Produto[]> {
    return pb.collection('produtos').getFullList<Produto>({
      filter: `empresa_id = '${empresaId}'`,
      sort: 'codigo',
    })
  },

  async getById(id: string): Promise<Produto> {
    return pb.collection('produtos').getOne<Produto>(id)
  },

  async create(data: CreateProdutoPayload): Promise<Produto> {
    return pb.collection('produtos').create<Produto>(data)
  },

  async update(id: string, data: UpdateProdutoPayload): Promise<Produto> {
    return pb.collection('produtos').update<Produto>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('produtos').delete(id)
  },
}
