// Hook PocketBase para gerenciamento e automação de Backups do ERP Pedreira Cordeiro
// Endpoints autenticados sob /backend/v1/backups
// Cron job semanal automático via cronAdd: todo domingo às 00:30 (horário do servidor)
// NOTA JSVM: Todo o código e variáveis ficam estritamente INLINE dentro de cada callback de hook/cron.

// -------------------------------------------------------------
// 1. REGISTRO DO CRON JOB SEMANAL
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

    // Atualizar cabeçalho
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
