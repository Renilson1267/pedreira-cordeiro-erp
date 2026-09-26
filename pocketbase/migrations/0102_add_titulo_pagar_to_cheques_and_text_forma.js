// Migração 0102: Suporte a cheques pré-datados para Contas a Pagar e forma_pagamento aberta em contas_pagar
migrate(
  (app) => {
    // 1. Atualizar contas_pagar: converter forma_pagamento de SelectField para TextField
    try {
      const cp = app.findCollectionByNameOrId('contas_pagar')
      const formaField = cp.fields.getByName('forma_pagamento')
      if (formaField && formaField.type === 'select') {
        cp.fields.removeByName('forma_pagamento')
        cp.fields.add(new TextField({ name: 'forma_pagamento' }))
        app.save(cp)
      }
    } catch (err) {
      console.log('Aviso ao ajustar forma_pagamento em contas_pagar:', err)
    }

    // 2. Atualizar cheques_predatados:
    // - tornar titulo_id opcional (pois cheques a pagar usarão titulo_pagar_id)
    // - adicionar relation opcional titulo_pagar_id apontando para contas_pagar
    try {
      const chkCol = app.findCollectionByNameOrId('cheques_predatados')
      const cpCol = app.findCollectionByNameOrId('contas_pagar')

      // Atualizar titulo_id para required: false
      const tituloIdField = chkCol.fields.getByName('titulo_id')
      if (tituloIdField) {
        tituloIdField.required = false
      }

      // Adicionar titulo_pagar_id se ainda não existir
      if (!chkCol.fields.getByName('titulo_pagar_id')) {
        chkCol.fields.add(
          new RelationField({
            name: 'titulo_pagar_id',
            collectionId: cpCol.id,
            cascadeDelete: true,
            maxSelect: 1,
            required: false,
          }),
        )
      }

      chkCol.addIndex('idx_cheques_titulo_pagar', false, 'titulo_pagar_id', '')
      app.save(chkCol)
    } catch (err) {
      console.log('Aviso ao atualizar cheques_predatados para contas_pagar:', err)
    }
  },
  (app) => {
    try {
      const chkCol = app.findCollectionByNameOrId('cheques_predatados')
      chkCol.removeIndex('idx_cheques_titulo_pagar')
      chkCol.fields.removeByName('titulo_pagar_id')
      app.save(chkCol)
    } catch (_) {}
  },
)
