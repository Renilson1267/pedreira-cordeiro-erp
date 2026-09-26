import pb from '@/lib/pocketbase/client'

export interface BackupItem {
  id: string
  nome_arquivo: string
  tipo: 'nativo_zip' | 'dump_json' | 'completo'
  origem: 'manual' | 'semanal_automatico' | string
  status: 'sucesso' | 'parcial' | 'falha'
  total_colecoes: number
  total_registros: number
  resumo_colecoes?: Record<string, number | { erro: string }>
  detalhes_execucao?: {
    timestamp?: string
    versao_pocketbase?: string
    origem?: string
    solicitado_por?: string
    nativo_zip_status?: string
    nativo_zip_arquivo?: string
    nativo_zip_erro?: string
    colecoes_processadas?: string[]
    [key: string]: unknown
  }
  backup_duplicatas_incluido?: boolean
  observacoes?: string
  drive_status?: 'pendente' | 'enviado' | 'erro' | 'nao_configurado' | string
  drive_file_id?: string
  drive_enviado_em?: string
  drive_erro?: string
  drive_folder_id?: string
  created: string
}

export interface BackupAgendamentoInfo {
  ativo: boolean
  job_id: string
  cron_expressao: string
  horario_legivel: string
  frequencia: string
  descricao: string
  ultimo_backup_automatico?: {
    id: string
    nome_arquivo: string
    status: string
    origem: string
    total_registros: number
    total_colecoes: number
    drive_status?: string
    created: string
  } | null
}

export interface GoogleDriveStatusInfo {
  configurado: boolean
  conectado: boolean
  client_id_definido: boolean
  client_secret_definido: boolean
  refresh_token_definido: boolean
  pasta_nome: string
  pasta_id?: string
  conta_email?: string
  conta_nome?: string
  ultimo_envio?: string
  status_conexao: 'conectado' | 'pendente_autorizacao' | 'desconectado'
  redirect_uri_recomendada: string
}

export interface GoogleDriveStatusResponse {
  success: boolean
  drive: GoogleDriveStatusInfo
}

export interface GoogleDriveAuthUrlResponse {
  success: boolean
  auth_url: string
  redirect_uri: string
}

export interface SalvarConfigDrivePayload {
  client_id?: string
  client_secret?: string
  folder_id?: string
  folder_name?: string
  refresh_token?: string
}

export interface EnviarDriveResponse {
  success: boolean
  message: string
  file_id: string
  folder_id?: string
  enviado_em: string
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
      origem: r.origem || 'manual',
      status: r.status || 'sucesso',
      total_colecoes: r.total_colecoes || 0,
      total_registros: r.total_registros || 0,
      resumo_colecoes: r.resumo_colecoes,
      detalhes_execucao: r.detalhes_execucao,
      backup_duplicatas_incluido: r.backup_duplicatas_incluido,
      observacoes: r.observacoes || '',
      drive_status: r.drive_status || 'pendente',
      drive_file_id: r.drive_file_id || '',
      drive_enviado_em: r.drive_enviado_em || '',
      drive_erro: r.drive_erro || '',
      drive_folder_id: r.drive_folder_id || '',
      created: r.created,
    }))
  },

  /**
   * Consultar status do agendamento do backup semanal automático
   */
  async obterStatusAgendamento(): Promise<BackupAgendamentoInfo> {
    try {
      const res = await pb.send<{ success: boolean; agendamento: BackupAgendamentoInfo }>(
        '/backend/v1/backups/status-agendamento',
        { method: 'GET' },
      )
      if (res?.agendamento) {
        return res.agendamento
      }
    } catch (e) {
      console.warn('Falha ao consultar status de agendamento no hook:', e)
    }

    // Fallback consultando collection diretamente
    let ultimoAuto = null
    try {
      const records = await pb.collection('backups_sistema').getList(1, 1, {
        filter: "origem = 'semanal_automatico'",
        sort: '-created',
      })
      if (records.items.length > 0) {
        const r = records.items[0]
        ultimoAuto = {
          id: r.id,
          nome_arquivo: r.nome_arquivo,
          status: r.status,
          origem: 'semanal_automatico',
          total_registros: r.total_registros,
          total_colecoes: r.total_colecoes,
          drive_status: r.drive_status || 'pendente',
          created: r.created,
        }
      }
    } catch {
      /* intentionally ignored */
    }

    return {
      ativo: true,
      job_id: 'backup_semanal_pedreira_cordeiro',
      cron_expressao: '30 0 * * 0',
      horario_legivel: 'Todo domingo às 00:30 (horário do servidor)',
      frequencia: 'Semanal',
      descricao: 'Backup automático semanal cobrindo todas as 28 coleções do ERP',
      ultimo_backup_automatico: ultimoAuto,
    }
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

  /**
   * Consultar status da integração com Google Drive
   */
  async obterStatusDrive(): Promise<GoogleDriveStatusInfo> {
    try {
      const res = await pb.send<GoogleDriveStatusResponse>('/backend/v1/google-drive/status', {
        method: 'GET',
      })
      if (res?.drive) {
        return res.drive
      }
    } catch (e) {
      console.warn('Erro ao consultar status Google Drive:', e)
    }

    return {
      configurado: false,
      conectado: false,
      client_id_definido: false,
      client_secret_definido: false,
      refresh_token_definido: false,
      pasta_nome: 'Backups ERP',
      status_conexao: 'desconectado',
      redirect_uri_recomendada:
        'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth/callback',
    }
  },

  /**
   * Obter URL de autorização OAuth do Google Drive
   */
  async obterAuthUrlDrive(): Promise<GoogleDriveAuthUrlResponse> {
    return pb.send<GoogleDriveAuthUrlResponse>('/backend/v1/google-drive/auth-url', {
      method: 'GET',
    })
  },

  /**
   * Salvar credenciais/configuração do Google Drive
   */
  async salvarConfigDrive(
    payload: SalvarConfigDrivePayload,
  ): Promise<{ success: boolean; message: string }> {
    return pb.send<{ success: boolean; message: string }>('/backend/v1/google-drive/config', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Desconectar Google Drive (remover refresh token)
   */
  async desconectarDrive(): Promise<{ success: boolean; message: string }> {
    return pb.send<{ success: boolean; message: string }>('/backend/v1/google-drive/desconectar', {
      method: 'POST',
    })
  },

  /**
   * Enviar backup individual ao Google Drive
   */
  async enviarBackupAoDrive(backupId: string): Promise<EnviarDriveResponse> {
    return pb.send<EnviarDriveResponse>(`/backend/v1/backups/${backupId}/enviar-drive`, {
      method: 'POST',
    })
  },
}
