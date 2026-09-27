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
  drive_status?:
    | 'enviado'
    | 'pendente'
    | 'erro'
    | 'nao_configurado'
    | 'solicitado'
    | 'enviando'
    | string
  drive_file_id?: string
  drive_enviado_em?: string
  drive_erro?: string
  drive_folder_id?: string
  drive_offset?: number
  drive_total_bytes?: number
  drive_session_url?: string
  drive_tentativas?: number
  drive_progresso_chunk?: number
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
  usuario_email?: string
  ultimo_envio?: string
  status_conexao: 'conectado' | 'desconectado' | 'erro' | string
  oauth_status?: 'conectado' | 'desconectado' | string
  oauth_client_id?: string
  oauth_conectado?: boolean
}

export interface GoogleDriveStatusResponse {
  success: boolean
  drive: GoogleDriveStatusInfo
}

export interface SalvarConfigDriveServiceAccountPayload {
  service_account_json?: string
  folder_id?: string
  folder_name?: string
  usuario_email?: string
}

export interface SalvarConfigDriveOAuthPayload {
  client_id: string
  client_secret: string
}

export interface EnviarDriveResponse {
  success: boolean
  message: string
  file_id?: string
  folder_id?: string
  destino?: string
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
   * Lista todos os backups já executados com fallback automático via SDK se o endpoint customizado falhar
   */
  async listarBackups(): Promise<BackupItem[]> {
    try {
      const res = await pb.send<ListarBackupsResponse>('/backend/v1/backups', {
        method: 'GET',
      })
      if (res && Array.isArray(res.backups)) {
        return res.backups
      }
    } catch (err) {
      console.warn(
        '[backupService.listarBackups] Falha no endpoint customizado, tentando fallback SDK:',
        err,
      )
    }

    // Fallback: listar diretamente da coleção backups_sistema via PocketBase SDK
    try {
      const records = await pb.collection('backups_sistema').getFullList<Record<string, unknown>>({
        sort: '-created',
      })
      return records.map((r) => ({
        id: String(r.id || ''),
        nome_arquivo: String(r.nome_arquivo || `backup_${r.id}.json`),
        tipo: String(r.tipo || 'completo'),
        origem: String(r.origem || 'manual'),
        status: String(r.status || 'sucesso'),
        total_colecoes: Number(r.total_colecoes || 0),
        total_registros: Number(r.total_registros || 0),
        resumo_colecoes: (r.resumo_colecoes as Record<string, number | { erro: string }>) || {},
        detalhes_execucao: (r.detalhes_execucao as BackupItem['detalhes_execucao']) || {},
        backup_duplicatas_incluido: Boolean(r.backup_duplicatas_incluido),
        observacoes: String(r.observacoes || ''),
        created: String(r.created || ''),
        drive_status: String(r.drive_status || 'pendente'),
        drive_file_id: String(r.drive_file_id || ''),
        drive_enviado_em: String(r.drive_enviado_em || ''),
        drive_erro: String(r.drive_erro || ''),
        drive_folder_id: String(r.drive_folder_id || ''),
        drive_offset: Number(r.drive_offset || 0),
        drive_total_bytes: Number(r.drive_total_bytes || 0),
        drive_session_url: String(r.drive_session_url || ''),
        drive_tentativas: Number(r.drive_tentativas || 0),
        drive_progresso_chunk: Number(r.drive_progresso_chunk || 0),
      }))
    } catch (sdkErr) {
      console.error('[backupService.listarBackups] Erro também no fallback SDK:', sdkErr)
      return []
    }
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
   * Obtém o status do agendamento automático semanal (Cron PocketBase) com fallback resiliente
   */
  async obterStatusAgendamento(): Promise<BackupAgendamentoInfo> {
    try {
      const res = await pb.send<{ success: boolean; agendamento: BackupAgendamentoInfo }>(
        '/backend/v1/backups/status-agendamento',
        {
          method: 'GET',
        },
      )
      if (res && res.agendamento) {
        return res.agendamento
      }
    } catch (err) {
      console.warn(
        '[backupService.obterStatusAgendamento] Falha no endpoint, usando fallback local:',
        err,
      )
    }

    return {
      ativo: true,
      job_id: 'backup_semanal_pedreira_cordeiro',
      cron_expressao: '30 0 * * 0',
      horario_legivel: 'Todo domingo às 00:30 (horário do servidor)',
      frequencia: 'Semanal',
      descricao: 'Backup automático semanal cobrindo todas as coleções do ERP',
      ultimo_backup_automatico: null,
    }
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
   * Consulta o status da integração com a Conta de Serviço do Google Drive com fallback resiliente
   */
  async obterStatusGoogleDrive(): Promise<GoogleDriveStatusInfo> {
    try {
      const res = await pb.send<GoogleDriveStatusResponse>('/backend/v1/google-drive/status', {
        method: 'GET',
      })
      if (res && res.drive) {
        return res.drive
      }
    } catch (err) {
      console.warn(
        '[backupService.obterStatusGoogleDrive] Falha no endpoint, usando fallback seguro:',
        err,
      )
    }

    return {
      tipo_autenticacao: 'service_account',
      configurado: false,
      conectado: false,
      chave_configurada: false,
      client_email: '',
      client_email_mascarado: '',
      project_id: '',
      pasta_nome: 'Backups ERP',
      pasta_id: '',
      usuario_email: 'renilsonfmello@gmail.com',
      ultimo_envio: '',
      status_conexao: 'desconectado',
    }
  },

  /**
   * Salva a chave JSON da Conta de Serviço e/ou ID da pasta no Drive com timeout seguro (AbortController ~20s)
   */
  async salvarConfiguracoesDrive(
    payload: SalvarConfigDriveServiceAccountPayload,
    signal?: AbortSignal,
  ): Promise<{
    success: boolean
    message: string
    client_email?: string
    folder_id?: string
    usuario_email?: string
    validacao_online?: {
      testada: boolean
      sucesso: boolean
      aviso: string
    }
  }> {
    return await pb.send('/backend/v1/google-drive/config', {
      method: 'POST',
      body: payload,
      signal,
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
   * Salva credenciais do cliente OAuth 2.0 (client_id e client_secret) no backend
   */
  async salvarConfiguracoesOAuth(
    payload: SalvarConfigDriveOAuthPayload,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return await pb.send('/backend/v1/google-drive/oauth-config', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Solicita URL de autorização OAuth do Google Drive
   */
  async iniciarOAuthDrive(): Promise<{
    success: boolean
    url?: string
    auth_url?: string
    redirect_uri?: string
    error?: string
  }> {
    return await pb.send('/backend/v1/google-drive/drive-oauth-start', {
      method: 'GET',
    })
  },

  /**
   * Desconecta o OAuth do Google Drive (limpa refresh token e status)
   */
  async desconectarOAuthDrive(): Promise<{ success: boolean; message?: string; error?: string }> {
    return await pb.send('/backend/v1/google-drive/oauth-desconectar', {
      method: 'POST',
    })
  },

  /**
   * Envia manualmente um backup específico ao Google Drive via Conta de Serviço
   * Monta URL absoluta segura sem barra dupla, headers Authorization com token,
   * Content-Type: application/json e body {}, com fallback nativo via fetch (timeout 60s)
   */
  async enviarBackupAoDrive(backupId: string): Promise<EnviarDriveResponse> {
    const rawBase = (pb.baseUrl || '').replace(/\/+$/, '')
    const path = `/backend/v1/backups/${encodeURIComponent(backupId)}/enviar-drive`
    const absoluteUrl = rawBase ? `${rawBase}${path}` : path
    const token = pb.authStore?.token || ''

    // 1. Tentativa principal via pb.send com token e headers explícitos
    try {
      const res = await pb.send<EnviarDriveResponse>(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: {},
      })
      if (res && typeof res === 'object') {
        return res
      }
    } catch (pbErr: unknown) {
      const status = (pbErr as { status?: number })?.status
      console.warn(
        '[backupService.enviarBackupAoDrive] pb.send retornou erro/status:',
        status,
        pbErr,
      )

      // Se não for status 0 (rede/preflight) ou se já tiver status HTTP conhecido com mensagem, repassa ou tenta o fallback
      if (status && status !== 0) {
        throw pbErr
      }
    }

    // 2. Fallback resiliente com fetch nativo e timeout de 60s
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60000)

    try {
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        fetchHeaders['Authorization'] = token
      }

      const response = await fetch(absoluteUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({}),
        signal: controller.signal,
      })

      clearTimeout(timer)

      let data: unknown = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        const errObj = (data as { error?: string; message?: string }) || {}
        const serverMsg =
          errObj.error || errObj.message || `HTTP ${response.status} ${response.statusText}`
        const error = new Error(serverMsg) as Error & {
          status?: number
          data?: unknown
          response?: unknown
        }
        error.status = response.status
        error.data = data
        error.response = data
        throw error
      }

      return (
        (data as EnviarDriveResponse) || {
          success: true,
          message: 'Backup enviado com sucesso ao Drive',
        }
      )
    } catch (fetchErr: unknown) {
      clearTimeout(timer)
      if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
        const timeoutErr = new Error(
          'Tempo limite excedido (60s) ao enviar backup para o Google Drive.',
        ) as Error & { status?: number }
        timeoutErr.status = 408
        throw timeoutErr
      }
      throw fetchErr
    }
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
