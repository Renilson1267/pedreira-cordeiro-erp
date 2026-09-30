// Migração 0147: Garantir que o campo 'arquivo' na coleção config_video_institucional
// tenha maxSize explícito e robusto de 300 MB (314.572.800 bytes) e mime types amplos para vídeo.
// Também garante que 'capa' e 'poster' tenham 30 MB (31.457.280 bytes).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('config_video_institucional')

    // 1. Campo de arquivo de vídeo com 300 MB
    const campoArquivo = col.fields.getByName('arquivo')
    if (campoArquivo) {
      campoArquivo.maxSize = 314572800 // 300 MB
      campoArquivo.mimeTypes = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        'video/x-matroska',
        'video/x-msvideo',
      ]
    } else {
      col.fields.add(
        new FileField({
          name: 'arquivo',
          required: true,
          maxSelect: 1,
          maxSize: 314572800,
          mimeTypes: [
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/quicktime',
            'video/x-matroska',
            'video/x-msvideo',
          ],
        }),
      )
    }

    // 2. Campo de capa com 30 MB
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
          maxSize: 31457280,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      )
    }

    // 3. Campo de poster com 30 MB
    const campoPoster = col.fields.getByName('poster')
    if (campoPoster) {
      campoPoster.maxSize = 31457280 // 30 MB
      campoPoster.mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    }

    // 4. Regras de acesso da coleção
    col.listRule = ''
    col.viewRule = ''
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    app.save(col)
  },
  (app) => {
    // Reverter não é estritamente necessário para limites
  },
)
