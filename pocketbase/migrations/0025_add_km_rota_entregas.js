migrate(
  (app) => {
    const entregasCol = app.findCollectionByNameOrId('entregas')

    // Adiciona km_rota (distância calculada automaticamente via rota rodoviária)
    if (!entregasCol.fields.getByName('km_rota')) {
      entregasCol.fields.add(
        new NumberField({
          name: 'km_rota',
          required: false,
          min: 0,
        }),
      )
      app.save(entregasCol)
    }
  },
  (app) => {
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      entregasCol.fields.removeByName('km_rota')
      app.save(entregasCol)
    } catch (_) {}
  },
)
