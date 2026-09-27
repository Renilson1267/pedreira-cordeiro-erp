migrate((app) => {
  const col = app.findCollectionByNameOrId('backups_sistema')
  const driveStatusField = col.fields.getByName('drive_status')
  if (driveStatusField) {
    driveStatusField.maxSelect = 1
    app.save(col)
  }
})
