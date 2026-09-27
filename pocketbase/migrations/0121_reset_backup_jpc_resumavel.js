// Migração 0121: Resetar backup jpc5w1b0o13nvim de volta para 'solicitado'
// limpando drive_session_url existente para que o hook crie uma nova sessão
// resumível limpa e envie o arquivo completo.

migrate(
  (app) => {
    try {
      const bkp = app.findFirstRecordByData('backups_sistema', 'id', 'jpc5w1b0o13nvim')
      if (bkp) {
        bkp.set('drive_status', 'solicitado')
        bkp.set('drive_tentativas', 0)
        bkp.set('drive_offset', 0)
        bkp.set('drive_session_url', '')
        bkp.set('drive_erro', '')
        app.save(bkp)
      }
    } catch (_) {}
  },
  () => {},
)
