/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Corrigir registros em contas_receber que possuam data com ano absurdo (ex: 2095 ou fora de 2024-2028)
    // Preservando rigorosamente valores, cliente, notas, endereço e histórico
    try {
      const records = app.findRecordsByFilter(
        'contas_receber',
        "vencimento > '2028-12-31' || vencimento < '2024-01-01' || data_recebimento > '2028-12-31' || data_recebimento < '2024-01-01'",
        'created',
        500,
        0,
      )

      for (let r of records) {
        let modificado = false
        const venc = r.getString('vencimento')
        const rec = r.getString('data_recebimento')
        const obs = r.getString('observacoes')

        // Descobrir mês da aba pelo campo observacoes se disponível (ex: "Aba: ABRIL_26" -> 4)
        let mesCompetencia = 4 // Default abril se veio do relato
        let anoCompetencia = 2026
        if (obs) {
          const matchAba = obs.match(/Aba:\s*([A-Za-zçÇ_0-9]+)/i)
          if (matchAba) {
            const nomeAba = matchAba[1].toUpperCase()
            if (nomeAba.includes('JAN')) mesCompetencia = 1
            else if (nomeAba.includes('FEV')) mesCompetencia = 2
            else if (nomeAba.includes('MAR')) mesCompetencia = 3
            else if (nomeAba.includes('ABR')) mesCompetencia = 4
            else if (nomeAba.includes('MAI')) mesCompetencia = 5
            else if (nomeAba.includes('JUN')) mesCompetencia = 6
            else if (nomeAba.includes('JUL')) mesCompetencia = 7
            else if (nomeAba.includes('AGO')) mesCompetencia = 8
            else if (nomeAba.includes('SET')) mesCompetencia = 9
            else if (nomeAba.includes('OUT')) mesCompetencia = 10
            else if (nomeAba.includes('NOV')) mesCompetencia = 11
            else if (nomeAba.includes('DEZ')) mesCompetencia = 12

            const anoMatch = nomeAba.match(/20(\d{2})|_(\d{2})/)
            if (anoMatch) {
              const num = parseInt(anoMatch[1] || anoMatch[2], 10)
              if (num >= 24 && num <= 28) anoCompetencia = 2000 + num
            }
          }
        }

        // Se o vencimento estiver fora de 2024-2028
        if (venc) {
          const anoVenc = parseInt(venc.slice(0, 4), 10)
          if (isNaN(anoVenc) || anoVenc < 2024 || anoVenc > 2028) {
            // Se for dia 06 e mês 11 (ex: "2095-11-06"), mas a aba for ABRIL_26, ajustar para o bloco correto de abril (ex: 2026-04-07 ou dia 07/08 da competência)
            const dataCorrigida = `${anoCompetencia}-${String(mesCompetencia).padStart(2, '0')}-07 12:00:00.000Z`
            r.set('vencimento', dataCorrigida)
            modificado = true
          }
        }

        if (rec) {
          const anoRec = parseInt(rec.slice(0, 4), 10)
          if (isNaN(anoRec) || anoRec < 2024 || anoRec > 2028) {
            const dataCorrigida = `${anoCompetencia}-${String(mesCompetencia).padStart(2, '0')}-07 12:00:00.000Z`
            r.set('data_recebimento', dataCorrigida)
            modificado = true
          }
        }

        if (modificado) {
          r.set(
            'observacoes',
            (obs ? obs + ' | ' : '') +
              '[Data absurda 2095 saneada automaticamente para competência ' +
              mesCompetencia +
              '/' +
              anoCompetencia +
              ']',
          )
          app.save(r)
        }
      }
    } catch (err) {
      console.log('Erro na migracao 0045_sanear_datas_absurdas_contas_receber:', err)
    }
  },
  (app) => {
    // down
  },
)
