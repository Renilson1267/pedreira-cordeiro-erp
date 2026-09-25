migrate(
  (app) => {
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      const statusField = entregasCol.fields.getByName('status')
      if (statusField) {
        statusField.values = ['pendente', 'em_transito', 'concluida', 'cancelada']
        app.save(entregasCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar status de entregas na migracao 0089:', e)
    }
  },
  (app) => {
    // noop
  },
)
