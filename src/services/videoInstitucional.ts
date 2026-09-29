import pb from '@/lib/pocketbase/client'

export interface VideoInstitucionalRecord {
  id: string
  titulo: string
  descricao?: string
  arquivo: string
  capa?: string
  poster?: string
  ativo: boolean
  tamanho_bytes?: number
  duracao_segundos?: number
  enviado_por_nome?: string
  enviado_por_id?: string
  created: string
  updated: string
  collectionId?: string
  collectionName?: string
}

export interface UploadProgressInfo {
  carregadoBytes: number
  totalBytes: number
  porcentagem: number
  etapa: 'preparando' | 'enviando' | 'processando' | 'concluido'
}

export interface UploadVideoInstitucionalParams {
  titulo: string
  descricao?: string
  arquivo: File
  capa?: File | null
  poster?: File | null // compatibilidade
  ativo?: boolean
  duracaoSegundos?: number
  enviadoPorNome?: string
  enviadoPorId?: string
  onProgress?: (info: UploadProgressInfo) => void
}

// Limites e constantes
export const MAX_VIDEO_SIZE_BYTES = 300 * 1024 * 1024 // 300 MB
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 300 * 1024 * 1024
export const CHUNK_SIZE_BYTES = 12 * 1024 * 1024
export const MAX_CHUNK_RETRIES = 2

// Formatos aceitos
export const FORMATOS_VIDEO_ACEITOS = ['.mp4', '.webm', '.quicktime', '.mov', '.ogg']
export const MIMES_VIDEO_ACEITOS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']

export function formatarMensagemErroUpload(
  status: number,
  responseData?: any,
  statusText?: string,
): string {
  // 1. Verificar mensagens específicas enviadas pelo PocketBase
  const dataMsg =
    responseData?.message ||
    responseData?.error ||
    (responseData?.data
      ? Object.values(responseData.data)
          .map((v: any) => v?.message || v)
          .join('; ')
      : '')

  if (
    status === 413 ||
    (status === 400 && /too large|file too large|excede o limite|maxSize|max size/i.test(dataMsg))
  ) {
    return 'Arquivo muito grande para o limite do servidor. O limite máximo é de 300 MB.'
  }

  if (status === 401) {
    return 'Sua sessão expirou. Faça login novamente para prosseguir.'
  }

  if (status === 403) {
    return 'Acesso negado: apenas administradores autorizados podem gerenciar o vídeo institucional.'
  }

  if (status === 400) {
    if (dataMsg) {
      if (/mime/i.test(dataMsg)) {
        return 'Formato de arquivo não suportado. Por favor, envie um vídeo MP4 ou WebM.'
      }
      return `Não foi possível processar o envio: ${dataMsg}`
    }
    return 'Dados inválidos enviados na requisição (erro 400).'
  }

  if (status === 0) {
    return 'Conexão interrompida. Verifique sua rede e tente novamente.'
  }

  if (status >= 500) {
    return 'Erro interno do servidor ao gravar o arquivo de vídeo. Tente novamente mais tarde.'
  }

  return dataMsg || statusText || `Falha no envio do vídeo (status ${status}).`
}

/**
 * Envio multipart nativo direto para /api/collections/config_video_institucional/records
 * usando XMLHttpRequest para rastrear xhr.upload.onprogress real (bytes transmitidos pelo browser).
 */
