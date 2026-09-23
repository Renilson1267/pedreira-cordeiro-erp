migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const produtosCol = app.findCollectionByNameOrId('produtos')

    // 1. Criar collection 'vendas'
    const vendasCol = new Collection({
      name: 'vendas',
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
        {
          name: 'produto_id',
          type: 'relation',
          required: false,
          collectionId: produtosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'produto_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'quantidade',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'unidade',
          type: 'select',
          required: true,
          values: ['m³', 'ton', 'un', 'viagem'],
          maxSelect: 1,
        },
        {
          name: 'preco_unitario',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'valor_total',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'data_venda',
          type: 'date',
          required: true,
        },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: false,
          values: ['Dinheiro', 'Pix', 'Boleto', 'Cartão', 'Transferência', 'A Prazo', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Faturada', 'Paga', 'Cancelada'],
          maxSelect: 1,
        },
        {
          name: 'nota_fiscal',
          type: 'text',
          required: false,
        },
        {
          name: 'conta_receber_id',
          type: 'text',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_vendas_empresa ON vendas (empresa_id)',
        'CREATE INDEX idx_vendas_cliente ON vendas (cliente_id)',
        'CREATE INDEX idx_vendas_data ON vendas (data_venda)',
        'CREATE INDEX idx_vendas_status ON vendas (status)',
      ],
    })
    app.save(vendasCol)

    // 2. Adicionar venda_id em contas_receber para rastreabilidade
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    if (!contasReceberCol.fields.getByName('venda_id')) {
      contasReceberCol.fields.add(
        new RelationField({
          name: 'venda_id',
          collectionId: vendasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(contasReceberCol)
    }

    // 3. Adicionar campos em entregas:
    // - venda_id (relation para vendas)
    // - cliente_id (relation para clientes)
    // - cliente_nome (text)
    const entregasCol = app.findCollectionByNameOrId('entregas')
    if (!entregasCol.fields.getByName('venda_id')) {
      entregasCol.fields.add(
        new RelationField({
          name: 'venda_id',
          collectionId: vendasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!entregasCol.fields.getByName('cliente_id')) {
      entregasCol.fields.add(
        new RelationField({
          name: 'cliente_id',
          collectionId: clientesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!entregasCol.fields.getByName('cliente_nome')) {
      entregasCol.fields.add(
        new TextField({
          name: 'cliente_nome',
          required: false,
        }),
      )
    }
    app.save(entregasCol)

    // 4. Criar collection 'despesas_frota' para vincular despesas (combustível, manutenção, pneus, peças, seguro, impostos, lubrificantes, outros) e abatimentos
    const veiculosCol = app.findCollectionByNameOrId('veiculos')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')

    const despesasFrotaCol = new Collection({
      name: 'despesas_frota',
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
          name: 'veiculo_id',
          type: 'relation',
          required: true,
          collectionId: veiculosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'placa_patrimonio',
          type: 'text',
          required: false,
        },
        {
          name: 'setor',
          type: 'text',
          required: true,
        },
        {
          name: 'natureza',
          type: 'select',
          required: true,
          values: ['Despesa', 'Abatimento'],
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'Manutenção',
            'Combustível',
            'Pneus',
            'Peças',
            'Seguro',
            'IPVA / Taxas',
            'Lubrificantes',
            'Abatimento / Desconto',
            'Outros',
          ],
          maxSelect: 1,
        },
        {
          name: 'descricao',
          type: 'text',
          required: true,
        },
        {
          name: 'fornecedor_id',
          type: 'relation',
          required: false,
          collectionId: fornecedoresCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'fornecedor_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'data',
          type: 'date',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Pago', 'Cancelado'],
          maxSelect: 1,
        },
        {
          name: 'conta_pagar_id',
          type: 'relation',
          required: false,
          collectionId: contasPagarCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'referencia_origem',
          type: 'text',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_desp_frota_empresa ON despesas_frota (empresa_id)',
        'CREATE INDEX idx_desp_frota_veiculo ON despesas_frota (veiculo_id)',
        'CREATE INDEX idx_desp_frota_setor ON despesas_frota (setor)',
        'CREATE INDEX idx_desp_frota_data ON despesas_frota (data)',
        'CREATE INDEX idx_desp_frota_natureza ON despesas_frota (natureza)',
      ],
    })
    app.save(despesasFrotaCol)

    // 5. Adicionar campo origem_frota em contas_pagar para rastreabilidade bidirecional
    if (!contasPagarCol.fields.getByName('origem_frota')) {
      contasPagarCol.fields.add(
        new TextField({
          name: 'origem_frota',
          required: false,
        }),
      )
    }
    if (!contasPagarCol.fields.getByName('veiculo_id')) {
      contasPagarCol.fields.add(
        new RelationField({
          name: 'veiculo_id',
          collectionId: veiculosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    app.save(contasPagarCol)

    // 6. Adicionar campo setor em abastecimentos e manutencoes para retrocompatibilidade e velocidade de consulta direta
    const abastecimentosCol = app.findCollectionByNameOrId('abastecimentos')
    if (!abastecimentosCol.fields.getByName('setor')) {
      abastecimentosCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(abastecimentosCol)
    }

    const manutencoesCol = app.findCollectionByNameOrId('manutencoes')
    if (!manutencoesCol.fields.getByName('setor')) {
      manutencoesCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
      app.save(manutencoesCol)
    }
  },
  (app) => {
    try {
      const df = app.findCollectionByNameOrId('despesas_frota')
      app.delete(df)
    } catch (_) {}
    try {
      const v = app.findCollectionByNameOrId('vendas')
      app.delete(v)
    } catch (_) {}
  },
)
