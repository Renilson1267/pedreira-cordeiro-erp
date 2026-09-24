/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0061: ZERAR completamente a coleção de Contas a Receber (v77 -> v78)
    // Solicitação do usuário para recomeçar importação após ajuste dos classificadores de status.
    //
    // Requisitos:
    // 1. Desvincular vendas que apontam para esses títulos (conta_receber_id = '' em vendas) — vendas preservadas intactas.
    // 2. Apagar movimentos financeiros decorrentes de contas a receber (origem = 'ContaReceber' ou referencia_id aponta para contas_receber).
    // 3. Apagar créditos de clientes ligados a contas a receber ou adiantamentos de recebimento.
    // 4. Apagar todos os registros da coleção contas_receber.
    // 5. Preservar intactos: clientes, fornecedores, contas_pagar, movimentos de caixa de contas a pagar, vendas, entregas, frota, funcionários, produtos, plano de contas, centros de custo.

    // 1. Limpar vínculo em vendas (preservando todas as vendas)
    try {
      if (app.hasTable('vendas')) {
        const resVendas = app
          .db()
          .newQuery(`
          UPDATE vendas
          SET conta_receber_id = ''
          WHERE conta_receber_id IS NOT NULL AND conta_receber_id != ''
        `)
          .execute()
        console.log('Vendas desvinculadas de contas_receber:', resVendas)
      }
    } catch (e) {
      console.log('Aviso ao desvincular contas_receber de vendas:', e)
    }

    // 2. Apagar movimentos financeiros derivados de contas a receber
    try {
      if (app.hasTable('movimentos_financeiros')) {
        const resMov = app
          .db()
          .newQuery(`
          DELETE FROM movimentos_financeiros
          WHERE origem = 'ContaReceber'
             OR (referencia_id IS NOT NULL AND referencia_id != '' AND referencia_id IN (SELECT id FROM contas_receber))
        `)
          .execute()
        console.log('Movimentos financeiros derivados de contas_receber apagados:', resMov)
      }
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de contas_receber:', e)
      throw e
    }

    // 3. Apagar créditos de clientes ligados a contas a receber ou adiantamentos de recebimento
    try {
      if (app.hasTable('creditos_clientes')) {
        const resCred = app
          .db()
          .newQuery(`
          DELETE FROM creditos_clientes
          WHERE (referencia_conta_id IS NOT NULL AND referencia_conta_id != '' AND referencia_conta_id IN (SELECT id FROM contas_receber))
             OR origem LIKE 'Recebimento Antecipado%'
        `)
          .execute()
        console.log('Créditos de clientes derivados de contas_receber apagados:', resCred)
      }
    } catch (e) {
      console.log('Erro ao limpar creditos_clientes de contas_receber:', e)
      throw e
    }

    // 4. Apagar todos os registros da coleção contas_receber
    try {
      if (app.hasTable('contas_receber')) {
        const resContas = app
          .db()
          .newQuery(`
          DELETE FROM contas_receber
        `)
          .execute()
        console.log('Todos os registros de contas_receber foram apagados com sucesso:', resContas)
      }
    } catch (e) {
      console.log('Erro ao limpar contas_receber:', e)
      throw e
    }
  },
  (_app) => {
    // Operação permanente de limpeza solicitada intencionalmente pelo usuário para reimportação limpa
  },
)
