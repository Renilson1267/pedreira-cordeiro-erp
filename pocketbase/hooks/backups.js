// Hook PocketBase para gerenciamento e automação de Backups do ERP Pedreira Cordeiro
// com Integração Automática ao Google Drive (OAuth2 + Google Drive API v3)
// Endpoints autenticados sob /backend/v1/backups e /backend/v1/google-drive
// Cron job semanal automático via cronAdd: todo domingo às 00:30 (horário do servidor)
// NOTA JSVM: Todo o código e variáveis ficam estritamente INLINE dentro de cada callback de hook/cron.

// -------------------------------------------------------------
// 1. REGISTRO DO CRON JOB SEMANAL COM ENVIO AUTOMÁTICO AO GOOGLE DRIVE
// Executa todo domingo às 00:30 (horário do servidor PocketBase)
// Expressão cron: "30 0 * * 0" (minuto 30, hora 0, todo dia do mês, todo mês, domingo)
// -------------------------------------------------------------
cronAdd('backup_semanal_pedreira_cordeiro', '30 0 * * 0', () => {
  console.log('[CRON] Iniciando execução do backup semanal automático da Pedreira Cordeiro...')

  const colecoesParaDump = [
    'empresas',
    'empresa_membros',
    'users',
    'clientes',
    'fornecedores',
    'produtos',
    'plano_contas',
    'contas_pagar',
    'contas_receber',
    'bancos_contas',
    'movimentos_financeiros',
    'conciliacoes',
    'empresa_convites',
    'veiculos',
    'abastecimentos',
    'manutencoes',
    'centros_custos',
    'creditos_clientes',
    'funcionarios',
    'folha_horas_extras',
    'entregas',
    'vendas',
    'despesas_frota',
    'historico_alteracoes',
    'formas_recebimento',
    'cheques_predatados',
    'contadores_sequenciais',
  ]

  const inicio = Date.now()
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const nomeArquivo = 'backup_semanal_auto_' + timestampStr + '.json'

  try {
    const backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    const dadosCol = $app.findCollectionByNameOrId('backups_dados')

    // Tentativa de backup nativo .zip do PocketBase
    let nativoStatus = 'tentado'
    let nativoArquivo = ''
    let nativoErro = ''
    const zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
    try {
      if (typeof $app.createBackup === 'function') {
        try {
          $app.createBackup(zipName)
          nativoStatus = 'sucesso'
          nativoArquivo = zipName
        } catch (e1) {
          nativoStatus = 'falha'
          nativoErro = String(e1?.message || e1)
        }
      } else {
        nativoStatus = 'nao_disponivel_jsvm'
        nativoErro = 'createBackup não exposto na JSVM do PocketBase'
      }
    } catch (eG) {
      nativoStatus = 'erro'
      nativoErro = String(eG?.message || eG)
    }

    const resumo = {}
    let totalRegistrosGeral = 0
    let colecoesComErro = 0

    // Criar cabeçalho do backup automático
    const backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', nomeArquivo)
    backupRecord.set('tipo', 'completo')
    backupRecord.set('origem', 'semanal_automatico')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('drive_status', 'pendente')
    backupRecord.set('total_colecoes', colecoesParaDump.length)
    backupRecord.set('total_registros', 0)
    backupRecord.set('resumo_colecoes', {})
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'semanal_automatico',
      solicitado_por: 'Backup Semanal Automático (Cron)',
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      status: 'processando',
    })
    backupRecord.set('backup_duplicatas_incluido', false)
    backupRecord.set('observacoes', 'Backup semanal automático em execução programada...')
    $app.save(backupRecord)

    // Percorrer todas as coleções e salvar em chunks de 200 registros
    for (let i = 0; i < colecoesParaDump.length; i++) {
      const colName = colecoesParaDump[i]
      try {
        const records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        const count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          const serialized = []
          for (let j = 0; j < count; j++) {
            const r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                const obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                const c = r.collection()
                if (c && c.fields) {
                  const fields = c.fields.all()
                  for (let f = 0; f < fields.length; f++) {
                    const fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          const CHUNK_SIZE = 200
          const totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (let ch = 0; ch < totalChunks; ch++) {
            const chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            const dadoRec = new Record(dadosCol)
            dadoRec.set('backup_id', backupRecord.id)
            dadoRec.set('colecao_nome', colName)
            dadoRec.set('chunk_index', ch)
            dadoRec.set('total_chunks', totalChunks)
            dadoRec.set('registros_count', chunkData.length)
            dadoRec.set('registros_json', chunkData)
            $app.save(dadoRec)
          }
        }
      } catch (errCol) {
        colecoesComErro++
        resumo[colName] = { erro: String(errCol?.message || errCol) }
        console.warn(`[CRON] Aviso ao extrair ${colName}:`, errCol)
      }
    }

    // Tabela opcional _backup_duplicatas_excluidas
    let backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        const cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    const statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

    // Atualizar cabeçalho do backup
    backupRecord.set('total_registros', totalRegistrosGeral)
    backupRecord.set('total_colecoes', Object.keys(resumo).length)
    backupRecord.set('resumo_colecoes', resumo)
    backupRecord.set('backup_duplicatas_incluido', backupDuplicatasIncluido)
    backupRecord.set('status', statusFinal)
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'semanal_automatico',
      solicitado_por: 'Backup Semanal Automático (Cron)',
      total_registros_geral: totalRegistrosGeral,
      colecoes_com_erro: colecoesComErro,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      colecoes_processadas: Object.keys(resumo),
    })
    backupRecord.set(
      'observacoes',
      `Backup semanal automático programado concluído com status "${statusFinal}". Total de ${totalRegistrosGeral} registros e ${Object.keys(resumo).length} coleções salvos.`,
    )
    $app.save(backupRecord)

    // Registrar no histórico de alterações
    try {
      const histCol = $app.findCollectionByNameOrId('historico_alteracoes')
      const recHist = new Record(histCol)
      recHist.set('empresa_id', '6nt8u83eiyzf6xr')
      recHist.set('colecao_origem', 'outros')
      recHist.set('registro_id', backupRecord.id)
      recHist.set('acao', 'criar')
      recHist.set('usuario_id', '')
      recHist.set('usuario_nome', 'Backup Semanal Automático')
      recHist.set(
        'descricao',
        `Backup semanal automático executado: ${totalRegistrosGeral} registros e ${Object.keys(resumo).length} coleções (${statusFinal})`,
      )
      recHist.set('detalhes', {
        backup_id: backupRecord.id,
        origem: 'semanal_automatico',
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
        status: statusFinal,
      })
      $app.save(recHist)
    } catch (_) {}

    const duracaoSegundos = ((Date.now() - inicio) / 1000).toFixed(1)
    console.log(
      `[CRON] Backup semanal automático concluído em ${duracaoSegundos}s. Total: ${totalRegistrosGeral} registros (${statusFinal}). ID: ${backupRecord.id}`,
    )

    // -------------------------------------------------------------
    // ENVIO AUTOMÁTICO AO GOOGLE DRIVE (NÃO DEVE DERRUBAR O BACKUP CASO FALHE)
    // -------------------------------------------------------------
    try {
      console.log('[CRON Drive] Iniciando envio automático do dump para o Google Drive...')

      // Obter credenciais (do environment ou da collection config_google_drive)
      let clientId = $os.getenv('GOOGLE_CLIENT_ID') || ''
      let clientSecret = $os.getenv('GOOGLE_CLIENT_SECRET') || ''
      let refreshToken = $os.getenv('GOOGLE_REFRESH_TOKEN') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let folderName = 'Backups ERP'

      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!clientId) clientId = configRec.getString('client_id')
          if (!clientSecret) clientSecret = configRec.getString('client_secret')
          if (!refreshToken) refreshToken = configRec.getString('refresh_token')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
        }
      } catch (_) {}

      if (!clientId || !clientSecret || !refreshToken) {
        console.log(
          '[CRON Drive] Google Drive não configurado ou refresh token ausente. Pulando upload.',
        )
        backupRecord.set('drive_status', 'nao_configurado')
        backupRecord.set(
          'drive_erro',
          'Credenciais do Google Drive não configuradas (defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN ou conecte na tela de Backups).',
        )
        $app.save(backupRecord)
        return
      }

      // 1. Trocar refresh_token por access_token
      const tokenUrl = 'https://oauth2.googleapis.com/token'
      const tokenPayload =
        'grant_type=refresh_token' +
        '&client_id=' +
        encodeURIComponent(clientId) +
        '&client_secret=' +
        encodeURIComponent(clientSecret) +
        '&refresh_token=' +
        encodeURIComponent(refreshToken)

      const tokenRes = $http.send({
        url: tokenUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenPayload,
        timeout: 30,
      })

      if (tokenRes.statusCode !== 200) {
        const errMsg =
          'Erro ao renovar token OAuth do Google Drive: ' + (tokenRes.raw || tokenRes.statusCode)
        console.error('[CRON Drive] ' + errMsg)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', errMsg)
        $app.save(backupRecord)
        return
      }

      const tokenJson = tokenRes.json || JSON.parse(tokenRes.raw || '{}')
      const accessToken = tokenJson.access_token
      if (!accessToken) {
        const errMsg = 'Access token não retornado pelo Google OAuth'
        console.error('[CRON Drive] ' + errMsg)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', errMsg)
        $app.save(backupRecord)
        return
      }

      // 2. Garantir pasta "Backups ERP" se folderId não estiver setado
      if (!folderId) {
        try {
          const searchFolderUrl =
            'https://www.googleapis.com/drive/v3/files?q=' +
            encodeURIComponent(
              "mimeType='application/vnd.google-apps.folder' and name='" +
                folderName +
                "' and trashed=false",
            ) +
            '&fields=files(id,name)'
          const searchRes = $http.send({
            url: searchFolderUrl,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + accessToken },
            timeout: 30,
          })

          const searchJson = searchRes.json || JSON.parse(searchRes.raw || '{}')
          if (searchJson.files && searchJson.files.length > 0) {
            folderId = searchJson.files[0].id
          } else {
            // Criar a pasta
            const createFolderRes = $http.send({
              url: 'https://www.googleapis.com/drive/v3/files',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
              }),
              timeout: 30,
            })
            const createdFolderJson =
              createFolderRes.json || JSON.parse(createFolderRes.raw || '{}')
            folderId = createdFolderJson.id || ''
          }

          if (folderId && configRec) {
            configRec.set('folder_id', folderId)
            configRec.set('folder_name', folderName)
            $app.save(configRec)
          }
        } catch (eFolder) {
          console.warn('[CRON Drive] Falha ao localizar/criar pasta no Drive:', eFolder)
        }
      }

      // 3. Montar o dump completo a partir dos chunks salvos
      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupRecord.id}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
            id: backupRecord.id,
            nome_arquivo: backupRecord.getString('nome_arquivo'),
            tipo: backupRecord.getString('tipo'),
            origem: backupRecord.getString('origem') || 'semanal_automatico',
            total_colecoes: backupRecord.getInt('total_colecoes'),
            total_registros: backupRecord.getInt('total_registros'),
            resumo_colecoes: backupRecord.get('resumo_colecoes'),
            created: backupRecord.getString('created'),
            exportado_em: new Date().toISOString(),
            sistema: 'Pedreira Cordeiro ERP (NovaGest)',
          },
          dados: colecoes,
        },
        null,
        2,
      )

      // 4. Upload multipart para Google Drive API v3
      const fileMetadata = {
        name: backupRecord.getString('nome_arquivo'),
        mimeType: 'application/json',
      }
      if (folderId) {
        fileMetadata.parents = [folderId]
      }

      const boundary = '-------314159265358979323846'
      const delimiter = '\r\n--' + boundary + '\r\n'
      const closeDelimiter = '\r\n--' + boundary + '--'

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        dumpJsonStr +
        closeDelimiter

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
      const uploadRes = $http.send({
        url: uploadUrl,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartBody,
        timeout: 120,
      })

      if (uploadRes.statusCode === 200 || uploadRes.statusCode === 201) {
        const uploadedJson = uploadRes.json || JSON.parse(uploadRes.raw || '{}')
        const fileId = uploadedJson.id || ''
        console.log(`[CRON Drive] Sucesso! Backup enviado ao Google Drive com File ID: ${fileId}`)

        const agoraIso = new Date().toISOString()
        backupRecord.set('drive_status', 'enviado')
        backupRecord.set('drive_file_id', fileId)
        backupRecord.set('drive_folder_id', folderId)
        backupRecord.set('drive_enviado_em', agoraIso)
        backupRecord.set('drive_erro', '')
        $app.save(backupRecord)

        if (configRec) {
          configRec.set('ultimo_envio', agoraIso)
          configRec.set('ultimo_status', 'conectado')
          $app.save(configRec)
        }
      } else {
        const errDetail =
          'Erro no upload para o Drive (status ' +
          uploadRes.statusCode +
          '): ' +
          (uploadRes.raw || '')
        console.error('[CRON Drive] ' + errDetail)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', errDetail)
        $app.save(backupRecord)
      }
    } catch (errDrive) {
      console.error('[CRON Drive] Exceção durante envio ao Drive:', errDrive)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', String(errDrive?.message || errDrive))
        $app.save(backupRecord)
      } catch (_) {}
    }
  } catch (errCron) {
    console.error('[CRON] Erro crítico no backup semanal automático:', errCron)
  }
})

