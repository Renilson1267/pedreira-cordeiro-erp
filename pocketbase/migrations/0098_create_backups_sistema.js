// Migração 0098: Criar coleções backups_sistema e backups_dados
migrate(
  (app) => {
    // 1. Criar coleção 'backups_sistema' se não existir
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

    // 2. Criar coleção 'backups_dados' para armazenar chunks por coleção com relation para backups_sistema
    let dadosCol
    try {
      dadosCol = app.findCollectionByNameOrId('backups_dados')
    } catch (_) {
      const parentId = backupsCol.id
      dadosCol = new Collection({
        name: 'backups_dados',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'backup_id',
            type: 'relation',
            required: true,
            collectionId: parentId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'colecao_nome', type: 'text', required: true },
          { name: 'chunk_index', type: 'number' },
          { name: 'total_chunks', type: 'number' },
          { name: 'registros_count', type: 'number' },
          { name: 'registros_json', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_bd_backup_id ON backups_dados (backup_id)',
          'CREATE INDEX idx_bd_colecao ON backups_dados (colecao_nome)',
        ],
      })
      app.save(dadosCol)
    }
  },
  (app) => {
    try {
      const col2 = app.findCollectionByNameOrId('backups_dados')
      app.delete(col2)
    } catch (_) {}
    try {
      const col1 = app.findCollectionByNameOrId('backups_sistema')
      app.delete(col1)
    } catch (_) {}
  },
)
