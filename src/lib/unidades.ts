/**
 * Utilitários e constantes de conversão de unidades para o ERP da Pedreira Cordeiro
 * Centraliza os fatores de densidade e conversão: Metro Cúbico (m³) ⇄ Tonelada (ton/t)
 * Prática do setor de pedreira: m³ ≈ 1,5 t (fator usual para brita e agregados)
 */

export interface DensidadeReferencia {
  padrao: string
  densidade: number // t/m³ (toneladas por metro cúbico)
  desc: string
}

/**
 * Densidades típicas de materiais de pedreira (t/m³)
 * Referência prática:
 * - Brita 12 / Brita 19 / Brita corrida: ~1,50 t/m³ (1 m³ = 1,5 t; 1 t ≈ 0,667 m³)
 * - Pedra rachão: ~1,50 t/m³
 * - Pó de pedra: ~1,50 t/m³
 * - Cascalhinho: ~1,60 t/m³
 * - Areia: ~1,45 t/m³
 * - Pedrisco: ~1,45 t/m³
 * - Bica corrida: ~1,60 t/m³
 */
export const DENSIDADES_TIPICAS_PEDREIRA: DensidadeReferencia[] = [
  { padrao: 'brita 12', densidade: 1.45, desc: 'Brita 12 (1,45 t/m³)' },
  { padrao: 'brita 19', densidade: 1.47, desc: 'Brita 19 (1,47 t/m³)' },
  { padrao: 'brita', densidade: 1.45, desc: 'Brita em geral (~1,45 t/m³)' },
  { padrao: 'pedra rachão', densidade: 1.5, desc: 'Pedra Rachão (~1,50 t/m³)' },
  { padrao: 'pedra rachao', densidade: 1.5, desc: 'Pedra Rachão (~1,50 t/m³)' },
  { padrao: 'rachao', densidade: 1.5, desc: 'Pedra Rachão (~1,50 t/m³)' },
  { padrao: 'pó de brita', densidade: 1.56, desc: 'Pó de Brita (1,56 t/m³)' },
  { padrao: 'po de brita', densidade: 1.56, desc: 'Pó de Brita (1,56 t/m³)' },
  { padrao: 'pó de pedra', densidade: 1.56, desc: 'Pó de Pedra (1,56 t/m³)' },
  { padrao: 'po de pedra', densidade: 1.56, desc: 'Pó de Pedra (1,56 t/m³)' },
  { padrao: 'cascalhinho', densidade: 1.6, desc: 'Cascalhinho (~1,60 t/m³)' },
  { padrao: 'areia', densidade: 1.45, desc: 'Areia (~1,45 t/m³)' },
  { padrao: 'pedrisco', densidade: 1.45, desc: 'Pedrisco (~1,45 t/m³)' },
  { padrao: 'bica corrida', densidade: 1.6, desc: 'Bica Corrida (~1,60 t/m³)' },
]

export const DENSIDADE_PADRAO_PEDREIRA = 1.5

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
 * Obtém a densidade efetiva de um produto ou sugere pelo nome ou retorna o padrão da pedreira (1.5)
 */
export function obterDensidadeEfetiva(
  densidadeProduto?: number | null,
  nomeProduto?: string,
): number {
  if (densidadeProduto !== undefined && densidadeProduto !== null && densidadeProduto > 0) {
    return densidadeProduto
  }
  if (nomeProduto) {
    const sugerida = sugerirDensidadePorNome(nomeProduto)
    if (sugerida && sugerida > 0) return sugerida
  }
  return DENSIDADE_PADRAO_PEDREIRA
}

/**
 * Conversão de m³ para tonelada com base na densidade (fator m³ → t)
 * ton = m³ * densidade
 */
export function converterM3ParaToneladas(m3: number, densidade: number): number {
  if (!densidade || densidade <= 0 || !m3) return 0
  return Number((m3 * densidade).toFixed(3))
}

/**
 * Conversão de tonelada para m³ com base na densidade (fator t → m³)
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

export interface ResultadoCalculoVendaUnidades {
  precisaConversao: boolean
  tipoConversao: 'nenhuma' | 'm3_para_ton' | 'ton_para_m3'
  unidadeVenda: string
  unidadeCadastro: string
  quantidadeInformada: number
  quantidadeConvertida: number
  fatorConversao: number // t/m³
  precoUnitarioOriginal: number
  precoUnitarioEquivalente: number
  valorBruto: number
  explicacaoFormula: string
  detalheResumo: string
}

/**
 * Calcula a conversão e o valor bruto da venda de forma transparente.
 *
 * Regra:
 * O preço cadastrado no produto refere-se à sua unidade de cadastro (unidadeCadastro).
 * Exemplo 1 (caso do relato do usuário):
 * - Produto: Brita 12 precificado a R$ 69,44 por tonelada (unidadeCadastro = 'ton').
 * - Venda: 10 m³ (unidadeVenda = 'm³') com densidade 1,5 t/m³.
 * - 10 m³ equivalem a 15 toneladas (10 * 1,5 = 15 t).
 * - Preço por m³ equivalente: 69,44 * 1,5 = R$ 104,16/m³.
 * - Valor bruto: 15 t * R$ 69,44 = R$ 1.041,60 (ou 10 m³ * R$ 104,16 = R$ 1.041,60).
 *
 * Exemplo 2 (caso inverso):
 * - Produto precificado em m³ (ex: R$ 95,00/m³).
 * - Venda informada em toneladas (ex: 15 t) com densidade 1,5 t/m³.
 * - 15 t equivalem a 10 m³ (15 / 1,5 = 10 m³).
 * - Valor bruto: 10 m³ * R$ 95,00 = R$ 950,00.
 */
