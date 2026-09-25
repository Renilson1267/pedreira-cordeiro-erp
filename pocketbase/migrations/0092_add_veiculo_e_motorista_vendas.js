migrate(
  (app) => {
    const vendasCol = app.findCollectionByNameOrId('vendas')
    const veiculosCol = app.findCollectionByNameOrId('veiculos')

    if (!vendasCol.fields.getByName('veiculo_id')) {
      vendasCol.fields.add(
        new RelationField({
          name: 'veiculo_id',
          collectionId: veiculosCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    if (!vendasCol.fields.getByName('veiculo_identificacao')) {
      vendasCol.fields.add(
        new TextField({
          name: 'veiculo_identificacao',
        }),
      )
    }

    if (!vendasCol.fields.getByName('placa')) {
      vendasCol.fields.add(
        new TextField({
          name: 'placa',
        }),
      )
    }

    if (!vendasCol.fields.getByName('transportador_terceiro')) {
      vendasCol.fields.add(
        new TextField({
          name: 'transportador_terceiro',
        }),
      )
    }

    if (!vendasCol.fields.getByName('motorista')) {
      vendasCol.fields.add(
        new TextField({
          name: 'motorista',
        }),
      )
    }

    app.save(vendasCol)
  },
  (app) => {
    const vendasCol = app.findCollectionByNameOrId('vendas')
    const fieldsToRemove = [
      'veiculo_id',
      'veiculo_identificacao',
      'placa',
      'transportador_terceiro',
      'motorista',
    ]
    for (const name of fieldsToRemove) {
      const f = vendasCol.fields.getByName(name)
      if (f) vendasCol.fields.remove(f)
    }
    app.save(vendasCol)
  },
)
