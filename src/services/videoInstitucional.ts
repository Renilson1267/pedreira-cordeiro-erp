import pb from '@/lib/pocketbase/client'

export interface VideoInstitucionalRecord {
  id: string
  titulo: string
  descricao?: string
  arquivo: string
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
  chunkAtual?: number
  totalChunks?: number
  tentativa?: number
}

export interface UploadVideoInstitucionalParams {
  titulo: string
  descricao?: string
  arquivo: File
  poster?: File | null
  ativo?: boolean
  duracaoSegundos?: number
  enviadoPorNome?: string
  enviadoPorId?: string
  onProgress?: (info: UploadProgressInfo) => void
}

// Limites e constantes
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB
// Limite para tentar rota direta primeiro (ex: vídeos <= 20 MB tentam envio direto)
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 MB
// Tamanho de cada bloco/chunk (12 MB por bloco, dentro da faixa de 10–15 MB)
export const CHUNK_SIZE_BYTES = 12 * 1024 * 1024 // 12 MB
// Número máximo de retries por bloco (2 tentativas de repetição adicionais)
export const MAX_CHUNK_RETRIES = 2

// Formatos aceitos
export const FORMATOS_VIDEO_ACEITOS = ['.mp4', '.webm', '.quicktime', '.mov', '.ogg']
export const MIMES_VIDEO_ACEITOS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function obterMensagemErroAmigavel(err: any): string {
  if (!err) return 'Erro desconhecido ao processar o vídeo institucional.'
  const msg = err.message || (typeof err === 'string' ? err : '')

  if (
    msg.includes('AbortError') ||
    msg.includes('abortado') ||
    msg.includes('timeout') ||
    msg.includes('Tempo limite excedido')
  ) {
    return 'Tempo limite de envio excedido (timeout). A requisição demorou muito para responder no navegador.'
  }

  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ERR_CONNECTION') ||
    msg.includes('ECONNRESET') ||
    msg.includes('conexão')
  ) {
    return 'Falha de conexão com o servidor ou requisição interrompida pelo navegador.'
  }

  if (
    msg.includes('413') ||
    msg.includes('too large') ||
    msg.includes('excede o limite') ||
    msg.includes('Payload Too Large') ||
    msg.includes('maior que 200 MB')
  ) {
    return 'O arquivo ultrapassa o limite máximo permitido de 200 MB. Comprima ou reexporte o vídeo antes de enviar.'
  }

  if (msg.includes('401') || msg.includes('Não autorizado') || msg.includes('requireAuth')) {
    return 'Sua sessão de usuário expirou ou você não está autenticado. Faça login novamente para prosseguir.'
  }

  if (msg.includes('403') || msg.includes('proibido')) {
    return 'Acesso negado: apenas administradores autorizados podem gerenciar o vídeo institucional.'
  }

  if (msg.includes('500') || msg.includes('Internal Server Error')) {
    return 'Erro interno do servidor ao processar o arquivo de vídeo. Tente novamente mais tarde.'
  }

  return msg || 'Ocorreu um erro ao salvar o vídeo institucional no servidor.'
}

/**
 * Utilitário de requisição HTTP autenticada via fetch com suporte a timeout.
 * Usa o token atual do PocketBase (pb.authStore.token) no header Authorization.
 */
