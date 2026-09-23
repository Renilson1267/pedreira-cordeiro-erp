/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // LIMPEZA TOTAL DE CONTAS A RECEBER A PEDIDO EXPLÍCITO DO USUÁRIO
    // "LIMPAR CONTAS A RECEBER" — zerar completamente a coleção de Contas a Receber
    // para reimportação limpa de planilha de recebimentos.
    //
    // Requisitos:
    // 1. Desvincular contas a receber de vendas (se houver vendas com conta_receber_id preenchido)
    // 2. Apagar movimentos financeiros gerados exclusivamente por contas a receber (origem = 'ContaReceber' ou referencia_id vinculado)
    // 3. Apagar créditos de clientes vinculados a contas a receber ou adiantamentos de recebimento
    // 4. Apagar TODOS os títulos da coleção contas_receber
    // 5. Preservar intactos: clientes, contas_pagar, fornecedores, vendas, entregas, frota, funcionários, produtos, plano de contas, centros de custo.

    // 1. Limpar vínculo em vendas (se houver) sem apagar nenhuma venda
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

    // 3. Apagar créditos de cliente decorrentes de contas a receber ou adiantamentos de recebimentos
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

    // 4. Apagar todos os registros da coleção contas_receber
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
