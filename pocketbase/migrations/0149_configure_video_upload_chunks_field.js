// Migração 0149: Configurar coleção video_upload_chunks com tamanho e mimeTypes corretos
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('video_upload_chunks')
    const chunkFile = col.fields.getByName('chunk_file')

    if (chunkFile) {
      // 50 MB por chunk (aceita chunks de 8 MB até 35 MB com ampla folga)
      chunkFile.maxSize = 52428800
      // mimeTypes: permitir explicitamente application/octet-stream, todos os tipos de vídeo e binários
      chunkFile.mimeTypes = [
        'application/octet-stream',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/ogg',
        'video/x-matroska',
        'video/x-msvideo',
        'video/x-m4v',
        'application/x-matroska',
      ]
      chunkFile.required = true
      chunkFile.maxSelect = 1
    }

    // Regras de acesso totalmente permissivas para usuários autenticados
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    app.save(col)
  },
  (app) => {},
)
