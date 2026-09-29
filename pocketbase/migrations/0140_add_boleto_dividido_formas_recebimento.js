migrate(
  (app) => {
    const novasFormas = ['Boleto', 'Dividido']

    try {
      const formasCol = app.findCollectionByNameOrId('formas_recebimento')
      const todasEmpresas = app.findRecordsByFilter('empresas', 'id != ""', 'created', 200, 0)

      for (const emp of todasEmpresas) {
        // Encontra a maior ordem existente para esta empresa
        let maxOrdem = 0
        const existentes = app.findRecordsByFilter(
          'formas_recebimento',
          `empresa_id = '${emp.id}'`,
          '-ordem',
          1,
          0,
        )
        if (existentes.length > 0) {
          maxOrdem = existentes[0].getInt('ordem') || 70
        }

        for (const nomeForma of novasFormas) {
          const jaExiste = app.findRecordsByFilter(
            'formas_recebimento',
            `empresa_id = '${emp.id}' && nome = '${nomeForma}'`,
            '',
            1,
            0,
          )
          if (jaExiste.length === 0) {
            maxOrdem += 10
            const rec = new Record(formasCol)
            rec.set('empresa_id', emp.id)
            rec.set('nome', nomeForma)
            rec.set('ativo', true)
            rec.set('ordem', maxOrdem)
            app.save(rec)
          }
        }
      }
    } catch (err) {
      console.log('Aviso na migração 0140_add_boleto_dividido_formas_recebimento:', err)
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM formas_recebimento WHERE nome IN ('Boleto', 'Dividido')")
        .execute()
    } catch (_) {}
  },
)