async function fetchAutenticadoComTimeout<T = any>(
  path: string,
  options: {
    method?: string
    body?: BodyInit | null
    timeoutMs?: number
  } = {},
): Promise<T> {
  const baseUrl = pb.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const token = pb.authStore.token
  const timeoutMs = options.timeoutMs ?? 120000 // 2 minutos padrão por requisição

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(
      new Error(`Tempo limite de ${Math.round(timeoutMs / 1000)}s excedido na requisição.`),
    )
  }, timeoutMs)

  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = token
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      body: options.body,
      headers: headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const contentType = response.headers.get('content-type') || ''
    let data: any = null
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null)
    } else {
      const text = await response.text().catch(() => '')
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: text }
      }
    }

    if (!response.ok) {
      const errorMsg =
        data?.error ||
        data?.message ||
        `Erro ${response.status} (${response.statusText || 'Falha no servidor'})`
      const err = new Error(errorMsg)
      ;(err as any).status = response.status
      ;(err as any).data = data
      throw err
    }

    return data as T
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error?.name === 'AbortError' || error?.message?.includes('Tempo limite')) {
      throw new Error('Tempo limite da requisição excedido (timeout). A conexão pode estar lenta.')
    }
    throw error
  }
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
   * Constrói a URL pública do arquivo (vídeo ou poster) no PocketBase.
   */
  obterUrlArquivo(
    record: { id: string; collectionId?: string; collectionName?: string },
    fileName: string,
  ): string {
    if (!fileName) return ''
    return pb.files.getURL(record, fileName)
  },

  /**
   * Envia um novo vídeo institucional.
   * Usa automaticamente upload fracionado (chunks) para arquivos grandes (> DIRECT_UPLOAD_THRESHOLD_BYTES)
   * ou fallback se o envio direto falhar.
   */
  async criar(
    params: UploadVideoInstitucionalParams,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    return await this.uploadComChunksEFallback(params, null, desativarOutros)
  },

  /**
   * Substitui um vídeo existente por um novo arquivo.
   */
  async substituir(
    id: string,
    params: UploadVideoInstitucionalParams,
  ): Promise<VideoInstitucionalRecord> {
    return await this.uploadComChunksEFallback(params, id, true)
  },

  /**
   * Upload inteligente: se o arquivo for menor que o limite de corte (15 MB), tenta primeiro
   * a rota direta do PocketBase/Hook. Se for maior ou se o envio direto falhar (ex: por aborto de conexão),
   * recorre imediatamente ao envio fracionado (chunks).
   */
  async uploadComChunksEFallback(
    params: UploadVideoInstitucionalParams,
    substituindoId: string | null = null,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    const file = params.arquivo

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(
        `O arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB) ultrapassa o limite máximo de 200 MB permitido.`,
      )
    }

    // Se o arquivo for pequeno o suficiente, tenta o upload direto primeiro
    if (file.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
      try {
        params.onProgress?.({
          carregadoBytes: 0,
          totalBytes: file.size,
          porcentagem: 5,
          etapa: 'preparando',
        })
        return await this.uploadDireto(params, substituindoId, desativarOutros)
      } catch (directErr: any) {
        console.warn(
          'Upload direto não pôde ser completado. Recorrendo ao envio em partes (chunks)...',
          directErr,
        )
        // Fallback imediato para chunks
      }
    }

    // Envio fracionado em blocos (chunks)
    return await this.uploadEmChunks(params, substituindoId)
  },

  /**
   * Upload direto via rota personalizada do hook (suporta até 200 MB com bodyLimit estendido)
   * ou via SDK nativo do PocketBase como contingência.
   */
  async uploadDireto(
    params: UploadVideoInstitucionalParams,
    substituindoId: string | null,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    const formData = new FormData()
    formData.append('titulo', params.titulo.trim())
    if (params.descricao) {
      formData.append('descricao', params.descricao.trim())
    }
    formData.append('arquivo', params.arquivo)
    if (params.poster) {
      formData.append('poster', params.poster)
    }
    formData.append('ativo', String(params.ativo ?? true))
    formData.append('tamanho_bytes', String(params.arquivo.size))
    if (params.duracaoSegundos) {
      formData.append('duracao_segundos', String(Math.round(params.duracaoSegundos)))
    }
    if (params.enviadoPorNome) {
      formData.append('enviado_por_nome', params.enviadoPorNome)
    }
    if (params.enviadoPorId) {
      formData.append('enviado_por_id', params.enviadoPorId)
    }
    if (substituindoId) {
      formData.append('substituindo_id', substituindoId)
    }

    params.onProgress?.({
      carregadoBytes: Math.round(params.arquivo.size * 0.2),
      totalBytes: params.arquivo.size,
      porcentagem: 20,
      etapa: 'enviando',
    })

    // Tentar via endpoint /backend/v1/video-institucional/upload usando fetchAutenticadoComTimeout
    try {
      const res = await fetchAutenticadoComTimeout<VideoInstitucionalRecord>(
        '/backend/v1/video-institucional/upload',
        {
          method: 'POST',
          body: formData,
          timeoutMs: 180000, // 3 minutos para upload direto
        },
      )

      params.onProgress?.({
        carregadoBytes: params.arquivo.size,
        totalBytes: params.arquivo.size,
        porcentagem: 100,
        etapa: 'concluido',
      })

      return res
    } catch (hookErr: any) {
      console.warn('Falha na rota direta do hook /backend/v1/video-institucional/upload:', hookErr)
      // Se a rota custom falhar, tentar via SDK padrão como fallback
      if (substituindoId) {
        if (params.ativo ?? true) {
          await this.desativarTodos(substituindoId)
        }
        const updated = await pb
          .collection('config_video_institucional')
          .update<VideoInstitucionalRecord>(substituindoId, formData)
        params.onProgress?.({
          carregadoBytes: params.arquivo.size,
          totalBytes: params.arquivo.size,
          porcentagem: 100,
          etapa: 'concluido',
        })
        return updated
      } else {
        if ((params.ativo ?? true) && desativarOutros) {
          await this.desativarTodos()
        }
        const created = await pb
          .collection('config_video_institucional')
          .create<VideoInstitucionalRecord>(formData)
        params.onProgress?.({
          carregadoBytes: params.arquivo.size,
          totalBytes: params.arquivo.size,
          porcentagem: 100,
          etapa: 'concluido',
        })
        return created
      }
    }
  },

  /**
   * Upload fracionado em blocos (chunks) sequenciais com FormData, retries por bloco e progresso real em bytes.
   */
  async uploadEmChunks(
    params: UploadVideoInstitucionalParams,
    substituindoId: string | null = null,
  ): Promise<VideoInstitucionalRecord> {
    const file = params.arquivo
    const totalBytes = file.size
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE_BYTES)

    params.onProgress?.({
      carregadoBytes: 0,
      totalBytes: totalBytes,
      porcentagem: 0,
      etapa: 'preparando',
      chunkAtual: 0,
      totalChunks: totalChunks,
    })

    // 1. Iniciar sessão de chunks
    const initForm = new FormData()
    initForm.append('file_name', file.name)
    initForm.append('file_size', String(totalBytes))
    initForm.append('total_chunks', String(totalChunks))
    initForm.append('titulo', params.titulo.trim())
    if (params.descricao) {
      initForm.append('descricao', params.descricao.trim())
    }
    if (substituindoId) {
      initForm.append('substituindo_id', substituindoId)
    }
    initForm.append('ativo', String(params.ativo ?? true))
    if (params.duracaoSegundos) {
      initForm.append('duracao_segundos', String(Math.round(params.duracaoSegundos)))
    }
    if (params.enviadoPorNome) {
      initForm.append('enviado_por_nome', params.enviadoPorNome)
    }
    if (params.enviadoPorId) {
      initForm.append('enviado_por_id', params.enviadoPorId)
    }
    if (params.poster) {
      initForm.append('poster', params.poster)
    }

    let sessionId = ''
    try {
      const initRes = await fetchAutenticadoComTimeout<{
        success: boolean
        session_id: string
        total_chunks: number
      }>('/backend/v1/video-institucional/chunk/init', {
        method: 'POST',
        body: initForm,
        timeoutMs: 60000,
      })
      sessionId = initRes.session_id
    } catch (initErr: any) {
      throw new Error(
        `Falha ao iniciar sessão de upload fracionado: ${obterMensagemErroAmigavel(initErr)}`,
      )
    }

    let bytesEnviadosTotal = 0
    // Total de tentativas: 1 inicial + MAX_CHUNK_RETRIES retentativas
    const totalTentativasPermitidas = 1 + MAX_CHUNK_RETRIES

    // 2. Enviar blocos sequencialmente
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE_BYTES
      const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes)
      const chunkBlob = file.slice(start, end)
      const chunkSize = chunkBlob.size

      let sucessoBloco = false
      let ultimoErro: any = null

      for (let tentativa = 1; tentativa <= totalTentativasPermitidas; tentativa++) {
        try {
          const chunkForm = new FormData()
          chunkForm.append('session_id', sessionId)
          chunkForm.append('chunk_index', String(chunkIndex))
          chunkForm.append('chunk', chunkBlob, `part_${chunkIndex}.bin`)

          params.onProgress?.({
            carregadoBytes: bytesEnviadosTotal,
            totalBytes: totalBytes,
            porcentagem: Math.min(98, Math.round((bytesEnviadosTotal / totalBytes) * 100)),
            etapa: 'enviando',
            chunkAtual: chunkIndex + 1,
            totalChunks: totalChunks,
            tentativa: tentativa > 1 ? tentativa : undefined,
          })

          await fetchAutenticadoComTimeout('/backend/v1/video-institucional/chunk/part', {
            method: 'POST',
            body: chunkForm,
            timeoutMs: 90000, // 90 segundos por bloco de 10-15 MB
          })

          sucessoBloco = true
          bytesEnviadosTotal += chunkSize

          params.onProgress?.({
            carregadoBytes: bytesEnviadosTotal,
            totalBytes: totalBytes,
            porcentagem: Math.min(98, Math.round((bytesEnviadosTotal / totalBytes) * 100)),
            etapa: 'enviando',
            chunkAtual: chunkIndex + 1,
            totalChunks: totalChunks,
          })

          break
        } catch (errPart: any) {
          ultimoErro = errPart
          console.warn(
            `Erro no bloco ${chunkIndex + 1}/${totalChunks} (tentativa ${tentativa}/${totalTentativasPermitidas}):`,
            errPart,
          )
          if (tentativa < totalTentativasPermitidas) {
            await sleep(1000 * tentativa)
          }
        }
      }

      if (!sucessoBloco) {
        // Aborta a sessão no servidor para liberar espaço temporário
        try {
          const abortForm = new FormData()
          abortForm.append('session_id', sessionId)
          await fetchAutenticadoComTimeout('/backend/v1/video-institucional/chunk/abort', {
            method: 'POST',
            body: abortForm,
            timeoutMs: 15000,
          })
        } catch {
          /* intentionally ignored */
        }

        throw new Error(
          `Falha ao enviar bloco ${chunkIndex + 1} de ${totalChunks} após ${totalTentativasPermitidas} tentativas: ${obterMensagemErroAmigavel(ultimoErro)}`,
        )
      }
    }

    // 3. Finalizar montagem e gravação no banco
    params.onProgress?.({
      carregadoBytes: totalBytes,
      totalBytes: totalBytes,
      porcentagem: 99,
      etapa: 'processando',
      chunkAtual: totalChunks,
      totalChunks: totalChunks,
    })

    try {
      const completeForm = new FormData()
      completeForm.append('session_id', sessionId)

      const completeRes = await fetchAutenticadoComTimeout<VideoInstitucionalRecord>(
        '/backend/v1/video-institucional/chunk/complete',
        {
          method: 'POST',
          body: completeForm,
          timeoutMs: 120000, // 2 minutos para montagem e persistência no banco
        },
      )

      params.onProgress?.({
        carregadoBytes: totalBytes,
        totalBytes: totalBytes,
        porcentagem: 100,
        etapa: 'concluido',
        chunkAtual: totalChunks,
        totalChunks: totalChunks,
      })

      return completeRes
    } catch (errComplete: any) {
      throw new Error(
        `Erro ao montar e salvar o vídeo no servidor: ${obterMensagemErroAmigavel(errComplete)}`,
      )
    }
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