function uploadMultipartNativo<T = VideoInstitucionalRecord>(options: {
  url: string
  method: 'POST' | 'PATCH'
  formData: FormData
  token: string
  totalBytesEstimado: number
  onProgress?: (info: UploadProgressInfo) => void
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open(options.method, options.url, true)

    if (options.token) {
      xhr.setRequestHeader('Authorization', options.token)
    }

    // Progresso real do upload via xhr.upload
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100))
        options.onProgress?.({
          carregadoBytes: event.loaded,
          totalBytes: event.total,
          porcentagem: pct,
          etapa: pct >= 99 ? 'processando' : 'enviando',
        })
      } else {
        const carregado = event.loaded || 0
        const total = options.totalBytesEstimado || carregado
        const pct = total > 0 ? Math.min(99, Math.round((carregado / total) * 100)) : 50
        options.onProgress?.({
          carregadoBytes: carregado,
          totalBytes: total,
          porcentagem: pct,
          etapa: 'enviando',
        })
      }
    }

    xhr.onload = () => {
      const status = xhr.status
      let responseData: any = null
      try {
        responseData = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        responseData = { error: xhr.responseText }
      }

      if (status >= 200 && status < 300) {
        options.onProgress?.({
          carregadoBytes: options.totalBytesEstimado,
          totalBytes: options.totalBytesEstimado,
          porcentagem: 100,
          etapa: 'concluido',
        })
        resolve(responseData as T)
      } else {
        const mensagem = formatarMensagemErroUpload(status, responseData, xhr.statusText)
        const err = new Error(mensagem)
        ;(err as any).status = status
        ;(err as any).data = responseData
        reject(err)
      }
    }

    xhr.onerror = () => {
      const err = new Error('Conexão interrompida. Verifique sua rede e tente novamente.')
      ;(err as any).status = xhr.status || 0
      reject(err)
    }

    xhr.ontimeout = () => {
      const err = new Error(
        'Tempo limite de envio excedido (timeout). A requisição demorou muito para responder.',
      )
      ;(err as any).status = 408
      reject(err)
    }

    xhr.onabort = () => {
      const err = new Error('Envio cancelado.')
      ;(err as any).status = 0
      reject(err)
    }

    // Timeout generoso de 10 minutos para uploads de até 300 MB em conexões comuns
    xhr.timeout = 10 * 60 * 1000

    xhr.send(options.formData)
  })
}

