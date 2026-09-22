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

/**
 * Densidades típicas de materiais de pedreira (t/m³)
 */
export const DENSIDADES_TIPICAS_PEDREIRA: { padrao: string; densidade: number; desc: string }[] = [
  { padrao: 'brita 12', densidade: 1.5, desc: 'Brita 12 (~1,50 t/m³)' },
  { padrao: 'brita 19', densidade: 1.5, desc: 'Brita 19 (~1,50 t/m³)' },
  { padrao: 'brita', densidade: 1.5, desc: 'Brita em geral (~1,50 t/m³)' },
  { padrao: 'rachao', densidade: 1.5, desc: 'Pedra Rachão (~1,50 t/m³)' },
  { padrao: 'pedra rachão', densidade: 1.5, desc: 'Pedra Rachão (~1,50 t/m³)' },
  { padrao: 'po de pedra', densidade: 1.5, desc: 'Pó de Pedra (~1,50 t/m³)' },
  { padrao: 'pó de pedra', densidade: 1.5, desc: 'Pó de Pedra (~1,50 t/m³)' },
  { padrao: 'cascalhinho', densidade: 1.6, desc: 'Cascalhinho (~1,60 t/m³)' },
  { padrao: 'areia', densidade: 1.45, desc: 'Areia (~1,45 t/m³)' },
  { padrao: 'pedrisco', densidade: 1.45, desc: 'Pedrisco (~1,45 t/m³)' },
  { padrao: 'bica corrida', densidade: 1.6, desc: 'Bica Corrida (~1,60 t/m³)' },
]

/**
 * Sugere a densidade típica com base no nome do produto
 */
export function sugerirDensidadePorNome(nome: string): number | null {
  if (!nome) return null
  const n = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  for (const item of DENSIDADES_TIPICAS_PEDREIRA) {
    const p = item.padrao
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (n.includes(p)) {
      return item.densidade
    }
  }
  return null
}

/**
 * Conversão de m³ para tonelada com base na densidade
 * ton = m³ * densidade
 */
export function converterM3ParaToneladas(m3: number, densidade: number): number {
  if (!densidade || densidade <= 0 || !m3) return 0
  return Number((m3 * densidade).toFixed(3))
}

/**
 * Conversão de tonelada para m³ com base na densidade
 * m³ = ton / densidade
 */
export function converterToneladasParaM3(ton: number, densidade: number): number {
  if (!densidade || densidade <= 0 || !ton) return 0
  return Number((ton / densidade).toFixed(3))
}

/**
 * Formata um número para o padrão pt-BR com casas decimais flexíveis
 */
export function formatarNumeroBR(valor: number, maxDecimais: number = 3): string {
  if (isNaN(valor)) return '0'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimais,
  }).format(valor)
}

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
