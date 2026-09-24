/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0064: Limpeza de títulos duplicados e registros órfãos na aba JANEIRO_26
    //
    // Contexto:
    // O importador anterior criava um novo registro "Recebida" em vez de atualizar o registro "Aberta" existente.
    // Isso gerou pares gêmeos (mesma empresa, mesmo cliente_id, mesmo valor, mesma aba JANEIRO_26),
    // onde um registro está com status "Recebida" (com dados corretos de quitação e Pix) e o outro
    // ficou com status "Aberta" órfão (com data herdada 2026-01-01).
    //
    // Regra da Tarefa:
    // 1. Para cada par/grupo de registros gêmeos (mesma empresa, mesmo cliente_id, mesmo valor, mesma aba JANEIRO_26)
    //    onde existe um "Recebida" e um "Aberta", MANTER o "Recebida" e APAGAR o "Aberta" gêmeo.
    // 2. Além disso, apagar qualquer movimento financeiro ou crédito de cliente vinculado ao registro "Aberta" apagado.
    // 3. Garantir que registros legítimos únicos nunca sejam apagados.
    // 4. Manter os DOIS registros legítimos "Conta vencida" reais da planilha (status Aberta únicos).

    try {
      console.log('--- Iniciando Migração 0064: Limpeza de duplicatas gêmeas JANEIRO_26 ---')

      // 1. Buscar todas as contas da aba JANEIRO_26
      const contasJaneiro = app.findRecordsByFilter(
        'contas_receber',
        'observacoes ~ "JANEIRO_26"',
        'created',
        5000,
        0,
      )

      console.log(`Total de contas encontradas com JANEIRO_26: ${contasJaneiro.length}`)

      // Agrupar por empresa_id + cliente_id + valorStr
      const grupos = new Map()

      for (let i = 0; i < contasJaneiro.length; i++) {
        const c = contasJaneiro[i]
        const empresaId = c.getString('empresa_id') || ''
        const clienteId = c.getString('cliente_id') || ''
        const valorNum = Number(c.get('valor') || 0)
        const valorStr = valorNum.toFixed(2)

        if (!clienteId || valorNum <= 0) continue

        const chaveGrupo = `${empresaId}___${clienteId}___${valorStr}`
        if (!grupos.has(chaveGrupo)) {
          grupos.set(chaveGrupo, [])
        }
        grupos.get(chaveGrupo).push(c)
      }

      const idsParaApagar = []
      let paresGemeosResolvidos = 0

      // Para cada grupo, verificar se há pelo menos um 'Recebida' e pelo menos um 'Aberta'
      grupos.forEach((itens, chave) => {
        if (itens.length < 2) return

        const recebidas = itens.filter((it) => it.getString('status') === 'Recebida')
        const abertas = itens.filter((it) => it.getString('status') === 'Aberta')

        if (recebidas.length > 0 && abertas.length > 0) {
          // Confirmado par gêmeo gerado por reimportação/falha de reconciliação
          // Manter o registro Recebida (dados corretos de pagamento)
          // e marcar o(s) registro(s) Aberta gêmeo(s) para exclusão
          for (let ab of abertas) {
            idsParaApagar.push(ab.id)
          }
          paresGemeosResolvidos++
          console.log(
            `Par gêmeo identificado para grupo ${chave}: ${recebidas.length} Recebida(s), ${abertas.length} Aberta(s) removida(s).`,
          )
        }
      })

      console.log(
        `Total de grupos gêmeos identificados: ${paresGemeosResolvidos}. Total de registros Aberta órfãos a remover: ${idsParaApagar.length}`,
      )

      if (idsParaApagar.length > 0) {
        // Remover movimentos financeiros e créditos vinculados aos IDs que serão apagados
        for (let id of idsParaApagar) {
          try {
            const movs = app.findRecordsByFilter(
              'movimentos_financeiros',
              `referencia_id = "${id}"`,
              'created',
              50,
              0,
            )
            for (let m of movs) {
              app.delete(m)
            }
          } catch (eMov) {
            console.warn(`Aviso ao remover movimentos financeiros da conta ${id}:`, eMov)
          }

          try {
            const creds = app.findRecordsByFilter(
              'creditos_clientes',
              `referencia_conta_id = "${id}"`,
              'created',
              50,
              0,
            )
            for (let cr of creds) {
              app.delete(cr)
            }
          } catch (eCred) {
            console.warn(`Aviso ao remover créditos vinculados à conta ${id}:`, eCred)
          }

          try {
            if (app.hasTable('vendas')) {
              app
                .db()
                .newQuery(
                  `UPDATE vendas SET conta_receber_id = "" WHERE conta_receber_id = "${id}"`,
                )
                .execute()
            }
          } catch (eVenda) {
            console.warn(`Aviso ao desvincular vendas da conta ${id}:`, eVenda)
          }

          // Deletar o registro de contas_receber Aberta órfão
          const recordToDelete = app.findRecordById('contas_receber', id)
          if (recordToDelete) {
            app.delete(recordToDelete)
          }
        }
      }

      // Verificação pós-limpeza: contagem de títulos Aberta restantes na aba JANEIRO_26
      const abertasRestantes = app.findRecordsByFilter(
        'contas_receber',
        'observacoes ~ "JANEIRO_26" && status = "Aberta"',
        'created',
        100,
        0,
      )

      console.log(
        `--- Migração 0064 concluída com sucesso. Títulos Aberta restantes em JANEIRO_26: ${abertasRestantes.length} ---`,
      )
      for (let r of abertasRestantes) {
        console.log(
          `Título Aberta restante: id=${r.id}, cliente_id=${r.getString('cliente_id')}, valor=${r.get('valor')}, vencimento=${r.getString('vencimento')}`,
        )
      }
    } catch (err) {
      console.error('Erro na migração 0064_limpeza_duplicatas_gemeas_janeiro_26:', err)
      throw err
    }
  },
  (_app) => {
    // Saneamento irreversível de duplicatas de importação
  },
)
