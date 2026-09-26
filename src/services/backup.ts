import pb from '@/lib/pocketbase/client'

export interface BackupItem {
  id: string
  nome_arquivo: string
  tipo: string
  origem: 'manual' | 'semanal_automatico' | string
  status: 'sucesso' | 'parcial' | 'falha' | string
  total_colecoes: number
  total_registros: number
  resumo_colecoes?: Record<string, number | { erro: string }>
  detalhes_execucao?: {
    timestamp?: string
    versao_pocketbase?: string
    origem?: string
    solicitado_por?: string
    total_registros_geral?: number
    colecoes_com_erro?: number
    nativo_zip_status?: string
    nativo_zip_arquivo?: string
    nativo_zip_erro?: string
    colecoes_processadas?: string[]
  }
  backup_duplicatas_incluido?: boolean
  observacoes?: string
  created: string
  // Google Drive
  drive_status?: 'enviado' | 'pendente' | 'erro' | 'nao_configurado' | string
  drive_file_id?: string
  drive_enviado_em?: string
  drive_erro?: string
  drive_folder_id?: string
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
  tipo_autenticacao: 'service_account' | 'oauth' | string
  configurado: boolean
  conectado: boolean
  chave_configurada: boolean
  client_email?: string
  client_email_mascarado?: string
  project_id?: string
  pasta_nome: string
  pasta_id: string
  ultimo_envio?: string
  status_conexao: 'conectado' | 'desconectado' | 'erro' | string
}

export interface GoogleDriveStatusResponse {
  success: boolean
  drive: GoogleDriveStatusInfo
}

export interface SalvarConfigDriveServiceAccountPayload {
  service_account_json?: string
  folder_id?: string
  folder_name?: string
}

// Mantido para compatibilidade caso algum ponto ainda referencie o nome antigo
export type SalvarConfigDrivePayload = SalvarConfigDriveServiceAccountPayload

export interface EnviarDriveResponse {
  success: boolean
  message: string
  file_id?: string
  folder_id?: string
  enviado_em?: string
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
    origem: string
    total_colecoes: number
    total_registros: number
    resumo_colecoes?: Record<string, number | { erro: string }>
    detalhes_execucao?: unknown
    drive_status?: string
    drive_file_id?: string
    drive_enviado_em?: string
    created: string
    exportado_em: string
    sistema: string
  }
  dados: Record<string, unknown[]>
}

export const backupService = {
  /**
   * Lista todos os backups já executados
   */
  async listarBackups(): Promise<BackupItem[]> {
    const res = await pb.send<ListarBackupsResponse>('/backend/v1/backups', {
      method: 'GET',
    })
    return res.backups || []
  },

  /**
   * Executa um backup completo imediato sob demanda (admin)
   */
  async executarBackupManual(): Promise<BackupItem> {
    const res = await pb.send<ExecutarBackupResponse>('/backend/v1/backups/executar', {
      method: 'POST',
    })
    return res.backup
  },

  /**
   * Obtém o status do agendamento automático semanal (Cron PocketBase)
   */
  async obterStatusAgendamento(): Promise<BackupAgendamentoInfo> {
    const res = await pb.send<{ success: boolean; agendamento: BackupAgendamentoInfo }>(
      '/backend/v1/backups/status-agendamento',
      {
        method: 'GET',
      },
    )
    return res.agendamento
  },

  /**
   * Baixa os dados consolidados do backup em formato JSON
   */
  async baixarDadosBackup(backupId: string): Promise<BackupDownloadPayload> {
    return await pb.send<BackupDownloadPayload>(`/backend/v1/backups/${backupId}/download`, {
      method: 'GET',
    })
  },

  /**
   * Consulta o status da integração com a Conta de Serviço do Google Drive
   */
  async obterStatusGoogleDrive(): Promise<GoogleDriveStatusInfo> {
    const res = await pb.send<GoogleDriveStatusResponse>('/backend/v1/google-drive/status', {
      method: 'GET',
    })
    return res.drive
  },

  /**
   * Salva a chave JSON da Conta de Serviço e/ou ID da pasta no Drive
   */
  async salvarConfiguracoesDrive(
    payload: SalvarConfigDriveServiceAccountPayload,
  ): Promise<{ success: boolean; message: string; client_email?: string; folder_id?: string }> {
    return await pb.send('/backend/v1/google-drive/config', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Desconecta / apaga a chave da conta de serviço salva
   */
  async desconectarGoogleDrive(): Promise<{ success: boolean; message: string }> {
    return await pb.send('/backend/v1/google-drive/desconectar', {
      method: 'POST',
    })
  },

  /**
   * Envia manualmente um backup específico ao Google Drive via Conta de Serviço
   */
  async enviarBackupAoDrive(backupId: string): Promise<EnviarDriveResponse> {
    return await pb.send<EnviarDriveResponse>(`/backend/v1/backups/${backupId}/enviar-drive`, {
      method: 'POST',
    })
  },

  /**
   * Dispara o download de um arquivo JSON pelo navegador do usuário
   */
  dispararDownloadNoNavegador(nomeArquivo: string, conteudoObj: unknown) {
    const jsonStr =
      typeof conteudoObj === 'string' ? conteudoObj : JSON.stringify(conteudoObj, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', nomeArquivo)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
