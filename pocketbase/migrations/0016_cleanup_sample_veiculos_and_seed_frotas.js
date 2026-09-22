migrate(
  (app) => {
    // Clean up old sample vehicles from 0010: CAM-01, CAM-02, ESC-01, CAR-01, PERF-01
    const oldCodigos = ['CAM-01', 'CAM-02', 'ESC-01', 'CAR-01', 'PERF-01']

    for (const cod of oldCodigos) {
      try {
        const records = app.findRecordsByFilter('veiculos', `codigo_interno = '${cod}'`, '', 10, 0)
        for (const rec of records) {
          // delete linked sample records
          app
            .db()
            .newQuery('DELETE FROM abastecimentos WHERE veiculo_id = {:id}')
            .bind({ id: rec.id })
            .execute()
          app
            .db()
            .newQuery('DELETE FROM manutencoes WHERE veiculo_id = {:id}')
            .bind({ id: rec.id })
            .execute()
          app.delete(rec)
        }
      } catch (e) {
        console.log('Cleanup error for ' + cod + ':', e)
      }
    }

    // Seed sample real abastecimentos and manutencoes for the real fleet so reports and dashboards have rich data!
    try {
      const empresas = app.findRecordsByFilter('empresas', '', '+created', 1, 0)
      if (empresas.length === 0) return
      const empresaId = empresas[0].id

      const fornecedores = app.findRecordsByFilter('fornecedores', '', '+created', 10, 0)
      const fornComb =
        fornecedores.find(
          (f) => f.nome.toLowerCase().includes('posto') || f.nome.toLowerCase().includes('combust'),
        ) || fornecedores[0]
      const fornOfic =
        fornecedores.find(
          (f) =>
            f.nome.toLowerCase().includes('oficina') || f.nome.toLowerCase().includes('trator'),
        ) || fornecedores[0]

      const vCbrEsc = app.findFirstRecordByData('veiculos', 'codigo_interno', 'CBR-ESC-01')
      const vEntCac = app.findFirstRecordByData('veiculos', 'codigo_interno', 'ENT-CAC-01')
      const vCncBet = app.findFirstRecordByData('veiculos', 'codigo_interno', 'CNC-BET-01')

      const abastCol = app.findCollectionByNameOrId('abastecimentos')

      // Abastecimento 1: CBR-ESC-01 (Horas)
      const ab1 = new Record(abastCol)
      ab1.set('empresa_id', empresaId)
      ab1.set('veiculo_id', vCbrEsc.id)
      ab1.set('data', '2026-09-08 09:30:00.000Z')
      ab1.set('combustivel', 'Diesel S10')
      ab1.set('litros', 450)
      ab1.set('preco_litro', 5.89)
      ab1.set('valor_total', 2650.5)
      ab1.set('medidor', 12450)
      ab1.set('horimetro', 12450)
      ab1.set('km_odometro', 0)
      ab1.set('medidor_anterior', 12415)
      ab1.set('distancia_percorrida', 35)
      ab1.set('consumo_medio', 12.85)
      ab1.set('consumo_l_h', 12.85)
      ab1.set('custo_por_unidade', 75.72)
      ab1.set('fornecedor_id', fornComb ? fornComb.id : null)
      ab1.set('motorista_operador', 'Marcos Vinicius (Operador CAT)')
      ab1.set('observacoes', 'Abastecimento comboio móvel na praça de lavra.')
      app.save(ab1)

      // Abastecimento 2: ENT-CAC-01 (Km)
      const ab2 = new Record(abastCol)
      ab2.set('empresa_id', empresaId)
      ab2.set('veiculo_id', vEntCac.id)
      ab2.set('data', '2026-09-12 14:15:00.000Z')
      ab2.set('combustivel', 'Diesel S10')
      ab2.set('litros', 320)
      ab2.set('preco_litro', 5.92)
      ab2.set('valor_total', 1894.4)
      ab2.set('medidor', 312000)
      ab2.set('km_odometro', 312000)
      ab2.set('horimetro', 11200)
      ab2.set('medidor_anterior', 311350)
      ab2.set('distancia_percorrida', 650)
      ab2.set('consumo_medio', 2.03)
      ab2.set('consumo_km_l', 2.03)
      ab2.set('custo_por_unidade', 2.91)
      ab2.set('fornecedor_id', fornComb ? fornComb.id : null)
      ab2.set('motorista_operador', 'Sebastião Antunes')
      ab2.set('observacoes', 'Entregas de brita para clientes em Patos e Sertânia.')
      app.save(ab2)

      // Manutenção preventiva: CNC-BET-01
      const manutCol = app.findCollectionByNameOrId('manutencoes')
      const m1 = new Record(manutCol)
      m1.set('empresa_id', empresaId)
      m1.set('veiculo_id', vCncBet.id)
      m1.set('tipo', 'preventiva')
      m1.set('descricao', 'Revisão dos 10.000 km e lubrificação do redutor do balão da betoneira.')
      m1.set('fornecedor_id', fornOfic ? fornOfic.id : null)
      m1.set('oficina_nome', 'Oficina Mecânica Pesada')
      m1.set('data', '2026-09-05 10:00:00.000Z')
      m1.set('medidor_no_momento', 14000)
      m1.set('km_no_momento', 14000)
      m1.set('horimetro_no_momento', 580)
      m1.set('custo', 2850.0)
      m1.set('proxima_revisao_data', '2026-11-05 00:00:00.000Z')
      m1.set('proxima_revisao_km', 24000)
      m1.set('proxima_revisao_horimetro', 950)
      m1.set('status', 'concluida')
      m1.set('observacoes', 'Troca de óleo do motor, filtro racor e graxa grafitada no balão.')
      app.save(m1)
    } catch (err) {
      console.log('Sample records seed note:', err)
    }
  },
  (app) => {
    // down logic
  },
)
