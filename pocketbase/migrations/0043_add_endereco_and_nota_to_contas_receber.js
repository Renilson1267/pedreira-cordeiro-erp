migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contas_receber')

    if (!col.fields.getByName('endereco')) {
      col.fields.add(
        new TextField({
          name: 'endereco',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('nota')) {
      col.fields.add(
        new TextField({
          name: 'nota',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contas_receber')
      const endF = col.fields.getByName('endereco')
      if (endF) {
        col.fields.remove(endF)
      }
      const notaF = col.fields.getByName('nota')
      if (notaF) {
        col.fields.remove(notaF)
      }
      app.save(col)
    } catch (_) {}
  },
)
