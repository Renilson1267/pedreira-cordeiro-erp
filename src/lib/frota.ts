import type { TipoVeiculo } from '@/types/erp'

/**
 * Setores operacionais da Pedreira para alocação de veículos e máquinas.
 * Centralizado para uso em Veículos, Relatórios, Cadastros e Painéis.
 */
export const SETORES_FROTA = [
  'Entrega',
  'Central Britagem',
  'Central de Concreto',
  'Central Britagem Lokotrack',
  'Engenharia / Supervisão',
] as const

export type SetorFrota = (typeof SETORES_FROTA)[number]

/**
 * Lista expandida aceitando variações legadas (ex: "Entrega de Brita").
 * Mantida para retrocompatibilidade onde existirem registros anteriores no banco.
 */
export const SETORES_FROTA_EXPANDIDOS = [
  'Entrega',
  'Entrega de Brita',
  'Central Britagem',
  'Central de Concreto',
  'Central Britagem Lokotrack',
  'Engenharia / Supervisão',
] as const

/**
 * Normaliza o nome do setor para fins de agrupamento, badges e filtros:
 * 'Entrega de Brita' -> 'Entrega'
 * 'Central Britagem Lokotrack' -> 'Britagem Lokotrack' / mantém
 */
export function normalizarSetorFrota(setor?: string | null): string {
  if (!setor) return 'Geral'
  const s = setor.trim()
  if (s.toLowerCase().startsWith('entrega')) {
    return 'Entrega'
  }
  return s
}

/**
 * Verifica se um veículo pertence a um determinado setor de filtro,
 * considerando que 'Entrega' engloba tanto 'Entrega' quanto 'Entrega de Brita'.
 */
export function veiculoCorrespondeAoSetor(
  veiculoSetor: string | undefined | null,
  filtroSetor: string,
): boolean {
  if (!filtroSetor || filtroSetor === 'todos') return true
  const vNorm = normalizarSetorFrota(veiculoSetor)
  const fNorm = normalizarSetorFrota(filtroSetor)
  if (vNorm.toLowerCase() === fNorm.toLowerCase()) return true
  return (veiculoSetor || '').toLowerCase() === filtroSetor.toLowerCase()
}

/**
 * Labels descritivos e ícones por tipo de máquina/veículo.
 */
export const TIPO_VEICULO_LABELS: Record<TipoVeiculo, { label: string; icon: string }> = {
  caminhao: { label: 'Caminhão de Entrega / Basculante / Caçamba', icon: '🚛' },
  escavadeira: { label: 'Escavadeira Hidráulica', icon: '🚜' },
  carregadeira: { label: 'Pá Carregadeira', icon: '🚜' },
  perfuratriz: { label: 'Perfuratriz Hidráulica', icon: '⚙️' },
  trator: { label: 'Trator / Motoniveladora', icon: '🚜' },
  betoneira: { label: 'Caminhão Betoneira', icon: '🚚' },
  pipa: { label: 'Caminhão Pipa', icon: '🚛' },
  bomba: { label: 'Bomba de Concreto', icon: '🚜' },
  central_concreto: { label: 'Central de Concreto (Usina)', icon: '🏭' },
  britador: { label: 'Britador / Lokotrack', icon: '⚙️' },
  peneira: { label: 'Peneira Classificadora', icon: '🏗️' },
  moto: { label: 'Motocicleta', icon: '🏍️' },
  carro_passeio: { label: 'Carro de Passeio / Pickup 4x4', icon: '🛻' },
  outro: { label: 'Outro Equipamento', icon: '🏗️' },
}

// Aliases para manter compatibilidade com códigos anteriores
export const SETORES_PEDREIRA = SETORES_FROTA_EXPANDIDOS
export const TIPO_LABELS = TIPO_VEICULO_LABELS
