import pb from '@/lib/pocketbase/client'
import type { FolhaHorasExtras, Funcionario } from '@/types/erp'

export interface CreateFolhaHorasExtrasPayload {
  empresa_id: string
  funcionario_id: string
  mes_referencia: string
  modo_calculo: 'padrao_50' | 'clt_vigente'
  salario_base: number
  valor_hora_normal: number
  horas_50: number
  valor_horas_50: number
  horas_100: number
  valor_horas_100: number
  total_horas: number
  total_valor: number
  gratificacao?: number
  adiantamento?: number
  valor_liquido?: number
  status: 'calculado' | 'aprovado' | 'pago' | 'cancelado'
  conta_pagar_id?: string
  observacoes?: string
}

export const folhaHorasExtrasService = {
  async listByEmpresa(empresaId: string, mesReferencia?: string): Promise<FolhaHorasExtras[]> {
    let filter = `empresa_id = '${empresaId}'`
    if (mesReferencia && mesReferencia !== 'todos') {
      filter += ` && mes_referencia = '${mesReferencia}'`
    }
    return pb.collection('folha_horas_extras').getFullList<FolhaHorasExtras>({
      filter,
      sort: '-created',
      expand: 'funcionario_id,empresa_id',
    })
  },

  async create(data: CreateFolhaHorasExtrasPayload): Promise<FolhaHorasExtras> {
    return pb.collection('folha_horas_extras').create<FolhaHorasExtras>(data, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  async update(
    id: string,
    data: Partial<CreateFolhaHorasExtrasPayload>,
  ): Promise<FolhaHorasExtras> {
    return pb.collection('folha_horas_extras').update<FolhaHorasExtras>(id, data, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('folha_horas_extras').delete(id)
  },

  async getById(id: string): Promise<FolhaHorasExtras> {
    return pb.collection('folha_horas_extras').getOne<FolhaHorasExtras>(id, {
      expand: 'funcionario_id,empresa_id',
    })
  },

  // Helper de cálculo
  calcular({
    salario,
    horasTotais50 = 0,
    horasUteis50 = 0,
    horasDomingos100 = 0,
    modo,
    jornadaMensal = 220,
    gratificacao = 0,
    adiantamento = 0,
  }: {
    salario: number
    horasTotais50?: number
    horasUteis50?: number
    horasDomingos100?: number
    modo: 'padrao_50' | 'clt_vigente'
    jornadaMensal?: number
    gratificacao?: number
    adiantamento?: number
  }) {
    const divisor = jornadaMensal > 0 ? jornadaMensal : 220
    const valorHoraNormal = salario > 0 ? salario / divisor : 0
    const valorHoraExtra50 = valorHoraNormal * 1.5
    const valorHoraExtra100 = valorHoraNormal * 2.0

    const grat = Math.max(0, Number(gratificacao) || 0)
    const adiant = Math.max(0, Number(adiantamento) || 0)

    let horas50 = 0
    let valorHoras50 = 0
    let horas100 = 0
    let valorHoras100 = 0
    let totalHoras = 0
    let totalValor = 0

    if (modo === 'padrao_50') {
      const h50 = Number(Math.max(0, horasTotais50).toFixed(2))
      const val50 = Number((h50 * valorHoraExtra50).toFixed(2))
      horas50 = h50
      valorHoras50 = val50
      horas100 = 0
      valorHoras100 = 0
      totalHoras = h50
      totalValor = val50
    } else {
      const h50 = Number(Math.max(0, horasUteis50).toFixed(2))
      const h100 = Number(Math.max(0, horasDomingos100).toFixed(2))
      const val50 = Number((h50 * valorHoraExtra50).toFixed(2))
      const val100 = Number((h100 * valorHoraExtra100).toFixed(2))
      horas50 = h50
      valorHoras50 = val50
      horas100 = h100
      valorHoras100 = val100
      totalHoras = Number((h50 + h100).toFixed(2))
      totalValor = Number((val50 + val100).toFixed(2))
    }

    // Líquido = Total Bruto Horas Extras + Gratificação - Adiantamento
    const valorLiquido = Number((totalValor + grat - adiant).toFixed(2))

    return {
      valorHoraNormal: Number(valorHoraNormal.toFixed(4)),
      valorHoraExtra50: Number(valorHoraExtra50.toFixed(4)),
      valorHoraExtra100: Number(valorHoraExtra100.toFixed(4)),
      horas50,
      valorHoras50,
      horas100,
      valorHoras100,
      totalHoras,
      totalValor,
      gratificacao: grat,
      adiantamento: adiant,
      valorLiquido,
    }
  },
}
