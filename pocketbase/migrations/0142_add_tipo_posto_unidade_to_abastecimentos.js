migrate(
  (app) => {
    try {
      const abastecimentosCol = app.findCollectionByNameOrId('abastecimentos')
      const postosCol = app.findCollectionByNameOrId('postos_combustivel')

      // 1. Campo tipo_posto ('interno' | 'externo')
      if (!abastecimentosCol.fields.getByName('tipo_posto')) {
        abastecimentosCol.fields.add(
          new SelectField({
            name: 'tipo_posto',
            required: false,
            values: ['interno', 'externo'],
            maxSelect: 1,
          }),
        )
      }

      // 2. Campo unidade (Unidades do Grupo: Patos, Santa Luzia, Monteiro, São José do Egito, Caicó)
      if (!abastecimentosCol.fields.getByName('unidade')) {
        abastecimentosCol.fields.add(
          new SelectField({
            name: 'unidade',
            required: false,
            values: ['Patos (Matriz)', 'Santa Luzia', 'Monteiro', 'São José do Egito', 'Caicó'],
            maxSelect: 1,
          }),
        )
      }

      // 3. Campo posto_id referenciando postos_combustivel (opcional para posto externo)
      if (!abastecimentosCol.fields.getByName('posto_id')) {
        abastecimentosCol.fields.add(
          new RelationField({
            name: 'posto_id',
            collectionId: postosCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          }),
        )
      }

      app.save(abastecimentosCol)
    } catch (err) {
      console.log('Erro ao atualizar campos de abastecimentos na migração 0142:', err)
      throw err
    }
  },
  (app) => {
    try {
      const abastecimentosCol = app.findCollectionByNameOrId('abastecimentos')
      if (abastecimentosCol.fields.getByName('posto_id')) {
        abastecimentosCol.fields.removeByName('posto_id')
      }
      if (abastecimentosCol.fields.getByName('unidade')) {
        abastecimentosCol.fields.removeByName('unidade')
      }
      if (abastecimentosCol.fields.getByName('tipo_posto')) {
        abastecimentosCol.fields.removeByName('tipo_posto')
      }
      app.save(abastecimentosCol)
    } catch (_) {}
  },
)
