// Endpoint para upload de vídeo institucional com suporte a arquivos grandes (até 200 MB)
// Utiliza $apis.bodyLimit(250 * 1024 * 1024) para evitar que o limite padrão de ~32MB bloqueie a requisição.

routerAdd(
  'POST',
  '/backend/v1/video-institucional/upload',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado. Faça login para continuar.' })
    }

    var files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { error: 'Nenhum arquivo de vídeo foi enviado.' })
    }
    var arquivoVideo = files[0]

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