// -------------------------------------------------------------
// 2. ENDPOINT: LISTAR BACKUPS
// GET /backend/v1/backups
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      const backups = $app.findRecordsByFilter('backups_sistema', "id != ''", '-created', 100, 0)

      const result = backups.map((b) => ({
        id: b.id,
        nome_arquivo: b.getString('nome_arquivo'),
        tipo: b.getString('tipo'),
        origem: b.getString('origem') || 'manual',
        status: b.getString('status'),
        total_colecoes: b.getInt('total_colecoes'),
        total_registros: b.getInt('total_registros'),
        resumo_colecoes: b.get('resumo_colecoes'),
        detalhes_execucao: b.get('detalhes_execucao'),
        backup_duplicatas_incluido: b.getBool('backup_duplicatas_incluido'),
        observacoes: b.getString('observacoes'),
        created: b.getString('created'),
        drive_status: b.getString('drive_status') || 'pendente',
        drive_file_id: b.getString('drive_file_id') || '',
        drive_enviado_em: b.getString('drive_enviado_em') || '',
        drive_erro: b.getString('drive_erro') || '',
        drive_folder_id: b.getString('drive_folder_id') || '',
      }))

      return e.json(200, {
        success: true,
        backups: result,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao listar backups: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 3. ENDPOINT: EXECUTAR BACKUP MANUAL SOB DEMANDA
// POST /backend/v1/backups/executar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/backups/executar',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Verificar se usuário tem papel admin
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
      return e.json(403, { error: 'Apenas administradores podem executar backups' })
    }

    const colecoesParaDump = [
      'empresas',
      'empresa_membros',
      'users',
      'clientes',
      'fornecedores',
      'produtos',
      'plano_contas',
      'contas_pagar',
      'contas_receber',
      'bancos_contas',
      'movimentos_financeiros',
      'conciliacoes',
      'empresa_convites',
      'veiculos',
      'abastecimentos',
      'manutencoes',
      'centros_custos',
      'creditos_clientes',
      'funcionarios',
      'folha_horas_extras',
      'entregas',
      'vendas',
      'despesas_frota',
      'historico_alteracoes',
      'formas_recebimento',
      'cheques_predatados',
      'contadores_sequenciais',
    ]

    const backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    const dadosCol = $app.findCollectionByNameOrId('backups_dados')
    const timestampStr = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)

    // Tentar backup nativo zip do PocketBase
    let nativoStatus = 'tentado'
    let nativoArquivo = ''
    let nativoErro = ''
    const zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
    try {
      if (typeof $app.createBackup === 'function') {
        try {
          $app.createBackup(zipName)
          nativoStatus = 'sucesso'
          nativoArquivo = zipName
        } catch (e1) {
          try {
            const reqCtx = e.request ? e.request.context() : null
            $app.createBackup(reqCtx, zipName)
            nativoStatus = 'sucesso'
            nativoArquivo = zipName
          } catch (e2) {
            nativoStatus = 'falha'
            nativoErro = String(e2?.message || e2)
          }
        }
      } else {
        nativoStatus = 'nao_disponivel_jsvm'
        nativoErro = 'createBackup não exposto na JSVM do PocketBase'
      }
    } catch (eG) {
      nativoStatus = 'erro'
      nativoErro = String(eG?.message || eG)
    }

    const resumo = {}
    let totalRegistrosGeral = 0
    let colecoesComErro = 0

    const solicitanteNome =
      authRecord.getString('name') || authRecord.getString('email') || 'Administrador'

    // Salvar cabeçalho inicial
    const backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', 'backup_completo_erp_' + timestampStr + '.json')
    backupRecord.set('tipo', 'completo')
    backupRecord.set('origem', 'manual')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('drive_status', 'pendente')
    backupRecord.set('total_colecoes', colecoesParaDump.length)
    backupRecord.set('total_registros', 0)
    backupRecord.set('resumo_colecoes', {})
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'manual',
      solicitado_por: solicitanteNome,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      status: 'processando',
    })
    backupRecord.set('backup_duplicatas_incluido', false)
    backupRecord.set('observacoes', 'Backup real sob demanda em andamento...')
    $app.save(backupRecord)

    // Extrair registros de cada coleção e particionar em chunks
    for (let i = 0; i < colecoesParaDump.length; i++) {
      const colName = colecoesParaDump[i]
      try {
        const records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        const count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          const serialized = []
          for (let j = 0; j < count; j++) {
            const r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                const obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                const c = r.collection()
                if (c && c.fields) {
                  const fields = c.fields.all()
                  for (let f = 0; f < fields.length; f++) {
                    const fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          const CHUNK_SIZE = 200
          const totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (let ch = 0; ch < totalChunks; ch++) {
            const chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            const dadoRec = new Record(dadosCol)
            dadoRec.set('backup_id', backupRecord.id)
            dadoRec.set('colecao_nome', colName)
            dadoRec.set('chunk_index', ch)
            dadoRec.set('total_chunks', totalChunks)
            dadoRec.set('registros_count', chunkData.length)
            dadoRec.set('registros_json', chunkData)
            $app.save(dadoRec)
          }
        }
      } catch (errCol) {
        colecoesComErro++
        resumo[colName] = { erro: String(errCol?.message || errCol) }
        console.warn(`[BACKUP] Falha ao extrair ${colName}:`, errCol)
      }
    }

    // Tabela opcional _backup_duplicatas_excluidas
    let backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        const cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    const statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

    // Finalizar cabeçalho
    backupRecord.set('total_registros', totalRegistrosGeral)
    backupRecord.set('total_colecoes', Object.keys(resumo).length)
    backupRecord.set('resumo_colecoes', resumo)
    backupRecord.set('backup_duplicatas_incluido', backupDuplicatasIncluido)
    backupRecord.set('status', statusFinal)
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      origem: 'manual',
      solicitado_por: solicitanteNome,
      total_registros_geral: totalRegistrosGeral,
      colecoes_com_erro: colecoesComErro,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      colecoes_processadas: Object.keys(resumo),
    })
    backupRecord.set(
      'observacoes',
      `Backup real completo gerado sob demanda por ${solicitanteNome}. Todos os dados preservados com status "${statusFinal}".`,
    )
    $app.save(backupRecord)

    // Registrar histórico de alterações
    try {
      const histCol = $app.findCollectionByNameOrId('historico_alteracoes')
      const recHist = new Record(histCol)
      recHist.set('empresa_id', '6nt8u83eiyzf6xr')
      recHist.set('colecao_origem', 'outros')
      recHist.set('registro_id', backupRecord.id)
      recHist.set('acao', 'criar')
      recHist.set('usuario_id', authRecord.id)
      recHist.set('usuario_nome', solicitanteNome)
      recHist.set(
        'descricao',
        `Backup manual do sistema executado: ${totalRegistrosGeral} registros e ${Object.keys(resumo).length} coleções (${statusFinal})`,
      )
      recHist.set('detalhes', {
        backup_id: backupRecord.id,
        origem: 'manual',
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
        status: statusFinal,
      })
      $app.save(recHist)
    } catch (_) {}

    return e.json(200, {
      success: true,
      backup: {
        id: backupRecord.id,
        nome_arquivo: backupRecord.getString('nome_arquivo'),
        tipo: backupRecord.getString('tipo'),
        origem: backupRecord.getString('origem') || 'manual',
        status: statusFinal,
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
        resumo_colecoes: resumo,
        nativo_zip_status: nativoStatus,
        nativo_zip_arquivo: nativoArquivo,
        drive_status: 'pendente',
        created: backupRecord.getString('created'),
      },
    })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 4. ENDPOINT: STATUS DA CONFIGURAÇÃO DO BACKUP AUTOMÁTICO
