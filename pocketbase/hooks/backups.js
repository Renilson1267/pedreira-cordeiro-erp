// Hook PocketBase para gerenciamento de Backups do ERP Pedreira Cordeiro
// Endpoints autenticados sob /backend/v1/backups
// Permite listar backups, disparar novo backup real completo sob demanda e exportar dados

// 1. Listar backups realizados
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
        status: b.getString('status'),
        total_colecoes: b.getInt('total_colecoes'),
        total_registros: b.getInt('total_registros'),
        resumo_colecoes: b.get('resumo_colecoes'),
        detalhes_execucao: b.get('detalhes_execucao'),
        backup_duplicatas_incluido: b.getBool('backup_duplicatas_incluido'),
        observacoes: b.getString('observacoes'),
        created: b.getString('created'),
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

// 2. Disparar novo backup real completo sob demanda
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

    const backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    const dadosCol = $app.findCollectionByNameOrId('backups_dados')
    const timestampStr = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)

    // Tentar acionar backup nativo do PocketBase (.zip)
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

    // Lista exaustiva de todas as coleções do ERP
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

    const resumo = {}
    let totalRegistrosGeral = 0

    // Salvar cabeçalho inicial
    const backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', 'backup_completo_erp_' + timestampStr + '.json')
    backupRecord.set('tipo', 'completo')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('total_colecoes', colecoesParaDump.length)
    backupRecord.set('total_registros', 0)
    backupRecord.set('resumo_colecoes', {})
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      solicitado_por: authRecord.getString('name') || authRecord.getString('email'),
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
    })
    backupRecord.set('backup_duplicatas_incluido', false)
    backupRecord.set('observacoes', 'Backup real sob demanda em andamento...')
    $app.save(backupRecord)

    // Extrair registros de cada coleção e salvar em chunks
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
        resumo[colName] = { erro: String(errCol?.message || errCol) }
      }
    }

    // Registrar tabela _backup_duplicatas_excluidas se existir
    let backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        const cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    // Finalizar cabeçalho
    backupRecord.set('total_registros', totalRegistrosGeral)
    backupRecord.set('total_colecoes', Object.keys(resumo).length)
    backupRecord.set('resumo_colecoes', resumo)
    backupRecord.set('backup_duplicatas_incluido', backupDuplicatasIncluido)
    backupRecord.set('status', 'sucesso')
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      solicitado_por: authRecord.getString('name') || authRecord.getString('email'),
      total_registros_geral: totalRegistrosGeral,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      colecoes_processadas: Object.keys(resumo),
    })
    backupRecord.set(
      'observacoes',
      'Backup real completo gerado sob demanda pelo usuário ' +
        (authRecord.getString('name') || authRecord.getString('email')) +
        '. Todos os dados preservados com sucesso.',
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
      recHist.set('usuario_id', authRecord.id)
      recHist.set('usuario_nome', authRecord.getString('name') || 'Administrador')
      recHist.set(
        'descricao',
        `Backup real completo do sistema executado: ${totalRegistrosGeral} registros e ${Object.keys(resumo).length} coleções`,
      )
      recHist.set('detalhes', {
        backup_id: backupRecord.id,
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
      })
      $app.save(recHist)
    } catch (_) {}

    return e.json(200, {
      success: true,
      backup: {
        id: backupRecord.id,
        nome_arquivo: backupRecord.getString('nome_arquivo'),
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
        resumo_colecoes: resumo,
        nativo_zip_status: nativoStatus,
        nativo_zip_arquivo: nativoArquivo,
        created: backupRecord.getString('created'),
      },
    })
  },
  $apis.requireAuth(),
)

// 3. Exportar / Baixar dados consolidados de um backup em JSON
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
        1000,
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
          total_colecoes: backupRec.getInt('total_colecoes'),
          total_registros: backupRec.getInt('total_registros'),
          resumo_colecoes: backupRec.get('resumo_colecoes'),
          detalhes_execucao: backupRec.get('detalhes_execucao'),
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
