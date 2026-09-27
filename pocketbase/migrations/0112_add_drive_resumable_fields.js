migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('backups_sistema')

    // 1. Adicionar valor 'enviando' ao select drive_status se ainda não constar
    const driveStatusField = col.fields.getByName('drive_status')
    if (driveStatusField) {
      const currentValues = driveStatusField.values || []
      if (!currentValues.includes('enviando')) {
        driveStatusField.values = [...currentValues, 'enviando']
      }
      driveStatusField.maxSelect = 1
    }

    // 2. Adicionar drive_offset (number)
    if (!col.fields.getByName('drive_offset')) {
      col.fields.add(new NumberField({ name: 'drive_offset' }))
    }

    // 3. Adicionar drive_total_bytes (number)
    if (!col.fields.getByName('drive_total_bytes')) {
      col.fields.add(new NumberField({ name: 'drive_total_bytes' }))
    }

    // 4. Adicionar drive_session_url (text)
    if (!col.fields.getByName('drive_session_url')) {
      col.fields.add(new TextField({ name: 'drive_session_url' }))
    }

    // 5. Adicionar drive_tentativas (number)
    if (!col.fields.getByName('drive_tentativas')) {
      col.fields.add(new NumberField({ name: 'drive_tentativas' }))
    }

    // 6. Adicionar drive_progresso_chunk (number) para saber qual chunk index foi processado
    if (!col.fields.getByName('drive_progresso_chunk')) {
      col.fields.add(new NumberField({ name: 'drive_progresso_chunk' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('backups_sistema')
    const toRemove = [
      'drive_offset',
      'drive_total_bytes',
      'drive_session_url',
      'drive_tentativas',
      'drive_progresso_chunk',
    ]
    for (const name of toRemove) {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    }
    app.save(col)
  },
)
