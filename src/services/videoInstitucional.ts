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

export interface UploadVideoInstitucionalParams {
  titulo: string
  descricao?: string
  arquivo: File
  poster?: File | null
  ativo?: boolean
  duracaoSegundos?: number
  enviadoPorNome?: string
  enviadoPorId?: string
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
   * Se ativo=true for passado e desativarOutros=true, desativa os registros anteriores.
   */
  async criar(
    params: UploadVideoInstitucionalParams,
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

    // Se estiver marcando como ativo, desativa os outros primeiro
    if ((params.ativo ?? true) && desativarOutros) {
      await this.desativarTodos()
    }

    return await pb
      .collection('config_video_institucional')
      .create<VideoInstitucionalRecord>(formData)
  },

  /**
   * Substitui um vídeo existente por um novo arquivo (apaga ou sobrescreve e atualiza metadados).
   */
  async substituir(
    id: string,
    params: UploadVideoInstitucionalParams,
  ): Promise<VideoInstitucionalRecord> {
    const formData = new FormData()
    formData.append('titulo', params.titulo.trim())
    if (params.descricao !== undefined) {
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

    if (params.ativo ?? true) {
      await this.desativarTodos(id)
    }

    return await pb
      .collection('config_video_institucional')
      .update<VideoInstitucionalRecord>(id, formData)
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
