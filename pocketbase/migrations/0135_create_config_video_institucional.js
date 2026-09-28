// Migração 0135: Criar coleção config_video_institucional para upload e gestão do vídeo institucional do ERP/Home pública
migrate(
  (app) => {
    let videoCol
    try {
      videoCol = app.findCollectionByNameOrId('config_video_institucional')
    } catch (_) {
      videoCol = new Collection({
        name: 'config_video_institucional',
        type: 'base',
        // list e view abertos publicamente para a Home pública anônima poder reproduzir o vídeo ativo
        listRule: '',
        viewRule: '',
        // create, update e delete restritos a usuários autenticados (administradores/operadores)
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'titulo',
            type: 'text',
            required: true,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            // 200MB max para vídeo institucional MP4/WebM
            maxSize: 209715200,
            mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
            required: true,
          },
          {
            name: 'poster',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            required: false,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
          {
            name: 'tamanho_bytes',
            type: 'number',
            required: false,
          },
          {
            name: 'duracao_segundos',
            type: 'number',
            required: false,
          },
          {
            name: 'enviado_por_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'enviado_por_id',
            type: 'text',
            required: false,
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
          'CREATE INDEX idx_config_video_ativo ON config_video_institucional (ativo, created DESC)',
        ],
      })
      app.save(videoCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('config_video_institucional')
      app.delete(col)
    } catch (_) {}
  },
)
