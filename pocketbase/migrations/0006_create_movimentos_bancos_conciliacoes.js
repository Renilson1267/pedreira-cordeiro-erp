migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const planoCol = app.findCollectionByNameOrId('plano_contas')

    const bancosContas = new Collection({
      name: 'bancos_contas',
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
        { name: 'banco', type: 'text' },
        { name: 'agencia', type: 'text' },
        { name: 'conta', type: 'text' },
        { name: 'saldo_inicial', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_bancos_contas_empresa ON bancos_contas (empresa_id)'],
    })
    app.save(bancosContas)

    const bancosCol = app.findCollectionByNameOrId('bancos_contas')

    const movimentosFinanceiros = new Collection({
      name: 'movimentos_financeiros',
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
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Entrada', 'Saida'],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'data', type: 'date', required: true },
        {
          name: 'categoria_id',
          type: 'relation',
          required: false,
          collectionId: planoCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: ['ContaPagar', 'ContaReceber', 'Manual', 'Conciliacao'],
          maxSelect: 1,
        },
        { name: 'referencia_id', type: 'text' },
        { name: 'conciliado', type: 'bool' },
        {
          name: 'caixa_id',
          type: 'relation',
          required: false,
          collectionId: bancosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_mov_empresa ON movimentos_financeiros (empresa_id)',
        'CREATE INDEX idx_mov_data ON movimentos_financeiros (data)',
        'CREATE INDEX idx_mov_tipo ON movimentos_financeiros (tipo)',
        'CREATE INDEX idx_mov_categoria ON movimentos_financeiros (categoria_id)',
        'CREATE INDEX idx_mov_conciliado ON movimentos_financeiros (conciliado)',
      ],
    })
    app.save(movimentosFinanceiros)

    const conciliacoes = new Collection({
      name: 'conciliacoes',
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
          name: 'banco_conta_id',
          type: 'relation',
          required: true,
          collectionId: bancosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'mes', type: 'text', required: true },
        {
          name: 'arquivo',
          type: 'file',
          maxSize: 10485760,
          mimeTypes: ['text/csv', 'application/pdf', 'text/plain', 'application/octet-stream'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['EmAndamento', 'Concluida'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_conciliacoes_empresa ON conciliacoes (empresa_id)',
        'CREATE INDEX idx_conciliacoes_mes ON conciliacoes (mes)',
        'CREATE INDEX idx_conciliacoes_banco ON conciliacoes (banco_conta_id)',
      ],
    })
    app.save(conciliacoes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('conciliacoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('movimentos_financeiros'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('bancos_contas'))
    } catch (_) {}
  },
)
