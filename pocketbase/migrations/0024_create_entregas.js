migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const veiculosCol = app.findCollectionByNameOrId('veiculos')

    let produtosColId = null
    try {
      produtosColId = app.findCollectionByNameOrId('produtos').id
    } catch (_) {}

    let funcionariosColId = null
    try {
      funcionariosColId = app.findCollectionByNameOrId('funcionarios').id
    } catch (_) {}

    let contasPagarColId = null
    try {
      contasPagarColId = app.findCollectionByNameOrId('contas_pagar').id
    } catch (_) {}

    const fields = [
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
        name: 'data',
        type: 'date',
        required: true,
      },
      {
        name: 'origem',
        type: 'text',
        required: true,
      },
      {
        name: 'destino',
        type: 'text',
        required: true,
      },
      {
        name: 'km_rodado',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'km_inicial',
        type: 'number',
        required: false,
      },
      {
        name: 'km_final',
        type: 'number',
        required: false,
      },
      {
        name: 'motorista',
        type: 'text',
        required: false,
      },
      {
        name: 'produto_nome',
        type: 'text',
        required: false,
      },
      {
        name: 'quantidade',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'unidade_medida',
        type: 'select',
        required: false,
        values: ['m³', 'ton', 'viagem'],
        maxSelect: 1,
      },
      {
        name: 'consumo_estimado_km_l',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'preco_combustivel_litro',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'litros_estimados',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'custo_estimado',
        type: 'number',
        required: true,
        min: 0,
      },
      {
        name: 'custo_por_km',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        values: ['concluida', 'em_transito', 'cancelada'],
        maxSelect: 1,
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
    ]

    if (funcionariosColId) {
      fields.splice(9, 0, {
        name: 'funcionario_id',
        type: 'relation',
        required: false,
        collectionId: funcionariosColId,
        cascadeDelete: false,
        maxSelect: 1,
      })
    }

    if (produtosColId) {
      fields.splice(11, 0, {
        name: 'produto_id',
        type: 'relation',
        required: false,
        collectionId: produtosColId,
        cascadeDelete: false,
        maxSelect: 1,
      })
    }

    if (contasPagarColId) {
      fields.splice(fields.length - 3, 0, {
        name: 'conta_pagar_id',
        type: 'relation',
        required: false,
        collectionId: contasPagarColId,
        cascadeDelete: false,
        maxSelect: 1,
      })
    }

    const entregasCol = new Collection({
      name: 'entregas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields,
      indexes: [],
    })

    app.save(entregasCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('entregas')
      app.delete(col)
    } catch (_) {}
  },
)
