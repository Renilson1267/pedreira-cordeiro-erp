import pb from '@/lib/pocketbase/client'

export interface BackupItem {
  id: string
  nome_arquivo: string
  tipo: 'nativo_zip' | 'dump_json' | 'completo'
  status: 'sucesso' | 'parcial' | 'falha'
  total_colecoes: number
  total_registros: number
  resumo_colecoes?: Record<string, number | { erro: string }>
  detalhes_execucao?: {
    timestamp?: string
    versao_pocketbase?: string
    solicitado_por?: string
    nativo_zip_status?: string
    nativo_zip_arquivo?: string
    nativo_zip_erro?: string
    colecoes_processadas?: string[]
    [key: string]: unknown
  }
  backup_duplicatas_incluido?: boolean
  observacoes?: string
  created: string
}

export interface ListarBackupsResponse {
  success: boolean
  backups: BackupItem[]
}

export interface ExecutarBackupResponse {
  success: boolean
  backup: BackupItem
}

export interface BackupDownloadPayload {
  meta: {
    id: string
    nome_arquivo: string
    tipo: string
    total_colecoes: number
    total_registros: number
    resumo_colecoes: Record<string, number>
    detalhes_execucao?: Record<string, unknown>
    created: string
    exportado_em: string
    sistema: string
  }
  dados: Record<string, unknown[]>
}

export const backupService = {
  /**
   * Listar backups disponíveis
   */
  async listar(): Promise<BackupItem[]> {
    try {
      const res = await pb.send<ListarBackupsResponse>('/backend/v1/backups', {
        method: 'GET',
      })
      if (res?.backups) {
        return res.backups
      }
    } catch (e) {
      console.warn('Tentativa via hook falhou, consultando collection backups_sistema:', e)
    }

    // Fallback direto via SDK na collection backups_sistema
    const records = await pb.collection('backups_sistema').getFullList({
      sort: '-created',
    })

    return records.map((r) => ({
      id: r.id,
      nome_arquivo: r.nome_arquivo || `backup_${r.id}.json`,
      tipo: r.tipo || 'completo',
      status: r.status || 'sucesso',
      total_colecoes: r.total_colecoes || 0,
      total_registros: r.total_registros || 0,
      resumo_colecoes: r.resumo_colecoes,
      detalhes_execucao: r.detalhes_execucao,
      backup_duplicatas_incluido: r.backup_duplicatas_incluido,
      observacoes: r.observacoes || '',
      created: r.created,
    }))
  },

  /**
   * Disparar novo backup completo sob demanda
   */
  async executarBackup(): Promise<BackupItem> {
    const res = await pb.send<ExecutarBackupResponse>('/backend/v1/backups/executar', {
      method: 'POST',
    })
    return res.backup
  },

  /**
   * Baixar arquivo JSON completo consolidado com todas as tabelas e registros
   */
  async baixarArquivo(backupId: string, nomeArquivo?: string): Promise<void> {
    const payload = await pb.send<BackupDownloadPayload>(
      `/backend/v1/backups/${backupId}/download`,
      {
        method: 'GET',
      },
    )

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo || `backup_erp_${backupId}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
