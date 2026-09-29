migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Coleção postos_combustivel
    let postosCol
    try {
      postosCol = app.findCollectionByNameOrId('postos_combustivel')
    } catch (_) {
      postosCol = new Collection({
        name: 'postos_combustivel',
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
          { name: 'bandeira', type: 'text' },
          { name: 'cnpj', type: 'text' },
          { name: 'contato', type: 'text' },
          { name: 'telefone', type: 'text' },
          { name: 'cidade', type: 'text' },
          { name: 'endereco', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_postos_empresa ON postos_combustivel (empresa_id)',
          'CREATE INDEX idx_postos_nome ON postos_combustivel (nome)',
        ],
      })
      app.save(postosCol)
    }

    // 2. Coleção fornecedores_pecas
    let fornecedoresPecasCol
    try {
      fornecedoresPecasCol = app.findCollectionByNameOrId('fornecedores_pecas')
    } catch (_) {
      fornecedoresPecasCol = new Collection({
        name: 'fornecedores_pecas',
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
          { name: 'cnpj', type: 'text' },
          { name: 'contato', type: 'text' },
          { name: 'telefone', type: 'text' },
          { name: 'tipo_pecas', type: 'text' }, // Ex: Pneus, Filtros, Hidráulica, Usinagem, Mecânica Geral
          { name: 'cidade', type: 'text' },
          { name: 'endereco', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_forn_pecas_empresa ON fornecedores_pecas (empresa_id)',
          'CREATE INDEX idx_forn_pecas_nome ON fornecedores_pecas (nome)',
        ],
      })
      app.save(fornecedoresPecasCol)
    }

    // 3. Adicionar conta_receber_id em entregas
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      const contasReceberCol = app.findCollectionByNameOrId('contas_receber')

      if (!entregasCol.fields.getByName('conta_receber_id')) {
        entregasCol.fields.add(
          new RelationField({
            name: 'conta_receber_id',
            collectionId: contasReceberCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          }),
        )
        entregasCol.addIndex('idx_entregas_conta_receber', false, 'conta_receber_id', '')
        app.save(entregasCol)
      }
    } catch (err) {
      console.log('Aviso ao adicionar conta_receber_id em entregas:', err)
    }
  },
  (app) => {
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      entregasCol.removeIndex('idx_entregas_conta_receber')
      entregasCol.fields.removeByName('conta_receber_id')
      app.save(entregasCol)
    } catch (_) {}

    try {
      const fornPecas = app.findCollectionByNameOrId('fornecedores_pecas')
      app.delete(fornPecas)
    } catch (_) {}

    try {
      const postos = app.findCollectionByNameOrId('postos_combustivel')
      app.delete(postos)
    } catch (_) {}
  },
)
