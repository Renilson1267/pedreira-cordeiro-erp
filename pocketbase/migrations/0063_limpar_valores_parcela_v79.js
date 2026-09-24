/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0063: Saneamento de títulos com valor <= 2 (número de parcela "1.1" lido como valor)
    //
    // Requisitos:
    // 1. DELETE FROM movimentos_financeiros WHERE origem = 'ContaReceber' AND referencia_id IN (SELECT id FROM contas_receber WHERE valor <= 2)
    // 2. DELETE FROM creditos_clientes WHERE referencia_conta_id IN (SELECT id FROM contas_receber WHERE valor <= 2)
    // 3. Desvincular vendas que porventura apontem para esses títulos
    // 4. DELETE FROM contas_receber WHERE valor <= 2
    // NÃO apagar títulos com datas em 01/01/2026 que não sejam valor <= 2.

    try {
      if (app.hasTable('movimentos_financeiros') && app.hasTable('contas_receber')) {
        app
          .db()
          .newQuery(
            "DELETE FROM movimentos_financeiros WHERE origem = 'ContaReceber' AND referencia_id IN (SELECT id FROM contas_receber WHERE valor <= 2)",
          )
          .execute()
      }
    } catch (errMov) {
      console.warn('Aviso ao apagar movimentos_financeiros vinculados a títulos <= 2:', errMov)
    }

    try {
      if (app.hasTable('creditos_clientes') && app.hasTable('contas_receber')) {
        app
          .db()
          .newQuery(
            'DELETE FROM creditos_clientes WHERE referencia_conta_id IN (SELECT id FROM contas_receber WHERE valor <= 2)',
          )
          .execute()
      }
    } catch (errCred) {
      console.warn('Aviso ao apagar creditos_clientes vinculados a títulos <= 2:', errCred)
    }

    try {
      if (app.hasTable('vendas') && app.hasTable('contas_receber')) {
        app
          .db()
          .newQuery(
            'UPDATE vendas SET conta_receber_id = "" WHERE conta_receber_id IN (SELECT id FROM contas_receber WHERE valor <= 2)',
          )
          .execute()
      }
    } catch (errVendas) {
      console.warn('Aviso ao desvincular vendas de títulos <= 2:', errVendas)
    }

    var apagados = 0
    try {
      if (app.hasTable('contas_receber')) {
        var res = app.db().newQuery('DELETE FROM contas_receber WHERE valor <= 2').execute()
        console.log(
          'Migração 0063 executada com sucesso. Títulos de contas_receber com valor <= 2 saneados.',
        )
      }
    } catch (errDel) {
      console.warn('Erro ao deletar contas_receber com valor <= 2:', errDel)
      throw errDel
    }
  },
  (_app) => {
    // Saneamento irreversível de dados corrompidos
  },
)
