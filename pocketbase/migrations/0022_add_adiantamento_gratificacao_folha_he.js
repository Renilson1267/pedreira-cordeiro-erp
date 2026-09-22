migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('folha_horas_extras')

    if (!col.fields.getByName('gratificacao')) {
      col.fields.add(
        new NumberField({
          name: 'gratificacao',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('adiantamento')) {
      col.fields.add(
        new NumberField({
          name: 'adiantamento',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_liquido')) {
      col.fields.add(
        new NumberField({
          name: 'valor_liquido',
          required: false,
        }),
      )
    }

    app.save(col)

    // Atualiza registros existentes para garantir valor_liquido = total_valor se nulo
    app
      .db()
      .newQuery(`
      UPDATE folha_horas_extras
      SET gratificacao = COALESCE(gratificacao, 0),
          adiantamento = COALESCE(adiantamento, 0),
          valor_liquido = COALESCE(valor_liquido, total_valor)
      WHERE valor_liquido IS NULL
    `)
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('folha_horas_extras')
    const gratificacaoField = col.fields.getByName('gratificacao')
    if (gratificacaoField) col.fields.remove(gratificacaoField)

    const adiantamentoField = col.fields.getByName('adiantamento')
    if (adiantamentoField) col.fields.remove(adiantamentoField)

    const valorLiquidoField = col.fields.getByName('valor_liquido')
    if (valorLiquidoField) col.fields.remove(valorLiquidoField)

    app.save(col)
  },
)
