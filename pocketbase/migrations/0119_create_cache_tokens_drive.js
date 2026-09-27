// Migração 0119: Criar coleção dedicada cache_tokens_drive para garantir persistência
// isolada do token OAuth Google Drive entre rodadas do cron sem depender de config_google_drive.detalhes.
// Também reseta o backup 'jpc5w1b0o13nvim' para drive_status='solicitado', drive_tentativas=0, drive_offset=0.

migrate(
  (app) => {
    // 1. Criar coleção dedicada cache_tokens_drive se não existir
    let cacheCol = null
    try {
      cacheCol = app.findCollectionByNameOrId('cache_tokens_drive')
    } catch (_) {
      cacheCol = new Collection({
        name: 'cache_tokens_drive',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'chave', type: 'text', required: true },
          { name: 'access_token', type: 'text' },
          { name: 'expiry_ms', type: 'number' },
          { name: 'client_email', type: 'text' },
          { name: 'detalhes', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_cache_tokens_drive_chave ON cache_tokens_drive (chave)'],
      })
      app.save(cacheCol)
    }

    // Se já tiver token válido salvo em config_google_drive.detalhes, migra para o cache_tokens_drive
    try {
      const cfgRec = app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (cfgRec) {
        let rawDet = cfgRec.get('detalhes')
        let det = null
        try {
          det = typeof rawDet === 'string' ? JSON.parse(rawDet) : rawDet
        } catch (_) {
          det = null
        }
        if (det && det.cached_token && det.cached_expiry_ms) {
          let cacheRec = null
          try {
            cacheRec = app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
          } catch (_) {
            cacheRec = new Record(cacheCol)
            cacheRec.set('chave', 'google_drive_sa')
          }
          cacheRec.set('access_token', det.cached_token)
          cacheRec.set('expiry_ms', Number(det.cached_expiry_ms) || 0)
          cacheRec.set('client_email', cfgRec.getString('client_email') || '')
          app.save(cacheRec)
        }
      }
    } catch (_) {}

    // 2. Resetar o backup 'jpc5w1b0o13nvim' para retomada imediata pelo cron
    try {
      const backupRec = app.findFirstRecordByData('backups_sistema', 'id', 'jpc5w1b0o13nvim')
      if (backupRec) {
        backupRec.set('drive_status', 'solicitado')
        backupRec.set('drive_tentativas', 0)
        backupRec.set('drive_offset', 0)
        backupRec.set('drive_erro', '')
        app.save(backupRec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('cache_tokens_drive')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
