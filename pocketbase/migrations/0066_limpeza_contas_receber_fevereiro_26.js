/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Limpeza de registros corrompidos e duplicatas na coleção contas_receber gerados
    // na importação da aba FEVEREIRO_26 em 2026-09-24 (entre ~12:11 e ~12:18Z).
    //
    // Problemas tratados:
    // 1) Valores absurdos lidos de cheques (850xxx, 851xxx, 855xxx) ou datas compactas (120226, 250226)
    //    ou outros valores numéricos anômalos >= 100.000 da rodada FEVEREIRO_26.
    // 2) Duplicatas gêmeas da aba FEVEREIRO_26 gravadas em duplicidade com a mesma nota e mesmo cliente.

    const idsParaRemover = new Set()

    // 1. Títulos corrompidos com valor >= 100000 da aba FEVEREIRO_26
    try {
      const corrompidosQuery = app.db().newQuery(`
      SELECT id, nota, valor, status, observacoes
      FROM contas_receber
      WHERE observacoes LIKE '%FEVEREIRO_26%'
        AND valor >= 100000
    `)
      const corrompidos = corrompidosQuery.all()
      for (const c of corrompidos) {
        idsParaRemover.add(c.id)
      }
    } catch (err) {
      console.log(
        '[0066_limpeza_contas_receber_fevereiro_26] Aviso ao buscar corrompidos >= 100k:',
        err,
      )
    }

    // 2. Duplicatas gêmeas da aba FEVEREIRO_26
    // Agrupar por nota e cliente_id quando houver mais de 1 registro legítimo na aba FEVEREIRO_26
    try {
      const dupesQuery = app.db().newQuery(`
      SELECT id, nota, cliente_id, valor, vencimento, created
      FROM contas_receber
      WHERE observacoes LIKE '%FEVEREIRO_26%'
        AND nota IS NOT NULL
        AND nota != ''
      ORDER BY nota ASC, cliente_id ASC, created ASC
    `)
      const rows = dupesQuery.all()
      const grupos = new Map()

      for (const r of rows) {
        if (idsParaRemover.has(r.id)) continue
        const key = `${(r.cliente_id || '').trim()}|||${(r.nota || '').trim()}`
        if (!grupos.has(key)) {
          grupos.set(key, [])
        }
        grupos.get(key).push(r)
      }

      // Para cada grupo com mais de 1 registro com a mesma nota e cliente,
      // manter o primeiro (ou o com melhor dados) e marcar os excedentes para remoção
      for (const [key, lista] of grupos.entries()) {
        if (lista.length > 1) {
          // Manter o mais recente ou o primeiro criado, removendo os excedentes
          for (let i = 1; i < lista.length; i++) {
            idsParaRemover.add(lista[i].id)
          }
        }
      }
    } catch (err) {
      console.log('[0066_limpeza_contas_receber_fevereiro_26] Aviso ao buscar duplicatas:', err)
    }

    const idsList = Array.from(idsParaRemover)
    console.log(
      `[0066_limpeza_contas_receber_fevereiro_26] Total de IDs a remover: ${idsList.length}`,
    )

    let removidosCount = 0
    let movRemovidos = 0
    let credRemovidos = 0

    for (const id of idsList) {
      try {
        // 1. Remover movimentos financeiros vinculados
        try {
          const movs = app.findRecordsByFilter(
            'movimentos_financeiros',
            `referencia_id = {:refId}`,
            '',
            50,
            0,
            { refId: id },
          )
          for (const mov of movs) {
            app.delete(mov)
            movRemovidos++
          }
        } catch (e) {
          // Ignorar se não existir
        }

        // 2. Remover créditos de clientes vinculados
        try {
          const creds = app.findRecordsByFilter(
            'creditos_clientes',
            `referencia_conta_id = {:refId}`,
            '',
            50,
            0,
            { refId: id },
          )
          for (const cred of creds) {
            app.delete(cred)
            credRemovidos++
          }
        } catch (e) {
          // Ignorar se não existir
        }

        // 3. Remover o registro de contas_receber
        const rec = app.findRecordById('contas_receber', id)
        if (rec) {
          app.delete(rec)
          removidosCount++
        }
      } catch (err) {
        console.log(`[0066_limpeza_contas_receber_fevereiro_26] Falha ao remover conta ${id}:`, err)
      }
    }

    console.log(
      `[0066_limpeza_contas_receber_fevereiro_26] Concluído: ${removidosCount} contas removidas, ${movRemovidos} movimentos removidos, ${credRemovidos} créditos removidos.`,
    )
  },
  (app) => {
    // Rollback não aplicável para limpeza de dados corrompidos
  },
)
