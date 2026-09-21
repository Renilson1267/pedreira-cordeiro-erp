migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'empresa_membros',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['admin', 'financeiro', 'leitura'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_empresa_membros_empresa ON empresa_membros (empresa_id)',
        'CREATE INDEX idx_empresa_membros_usuario ON empresa_membros (usuario_id)',
        'CREATE UNIQUE INDEX idx_empresa_membros_unique ON empresa_membros (empresa_id, usuario_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('empresa_membros')
      app.delete(collection)
    } catch (_) {}
  },
)
