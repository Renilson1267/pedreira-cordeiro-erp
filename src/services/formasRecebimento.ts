import pb from '@/lib/pocketbase/client'
import type { FormaRecebimento, ChequePredatado } from '@/types/erp'

export const FORMAS_RECEBIMENTO_PADRAO = [
  'Pix',
  'Cheque Pré-datado',
  'Depósito',
  'Dinheiro',
  'A Prazo',
  'Cartão',
  'Transferência Bancária',
] as const

export interface CreateFormaRecebimentoPayload {
  empresa_id: string
  nome: string
  ativo?: boolean
  ordem?: number
}

export interface UpdateFormaRecebimentoPayload {
  nome?: string
  ativo?: boolean
  ordem?: number
}

export const formasRecebimentoService = {
  async listar(empresaId: string, apenasAtivos = false): Promise<FormaRecebimento[]> {
    if (!empresaId) return []
    try {
      let filter = `empresa_id = '${empresaId}'`
      if (apenasAtivos) {
        filter += ` && ativo = true`
      }
      return await pb.collection('formas_recebimento').getFullList<FormaRecebimento>({
        filter,
        sort: 'ordem,nome',
      })
    } catch (err: any) {
      console.warn('Erro ao listar formas de recebimento:', err)
      return []
    }
  },

  async criar(payload: CreateFormaRecebimentoPayload): Promise<FormaRecebimento> {
    return await pb.collection('formas_recebimento').create<FormaRecebimento>({
      empresa_id: payload.empresa_id,
      nome: payload.nome.trim(),
      ativo: payload.ativo !== false,
      ordem: payload.ordem || 10,
    })
  },

  async atualizar(id: string, payload: UpdateFormaRecebimentoPayload): Promise<FormaRecebimento> {
    const data: Record<string, any> = {}
    if (payload.nome !== undefined) data.nome = payload.nome.trim()
    if (payload.ativo !== undefined) data.ativo = payload.ativo
    if (payload.ordem !== undefined) data.ordem = payload.ordem

    return await pb.collection('formas_recebimento').update<FormaRecebimento>(id, data)
  },

  async excluir(id: string): Promise<boolean> {
    return await pb.collection('formas_recebimento').delete(id)
  },

  /**
   * Garante que as 7 formas padrão existam para uma empresa específica
   */
  async garantirFormasPadrao(empresaId: string): Promise<FormaRecebimento[]> {
    if (!empresaId) return []
    const existentes = await this.listar(empresaId)
    const nomesExistentes = new Set(existentes.map((f) => f.nome.toLowerCase().trim()))

    let ordemAtual = (existentes.length + 1) * 10
    for (const padrao of FORMAS_RECEBIMENTO_PADRAO) {
      if (!nomesExistentes.has(padrao.toLowerCase().trim())) {
        try {
          const criada = await this.criar({
            empresa_id: empresaId,
            nome: padrao,
            ativo: true,
            ordem: ordemAtual,
          })
          existentes.push(criada)
          ordemAtual += 10
        } catch {
          /* intentionally ignored */
        }
      }
    }

    return existentes
  },
}

export interface CreateChequePredatadoPayload {
  empresa_id: string
  titulo_id?: string
  titulo_pagar_id?: string
  data: string
  valor: number
  numero?: string
  banco?: string
  status?: 'pendente' | 'compensado'
  data_compensacao?: string
  observacoes?: string
}

