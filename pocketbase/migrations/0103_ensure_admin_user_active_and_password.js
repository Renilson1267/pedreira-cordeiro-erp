migrate(
  (app) => {
    // Reativar usuário administrador principal caso tenha sido desativado inadvertidamente
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'gcmixsje@gmail.com')
      if (adminUser) {
        adminUser.set('ativo', true)
        adminUser.setVerified(true)
        adminUser.setPassword('Skip@Pass')
        app.save(adminUser)
      }
    } catch (err) {
      console.log('Aviso ao reativar usuário gcmixsje@gmail.com:', err)
    }
  },
  (app) => {
    // Reversão
  },
)
