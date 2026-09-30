// Migração 0148: Criar coleção auxiliar video_upload_chunks para suportar uploads
// fracionados (chunked / resumable) de vídeos grandes (até 300 MB) em blocos de 10-25 MB,
// evitando quedas de conexão, timeouts e limites de proxy reverso.
migrate(
  (app) => {
    let chunkCol
    try {
      chunkCol = app.findCollectionByNameOrId('video_upload_chunks')
    } catch (_) {
      chunkCol = null
    }

    if (!chunkCol) {
      chunkCol = new Collection({
        name: 'video_upload_chunks',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'upload_id',
            type: 'text',
            required: true,
          },
          {
            name: 'chunk_index',
            type: 'number',
            required: true,
            onlyInt: true,
          },
          {
            name: 'total_chunks',
            type: 'number',
            required: true,
            onlyInt: true,
          },
          {
            name: 'chunk_size',
            type: 'number',
            required: false,
          },
          {
            name: 'chunk_file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 36700160, // 35 MB por chunk (aceita chunks de até 25 MB com margem)
            mimeTypes: [
              'application/octet-stream',
              'video/mp4',
              'video/webm',
              'video/quicktime',
              'video/ogg',
            ],
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_chunks_upload_order ON video_upload_chunks (upload_id, chunk_index ASC)',
        ],
      })
      app.save(chunkCol)
    }
  },
  (app) => {
    try {
      const chunkCol = app.findCollectionByNameOrId('video_upload_chunks')
      app.delete(chunkCol)
    } catch (_) {}
  },
)
