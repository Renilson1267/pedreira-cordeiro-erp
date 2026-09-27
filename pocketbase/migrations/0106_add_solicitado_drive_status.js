migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('backups_sistema')
    const driveStatusField = col.fields.getByName('drive_status')
    if (driveStatusField) {
      const currentValues = driveStatusField.values || []
      if (!currentValues.includes('solicitado')) {
        driveStatusField.values = [...currentValues, 'solicitado']
        driveStatusField.maxSelect = 1
        app.save(col)
      }
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('backups_sistema')
    const driveStatusField = col.fields.getByName('drive_status')
    if (driveStatusField) {
      driveStatusField.values = (driveStatusField.values || []).filter((v) => v !== 'solicitado')
      driveStatusField.maxSelect = driveStatusField.values.length
      app.save(col)
    }
  },
)
