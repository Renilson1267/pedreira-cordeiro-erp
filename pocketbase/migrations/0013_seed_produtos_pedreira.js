migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    // Expand unit options if needed or use existing values
    // Existing values: un | kg | cx | l | m² | serv
    // Let's add m³ and ton to unidade options
    const unidadeField = produtosCol.fields.getByName('unidade')
    if (unidadeField) {
      const currentValues = unidadeField.values || []
      const newValues = [...currentValues]
      if (!newValues.includes('m³')) newValues.push('m³')
      if (!newValues.includes('ton')) newValues.push('ton')
      unidadeField.values = newValues
      unidadeField.maxSelect = 1
      app.save(produtosCol)
    }

    // Find all empresas to ensure products exist
    const empresas = app.findRecordsByFilter('empresas', '', '+created', 100, 0)
    if (empresas.length === 0) return

    const pedreiraProdutos = [
      {
        codigo: 'PRD-BRITA12',
        nome: 'Brita 12',
        categoria: 'Vendas',
        unidade: 'm³',
        preco_custo: 38.0,
        preco_venda: 68.0,
        estoque: 1200,
        estoque_minimo: 200,
      },
      {
        codigo: 'PRD-BRITA19',
        nome: 'Brita 19',
        categoria: 'Vendas',
        unidade: 'm³',
        preco_custo: 36.0,
        preco_venda: 65.0,
        estoque: 1500,
        estoque_minimo: 200,
      },
      {
        codigo: 'PRD-RACHAO',
        nome: 'Pedra rachão',
        categoria: 'Vendas',
        unidade: 'm³',
        preco_custo: 28.0,
        preco_venda: 52.0,
        estoque: 800,
        estoque_minimo: 150,
      },
      {
        codigo: 'PRD-PO-PEDRA',
        nome: 'Pó de pedra',
        categoria: 'Vendas',
        unidade: 'm³',
        preco_custo: 25.0,
        preco_venda: 45.0,
        estoque: 950,
        estoque_minimo: 150,
      },
      {
        codigo: 'PRD-CASCALHINHO',
        nome: 'Cascalhinho',
        categoria: 'Vendas',
        unidade: 'm³',
        preco_custo: 22.0,
        preco_venda: 42.0,
        estoque: 600,
        estoque_minimo: 100,
      },
    ]

    for (const empresa of empresas) {
      for (const item of pedreiraProdutos) {
        try {
          // Check if already exists by codigo and empresa_id
          const existing = app.findRecordsByFilter(
            'produtos',
            `empresa_id = '${empresa.id}' && codigo = '${item.codigo}'`,
            '',
            1,
            0,
          )
          if (existing.length > 0) {
            // Update name if needed
            const rec = existing[0]
            rec.set('nome', item.nome)
            rec.set('unidade', item.unidade)
            app.save(rec)
            continue
          }
        } catch (_) {}

        // Check if exists by name
        try {
          const existingByName = app.findRecordsByFilter(
            'produtos',
            `empresa_id = '${empresa.id}' && nome = '${item.nome}'`,
            '',
            1,
            0,
          )
          if (existingByName.length > 0) {
            continue
          }
        } catch (_) {}

        const rec = new Record(produtosCol)
        rec.set('empresa_id', empresa.id)
        rec.set('codigo', item.codigo)
        rec.set('nome', item.nome)
        rec.set('categoria', item.categoria)
        rec.set('unidade', item.unidade)
        rec.set('preco_custo', item.preco_custo)
        rec.set('preco_venda', item.preco_venda)
        rec.set('estoque', item.estoque)
        rec.set('estoque_minimo', item.estoque_minimo)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down: remove seeded products
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM produtos WHERE codigo LIKE 'PRD-BRITA%' OR codigo IN ('PRD-RACHAO', 'PRD-PO-PEDRA', 'PRD-CASCALHINHO')",
        )
        .execute()
    } catch (_) {}
  },
)