export const chequesPredatadosService = {
  async listarPorTitulo(tituloId: string): Promise<ChequePredatado[]> {
    if (!tituloId) return []
    try {
      return await pb.collection('cheques_predatados').getFullList<ChequePredatado>({
        filter: `titulo_id = '${tituloId}'`,
        sort: 'data,created',
      })
    } catch (err) {
      console.warn('Erro ao listar cheques predatados do título:', err)
      return []
    }
  },

  async listarPorTituloPagar(tituloPagarId: string): Promise<ChequePredatado[]> {
    if (!tituloPagarId) return []
    try {
      return await pb.collection('cheques_predatados').getFullList<ChequePredatado>({
        filter: `titulo_pagar_id = '${tituloPagarId}'`,
        sort: 'data,created',
      })
    } catch (err) {
      console.warn('Erro ao listar cheques predatados do título a pagar:', err)
      return []
    }
  },

  async listarPorEmpresa(empresaId: string): Promise<ChequePredatado[]> {
    if (!empresaId) return []
    try {
      return await pb.collection('cheques_predatados').getFullList<ChequePredatado>({
        filter: `empresa_id = '${empresaId}'`,
        sort: 'data',
        expand: 'titulo_id,titulo_pagar_id',
      })
    } catch (err) {
      console.warn('Erro ao listar cheques da empresa:', err)
      return []
    }
  },

  async criar(payload: CreateChequePredatadoPayload): Promise<ChequePredatado> {
    const dados: Record<string, any> = {
      empresa_id: payload.empresa_id,
      data: payload.data,
      valor: payload.valor,
      numero: payload.numero ? payload.numero.trim() : '',
      banco: payload.banco ? payload.banco.trim() : '',
      status: payload.status || 'pendente',
      data_compensacao: payload.data_compensacao || null,
      observacoes: payload.observacoes ? payload.observacoes.trim() : '',
    }
    if (payload.titulo_id) {
      dados.titulo_id = payload.titulo_id
    }
    if (payload.titulo_pagar_id) {
      dados.titulo_pagar_id = payload.titulo_pagar_id
    }

    return await pb.collection('cheques_predatados').create<ChequePredatado>(dados)
  },

  async atualizar(id: string, payload: Partial<ChequePredatado>): Promise<ChequePredatado> {
    return await pb.collection('cheques_predatados').update<ChequePredatado>(id, payload)
  },

  async excluir(id: string): Promise<boolean> {
    return await pb.collection('cheques_predatados').delete(id)
  },

  async salvarLote(
    empresaId: string,
    tituloId: string,
    cheques: Array<{
      id?: string
      data: string
      valor: number
      numero?: string
      banco?: string
    }>,
  ): Promise<ChequePredatado[]> {
    const existentes = await this.listarPorTitulo(tituloId)
    const existentesIds = new Set(existentes.map((c) => c.id))
    const enviadosIds = new Set(cheques.map((c) => c.id).filter(Boolean) as string[])

    // Excluir os que foram removidos pelo usuário
    for (const c of existentes) {
      if (!enviadosIds.has(c.id)) {
        await this.excluir(c.id)
      }
    }

    const resultados: ChequePredatado[] = []
    for (const chk of cheques) {
      if (chk.id && existentesIds.has(chk.id)) {
        // Atualizar
        const atualizado = await this.atualizar(chk.id, {
          data: chk.data,
          valor: chk.valor,
          numero: chk.numero || '',
          banco: chk.banco || '',
        })
        resultados.push(atualizado)
      } else {
        // Criar novo
        const criado = await this.criar({
          empresa_id: empresaId,
          titulo_id: tituloId,
          data: chk.data,
          valor: chk.valor,
          numero: chk.numero,
          banco: chk.banco,
          status: 'pendente',
        })
        resultados.push(criado)
      }
    }

    return resultados
  },

  async salvarLotePagar(
    empresaId: string,
    tituloPagarId: string,
    cheques: Array<{
      id?: string
      data: string
      valor: number
      numero?: string
      banco?: string
    }>,
  ): Promise<ChequePredatado[]> {
    const existentes = await this.listarPorTituloPagar(tituloPagarId)
    const existentesIds = new Set(existentes.map((c) => c.id))
    const enviadosIds = new Set(cheques.map((c) => c.id).filter(Boolean) as string[])

    // Excluir os que foram removidos pelo usuário
    for (const c of existentes) {
      if (!enviadosIds.has(c.id)) {
        await this.excluir(c.id)
      }
    }

    const resultados: ChequePredatado[] = []
    for (const chk of cheques) {
      if (chk.id && existentesIds.has(chk.id)) {
        // Atualizar
        const atualizado = await this.atualizar(chk.id, {
          data: chk.data,
          valor: chk.valor,
          numero: chk.numero || '',
          banco: chk.banco || '',
        })
        resultados.push(atualizado)
      } else {
        // Criar novo
        const criado = await this.criar({
          empresa_id: empresaId,
          titulo_pagar_id: tituloPagarId,
          data: chk.data,
          valor: chk.valor,
          numero: chk.numero,
          banco: chk.banco,
          status: 'pendente',
        })
        resultados.push(criado)
      }
    }

    return resultados
  },
}
