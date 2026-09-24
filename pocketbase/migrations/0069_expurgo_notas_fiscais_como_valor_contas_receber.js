/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0069: Expurgar títulos corrompidos em contas_receber com números de
 * nota fiscal (faixa 80.000–99.999 sem centavos) gravados indevidamente como valor monetário.
 *
 * Contexto: Na aba ABRIL_26 (e eventuais reimportações), quando a célula "VALOR DA COMPRA"
 * de uma linha estava vazia, o parser anterior caía em varredura e lia o número da nota fiscal
 * (faixa 95xxx–97xxx, inteiros sem centavos) como se fosse o valor do título.
 *
 * Esta migração:
 * - Varre contas_receber (todas as abas)
 * - Identifica registros cujo valor seja inteiro na faixa 80.000–99.999 e que corresponda
 *   a padrão de nota/documento (sem centavos, sem corroboração monetária explícita),
 *   criados por importação de planilha (observacoes contém 'Importado de planilha' ou 'Atualizado via reimportação').
 * - Preserva valores legítimos confirmados:
 *   - R$ 226.943,38 (tem centavos)
 *   - R$ 94.676,55 (tem centavos na aba MARÇO_26)
 *   - R$ 85.000 (venda do britador em JANEIRO_26 com corroboração explícita)
 *   - R$ 150.000 / R$ 578.000
 *   - Qualquer registro com centavos ou corroboração monetária explícita
 * - Remove em cascata movimentos_financeiros vinculados (referencia_id)
 * - Remove em cascata creditos_clientes vinculados (referencia_conta_id)
 * - Desvincula vendas antes de deletar cada registro
 * - Loga contagem de apagados por aba
 */

migrate((app) => {
  const logPrefix = '[migracao_0069_expurgo_notas_receber]'

  let todasContas = []
  try {
    todasContas = app.findRecordsByFilter('contas_receber', '1 = 1', '-created', 10000, 0)
  } catch (err) {
    console.log(`${logPrefix} Erro ao buscar contas_receber: ${err.message}`)
    return
  }

  console.log(`${logPrefix} Total de registros analisados em contas_receber: ${todasContas.length}`)

  let expurgadosCount = 0
  let movsApagadosCount = 0
  let creditosApagadosCount = 0
  const contagemPorAba = {}

  for (const c of todasContas) {
    const rawVal = c.get('valor')
    const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal || '0')
    const obs = String(c.get('observacoes') || '')

    // Apenas registros originados de planilha
    const veioDePlanilha =
      obs.includes('Importado de planilha') ||
      obs.includes('Atualizado via reimportação') ||
      obs.includes('[Aba:')

    if (!veioDePlanilha) continue

    // Identificar aba de origem a partir de observações
    let abaNome = 'Outros / Planilha'
    const abaMatch = obs.match(/\[Aba:\s*([^\]]+)\]/i)
    if (abaMatch) {
      abaNome = abaMatch[1].trim()
    }

    // Deve estar na faixa 80.000 a 99.999
    if (val < 80000 || val > 99999) continue

    // Se tiver centavos (ex: 94676.55 ou 226943.38), é valor monetário legítimo -> PRESERVAR
    const centavos = Math.round((Math.abs(val) - Math.floor(Math.abs(val))) * 100)
    if (centavos > 0) {
      console.log(
        `${logPrefix} [PRESERVADO - possui centavos]: ID=${c.id}, Aba=${abaNome}, Valor=${val}`,
      )
      continue
    }

    // Preservar valores legítimos confirmados:
    // - R$ 85.000 com VENDA DO BRITADOR ou CONTRATO
    if (val === 85000) {
      if (
        obs.includes('VENDA DO BRITADOR') ||
        obs.includes('PAGAMENTO MAIO') ||
        obs.includes('CONTRATO') ||
        obs.includes('BRITADOR')
      ) {
        console.log(
          `${logPrefix} [PRESERVADO - venda legítima corroborada]: ID=${c.id}, Aba=${abaNome}, Valor=85000`,
        )
        continue
      }
    }

    // Se a observação tiver corroboração explícita "R$" vinculada ao valor
    if (/R\$\s*8[0-9]{4}|R\$\s*9[0-9]{4}/i.test(obs)) {
      console.log(
        `${logPrefix} [PRESERVADO - corroboração R$ em observação]: ID=${c.id}, Aba=${abaNome}, Valor=${val}`,
      )
      continue
    }

    const contaId = c.id
    console.log(
      `${logPrefix} Expurgando registro corrompido: ID=${contaId}, Aba=${abaNome}, Valor=${val}, Obs=${obs}`,
    )

    // 1. Apagar movimentos_financeiros vinculados
    try {
      const movs = app.findRecordsByFilter(
        'movimentos_financeiros',
        `referencia_id = "${contaId}"`,
        '-created',
        100,
        0,
      )
      for (const m of movs) {
        try {
          app.delete(m)
          movsApagadosCount++
        } catch (mErr) {
          console.log(`${logPrefix} Erro ao deletar movimento ${m.id}: ${mErr.message}`)
        }
      }
    } catch (_) {}

    // 2. Apagar creditos_clientes vinculados se houver
    try {
      const creds = app.findRecordsByFilter(
        'creditos_clientes',
        `referencia_conta_id = "${contaId}"`,
        '-created',
        100,
        0,
      )
      for (const cr of creds) {
        try {
          app.delete(cr)
          creditosApagadosCount++
        } catch (crErr) {
          console.log(`${logPrefix} Erro ao deletar credito ${cr.id}: ${crErr.message}`)
        }
      }
    } catch (_) {}

    // 3. Desvincular venda se houver
    const vendaId = c.get('venda_id')
    if (vendaId) {
      try {
        const vRec = app.findRecordById('vendas', vendaId)
        if (vRec && vRec.get('conta_receber_id') === contaId) {
          vRec.set('conta_receber_id', '')
          app.save(vRec)
        }
      } catch (_) {}
    }

    // 4. Apagar o registro corrompido de contas_receber
    try {
      app.delete(c)
      expurgadosCount++
      contagemPorAba[abaNome] = (contagemPorAba[abaNome] || 0) + 1
    } catch (delErr) {
      console.log(`${logPrefix} Falha ao apagar conta ${contaId}: ${delErr.message}`)
    }
  }

  console.log(`${logPrefix} Concluído com sucesso!`)
  console.log(`${logPrefix} Total de títulos expurgados: ${expurgadosCount}`)
  console.log(`${logPrefix} Movimentos financeiros apagados: ${movsApagadosCount}`)
  console.log(`${logPrefix} Créditos de clientes apagados: ${creditosApagadosCount}`)
  console.log(`${logPrefix} Detalhamento por aba: ${JSON.stringify(contagemPorAba)}`)
})
