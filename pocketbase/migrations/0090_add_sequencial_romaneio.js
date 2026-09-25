migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Criar coleção 'contadores_sequenciais' para controle atômico e incremental de sequenciais por empresa e tipo
    let contadoresCol
    try {
      contadoresCol = app.findCollectionByNameOrId('contadores_sequenciais')
    } catch (_) {
      contadoresCol = new Collection({
        name: 'contadores_sequenciais',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'empresa_id',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'tipo',
            type: 'text',
            required: true,
          },
          {
            name: 'ano',
            type: 'number',
            required: true,
          },
          {
            name: 'ultimo_numero',
            type: 'number',
            required: true,
            min: 0,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_contadores_empresa_tipo_ano ON contadores_sequenciais (empresa_id, tipo, ano)',
        ],
      })
      app.save(contadoresCol)
    }

    // 2. Adicionar campos 'sequencial_romaneio' e 'numero_sequencial' na coleção 'entregas'
    const entregasCol = app.findCollectionByNameOrId('entregas')
    if (!entregasCol.fields.getByName('sequencial_romaneio')) {
      entregasCol.fields.add(
        new TextField({
          name: 'sequencial_romaneio',
          required: false,
        }),
      )
    }
    if (!entregasCol.fields.getByName('numero_sequencial')) {
      entregasCol.fields.add(
        new NumberField({
          name: 'numero_sequencial',
          required: false,
          min: 0,
        }),
      )
    }
    app.save(entregasCol)

    // 3. Adicionar campos 'sequencial_romaneio' e 'numero_sequencial' na coleção 'vendas'
    const vendasCol = app.findCollectionByNameOrId('vendas')
    if (!vendasCol.fields.getByName('sequencial_romaneio')) {
      vendasCol.fields.add(
        new TextField({
          name: 'sequencial_romaneio',
          required: false,
        }),
      )
    }
    if (!vendasCol.fields.getByName('numero_sequencial')) {
      vendasCol.fields.add(
        new NumberField({
          name: 'numero_sequencial',
          required: false,
          min: 0,
        }),
      )
    }
    app.save(vendasCol)

    // 4. Atribuir sequenciais aos registros existentes por empresa, ordenados por data de criação
    // Formato: RMD-ANO-00001 (ex.: RMD-2026-00001)
    const empresas = app.findRecordsByFilter('empresas', "id != ''", 'created', 200, 0)
    for (const emp of empresas) {
      const empId = emp.id
      const entregas = app.findRecordsByFilter(
        'entregas',
        `empresa_id = '${empId}'`,
        'created',
        5000,
        0,
      )

      let contadorPorAno = {}
      for (const ent of entregas) {
        let ano = 2026
        const dataStr = ent.getString('data') || ent.getString('created')
        if (dataStr) {
          const anoExtraido = parseInt(dataStr.slice(0, 4), 10)
          if (!isNaN(anoExtraido) && anoExtraido >= 2000 && anoExtraido <= 2099) {
            ano = anoExtraido
          }
        }

        if (!contadorPorAno[ano]) {
          contadorPorAno[ano] = 0
        }
        contadorPorAno[ano] += 1
        const num = contadorPorAno[ano]
        const numPadded = String(num).padStart(5, '0')
        const sequencialFormatado = `RMD-${ano}-${numPadded}`

        ent.set('sequencial_romaneio', sequencialFormatado)
        ent.set('numero_sequencial', num)
        app.save(ent)

        // Se houver venda vinculada, propagar o sequencial para a venda se ela não tiver
        const vendaId = ent.getString('venda_id')
        if (vendaId) {
          try {
            const vendaRec = app.findFirstRecordByData('vendas', 'id', vendaId)
            if (!vendaRec.getString('sequencial_romaneio')) {
              vendaRec.set('sequencial_romaneio', sequencialFormatado)
              vendaRec.set('numero_sequencial', num)
              app.save(vendaRec)
            }
          } catch (_) {}
        }
      }

      // Preencher também vendas da empresa que ainda não receberam sequencial
      const vendasSemSeq = app.findRecordsByFilter(
        'vendas',
        `empresa_id = '${empId}' && sequencial_romaneio = ''`,
        'created',
        5000,
        0,
      )
      for (const v of vendasSemSeq) {
        let ano = 2026
        const dataStr = v.getString('data_venda') || v.getString('created')
        if (dataStr) {
          const anoExtraido = parseInt(dataStr.slice(0, 4), 10)
          if (!isNaN(anoExtraido) && anoExtraido >= 2000 && anoExtraido <= 2099) {
            ano = anoExtraido
          }
        }
        if (!contadorPorAno[ano]) {
          contadorPorAno[ano] = 0
        }
        contadorPorAno[ano] += 1
        const num = contadorPorAno[ano]
        const numPadded = String(num).padStart(5, '0')
        const sequencialFormatado = `RMD-${ano}-${numPadded}`

        v.set('sequencial_romaneio', sequencialFormatado)
        v.set('numero_sequencial', num)
        app.save(v)
      }

      // Salvar os contadores no banco para cada ano
      for (const anoKey in contadorPorAno) {
        const anoNum = parseInt(anoKey, 10)
        const ultimo = contadorPorAno[anoKey]
        const contadorRec = new Record(contadoresCol)
        contadorRec.set('empresa_id', empId)
        contadorRec.set('tipo', 'romaneio')
        contadorRec.set('ano', anoNum)
        contadorRec.set('ultimo_numero', ultimo)
        app.save(contadorRec)
      }
    }
  },
  (app) => {
    // down: opcional
    try {
      const col = app.findCollectionByNameOrId('contadores_sequenciais')
      app.delete(col)
    } catch (_) {}
  },
)
