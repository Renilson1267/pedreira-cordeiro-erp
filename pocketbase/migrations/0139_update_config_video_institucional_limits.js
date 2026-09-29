// Migração 0139: Ajustar campos de arquivo e limites na coleção config_video_institucional
// Define arquivo (300 MB, video/mp4, video/webm, video/ogg, video/quicktime)
// e adiciona o campo capa (30 MB, image/*) mantendo poster compatível para leituras anteriores.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('config_video_institucional')

    // 1. Atualizar ou adicionar campo 'arquivo' com limite generoso de 300 MB
    const campoArquivo = col.fields.getByName('arquivo')
    if (campoArquivo) {
      campoArquivo.maxSize = 314572800 // 300 MB
      campoArquivo.mimeTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    } else {
      col.fields.add(
        new FileField({
          name: 'arquivo',
          required: true,
          maxSelect: 1,
          maxSize: 314572800, // 300 MB
          mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
        }),
      )
    }

    // 2. Garantir campo 'capa' para imagens (image/*)
    const campoCapa = col.fields.getByName('capa')
    if (campoCapa) {
      campoCapa.maxSize = 31457280 // 30 MB
      campoCapa.mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    } else {
      col.fields.add(
        new FileField({
          name: 'capa',
          required: false,
          maxSelect: 1,
          maxSize: 31457280, // 30 MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      )
    }

    // 3. Atualizar campo 'poster' também com 30 MB caso ainda exista
    const campoPoster = col.fields.getByName('poster')
    if (campoPoster) {
      campoPoster.maxSize = 31457280 // 30 MB
      campoPoster.mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    }

    // 4. Garantir regras de acesso da API nativa
    col.listRule = ''
    col.viewRule = ''
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('config_video_institucional')
      const campoCapa = col.fields.getByName('capa')
      if (campoCapa) {
        col.fields.removeByName('capa')
      }
      app.save(col)
    } catch (_) {}
  },
)
