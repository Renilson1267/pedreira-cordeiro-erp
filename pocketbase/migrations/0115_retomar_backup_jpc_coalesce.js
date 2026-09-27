migrate(
  (app) => {
    try {
      const backup = app.findFirstRecordByData('backups_sistema', 'id', 'jpc5w1b0o13nvim')
      backup.set('drive_status', 'solicitado')
      backup.set('drive_tentativas', 0)
      backup.set('drive_erro', 'Retomando envio após correção de COALESCE no cálculo de bytes...')
      app.save(backup)
    } catch (e) {
      console.log('Erro ao atualizar backup jpc5w1b0o13nvim na migração 0115:', e)
    }
  },
  (app) => {
    // noop
  },
)
