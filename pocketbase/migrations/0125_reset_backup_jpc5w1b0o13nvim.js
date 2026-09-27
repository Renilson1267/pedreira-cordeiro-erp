/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const record = app.findRecordById('backups_sistema', 'jpc5w1b0o13nvim')
      if (record) {
        record.set('drive_status', 'solicitado')
        record.set('drive_tentativas', 0)
        record.set('drive_offset', 0)
        record.set('drive_session_url', '')
        record.set('drive_erro', '')
        app.save(record)
      }
    } catch (e) {
      console.warn('Migração 0125: registro jpc5w1b0o13nvim não encontrado:', e)
    }
  },
  (app) => {},
)
