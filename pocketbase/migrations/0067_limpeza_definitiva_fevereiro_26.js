/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0067: Limpeza definitiva de registros anômalos (>= 100.000) e duplicatas de FEVEREIRO_26
    // ERP Pedreira Cordeiro v0.0.86
    console.log('--- Iniciando Migração 0067: Limpeza Contas a Receber Fevereiro 2026 ---')

    // 19 IDs conhecidos auditados com anomalias de importação da aba FEVEREIRO_26
    const idsAlvoConhecidos = [
      'j2rty0uxe1vzlp0', // 855770 (cheque)
      'b36k0grcvwxlcd8', // 851854 (cheque)
      'kcpijnt4cn1qn3w', // 851167 (cheque)
      '9odxx9u8e6jbh5q', // 850642 (cheque)
      'czna41l9k9g7j7i', // 850266 (cheque)
      'imu69ki2kescg9n', // 850255 (cheque)
      't6niozoxcixipla', // 850253 (cheque)
      'ued6oxce4kve7ox', // 850252 (cheque)
      'jwlyjufdm7k2ue7', // 850251 (cheque)
      '10jukqwk7948tqf', // 850097 (cheque)
      '7p33j63o9b81c5t', // 850092 (cheque)
      'ctoihae4uqjw1kn', // 850057 (cheque)
      'fxtsm4w06zzfols', // 377014 (anomalia)
      'sjbg0tbwmjg5d2f', // 250226 (data compacta 25/02/26)
      'cj1fy7yfbhz70tf', // 250226 (data compacta 25/02/26)
      '4xvrwyjnwdgldil', // 120226 (data compacta 12/02/26)
      'jyzi9s8voos7wv6', // 120226 (data compacta 12/02/26)
      '6ul77hnas5xti9y', // 113970 (anomalia)
      'i04n603xifor80z', // 100000 (anomalia)
    ]

    const idsParaRemoverSet = new Set()

    // 1. Adicionar IDs conhecidos auditados
    for (const id of idsAlvoConhecidos) {
      idsParaRemoverSet.add(id)
    }

    // 2. Varredura via app.findRecordsByFilter (PocketBase SDK)
    try {
      const recordsFev = app.findRecordsByFilter(
        'contas_receber',
        'observacoes ~ "FEVEREIRO_26"',
        'created',
        5000,
        0,
      )
      console.log(`[0067] Total de contas encontradas com FEVEREIRO_26: ${recordsFev.length}`)

      for (let i = 0; i < recordsFev.length; i++) {
        const rec = recordsFev[i]
        const val = Number(rec.get('valor') || 0)
        if (val >= 100000) {
          idsParaRemoverSet.add(rec.id)
        }
      }
    } catch (errFev) {
      console.warn('[0067] Erro ao buscar contas FEVEREIRO_26 via SDK:', errFev)
    }

    // 3. Varredura direta via SQLite Query em contas_receber com valor >= 100000 e FEVEREIRO_26
    try {
      const sqlRows = app
        .db()
        .newQuery(
          "SELECT id, valor, nota FROM contas_receber WHERE observacoes LIKE '%FEVEREIRO_26%' AND CAST(valor AS REAL) >= 100000",
        )
        .all()
      for (const row of sqlRows) {
        idsParaRemoverSet.add(row.id)
      }
    } catch (errSql) {
      console.warn('[0067] Erro ao buscar contas via raw SQL:', errSql)
    }

    const idsParaRemover = Array.from(idsParaRemoverSet)
    console.log(
      `[0067] DUMP: Total de registros de contas_receber encontrados para remoção: ${idsParaRemover.length}`,
    )

    if (idsParaRemover.length > 0) {
      // Remover movimentos financeiros vinculados aos IDs
      for (const id of idsParaRemover) {
        try {
          if (app.hasTable('movimentos_financeiros')) {
            app
              .db()
              .newQuery('DELETE FROM movimentos_financeiros WHERE referencia_id = {:id}')
              .bind({ id: id })
              .execute()
          }
        } catch (errMov) {
          console.warn(`[0067] Aviso ao apagar movimentos do id ${id}:`, errMov)
        }

        try {
          if (app.hasTable('creditos_clientes')) {
            app
              .db()
              .newQuery('DELETE FROM creditos_clientes WHERE referencia_conta_id = {:id}')
              .bind({ id: id })
              .execute()
          }
        } catch (errCred) {
          console.warn(`[0067] Aviso ao apagar creditos do id ${id}:`, errCred)
        }

        try {
          if (app.hasTable('vendas')) {
            app
              .db()
              .newQuery('UPDATE vendas SET conta_receber_id = "" WHERE conta_receber_id = {:id}')
              .bind({ id: id })
              .execute()
          }
        } catch (errVenda) {
          console.warn(`[0067] Aviso ao desvincular vendas do id ${id}:`, errVenda)
        }

        try {
          app
            .db()
            .newQuery('DELETE FROM contas_receber WHERE id = {:id}')
            .bind({ id: id })
            .execute()
        } catch (errDel) {
          console.warn(`[0067] Aviso ao deletar conta_receber id ${id}:`, errDel)
        }
      }
    }

    // 4. Verificação de integridade pós-remoção
    let countRestantesSQL = 0
    try {
      const restRows = app
        .db()
        .newQuery(
          "SELECT count(id) AS total FROM contas_receber WHERE observacoes LIKE '%FEVEREIRO_26%' AND CAST(valor AS REAL) >= 100000",
        )
        .all()
      if (restRows.length > 0 && restRows[0].total !== undefined) {
        countRestantesSQL = Number(restRows[0].total)
      }
    } catch (_e) {}

    console.log(
      `[0067] Migração 0067 finalizada. Contas FEVEREIRO_26 com valor >= 100000 restantes: ${countRestantesSQL}`,
    )
  },
  (_app) => {
    // Saneamento irreversível de dados corrompidos
  },
)
