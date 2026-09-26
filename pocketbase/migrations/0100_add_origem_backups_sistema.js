// Migração 0100: Adicionar campo 'origem' à coleção backups_sistema (aditivo e retrocompatível)
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('backups_sistema')
    if (!col.fields.getByName('origem')) {
      col.fields.add(
        new SelectField({
          name: 'origem',
          values: ['manual', 'semanal_automatico'],
          maxSelect: 1,
          required: false,
        }),
      )
      col.addIndex('idx_backups_origem', false, 'origem', '')
      app.save(col)
    }

    // Preencher retroativamente os registros existentes que não possuem 'origem' como 'manual'
    try {
      app
        .db()
        .newQuery(
          "UPDATE backups_sistema SET origem = 'manual' WHERE origem IS NULL OR origem = ''",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('backups_sistema')
      col.removeIndex('idx_backups_origem')
      col.fields.removeByName('origem')
      app.save(col)
    } catch (_) {}
  },
)
