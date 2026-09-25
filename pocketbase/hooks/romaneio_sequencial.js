// Hook PocketBase para geração atômica e imutável de sequencial de romaneio
// Garante numeração única e estritamente incremental por empresa (ex: RMD-2026-00001)
// Impede alteração do sequencial após a criação.
// NOTA IMPORTANTE: Todo o código de helper fica INLINE dentro de cada callback (regra de escopo da JSVM do PocketBase).

// 1. Hook ao criar registro de entrega
onRecordCreate((e) => {
  const empresaId = e.record.getString('empresa_id')
  if (!empresaId) {
    e.next()
    return
  }

  // Se já tiver uma venda vinculada que já tem sequencial_romaneio, herdar o mesmo sequencial
  const vendaId = e.record.getString('venda_id')
  if (vendaId) {
    try {
      const vendaRec = $app.findFirstRecordByData('vendas', 'id', vendaId)
      const seqVenda = vendaRec.getString('sequencial_romaneio')
      const numVenda = vendaRec.getInt('numero_sequencial')
      if (seqVenda) {
        e.record.set('sequencial_romaneio', seqVenda)
        if (numVenda) {
          e.record.set('numero_sequencial', numVenda)
        }
        e.next()
        return
      }
    } catch (_) {}
  }

  // Se já veio preenchido, manter
  const seqExistente = e.record.getString('sequencial_romaneio')
  if (!seqExistente) {
    let ano = 2026
    const dataRef = e.record.getString('data') || new Date().toISOString()
    if (dataRef) {
      const a = parseInt(String(dataRef).slice(0, 4), 10)
      if (!isNaN(a) && a >= 2000 && a <= 2099) ano = a
    }

    const contadoresCol = $app.findCollectionByNameOrId('contadores_sequenciais')
    let contadorRec = null
    try {
      const list = $app.findRecordsByFilter(
        'contadores_sequenciais',
        `empresa_id = '${empresaId}' && tipo = 'romaneio' && ano = ${ano}`,
        '-created',
        1,
        0,
      )
      if (list && list.length > 0) contadorRec = list[0]
    } catch (_) {}

    let proximoNumero = 1
    if (contadorRec) {
      const ultimo = contadorRec.getInt('ultimo_numero') || 0
      proximoNumero = ultimo + 1
      contadorRec.set('ultimo_numero', proximoNumero)
      $app.save(contadorRec)
    } else {
      let maxExistente = 0
      try {
        const entMax = $app.findRecordsByFilter(
          'entregas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (entMax && entMax.length > 0) {
          maxExistente = Math.max(maxExistente, entMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}
      try {
        const vendMax = $app.findRecordsByFilter(
          'vendas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (vendMax && vendMax.length > 0) {
          maxExistente = Math.max(maxExistente, vendMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}

      proximoNumero = maxExistente + 1
      const novoContador = new Record(contadoresCol)
      novoContador.set('empresa_id', empresaId)
      novoContador.set('tipo', 'romaneio')
      novoContador.set('ano', ano)
      novoContador.set('ultimo_numero', proximoNumero)
      $app.save(novoContador)
    }

    const numPadded = String(proximoNumero).padStart(5, '0')
    e.record.set('sequencial_romaneio', `RMD-${ano}-${numPadded}`)
    e.record.set('numero_sequencial', proximoNumero)
  }

  e.next()
}, 'entregas')

// 2. Hook ao atualizar registro de entrega: PROIBIR alteração do sequencial (somente leitura sem possibilidade de alterar)
onRecordUpdate((e) => {
  const originalSeq = e.record.original().getString('sequencial_romaneio')
  const originalNum = e.record.original().getInt('numero_sequencial')

  if (originalSeq) {
    e.record.set('sequencial_romaneio', originalSeq)
    if (originalNum) {
      e.record.set('numero_sequencial', originalNum)
    }
  } else {
    const empresaId = e.record.getString('empresa_id')
    let ano = 2026
    const dataRef = e.record.getString('data') || new Date().toISOString()
    if (dataRef) {
      const a = parseInt(String(dataRef).slice(0, 4), 10)
      if (!isNaN(a) && a >= 2000 && a <= 2099) ano = a
    }

    const contadoresCol = $app.findCollectionByNameOrId('contadores_sequenciais')
    let contadorRec = null
    try {
      const list = $app.findRecordsByFilter(
        'contadores_sequenciais',
        `empresa_id = '${empresaId}' && tipo = 'romaneio' && ano = ${ano}`,
        '-created',
        1,
        0,
      )
      if (list && list.length > 0) contadorRec = list[0]
    } catch (_) {}

    let proximoNumero = 1
    if (contadorRec) {
      const ultimo = contadorRec.getInt('ultimo_numero') || 0
      proximoNumero = ultimo + 1
      contadorRec.set('ultimo_numero', proximoNumero)
      $app.save(contadorRec)
    } else {
      let maxExistente = 0
      try {
        const entMax = $app.findRecordsByFilter(
          'entregas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (entMax && entMax.length > 0) {
          maxExistente = Math.max(maxExistente, entMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}
      proximoNumero = maxExistente + 1
      const novoContador = new Record(contadoresCol)
      novoContador.set('empresa_id', empresaId)
      novoContador.set('tipo', 'romaneio')
      novoContador.set('ano', ano)
      novoContador.set('ultimo_numero', proximoNumero)
      $app.save(novoContador)
    }

    const numPadded = String(proximoNumero).padStart(5, '0')
    e.record.set('sequencial_romaneio', `RMD-${ano}-${numPadded}`)
    e.record.set('numero_sequencial', proximoNumero)
  }

  e.next()
}, 'entregas')

// 3. Hook ao criar registro de venda
onRecordCreate((e) => {
  const empresaId = e.record.getString('empresa_id')
  if (!empresaId) {
    e.next()
    return
  }

  const seqExistente = e.record.getString('sequencial_romaneio')
  if (!seqExistente) {
    let ano = 2026
    const dataRef = e.record.getString('data_venda') || new Date().toISOString()
    if (dataRef) {
      const a = parseInt(String(dataRef).slice(0, 4), 10)
      if (!isNaN(a) && a >= 2000 && a <= 2099) ano = a
    }

    const contadoresCol = $app.findCollectionByNameOrId('contadores_sequenciais')
    let contadorRec = null
    try {
      const list = $app.findRecordsByFilter(
        'contadores_sequenciais',
        `empresa_id = '${empresaId}' && tipo = 'romaneio' && ano = ${ano}`,
        '-created',
        1,
        0,
      )
      if (list && list.length > 0) contadorRec = list[0]
    } catch (_) {}

    let proximoNumero = 1
    if (contadorRec) {
      const ultimo = contadorRec.getInt('ultimo_numero') || 0
      proximoNumero = ultimo + 1
      contadorRec.set('ultimo_numero', proximoNumero)
      $app.save(contadorRec)
    } else {
      let maxExistente = 0
      try {
        const entMax = $app.findRecordsByFilter(
          'entregas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (entMax && entMax.length > 0) {
          maxExistente = Math.max(maxExistente, entMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}
      try {
        const vendMax = $app.findRecordsByFilter(
          'vendas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (vendMax && vendMax.length > 0) {
          maxExistente = Math.max(maxExistente, vendMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}

      proximoNumero = maxExistente + 1
      const novoContador = new Record(contadoresCol)
      novoContador.set('empresa_id', empresaId)
      novoContador.set('tipo', 'romaneio')
      novoContador.set('ano', ano)
      novoContador.set('ultimo_numero', proximoNumero)
      $app.save(novoContador)
    }

    const numPadded = String(proximoNumero).padStart(5, '0')
    e.record.set('sequencial_romaneio', `RMD-${ano}-${numPadded}`)
    e.record.set('numero_sequencial', proximoNumero)
  }

  e.next()
}, 'vendas')

// 4. Hook ao atualizar registro de venda: PROIBIR alteração do sequencial
onRecordUpdate((e) => {
  const originalSeq = e.record.original().getString('sequencial_romaneio')
  const originalNum = e.record.original().getInt('numero_sequencial')

  if (originalSeq) {
    e.record.set('sequencial_romaneio', originalSeq)
    if (originalNum) {
      e.record.set('numero_sequencial', originalNum)
    }
  } else {
    const empresaId = e.record.getString('empresa_id')
    let ano = 2026
    const dataRef = e.record.getString('data_venda') || new Date().toISOString()
    if (dataRef) {
      const a = parseInt(String(dataRef).slice(0, 4), 10)
      if (!isNaN(a) && a >= 2000 && a <= 2099) ano = a
    }

    const contadoresCol = $app.findCollectionByNameOrId('contadores_sequenciais')
    let contadorRec = null
    try {
      const list = $app.findRecordsByFilter(
        'contadores_sequenciais',
        `empresa_id = '${empresaId}' && tipo = 'romaneio' && ano = ${ano}`,
        '-created',
        1,
        0,
      )
      if (list && list.length > 0) contadorRec = list[0]
    } catch (_) {}

    let proximoNumero = 1
    if (contadorRec) {
      const ultimo = contadorRec.getInt('ultimo_numero') || 0
      proximoNumero = ultimo + 1
      contadorRec.set('ultimo_numero', proximoNumero)
      $app.save(contadorRec)
    } else {
      let maxExistente = 0
      try {
        const vendMax = $app.findRecordsByFilter(
          'vendas',
          `empresa_id = '${empresaId}' && sequencial_romaneio ~ 'RMD-${ano}-'`,
          '-numero_sequencial',
          1,
          0,
        )
        if (vendMax && vendMax.length > 0) {
          maxExistente = Math.max(maxExistente, vendMax[0].getInt('numero_sequencial') || 0)
        }
      } catch (_) {}
      proximoNumero = maxExistente + 1
      const novoContador = new Record(contadoresCol)
      novoContador.set('empresa_id', empresaId)
      novoContador.set('tipo', 'romaneio')
      novoContador.set('ano', ano)
      novoContador.set('ultimo_numero', proximoNumero)
      $app.save(novoContador)
    }

    const numPadded = String(proximoNumero).padStart(5, '0')
    e.record.set('sequencial_romaneio', `RMD-${ano}-${numPadded}`)
    e.record.set('numero_sequencial', proximoNumero)
  }

  e.next()
}, 'vendas')
