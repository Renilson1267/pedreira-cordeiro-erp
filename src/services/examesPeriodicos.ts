import pb from '@/lib/pocketbase/client'
import type {
  ExamePeriodico,
  TipoExameOcupacional,
  ResultadoExameOcupacional,
  StatusGeralExame,
  StatusCalculadoExame,
  TipoExameComplementar,
  MapaExamesComplementares,
} from '@/types/erp'

export interface CreateExamePayload {
  empresa_id: string
  funcionario_id: string
  tipo_exame: TipoExameOcupacional
  data_exame: string
  resultado: ResultadoExameOcupacional
  status_geral?: StatusGeralExame | null
  clinica_medico?: string | null
  crm?: string | null
  periodicidade_meses?: number | null
  data_proximo_exame?: string | null
  data_validade?: string | null
  exames_complementares?: MapaExamesComplementares | null
  observacoes?: string | null
}

export type UpdateExamePayload = Partial<CreateExamePayload>

export const TIPOS_EXAME_LABELS: Record<TipoExameOcupacional, string> = {
  periodico: 'Periódico',
  admissional: 'Admissional',
  demissional: 'Demissional',
  retorno_trabalho: 'Retorno ao Trabalho',
  mudanca_funcao: 'Mudança de Função',
  mudanca_risco: 'Mudança de Risco Ocupacional',
}

export const RESULTADOS_EXAME_LABELS: Record<ResultadoExameOcupacional, string> = {
  apto: 'Apto',
  apto_com_restricao: 'Apto com Restrição',
  inapto: 'Inapto',
}

export const STATUS_GERAL_LABELS: Record<StatusGeralExame, string> = {
  pendente: 'Pendente',
  apto: 'Apto',
  apto_com_restricao: 'Apto com Restrição',
  inapto: 'Inapto',
  em_andamento: 'Em Andamento',
}

export const EXAMES_COMPLEMENTARES_CONFIG: {
  key: TipoExameComplementar
  label: string
  sigla: string
  descricao: string
}[] = [
  {
    key: 'aso',
    label: 'ASO (Atestado de Saúde)',
    sigla: 'ASO',
    descricao: 'Atestado emitido pelo médico do trabalho',
  },
  {
    key: 'acuidade_visual',
    label: 'Acuidade Visual',
    sigla: 'Visual',
    descricao: 'Exame oftalmológico ocupacional',
  },
  {
    key: 'audiometria',
    label: 'Audiometria',
    sigla: 'Áudio',
    descricao: 'Avaliação auditiva ocupacional (NR-7)',
  },
  {
    key: 'avaliacao_clinica',
    label: 'Avaliação Clínica',
    sigla: 'Clínica',
    descricao: 'Exame físico e anamnese ocupacional',
  },
  {
    key: 'toxicologico',
    label: 'Toxicológico',
    sigla: 'Toxicológico',
    descricao: 'Exame toxicológico de larga janela (motoristas/operadores)',
  },
  {
    key: 'rx',
    label: 'Raio-X (Tórax / Coluna)',
    sigla: 'RX',
    descricao: 'Radiografia padrão OIT / osteomuscular',
  },
  {
    key: 'ecg',
    label: 'Eletrocardiograma (ECG)',
    sigla: 'ECG',
    descricao: 'Exame cardiológico para atividades de risco',
  },
]

export const PERIODICIDADE_PADRAO_MESES: Record<TipoExameOcupacional, number> = {
  periodico: 12,
  admissional: 12,
  retorno_trabalho: 12,
  mudanca_funcao: 12,
  mudanca_risco: 12,
  demissional: 0, // Demissional geralmente não tem próximo periódico previsto
}

/**
 * Calcula a data do próximo exame somando a periodicidade em meses à data do exame.
 */
