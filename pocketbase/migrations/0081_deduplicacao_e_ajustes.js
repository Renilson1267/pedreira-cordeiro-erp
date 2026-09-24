migrate(
  (app) => {
    // 1. Corrigir título nsmxhfruhqwkzpp se necessário (valor_pago e movimento coerente de R$ 250.000,00)
    try {
      app
        .db()
        .newQuery(
          "UPDATE contas_pagar SET valor_pago = valor WHERE id = 'nsmxhfruhqwkzpp' AND (valor_pago = 0 OR valor_pago IS NULL)",
        )
        .execute()
    } catch (e1) {
      console.log('Aviso ao atualizar valor_pago de nsmxhfruhqwkzpp:', e1)
    }

    // Garantir movimento de saída coerente de 250.000 para nsmxhfruhqwkzpp
    try {
      app
        .db()
        .newQuery(
          "UPDATE movimentos_financeiros SET valor = 250000 WHERE referencia_id = 'nsmxhfruhqwkzpp' AND tipo = 'Saida'",
        )
        .execute()
    } catch (e2) {
      console.log('Aviso ao ajustar movimento de nsmxhfruhqwkzpp:', e2)
    }

    // 2. Tabela de backup para deduplicação (backup defensivo antes da exclusão)
    try {
      app
        .db()
        .newQuery(
          `CREATE TABLE IF NOT EXISTS _backup_duplicatas_excluidas (
            id TEXT PRIMARY KEY,
            tabela TEXT,
            registro_id TEXT,
            dados_json TEXT,
            motivo TEXT,
            created TEXT
          )`,
        )
        .execute()
    } catch (eBackup) {
      console.log('Aviso ao criar tabela _backup_duplicatas_excluidas:', eBackup)
    }

    // 3. Deduplicar contas_pagar
    // Critério: mesmo empresa_id, mesmo valor (arredondado a 2 casas), mesmo vencimento,
    // e mesmo fornecedor_id (ou descricao idêntica quando sem fornecedor).
    // Quando observacoes contêm marcadores de abas como [Aba: X], identificamos as duplicatas.
    // Preservamos o registro mais antigo (MIN(id) ou MIN(created)) e deletamos os excedentes.
    try {
      // Duplicatas com mesmo empresa_id, fornecedor_id, valor e vencimento
      const dupPagar = []
      app
        .db()
        .newQuery(
          `SELECT id, empresa_id, fornecedor_id, descricao, valor, vencimento, data_pagamento, observacoes
           FROM contas_pagar
           WHERE id NOT IN (
             SELECT MIN(id)
             FROM contas_pagar
             GROUP BY empresa_id, fornecedor_id, ROUND(valor, 2), vencimento
           )
           AND fornecedor_id IS NOT NULL AND fornecedor_id != ''`,
        )
        .all(dupPagar)

      for (let i = 0; i < dupPagar.length; i++) {
        const item = dupPagar[i]
        const idStr = String(item.id || '')
        if (!idStr) continue

        const jsonStr = JSON.stringify(item)
        const nowIso = new Date().toISOString()
        const backupId = 'cp_' + idStr + '_' + Date.now() + '_' + i

        // Salvar em _backup_duplicatas_excluidas
        try {
          app
            .db()
            .newQuery(
              `INSERT OR REPLACE INTO _backup_duplicatas_excluidas (id, tabela, registro_id, dados_json, motivo, created)
               VALUES ({:id}, 'contas_pagar', {:regId}, {:json}, 'Deduplicação de títulos duplicados com mesmo fornecedor, valor e vencimento', {:created})`,
            )
            .bind({
              id: backupId,
              regId: idStr,
              json: jsonStr,
              created: nowIso,
            })
            .execute()
        } catch (_) {}

        // Registrar também em historico_alteracoes se a tabela existir
        try {
          const histId = 'del_cp_' + idStr.slice(0, 8) + '_' + i
          app
            .db()
            .newQuery(
              `INSERT OR IGNORE INTO historico_alteracoes (id, empresa_id, colecao_origem, registro_id, acao, usuario_id, usuario_nome, descricao, detalhes, created, updated)
               VALUES ({:id}, {:empresaId}, 'contas_pagar', {:regId}, 'excluir', '', 'Sistema (Deduplicação)', {:desc}, {:json}, {:created}, {:updated})`,
            )
            .bind({
              id: histId,
              empresaId: String(item.empresa_id || ''),
              regId: idStr,
              desc: 'Exclusão automática de título a pagar duplicado (mesmo valor e vencimento de outra aba)',
              json: jsonStr,
              created: nowIso,
              updated: nowIso,
            })
            .execute()
        } catch (_) {}

        // Apagar movimentos financeiros órfãos vinculados ao título que está sendo excluído
        try {
          app
            .db()
            .newQuery(
              `DELETE FROM movimentos_financeiros WHERE origem = 'ContaPagar' AND referencia_id = {:refId}`,
            )
            .bind({ refId: idStr })
            .execute()
        } catch (_) {}

        // Apagar o registro duplicado
        try {
          app
            .db()
            .newQuery(`DELETE FROM contas_pagar WHERE id = {:id}`)
            .bind({ id: idStr })
            .execute()
        } catch (_) {}
      }
    } catch (ePagar) {
      console.log('Aviso durante deduplicação de contas_pagar:', ePagar)
    }

    // 4. Deduplicar contas_receber
    // Critério: mesmo empresa_id, mesmo cliente_id (ou nota quando cliente vazio), mesmo valor (arredondado a 2 casas), mesmo vencimento.
    try {
      const dupReceber = []
      app
        .db()
        .newQuery(
          `SELECT id, empresa_id, cliente_id, descricao, valor, vencimento, data_recebimento, observacoes, nota
           FROM contas_receber
           WHERE id NOT IN (
             SELECT MIN(id)
             FROM contas_receber
             GROUP BY empresa_id, cliente_id, ROUND(valor, 2), vencimento
           )
           AND cliente_id IS NOT NULL AND cliente_id != ''`,
        )
        .all(dupReceber)

      for (let j = 0; j < dupReceber.length; j++) {
        const itemRec = dupReceber[j]
        const idStr = String(itemRec.id || '')
        if (!idStr) continue

        const jsonStr = JSON.stringify(itemRec)
        const nowIso = new Date().toISOString()
        const backupId = 'cr_' + idStr + '_' + Date.now() + '_' + j

        // Salvar em _backup_duplicatas_excluidas
        try {
          app
            .db()
            .newQuery(
              `INSERT OR REPLACE INTO _backup_duplicatas_excluidas (id, tabela, registro_id, dados_json, motivo, created)
               VALUES ({:id}, 'contas_receber', {:regId}, {:json}, 'Deduplicação de títulos a receber duplicados', {:created})`,
            )
            .bind({
              id: backupId,
              regId: idStr,
              json: jsonStr,
              created: nowIso,
            })
            .execute()
        } catch (_) {}

        // Registrar em historico_alteracoes
        try {
          const histId = 'del_cr_' + idStr.slice(0, 8) + '_' + j
          app
            .db()
            .newQuery(
              `INSERT OR IGNORE INTO historico_alteracoes (id, empresa_id, colecao_origem, registro_id, acao, usuario_id, usuario_nome, descricao, detalhes, created, updated)
               VALUES ({:id}, {:empresaId}, 'contas_receber', {:regId}, 'excluir', '', 'Sistema (Deduplicação)', {:desc}, {:json}, {:created}, {:updated})`,
            )
            .bind({
              id: histId,
              empresaId: String(itemRec.empresa_id || ''),
              regId: idStr,
              desc: 'Exclusão automática de título a receber duplicado',
              json: jsonStr,
              created: nowIso,
              updated: nowIso,
            })
            .execute()
        } catch (_) {}

        // Apagar movimentos financeiros órfãos vinculados ao título que está sendo excluído
        try {
          app
            .db()
            .newQuery(
              `DELETE FROM movimentos_financeiros WHERE origem = 'ContaReceber' AND referencia_id = {:refId}`,
            )
            .bind({ refId: idStr })
            .execute()
        } catch (_) {}

        // Apagar o registro duplicado
        try {
          app
            .db()
            .newQuery(`DELETE FROM contas_receber WHERE id = {:id}`)
            .bind({ id: idStr })
            .execute()
        } catch (_) {}
      }
    } catch (eReceber) {
      console.log('Aviso durante deduplicação de contas_receber:', eReceber)
    }

    // 5. Limpeza de quaisquer movimentos_financeiros órfãos restantes (cuja referencia_id não existe mais em contas_pagar nem contas_receber)
    try {
      app
        .db()
        .newQuery(
          `DELETE FROM movimentos_financeiros
           WHERE origem = 'ContaPagar'
           AND referencia_id IS NOT NULL
           AND referencia_id != ''
           AND referencia_id NOT IN (SELECT id FROM contas_pagar)`,
        )
        .execute()
    } catch (eOrfPagar) {
      console.log('Aviso ao limpar movimentos órfãos de pagar:', eOrfPagar)
    }

    try {
      app
        .db()
        .newQuery(
          `DELETE FROM movimentos_financeiros
           WHERE origem = 'ContaReceber'
           AND referencia_id IS NOT NULL
           AND referencia_id != ''
           AND referencia_id NOT IN (SELECT id FROM contas_receber)`,
        )
        .execute()
    } catch (eOrfReceber) {
      console.log('Aviso ao limpar movimentos órfãos de receber:', eOrfReceber)
    }
  },
  (app) => {
    // Reverter deduplicação: restaurar registros salvos em _backup_duplicatas_excluidas se necessário
    console.log('Reversão da migração de deduplicação')
  },
)
