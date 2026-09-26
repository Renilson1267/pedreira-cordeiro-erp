// Migração 0101: Adicionar coleção config_google_drive e campos drive_* em backups_sistema
migrate(
  (app) => {
    // 1. Criar coleção config_google_drive para persistir credenciais/tokens de forma segura
    let configCol
    try {
      configCol = app.findCollectionByNameOrId('config_google_drive')
    } catch (_) {
      configCol = new Collection({
        name: 'config_google_drive',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'chave', type: 'text', required: true },
          { name: 'client_id', type: 'text' },
          { name: 'client_secret', type: 'text' },
          { name: 'refresh_token', type: 'text' },
          { name: 'folder_id', type: 'text' },
          { name: 'folder_name', type: 'text' },
          { name: 'account_email', type: 'text' },
          { name: 'account_name', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'ultimo_envio', type: 'text' },
          { name: 'ultimo_status', type: 'text' },
          { name: 'detalhes', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_config_google_drive_chave ON config_google_drive (chave)',
        ],
      })
      app.save(configCol)

      // Criar registro padrão inicial com chave 'padrao'
      const initRec = new Record(configCol)
      initRec.set('chave', 'padrao')
      initRec.set('folder_name', 'Backups ERP')
      initRec.set('ativo', true)
      initRec.set('ultimo_status', 'desconectado')
      app.save(initRec)
    }

    // 2. Adicionar campos de rastreamento do Drive na coleção backups_sistema
    const colBackups = app.findCollectionByNameOrId('backups_sistema')
    let colChanged = false

    if (!colBackups.fields.getByName('drive_status')) {
      colBackups.fields.add(
        new SelectField({
          name: 'drive_status',
          values: ['pendente', 'enviado', 'erro', 'nao_configurado'],
          maxSelect: 1,
          required: false,
        }),
      )
      colChanged = true
    }

    if (!colBackups.fields.getByName('drive_file_id')) {
      colBackups.fields.add(
        new TextField({
          name: 'drive_file_id',
          required: false,
        }),
      )
      colChanged = true
    }

    if (!colBackups.fields.getByName('drive_enviado_em')) {
      colBackups.fields.add(
        new TextField({
          name: 'drive_enviado_em',
          required: false,
        }),
      )
      colChanged = true
    }

    if (!colBackups.fields.getByName('drive_erro')) {
      colBackups.fields.add(
        new TextField({
          name: 'drive_erro',
          required: false,
        }),
      )
      colChanged = true
    }

    if (!colBackups.fields.getByName('drive_folder_id')) {
      colBackups.fields.add(
        new TextField({
          name: 'drive_folder_id',
          required: false,
        }),
      )
      colChanged = true
    }

    if (colChanged) {
      colBackups.addIndex('idx_backups_drive_status', false, 'drive_status', '')
      app.save(colBackups)
    }
  },
  (app) => {
    try {
      const colBackups = app.findCollectionByNameOrId('backups_sistema')
      colBackups.removeIndex('idx_backups_drive_status')
      colBackups.fields.removeByName('drive_status')
      colBackups.fields.removeByName('drive_file_id')
      colBackups.fields.removeByName('drive_enviado_em')
      colBackups.fields.removeByName('drive_erro')
      colBackups.fields.removeByName('drive_folder_id')
      app.save(colBackups)
    } catch (_) {}

    try {
      const configCol = app.findCollectionByNameOrId('config_google_drive')
      app.delete(configCol)
    } catch (_) {}
  },
)
