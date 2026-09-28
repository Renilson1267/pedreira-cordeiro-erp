migrate(
  (app) => {
    // 1. Limpar o campo detalhes de config_google_drive (chave='padrao'), deixando apenas metadados pequenos
    try {
      const metadata = JSON.stringify({
        oauth_last_redirect_uri:
          'https://erp-empresarial-completo-575bb.goskip.app/backend/v1/google-drive/oauth-callback',
        oauth_status: 'conectado',
        limpo_em: new Date().toISOString(),
      })

      app
        .db()
        .newQuery("UPDATE config_google_drive SET detalhes = {:meta} WHERE chave = 'padrao'")
        .bind({ meta: metadata })
        .execute()
      console.log('Migração 0127: campo detalhes de config_google_drive limpo com sucesso!')
    } catch (eDet) {
      console.error('Migração 0127: Erro ao limpar detalhes em config_google_drive:', eDet)
    }

    // 2. Rearmar o backup semanal jpc5w1b0o13nvim:
    // drive_status='solicitado', drive_erro='', drive_tentativas=0, drive_offset=0, drive_session_url=''
    // (preserva o conteúdo íntegro em backups_dados)
    try {
      app
        .db()
        .newQuery(
          "UPDATE backups_sistema SET drive_status = 'solicitado', drive_erro = '', drive_tentativas = 0, drive_offset = 0, drive_session_url = '' WHERE id = 'jpc5w1b0o13nvim'",
        )
        .execute()
      console.log('Migração 0127: Backup jpc5w1b0o13nvim rearmado com drive_status = "solicitado"!')
    } catch (eBkp) {
      console.error('Migração 0127: Erro ao rearmar backup jpc5w1b0o13nvim:', eBkp)
    }
  },
  (app) => {
    // Reversão no-op
  },
)
