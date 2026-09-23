migrate(
  (app) => {
    // PARTE 1: Zerar Contas a Receber a pedido explícito do usuário
    // "PRIMEIRO ZERAR CONTAS A RECEBER E DEPOIS BAIXAR EM CONTA A RECEBER ESSA PLANILHA"
    //
    // Remove:
    // 1. Movimentos financeiros vinculados a Contas a Receber (origem = 'ContaReceber')
    // 2. Créditos de clientes gerados por recebimento antecipado ou vinculados a contas a receber
    // 3. Todos os registros da collection contas_receber
    //
    // Preserva integralmente:
    // Clientes, fornecedores, contas_pagar, produtos, plano_contas, bancos_contas, etc.

    // 1. Apagar movimentos financeiros gerados exclusivamente por contas a receber
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
           OR referencia_id IN (SELECT id FROM contas_receber)
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de ContaReceber:', e)
    }

    // 2. Apagar créditos de clientes ligados exclusivamente a contas a receber
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (SELECT id FROM contas_receber)
           OR origem LIKE 'Recebimento Antecipado%'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar creditos_clientes vinculados a contas_receber:', e)
    }

    // 3. Apagar todos os registros de contas_receber
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar contas_receber:', e)
    }
  },
  (_app) => {
    // Operação de deleção intencional não reversível por down
  },
)
