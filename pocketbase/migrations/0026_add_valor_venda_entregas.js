migrate(
  (app) => {
    const entregasCol = app.findCollectionByNameOrId('entregas')

    // Adiciona valor_venda (valor faturado da carga/entrega)
    if (!entregasCol.fields.getByName('valor_venda')) {
      entregasCol.fields.add(
        new NumberField({
          name: 'valor_venda',
          required: false,
          min: 0,
        }),
      )
    }

    // Adiciona preco_unitario_venda (preço de venda aplicado por unidade/m³/ton)
    if (!entregasCol.fields.getByName('preco_unitario_venda')) {
      entregasCol.fields.add(
        new NumberField({
          name: 'preco_unitario_venda',
          required: false,
          min: 0,
        }),
      )
    }

    app.save(entregasCol)
  },
  (app) => {
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      entregasCol.fields.removeByName('valor_venda')
      entregasCol.fields.removeByName('preco_unitario_venda')
      app.save(entregasCol)
    } catch (_) {}
  },
)