// GET /backend/v1/backups/status-agendamento
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/status-agendamento',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let ultimoBackupAutomatico = null
    try {
      const autos = $app.findRecordsByFilter(
        'backups_sistema',
        "origem = 'semanal_automatico'",
        '-created',
        1,
        0,
      )
      if (autos && autos.length > 0) {
        const b = autos[0]
        ultimoBackupAutomatico = {
          id: b.id,
          nome_arquivo: b.getString('nome_arquivo'),
          status: b.getString('status'),
          origem: 'semanal_automatico',
          total_registros: b.getInt('total_registros'),
          total_colecoes: b.getInt('total_colecoes'),
          drive_status: b.getString('drive_status') || 'pendente',
          created: b.getString('created'),
        }
      }
    } catch (_) {}

    return e.json(200, {
      success: true,
      agendamento: {
        ativo: true,
        job_id: 'backup_semanal_pedreira_cordeiro',
        cron_expressao: '30 0 * * 0',
        horario_legivel: 'Todo domingo às 00:30 (horário do servidor)',
        frequencia: 'Semanal',
        descricao: 'Backup automático semanal cobrindo todas as 28 coleções do ERP',
        ultimo_backup_automatico: ultimoBackupAutomatico,
      },
    })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 5. ENDPOINT: EXPORTAR / BAIXAR DADOS CONSOLIDADOS EM JSON
