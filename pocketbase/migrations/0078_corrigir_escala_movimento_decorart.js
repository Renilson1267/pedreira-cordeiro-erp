migrate(
  (app) => {
    // 1. Corrige o movimento original gravado em 16/06 (id: cwncdo5hb5n6igv) de 90000000 para 90000
    try {
      const movOriginal = app.findFirstRecordByData(
        'movimentos_financeiros',
        'id',
        'cwncdo5hb5n6igv',
      )
      if (movOriginal) {
        movOriginal.set('valor', 90000)
        app.save(movOriginal)
      }
    } catch (_) {
      // Caso não encontre por id direto, tenta localizar pelo vínculo com o título e valor 90000000 tipo Saida
      app
        .db()
        .newQuery(
          "UPDATE movimentos_financeiros SET valor = 90000 WHERE referencia_id = '4tf8q506drww53v' AND tipo = 'Saida' AND valor = 90000000",
        )
        .execute()
    }

    // 2. Exclui o movimento de estorno de 90 milhões gerado em 24/09 (id: ta19ux9blzpscl2)
    try {
      const movEstorno = app.findFirstRecordByData(
        'movimentos_financeiros',
        'id',
        'ta19ux9blzpscl2',
      )
      if (movEstorno) {
        app.delete(movEstorno)
      }
    } catch (_) {
      app
        .db()
        .newQuery(
          "DELETE FROM movimentos_financeiros WHERE id = 'ta19ux9blzpscl2' OR (referencia_id = '4tf8q506drww53v' AND tipo = 'Entrada' AND valor = 90000000)",
        )
        .execute()
    }

    // 3. Exclui o movimento duplicado da re-baixa de R$ 90.000,00 (id: prp86dpj6qdpnxm)
    // Mantendo apenas o movimento original corrigido (cwncdo5hb5n6igv) de R$ 90.000,00 com data 16/06
    try {
      const movDuplicado = app.findFirstRecordByData(
        'movimentos_financeiros',
        'id',
        'prp86dpj6qdpnxm',
      )
      if (movDuplicado) {
        app.delete(movDuplicado)
      }
    } catch (_) {
      app.db().newQuery("DELETE FROM movimentos_financeiros WHERE id = 'prp86dpj6qdpnxm'").execute()
    }
  },
  (app) => {
    // Reverter (down)
    try {
      const movOriginal = app.findFirstRecordByData(
        'movimentos_financeiros',
        'id',
        'cwncdo5hb5n6igv',
      )
      if (movOriginal) {
        movOriginal.set('valor', 90000000)
        app.save(movOriginal)
      }
    } catch (_) {}
  },
)
