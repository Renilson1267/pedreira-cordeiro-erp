// Migração 0104: Atualizar config_google_drive para autenticação por Conta de Serviço (Service Account)
migrate(
  (app) => {
    let configCol = app.findCollectionByNameOrId('config_google_drive')

    // 1. Proteger leitura direta da collection (apenas admins através dos endpoints pb_hooks dedicados)
    // Fechar regras diretas ou limitar leitura
    configCol.listRule = null
    configCol.viewRule = null
    configCol.createRule = null
    configCol.updateRule = null
    configCol.deleteRule = null

    // 2. Adicionar novos campos para Conta de Serviço se não existirem
    if (!configCol.fields.getByName('service_account_json')) {
      configCol.fields.add(
        new TextField({
          name: 'service_account_json',
          required: false,
        }),
      )
    }

    if (!configCol.fields.getByName('client_email')) {
      configCol.fields.add(
        new TextField({
          name: 'client_email',
          required: false,
        }),
      )
    }

    if (!configCol.fields.getByName('project_id')) {
      configCol.fields.add(
        new TextField({
          name: 'project_id',
          required: false,
        }),
      )
    }

    if (!configCol.fields.getByName('private_key_id')) {
      configCol.fields.add(
        new TextField({
          name: 'private_key_id',
          required: false,
        }),
      )
    }

    if (!configCol.fields.getByName('auth_type')) {
      configCol.fields.add(
        new SelectField({
          name: 'auth_type',
          values: ['service_account', 'oauth', 'none'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(configCol)

    // 3. Limpar valores de OAuth anteriores no registro padrão se existir
    try {
      const padrao = app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (padrao) {
        padrao.set('auth_type', 'service_account')
        padrao.set('refresh_token', '')
        padrao.set('client_id', '')
        padrao.set('client_secret', '')
        padrao.set('account_name', '')
        padrao.set('ultimo_status', 'desconectado')
        app.save(padrao)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const configCol = app.findCollectionByNameOrId('config_google_drive')
      configCol.listRule = "@request.auth.id != ''"
      configCol.viewRule = "@request.auth.id != ''"
      configCol.createRule = "@request.auth.id != ''"
      configCol.updateRule = "@request.auth.id != ''"
      configCol.deleteRule = "@request.auth.id != ''"
      configCol.fields.removeByName('service_account_json')
      configCol.fields.removeByName('client_email')
      configCol.fields.removeByName('project_id')
      configCol.fields.removeByName('private_key_id')
      configCol.fields.removeByName('auth_type')
      app.save(configCol)
    } catch (_) {}
  },
)
