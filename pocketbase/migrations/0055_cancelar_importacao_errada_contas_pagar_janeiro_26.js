/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Cancelamento da importação errada de Contas a Pagar (Aba: JANEIRO_26) realizada em 2026-09-23
    // 1. Identificar e apagar movimentos financeiros derivados desses títulos
    // 2. Apagar os títulos de contas_pagar criados hoje com marcação da Aba JANEIRO_26
    // 3. Manter todos os outros títulos e tabelas intactos

    try {
      // 1. Apagar movimentos financeiros vinculados aos títulos de contas_pagar desta importação
      const resMov = app
        .db()
        .newQuery(`
          DELETE FROM movimentos_financeiros
          WHERE (origem = 'ContaPagar' OR origem IS NULL OR origem = '')
            AND referencia_id IN (
              SELECT id FROM contas_pagar
              WHERE created >= '2026-09-23 00:00:00'
                AND observacoes LIKE '%[Aba: JANEIRO_26]%'
            )
        `)
        .execute()

      console.log(
        'Movimentos financeiros vinculados aos títulos cancelados foram apagados:',
        resMov,
      )
    } catch (e) {
      console.log('Erro ao apagar movimentos financeiros vinculados à importação errada:', e)
      throw e
    }

    try {
      // 2. Apagar os títulos de contas_pagar importados por engano hoje
      const resContas = app
        .db()
        .newQuery(`
          DELETE FROM contas_pagar
          WHERE created >= '2026-09-23 00:00:00'
            AND observacoes LIKE '%[Aba: JANEIRO_26]%'
        `)
        .execute()

      console.log(
        'Títulos da importação errada [Aba: JANEIRO_26] apagados com sucesso de contas_pagar:',
        resContas,
      )
    } catch (e) {
      console.log('Erro ao apagar títulos de contas_pagar:', e)
      throw e
    }
  },
  (_app) => {
    // Operação irreversível solicitada pelo usuário para desfazer importação errada
  },
)
