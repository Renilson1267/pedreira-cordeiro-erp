migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Adicionar campo empresa_padrao_id como RelationField -> empresas (maxSelect: 1)
    if (!usersCol.fields.getByName('empresa_padrao_id')) {
      usersCol.fields.add(
        new RelationField({
          name: 'empresa_padrao_id',
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(usersCol)
    }

    // 2. Preencher empresa_padrao_id para usuários existentes com base em empresa_membros
    try {
      const matrizEmpresa = app.findFirstRecordByData('empresas', 'cnpj', '05.581.899/0001-05')
      const allUsers = app.findRecordsByFilter('_pb_users_auth_', "email != ''", '', 200, 0)
      for (const u of allUsers) {
        if (!u.getString('empresa_padrao_id')) {
          // Procurar membros do usuário
          const userMembros = app.findRecordsByFilter(
            'empresa_membros',
            `usuario_id = '${u.id}'`,
            '-created',
            50,
            0,
          )

          let chosenEmpresaId = ''
          // Se tiver vínculo com a matriz, prioriza a matriz
          const membroMatriz = userMembros.find(
            (m) => matrizEmpresa && m.getString('empresa_id') === matrizEmpresa.id,
          )
          if (membroMatriz) {
            chosenEmpresaId = membroMatriz.getString('empresa_id')
          } else if (userMembros.length > 0) {
            chosenEmpresaId = userMembros[0].getString('empresa_id')
          } else if (matrizEmpresa) {
            chosenEmpresaId = matrizEmpresa.id
          }

          if (chosenEmpresaId) {
            u.set('empresa_padrao_id', chosenEmpresaId)
            app.save(u)
          }
        }
      }
    } catch (e) {
      console.log('Aviso ao inicializar empresa_padrao_id em users:', e)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('empresa_padrao_id')) {
        usersCol.fields.removeByName('empresa_padrao_id')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
