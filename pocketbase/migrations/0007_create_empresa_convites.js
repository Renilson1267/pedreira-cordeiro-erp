migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const empresaConvites = new Collection({
      name: 'empresa_convites',
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
        { name: 'email', type: 'email', required: true },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['admin', 'financeiro', 'leitura'],
          maxSelect: 1,
        },
        { name: 'token', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Aceito', 'Expirado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_convites_empresa ON empresa_convites (empresa_id)',
        'CREATE INDEX idx_convites_email ON empresa_convites (email)',
        'CREATE UNIQUE INDEX idx_convites_token ON empresa_convites (token)',
      ],
    })
    app.save(empresaConvites)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('empresa_convites'))
    } catch (_) {}
  },
)
