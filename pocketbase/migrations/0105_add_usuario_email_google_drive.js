// Migração 0105: Adicionar campo usuario_email na config_google_drive para compartilhamento automático
migrate(
  (app) => {
    const configCol = app.findCollectionByNameOrId('config_google_drive')

    if (!configCol.fields.getByName('usuario_email')) {
      configCol.fields.add(
        new TextField({
          name: 'usuario_email',
          required: false,
        }),
      )
    }

    app.save(configCol)

    // Preencher registro padrao existente com o email do usuário
    try {
      const padrao = app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (padrao) {
        const atual = padrao.getString('usuario_email')
        if (!atual) {
          padrao.set('usuario_email', 'renilsonfmello@gmail.com')
          app.save(padrao)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const configCol = app.findCollectionByNameOrId('config_google_drive')
      configCol.fields.removeByName('usuario_email')
      app.save(configCol)
    } catch (_) {}
  },
)
