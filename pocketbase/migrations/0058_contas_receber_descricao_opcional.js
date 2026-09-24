migrate(
  (app) => {
    // 1. contas_receber: tornar o campo descricao opcional
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    const crDescField = contasReceberCol.fields.getByName('descricao')
    if (crDescField) {
      crDescField.required = false
      app.save(contasReceberCol)
    }

    // 2. contas_pagar: tornar o campo descricao opcional também, para segurança e consistência
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    const cpDescField = contasPagarCol.fields.getByName('descricao')
    if (cpDescField) {
      cpDescField.required = false
      app.save(contasPagarCol)
    }
  },
  (app) => {
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    const crDescField = contasReceberCol.fields.getByName('descricao')
    if (crDescField) {
      crDescField.required = true
      app.save(contasReceberCol)
    }

    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    const cpDescField = contasPagarCol.fields.getByName('descricao')
    if (cpDescField) {
      cpDescField.required = true
      app.save(contasPagarCol)
    }
  },
)