export function calcularDataProximoExame(dataExame: string, periodicidadeMeses: number): string {
  if (!dataExame || !periodicidadeMeses || periodicidadeMeses <= 0) return ''
  const partes = dataExame.slice(0, 10).split('-')
  if (partes.length !== 3) return ''
  const ano = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10) - 1
  const dia = parseInt(partes[2], 10)

  const data = new Date(ano, mes, dia)
  data.setMonth(data.getMonth() + Number(periodicidadeMeses))

  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/**
 * Calcula o status de vencimento do exame:
 * - 'vencido': data_proximo_exame < hoje
 * - 'vence_em_breve': hoje <= data_proximo_exame <= hoje + 30 dias
 * - 'em_dia': data_proximo_exame > hoje + 30 dias (ou sem data de próximo exame se demissional)
 */
/**
 * Retorna a data efetiva de expiração do exame (data_validade explícita ou data_proximo_exame).
 */
export function obterDataVencimentoEfetiva(
  dataValidade?: string | null,
  dataProximoExame?: string | null,
): string | null {
  if (dataValidade && dataValidade.trim()) {
    return dataValidade.slice(0, 10)
  }
  if (dataProximoExame && dataProximoExame.trim()) {
    return dataProximoExame.slice(0, 10)
  }
  return null
}

/**
 * Calcula o status de vencimento do exame:
 * - 'vencido': data efetiva < hoje
 * - 'vence_em_breve': hoje <= data efetiva <= hoje + 30 dias
 * - 'em_dia': data efetiva > hoje + 30 dias (ou sem vencimento se demissional)
 */
export function calcularStatusExame(
  dataProximoExame?: string | null,
  tipoExame?: TipoExameOcupacional,
  dataValidade?: string | null,
): StatusCalculadoExame {
  const dataEfetiva = obterDataVencimentoEfetiva(dataValidade, dataProximoExame)

  if (tipoExame === 'demissional' && !dataEfetiva) {
    return 'em_dia'
  }
  if (!dataEfetiva) {
    return 'em_dia'
  }

  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const proxStr = dataEfetiva.slice(0, 10)

  if (proxStr < hojeStr) {
    return 'vencido'
  }

  const dataHoje = new Date(hojeStr + 'T00:00:00')
  const dataProx = new Date(proxStr + 'T00:00:00')
  const diffTime = dataProx.getTime() - dataHoje.getTime()
  const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDias <= 30) {
    return 'vence_em_breve'
  }

  return 'em_dia'
}

/**
 * Retorna os dias restantes para o vencimento (negativo se já venceu).
 */
export function calcularDiasRestantes(
  dataProximoExame?: string | null,
  dataValidade?: string | null,
): number | null {
  const dataEfetiva = obterDataVencimentoEfetiva(dataValidade, dataProximoExame)
  if (!dataEfetiva) return null
  const hojeStr = new Date().toISOString().slice(0, 10)
  const proxStr = dataEfetiva.slice(0, 10)
  const dataHoje = new Date(hojeStr + 'T00:00:00')
  const dataProx = new Date(proxStr + 'T00:00:00')
  const diffTime = dataProx.getTime() - dataHoje.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export const examesPeriodicosService = {
  async listByEmpresa(empresaId: string): Promise<ExamePeriodico[]> {
    return pb.collection('exames_periodicos').getFullList<ExamePeriodico>({
      filter: `empresa_id = '${empresaId}'`,
      sort: '-data_exame',
      expand: 'funcionario_id,empresa_id',
    })
  },

  async getById(id: string): Promise<ExamePeriodico> {
    return pb.collection('exames_periodicos').getOne<ExamePeriodico>(id, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  async create(payload: CreateExamePayload): Promise<ExamePeriodico> {
    return pb.collection('exames_periodicos').create<ExamePeriodico>(payload, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  async update(id: string, payload: UpdateExamePayload): Promise<ExamePeriodico> {
    return pb.collection('exames_periodicos').update<ExamePeriodico>(id, payload, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('exames_periodicos').delete(id)
  },
}
