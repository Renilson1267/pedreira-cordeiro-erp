migrate(
  (app) => {
    // 1. Adicionar campos de desconto na collection 'vendas'
    try {
      const vendasCol = app.findCollectionByNameOrId('vendas')
      let changedVendas = false

      if (!vendasCol.fields.getByName('tipo_desconto')) {
        vendasCol.fields.add(
          new SelectField({
            name: 'tipo_desconto',
            required: false,
            values: ['percentual', 'valor'],
            maxSelect: 1,
          }),
        )
        changedVendas = true
      }

      if (!vendasCol.fields.getByName('valor_desconto')) {
        vendasCol.fields.add(
          new NumberField({
            name: 'valor_desconto',
            required: false,
            min: 0,
          }),
        )
        changedVendas = true
      }

      if (!vendasCol.fields.getByName('desconto_percentual')) {
        vendasCol.fields.add(
          new NumberField({
            name: 'desconto_percentual',
            required: false,
            min: 0,
            max: 100,
          }),
        )
        changedVendas = true
      }

      if (!vendasCol.fields.getByName('valor_bruto')) {
        vendasCol.fields.add(
          new NumberField({
            name: 'valor_bruto',
            required: false,
            min: 0,
          }),
        )
        changedVendas = true
      }

      if (changedVendas) {
        app.save(vendasCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar campos de desconto em vendas:', e)
    }

    // 2. Adicionar campos de desconto na collection 'contas_receber'
    try {
      const crCol = app.findCollectionByNameOrId('contas_receber')
      let changedCr = false

      if (!crCol.fields.getByName('tipo_desconto')) {
        crCol.fields.add(
          new SelectField({
            name: 'tipo_desconto',
            required: false,
            values: ['percentual', 'valor'],
            maxSelect: 1,
          }),
        )
        changedCr = true
      }

      if (!crCol.fields.getByName('valor_desconto')) {
        crCol.fields.add(
          new NumberField({
            name: 'valor_desconto',
            required: false,
            min: 0,
          }),
        )
        changedCr = true
      }

      if (!crCol.fields.getByName('desconto_percentual')) {
        crCol.fields.add(
          new NumberField({
            name: 'desconto_percentual',
            required: false,
            min: 0,
            max: 100,
          }),
        )
        changedCr = true
      }

      if (!crCol.fields.getByName('valor_bruto')) {
        crCol.fields.add(
          new NumberField({
            name: 'valor_bruto',
            required: false,
            min: 0,
          }),
        )
        changedCr = true
      }

      if (changedCr) {
        app.save(crCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar campos de desconto em contas_receber:', e)
    }
  },
  (app) => {
    try {
      const vendasCol = app.findCollectionByNameOrId('vendas')
      const f1 = vendasCol.fields.getByName('tipo_desconto')
      if (f1) vendasCol.fields.remove(f1)
      const f2 = vendasCol.fields.getByName('valor_desconto')
      if (f2) vendasCol.fields.remove(f2)
      const f3 = vendasCol.fields.getByName('desconto_percentual')
      if (f3) vendasCol.fields.remove(f3)
      const f4 = vendasCol.fields.getByName('valor_bruto')
      if (f4) vendasCol.fields.remove(f4)
      app.save(vendasCol)
    } catch (_) {}

    try {
      const crCol = app.findCollectionByNameOrId('contas_receber')
      const f1 = crCol.fields.getByName('tipo_desconto')
      if (f1) crCol.fields.remove(f1)
      const f2 = crCol.fields.getByName('valor_desconto')
      if (f2) crCol.fields.remove(f2)
      const f3 = crCol.fields.getByName('desconto_percentual')
      if (f3) crCol.fields.remove(f3)
      const f4 = crCol.fields.getByName('valor_bruto')
      if (f4) crCol.fields.remove(f4)
      app.save(crCol)
    } catch (_) {}
  },
)
