migrate(
  (app) => {
    // 1. contas_receber: adicionar data_emissao se não existir
    try {
      const crCol = app.findCollectionByNameOrId('contas_receber')
      if (!crCol.fields.getByName('data_emissao')) {
        crCol.fields.add(
          new DateField({
            name: 'data_emissao',
            required: false,
          }),
        )
        app.save(crCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar data_emissao em contas_receber:', e)
    }

    // 2. contas_pagar: adicionar data_emissao se não existir
    try {
      const cpCol = app.findCollectionByNameOrId('contas_pagar')
      if (!cpCol.fields.getByName('data_emissao')) {
        cpCol.fields.add(
          new DateField({
            name: 'data_emissao',
            required: false,
          }),
        )
        app.save(cpCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar data_emissao em contas_pagar:', e)
    }
  },
  (app) => {
    try {
      const crCol = app.findCollectionByNameOrId('contas_receber')
      const fCr = crCol.fields.getByName('data_emissao')
      if (fCr) {
        crCol.fields.remove(fCr)
        app.save(crCol)
      }
    } catch (_) {}

    try {
      const cpCol = app.findCollectionByNameOrId('contas_pagar')
      const fCp = cpCol.fields.getByName('data_emissao')
      if (fCp) {
        cpCol.fields.remove(fCp)
        app.save(cpCol)
      }
    } catch (_) {}
  },
)
