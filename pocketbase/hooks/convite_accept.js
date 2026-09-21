routerAdd(
  'POST',
  '/backend/v1/convites/aceitar',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Faça login ou cadastre-se para aceitar o convite' })
    }

    const body = e.requestInfo().body || {}
    const token = body.token

    if (!token) {
      return e.json(400, { error: 'Token de convite não informado' })
    }

    let convite
    try {
      convite = $app.findFirstRecordByData('empresa_convites', 'token', token)
    } catch (err) {
      return e.json(404, { error: 'Convite não encontrado ou inválido' })
    }

    if (convite.getString('status') !== 'Pendente') {
      return e.json(400, { error: 'Este convite já foi utilizado ou expirou' })
    }

    const empresaId = convite.getString('empresa_id')
    const role = convite.getString('role') || 'financeiro'

    // Check if member already exists
    const membrosCol = $app.findCollectionByNameOrId('empresa_membros')
    let membro
    try {
      const existing = $app.findRecordsByFilter(
        'empresa_membros',
        `empresa_id = '${empresaId}' && usuario_id = '${authRecord.id}'`,
        '',
        1,
        0,
      )
      if (existing && existing.length > 0) {
        membro = existing[0]
        membro.set('role', role)
        $app.save(membro)
      } else {
        membro = new Record(membrosCol)
        membro.set('empresa_id', empresaId)
        membro.set('usuario_id', authRecord.id)
        membro.set('role', role)
        $app.save(membro)
      }
    } catch (err) {
      return e.json(500, { error: 'Erro ao vincular membro à empresa' })
    }

    // Mark convite as Aceito
    convite.set('status', 'Aceito')
    $app.save(convite)

    let empresa
    try {
      empresa = $app.findCollectionByNameOrId('empresas')
      const empRecord = $app.findFirstRecordByData('empresas', 'id', empresaId)
      return e.json(200, {
        success: true,
        membro: {
          id: membro.id,
          role: role,
          empresa_id: empresaId,
        },
        empresa: {
          id: empRecord.id,
          nome_fantasia: empRecord.getString('nome_fantasia'),
        },
      })
    } catch (_) {
      return e.json(200, {
        success: true,
        membro: {
          id: membro.id,
          role: role,
          empresa_id: empresaId,
        },
      })
    }
  },
  $apis.requireAuth(),
)