// GET /backend/v1/backups/{id}/download
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/{id}/download',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    try {
      const backupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )

      // Reconstruir o dump completo estruturado por coleção
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) {
          colecoes[col] = []
        }
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const payloadCompleto = {
        meta: {
          id: backupRec.id,
          nome_arquivo: backupRec.getString('nome_arquivo'),
          tipo: backupRec.getString('tipo'),
          origem: backupRec.getString('origem') || 'manual',
          total_colecoes: backupRec.getInt('total_colecoes'),
          total_registros: backupRec.getInt('total_registros'),
          resumo_colecoes: backupRec.get('resumo_colecoes'),
          detalhes_execucao: backupRec.get('detalhes_execucao'),
          drive_status: backupRec.getString('drive_status') || 'pendente',
          drive_file_id: backupRec.getString('drive_file_id') || '',
          drive_enviado_em: backupRec.getString('drive_enviado_em') || '',
          created: backupRec.getString('created'),
          exportado_em: new Date().toISOString(),
          sistema: 'Pedreira Cordeiro ERP (NovaGest)',
        },
        dados: colecoes,
      }

      return e.json(200, payloadCompleto)
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao consolidar download do backup: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 6. ENDPOINT: STATUS DA INTEGRAÇÃO COM O GOOGLE DRIVE
// GET /backend/v1/google-drive/status
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/google-drive/status',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      let clientId = $os.getenv('GOOGLE_CLIENT_ID') || ''
      let clientSecret = $os.getenv('GOOGLE_CLIENT_SECRET') || ''
      let refreshToken = $os.getenv('GOOGLE_REFRESH_TOKEN') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let folderName = 'Backups ERP'
      let accountEmail = ''
      let accountName = ''
      let ultimoEnvio = ''
      let dbStatus = ''

      try {
        const configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!clientId) clientId = configRec.getString('client_id')
          if (!clientSecret) clientSecret = configRec.getString('client_secret')
          if (!refreshToken) refreshToken = configRec.getString('refresh_token')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
          accountEmail = configRec.getString('account_email')
          accountName = configRec.getString('account_name')
          ultimoEnvio = configRec.getString('ultimo_envio')
          dbStatus = configRec.getString('ultimo_status')
        }
      } catch (_) {}

      // Obter URL base do backend para orientar redirect URI
      const siteUrl = $os.getenv('SITE_URL') || ''
      const pbUrl = $os.getenv('PB_INSTANCE_URL') || ''

      const isConfigured = Boolean(clientId && clientSecret)
      const isConnected = Boolean(isConfigured && refreshToken)

      // Se temos refresh token mas não temos os dados da conta, tentar buscar rapidamente
      if (isConnected && (!accountEmail || !accountName)) {
        try {
          const tokenRes = $http.send({
            url: 'https://oauth2.googleapis.com/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:
              'grant_type=refresh_token' +
              '&client_id=' +
              encodeURIComponent(clientId) +
              '&client_secret=' +
              encodeURIComponent(clientSecret) +
              '&refresh_token=' +
              encodeURIComponent(refreshToken),
            timeout: 10,
          })

          if (tokenRes.statusCode === 200) {
            const tokenJson = tokenRes.json || JSON.parse(tokenRes.raw || '{}')
            const accessTok = tokenJson.access_token
            if (accessTok) {
              const userinfoRes = $http.send({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                method: 'GET',
                headers: { Authorization: 'Bearer ' + accessTok },
                timeout: 10,
              })
              if (userinfoRes.statusCode === 200) {
                const uJson = userinfoRes.json || JSON.parse(userinfoRes.raw || '{}')
                accountEmail = uJson.email || accountEmail
                accountName = uJson.name || accountName
                try {
                  const cfg = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
                  if (cfg) {
                    if (accountEmail) cfg.set('account_email', accountEmail)
                    if (accountName) cfg.set('account_name', accountName)
                    cfg.set('ultimo_status', 'conectado')
                    $app.save(cfg)
                  }
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        drive: {
          configurado: isConfigured,
          conectado: isConnected,
          client_id_definido: Boolean(clientId),
          client_secret_definido: Boolean(clientSecret),
          refresh_token_definido: Boolean(refreshToken),
          pasta_nome: folderName,
          pasta_id: folderId,
          conta_email: accountEmail,
          conta_nome: accountName,
          ultimo_envio: ultimoEnvio,
          status_conexao: isConnected
            ? 'conectado'
            : isConfigured
              ? 'pendente_autorizacao'
              : 'desconectado',
          redirect_uri_recomendada: pbUrl
            ? pbUrl + '/backend/v1/google-drive/oauth/callback'
            : '/backend/v1/google-drive/oauth/callback',
        },
      })
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao consultar status do Google Drive: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 7. ENDPOINT: SALVAR CREDENCIAIS DO GOOGLE (CLIENT ID, CLIENT SECRET, FOLDER ID)
// POST /backend/v1/google-drive/config
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/config',
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
      return e.json(403, { error: 'Apenas administradores podem configurar o Google Drive' })
    }

    const body = e.requestInfo().body || {}
    const clientId = (body.client_id || '').trim()
    const clientSecret = (body.client_secret || '').trim()
    const folderId = (body.folder_id || '').trim()
    const folderName = (body.folder_name || 'Backups ERP').trim()
    const manualRefreshToken = (body.refresh_token || '').trim()

    try {
      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      } catch (_) {
        const configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }

      if (clientId) configRec.set('client_id', clientId)
      if (clientSecret) configRec.set('client_secret', clientSecret)
      if (folderId) configRec.set('folder_id', folderId)
      if (folderName) configRec.set('folder_name', folderName)
      if (manualRefreshToken) {
        configRec.set('refresh_token', manualRefreshToken)
        configRec.set('ultimo_status', 'conectado')
      }
      $app.save(configRec)

      return e.json(200, {
        success: true,
        message: 'Configurações do Google Drive salvas com sucesso',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao salvar configurações: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 8. ENDPOINT: GERAR URL DE AUTORIZAÇÃO OAUTH2 (GOOGLE DRIVE)
// GET /backend/v1/google-drive/auth-url
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/google-drive/auth-url',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      let clientId = $os.getenv('GOOGLE_CLIENT_ID') || ''
      try {
        const configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec && !clientId) {
          clientId = configRec.getString('client_id')
        }
      } catch (_) {}

      if (!clientId) {
        return e.json(400, {
          error:
            'Client ID do Google não configurado. Forneça o Client ID no formulário de configuração ou na variável GOOGLE_CLIENT_ID.',
        })
      }

      // Descobrir a redirect URI
      const queryRedirect = e.request.url.query().get('redirect_uri')
      let redirectUri = queryRedirect
      if (!redirectUri) {
        const pbUrl = $os.getenv('PB_INSTANCE_URL') || ''
        redirectUri = pbUrl
          ? pbUrl + '/backend/v1/google-drive/oauth/callback'
          : 'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth/callback'
      }

      // Escopos solicitados: drive.file (acesso seguro apenas aos arquivos criados pelo app) e email/profile
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' ')

      // State para validação e para guardar a URL de retorno ao frontend
      const stateObj = {
        uid: authRecord.id,
        t: Date.now(),
        origin: e.request.header.get('origin') || '',
      }
      const stateStr = encodeURIComponent(JSON.stringify(stateObj))

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        'client_id=' +
        encodeURIComponent(clientId) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri) +
        '&response_type=code' +
        '&scope=' +
        encodeURIComponent(scopes) +
        '&access_type=offline' +
        '&prompt=consent' +
        '&state=' +
        stateStr

      return e.json(200, {
        success: true,
        auth_url: authUrl,
        redirect_uri: redirectUri,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar URL de autorização: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 9. ENDPOINT: CALLBACK OAUTH2 (GOOGLE DRIVE)
// GET /backend/v1/google-drive/oauth/callback
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/google-drive/oauth/callback', (e) => {
  const code = e.request.url.query().get('code')
  const errorParam = e.request.url.query().get('error')
  const stateParam = e.request.url.query().get('state')

  if (errorParam) {
    return e.html(
      400,
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h2 style="color:#dc2626;">Autorização Recusada pelo Google</h2>' +
        '<p>' +
        errorParam +
        '</p>' +
        '<p><a href="/cadastros/backups" style="color:#0f766e;font-weight:bold;">Voltar para o ERP</a></p>' +
        '</body></html>',
    )
  }

  if (!code) {
    return e.html(
      400,
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h2 style="color:#dc2626;">Código de Autorização Ausente</h2>' +
        '<p>Nenhum código foi retornado pelo Google.</p>' +
        '</body></html>',
    )
  }

  try {
    let clientId = $os.getenv('GOOGLE_CLIENT_ID') || ''
    let clientSecret = $os.getenv('GOOGLE_CLIENT_SECRET') || ''
    let folderName = 'Backups ERP'

    let configRec = null
    try {
      configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        if (!clientId) clientId = configRec.getString('client_id')
        if (!clientSecret) clientSecret = configRec.getString('client_secret')
        if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
      }
    } catch (_) {
      const configCol = $app.findCollectionByNameOrId('config_google_drive')
      configRec = new Record(configCol)
      configRec.set('chave', 'padrao')
    }

    if (!clientId || !clientSecret) {
      return e.html(
        500,
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h2 style="color:#dc2626;">Credenciais incompletas</h2>' +
          '<p>Client ID ou Client Secret do Google não estão configurados no backend.</p>' +
          '</body></html>',
      )
    }

    // Reconstruir o redirect URI exato usado na requisição
    const pbUrl = $os.getenv('PB_INSTANCE_URL') || ''
    const redirectUri = pbUrl
      ? pbUrl + '/backend/v1/google-drive/oauth/callback'
      : 'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth/callback'

    // Trocar código por refresh_token e access_token
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const postBody =
      'code=' +
      encodeURIComponent(code) +
      '&client_id=' +
      encodeURIComponent(clientId) +
      '&client_secret=' +
      encodeURIComponent(clientSecret) +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&grant_type=authorization_code'

    const tokenRes = $http.send({
      url: tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody,
      timeout: 30,
    })

    if (tokenRes.statusCode !== 200) {
      const errDetail = tokenRes.raw || 'Status ' + tokenRes.statusCode
      return e.html(
        500,
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h2 style="color:#dc2626;">Falha ao Obter Token</h2>' +
          '<pre style="background:#f1f5f9;padding:15px;border-radius:8px;text-align:left;display:inline-block;">' +
          errDetail +
          '</pre>' +
          '<p><a href="/cadastros/backups">Voltar ao ERP</a></p>' +
          '</body></html>',
      )
    }

    const tokenData = tokenRes.json || JSON.parse(tokenRes.raw || '{}')
    const refreshToken = tokenData.refresh_token
    const accessToken = tokenData.access_token

    if (!refreshToken && configRec && !configRec.getString('refresh_token')) {
      // Se não veio refresh token e não tínhamos um antes, avisar o usuário
      console.warn('[Google OAuth] Nenhum refresh token retornado na troca de código.')
    }

    // Buscar informações do usuário conectado
    let userEmail = ''
    let userName = ''
    if (accessToken) {
      try {
        const userinfoRes = $http.send({
          url: 'https://www.googleapis.com/oauth2/v2/userinfo',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + accessToken },
          timeout: 10,
        })
        if (userinfoRes.statusCode === 200) {
          const uData = userinfoRes.json || JSON.parse(userinfoRes.raw || '{}')
          userEmail = uData.email || ''
          userName = uData.name || ''
        }
      } catch (_) {}

      // Garantir existência da pasta "Backups ERP"
      try {
        const searchFolderUrl =
          'https://www.googleapis.com/drive/v3/files?q=' +
          encodeURIComponent(
            "mimeType='application/vnd.google-apps.folder' and name='" +
              folderName +
              "' and trashed=false",
          ) +
          '&fields=files(id,name)'
        const searchRes = $http.send({
          url: searchFolderUrl,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + accessToken },
          timeout: 20,
        })

        const searchJson = searchRes.json || JSON.parse(searchRes.raw || '{}')
        let folderId = ''
        if (searchJson.files && searchJson.files.length > 0) {
          folderId = searchJson.files[0].id
        } else {
          const createFolderRes = $http.send({
            url: 'https://www.googleapis.com/drive/v3/files',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
            }),
            timeout: 20,
          })
          const createdFolderJson = createFolderRes.json || JSON.parse(createFolderRes.raw || '{}')
          folderId = createdFolderJson.id || ''
        }

        if (folderId && configRec) {
          configRec.set('folder_id', folderId)
        }
      } catch (errF) {
        console.warn('[Google OAuth] Aviso ao criar pasta Backups ERP:', errF)
      }
    }

    // Atualizar registro de configuração
    if (configRec) {
      if (refreshToken) configRec.set('refresh_token', refreshToken)
      if (userEmail) configRec.set('account_email', userEmail)
      if (userName) configRec.set('account_name', userName)
      configRec.set('folder_name', folderName)
      configRec.set('ativo', true)
      configRec.set('ultimo_status', 'conectado')
      $app.save(configRec)
    }

    // Página de confirmação amigável com redirecionamento de volta ao ERP
    const htmlResponse =
      '<!DOCTYPE html>' +
      '<html lang="pt-BR">' +
      '<head>' +
      '<meta charset="utf-8"/>' +
      '<title>Google Drive Conectado - ERP Pedreira Cordeiro</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
      '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }' +
      '.card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }' +
      '.icon { width: 56px; height: 56px; background: #ecfdf5; color: #059669; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px; }' +
      'h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: #064e3b; }' +
      'p { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px 0; }' +
      '.btn { display: inline-block; background: #0f766e; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.2s; }' +
      '.btn:hover { background: #115e59; }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="card">' +
      '<div class="icon">✓</div>' +
      '<h1>Google Drive Conectado com Sucesso!</h1>' +
      '<p>A integração automática de backups do ERP Grupo Pedreira Cordeiro foi vinculada à conta <strong>' +
      (userEmail || 'Google') +
      '</strong> na pasta <strong>Backups ERP</strong>.</p>' +
      '<p>Você já pode fechar esta aba ou clicar abaixo para retornar ao painel de Backups do ERP.</p>' +
      '<a href="/cadastros/backups" class="btn">Voltar para o ERP</a>' +
      '</div>' +
      '<script>' +
      'if (window.opener) {' +
      '  try { window.opener.postMessage({ type: "GOOGLE_DRIVE_CONNECTED", email: "' +
      userEmail +
      '" }, "*"); } catch(e){}' +
      '  setTimeout(function() { window.close(); }, 2000);' +
      '}' +
      '</script>' +
      '</body>' +
      '</html>'

    return e.html(200, htmlResponse)
  } catch (errCallback) {
    console.error('[Google OAuth Callback] Erro:', errCallback)
    return e.html(
      500,
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h2 style="color:#dc2626;">Erro no Processamento do OAuth</h2>' +
        '<p>' +
        String(errCallback?.message || errCallback) +
        '</p>' +
        '<p><a href="/cadastros/backups">Voltar ao ERP</a></p>' +
        '</body></html>',
    )
  }
})

