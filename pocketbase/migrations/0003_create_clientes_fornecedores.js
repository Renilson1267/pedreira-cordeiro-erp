migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const clientes = new Collection({
      name: 'clientes',
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
        { name: 'nome', type: 'text', required: true },
        { name: 'cnpj_cpf', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'cidade', type: 'text' },
        { name: 'uf', type: 'text' },
        { name: 'cep', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clientes_empresa ON clientes (empresa_id)',
        'CREATE INDEX idx_clientes_nome ON clientes (nome)',
      ],
    })
    app.save(clientes)

    const fornecedores = new Collection({
      name: 'fornecedores',
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
        { name: 'nome', type: 'text', required: true },
        { name: 'cnpj_cpf', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'cidade', type: 'text' },
        { name: 'uf', type: 'text' },
        { name: 'cep', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fornecedores_empresa ON fornecedores (empresa_id)',
        'CREATE INDEX idx_fornecedores_nome ON fornecedores (nome)',
      ],
    })
    app.save(fornecedores)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('clientes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('fornecedores'))
    } catch (_) {}
  },
)
