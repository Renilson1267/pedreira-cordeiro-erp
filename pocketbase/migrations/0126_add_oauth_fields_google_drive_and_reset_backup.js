migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('config_google_drive')

    if (!col.fields.getByName('oauth_client_id')) {
      col.fields.add(new TextField({ name: 'oauth_client_id' }))
    }
    if (!col.fields.getByName('oauth_client_secret')) {
      col.fields.add(new TextField({ name: 'oauth_client_secret' }))
    }
    if (!col.fields.getByName('oauth_refresh_token')) {
      col.fields.add(new TextField({ name: 'oauth_refresh_token' }))
    }
    if (!col.fields.getByName('oauth_status')) {
      col.fields.add(new TextField({ name: 'oauth_status' }))
    }

    app.save(col)

    // Reset do backup semanal jpc5w1b0o13nvim para a fila pegar de imediato com a nova autenticação
    try {
      app
        .db()
        .newQuery(`
      UPDATE backups_sistema
      SET drive_status = 'solicitado',
          drive_tentativas = 0,
          drive_offset = 0,
          drive_session_url = '',
          drive_erro = ''
      WHERE id = 'jpc5w1b0o13nvim'
    `)
        .execute()
    } catch (eReset) {
      console.warn('Aviso ao resetar backup jpc5w1b0o13nvim na migração 0126:', eReset)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('config_google_drive')
      col.fields.removeByName('oauth_client_id')
      col.fields.removeByName('oauth_client_secret')
      col.fields.removeByName('oauth_refresh_token')
      col.fields.removeByName('oauth_status')
      app.save(col)
    } catch (_) {}
  },
)
