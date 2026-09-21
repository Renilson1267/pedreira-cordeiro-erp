migrate(
  (app) => {
    const collection = new Collection({
      name: 'empresas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome_fantasia', type: 'text', required: true },
        { name: 'razao_social', type: 'text' },
        { name: 'cnpj', type: 'text', required: true },
        { name: 'inscricao_estadual', type: 'text' },
        { name: 'cor', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_empresas_cnpj ON empresas (cnpj)'],
    })
    app.save(collection)

    // Add self-relation after initial save
    const empresasCol = app.findCollectionByNameOrId('empresas')
    empresasCol.fields.add(
      new RelationField({
        name: 'empresa_pai_id',
        collectionId: empresasCol.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    empresasCol.addIndex('idx_empresas_empresa_pai', false, 'empresa_pai_id', '')
    app.save(empresasCol)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('empresas')
      app.delete(collection)
    } catch (_) {}
  },
)
