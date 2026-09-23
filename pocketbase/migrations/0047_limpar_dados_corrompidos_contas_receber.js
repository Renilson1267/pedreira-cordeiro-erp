/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1) Apagar registros em contas_receber de hoje com valor absurdo (> 50.000.000)
    // causados por leitura indevida de telefones / documentos como valor
    // Também limpa movimentos_financeiros e creditos_clientes eventualmente gerados para essas contas
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
          AND referencia_id IN (
            SELECT id FROM contas_receber
            WHERE valor > 50000000 AND created >= '2026-09-23 00:00:00.000Z'
          )
      `)
        .execute()

      app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (
          SELECT id FROM contas_receber
          WHERE valor > 50000000 AND created >= '2026-09-23 00:00:00.000Z'
        )
      `)
        .execute()

      const resValores = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
        WHERE valor > 50000000 AND created >= '2026-09-23 00:00:00.000Z'
      `)
        .execute()
      console.log('Limpeza contas_receber valor > 50M executada:', resValores)
    } catch (err) {
      console.log('Erro ao limpar contas_receber com valores absurdos:', err)
    }

    // 2) Apagar registros da aba Planilha7 criados hoje com cliente_id vazio ou vencimento/data_recebimento 2026-12-31
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE origem = 'ContaReceber'
          AND referencia_id IN (
            SELECT id FROM contas_receber
            WHERE observacoes LIKE '%Planilha7%'
              AND created >= '2026-09-23 00:00:00.000Z'
              AND (cliente_id = '' OR cliente_id IS NULL OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
          )
      `)
        .execute()

      app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE referencia_conta_id IN (
          SELECT id FROM contas_receber
          WHERE observacoes LIKE '%Planilha7%'
            AND created >= '2026-09-23 00:00:00.000Z'
            AND (cliente_id = '' OR cliente_id IS NULL OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
        )
      `)
        .execute()

      const resPlanilha7 = app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
        WHERE observacoes LIKE '%Planilha7%'
          AND created >= '2026-09-23 00:00:00.000Z'
          AND (cliente_id = '' OR cliente_id IS NULL OR vencimento LIKE '2026-12-31%' OR data_recebimento LIKE '2026-12-31%')
      `)
        .execute()
      console.log('Limpeza contas_receber Planilha7 lixo executada:', resPlanilha7)
    } catch (err) {
      console.log('Erro ao limpar lixo da Planilha7:', err)
    }
  },
  (app) => {
    // down (irreversível pois é deleção de dados corrompidos)
  },
)
