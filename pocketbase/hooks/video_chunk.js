// Hook PocketBase para upload de vídeo institucional com suporte a arquivos grandes (até 200 MB)
// Fornece dois caminhos seguros e robustos:
// 1. Upload direto com limite de requisição estendido via $apis.bodyLimit(250 * 1024 * 1024)
//    em /backend/v1/video-institucional/upload
// 2. Upload fracionado em chunks (para conexões lentas ou navegadores que abortam requisições monolíticas pesadas):
//    - POST /backend/v1/video-institucional/chunk/init: inicia uma sessão com metadados do vídeo
//    - POST /backend/v1/video-institucional/chunk/part: envia um bloco do arquivo (.mp4/.webm)
//    - POST /backend/v1/video-institucional/chunk/complete: monta o arquivo final e grava na coleção config_video_institucional
//    - POST /backend/v1/video-institucional/chunk/abort: aborta sessão e remove arquivos temporários
// NOTA: Todas as variáveis e constantes ficam INLINE dentro de cada callback conforme regra de escopo da JSVM do PocketBase.

// ROTA 1: Upload Direto Monolítico com bodyLimit estendido (250 MB)
routerAdd(
  'POST',
  '/backend/v1/video-institucional/upload',
  (e) => {
    var maxVideoBytes = 200 * 1024 * 1024
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado. Faça login para continuar.' })
    }

    var files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { error: 'Nenhum arquivo de vídeo foi enviado.' })
    }
    var arquivoVideo = files[0]

    if (arquivoVideo.size > maxVideoBytes) {
      return e.json(400, {
        error: 'O arquivo de vídeo excede o limite máximo permitido de 200 MB.',
      })
    }

    // Arquivo de poster opcional
    var posterFiles = e.findUploadedFiles('poster')
    var arquivoPoster = posterFiles && posterFiles.length > 0 ? posterFiles[0] : null

    var body = e.requestInfo().body || {}
    var titulo = (body.titulo || '').trim()
    var descricao = (body.descricao || '').trim()
    var substituindoId = (body.substituindo_id || '').trim()
    var ativo = body.ativo === 'true' || body.ativo === true
    var duracaoSegundos = Number(body.duracao_segundos) || 0
    var enviadoPorNome = (body.enviado_por_nome || '').trim()
    var enviadoPorId = (body.enviado_por_id || '').trim()

    if (!titulo) {
      return e.json(400, { error: 'O título do vídeo institucional é obrigatório.' })
    }

    var col = $app.findCollectionByNameOrId('config_video_institucional')
    var rec = null

    if (substituindoId) {
      try {
        rec = $app.findFirstRecordByData('config_video_institucional', 'id', substituindoId)
      } catch (_) {
        rec = null
      }
    }

    var isNovo = false
    if (!rec) {
      rec = new Record(col)
      isNovo = true
    }

    rec.set('titulo', titulo)
    if (descricao) {
      rec.set('descricao', descricao)
    }
    rec.set('arquivo', arquivoVideo)
    if (arquivoPoster) {
      rec.set('poster', arquivoPoster)
    }
    rec.set('ativo', ativo)
    rec.set('tamanho_bytes', arquivoVideo.size)
    if (duracaoSegundos > 0) {
      rec.set('duracao_segundos', Math.round(duracaoSegundos))
    }
    if (enviadoPorNome) {
      rec.set('enviado_por_nome', enviadoPorNome)
    }
    if (enviadoPorId) {
      rec.set('enviado_por_id', enviadoPorId)
    }

    // Se estiver marcando como ativo, desativa os outros vídeos antes
    if (ativo) {
      try {
        var ativosAnteriores = $app.findRecordsByFilter(
          'config_video_institucional',
          'ativo = true',
          '',
          0,
          0,
        )
        for (var i = 0; i < ativosAnteriores.length; i++) {
          var itemAtivo = ativosAnteriores[i]
          if (itemAtivo.id !== rec.id) {
            itemAtivo.set('ativo', false)
            $app.save(itemAtivo)
          }
        }
      } catch (errDesativar) {
        console.warn('Erro ao desativar vídeos anteriores:', errDesativar)
      }
    }

    $app.save(rec)

    return e.json(200, {
      success: true,
      id: rec.id,
      titulo: rec.getString('titulo'),
      descricao: rec.getString('descricao'),
      arquivo: rec.getString('arquivo'),
      poster: rec.getString('poster'),
      ativo: rec.getBool('ativo'),
      tamanho_bytes: rec.getInt('tamanho_bytes'),
      duracao_segundos: rec.getInt('duracao_segundos'),
      enviado_por_nome: rec.getString('enviado_por_nome'),
      enviado_por_id: rec.getString('enviado_por_id'),
      created: rec.getString('created'),
      updated: rec.getString('updated'),
      is_novo: isNovo,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(250 * 1024 * 1024),
)

// ROTAS 2: Upload Fracionado em Chunks
// 2.1 Iniciar sessão de chunks
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunk/init',
  (e) => {
    var maxVideoBytes = 200 * 1024 * 1024
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    var body = e.requestInfo().body || {}
    var fileName = (body.file_name || 'video.mp4').trim()
    var fileSize = Number(body.file_size) || 0
    var totalChunks = Number(body.total_chunks) || 0
    var titulo = (body.titulo || '').trim()

    if (!titulo) {
      return e.json(400, { error: 'O título do vídeo é obrigatório.' })
    }
    if (fileSize <= 0 || fileSize > maxVideoBytes) {
      return e.json(400, {
        error: 'Tamanho de arquivo inválido ou maior que 200 MB.',
      })
    }
    if (totalChunks <= 0 || totalChunks > 200) {
      return e.json(400, { error: 'Quantidade de blocos inválida.' })
    }

    // Gerar session_id aleatório
    var sessionId = 'vid_' + $security.randomString(20)
    var tmpBase = $os.tempDir() || '/tmp'
    var sessionDir = tmpBase + '/pb_chunk_' + sessionId

    try {
      $os.mkdirAll(sessionDir, 0755)
    } catch (errDir) {
      return e.json(500, { error: 'Erro ao criar diretório temporário: ' + errDir })
    }

    // Salvar poster opcional se enviado no init (apenas se for multipart com arquivo anexado)
    var hasPoster = false
    try {
      var posterFiles = e.findUploadedFiles('poster')
      if (posterFiles && posterFiles.length > 0) {
        var pFile = posterFiles[0]
        var posterPath = sessionDir + '/poster_' + (pFile.name || 'poster.jpg')
        var pBuf = $os.readFile(pFile.path || '')
        if (pBuf && pBuf.length > 0) {
          $os.writeFile(posterPath, pBuf, 0644)
          hasPoster = true
        } else if (pFile.reader) {
          try {
            var pr = pFile.reader.open()
            var pbArr = new Array(pFile.size).fill(0)
            pr.read(pbArr)
            pr.close()
            $os.writeFile(posterPath, pbArr, 0644)
            hasPoster = true
          } catch (_) {}
        }
      }
    } catch (errP) {
      console.warn('Aviso: poster no chunk init:', errP)
    }

    // Gravar metadados da sessão em meta.json
    var meta = {
      sessionId: sessionId,
      sessionDir: sessionDir,
      fileName: fileName,
      fileSize: fileSize,
      totalChunks: totalChunks,
      titulo: titulo,
      descricao: (body.descricao || '').trim(),
      substituindoId: (body.substituindo_id || '').trim(),
      ativo: body.ativo === 'true' || body.ativo === true,
      duracaoSegundos: Number(body.duracao_segundos) || 0,
      enviadoPorNome: (body.enviado_por_nome || authRecord.getString('name') || '').trim(),
      enviadoPorId: (body.enviado_por_id || authRecord.id || '').trim(),
      chunksRecebidos: [],
      hasPoster: hasPoster,
      created: new Date().toISOString(),
    }

    $os.writeFile(sessionDir + '/meta.json', JSON.stringify(meta), 0644)

    return e.json(200, {
      success: true,
      session_id: sessionId,
      total_chunks: totalChunks,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(15 * 1024 * 1024),
)

// 2.2 Receber parte/bloco de chunk
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunk/part',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    var body = e.requestInfo().body || {}
    var sessionId = (body.session_id || '').trim()
    var chunkIndex = Number(body.chunk_index)

    if (!sessionId || isNaN(chunkIndex) || chunkIndex < 0) {
      return e.json(400, { error: 'session_id e chunk_index são obrigatórios.' })
    }

    var tmpBase = $os.tempDir() || '/tmp'
    var sessionDir = tmpBase + '/pb_chunk_' + sessionId

    // Ler meta.json para validar
    var metaStr = ''
    try {
      metaStr = $os.readFile(sessionDir + '/meta.json')
    } catch (_) {
      return e.json(404, { error: 'Sessão de upload não encontrada ou expirada.' })
    }

    var meta = JSON.parse(metaStr)
    var files = e.findUploadedFiles('chunk')
    if (!files || files.length === 0) {
      return e.json(400, { error: 'Nenhum arquivo de bloco recebido.' })
    }

    var chunkFile = files[0]
    var partFileName = sessionDir + '/part_' + chunkIndex

    // Salvar o bloco no disco
    try {
      var chunkBytes = $os.readFile(chunkFile.path || '')
      if (!chunkBytes || chunkBytes.length === 0) {
        try {
          var r = chunkFile.reader.open()
          var b = new Array(chunkFile.size).fill(0)
          r.read(b)
          r.close()
          $os.writeFile(partFileName, b, 0644)
        } catch (errRdr) {
          return e.json(500, { error: 'Falha ao ler dados do bloco: ' + errRdr })
        }
      } else {
        $os.writeFile(partFileName, chunkBytes, 0644)
      }
    } catch (errSave) {
      return e.json(500, { error: 'Erro ao gravar bloco temporário: ' + errSave })
    }

    if (!meta.chunksRecebidos) meta.chunksRecebidos = []
    if (meta.chunksRecebidos.indexOf(chunkIndex) === -1) {
      meta.chunksRecebidos.push(chunkIndex)
      $os.writeFile(sessionDir + '/meta.json', JSON.stringify(meta), 0644)
    }

    return e.json(200, {
      success: true,
      chunk_index: chunkIndex,
      chunks_recebidos: meta.chunksRecebidos.length,
      total_chunks: meta.totalChunks,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(35 * 1024 * 1024),
)

// 2.3 Finalizar chunks: unir partes, criar/atualizar Record e limpar temp
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunk/complete',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    var body = e.requestInfo().body || {}
    var sessionId = (body.session_id || '').trim()
    if (!sessionId) {
      return e.json(400, { error: 'session_id é obrigatório.' })
    }

    var tmpBase = $os.tempDir() || '/tmp'
    var sessionDir = tmpBase + '/pb_chunk_' + sessionId

    var metaStr = ''
    try {
      metaStr = $os.readFile(sessionDir + '/meta.json')
    } catch (_) {
      return e.json(404, { error: 'Sessão de upload não encontrada ou expirada.' })
    }

    var meta = JSON.parse(metaStr)
    var totalChunks = meta.totalChunks

    // Validar se todas as partes existem
    for (var i = 0; i < totalChunks; i++) {
      var partPath = sessionDir + '/part_' + i
      try {
        var stat = $os.stat(partPath)
        if (!stat) {
          return e.json(400, { error: 'Bloco ' + i + ' ausente. Reenvie o bloco.' })
        }
      } catch (_) {
        return e.json(400, { error: 'Bloco ' + i + ' ausente. Reenvie o bloco.' })
      }
    }

    // Unir os blocos no arquivo final
    var assembledPath = sessionDir + '/' + (meta.fileName || 'video.mp4')
    try {
      // Criar/abrir arquivo final para escrita (O_RDWR|O_CREATE|O_TRUNC)
      var outFinal = $os.openFile(assembledPath, 0x2 | 0x40 | 0x200, 0644)
      for (var j = 0; j < totalChunks; j++) {
        var partData = $os.readFile(sessionDir + '/part_' + j)
        outFinal.write(partData)
      }
      outFinal.close()
    } catch (errAssemble) {
      return e.json(500, { error: 'Erro ao montar arquivo final: ' + errAssemble })
    }

    // Criar File object para o PocketBase
    var videoFileObj = null
    try {
      videoFileObj = $filesystem.fileFromPath(assembledPath)
    } catch (errFs) {
      return e.json(500, { error: 'Erro ao preparar arquivo para o PocketBase: ' + errFs })
    }

    // Verificar se há poster salvo no diretório
    var posterFileObj = null
    try {
      var dirEntries = $os.readDir(sessionDir)
      for (var k = 0; k < dirEntries.length; k++) {
        var entry = dirEntries[k]
        if (entry.name().startsWith('poster_')) {
          posterFileObj = $filesystem.fileFromPath(sessionDir + '/' + entry.name())
          break
        }
      }
    } catch (_) {}

    var col = $app.findCollectionByNameOrId('config_video_institucional')
    var rec = null

    if (meta.substituindoId) {
      try {
        rec = $app.findFirstRecordByData('config_video_institucional', 'id', meta.substituindoId)
      } catch (_) {
        rec = null
      }
    }

    var isNovo = false
    if (!rec) {
      rec = new Record(col)
      isNovo = true
    }

    rec.set('titulo', meta.titulo)
    if (meta.descricao) {
      rec.set('descricao', meta.descricao)
    }
    rec.set('arquivo', videoFileObj)
    if (posterFileObj) {
      rec.set('poster', posterFileObj)
    }
    rec.set('ativo', meta.ativo)
    rec.set('tamanho_bytes', meta.fileSize)
    if (meta.duracaoSegundos > 0) {
      rec.set('duracao_segundos', Math.round(meta.duracaoSegundos))
    }
    if (meta.enviadoPorNome) {
      rec.set('enviado_por_nome', meta.enviadoPorNome)
    }
    if (meta.enviadoPorId) {
      rec.set('enviado_por_id', meta.enviadoPorId)
    }

    // Se estiver marcando como ativo, desativa os outros antes
    if (meta.ativo) {
      try {
        var ativosAnteriores = $app.findRecordsByFilter(
          'config_video_institucional',
          'ativo = true',
          '',
          0,
          0,
        )
        for (var m = 0; m < ativosAnteriores.length; m++) {
          var itemAtivo = ativosAnteriores[m]
          if (itemAtivo.id !== rec.id) {
            itemAtivo.set('ativo', false)
            $app.save(itemAtivo)
          }
        }
      } catch (errDesativar) {
        console.warn('Erro ao desativar vídeos anteriores:', errDesativar)
      }
    }

    $app.save(rec)

    // Limpar arquivos temporários da sessão
    try {
      $os.removeAll(sessionDir)
    } catch (errClean) {
      console.warn('Aviso: erro ao limpar pasta temporária:', errClean)
    }

    return e.json(200, {
      success: true,
      id: rec.id,
      titulo: rec.getString('titulo'),
      descricao: rec.getString('descricao'),
      arquivo: rec.getString('arquivo'),
      poster: rec.getString('poster'),
      ativo: rec.getBool('ativo'),
      tamanho_bytes: rec.getInt('tamanho_bytes'),
      duracao_segundos: rec.getInt('duracao_segundos'),
      enviado_por_nome: rec.getString('enviado_por_nome'),
      enviado_por_id: rec.getString('enviado_por_id'),
      created: rec.getString('created'),
      updated: rec.getString('updated'),
      is_novo: isNovo,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(5 * 1024 * 1024),
)

// 2.4 Abortar sessão de chunks e limpar disco
routerAdd(
  'POST',
  '/backend/v1/video-institucional/chunk/abort',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado.' })
    }

    var body = e.requestInfo().body || {}
    var sessionId = (body.session_id || '').trim()
    if (!sessionId) {
      return e.json(400, { error: 'session_id é obrigatório.' })
    }

    var tmpBase = $os.tempDir() || '/tmp'
    var sessionDir = tmpBase + '/pb_chunk_' + sessionId

    try {
      $os.removeAll(sessionDir)
    } catch (_) {}

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
