migrate(
  (app) => {
    // 1. Atualizar contas_pagar
    const cpCol = app.findCollectionByNameOrId('contas_pagar')
    if (!cpCol.fields.getByName('valor_pago')) {
      cpCol.fields.add(
        new NumberField({
          name: 'valor_pago',
          required: false,
          min: 0,
        }),
      )
    }

    // Permitir status 'Parcial' caso desejado no select (ou manter Aberta, Paga, Vencida, Parcial)
    const cpStatus = cpCol.fields.getByName('status')
    if (cpStatus) {
      cpStatus.values = ['Aberta', 'Paga', 'Vencida', 'Parcial']
      cpStatus.maxSelect = 1
    }
    app.save(cpCol)

    // 2. Atualizar contas_receber
    const crCol = app.findCollectionByNameOrId('contas_receber')
    if (!crCol.fields.getByName('valor_recebido')) {
      crCol.fields.add(
        new NumberField({
          name: 'valor_recebido',
          required: false,
          min: 0,
        }),
      )
    }

    const crStatus = crCol.fields.getByName('status')
    if (crStatus) {
      crStatus.values = ['Aberta', 'Recebida', 'Vencida', 'Recebimento Antecipado', 'Parcial']
      crStatus.maxSelect = 1
    }
    app.save(crCol)

    // 3. Atualizar dados existentes:
    // Para contas_pagar com status 'Paga': se valor_pago for nulo ou 0, preencher com o valor total
    // Para contas_pagar com status 'Aberta' ou 'Vencida': preencher valor_pago com 0 se nulo
    app
      .db()
      .newQuery(`
      UPDATE contas_pagar
      SET valor_pago = valor
      WHERE status = 'Paga' AND (valor_pago IS NULL OR valor_pago = 0)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE contas_pagar
      SET valor_pago = 0
      WHERE status != 'Paga' AND valor_pago IS NULL
    `)
      .execute()

    // Para contas_receber com status 'Recebida': se valor_recebido for nulo ou 0, preencher com o valor total
    // Para contas_receber com status != 'Recebida': preencher valor_recebido com 0 se nulo
    app
      .db()
      .newQuery(`
      UPDATE contas_receber
      SET valor_recebido = valor
      WHERE status = 'Recebida' AND (valor_recebido IS NULL OR valor_recebido = 0)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE contas_receber
      SET valor_recebido = 0
      WHERE status != 'Recebida' AND valor_recebido IS NULL
    `)
      .execute()
  },
  (app) => {
    try {
      const cpCol = app.findCollectionByNameOrId('contas_pagar')
      const cpF = cpCol.fields.getByName('valor_pago')
      if (cpF) {
        cpCol.fields.remove(cpF)
        app.save(cpCol)
      }
    } catch (_) {}

    try {
      const crCol = app.findCollectionByNameOrId('contas_receber')
      const crF = crCol.fields.getByName('valor_recebido')
      if (crF) {
        crCol.fields.remove(crF)
        app.save(crCol)
      }
    } catch (_) {}
  },
)
