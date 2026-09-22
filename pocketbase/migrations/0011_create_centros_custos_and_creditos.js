migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const clientesCol = app.findCollectionByNameOrId('clientes')

    // 1. Criar coleção centros_custos
    const centrosCustos = new Collection({
      name: 'centros_custos',
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
        { name: 'descricao', type: 'text' },
        { name: 'cor', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_centros_custos_empresa ON centros_custos (empresa_id)',
        'CREATE INDEX idx_centros_custos_codigo ON centros_custos (codigo)',
      ],
    })
    app.save(centrosCustos)

    const centrosCol = app.findCollectionByNameOrId('centros_custos')

    // 2. Criar coleção creditos_clientes
    const creditosClientes = new Collection({
      name: 'creditos_clientes',
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
          name: 'cliente_id',
          type: 'relation',
          required: true,
          collectionId: clientesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'saldo_restante', type: 'number', required: true },
        { name: 'origem', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'data', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['disponivel', 'parcial', 'utilizado'],
          maxSelect: 1,
        },
        { name: 'referencia_conta_id', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_creditos_empresa ON creditos_clientes (empresa_id)',
        'CREATE INDEX idx_creditos_cliente ON creditos_clientes (cliente_id)',
        'CREATE INDEX idx_creditos_status ON creditos_clientes (status)',
      ],
    })
    app.save(creditosClientes)

    // 3. Atualizar contas_receber:
    // a) adicionar 'Recebimento Antecipado' no select de status
    // b) adicionar relation centro_custo_id
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    const statusFieldCR = contasReceberCol.fields.getByName('status')
    if (statusFieldCR) {
      statusFieldCR.values = ['Aberta', 'Recebida', 'Vencida', 'Recebimento Antecipado']
      statusFieldCR.maxSelect = 1
    }
    if (!contasReceberCol.fields.getByName('centro_custo_id')) {
      contasReceberCol.fields.add(
        new RelationField({
          name: 'centro_custo_id',
          required: false,
          collectionId: centrosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(contasReceberCol)

    // 4. Atualizar contas_pagar:
    // adicionar relation centro_custo_id
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    if (!contasPagarCol.fields.getByName('centro_custo_id')) {
      contasPagarCol.fields.add(
        new RelationField({
          name: 'centro_custo_id',
          required: false,
          collectionId: centrosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(contasPagarCol)

    // 5. Atualizar movimentos_financeiros:
    // adicionar relation centro_custo_id
    const movCol = app.findCollectionByNameOrId('movimentos_financeiros')
    if (!movCol.fields.getByName('centro_custo_id')) {
      movCol.fields.add(
        new RelationField({
          name: 'centro_custo_id',
          required: false,
          collectionId: centrosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(movCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('creditos_clientes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('centros_custos'))
    } catch (_) {}
  },
)
