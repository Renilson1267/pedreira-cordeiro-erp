/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // LIMPEZA TOTAL DE CONTAS A RECEBER A PEDIDO EXPLÍCITO DO USUÁRIO
    // "DEU ERRADO, VAMOS TENTAR OUTRA VEZ, APAGAR TODOS OS DADOS DE RECEBER"
    // Zerar completamente a coleção de Contas a Receber do ERP, mantendo todo o resto intacto.
    //
    // 1. DESVINCULA vendas: limpa o campo conta_receber_id em vendas que apontam para contas a receber (preservando as vendas).
    // 2. APAGA movimentos financeiros derivados: coleção movimentos_financeiros onde origem = 'ContaReceber' OU referencia_id aponta para registros de contas_receber.
    // 3. APAGA créditos de clientes ligados a contas a receber/adiantamentos: coleção creditos_clientes onde referencia_conta_id IN (SELECT id FROM contas_receber) OU origem LIKE 'Recebimento Antecipado%'.
    // 4. APAGA todos os registros de contas_receber (DELETE completo).
    // 5. NÃO TOCAR em: clientes, fornecedores, contas_pagar, vendas, entregas, veículos/frota, funcionários, produtos, plano_contas, centros_custos.

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
             OR referencia_id IN (SELECT id FROM contas_receber)
        `)
          .execute()
        console.log('Movimentos financeiros derivados de contas_receber apagados:', resMov)
      }
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de contas_receber:', e)
      throw e
    }

    // 3. Apagar créditos de clientes ligados a contas a receber ou adiantamentos
    try {
      if (app.hasTable('creditos_clientes')) {
        const resCred = app
          .db()
          .newQuery(`
          DELETE FROM creditos_clientes
          WHERE referencia_conta_id IN (SELECT id FROM contas_receber)
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
    // Operação permanente de limpeza intencional solicitada pelo usuário para recomeçar do zero
  },
)