export function calcularConversaoVenda({
  quantidade,
  unidadeVenda,
  unidadeCadastro,
  precoUnitario,
  densidade,
  nomeProduto,
}: {
  quantidade: number
  unidadeVenda: string
  unidadeCadastro?: string
  precoUnitario: number
  densidade?: number | null
  nomeProduto?: string
}): ResultadoCalculoVendaUnidades {
  const qtd = Number(quantidade) || 0
  const preco = Number(precoUnitario) || 0
  const uVenda = (unidadeVenda || 'm³').toLowerCase().trim()
  const uCad = (unidadeCadastro || uVenda).toLowerCase().trim()
  const dens = obterDensidadeEfetiva(densidade, nomeProduto)

  // Caso 1: Venda em m³ e Produto cadastrado em ton (ou vice-versa para tonelada/ton/t)
  const isVendaM3 = uVenda === 'm³' || uVenda === 'm3'
  const isVendaTon = uVenda === 'ton' || uVenda === 't'
  const isCadM3 = uCad === 'm³' || uCad === 'm3'
  const isCadTon = uCad === 'ton' || uCad === 't'

  if (isVendaM3 && isCadTon) {
    // Quantidade em m³ convertida para toneladas para aplicar o preço/tonelada
    const qtdConvertida = Number((qtd * dens).toFixed(3))
    const valorBruto = Number((qtdConvertida * preco).toFixed(2))
    const precoEquivalente = Number((preco * dens).toFixed(2))

    return {
      precisaConversao: true,
      tipoConversao: 'm3_para_ton',
      unidadeVenda,
      unidadeCadastro: unidadeCadastro || 'ton',
      quantidadeInformada: qtd,
      quantidadeConvertida: qtdConvertida,
      fatorConversao: dens,
      precoUnitarioOriginal: preco,
      precoUnitarioEquivalente: precoEquivalente,
      valorBruto,
      explicacaoFormula: `${formatarNumeroBR(qtd, 2)} m³ × ${formatarNumeroBR(dens, 3)} t/m³ = ${formatarNumeroBR(qtdConvertida, 2)} t × R$ ${formatarNumeroBR(preco, 2)}/ton`,
      detalheResumo: `${formatarNumeroBR(qtd, 2)} m³ ≈ ${formatarNumeroBR(qtdConvertida, 2)} toneladas (fator ${formatarNumeroBR(dens, 2)} t/m³)`,
    }
  }

  if (isVendaTon && isCadM3) {
    // Quantidade em toneladas convertida para m³ para aplicar o preço/m³
    const qtdConvertida = dens > 0 ? Number((qtd / dens).toFixed(3)) : 0
    const valorBruto = Number((qtdConvertida * preco).toFixed(2))
    const precoEquivalente = dens > 0 ? Number((preco / dens).toFixed(2)) : 0

    return {
      precisaConversao: true,
      tipoConversao: 'ton_para_m3',
      unidadeVenda,
      unidadeCadastro: unidadeCadastro || 'm³',
      quantidadeInformada: qtd,
      quantidadeConvertida: qtdConvertida,
      fatorConversao: dens,
      precoUnitarioOriginal: preco,
      precoUnitarioEquivalente: precoEquivalente,
      valorBruto,
      explicacaoFormula: `${formatarNumeroBR(qtd, 2)} t ÷ ${formatarNumeroBR(dens, 3)} t/m³ = ${formatarNumeroBR(qtdConvertida, 2)} m³ × R$ ${formatarNumeroBR(preco, 2)}/m³`,
      detalheResumo: `${formatarNumeroBR(qtd, 2)} toneladas ≈ ${formatarNumeroBR(qtdConvertida, 2)} m³ (fator ${formatarNumeroBR(dens, 2)} t/m³)`,
    }
  }

  // Sem conversão necessária (mesma unidade ou unidades não agregadas como un/viagem)
  const valorBruto = Number((qtd * preco).toFixed(2))
  return {
    precisaConversao: false,
    tipoConversao: 'nenhuma',
    unidadeVenda,
    unidadeCadastro: unidadeCadastro || unidadeVenda,
    quantidadeInformada: qtd,
    quantidadeConvertida: qtd,
    fatorConversao: dens,
    precoUnitarioOriginal: preco,
    precoUnitarioEquivalente: preco,
    valorBruto,
    explicacaoFormula: `${formatarNumeroBR(qtd, 2)} ${unidadeVenda} × R$ ${formatarNumeroBR(preco, 2)}/${unidadeVenda}`,
    detalheResumo: `${formatarNumeroBR(qtd, 2)} ${unidadeVenda}`,
  }
}
