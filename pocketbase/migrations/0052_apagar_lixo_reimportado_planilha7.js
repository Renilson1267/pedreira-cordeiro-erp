/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Apagar registros de contas_receber originados da aba 'Planilha7' com vencimento 2026-12-31
    // juntamente com movimentos_financeiros e creditos_clientes associados.
    // Lixo reimportado com datas corrompidas tipo "PAGO 09/05/25" e vencimento 31/12/2026.

    try {
      // 1) Apagar movimentos_financeiros vinculados
      const resMovimentos = app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
          AND referencia_id IN (
            SELECT id FROM contas_receber
            WHERE (observacoes LIKE '%Planilha7%' OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
              AND (vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
          )
      `)
        .execute()
      console.log('Movimentos financeiros de Planilha7/31-12-2026 apagados:', resMovimentos)
    } catch (err) {
      console.log('Erro ao apagar movimentos financeiros:', err)
      throw err
    }

    try {
      // 2) Apagar creditos_clientes vinculados
      const resCreditos = app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (
          SELECT id FROM contas_receber
          WHERE (observacoes LIKE '%Planilha7%' OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
            AND (vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
        )
      `)
        .execute()
      console.log('Créditos clientes de Planilha7/31-12-2026 apagados:', resCreditos)
    } catch (err) {
      console.log('Erro ao apagar créditos de clientes:', err)
      throw err
    }

    try {
      // 3) Apagar contas_receber
      const resContas = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
        WHERE (observacoes LIKE '%Planilha7%' OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
          AND (vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
      `)
        .execute()
      console.log('Contas a receber de Planilha7/31-12-2026 apagadas:', resContas)
    } catch (err) {
      console.log('Erro ao apagar contas_receber de Planilha7:', err)
      throw err
    }
  },
  (app) => {
    // down (irreversível, deleção permanente de dados corrompidos)
  },
)
