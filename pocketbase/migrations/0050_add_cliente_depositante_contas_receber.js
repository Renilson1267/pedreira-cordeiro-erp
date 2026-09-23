migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contas_receber')

    if (!col.fields.getByName('cliente_depositante')) {
      col.fields.add(
        new TextField({
          name: 'cliente_depositante',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contas_receber')
      const f = col.fields.getByName('cliente_depositante')
      if (f) {
        col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)
