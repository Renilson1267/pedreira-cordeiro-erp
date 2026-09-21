migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const veiculosCol = app.findCollectionByNameOrId('veiculos')
    const abastecimentosCol = app.findCollectionByNameOrId('abastecimentos')
    const manutencoesCol = app.findCollectionByNameOrId('manutencoes')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const planoCol = app.findCollectionByNameOrId('plano_contas')
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    const movimentosCol = app.findCollectionByNameOrId('movimentos_financeiros')
    const bancosCol = app.findCollectionByNameOrId('bancos_contas')

    // 1. Obter a empresa principal
    let empresa
    try {
      empresa = app.findFirstRecordByData('empresas', 'cnpj', '00.000.000/0001-00')
    } catch (_) {
      const empresas = app.findRecordsByFilter('empresas', '', '', 1, 0)
      if (empresas.length > 0) empresa = empresas[0]
      else return
    }

    // 2. Conta bancária para movimentos gerados
    let contaPrincipal
    try {
      contaPrincipal = app.findFirstRecordByData('bancos_contas', 'empresa_id', empresa.id)
    } catch (_) {}

    // 3. Garantir categorias do Plano de Contas para Frotas se não existirem
    let catCombustivel
    try {
      catCombustivel = app.findFirstRecordByData('plano_contas', 'codigo', '2.2')
    } catch (_) {
      try {
        catCombustivel = new Record(planoCol)
        catCombustivel.set('empresa_id', empresa.id)
        catCombustivel.set('codigo', '2.2')
        catCombustivel.set('nome', 'Combustíveis e Lubrificantes - Frota')
        catCombustivel.set('tipo', 'Custo')
        catCombustivel.set('natureza', 'Debito')
        catCombustivel.set('ativa', true)
        app.save(catCombustivel)
      } catch (_) {}
    }

    let catManutencao
    try {
      catManutencao = app.findFirstRecordByData('plano_contas', 'codigo', '2.3')
    } catch (_) {
      try {
        catManutencao = new Record(planoCol)
        catManutencao.set('empresa_id', empresa.id)
        catManutencao.set('codigo', '2.3')
        catManutencao.set('nome', 'Manutenção de Máquinas e Caminhões')
        catManutencao.set('tipo', 'Custo')
        catManutencao.set('natureza', 'Debito')
        catManutencao.set('ativa', true)
        app.save(catManutencao)
      } catch (_) {}
    }

    // 4. Garantir fornecedores de pedreira (posto de diesel e oficina de máquinas pesadas)
    let fornecedorPosto
    try {
      fornecedorPosto = app.findFirstRecordByData(
        'fornecedores',
        'nome',
        'Posto & Distribuidora Rota 040',
      )
    } catch (_) {
      try {
        fornecedorPosto = new Record(fornecedoresCol)
        fornecedorPosto.set('empresa_id', empresa.id)
        fornecedorPosto.set('nome', 'Posto & Distribuidora Rota 040')
        fornecedorPosto.set('cnpj_cpf', '14.882.341/0001-90')
        fornecedorPosto.set('email', 'combustivel@rota040.com.br')
        fornecedorPosto.set('telefone', '(11) 4589-3300')
        fornecedorPosto.set('cidade', 'São Paulo')
        fornecedorPosto.set('uf', 'SP')
        app.save(fornecedorPosto)
      } catch (_) {}
    }

    let fornecedorOficina
    try {
      fornecedorOficina = app.findFirstRecordByData(
        'fornecedores',
        'nome',
        'TratorPeças & Mecânica Pesada Ltda',
      )
    } catch (_) {
      try {
        fornecedorOficina = new Record(fornecedoresCol)
        fornecedorOficina.set('empresa_id', empresa.id)
        fornecedorOficina.set('nome', 'TratorPeças & Mecânica Pesada Ltda')
        fornecedorOficina.set('cnpj_cpf', '22.345.678/0001-88')
        fornecedorOficina.set('email', 'oficina@tratorpecaspesada.com.br')
        fornecedorOficina.set('telefone', '(11) 3788-9922')
        fornecedorOficina.set('cidade', 'São Paulo')
        fornecedorOficina.set('uf', 'SP')
        app.save(fornecedorOficina)
      } catch (_) {}
    }

    // 5. Seed Veículos / Equipamentos de Pedreira
    const veiculosData = [
      {
        codigo_interno: 'CAM-01',
        placa: 'BRA-3C21',
        tipo: 'caminhao',
        marca: 'Volvo',
        modelo: 'FMX 500 8x4 Basculante Pedreira',
        ano: 2021,
        tipo_medidor: 'km',
        medidor_atual: 84320,
        combustivel_padrao: 'Diesel S10',
        status: 'ativo',
        observacoes:
          'Caçamba reforçada Hardox para transporte de brita e rachão na frente de lavra.',
      },
      {
        codigo_interno: 'CAM-02',
        placa: 'GVE-9840',
        tipo: 'caminhao',
        marca: 'Mercedes-Benz',
        modelo: 'Actros 4844 8x4 Basculante',
        ano: 2020,
        tipo_medidor: 'km',
        medidor_atual: 112500,
        combustivel_padrao: 'Diesel S10',
        status: 'ativo',
        observacoes: 'Escala interna na britagem e transporte de finos.',
      },
      {
        codigo_interno: 'ESC-01',
        placa: 'ESC-0001',
        tipo: 'escavadeira',
        marca: 'Caterpillar',
        modelo: 'CAT 336D2L Escavadeira Hidráulica',
        ano: 2019,
        tipo_medidor: 'horas',
        medidor_atual: 7420,
        combustivel_padrao: 'Diesel S10',
        status: 'ativo',
        observacoes: 'Escavadeira principal na praça de desmonte com concha de rocha de 2.2 m³.',
      },
      {
        codigo_interno: 'CAR-01',
        placa: 'CAR-0001',
        tipo: 'carregadeira',
        marca: 'Komatsu',
        modelo: 'WA380-6 Pá Carregadeira',
        ano: 2022,
        tipo_medidor: 'horas',
        medidor_atual: 3640,
        combustivel_padrao: 'Diesel S10',
        status: 'ativo',
        observacoes:
          'Carregamento nos silos de brita 0, 1 e pedrisco para os caminhões rodoviários.',
      },
      {
        codigo_interno: 'PERF-01',
        placa: 'PRF-0001',
        tipo: 'perfuratriz',
        marca: 'Sandvik',
        modelo: 'Pantera DP1100i Perfuratriz Hidráulica',
        ano: 2018,
        tipo_medidor: 'horas',
        medidor_atual: 9150,
        combustivel_padrao: 'Diesel S10',
        status: 'manutencao',
        observacoes: 'Parada preventiva no compressor e troca de bits de perfuração.',
      },
    ]

    const mapVeiculos = {}
    for (const v of veiculosData) {
      try {
        const records = app.findRecordsByFilter(
          'veiculos',
          `empresa_id = '${empresa.id}' && codigo_interno = '${v.codigo_interno}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          mapVeiculos[v.codigo_interno] = records[0]
          continue
        }
      } catch (_) {}

      const rec = new Record(veiculosCol)
      rec.set('empresa_id', empresa.id)
      rec.set('codigo_interno', v.codigo_interno)
      rec.set('placa', v.placa)
      rec.set('tipo', v.tipo)
      rec.set('marca', v.marca)
      rec.set('modelo', v.modelo)
      rec.set('ano', v.ano)
      rec.set('tipo_medidor', v.tipo_medidor)
      rec.set('medidor_atual', v.medidor_atual)
      rec.set('combustivel_padrao', v.combustivel_padrao)
      rec.set('status', v.status)
      rec.set('observacoes', v.observacoes)
      app.save(rec)
      mapVeiculos[v.codigo_interno] = rec
    }

    // 6. Datas do mês atual para histórico
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d03 = `${y}-${m}-03 10:00:00.000Z`
    const d06 = `${y}-${m}-06 14:30:00.000Z`
    const d09 = `${y}-${m}-09 08:15:00.000Z`
    const d12 = `${y}-${m}-12 16:40:00.000Z`
    const d15 = `${y}-${m}-15 11:00:00.000Z`

    // 7. Seed Abastecimentos e vincular Contas a Pagar
    const abastecimentosData = [
      {
        veiculoCod: 'CAM-01',
        data: d03,
        combustivel: 'Diesel S10',
        litros: 320,
        preco_litro: 5.89,
        valor_total: 1884.8,
        medidor: 83950,
        medidor_anterior: 83300,
        distancia: 650,
        consumo: 2.03, // km/l
        custo_un: 2.9, // R$/km
        motorista: 'Sebastião Antunes (Tião)',
      },
      {
        veiculoCod: 'CAM-01',
        data: d12,
        combustivel: 'Diesel S10',
        litros: 310,
        preco_litro: 5.92,
        valor_total: 1835.2,
        medidor: 84320,
        medidor_anterior: 83950,
        distancia: 370,
        consumo: 1.19, // km/l (trajeto pesado subida de serra)
        custo_un: 4.96,
        motorista: 'Sebastião Antunes (Tião)',
      },
      {
        veiculoCod: 'ESC-01',
        data: d06,
        combustivel: 'Diesel S10',
        litros: 420,
        preco_litro: 5.89,
        valor_total: 2473.8,
        medidor: 7420,
        medidor_anterior: 7390,
        distancia: 30, // 30 horas de operação
        consumo: 14.0, // 14 l/h
        custo_un: 82.46, // R$/h
        motorista: 'Carlos Alberto (Operador Lavra)',
      },
      {
        veiculoCod: 'CAR-01',
        data: d09,
        combustivel: 'Diesel S10',
        litros: 260,
        preco_litro: 5.89,
        valor_total: 1531.4,
        medidor: 3640,
        medidor_anterior: 3615,
        distancia: 25, // 25 horas
        consumo: 10.4, // 10.4 l/h
        custo_un: 61.26,
        motorista: 'Marcos Vinícius (Carregamento)',
      },
    ]

    for (const a of abastecimentosData) {
      const veic = mapVeiculos[a.veiculoCod]
      if (!veic) continue

      try {
        const records = app.findRecordsByFilter(
          'abastecimentos',
          `empresa_id = '${empresa.id}' && veiculo_id = '${veic.id}' && data = '${a.data}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      // 7a. Criar Conta a Pagar integrada
      let contaPagarRec = null
      try {
        contaPagarRec = new Record(contasPagarCol)
        contaPagarRec.set('empresa_id', empresa.id)
        if (fornecedorPosto) contaPagarRec.set('fornecedor_id', fornecedorPosto.id)
        contaPagarRec.set(
          'descricao',
          `Abastecimento ${veic.getString('codigo_interno')} (${veic.getString('modelo')}) - ${a.litros}L`,
        )
        if (catCombustivel) contaPagarRec.set('categoria_id', catCombustivel.id)
        contaPagarRec.set('valor', a.valor_total)
        contaPagarRec.set('vencimento', a.data)
        contaPagarRec.set('parcelas', 1)
        contaPagarRec.set('status', 'Paga')
        contaPagarRec.set('data_pagamento', a.data)
        contaPagarRec.set('forma_pagamento', 'Boleto')
        contaPagarRec.set('observacoes', 'Integração automática Módulo de Frotas')
        app.save(contaPagarRec)

        // Movimento de saída financeiro
        const mov = new Record(movimentosCol)
        mov.set('empresa_id', empresa.id)
        mov.set('tipo', 'Saida')
        mov.set('descricao', `Pagamento Abastecimento ${veic.getString('codigo_interno')}`)
        mov.set('valor', a.valor_total)
        mov.set('data', a.data)
        if (catCombustivel) mov.set('categoria_id', catCombustivel.id)
        mov.set('origem', 'ContaPagar')
        mov.set('referencia_id', contaPagarRec.id)
        mov.set('conciliado', true)
        if (contaPrincipal) mov.set('caixa_id', contaPrincipal.id)
        app.save(mov)
      } catch (_) {}

      const recAbast = new Record(abastecimentosCol)
      recAbast.set('empresa_id', empresa.id)
      recAbast.set('veiculo_id', veic.id)
      recAbast.set('data', a.data)
      recAbast.set('combustivel', a.combustivel)
      recAbast.set('litros', a.litros)
      recAbast.set('preco_litro', a.preco_litro)
      recAbast.set('valor_total', a.valor_total)
      recAbast.set('medidor', a.medidor)
      recAbast.set('medidor_anterior', a.medidor_anterior)
      recAbast.set('distancia_percorrida', a.distancia)
      recAbast.set('consumo_medio', a.consumo)
      recAbast.set('custo_por_unidade', a.custo_un)
      if (fornecedorPosto) recAbast.set('fornecedor_id', fornecedorPosto.id)
      if (contaPagarRec) recAbast.set('conta_pagar_id', contaPagarRec.id)
      recAbast.set('motorista_operador', a.motorista)
      recAbast.set('observacoes', 'Abastecimento em ponto de abastecimento interno')
      app.save(recAbast)
    }

    // 8. Seed Manutenções
    const manutencoesData = [
      {
        veiculoCod: 'CAM-01',
        tipo: 'preventiva',
        descricao: 'Troca de óleo do motor, filtro de diesel e lubrificação geral do chassi',
        data: d06,
        medidor: 84000,
        custo: 2450.0,
        status: 'concluida',
        prox_data: `${y}-${m}-28 00:00:00.000Z`,
        prox_medidor: 90000,
        oficina: 'TratorPeças & Mecânica Pesada Ltda',
        observacoes: 'Substituídos filtros Racor e óleo 15W40 mineral específico pedreira.',
      },
      {
        veiculoCod: 'PERF-01',
        tipo: 'corretiva',
        descricao: 'Substituição de mangueiras hidráulicas de alta pressão e reparo no martelete',
        data: d15,
        medidor: 9150,
        custo: 4800.0,
        status: 'em_andamento',
        prox_data: `${y}-${m}-30 00:00:00.000Z`,
        prox_medidor: 9500,
        oficina: 'TratorPeças & Mecânica Pesada Ltda',
        observacoes: 'Vazamento constatado na linha principal de avanço durante furação.',
      },
    ]

    for (const mData of manutencoesData) {
      const veic = mapVeiculos[mData.veiculoCod]
      if (!veic) continue

      try {
        const records = app.findRecordsByFilter(
          'manutencoes',
          `empresa_id = '${empresa.id}' && veiculo_id = '${veic.id}' && descricao = '${mData.descricao}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      let contaPagarRec = null
      try {
        contaPagarRec = new Record(contasPagarCol)
        contaPagarRec.set('empresa_id', empresa.id)
        if (fornecedorOficina) contaPagarRec.set('fornecedor_id', fornecedorOficina.id)
        contaPagarRec.set(
          'descricao',
          `Manutenção ${veic.getString('codigo_interno')}: ${mData.descricao}`,
        )
        if (catManutencao) contaPagarRec.set('categoria_id', catManutencao.id)
        contaPagarRec.set('valor', mData.custo)
        contaPagarRec.set('vencimento', mData.data)
        contaPagarRec.set('parcelas', 1)
        contaPagarRec.set('status', mData.status === 'concluida' ? 'Paga' : 'Aberta')
        if (mData.status === 'concluida') {
          contaPagarRec.set('data_pagamento', mData.data)
          contaPagarRec.set('forma_pagamento', 'Boleto')
        }
        contaPagarRec.set('observacoes', 'Integração automática Módulo de Frotas')
        app.save(contaPagarRec)

        if (mData.status === 'concluida') {
          const mov = new Record(movimentosCol)
          mov.set('empresa_id', empresa.id)
          mov.set('tipo', 'Saida')
          mov.set('descricao', `Pagamento Manutenção ${veic.getString('codigo_interno')}`)
          mov.set('valor', mData.custo)
          mov.set('data', mData.data)
          if (catManutencao) mov.set('categoria_id', catManutencao.id)
          mov.set('origem', 'ContaPagar')
          mov.set('referencia_id', contaPagarRec.id)
          mov.set('conciliado', true)
          if (contaPrincipal) mov.set('caixa_id', contaPrincipal.id)
          app.save(mov)
        }
      } catch (_) {}

      const recManut = new Record(manutencoesCol)
      recManut.set('empresa_id', empresa.id)
      recManut.set('veiculo_id', veic.id)
      recManut.set('tipo', mData.tipo)
      recManut.set('descricao', mData.descricao)
      if (fornecedorOficina) recManut.set('fornecedor_id', fornecedorOficina.id)
      recManut.set('oficina_nome', mData.oficina)
      recManut.set('data', mData.data)
      recManut.set('medidor_no_momento', mData.medidor)
      recManut.set('custo', mData.custo)
      if (mData.prox_data) recManut.set('proxima_revisao_data', mData.prox_data)
      if (mData.prox_medidor) recManut.set('proxima_revisao_medidor', mData.prox_medidor)
      if (contaPagarRec) recManut.set('conta_pagar_id', contaPagarRec.id)
      recManut.set('status', mData.status)
      recManut.set('observacoes', mData.observacoes)
      app.save(recManut)
    }
  },
  (app) => {},
)