export const videoInstitucionalService = {
  /**
   * Obtém o vídeo institucional ativo mais recente para exibição pública na Home.
   * Não requer autenticação (listRule público).
   */
  async obterAtivo(): Promise<VideoInstitucionalRecord | null> {
    try {
      const records = await pb
        .collection('config_video_institucional')
        .getList<VideoInstitucionalRecord>(1, 1, {
          filter: 'ativo = true',
          sort: '-created',
        })
      return records.items[0] || null
    } catch (err) {
      console.warn('Erro ao obter vídeo institucional ativo:', err)
      return null
    }
  },

  /**
   * Lista todos os registros de vídeos (para a tela administrativa do ERP).
   */
  async listar(): Promise<VideoInstitucionalRecord[]> {
    return await pb.collection('config_video_institucional').getFullList<VideoInstitucionalRecord>({
      sort: '-created',
    })
  },

  /**
   * Obtém um registro por id.
   */
  async obterPorId(id: string): Promise<VideoInstitucionalRecord> {
    return await pb.collection('config_video_institucional').getOne<VideoInstitucionalRecord>(id)
  },

  /**
   * Constrói a URL pública do arquivo (vídeo ou capa) no PocketBase.
   */
  obterUrlArquivo(
    record: { id: string; collectionId?: string; collectionName?: string },
    fileName: string,
  ): string {
    if (!fileName) return ''
    return pb.files.getURL(record, fileName)
  },

  /**
   * Envia um novo vídeo institucional usando o endpoint NATIVO de registros do PocketBase.
   * POST /api/collections/config_video_institucional/records
   */
  async criar(
    params: UploadVideoInstitucionalParams,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    return await this.salvarRegistroNativo(params, null, desativarOutros)
  },

  /**
   * Substitui um vídeo existente (PATCH /api/collections/config_video_institucional/records/:id).
   */
  async substituir(
    id: string,
    params: UploadVideoInstitucionalParams,
  ): Promise<VideoInstitucionalRecord> {
    return await this.salvarRegistroNativo(params, id, true)
  },

  /**
   * Executa o upload multipart nativo (POST para criar novo, PATCH para atualizar existente).
   * Sem passar pelo goja/JSVM.
   */
  async salvarRegistroNativo(
    params: UploadVideoInstitucionalParams,
    idExistente: string | null = null,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    const file = params.arquivo
    if (!file) {
      throw new Error('Nenhum arquivo de vídeo foi informado.')
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(
        `O arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB) ultrapassa o limite máximo de 300 MB permitido.`,
      )
    }

    const tornarAtivo = params.ativo ?? true

    // Se estiver ativando, desativa os outros antes
    if (tornarAtivo && desativarOutros) {
      await this.desativarTodos(idExistente || undefined)
    }

    params.onProgress?.({
      carregadoBytes: 0,
      totalBytes: file.size,
      porcentagem: 0,
      etapa: 'preparando',
    })

    const formData = new FormData()
    formData.append('titulo', params.titulo.trim())
    if (params.descricao) {
      formData.append('descricao', params.descricao.trim())
    }
    // Campo nativo de arquivo obrigatório
    formData.append('arquivo', file)

    // Imagem de capa (preenche tanto 'capa' quanto 'poster' para compatibilidade total)
    const arquivoCapa = params.capa || params.poster
    if (arquivoCapa) {
      formData.append('capa', arquivoCapa)
      formData.append('poster', arquivoCapa)
    }

    formData.append('ativo', String(tornarAtivo))
    formData.append('tamanho_bytes', String(file.size))
    if (params.duracaoSegundos) {
      formData.append('duracao_segundos', String(Math.round(params.duracaoSegundos)))
    }
    if (params.enviadoPorNome) {
      formData.append('enviado_por_nome', params.enviadoPorNome)
    }
    if (params.enviadoPorId) {
      formData.append('enviado_por_id', params.enviadoPorId)
    }

    const baseUrl = pb.baseUrl.replace(/\/$/, '')
    const token = pb.authStore.token
    const method = idExistente ? 'PATCH' : 'POST'
    const endpoint = idExistente
      ? `${baseUrl}/api/collections/config_video_institucional/records/${encodeURIComponent(idExistente)}`
      : `${baseUrl}/api/collections/config_video_institucional/records`

    const record = await uploadMultipartNativo<VideoInstitucionalRecord>({
      url: endpoint,
      method,
      formData,
      token,
      totalBytesEstimado: file.size + (arquivoCapa?.size || 0),
      onProgress: params.onProgress,
    })

    return record
  },

  /**
   * Alterna o status ativo/inativo de um vídeo.
   */
  async alternarAtivo(id: string, novoAtivo: boolean): Promise<VideoInstitucionalRecord> {
    if (novoAtivo) {
      await this.desativarTodos(id)
    }
    return await pb.collection('config_video_institucional').update<VideoInstitucionalRecord>(id, {
      ativo: novoAtivo,
    })
  },

  /**
   * Atualiza apenas metadados (título, descrição).
   */
  async atualizarMetadados(
    id: string,
    dados: { titulo?: string; descricao?: string },
  ): Promise<VideoInstitucionalRecord> {
    return await pb
      .collection('config_video_institucional')
      .update<VideoInstitucionalRecord>(id, dados)
  },

  /**
   * Remove o registro do banco de dados (o PocketBase apaga automaticamente os arquivos físicos vinculados).
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('config_video_institucional').delete(id)
  },

  /**
   * Desativa todos os vídeos (ou todos exceto um determinado id).
   */
  async desativarTodos(excetoId?: string): Promise<void> {
    try {
      const ativos = await pb
        .collection('config_video_institucional')
        .getFullList<VideoInstitucionalRecord>({
          filter: 'ativo = true',
        })
      for (const item of ativos) {
        if (excetoId && item.id === excetoId) continue
        await pb.collection('config_video_institucional').update(item.id, { ativo: false })
      }
    } catch (err) {
      console.warn('Erro ao desativar vídeos anteriores:', err)
    }
  },
}
