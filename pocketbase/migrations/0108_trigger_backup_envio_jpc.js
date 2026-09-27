migrate(
  (app) => {
    const rec = app.findFirstRecordByData('backups_sistema', 'id', 'jpc5w1b0o13nvim')
    if (rec) {
      rec.set('drive_status', 'solicitado')
      app.save(rec)
    }
  },
  (app) => {},
)
