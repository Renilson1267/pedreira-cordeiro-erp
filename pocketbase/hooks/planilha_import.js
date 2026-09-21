routerAdd(
  'POST',
  '/backend/v1/importar-movimentos',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const body = e.requestInfo().body || {}
    const empresaId = body.empresa_id
    const conteudo = body.conteudo || '' // text CSV or raw lines

    if (!empresaId) {
      return e.json(400, { error: 'empresa_id é obrigatório' })
    }

    // Fetch current company movements for matching
    let movimentos = []
    try {
      movimentos = $app.findRecordsByFilter(
        'movimentos_financeiros',
        `empresa_id = '${empresaId}'`,
        '-data',
        100,
        0,
      )
    } catch (_) {}

    const parsedItems = []
    const lines = conteudo.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || (i === 0 && line.toLowerCase().includes('data'))) continue // skip header/blank

      const parts = line.split(/[;,]/)
      if (parts.length >= 3) {
        const dataStr = parts[0].trim()
        const descStr = parts[1].trim()
        const valStr = parts[2].trim().replace('R$', '').replace(/\./g, '').replace(',', '.')
        const valor = parseFloat(valStr) || 0
        const tipo = valor >= 0 ? 'Entrada' : 'Saida'

        if (descStr && valor !== 0) {
          // Find match in existing movements
          let match = null
          const absVal = Math.abs(valor)
          for (let j = 0; j < movimentos.length; j++) {
            const m = movimentos[j]
            const mVal = m.getFloat('valor')
            const mData = m.getString('data').slice(0, 10)
            if (Math.abs(mVal - absVal) < 0.01 && !m.getBool('conciliado')) {
              match = {
                id: m.id,
                descricao: m.getString('descricao'),
                valor: mVal,
                data: mData,
              }
              break
            }
          }

          parsedItems.push({
            data: dataStr,
            descricao: descStr,
            valor: absVal,
            tipo: tipo,
            casado: !!match,
            movimento_casado: match,
          })
        }
      }
    }

    return e.json(200, {
      success: true,
      total: parsedItems.length,
      itens: parsedItems,
    })
  },
  $apis.requireAuth(),
)
