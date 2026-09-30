// Hook PocketBase para upload fracionado (chunked / resumable) e montagem de vídeo institucional
// Permite que arquivos grandes (até 300 MB) sejam enviados em blocos de 15-20 MB diretamente via API,
// superando timeouts e interrupções de conexão/proxy.
// Endpoints autenticados sob /backend/v1/video-institucional

// 1. Status do upload fracionado (consultar chunks já enviados para permitir retomada)
routerAdd(
  'GET',
  '/backend/v1/video-institucional/chunked-status',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const uploadId = e.request.url.query().get('upload_id')
    if (!uploadId) {
      return e.json(400, { error: 'upload_id é obrigatório' })
    }

    try {
      const chunks = $app.findRecordsByFilter(
        'video_upload_chunks',
        `upload_id = '${uploadId.replace(/'/g, "''")}'`,
        'chunk_index',
        1000,
        0,
      )

      const uploadedIndexes = chunks.map((c) => c.getInt('chunk_index'))

      return e.json(200, {
        success: true,
        upload_id: uploadId,
        uploaded_chunks: uploadedIndexes,
        count: uploadedIndexes.length,
      })
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao consultar status do upload: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// 2. Finalizar e Montar Chunks em Registro de config_video_institucional
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunked-finalize',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Guarda de Content-Type: nunca ler multipart sem antes validar o header
    const contentType = (e.request.header.get('Content-Type') || '').toLowerCase()
    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (parseErr) {
      console.log('Aviso ao obter request body:', parseErr)
      body = {}
    }

    const uploadId = (body.upload_id || '').trim()
    const totalChunks = parseInt(body.total_chunks, 10)
    const fileName = (body.file_name || 'video.mp4').trim()
    const titulo = (body.titulo || 'Vídeo Institucional').trim()
    const descricao = (body.descricao || '').trim()
    const ativo = body.ativo === true || body.ativo === 'true'
    const duracaoSegundos = body.duracao_segundos ? parseInt(body.duracao_segundos, 10) : 0
    const tamanhoBytes = body.tamanho_bytes ? parseInt(body.tamanho_bytes, 10) : 0
    const enviadoPorNome = body.enviado_por_nome || authRecord.getString('name') || 'Administrador'
    const idExistente = body.id_existente ? String(body.id_existente).trim() : null
    const capaFileName = body.capa_file_name ? String(body.capa_file_name).trim() : ''
    const capaBase64 = body.capa_base64 ? String(body.capa_base64).trim() : ''

    // Se no futuro houver upload multipart, só tentar ler arquivos se o header incluir multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      try {
        if (typeof e.findUploadedFiles === 'function') {
          // Checagem defensiva sem estourar GoError se não houver arquivo
          e.findUploadedFiles()
        }
      } catch (mpErr) {
        console.log('Aviso ao verificar arquivos multipart:', mpErr)
      }
    }

    if (!uploadId || !totalChunks || totalChunks <= 0) {
      return e.json(400, { error: 'upload_id e total_chunks válidos são obrigatórios' })
    }

    // 1. Buscar todos os chunks ordenados por chunk_index
    let chunks = []
    try {
      chunks = $app.findRecordsByFilter(
        'video_upload_chunks',
        `upload_id = '${uploadId.replace(/'/g, "''")}'`,
        'chunk_index',
        totalChunks + 20,
        0,
      )
    } catch (err) {
      return e.json(500, { error: 'Erro ao buscar chunks: ' + (err?.message || err) })
    }

    if (chunks.length < totalChunks) {
      return e.json(400, {
        error: `Chunks incompletos: recebidos ${chunks.length} de ${totalChunks} esperados.`,
        received: chunks.length,
        expected: totalChunks,
      })
    }

    // Validar ordenação e que todos os índices de 0 a totalChunks - 1 existem
    const chunkMap = {}
    for (const c of chunks) {
      chunkMap[c.getInt('chunk_index')] = c
    }

    for (let i = 0; i < totalChunks; i++) {
      if (!chunkMap[i]) {
        return e.json(400, {
          error: `Chunk faltante no índice ${i}. Envie novamente os blocos ausentes.`,
          missing_index: i,
        })
      }
    }

    // 2. Montar o arquivo final no filesystem
    const fsChunks = $app.newFilesystem()
    const fsVideo = $app.newFilesystem()

    // Nome de arquivo temporário limpo
    const tempFileName = `assembled_${uploadId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    try {
      // Abre o gravador para o arquivo final montado
      const writer = fsVideo.newWriter(tempFileName)

      let totalBytesEscritos = 0

      for (let i = 0; i < totalChunks; i++) {
        const chunkRec = chunkMap[i]
        const chunkFileName = chunkRec.getString('chunk_file')
        const chunkPath = `${chunkRec.collection().id}/${chunkRec.id}/${chunkFileName}`

        const reader = fsChunks.newReader(chunkPath)
        try {
          // Copia os bytes do leitor do chunk diretamente para o gravador de destino
          // sem manter tudo em memória RAM na JSVM
          const bytesCopied = $os.copy(writer, reader)
          totalBytesEscritos += bytesCopied
        } finally {
          reader.close()
        }
      }

      writer.close()

      // 3. Criar ou carregar o registro em config_video_institucional
      const videoCol = $app.findCollectionByNameOrId('config_video_institucional')
      let record

      if (idExistente) {
        try {
          record = $app.findRecordById('config_video_institucional', idExistente)
        } catch (_) {
          record = new Record(videoCol)
        }
      } else {
        record = new Record(videoCol)
      }

      // Se for ativado, desativa os outros anteriores
      if (ativo) {
        try {
          const ativos = $app.findRecordsByFilter(
            'config_video_institucional',
            'ativo = true',
            '',
            100,
            0,
          )
          for (const atv of ativos) {
            if (atv.id !== record.id) {
              atv.set('ativo', false)
              $app.save(atv)
            }
          }
        } catch (desatErr) {
          console.log('Aviso ao desativar outros vídeos:', desatErr)
        }
      }

      record.set('titulo', titulo)
      if (descricao) {
        record.set('descricao', descricao)
      }
      record.set('ativo', ativo)
      record.set('tamanho_bytes', totalBytesEscritos || tamanhoBytes)
      if (duracaoSegundos) {
        record.set('duracao_segundos', duracaoSegundos)
      }
      record.set('enviado_por_nome', enviadoPorNome)
      record.set('enviado_por_id', authRecord.id)

      if (!record.id) {
        // Gera um ID antecipado de 15 caracteres alfanuméricos se for novo
        record.set('id', $security.randomString(15).toLowerCase())
      }

      // Gerar sufixo aleatório para nomes de arquivos
      const randomSuffix = $security.randomString(10).toLowerCase()

      // Se foi enviada uma capa/poster opcional via JSON base64
      let targetCapaName = ''
      if (capaFileName && capaBase64) {
        try {
          const capaExt = (capaFileName.match(/\.([a-zA-Z0-9]+)$/) || ['', 'jpg'])[1]
          targetCapaName = `capa_${randomSuffix}.${capaExt}`
          const cleanB64 = capaBase64.replace(/^data:image\/[a-z]+;base64,/, '')
          const rawBytes = []
          const binStr = atob(cleanB64)
          for (let b = 0; b < binStr.length; b++) {
            rawBytes.push(binStr.charCodeAt(b))
          }
          const capaWriter = fsVideo.newWriter(
            `${record.collection().id}/${record.id}/${targetCapaName}`,
          )
          try {
            capaWriter.write(rawBytes)
          } finally {
            capaWriter.close()
          }
          record.set('capa', targetCapaName)
          record.set('poster', targetCapaName)
        } catch (capaErr) {
          console.log('Aviso ao salvar capa em chunked:', capaErr)
        }
      }

      // Gerar nome de arquivo final PocketBase com sufixo aleatório
      // formato padrão do PocketBase: original_name_<random10>.mp4
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/)
      const ext = extMatch ? extMatch[1] : 'mp4'
      const baseClean = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      const targetFileName = `${baseClean}_${randomSuffix}.${ext}`

      // Copia os dados do arquivo temporário montado diretamente para o caminho oficial do storage do record
      const finalStoragePath = `${record.collection().id}/${record.id}/${targetFileName}`
      const assembledReader = fsVideo.newReader(tempFileName)
      try {
        const finalWriter = fsVideo.newWriter(finalStoragePath)
        try {
          $os.copy(finalWriter, assembledReader)
        } finally {
          finalWriter.close()
        }
      } finally {
        assembledReader.close()
      }

      // Salvar o registro diretamente no banco via db().newQuery se saveNoValidate pedir arquivo multipart
      try {
        record.set('arquivo', targetFileName)
        if (targetCapaName) {
          record.set('capa', targetCapaName)
          record.set('poster', targetCapaName)
        }
        $app.saveNoValidate(record)
      } catch (saveErr) {
        console.log('Aviso saveNoValidate, aplicando fallback SQL:', saveErr)
        // Fallback robusto via SQL caso saveNoValidate ainda acione validador de arquivo
        const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
        const recExists = $app
          .db()
          .newQuery('SELECT count(*) as c FROM config_video_institucional WHERE id = {:id}')
          .bind({ id: record.id })
          .one(new DynamicModel({ c: 0 }))
        if (recExists && recExists.c > 0) {
          $app
            .db()
            .newQuery(`
      UPDATE config_video_institucional SET
        titulo = {:titulo},
        descricao = {:descricao},
        arquivo = {:arquivo},
        capa = {:capa},
        poster = {:poster},
        ativo = {:ativo},
        tamanho_bytes = {:tamanho_bytes},
        duracao_segundos = {:duracao_segundos},
        enviado_por_nome = {:enviado_por_nome},
        enviado_por_id = {:enviado_por_id},
        updated = {:updated}
      WHERE id = {:id}
    `)
            .bind({
              id: record.id,
              titulo: titulo,
              descricao: descricao,
              arquivo: targetFileName,
              capa: targetCapaName || record.getString('capa') || '',
              poster: targetCapaName || record.getString('poster') || '',
              ativo: ativo ? 1 : 0,
              tamanho_bytes: totalBytesEscritos || tamanhoBytes,
              duracao_segundos: duracaoSegundos,
              enviado_por_nome: enviadoPorNome,
              enviado_por_id: authRecord.id,
              updated: now,
            })
            .execute()
        } else {
          $app
            .db()
            .newQuery(`
      INSERT INTO config_video_institucional (
        id, titulo, descricao, arquivo, capa, poster, ativo, tamanho_bytes, duracao_segundos,
        enviado_por_nome, enviado_por_id, created, updated
      ) VALUES (
        {:id}, {:titulo}, {:descricao}, {:arquivo}, {:capa}, {:poster}, {:ativo}, {:tamanho_bytes}, {:duracao_segundos},
        {:enviado_por_nome}, {:enviado_por_id}, {:created}, {:updated}
      )
    `)
            .bind({
              id: record.id,
              titulo: titulo,
              descricao: descricao,
              arquivo: targetFileName,
              capa: targetCapaName || '',
              poster: targetCapaName || '',
              ativo: ativo ? 1 : 0,
              tamanho_bytes: totalBytesEscritos || tamanhoBytes,
              duracao_segundos: duracaoSegundos,
              enviado_por_nome: enviadoPorNome,
              enviado_por_id: authRecord.id,
              created: now,
              updated: now,
            })
            .execute()
        }
      } // 4. Limpeza: apagar arquivo temporário e chunks após montagem com sucesso
      try {
        fsVideo.delete(tempFileName)
      } catch (_) {}

      try {
        for (const c of chunks) {
          $app.delete(c)
        }
      } catch (cleanErr) {
        console.log('Aviso ao limpar chunks antigos:', cleanErr)
      }

      return e.json(200, {
        success: true,
        record: {
          id: record.id,
          titulo: record.getString('titulo'),
          arquivo: record.getString('arquivo'),
          ativo: record.getBool('ativo'),
          tamanho_bytes: record.getInt('tamanho_bytes'),
        },
      })
    } catch (assemblyErr) {
      console.log('Erro ao montar chunks:', assemblyErr)
      try {
        fsVideo.delete(tempFileName)
      } catch (_) {}
      return e.json(500, {
        error:
          'Falha durante a remontagem dos blocos de vídeo: ' +
          (assemblyErr?.message || assemblyErr),
      })
    }
  },
  $apis.requireAuth(),
)

// 3. Cancelar e limpar chunks de um upload abortado
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunked-abort',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const body = e.requestInfo().body || {}
    const uploadId = (body.upload_id || '').trim()
    if (!uploadId) {
      return e.json(400, { error: 'upload_id é obrigatório' })
    }

    try {
      const chunks = $app.findRecordsByFilter(
        'video_upload_chunks',
        `upload_id = '${uploadId.replace(/'/g, "''")}'`,
        '',
        1000,
        0,
      )

      for (const c of chunks) {
        $app.delete(c)
      }

      return e.json(200, { success: true, deleted: chunks.length })
    } catch (err) {
      return e.json(500, { error: 'Erro ao cancelar upload: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// 4. Servir fotos reais locais sob /site-img/*.jpeg diretamente do PocketBase storage
routerAdd('GET', '/site-img/vista-de-cima-25461.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter('fotos_pedreira_reais', "chave = 'hero-jazida-aerea'")
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})

routerAdd('GET', '/site-img/patio-de-brita-2aa99.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter('fotos_pedreira_reais', "chave = 'patio-brita'")
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})

routerAdd('GET', '/site-img/po-de-pedra-britador-997e5.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter(
      'fotos_pedreira_reais',
      "chave = 'correia-po-de-pedra'",
    )
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})

routerAdd('GET', '/site-img/vista-de-cima-1f04f.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter('fotos_pedreira_reais', "chave = 'hero-jazida-aerea'")
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})

routerAdd('GET', '/site-img/patio-de-brita-0a7f9.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter('fotos_pedreira_reais', "chave = 'patio-brita'")
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})

routerAdd('GET', '/site-img/po-de-pedra-britador-e5885.jpeg', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter(
      'fotos_pedreira_reais',
      "chave = 'correia-po-de-pedra'",
    )
    const fileName = rec.getString('foto')
    const filePath = `${rec.collection().id}/${rec.id}/${fileName}`
    const fs = $app.newFilesystem()
    const reader = fs.newReader(filePath)
    e.response.header().set('Content-Type', 'image/jpeg')
    e.response.header().set('Cache-Control', 'public, max-age=86400')
    return e.stream(200, 'image/jpeg', reader)
  } catch (err) {
    return e.json(404, { error: 'Foto não encontrada' })
  }
})
