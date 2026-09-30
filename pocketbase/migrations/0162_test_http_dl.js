// Migração 0162: Baixar e salvar as 3 fotos reais usando $filesystem.fileFromURL
migrate(
  (app) => {
    let col = null
    try {
      col = app.findCollectionByNameOrId('fotos_pedreira_reais')
    } catch (e) {
      col = null
    }

    if (!col) {
      col = new Collection({
        name: 'fotos_pedreira_reais',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'chave',
            type: 'text',
            required: true,
          },
          {
            name: 'foto',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          {
            name: 'url_original',
            type: 'text',
          },
        ],
      })
      app.save(col)
    }

    const fotos = [
      {
        chave: 'hero-jazida-aerea',
        filename: 'hero-jazida-aerea.jpg',
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/6a39350a-1d77-4616-a8c8-3b6721f3698f/vista-de-cima-25461.jpeg',
      },
      {
        chave: 'patio-brita',
        filename: 'patio-brita.jpg',
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/6a39350a-1d77-4616-a8c8-3b6721f3698f/patio-de-brita-2aa99.jpeg',
      },
      {
        chave: 'correia-po-de-pedra',
        filename: 'correia-po-de-pedra.jpg',
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/6a39350a-1d77-4616-a8c8-3b6721f3698f/po-de-pedra-britador-997e5.jpeg',
      },
    ]

    for (let i = 0; i < fotos.length; i++) {
      const item = fotos[i]
      try {
        let existing = null
        try {
          existing = app.findFirstRecordByFilter('fotos_pedreira_reais', 'chave = {:chave}', {
            chave: item.chave,
          })
        } catch (_) {}

        if (existing) {
          continue
        }

        const file = $filesystem.fileFromURL(item.url, 60)
        file.name = item.filename
        const record = new Record(col)
        record.set('chave', item.chave)
        record.set('url_original', item.url)
        record.set('foto', file)
        app.save(record)
      } catch (err) {
        // Gravar erro se houver
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('fotos_pedreira_reais')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
