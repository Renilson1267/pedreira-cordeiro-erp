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

// Formatos aceitos
export const FORMATOS_VIDEO_ACEITOS = ['.mp4', '.webm', '.quicktime', '.mov', '.ogg', '.m4v']
export const MIMES_VIDEO_ACEITOS = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-m4v',
]

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
    (status === 400 &&
      /too large|file too large|excede o limite|maxSize|max size|request entity too large/i.test(
        dataMsg,
      ))
  ) {
    return 'Arquivo muito grande para o limite do servidor. O tamanho máximo permitido para o vídeo é de 300 MB.'
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
        return 'Formato de vídeo não suportado pelo servidor. Por favor, envie um vídeo no formato MP4 (H.264) ou WebM.'
      }
      if (/maxSize|max size|file size/i.test(dataMsg)) {
        return 'O arquivo excede o limite máximo permitido de 300 MB.'
      }
      return `Não foi possível processar o envio: ${dataMsg}`
    }
    return 'Dados inválidos enviados na requisição (erro 400).'
  }

  if (status === 0) {
    return 'A conexão foi interrompida ou atingiu o tempo limite. Verifique sua conexão à internet e tente novamente.'
  }

  if (status >= 500) {
    return 'Erro interno do servidor ao gravar o arquivo de vídeo. Verifique se o arquivo não está corrompido e tente novamente.'
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

// ---------------------------------------------------------------------------
// UPLOAD FRACIONADO / RESUMABLE (CHUNKED)
// Divide o arquivo em blocos de 20 MB (ou configurável de 10-25 MB).
// Cada bloco é enviado via POST para a coleção `video_upload_chunks`.
// Em caso de falha de conexão num bloco, o envio retenta ou retoma daquele bloco,
// evitando que timeouts e limites de proxy reverso derrubem arquivos grandes.
// ---------------------------------------------------------------------------
export const DEFAULT_CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB por bloco

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Envia um único chunk com retry automático em caso de erro de rede transitório.
 */
async function enviarChunkComRetry(
  uploadId: string,
  chunkIndex: number,
  totalChunks: number,
  blob: Blob,
  fileName: string,
  tentativasMaximas: number = 3,
): Promise<void> {
  let tentativa = 0
  let ultimoErro: any = null

  while (tentativa < tentativasMaximas) {
    tentativa++
    try {
      const formData = new FormData()
      formData.append('upload_id', uploadId)
      formData.append('chunk_index', String(chunkIndex))
      formData.append('total_chunks', String(totalChunks))
      formData.append('chunk_size', String(blob.size))
      // O PocketBase aceita o File/Blob nomeado
      const chunkFile = new File([blob], `${uploadId}_chunk_${chunkIndex}.part`, {
        type: 'application/octet-stream',
      })
      formData.append('chunk_file', chunkFile)

      await pb.collection('video_upload_chunks').create(formData)
      return // Sucesso!
    } catch (err: any) {
      ultimoErro = err
      console.warn(
        `Falha ao enviar bloco ${chunkIndex + 1}/${totalChunks} (tentativa ${tentativa}/${tentativasMaximas}):`,
        err,
      )
      if (tentativa < tentativasMaximas) {
        // Espera exponencial: 1.5s, 3s...
        await new Promise((res) => setTimeout(res, 1500 * tentativa))
      }
    }
  }

  throw new Error(
    `Falha ao enviar o bloco ${chunkIndex + 1} de ${totalChunks}: ${
      ultimoErro?.message || 'Conexão interrompida com o servidor.'
    }`,
  )
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
   * Envia um novo vídeo institucional. Para vídeos grandes (> 25 MB), utiliza upload fracionado
   * (chunked em blocos de 20 MB com retentativas automáticas e remontagem limpa no servidor),
   * garantindo que conexões instáveis e limites de proxy reverso não interrompam o envio.
   */
  async criar(
    params: UploadVideoInstitucionalParams,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    return await this.salvarRegistroHibrido(params, null, desativarOutros)
  },

  /**
   * Substitui um vídeo existente (suporta upload direto ou fracionado dependendo do tamanho).
   */
  async substituir(
    id: string,
    params: UploadVideoInstitucionalParams,
  ): Promise<VideoInstitucionalRecord> {
    return await this.salvarRegistroHibrido(params, id, true)
  },

  /**
   * Seleciona inteligentemente o método de envio:
   * - Arquivos <= 25 MB: Envio direto multipart nativo (rápido e simples)
   * - Arquivos > 25 MB: Envio fracionado em blocos (chunked) com retomada e remontagem
   */
  async salvarRegistroHibrido(
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

    // Se o arquivo for maior que 25 MB, envia obrigatoriamente fracionado para garantir resiliência
    const limiteDireto = 25 * 1024 * 1024
    if (file.size > limiteDireto) {
      return await this.salvarRegistroFracionado(params, idExistente, desativarOutros)
    }

    // Para arquivos menores de 25 MB, tenta direto; se falhar por erro de rede (status 0), cai no fracionado
    try {
      return await this.salvarRegistroNativo(params, idExistente, desativarOutros)
    } catch (err: any) {
      if (
        err?.status === 0 ||
        err?.status === 413 ||
        /interrompida|timeout/i.test(err?.message || '')
      ) {
        console.warn(
          'Upload direto falhou na rede, alternando automaticamente para upload fracionado:',
          err,
        )
        return await this.salvarRegistroFracionado(params, idExistente, desativarOutros)
      }
      throw err
    }
  },

  /**
   * Upload fracionado (chunked / resumable) em blocos de 20 MB.
   * Supera timeouts de proxy e quedas temporárias de rede.
   */
  async salvarRegistroFracionado(
    params: UploadVideoInstitucionalParams,
    idExistente: string | null = null,
    desativarOutros: boolean = true,
  ): Promise<VideoInstitucionalRecord> {
    const file = params.arquivo
    const chunkSize = DEFAULT_CHUNK_SIZE_BYTES
    const totalChunks = Math.ceil(file.size / chunkSize)
    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const tornarAtivo = params.ativo ?? true

    params.onProgress?.({
      carregadoBytes: 0,
      totalBytes: file.size,
      porcentagem: 0,
      etapa: 'preparando',
    })

    // 1. Etapa de init: NÃO envia nenhum arquivo ou poster. Apenas gera o upload_id no frontend
    // e consulta GET /backend/v1/video-institucional/chunked-status?upload_id=...
    let chunksJaEnviados: number[] = []
    try {
      const statusRes = await pb.send<{ uploaded_chunks: number[] }>(
        `/backend/v1/video-institucional/chunked-status?upload_id=${encodeURIComponent(uploadId)}`,
        { method: 'GET' },
      )
      chunksJaEnviados = statusRes.uploaded_chunks || []
    } catch (_) {
      chunksJaEnviados = []
    }

    let bytesTransmitidos = chunksJaEnviados.length * chunkSize

    // 2. Enviar cada bloco pendente sequencialmente via FormData multipart nativo na coleção video_upload_chunks
    for (let index = 0; index < totalChunks; index++) {
      if (chunksJaEnviados.includes(index)) {
        continue
      }

      const start = index * chunkSize
      const end = Math.min(file.size, start + chunkSize)
      const chunkBlob = file.slice(start, end)

      // Atualiza progresso antes do envio do bloco
      params.onProgress?.({
        carregadoBytes: Math.min(file.size, bytesTransmitidos),
        totalBytes: file.size,
        porcentagem: Math.min(95, Math.round((bytesTransmitidos / file.size) * 100)),
        etapa: 'enviando',
      })

      await enviarChunkComRetry(uploadId, index, totalChunks, chunkBlob, file.name, 3)

      bytesTransmitidos += chunkBlob.size
      params.onProgress?.({
        carregadoBytes: Math.min(file.size, bytesTransmitidos),
        totalBytes: file.size,
        porcentagem: Math.min(95, Math.round((bytesTransmitidos / file.size) * 100)),
        etapa: 'enviando',
      })
    }

    // 3. Todos os blocos foram enviados: solicitar a remontagem final no servidor
    params.onProgress?.({
      carregadoBytes: file.size,
      totalBytes: file.size,
      porcentagem: 98,
      etapa: 'processando',
    })

    // A capa segue como antes: converter com fileToBase64(params.capa) e enviar APENAS no payload JSON do finalize
    const arquivoCapa = params.capa || params.poster
    let capaBase64 = ''
    if (arquivoCapa) {
      try {
        capaBase64 = await fileToBase64(arquivoCapa)
      } catch (capaErr) {
        console.warn('Erro ao ler capa para base64:', capaErr)
      }
    }

    const finalizePayload = {
      upload_id: uploadId,
      total_chunks: totalChunks,
      file_name: file.name,
      titulo: params.titulo.trim(),
      descricao: params.descricao?.trim() || '',
      ativo: tornarAtivo,
      duracao_segundos: params.duracaoSegundos || 0,
      tamanho_bytes: file.size,
      enviado_por_nome: params.enviadoPorNome || 'Administrador',
      id_existente: idExistente || undefined,
      capa_file_name: arquivoCapa?.name || undefined,
      capa_base64: capaBase64 || undefined,
    }

    const response = await pb.send<{
      success: boolean
      record: VideoInstitucionalRecord
      error?: string
    }>('/backend/v1/video-institucional/chunked-finalize', {
      method: 'POST',
      body: finalizePayload,
    })

    if (!response.success || !response.record) {
      throw new Error(response.error || 'Falha na finalização do vídeo no servidor.')
    }

    // Se ativado e precisa desativar outros (o hook já desativa, mas reforçamos)
    if (tornarAtivo && desativarOutros) {
      await this.desativarTodos(response.record.id)
    }

    params.onProgress?.({
      carregadoBytes: file.size,
      totalBytes: file.size,
      porcentagem: 100,
      etapa: 'concluido',
    })

    return response.record
  },

  /**
   * Executa o upload multipart nativo direto (usado para arquivos leves <= 25 MB).
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
    formData.append('arquivo', file)

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
