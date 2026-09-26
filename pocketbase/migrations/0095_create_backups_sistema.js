// Migração 0095: Criar coleção 'backups_sistema'
migrate(
  (app) => {
    let backupsCol
    try {
      backupsCol = app.findCollectionByNameOrId('backups_sistema')
    } catch (_) {
      backupsCol = new Collection({
        name: 'backups_sistema',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'nome_arquivo', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['nativo_zip', 'dump_json', 'completo'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['sucesso', 'parcial', 'falha'],
            maxSelect: 1,
          },
          { name: 'total_colecoes', type: 'number' },
          { name: 'total_registros', type: 'number' },
          { name: 'resumo_colecoes', type: 'json' },
          { name: 'dados_backup', type: 'json' },
          { name: 'detalhes_execucao', type: 'json' },
          { name: 'backup_duplicatas_incluido', type: 'bool' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_backups_created ON backups_sistema (created DESC)',
          'CREATE INDEX idx_backups_tipo ON backups_sistema (tipo)',
        ],
      })
      app.save(backupsCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('backups_sistema')
      app.delete(col)
    } catch (_) {}
  },
)
