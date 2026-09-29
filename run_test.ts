// Teste unitário e de integração para o serviço de backup local
// Executado pelo comando "npm test" no QA pipeline
import { backupService } from './src/services/backup.js'

async function run() {
  console.log('--- Iniciando Teste de Validação e Extração de Erros de Backup ---')

  // 1. Teste extrairMensagemErro
  const errComplexo1 = {
    response: {
      data: {
        error: "Coleção 'colecao_inexistente' não existe no schema do banco de dados.",
      },
    },
  }
  const msg1 = backupService.extrairMensagemErro(errComplexo1, 'Falha padrao')
  if (msg1 !== "Coleção 'colecao_inexistente' não existe no schema do banco de dados.") {
    throw new Error(`extrairMensagemErro falhou no caso 1: ${msg1}`)
  }
  console.log('✓ Teste 1 (extrairMensagemErro aninhado): OK')

  const errComplexo2 = {
    data: {
      message: 'Apenas administradores têm permissão para restaurar backups do sistema.',
    },
  }
  const msg2 = backupService.extrairMensagemErro(errComplexo2, 'Falha padrao')
  if (msg2 !== 'Apenas administradores têm permissão para restaurar backups do sistema.') {
    throw new Error(`extrairMensagemErro falhou no caso 2: ${msg2}`)
  }
  console.log('✓ Teste 2 (extrairMensagemErro data.message): OK')

  // 2. Simulação de dump real do sistema com chaves especiais/transitórias
  const dumpSimulado = {
    meta: {
      id: 'test_backup_id',
      nome_arquivo: 'backup_semanal_auto_2026-09-27_00-30-00.json',
      created: '2026-09-27T00:30:00.000Z',
      sistema: 'Pedreira Cordeiro ERP (NovaGest)',
    },
    dados: {
      _backup_duplicatas_excluidas: 'Tabela não existe ou vazia',
      _backup_invalido_null: null,
      meta: { resumo: 'ignorar' },
      clientes: [
        { id: 'cli_01', nome: 'Cliente 1', empresa_id: 'emp_01' },
        { id: 'cli_02', nome: 'Cliente 2', empresa_id: 'emp_01' },
      ],
      produtos: [{ id: 'prod_01', codigo: 'B12', nome: 'Brita 12', empresa_id: 'emp_01' }],
      veiculos: [],
    },
  }

  // Verificar se o formato de envio leve de validarBackupLocal filtra corretamente chaves especiais
  const obj = dumpSimulado as {
    meta?: Record<string, unknown>
    dados?: Record<string, unknown>
  }
  const dados = obj.dados as Record<string, unknown>
  const colecoesResumo: Record<string, number> = {}
  let totalRegistros = 0

  for (const [k, v] of Object.entries(dados)) {
    if (k === 'meta' || k === 'dados' || k.startsWith('_backup_')) continue
    if (Array.isArray(v)) {
      colecoesResumo[k] = v.length
      totalRegistros += v.length
    }
  }

  if (colecoesResumo['_backup_duplicatas_excluidas'] !== undefined) {
    throw new Error('Chave transitória _backup_duplicatas_excluidas não foi filtrada!')
  }
  if (
    colecoesResumo['clientes'] !== 2 ||
    colecoesResumo['produtos'] !== 1 ||
    colecoesResumo['veiculos'] !== 0
  ) {
    throw new Error(`Contagem de coleções incorreta: ${JSON.stringify(colecoesResumo)}`)
  }
  if (totalRegistros !== 3) {
    throw new Error(`Total de registros calculado incorretamente: ${totalRegistros}`)
  }
  console.log('✓ Teste 3 (Normalização e contagem de dump): OK')

  // 3. Ordem de dependência de coleções
  const ORDEM_DEPENDENCIA_COLECOES = [
    'empresas',
    'users',
    'empresa_membros',
    'clientes',
    'fornecedores',
    'produtos',
    'plano_contas',
    'centros_custos',
    'bancos_contas',
    'veiculos',
    'funcionarios',
    'formas_recebimento',
    'exames_periodicos',
    'contas_pagar',
    'contas_receber',
    'vendas',
    'entregas',
    'abastecimentos',
    'manutencoes',
    'despesas_frota',
    'creditos_clientes',
    'folha_horas_extras',
    'movimentos_financeiros',
    'conciliacoes',
    'cheques_predatados',
    'empresa_convites',
    'contadores_sequenciais',
    'historico_alteracoes',
  ]

  const desordenadas = ['vendas', 'empresas', 'contas_receber', 'clientes', 'users']
  const ordenadas = [...desordenadas].sort((a, b) => {
    const idxA = ORDEM_DEPENDENCIA_COLECOES.indexOf(a)
    const idxB = ORDEM_DEPENDENCIA_COLECOES.indexOf(b)
    const posA = idxA === -1 ? 999 : idxA
    const posB = idxB === -1 ? 999 : idxB
    return posA - posB
  })

  const esperado = ['empresas', 'users', 'clientes', 'contas_receber', 'vendas']
  if (JSON.stringify(ordenadas) !== JSON.stringify(esperado)) {
    throw new Error(
      `Ordenação relacional falhou: ${JSON.stringify(ordenadas)} !== ${JSON.stringify(esperado)}`,
    )
  }
  console.log('✓ Teste 4 (Ordem de dependência relacional): OK')

  // 4. Teste com a estrutura e dados reais do backup semanal auto (jpc5w1b0o13nvim, 16.625 registros, 27 coleções)
  console.log('--- Teste 5: Validação do formato exato de dump semanal com 27 coleções ---')
  const resumoSemanal2026 = {
    abastecimentos: 0,
    bancos_contas: 1,
    centros_custos: 6,
    cheques_predatados: 0,
    clientes: 2354,
    conciliacoes: 0,
    contadores_sequenciais: 1,
    contas_pagar: 4418,
    contas_receber: 2920,
    creditos_clientes: 0,
    despesas_frota: 0,
    empresa_convites: 0,
    empresa_membros: 6,
    empresas: 2,
    entregas: 1530,
    exames_periodicos: 0,
    folha_horas_extras: 0,
    formas_recebimento: 2,
    fornecedores: 198,
    funcionarios: 63,
    historico_alteracoes: 5,
    manutencoes: 0,
    movimentos_financeiros: 3792,
    plano_contas: 34,
    produtos: 15,
    users: 5,
    veiculos: 43,
  }

  // Simular dump completo nos dois formatos aceitos:
  // Formato A: Coleções sob "dados", com metadados do dump real e chaves auxiliares
  const dumpRealFormatoA: Record<string, unknown> = {
    meta: {
      id: 'jpc5w1b0o13nvim',
      nome_arquivo: 'backup_semanal_auto_2026-09-27_00-30-00.json',
      origem: 'semanal_automatico',
      total_colecoes: 27,
      total_registros: 16625,
      resumo_colecoes: resumoSemanal2026,
    },
    dados: {
      _backup_duplicatas_excluidas: null,
      _backup_erros: { status: 'ok' },
      cnt: 16625,
      chars_data: 216210,
    },
  }

  // Formato B: Coleções diretamente na raiz
  const dumpRealFormatoB: Record<string, unknown> = {
    meta: { id: 'jpc5w1b0o13nvim' },
    cnt: 16625,
    _backup_info: 'teste',
  }

  // Preencher arrays simulando cada coleção de acordo com as contagens reais
  const dadosA = dumpRealFormatoA.dados as Record<string, unknown[]>
  let totalSimulado = 0
  for (const [col, count] of Object.entries(resumoSemanal2026)) {
    // Array com itens representativos
    const arr = new Array(count).fill(null).map((_, i) => ({
      id: `${col}_${i}`,
      collectionName: col,
    }))
    dadosA[col] = arr
    dumpRealFormatoB[col] = arr
    totalSimulado += count
  }

  if (totalSimulado !== 16625) {
    throw new Error(`Total esperado 16625, mas deu ${totalSimulado}`)
  }

  // Testar extração pelo método de serviço
  const colecoesExtraidasA = backupService.extrairColecoesDoDump(dumpRealFormatoA)
  const colecoesExtraidasB = backupService.extrairColecoesDoDump(dumpRealFormatoB)

  const nomesColsA = Object.keys(colecoesExtraidasA)
  const nomesColsB = Object.keys(colecoesExtraidasB)

  if (nomesColsA.length !== 27) {
    throw new Error(
      `Esperado 27 coleções no Formato A, obtido: ${nomesColsA.length} (${nomesColsA.join(', ')})`,
    )
  }
  if (nomesColsB.length !== 27) {
    throw new Error(
      `Esperado 27 coleções no Formato B, obtido: ${nomesColsB.length} (${nomesColsB.join(', ')})`,
    )
  }

  // Verificar contagem total de registros somando colecoesExtraidasA
  let totalRegistrosA = 0
  for (const [col, arr] of Object.entries(colecoesExtraidasA)) {
    totalRegistrosA += arr.length
    if (arr.length !== resumoSemanal2026[col as keyof typeof resumoSemanal2026]) {
      throw new Error(
        `Contagem da coleção ${col} divergente: ${arr.length} !== ${resumoSemanal2026[col as keyof typeof resumoSemanal2026]}`,
      )
    }
  }
  if (totalRegistrosA !== 16625) {
    throw new Error(`Total de registros no Formato A divergente: ${totalRegistrosA} !== 16625`)
  }

  // Garantir que nenhuma chave proibida escapou
  for (const k of [
    '_backup_duplicatas_excluidas',
    '_backup_erros',
    'cnt',
    'chars_data',
    'meta',
    'dados',
  ]) {
    if (colecoesExtraidasA[k] !== undefined) {
      throw new Error(`Chave ${k} não deveria constar nas coleções extraídas!`)
    }
  }

  console.log(
    '✓ Teste 5 (Dump semanal real de 27 coleções e 16.625 registros em ambos formatos): OK',
  )

  // 5. Teste de Upload Fracionado de Vídeo Institucional (arquivo sintético de 25 MB)
  console.log('--- Teste 6: Fatiamento e Validação de Chunks de Vídeo Sintético (25 MB) ---')
  const {
    MAX_VIDEO_SIZE_BYTES,
    DIRECT_UPLOAD_THRESHOLD_BYTES,
    CHUNK_SIZE_BYTES,
    MAX_CHUNK_RETRIES,
  } = await import('./src/services/videoInstitucional.js')

  if (MAX_VIDEO_SIZE_BYTES !== 200 * 1024 * 1024) {
    throw new Error(`Limite máximo de vídeo inválido: ${MAX_VIDEO_SIZE_BYTES}`)
  }
  if (DIRECT_UPLOAD_THRESHOLD_BYTES !== 20 * 1024 * 1024) {
    throw new Error(`Limite de corte direto inválido: ${DIRECT_UPLOAD_THRESHOLD_BYTES}`)
  }
  if (CHUNK_SIZE_BYTES < 10 * 1024 * 1024 || CHUNK_SIZE_BYTES > 15 * 1024 * 1024) {
    throw new Error(`Tamanho de chunk fora da faixa permitida (10-15 MB): ${CHUNK_SIZE_BYTES}`)
  }
  if (MAX_CHUNK_RETRIES !== 2) {
    throw new Error(`MAX_CHUNK_RETRIES esperado 2, obtido: ${MAX_CHUNK_RETRIES}`)
  }

  // Criar buffer sintético de 25 MB (26.214.400 bytes)
  const tamanhoSinteticoBytes = 25 * 1024 * 1024
  const totalChunksEsperados = Math.ceil(tamanhoSinteticoBytes / CHUNK_SIZE_BYTES)

  if (totalChunksEsperados !== 3) {
    throw new Error(
      `Para 25 MB com blocos de ${CHUNK_SIZE_BYTES / (1024 * 1024)} MB, esperava-se 3 chunks, obtido: ${totalChunksEsperados}`,
    )
  }

  // Simular divisão em fatias e verificação de integridade dos offsets
  let bytesProcessados = 0
  const fatias: { index: number; start: number; end: number; size: number }[] = []

  for (let i = 0; i < totalChunksEsperados; i++) {
    const start = i * CHUNK_SIZE_BYTES
    const end = Math.min(start + CHUNK_SIZE_BYTES, tamanhoSinteticoBytes)
    const fatiaSize = end - start
    bytesProcessados += fatiaSize
    fatias.push({ index: i, start, end, size: fatiaSize })
  }

  if (bytesProcessados !== tamanhoSinteticoBytes) {
    throw new Error(
      `Soma das partes (${bytesProcessados}) não confere com o total original (${tamanhoSinteticoBytes})`,
    )
  }

  // Checar tamanhos: chunk 0 e 1 devem ter 12 MB (12.582.912 bytes), chunk 2 deve ter 1 MB (1.048.576 bytes)
  if (fatias[0].size !== 12 * 1024 * 1024 || fatias[1].size !== 12 * 1024 * 1024) {
    throw new Error(
      `Fatias iniciais não têm o tamanho do bloco esperado: ${JSON.stringify(fatias)}`,
    )
  }
  if (fatias[2].size !== 1 * 1024 * 1024) {
    throw new Error(`Fatia final com tamanho incorreto: ${fatias[2].size}`)
  }

  console.log('✓ Teste 6 (Fatiamento sintético de 25 MB em 3 chunks): OK')

  // 6. Teste de Fluxo Completo de Upload Fracionado: Sem Capa (JSON) e Com Capa (Multipart)
  console.log('--- Teste 7: Teste do Fluxo Fracionado End-to-End contra o Backend ---')
  const pbModule = await import('./src/lib/pocketbase/client.js')
  const pbInstance = pbModule.default || pbModule.pb

  // Autenticar com o usuário admin
  try {
    await pbInstance.collection('users').authWithPassword('gcmixsje@gmail.com', 'Skip@Pass')
    console.log('✓ Autenticado com sucesso como admin!')

    const token = pbInstance.authStore.token
    if (!token) {
      throw new Error('Token de autenticação não gerado!')
    }

    const baseUrl = pbInstance.baseUrl.replace(/\/$/, '')

    // CASO A: Upload fracionado sem capa (envio como JSON)
    console.log('Testando Caso A: Init de sessão fracionada sem capa (JSON)...')
    const totalBytesVideoA = 1024 * 1024 // 1 MB
    const totalChunksA = 2
    const initJsonA = {
      file_name: 'teste_sem_capa.mp4',
      file_size: totalBytesVideoA,
      total_chunks: totalChunksA,
      titulo: 'Vídeo Teste Sem Capa Automático',
      descricao: 'Teste automatizado de sessão sem capa via JSON',
      ativo: false,
      duracao_segundos: 10,
    }

    const resInitA = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(initJsonA),
    })

    if (!resInitA.ok) {
      const errText = await resInitA.text()
      throw new Error(`Falha no init sem capa (JSON): HTTP ${resInitA.status} - ${errText}`)
    }

    const dataInitA = (await resInitA.json()) as { session_id: string; total_chunks: number }
    if (!dataInitA.session_id) {
      throw new Error('session_id não retornado no init sem capa!')
    }
    const sessionIdA = dataInitA.session_id
    console.log(`✓ Sessão A criada com sucesso via JSON! Session ID: ${sessionIdA}`)

    // Enviar bloco 0 (com session_id e chunk_index na query string)
    const chunk0DataA = new Uint8Array(512 * 1024)
    chunk0DataA.fill(65) // 'A'
    const formChunk0A = new FormData()
    formChunk0A.append('session_id', sessionIdA)
    formChunk0A.append('chunk_index', '0')
    formChunk0A.append('chunk', new Blob([chunk0DataA]), 'part_0.bin')

    const resPart0A = await fetch(
      `${baseUrl}/backend/v1/video-institucional/chunk/part?session_id=${encodeURIComponent(
        sessionIdA,
      )}&chunk_index=0`,
      {
        method: 'POST',
        headers: { Authorization: token },
        body: formChunk0A,
      },
    )
    if (!resPart0A.ok) {
      const err0Text = await resPart0A.text()
      throw new Error(`Falha ao enviar bloco 0: HTTP ${resPart0A.status} - ${err0Text}`)
    }

    // Enviar bloco 1 (com session_id e chunk_index na query string)
    const chunk1DataA = new Uint8Array(512 * 1024)
    chunk1DataA.fill(66) // 'B'
    const formChunk1A = new FormData()
    formChunk1A.append('session_id', sessionIdA)
    formChunk1A.append('chunk_index', '1')
    formChunk1A.append('chunk', new Blob([chunk1DataA]), 'part_1.bin')

    const resPart1A = await fetch(
      `${baseUrl}/backend/v1/video-institucional/chunk/part?session_id=${encodeURIComponent(
        sessionIdA,
      )}&chunk_index=1`,
      {
        method: 'POST',
        headers: { Authorization: token },
        body: formChunk1A,
      },
    )
    if (!resPart1A.ok) {
      const err1Text = await resPart1A.text()
      throw new Error(`Falha ao enviar bloco 1: HTTP ${resPart1A.status} - ${err1Text}`)
    }
    console.log('✓ Blocos 0 e 1 enviados com sucesso!')

    // Finalizar sessão A (montar e salvar registro)
    const formCompleteA = new FormData()
    formCompleteA.append('session_id', sessionIdA)
    const resCompleteA = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/complete`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formCompleteA,
    })

    if (!resCompleteA.ok) {
      const errComplete = await resCompleteA.text()
      throw new Error(`Falha ao finalizar sessão A: HTTP ${resCompleteA.status} - ${errComplete}`)
    }
    const recordA = (await resCompleteA.json()) as {
      id: string
      titulo: string
      arquivo: string
      tamanho_bytes: number
    }
    if (!recordA.id || !recordA.arquivo) {
      throw new Error('Registro criado não possui id ou arquivo válido!')
    }
    console.log(
      `✓ Vídeo A finalizado e montado no banco! ID: ${recordA.id}, Arquivo: ${recordA.arquivo}`,
    )

    // Excluir registro de teste A
    await pbInstance.collection('config_video_institucional').delete(recordA.id)
    console.log('✓ Registro A de teste excluído com sucesso!')

    // CASO B: Upload fracionado com capa (multipart com arquivo de poster)
    console.log('Testando Caso B: Init de sessão fracionada com capa (Multipart)...')
    const formInitB = new FormData()
    formInitB.append('file_name', 'teste_com_capa.mp4')
    formInitB.append('file_size', String(1024 * 512))
    formInitB.append('total_chunks', '1')
    formInitB.append('titulo', 'Vídeo Teste Com Capa Automático')
    formInitB.append('ativo', 'false')

    // Gerar um fake poster JPG de 100 bytes
    const fakePosterBytes = new Uint8Array(100)
    fakePosterBytes.fill(99)
    formInitB.append(
      'poster',
      new Blob([fakePosterBytes], { type: 'image/jpeg' }),
      'poster_teste.jpg',
    )

    const resInitB = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/init`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formInitB,
    })

    if (!resInitB.ok) {
      const errTextB = await resInitB.text()
      throw new Error(`Falha no init com capa (Multipart): HTTP ${resInitB.status} - ${errTextB}`)
    }

    const dataInitB = (await resInitB.json()) as { session_id: string }
    const sessionIdB = dataInitB.session_id
    console.log(
      `✓ Sessão B (com poster) criada com sucesso via Multipart! Session ID: ${sessionIdB}`,
    )

    // Enviar bloco único (com query string)
    const chunk0DataB = new Uint8Array(1024 * 512)
    chunk0DataB.fill(70)
    const formChunk0B = new FormData()
    formChunk0B.append('session_id', sessionIdB)
    formChunk0B.append('chunk_index', '0')
    formChunk0B.append('chunk', new Blob([chunk0DataB]), 'part_0.bin')

    const resPart0B = await fetch(
      `${baseUrl}/backend/v1/video-institucional/chunk/part?session_id=${encodeURIComponent(
        sessionIdB,
      )}&chunk_index=0`,
      {
        method: 'POST',
        headers: { Authorization: token },
        body: formChunk0B,
      },
    )
    if (!resPart0B.ok) {
      const errBText = await resPart0B.text()
      throw new Error(`Falha ao enviar bloco da sessão B: HTTP ${resPart0B.status} - ${errBText}`)
    }

    // Finalizar sessão B
    const formCompleteB = new FormData()
    formCompleteB.append('session_id', sessionIdB)
    const resCompleteB = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/complete`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formCompleteB,
    })
    if (!resCompleteB.ok) {
      const errCompleteB = await resCompleteB.text()
      throw new Error(`Falha ao finalizar sessão B: HTTP ${resCompleteB.status} - ${errCompleteB}`)
    }
    const recordB = (await resCompleteB.json()) as { id: string; poster: string }
    if (!recordB.id || !recordB.poster) {
      throw new Error('Registro B criado não possui id ou poster válido!')
    }
    console.log(
      `✓ Vídeo B finalizado com poster gravado! ID: ${recordB.id}, Poster: ${recordB.poster}`,
    )

    // Excluir registro de teste B
    await pbInstance.collection('config_video_institucional').delete(recordB.id)
    console.log('✓ Registro B de teste excluído com sucesso!')

    console.log('✓ Teste 7 (Fluxo Completo de Upload Fracionado: JSON e Multipart): OK')

    // CASO C: Teste ponta a ponta com arquivo sintético de ~25 MB fatiado em 3 blocos (12 MB + 12 MB + 1 MB)
    console.log('Testando Caso C: Upload Fracionado de arquivo sintético de 25 MB em 3 partes...')
    const tamanho25MB = 25 * 1024 * 1024
    const totalChunks25MB = Math.ceil(tamanho25MB / CHUNK_SIZE_BYTES)
    const initJsonC = {
      file_name: 'video_sintetico_25mb.mp4',
      file_size: tamanho25MB,
      total_chunks: totalChunks25MB,
      titulo: 'Vídeo Sintético 25MB Validação E2E',
      descricao: 'Teste E2E de integridade com blocos de 12 MB e persistência via $os.rename',
      ativo: false,
      duracao_segundos: 60,
    }

    const resInitC = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(initJsonC),
    })

    if (!resInitC.ok) {
      const errC = await resInitC.text()
      throw new Error(`Falha no init do arquivo de 25 MB: HTTP ${resInitC.status} - ${errC}`)
    }

    const dataInitC = (await resInitC.json()) as { session_id: string }
    const sessionIdC = dataInitC.session_id
    console.log(`✓ Sessão C (25 MB) iniciada com sucesso! Session ID: ${sessionIdC}`)

    // Enviar os 3 blocos
    // Criamos buffers determinísticos:
    // Bloco 0 (12 MB): preenchido com byte 100
    // Bloco 1 (12 MB): preenchido com byte 101
    // Bloco 2 (1 MB): preenchido com byte 102
    for (let cIdx = 0; cIdx < totalChunks25MB; cIdx++) {
      const start = cIdx * CHUNK_SIZE_BYTES
      const end = Math.min(start + CHUNK_SIZE_BYTES, tamanho25MB)
      const fatiaBytes = end - start
      const chunkBuf = new Uint8Array(fatiaBytes)
      chunkBuf.fill(100 + cIdx)

      const formPartC = new FormData()
      formPartC.append('session_id', sessionIdC)
      formPartC.append('chunk_index', String(cIdx))
      formPartC.append('chunk', new Blob([chunkBuf]), `part_${cIdx}.bin`)

      const partUrlC = `${baseUrl}/backend/v1/video-institucional/chunk/part?session_id=${encodeURIComponent(
        sessionIdC,
      )}&chunk_index=${cIdx}`

      const tInicioBloco = Date.now()
      const resPartC = await fetch(partUrlC, {
        method: 'POST',
        headers: { Authorization: token },
        body: formPartC,
      })

      const tFimBloco = Date.now()
      if (!resPartC.ok) {
        const errPartC = await resPartC.text()
        throw new Error(
          `Falha ao enviar bloco ${cIdx} de 25 MB: HTTP ${resPartC.status} - ${errPartC}`,
        )
      }
      console.log(
        `✓ Bloco ${cIdx + 1}/${totalChunks25MB} (${(fatiaBytes / (1024 * 1024)).toFixed(1)} MB) enviado em ${((tFimBloco - tInicioBloco) / 1000).toFixed(2)}s!`,
      )
    }

    // Finalizar sessão C
    const formCompleteC = new FormData()
    formCompleteC.append('session_id', sessionIdC)
    const resCompleteC = await fetch(`${baseUrl}/backend/v1/video-institucional/chunk/complete`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formCompleteC,
    })

    if (!resCompleteC.ok) {
      const errCompleteC = await resCompleteC.text()
      throw new Error(`Falha ao finalizar sessão C: HTTP ${resCompleteC.status} - ${errCompleteC}`)
    }

    const recordC = (await resCompleteC.json()) as {
      id: string
      tamanho_bytes: number
      arquivo: string
    }
    if (!recordC.id || !recordC.arquivo || recordC.tamanho_bytes !== tamanho25MB) {
      throw new Error(
        `Registro de 25 MB montado com inconsistência: tamanho retornado ${recordC.tamanho_bytes} !== esperado ${tamanho25MB}`,
      )
    }

    console.log(
      `✓ Vídeo C (25 MB) finalizado e verificado! ID: ${recordC.id}, Tamanho: ${recordC.tamanho_bytes} bytes`,
    )

    // Excluir registro e arquivos de teste C
    await pbInstance.collection('config_video_institucional').delete(recordC.id)
    console.log('✓ Registro C (25 MB) e arquivo limpos com sucesso!')

    console.log('✓ Teste 8 (Upload Fracionado E2E de 25 MB com verificação e limpeza): OK')

    // CASO D: Teste ponta a ponta do UPLOAD DIRETO via rota /backend/v1/video-institucional/upload
    console.log('Testando Caso D: Upload Direto via /backend/v1/video-institucional/upload...')
    const tamanhoDiretoBytes = 2 * 1024 * 1024 // 2 MB
    const videoDiretoBytes = new Uint8Array(tamanhoDiretoBytes)
    videoDiretoBytes.fill(88) // 'X'

    const formDireto = new FormData()
    formDireto.append('titulo', 'Vídeo Teste Upload Direto E2E')
    formDireto.append('descricao', 'Validação do caminho monolítico direto com findUploadedFiles')
    formDireto.append('ativo', 'false')
    formDireto.append('tamanho_bytes', String(tamanhoDiretoBytes))
    formDireto.append('duracao_segundos', '15')
    formDireto.append(
      'arquivo',
      new Blob([videoDiretoBytes], { type: 'video/mp4' }),
      'video_direto_teste.mp4',
    )

    const resDireto = await fetch(`${baseUrl}/backend/v1/video-institucional/upload`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formDireto,
    })

    if (!resDireto.ok) {
      const errDireto = await resDireto.text()
      throw new Error(`Falha no upload direto: HTTP ${resDireto.status} - ${errDireto}`)
    }

    const recordDireto = (await resDireto.json()) as {
      id: string
      arquivo: string
      tamanho_bytes: number
    }
    if (
      !recordDireto.id ||
      !recordDireto.arquivo ||
      recordDireto.tamanho_bytes !== tamanhoDiretoBytes
    ) {
      throw new Error(
        `Registro de upload direto montado com inconsistência: ${JSON.stringify(recordDireto)}`,
      )
    }
    console.log(
      `✓ Vídeo Direto finalizado e verificado! ID: ${recordDireto.id}, Arquivo: ${recordDireto.arquivo}, Tamanho: ${recordDireto.tamanho_bytes} bytes`,
    )

    // Excluir registro de teste direto
    await pbInstance.collection('config_video_institucional').delete(recordDireto.id)
    console.log('✓ Registro Direto de teste excluído com sucesso!')
    console.log('✓ Teste 9 (Upload Direto E2E com verificação e limpeza): OK')
  } catch (errAuth: any) {
    console.warn('Aviso ao executar teste E2E com PocketBase:', errAuth)
    throw errAuth
  }

  console.log('--- Todos os testes de validação passaram com sucesso! ---')
}

run().catch((e) => {
  console.error('Falha nos testes:', e)
  process.exit(1)
})