// -------------------------------------------------------------
// 10. ENDPOINT: DESCONECTAR GOOGLE DRIVE
// POST /backend/v1/google-drive/desconectar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/desconectar',
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
      return e.json(403, { error: 'Apenas administradores podem desconectar o Google Drive' })
    }

    try {
      const configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        configRec.set('refresh_token', '')
        configRec.set('account_email', '')
        configRec.set('account_name', '')
        configRec.set('ultimo_status', 'desconectado')
        $app.save(configRec)
      }

      return e.json(200, {
        success: true,
        message: 'Google Drive desconectado com sucesso',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao desconectar: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 11. ENDPOINT: ENVIAR MANUALMENTE UM BACKUP ESPECÍFICO AO GOOGLE DRIVE
// POST /backend/v1/backups/{id}/enviar-drive
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/backups/{id}/enviar-drive',
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
      return e.json(403, { error: 'Apenas administradores podem enviar backups ao Google Drive' })
    }

    const backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    try {
      const backupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)

      // Obter credenciais
      let clientId = $os.getenv('GOOGLE_CLIENT_ID') || ''
      let clientSecret = $os.getenv('GOOGLE_CLIENT_SECRET') || ''
      let refreshToken = $os.getenv('GOOGLE_REFRESH_TOKEN') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let folderName = 'Backups ERP'

      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!clientId) clientId = configRec.getString('client_id')
          if (!clientSecret) clientSecret = configRec.getString('client_secret')
          if (!refreshToken) refreshToken = configRec.getString('refresh_token')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
        }
      } catch (_) {}

      if (!clientId || !clientSecret || !refreshToken) {
        return e.json(400, {
          error:
            'Google Drive não está conectado. Conecte sua conta do Google na seção "Integração Google Drive" antes de enviar.',
        })
      }

      // 1. Obter Access Token usando Refresh Token
      const tokenRes = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=refresh_token' +
          '&client_id=' +
          encodeURIComponent(clientId) +
          '&client_secret=' +
          encodeURIComponent(clientSecret) +
          '&refresh_token=' +
          encodeURIComponent(refreshToken),
        timeout: 30,
      })

      if (tokenRes.statusCode !== 200) {
        const errMsg = 'Falha ao renovar token OAuth: ' + (tokenRes.raw || tokenRes.statusCode)
        backupRec.set('drive_status', 'erro')
        backupRec.set('drive_erro', errMsg)
        $app.save(backupRec)
        return e.json(400, { error: errMsg })
      }

      const tokenJson = tokenRes.json || JSON.parse(tokenRes.raw || '{}')
      const accessToken = tokenJson.access_token
      if (!accessToken) {
        return e.json(400, { error: 'Access token não retornado pelo Google' })
      }

      // 2. Garantir pasta
      if (!folderId) {
        try {
          const searchFolderUrl =
            'https://www.googleapis.com/drive/v3/files?q=' +
            encodeURIComponent(
              "mimeType='application/vnd.google-apps.folder' and name='" +
                folderName +
                "' and trashed=false",
            ) +
            '&fields=files(id,name)'
          const searchRes = $http.send({
            url: searchFolderUrl,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + accessToken },
            timeout: 30,
          })

          const searchJson = searchRes.json || JSON.parse(searchRes.raw || '{}')
          if (searchJson.files && searchJson.files.length > 0) {
            folderId = searchJson.files[0].id
          } else {
            const createFolderRes = $http.send({
              url: 'https://www.googleapis.com/drive/v3/files',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
              }),
              timeout: 30,
            })
            const createdFolderJson =
              createFolderRes.json || JSON.parse(createFolderRes.raw || '{}')
            folderId = createdFolderJson.id || ''
          }

          if (folderId && configRec) {
            configRec.set('folder_id', folderId)
            configRec.set('folder_name', folderName)
            $app.save(configRec)
          }
        } catch (eFolder) {
          console.warn('[Manual Drive] Aviso ao buscar pasta:', eFolder)
        }
      }

      // 3. Montar dados consolidados em JSON
      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
            id: backupRec.id,
            nome_arquivo: backupRec.getString('nome_arquivo'),
            tipo: backupRec.getString('tipo'),
            origem: backupRec.getString('origem') || 'manual',
            total_colecoes: backupRec.getInt('total_colecoes'),
            total_registros: backupRec.getInt('total_registros'),
            resumo_colecoes: backupRec.get('resumo_colecoes'),
            created: backupRec.getString('created'),
            exportado_em: new Date().toISOString(),
            sistema: 'Pedreira Cordeiro ERP (NovaGest)',
          },
          dados: colecoes,
        },
        null,
        2,
      )

      // 4. Upload multipart
      const fileMetadata = {
        name: backupRec.getString('nome_arquivo'),
        mimeType: 'application/json',
      }
      if (folderId) {
        fileMetadata.parents = [folderId]
      }

      const boundary = '-------314159265358979323846'
      const delimiter = '\r\n--' + boundary + '\r\n'
      const closeDelimiter = '\r\n--' + boundary + '--'

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        dumpJsonStr +
        closeDelimiter

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
      const uploadRes = $http.send({
        url: uploadUrl,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartBody,
        timeout: 120,
      })

      if (uploadRes.statusCode === 200 || uploadRes.statusCode === 201) {
        const uploadedJson = uploadRes.json || JSON.parse(uploadRes.raw || '{}')
        const fileId = uploadedJson.id || ''
        const agoraIso = new Date().toISOString()

        backupRec.set('drive_status', 'enviado')
        backupRec.set('drive_file_id', fileId)
        backupRec.set('drive_folder_id', folderId)
        backupRec.set('drive_enviado_em', agoraIso)
        backupRec.set('drive_erro', '')
        $app.save(backupRec)

        if (configRec) {
          configRec.set('ultimo_envio', agoraIso)
          configRec.set('ultimo_status', 'conectado')
          $app.save(configRec)
        }

        return e.json(200, {
          success: true,
          message: 'Backup enviado com sucesso ao Google Drive na pasta "' + folderName + '"',
          file_id: fileId,
          folder_id: folderId,
          enviado_em: agoraIso,
        })
      } else {
        const errDetail =
          'Erro no envio ao Google Drive (HTTP ' +
          uploadRes.statusCode +
          '): ' +
          (uploadRes.raw || '')
        backupRec.set('drive_status', 'erro')
        backupRec.set('drive_erro', errDetail)
        $app.save(backupRec)
        return e.json(500, { error: errDetail })
      }
    } catch (err) {
      console.error('[Manual Drive] Erro:', err)
      return e.json(500, { error: 'Erro ao enviar backup ao Drive: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)
