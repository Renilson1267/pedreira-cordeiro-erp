// Hook PocketBase para gerenciamento seguro de operadores (usuários do ERP)
// Endpoints autenticados sob /backend/v1/operadores
// NOTA: Todas as funções utilitárias ficam INLINE dentro de cada callback conforme regra de escopo da JSVM do PocketBase.

// 1. Listar operadores (somente para admin)
routerAdd(
  'GET',
  '/backend/v1/operadores',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Verificar se usuário é admin em alguma empresa
    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem gerenciar operadores' })
    }

    try {
      // Buscar todos os usuários
      const allUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "email != ''",
        '-created',
        200,
        0,
      )
      const allMembros = $app.findRecordsByFilter('empresa_membros', "id != ''", '', 1000, 0)
      const allEmpresas = $app.findRecordsByFilter('empresas', "id != ''", 'nome_fantasia', 100, 0)

      const empresaMap = {}
      for (const emp of allEmpresas) {
        empresaMap[emp.id] = {
          id: emp.id,
          nome_fantasia: emp.getString('nome_fantasia'),
          cnpj: emp.getString('cnpj'),
        }
      }

      const membrosPorUsuario = {}
      for (const m of allMembros) {
        const uid = m.getString('usuario_id')
        if (!membrosPorUsuario[uid]) {
          membrosPorUsuario[uid] = []
        }
        membrosPorUsuario[uid].push({
          id: m.id,
          empresa_id: m.getString('empresa_id'),
          empresa_nome: empresaMap[m.getString('empresa_id')]?.nome_fantasia || 'Empresa',
          role: m.getString('role'),
        })
      }

      const result = allUsers.map((u) => {
        const userMembros = membrosPorUsuario[u.id] || []
        // Preferir o papel admin se tiver, senão o primeiro papel
        const primaryMembro = userMembros.find((m) => m.role === 'admin') || userMembros[0] || null

        const ativoVal = u.get('ativo')
        const isAtivo = ativoVal === undefined || ativoVal === null ? true : Boolean(ativoVal)

        return {
          id: u.id,
          name: u.getString('name') || '',
          email: u.getString('email') || '',
          ativo: isAtivo,
          verified: u.getBool('verified'),
          created: u.getString('created'),
          updated: u.getString('updated'),
          membros: userMembros,
          role: primaryMembro?.role || 'leitura',
          empresa_id: primaryMembro?.empresa_id || '',
          empresa_nome: primaryMembro?.empresa_nome || 'Todas',
        }
      })

      return e.json(200, {
        success: true,
        operadores: result,
      })
    } catch (err) {
      console.log('Erro ao listar operadores:', err)
      return e.json(500, { error: 'Erro ao consultar operadores' })
    }
  },
  $apis.requireAuth(),
)

