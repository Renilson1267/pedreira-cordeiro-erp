migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')

    // Idempotent field addition
    if (!produtosCol.fields.getByName('densidade')) {
      produtosCol.fields.add(
        new NumberField({
          name: 'densidade',
          required: false,
          min: 0,
        }),
      )
      app.save(produtosCol)
    }

    // Pre-seed typical density values for existing pedreira products if not set
    // Brita 12 ≈ 1,5; Brita 19 ≈ 1,5; Pedra rachão ≈ 1,5; Pó de pedra ≈ 1,5; Cascalhinho ≈ 1,6
    const padroes = [
      { codigo: 'PRD-BRITA12', densidade: 1.5 },
      { codigo: 'PRD-BRITA19', densidade: 1.5 },
      { codigo: 'PRD-RACHAO', densidade: 1.5 },
      { codigo: 'PRD-PO-PEDRA', densidade: 1.5 },
      { codigo: 'PRD-CASCALHINHO', densidade: 1.6 },
    ]

    for (const item of padroes) {
      try {
        const records = app.findRecordsByFilter(
          'produtos',
          `codigo = '${item.codigo}' && (densidade = null || densidade = 0)`,
          '',
          100,
          0,
        )
        for (const rec of records) {
          rec.set('densidade', item.densidade)
          app.save(rec)
        }
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const produtosCol = app.findCollectionByNameOrId('produtos')
      produtosCol.fields.removeByName('densidade')
      app.save(produtosCol)
    } catch (_) {}
  },
)
