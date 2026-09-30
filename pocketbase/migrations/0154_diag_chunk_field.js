// Migração 0154: Diagnóstico e inserção de teste de registro com arquivo mock
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('video_upload_chunks')
    const chunkFile = col.fields.getByName('chunk_file')

    console.log(
      '[MIG 0154] chunk_file field config:',
      JSON.stringify({
        name: chunkFile?.name,
        type: chunkFile?.type,
        maxSize: chunkFile?.maxSize,
        maxSelect: chunkFile?.maxSelect,
        required: chunkFile?.required,
        mimeTypes: chunkFile?.mimeTypes,
      }),
    )
  },
  (app) => {},
)
