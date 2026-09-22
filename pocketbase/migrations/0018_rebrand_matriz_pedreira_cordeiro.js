migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresaMembrosCol = app.findCollectionByNameOrId('empresa_membros')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const cnpjFormatado = '05.581.899/0001-05'
    const cnpjSemPontuacao = '05581899000105'
    const nomeFantasia = 'Grupo Pedreira Cordeiro'
    const razaoSocial = 'G C DO AMARAL SERTANIA'

    // 1. Localizar ou obter o usuário administrador padrão gcmixsje@gmail.com
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'gcmixsje@gmail.com')
      if (adminUser.get('name') === 'Administrador NovaGest') {
        adminUser.set('name', 'Administrador Pedreira Cordeiro')
        app.save(adminUser)
      }
    } catch (_) {
      try {
        adminUser = new Record(usersCol)
        adminUser.setEmail('gcmixsje@gmail.com')
        adminUser.setPassword('Skip@Pass')
        adminUser.setVerified(true)
        adminUser.set('name', 'Administrador Pedreira Cordeiro')
        app.save(adminUser)
      } catch (e) {
        console.log('Admin user seed notice:', e)
      }
    }

    // 2. Verificar se a empresa com o novo CNPJ já existe (formatado ou raw)
    let matrizEmpresa = null
    try {
      matrizEmpresa = app.findFirstRecordByData('empresas', 'cnpj', cnpjFormatado)
    } catch (_) {
      try {
        matrizEmpresa = app.findFirstRecordByData('empresas', 'cnpj', cnpjSemPontuacao)
      } catch (_) {}
    }

    if (!matrizEmpresa) {
      // Verificar se existe a matriz semeada anterior (ex: 00.000.000/0001-00 ou NovaGest Principal ou GC do Amaral)
      let oldMatriz = null
      try {
        oldMatriz = app.findFirstRecordByData('empresas', 'cnpj', '00.000.000/0001-00')
      } catch (_) {
        try {
          const recs = app.findRecordsByFilter(
            'empresas',
            "nome_fantasia ~ 'NovaGest' || nome_fantasia ~ 'Amaral'",
            '+created',
            1,
            0,
          )
          if (recs.length > 0) {
            oldMatriz = recs[0]
          }
        } catch (_) {}
      }

      if (oldMatriz) {
        // Atualizar matriz existente para manter todas as relações filhas (produtos, frotas, contas, membros)
        oldMatriz.set('nome_fantasia', nomeFantasia)
        oldMatriz.set('razao_social', razaoSocial)
        oldMatriz.set('cnpj', cnpjFormatado)
        if (!oldMatriz.get('cor')) {
          oldMatriz.set('cor', '#0F766E')
        }
        app.save(oldMatriz)
        matrizEmpresa = oldMatriz
      } else {
        // Se não houver matriz anterior para atualizar, criar a matriz principal
        const nova = new Record(empresasCol)
        nova.set('nome_fantasia', nomeFantasia)
        nova.set('razao_social', razaoSocial)
        nova.set('cnpj', cnpjFormatado)
        nova.set('cor', '#0F766E')
        app.save(nova)
        matrizEmpresa = nova
      }
    } else {
      // Já existe registro com o CNPJ, atualizar dados cadastrais se necessário
      matrizEmpresa.set('nome_fantasia', nomeFantasia)
      matrizEmpresa.set('razao_social', razaoSocial)
      matrizEmpresa.set('cnpj', cnpjFormatado)
      app.save(matrizEmpresa)
    }

    // 3. Garantir vínculo do usuário administrador gcmixsje@gmail.com com a matriz como admin
    if (adminUser && matrizEmpresa) {
      try {
        const membrosExistentes = app.findRecordsByFilter(
          'empresa_membros',
          `empresa_id = '${matrizEmpresa.id}' && usuario_id = '${adminUser.id}'`,
          '',
          1,
          0,
        )
        if (membrosExistentes.length === 0) {
          const membro = new Record(empresaMembrosCol)
          membro.set('empresa_id', matrizEmpresa.id)
          membro.set('usuario_id', adminUser.id)
          membro.set('role', 'admin')
          app.save(membro)
        } else {
          const membro = membrosExistentes[0]
          membro.set('role', 'admin')
          app.save(membro)
        }
      } catch (err) {
        console.log('Membro seed notice:', err)
      }
    }
  },
  (app) => {
    // Reversão defensiva (opcional - não deleta dados em produção)
  },
)
