migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')

    // 1. Criar coleção 'formas_recebimento' se não existir
    let formasRecebimentoCol
    try {
      formasRecebimentoCol = app.findCollectionByNameOrId('formas_recebimento')
    } catch (_) {
      formasRecebimentoCol = new Collection({
        name: 'formas_recebimento',
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
          { name: 'nome', type: 'text', required: true },
          { name: 'ativo', type: 'bool' },
          { name: 'ordem', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_formas_rec_empresa ON formas_recebimento (empresa_id)',
          'CREATE INDEX idx_formas_rec_ordem ON formas_recebimento (ordem)',
        ],
      })
      app.save(formasRecebimentoCol)
    }

    // 2. Criar coleção 'cheques_predatados' se não existir
    let chequesPredatadosCol
    try {
      chequesPredatadosCol = app.findCollectionByNameOrId('cheques_predatados')
    } catch (_) {
      chequesPredatadosCol = new Collection({
        name: 'cheques_predatados',
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
            name: 'titulo_id',
            type: 'relation',
            required: true,
            collectionId: contasReceberCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'data', type: 'date', required: true },
          { name: 'valor', type: 'number', required: true },
          { name: 'numero', type: 'text' },
          { name: 'banco', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'compensado'],
            maxSelect: 1,
          },
          { name: 'data_compensacao', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cheques_empresa ON cheques_predatados (empresa_id)',
          'CREATE INDEX idx_cheques_titulo ON cheques_predatados (titulo_id)',
          'CREATE INDEX idx_cheques_data ON cheques_predatados (data)',
          'CREATE INDEX idx_cheques_status ON cheques_predatados (status)',
        ],
      })
      app.save(chequesPredatadosCol)
    }

    // 3. Atualizar contas_receber para forma_recebimento ser campo de texto aberto (aceitando qualquer nome do catálogo)
    try {
      const cr = app.findCollectionByNameOrId('contas_receber')
      const formaField = cr.fields.getByName('forma_recebimento')
      if (formaField && formaField.type === 'select') {
        // Altera o tipo da coluna no SQLite para TEXT caso ainda não seja, e troca no schema PB
        // No PocketBase v0.36, substituímos o SelectField por um TextField
        cr.fields.removeByName('forma_recebimento')
        cr.fields.add(new TextField({ name: 'forma_recebimento' }))
        app.save(cr)
      }
    } catch (err) {
      console.log('Aviso ao ajustar forma_recebimento em contas_receber:', err)
    }

    // 4. Popular as 7 formas de recebimento padrão para todas as empresas existentes
    const formasPadrao = [
      'Pix',
      'Cheque Pré-datado',
      'Depósito',
      'Dinheiro',
      'A Prazo',
      'Cartão',
      'Transferência Bancária',
    ]

    try {
      const todasEmpresas = app.findRecordsByFilter('empresas', 'id != ""', 'created', 100, 0)
      for (const emp of todasEmpresas) {
        for (let i = 0; i < formasPadrao.length; i++) {
          const nomeForma = formasPadrao[i]
          const existing = app.findRecordsByFilter(
            'formas_recebimento',
            `empresa_id = '${emp.id}' && nome = '${nomeForma}'`,
            '',
            1,
            0,
          )
          if (existing.length === 0) {
            const rec = new Record(formasRecebimentoCol)
            rec.set('empresa_id', emp.id)
            rec.set('nome', nomeForma)
            rec.set('ativo', true)
            rec.set('ordem', (i + 1) * 10)
            app.save(rec)
          }
        }
      }
    } catch (err) {
      console.log('Aviso ao popular formas_recebimento:', err)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('cheques_predatados'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('formas_recebimento'))
    } catch (_) {}
  },
)
