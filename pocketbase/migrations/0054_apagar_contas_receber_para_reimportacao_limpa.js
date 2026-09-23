/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // PENDÊNCIA 2: Apagar TODOS os títulos atuais de Contas a Receber para reimportação limpa
    // Requisitos:
    // - Apagar todos os registros da coleção "contas_receber".
    // - Apagar também os movimentos de caixa derivados desses títulos (movimentos_financeiros onde origem = 'ContaReceber' ou referencia_id vinculado a contas_receber).
    // - Apagar créditos de clientes decorrentes de contas a receber ou recebimento antecipado (preservando outros).
    // - NÃO apagar: clientes, contas a pagar, fornecedores, vendas, entregas, frota, funcionários, produtos, plano de contas, centros de custo.

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
      console.log('Movimentos financeiros derivados de contas_receber apagados:', resMov)
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de contas_receber:', e)
      throw e
    }

    // 2. Apagar créditos de cliente derivados exclusivamente de contas a receber ou adiantamentos de recebimento
    try {
      const resCred = app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (SELECT id FROM contas_receber)
           OR origem LIKE 'Recebimento Antecipado%'
      `)
        .execute()
      console.log('Créditos clientes derivados de contas_receber apagados:', resCred)
    } catch (e) {
      console.log('Erro ao limpar creditos_clientes de contas_receber:', e)
      throw e
    }

    // 3. Apagar todos os registros da coleção contas_receber
    try {
      const resContas = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
      `)
        .execute()
      console.log(
        'Todos os títulos da coleção contas_receber foram apagados com sucesso:',
        resContas,
      )
    } catch (e) {
      console.log('Erro ao limpar contas_receber:', e)
      throw e
    }
  },
  (_app) => {
    // Operação permanente de limpeza intencional solicitada pelo usuário para reimportação limpa
  },
)
