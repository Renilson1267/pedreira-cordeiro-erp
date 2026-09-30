// Migração 0155: Garantir que chunk_file aceite qualquer extensão e mimeType sem falhas
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('video_upload_chunks')
    const chunkFile = col.fields.getByName('chunk_file')

    if (chunkFile) {
      chunkFile.maxSize = 52428800 // 50 MB
      chunkFile.maxSelect = 1
      chunkFile.required = true
      // Limpar restrição estrita de mimeTypes para aceitar qualquer extensão ou payload
      chunkFile.mimeTypes = []
    }

    col.listRule = ''
    col.viewRule = ''
    col.createRule = ''
    col.updateRule = ''
    col.deleteRule = ''

    app.save(col)
  },
  (app) => {},
)
