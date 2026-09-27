// Migração 0120: Resetar e disparar backup jpc5w1b0o13nvim para execução na fila
// e popular o cache_tokens_drive a partir do token atualmente ativo em config_google_drive.detalhes

migrate(
  (app) => {
    // 1. Popular cache_tokens_drive com o token ativo de config_google_drive
    try {
      const cfg = app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (cfg) {
        let rawDet = cfg.get('detalhes')
        let det = null
        try {
          det = typeof rawDet === 'string' ? JSON.parse(rawDet) : rawDet
        } catch (_) {
          det = null
        }
        if (det && det.cached_token && det.cached_expiry_ms) {
          let cRec = null
          try {
            cRec = app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
          } catch (_) {
            const col = app.findCollectionByNameOrId('cache_tokens_drive')
            cRec = new Record(col)
            cRec.set('chave', 'google_drive_sa')
          }
          cRec.set('access_token', det.cached_token)
          cRec.set('expiry_ms', Number(det.cached_expiry_ms) || 0)
          cRec.set('client_email', cfg.getString('client_email') || '')
          cRec.set('detalhes', det)
          app.save(cRec)
        }
      }
    } catch (_) {}

    // 2. Garantir backup jpc5w1b0o13nvim pronto para o cron
    try {
      const bkp = app.findFirstRecordByData('backups_sistema', 'id', 'jpc5w1b0o13nvim')
      if (bkp) {
        bkp.set('drive_status', 'solicitado')
        bkp.set('drive_tentativas', 0)
        bkp.set('drive_offset', 0)
        bkp.set('drive_erro', '')
        app.save(bkp)
      }
    } catch (_) {}
  },
  () => {},
)
