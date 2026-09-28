migrate(
  (app) => {
    // Sincroniza valor_pago para títulos com status 'Paga' onde valor_pago ficou 0 ou nulo
    app
      .db()
      .newQuery(`
    UPDATE contas_pagar
    SET valor_pago = valor
    WHERE status = 'Paga' AND (valor_pago IS NULL OR valor_pago <= 0)
  `)
      .execute()

    // Sincroniza valor_recebido para títulos com status 'Recebida' onde valor_recebido ficou 0 ou nulo
    app
      .db()
      .newQuery(`
    UPDATE contas_receber
    SET valor_recebido = valor
    WHERE status = 'Recebida' AND (valor_recebido IS NULL OR valor_recebido <= 0)
  `)
      .execute()
  },
  (app) => {
    // No-op rollback
  },
)
