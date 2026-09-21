routerAdd(
  'POST',
  '/backend/v1/convites',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const body = e.requestInfo().body || {}
    const empresaId = body.empresa_id
    const email = (body.email || '').trim().toLowerCase()
    const role = body.role || 'financeiro'

    if (!empresaId || !email) {
      return e.json(400, { error: 'empresa_id e email são obrigatórios' })
    }

    // Check if current user is admin of this company
    try {
      const membros = $app.findRecordsByFilter(
        'empresa_membros',
        `empresa_id = '${empresaId}' && usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      if (!membros || membros.length === 0) {
        return e.json(403, { error: 'Apenas administradores podem convidar membros' })
      }
    } catch (err) {
      return e.json(403, { error: 'Permissão insuficiente para esta empresa' })
    }

    const token = $security.randomString(32)
    const convitesCol = $app.findCollectionByNameOrId('empresa_convites')
    const record = new Record(convitesCol)
    record.set('empresa_id', empresaId)
    record.set('email', email)
    record.set('role', role)
    record.set('token', token)
    record.set('status', 'Pendente')
    $app.save(record)

    return e.json(200, {
      success: true,
      convite: {
        id: record.id,
        email: email,
        role: role,
        token: token,
        empresa_id: empresaId,
      },
    })
  },
  $apis.requireAuth(),
)
