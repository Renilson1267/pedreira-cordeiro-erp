migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const planoCol = app.findCollectionByNameOrId('plano_contas')

    const contasPagar = new Collection({
      name: 'contas_pagar',
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
          name: 'fornecedor_id',
          type: 'relation',
          required: false,
          collectionId: fornecedoresCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'categoria_id',
          type: 'relation',
          required: false,
          collectionId: planoCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'vencimento', type: 'date', required: true },
        { name: 'parcelas', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aberta', 'Paga', 'Vencida'],
          maxSelect: 1,
        },
        { name: 'data_pagamento', type: 'date' },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['Dinheiro', 'Pix', 'Cartão', 'Boleto', 'Transferência'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_pagar_empresa ON contas_pagar (empresa_id)',
        'CREATE INDEX idx_contas_pagar_status ON contas_pagar (status)',
        'CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar (vencimento)',
        'CREATE INDEX idx_contas_pagar_fornecedor ON contas_pagar (fornecedor_id)',
      ],
    })
    app.save(contasPagar)

    const contasReceber = new Collection({
      name: 'contas_receber',
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
          required: false,
          collectionId: clientesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'categoria_id',
          type: 'relation',
          required: false,
          collectionId: planoCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'vencimento', type: 'date', required: true },
        { name: 'parcelas', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aberta', 'Recebida', 'Vencida'],
          maxSelect: 1,
        },
        { name: 'data_recebimento', type: 'date' },
        {
          name: 'forma_recebimento',
          type: 'select',
          values: ['Dinheiro', 'Pix', 'Cartão', 'Boleto', 'Transferência'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_receber_empresa ON contas_receber (empresa_id)',
        'CREATE INDEX idx_contas_receber_status ON contas_receber (status)',
        'CREATE INDEX idx_contas_receber_vencimento ON contas_receber (vencimento)',
        'CREATE INDEX idx_contas_receber_cliente ON contas_receber (cliente_id)',
      ],
    })
    app.save(contasReceber)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('contas_pagar'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_receber'))
    } catch (_) {}
  },
)
