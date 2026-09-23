/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Apagar TODOS os contas_receber com vencimento em 2026-12-31 (ou data_recebimento em 2026-12-31)
    // juntamente com movimentos_financeiros e creditos_clientes associados.
    // Todos os 10 registros remanescentes originaram-se da importação de 'Planilha7' com datas corrompidas.

    try {
      // 1) Apagar movimentos_financeiros vinculados aos contas_receber de 31/12/2026
      const resMovimentos = app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
          AND referencia_id IN (
            SELECT id FROM contas_receber
            WHERE vencimento LIKE '2026-12-31%'
               OR data_recebimento LIKE '2026-12-31%'
          )
      `)
        .execute()
      console.log('Movimentos financeiros apagados:', resMovimentos)
    } catch (err) {
      console.log('Erro ao apagar movimentos financeiros de 31/12/2026:', err)
      throw err
    }

    try {
      // 2) Apagar creditos_clientes vinculados aos contas_receber de 31/12/2026
      const resCreditos = app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (
          SELECT id FROM contas_receber
          WHERE vencimento LIKE '2026-12-31%'
             OR data_recebimento LIKE '2026-12-31%'
        )
      `)
        .execute()
      console.log('Créditos clientes apagados:', resCreditos)
    } catch (err) {
      console.log('Erro ao apagar créditos de clientes de 31/12/2026:', err)
      throw err
    }

    try {
      // 3) Apagar contas_receber com vencimento em 2026-12-31 ou data_recebimento em 2026-12-31
      const resContas = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
        WHERE vencimento LIKE '2026-12-31%'
           OR data_recebimento LIKE '2026-12-31%'
      `)
        .execute()
      console.log('Contas a receber de 31/12/2026 apagadas:', resContas)
    } catch (err) {
      console.log('Erro ao apagar contas_receber de 31/12/2026:', err)
      throw err
    }
  },
  (app) => {
    // down (irreversível, deleção permanente solicitada pelo usuário)
  },
)