// 2. Criar novo operador (com senha inicial, papel e empresa padrão)
routerAdd(
  'POST',
  '/backend/v1/operadores',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem cadastrar operadores' })
    }

    const body = e.requestInfo().body || {}
    const name = (body.name || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const password = (body.password || '').trim()
    const role = body.role || 'leitura'
    const empresaId = body.empresa_id || ''

    if (!name || !email || !password) {
      return e.json(400, { error: 'Nome, email e senha inicial são obrigatórios' })
    }

    if (password.length < 8) {
      return e.json(400, { error: 'A senha inicial deve ter no mínimo 8 caracteres' })
    }

    if (!['admin', 'financeiro', 'leitura'].includes(role)) {
      return e.json(400, { error: 'Papel inválido. Escolha admin, financeiro ou leitura' })
    }

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const empresaMembrosCol = $app.findCollectionByNameOrId('empresa_membros')

    // Checar duplicidade de email
    try {
      const existing = $app.findAuthRecordByEmail('_pb_users_auth_', email)
      if (existing) {
        return e.json(400, { error: 'Já existe um operador com este email' })
      }
    } catch (_) {}

    // Validar empresa se informada, ou pegar a primeira
    let targetEmpresaId = empresaId
    if (!targetEmpresaId) {
      try {
        const prime = $app.findRecordsByFilter('empresas', "id != ''", 'created', 1, 0)
        if (prime.length > 0) targetEmpresaId = prime[0].id
      } catch (_) {}
    }

    try {
      const newUser = new Record(usersCol)
      newUser.setEmail(email)
      newUser.setPassword(password)
      newUser.setVerified(true)
      newUser.set('name', name)
      newUser.set('ativo', true)
      $app.save(newUser)

      // Criar membro na empresa principal
      if (targetEmpresaId) {
        const membro = new Record(empresaMembrosCol)
        membro.set('empresa_id', targetEmpresaId)
        membro.set('usuario_id', newUser.id)
        membro.set('role', role)
        $app.save(membro)
      }

      // Se existir a empresa Treinamento, vincular o novo operador também lá para poder treinar
      try {
        const treinoEmp = $app.findFirstRecordByData('empresas', 'cnpj', '99.999.999/0001-99')
        if (treinoEmp && treinoEmp.id !== targetEmpresaId) {
          const membroTreino = new Record(empresaMembrosCol)
          membroTreino.set('empresa_id', treinoEmp.id)
          membroTreino.set('usuario_id', newUser.id)
          membroTreino.set('role', role)
          $app.save(membroTreino)
        }
      } catch (_) {}

      // Gravar histórico de alterações (SEM registrar senha!)
      try {
        const histCol = $app.findCollectionByNameOrId('historico_alteracoes')
        const recHist = new Record(histCol)
        recHist.set('empresa_id', targetEmpresaId || '6nt8u83eiyzf6xr')
        recHist.set('colecao_origem', 'outros')
        recHist.set('registro_id', newUser.id)
        recHist.set('acao', 'criar')
        recHist.set('usuario_id', authRecord.id)
        recHist.set('usuario_nome', authRecord.getString('name') || 'Administrador')
        recHist.set('descricao', `Operador "${name}" (${email}) cadastrado com papel ${role}`)
        recHist.set('detalhes', {
          operador_nome: name,
          operador_email: email,
          role: role,
          empresa_id: targetEmpresaId,
        })
        $app.save(recHist)
      } catch (histErr) {
        console.log('Aviso ao registrar historico operador:', histErr)
      }

      return e.json(200, {
        success: true,
        operador: {
          id: newUser.id,
          name: name,
          email: email,
          role: role,
          ativo: true,
        },
      })
    } catch (err) {
      console.log('Erro ao criar operador:', err)
      return e.json(500, { error: 'Erro ao criar operador: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// 3. Atualizar operador (nome, papel, empresa padrão, status ativo/inativo)
routerAdd(
  'PUT',
  '/backend/v1/operadores',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem editar operadores' })
    }

    const body = e.requestInfo().body || {}
    const id = body.id
    const name = (body.name || '').trim()
    const role = body.role
    const ativo = body.ativo
    const empresaId = body.empresa_id

    if (!id) {
      return e.json(400, { error: 'ID do operador não fornecido' })
    }

    // Regra de segurança: usuário não pode desativar a si mesmo nem revogar seu papel admin
    if (id === authRecord.id) {
      if (ativo === false) {
        return e.json(400, { error: 'Você não pode desativar seu próprio usuário' })
      }
      if (role && role !== 'admin') {
        return e.json(400, { error: 'Você não pode revogar seu próprio papel de administrador' })
      }
    }

    try {
      const targetUser = $app.findFirstRecordByData('_pb_users_auth_', 'id', id)
      const oldName = targetUser.getString('name')
      const oldAtivo = targetUser.get('ativo') !== false
      const mudancas = []

      if (name && name !== oldName) {
        mudancas.push(`Nome alterado de "${oldName}" para "${name}"`)
        targetUser.set('name', name)
      }

      if (ativo !== undefined && ativo !== oldAtivo) {
        mudancas.push(ativo ? 'Operador ativado' : 'Operador desativado')
        targetUser.set('ativo', Boolean(ativo))
      }

      $app.save(targetUser)

      const empresaMembrosCol = $app.findCollectionByNameOrId('empresa_membros')
      const targetEmpresaId = empresaId || ''

      if (role) {
        // Atualizar papel
        const membros = $app.findRecordsByFilter(
          'empresa_membros',
          `usuario_id = '${id}'`,
          '',
          50,
          0,
        )

        if (membros.length > 0) {
          for (const m of membros) {
            const oldRole = m.getString('role')
            if (oldRole !== role) {
              m.set('role', role)
              $app.save(m)
              mudancas.push(`Papel atualizado para "${role}"`)
            }
          }
        } else if (targetEmpresaId) {
          const novoMembro = new Record(empresaMembrosCol)
          novoMembro.set('empresa_id', targetEmpresaId)
          novoMembro.set('usuario_id', id)
          novoMembro.set('role', role)
          $app.save(novoMembro)
          mudancas.push(`Papel definido como "${role}"`)
        }
      }

      // Se mudou empresa padrão e ela foi informada
      if (targetEmpresaId) {
        const memEmpresa = $app.findRecordsByFilter(
          'empresa_membros',
          `usuario_id = '${id}' && empresa_id = '${targetEmpresaId}'`,
          '',
          1,
          0,
        )
        if (memEmpresa.length === 0) {
          const novoMembro = new Record(empresaMembrosCol)
          novoMembro.set('empresa_id', targetEmpresaId)
          novoMembro.set('usuario_id', id)
          novoMembro.set('role', role || 'leitura')
          $app.save(novoMembro)
        }
      }

      // Gravar histórico de alterações
      try {
        const histCol = $app.findCollectionByNameOrId('historico_alteracoes')
        const recHist = new Record(histCol)
        recHist.set('empresa_id', targetEmpresaId || '6nt8u83eiyzf6xr')
        recHist.set('colecao_origem', 'outros')
        recHist.set('registro_id', id)
        recHist.set('acao', 'editar')
        recHist.set('usuario_id', authRecord.id)
        recHist.set('usuario_nome', authRecord.getString('name') || 'Administrador')
        recHist.set(
          'descricao',
          `Operador "${targetUser.getString('name')}": ${mudancas.join('; ') || 'Dados atualizados'}`,
        )
        recHist.set('detalhes', {
          operador_id: id,
          operador_nome: targetUser.getString('name'),
          alteracoes: mudancas,
        })
        $app.save(recHist)
      } catch (histErr) {
        console.log('Aviso ao registrar historico operador:', histErr)
      }

      return e.json(200, {
        success: true,
        operador: {
          id: targetUser.id,
          name: targetUser.getString('name'),
          email: targetUser.getString('email'),
          ativo: targetUser.get('ativo') !== false,
          role: role,
        },
      })
    } catch (err) {
      console.log('Erro ao atualizar operador:', err)
      return e.json(500, { error: 'Erro ao atualizar operador: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// 4. Redefinir senha do operador e retornar senha temporária (exibida uma única vez ao admin)
routerAdd(
  'POST',
  '/backend/v1/operadores/redefinir-senha',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem redefinir senhas' })
    }

    const body = e.requestInfo().body || {}
    const id = body.id
    if (!id) {
      return e.json(400, { error: 'ID do operador não fornecido' })
    }

    try {
      const targetUser = $app.findFirstRecordByData('_pb_users_auth_', 'id', id)
      // Gerar senha aleatória amigável e segura: e.g. "Pedreira#8392"
      const sufixoAleatorio = Math.floor(1000 + Math.random() * 9000)
      const novaSenhaTemporaria = `Pedreira@${sufixoAleatorio}`

      targetUser.setPassword(novaSenhaTemporaria)
      $app.save(targetUser)

      // Registrar histórico SEM a senha
      try {
        const histCol = $app.findCollectionByNameOrId('historico_alteracoes')
        const recHist = new Record(histCol)
        recHist.set('empresa_id', '6nt8u83eiyzf6xr')
        recHist.set('colecao_origem', 'outros')
        recHist.set('registro_id', id)
        recHist.set('acao', 'editar')
        recHist.set('usuario_id', authRecord.id)
        recHist.set('usuario_nome', authRecord.getString('name') || 'Administrador')
        recHist.set(
          'descricao',
          `Senha temporária gerada pelo administrador para o operador "${targetUser.getString('name')}" (${targetUser.getString('email')})`,
        )
        recHist.set('detalhes', {
          operador_id: id,
          operador_nome: targetUser.getString('name'),
          operador_email: targetUser.getString('email'),
          acao_realizada: 'redefinir_senha_temporaria',
        })
        $app.save(recHist)
      } catch (histErr) {
        console.log('Aviso ao registrar historico operador:', histErr)
      }

      return e.json(200, {
        success: true,
        tempPassword: novaSenhaTemporaria,
        email: targetUser.getString('email'),
        name: targetUser.getString('name'),
      })
    } catch (err) {
      console.log('Erro ao redefinir senha:', err)
      return e.json(500, { error: 'Erro ao redefinir senha: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)
