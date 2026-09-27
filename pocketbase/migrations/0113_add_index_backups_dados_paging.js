migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('backups_dados')
    col.addIndex('idx_bd_backup_created_id', false, 'backup_id, created, id', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('backups_dados')
    col.removeIndex('idx_bd_backup_created_id')
    app.save(col)
  },
)
