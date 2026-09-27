/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const record = app.findRecordById('backups_sistema', 'jpc5w1b0o13nvim')
      if (record) {
        record.set('drive_status', 'solicitado')
        record.set('drive_offset', 0)
        record.set('drive_total_bytes', 0)
        record.set('drive_tentativas', 0)
        record.set('drive_erro', '')
        app.save(record)
        console.log(
          '[MIGRATION 0116] Backup jpc5w1b0o13nvim resetado para drive_status = solicitado',
        )
      }
    } catch (err) {
      console.warn('[MIGRATION 0116] Aviso ao resetar backup jpc5w1b0o13nvim:', err)
    }
  },
  (app) => {
    // Rollback opcional
  },
)
