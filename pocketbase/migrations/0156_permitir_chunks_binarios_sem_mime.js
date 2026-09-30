// Migração 0156: Garantir que chunk_file em video_upload_chunks não tenha restrição de mimeTypes
// para aceitar fatias binárias brutas (File.slice), com maxSize de 50 MB (52428800)
// e regras de API abertas para requisições autenticadas.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('video_upload_chunks')
    const chunkFile = col.fields.getByName('chunk_file')

    if (chunkFile) {
      chunkFile.maxSize = 52428800 // 50 MB
      chunkFile.maxSelect = 1
      chunkFile.required = true
      // Array vazio remove qualquer restrição de extensão ou mimeType no validador do PocketBase
      chunkFile.mimeTypes = []
    }

    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    app.save(col)
  },
  (app) => {
    // Revert no-op
  },
)
