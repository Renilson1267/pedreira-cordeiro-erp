import pb from '@/lib/pocketbase/client'
import type { UserRole } from '@/types/erp'

export interface OperadorItem {
  id: string
  name: string
  email: string
  ativo: boolean
  verified?: boolean
  created: string
  updated: string
  role: UserRole
  empresa_id?: string
  empresa_nome?: string
  membros?: Array<{
    id: string
    empresa_id: string
    empresa_nome: string
    role: UserRole
  }>
}

export interface CriarOperadorPayload {
  name: string
  email: string
  password: string
  role: UserRole
  empresa_id?: string
}

export interface AtualizarOperadorPayload {
  id: string
  name?: string
  role?: UserRole
  ativo?: boolean
  empresa_id?: string
}

export interface RedefinirSenhaResponse {
  success: boolean
  tempPassword: string
  email: string
  name: string
}

export const operadoresService = {
  /**
   * Lista todos os operadores (requer privilégio de admin).
   */
  async listar(): Promise<OperadorItem[]> {
    const res = await pb.send<{ success: boolean; operadores: OperadorItem[] }>(
      '/backend/v1/operadores',
      {
        method: 'GET',
      },
    )
    return res.operadores || []
  },

  /**
   * Cria um novo operador.
   */
  async criar(payload: CriarOperadorPayload): Promise<OperadorItem> {
    const res = await pb.send<{ success: boolean; operador: OperadorItem }>(
      '/backend/v1/operadores',
      {
        method: 'POST',
        body: payload,
      },
    )
    return res.operador
  },

  /**
   * Atualiza nome, papel, empresa ou status ativo/inativo.
   */
  async atualizar(payload: AtualizarOperadorPayload): Promise<OperadorItem> {
    const res = await pb.send<{ success: boolean; operador: OperadorItem }>(
      '/backend/v1/operadores',
      {
        method: 'PUT',
        body: payload,
      },
    )
    return res.operador
  },

  /**
   * Redefine a senha de um operador gerando senha temporária amigável.
   */
  async redefinirSenha(id: string): Promise<RedefinirSenhaResponse> {
    return await pb.send<RedefinirSenhaResponse>('/backend/v1/operadores/redefinir-senha', {
      method: 'POST',
      body: { id },
    })
  },
}
