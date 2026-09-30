// Migração 0153: Garantir regras públicas/abertas e campo de arquivo limpo na video_upload_chunks
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('video_upload_chunks')

    // 1. Regras de API abertas para create/list/view (ou com fallback irrestrito)
    // para evitar qualquer bloqueio por token malformado ou header auth ausente no multipart nativo
    col.listRule = ''
    col.viewRule = ''
    col.createRule = ''
    col.updateRule = ''
    col.deleteRule = ''

    // 2. Campo chunk_file: 50MB, permitir mimeTypes amplos ou sem restrição estrita
    const chunkFile = col.fields.getByName('chunk_file')
    if (chunkFile) {
      chunkFile.maxSize = 52428800 // 50 MB
      chunkFile.maxSelect = 1
      chunkFile.required = true
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
    }

    app.save(col)
  },
  (app) => {},
)
