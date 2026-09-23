/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Apagar TODOS os títulos de contas a receber e dados derivados (movimentos financeiros e créditos de cliente)
    // conforme solicitado pelo usuário: "considerar vencidas, abertas, proximo de vencer como aberta nas planilha recebimento e apagar".
    // Preserva integralmente: contas_pagar, clientes, fornecedores, frota, produtos, plano de contas, centros de custo, funcionários, vendas e entregas.

    // 1. Apagar movimentos financeiros gerados exclusivamente por contas a receber
    try {
      const resMov = app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
           OR referencia_id IN (SELECT id FROM contas_receber)
      `)
        .execute()
      console.log('Movimentos financeiros de ContaReceber apagados com sucesso:', resMov)
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de ContaReceber:', e)
      throw e
    }

    // 2. Apagar créditos de clientes vinculados exclusivamente a contas a receber
    try {
      const resCred = app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (SELECT id FROM contas_receber)
           OR origem LIKE 'Recebimento Antecipado%'
      `)
        .execute()
      console.log('Créditos clientes de ContaReceber apagados com sucesso:', resCred)
    } catch (e) {
      console.log('Erro ao limpar creditos_clientes vinculados a contas_receber:', e)
      throw e
    }

    // 3. Apagar todos os registros de contas_receber
    try {
      const resContas = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
      `)
        .execute()
      console.log('Todos os registros de contas_receber foram apagados com sucesso:', resContas)
    } catch (e) {
      console.log('Erro ao limpar contas_receber:', e)
      throw e
    }
  },
  (_app) => {
    // Operação de deleção permanente intencional solicitada pelo usuário (não reversível via down)
  },
)
