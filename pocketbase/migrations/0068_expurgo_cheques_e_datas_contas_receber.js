/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0068: Expurgar títulos corrompidos com número de cheque (800k-899k)
 * e datas compactas DDMMAA/DMMAA lidos indevidamente como valor financeiro.
 *
 * Contexto: A planilha de recebimentos possui colunas "VALOR DA COMPRA" e "Nº DO CHEQUE" lado a lado.
 * Nas importações anteriores, o parser varria a linha e lia o número do cheque ou a data compacta
 * de compensação em vez da coluna "VALOR DA COMPRA".
 *
 * Esta migração faz uma varredura geral em contas_receber (todas as abas e meses)
 * identificando registros com valores suspeitos:
 * 1) Faixa de cheques bancários: 800.000 a 899.999 (e >= 800.000 sem corroboração)
 * 2) Datas compactas DDMMAA (6 dígitos) e DMMAA (5 dígitos) no intervalo 40.000 a 311.228:
 *    Exemplos reais encontrados: 70226, 80126, 200126, 131125, 120226, 250226
 * 3) Valores anômalos >= 100.000 inteiros sem corroboração de venda documentada
 *
 * Preserva:
 * - 226943.38 (valor decimal documentado com centavos)
 * - 578000, 150000, 85000 (vendas legítimas documentadas em observações, ex: "VENDA DO BRITADOR", "PAGAMENTO MAIO/...")
 *
 * Apaga:
 * - Movimentos financeiros vinculados (referencia_id = conta.id)
 * - Créditos clientes vinculados (referencia_conta_id = conta.id)
 * - Desvincula vendas (venda_id se houver)
 * - Conta corrompida em contas_receber
 */

migrate((app) => {
  const logPrefix = '[migracao_0068_expurgo_cheques_receber]'

  // Função auxiliar para verificar padrão DDMMAA/DMMAA de data compacta
  function isDataCompactaCheque(num) {
    if (typeof num !== 'number' || isNaN(num)) return false
    const isInt = Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.001
    if (!isInt) return false

    const intVal = Math.round(num)
    if (intVal < 40000 || intVal > 311228) return false

    const s = String(intVal)
    // 6 dígitos: DDMMAA (DD 01..31, MM 01..12, AA 24..28)
    if (s.length === 6) {
      const d = parseInt(s.slice(0, 2), 10)
      const m = parseInt(s.slice(2, 4), 10)
      const y = parseInt(s.slice(4, 6), 10)
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 24 && y <= 28) {
        return true
      }
    }
    // 5 dígitos: DMMAA (D 1..9, MM 01..12, AA 24..28)
    if (s.length === 5) {
      const d = parseInt(s.slice(0, 1), 10)
      const m = parseInt(s.slice(1, 3), 10)
      const y = parseInt(s.slice(3, 5), 10)
      if (d >= 1 && d <= 9 && m >= 1 && m <= 12 && y >= 24 && y <= 28) {
        return true
      }
    }

    return false
  }

  // Buscar todas as contas a receber
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

    // Identificar aba de origem a partir de observações
    let abaNome = 'Outros / Manual'
    const abaMatch = obs.match(/\[Aba:\s*([^\]]+)\]/i)
    if (abaMatch) {
      abaNome = abaMatch[1].trim()
    }

    // Exceções conhecidas e documentadas como legítimas:
    // 1) 226943.38 (tem centavos, valor de nota somada)
    // 2) 578000, 150000, 85000 (vendas de ativos/contratos explícitos na observação)
    if (Math.abs(val - 226943.38) < 0.01) continue
    if (val === 578000 || val === 150000 || val === 85000) {
      if (
        obs.includes('VENDA DO BRITADOR') ||
        obs.includes('PAGAMENTO MAIO') ||
        obs.includes('CONTRATO')
      ) {
        continue
      }
    }

    let ehSuspeito = false
    let motivo = ''

    // 1. Faixa de cheques bancários: 800.000 a 899.999
    if (val >= 800000 && val <= 899999) {
      ehSuspeito = true
      motivo = `Valor ${val} está na faixa de cheques bancários (800k–899k)`
    }
    // 2. Datas compactas DDMMAA / DMMAA (ex: 70226, 80126, 200126, 131125, 120226, 250226)
    else if (isDataCompactaCheque(val)) {
      ehSuspeito = true
      motivo = `Valor ${val} representa data compacta de compensação DDMMAA/DMMAA`
    }
    // 3. Valores >= 100.000 inteiros sem centavos e sem observação legítima
    else if (val >= 100000 && Number.isInteger(val)) {
      ehSuspeito = true
      motivo = `Valor ${val} >= 100.000 inteiro não corroborado`
    }

    if (!ehSuspeito) continue

    const contaId = c.id
    console.log(
      `${logPrefix} Expurgando registro corrompido: ID=${contaId}, Aba=${abaNome}, Valor=${val}, Motivo=${motivo}, Obs=${obs}`,
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
