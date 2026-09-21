migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const produtos = new Collection({
      name: 'produtos',
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
        { name: 'codigo', type: 'text', required: true },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: ['Gestão', 'Operacional', 'Vendas', 'Serviços', 'Mercadorias', 'Outros'],
          maxSelect: 1,
        },
        {
          name: 'unidade',
          type: 'select',
          required: true,
          values: ['un', 'kg', 'cx', 'l', 'm²', 'serv'],
          maxSelect: 1,
        },
        { name: 'preco_custo', type: 'number' },
        { name: 'preco_venda', type: 'number' },
        { name: 'estoque', type: 'number' },
        { name: 'estoque_minimo', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_produtos_empresa ON produtos (empresa_id)',
        'CREATE INDEX idx_produtos_codigo ON produtos (empresa_id, codigo)',
      ],
    })
    app.save(produtos)

    const planoContas = new Collection({
      name: 'plano_contas',
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
        { name: 'codigo', type: 'text', required: true },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Receita', 'Despesa', 'Custo', 'Ativo', 'Passivo'],
          maxSelect: 1,
        },
        {
          name: 'natureza',
          type: 'select',
          required: true,
          values: ['Debito', 'Credito'],
          maxSelect: 1,
        },
        { name: 'ativa', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_plano_contas_empresa ON plano_contas (empresa_id)',
        'CREATE INDEX idx_plano_contas_tipo ON plano_contas (tipo)',
      ],
    })
    app.save(planoContas)

    // Self relation for plano_contas parent account
    const planoCol = app.findCollectionByNameOrId('plano_contas')
    planoCol.fields.add(
      new RelationField({
        name: 'conta_pai_id',
        collectionId: planoCol.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    planoCol.addIndex('idx_plano_contas_pai', false, 'conta_pai_id', '')
    app.save(planoCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('produtos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('plano_contas'))
    } catch (_) {}
  },
)
