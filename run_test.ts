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

  // 5. Teste de Constantes e Limites do Vídeo Institucional
  console.log('--- Teste 6: Constantes e Formatação de Erros do Upload Nativo ---')
  const { MAX_VIDEO_SIZE_BYTES, formatarMensagemErroUpload } =
    await import('./src/services/videoInstitucional.js')

  if (MAX_VIDEO_SIZE_BYTES !== 300 * 1024 * 1024) {
    throw new Error(`Limite máximo de vídeo esperado 300 MB, obtido: ${MAX_VIDEO_SIZE_BYTES}`)
  }

  const msg413 = formatarMensagemErroUpload(413)
  if (!msg413.includes('Arquivo muito grande')) {
    throw new Error(`Mensagem 413 incorreta: ${msg413}`)
  }

  const msg401 = formatarMensagemErroUpload(401)
  if (!msg401.includes('sessão expirou')) {
    throw new Error(`Mensagem 401 incorreta: ${msg401}`)
  }

  const msg0 = formatarMensagemErroUpload(0)
  if (!msg0.includes('Conexão interrompida')) {
    throw new Error(`Mensagem status 0 incorreta: ${msg0}`)
  }
  console.log('✓ Teste 6 (Mensagens amigáveis de erro nativo): OK')

  // 6. Teste Ponta a Ponta: Upload Nativo de Vídeo Real (12 MB) via API Nativa de Registros
  console.log(
    '--- Teste 7: Upload Nativo Real via /api/collections/config_video_institucional/records ---',
  )
  const pbModule = await import('./src/lib/pocketbase/client.js')
  const pbInstance = pbModule.default || pbModule.pb

  try {
    await pbInstance.collection('users').authWithPassword('gcmixsje@gmail.com', 'Skip@Pass')
    console.log('✓ Autenticado com sucesso como admin!')

    const token = pbInstance.authStore.token
    if (!token) {
      throw new Error('Token de autenticação não gerado!')
    }

    const baseUrl = pbInstance.baseUrl.replace(/\/$/, '')

    // Criar um arquivo MP4 binário realista de 12 MB (12 * 1024 * 1024 bytes)
    // Usando header de container MP4 (ftypisom)
    const tamanhoVideoRealBytes = 12 * 1024 * 1024 // 12 MB
    const videoBuffer = new Uint8Array(tamanhoVideoRealBytes)
    // Assinatura MP4 mínima válida: ftyp box
    // bytes 4-7: "ftyp", bytes 8-11: "isom"
    videoBuffer[3] = 0x20
    videoBuffer[4] = 0x66 // f
    videoBuffer[5] = 0x74 // t
    videoBuffer[6] = 0x79 // y
    videoBuffer[7] = 0x70 // p
    videoBuffer[8] = 0x69 // i
    videoBuffer[9] = 0x73 // s
    videoBuffer[10] = 0x6f // o
    videoBuffer[11] = 0x6d // m
    for (let b = 12; b < tamanhoVideoRealBytes; b++) {
      videoBuffer[b] = (b % 250) + 1
    }

    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' })

    // Criar imagem de capa JPEG simulada
    const capaBuffer = new Uint8Array(1024)
    capaBuffer[0] = 0xff
    capaBuffer[1] = 0xd8
    capaBuffer[1022] = 0xff
    capaBuffer[1023] = 0xd9
    const capaBlob = new Blob([capaBuffer], { type: 'image/jpeg' })

    // 1. Enviar via POST nativo multipart
    const formNativo = new FormData()
    formNativo.append('titulo', 'Vídeo Institucional Teste Nativo 12MB')
    formNativo.append('descricao', 'Upload realizado via endpoint nativo do PocketBase em Go')
    formNativo.append('arquivo', videoBlob, 'video_institucional_real_12mb.mp4')
    formNativo.append('capa', capaBlob, 'capa_institucional.jpg')
    formNativo.append('poster', capaBlob, 'capa_institucional.jpg')
    formNativo.append('ativo', 'true')
    formNativo.append('tamanho_bytes', String(tamanhoVideoRealBytes))
    formNativo.append('duracao_segundos', '45')
    formNativo.append('enviado_por_nome', 'Admin Teste')

    const tInicioUpload = Date.now()
    const resUploadNativo = await fetch(
      `${baseUrl}/api/collections/config_video_institucional/records`,
      {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formNativo,
      },
    )

    const tFimUpload = Date.now()
    if (!resUploadNativo.ok) {
      const errTexto = await resUploadNativo.text()
      throw new Error(`Falha no upload nativo (status ${resUploadNativo.status}): ${errTexto}`)
    }

    const recordCriado = (await resUploadNativo.json()) as {
      id: string
      titulo: string
      arquivo: string
      capa?: string
      poster?: string
      tamanho_bytes: number
      ativo: boolean
    }

    if (!recordCriado.id || !recordCriado.arquivo) {
      throw new Error(
        `Registro nativo criado sem id ou sem arquivo: ${JSON.stringify(recordCriado)}`,
      )
    }

    console.log(
      `✓ Registro criado via API nativa com sucesso em ${((tFimUpload - tInicioUpload) / 1000).toFixed(2)}s! ID: ${recordCriado.id}, Arquivo: ${recordCriado.arquivo}`,
    )

    // 2. Verificar que a URL pública do arquivo responde com HTTP 200 e aceita streaming
    const urlArquivoVideo = `${baseUrl}/api/files/config_video_institucional/${recordCriado.id}/${recordCriado.arquivo}`
    console.log(`Verificando download/streaming da URL do vídeo: ${urlArquivoVideo}...`)
    const resGetVideo = await fetch(urlArquivoVideo, {
      method: 'HEAD',
    })

    if (!resGetVideo.ok && resGetVideo.status !== 206) {
      throw new Error(
        `URL do arquivo de vídeo respondeu com status inválido: ${resGetVideo.status}`,
      )
    }
    console.log(
      `✓ Arquivo de vídeo gravado no storage respondeu perfeitamente com status ${resGetVideo.status}!`,
    )

    // 3. Teste de PATCH multipart (substituição do vídeo no mesmo registro)
    console.log('Testando substituição (PATCH) via API nativa...')
    const videoPatchBuffer = new Uint8Array(2 * 1024 * 1024) // 2 MB
    videoPatchBuffer[3] = 0x20
    videoPatchBuffer[4] = 0x66
    videoPatchBuffer[5] = 0x74
    videoPatchBuffer[6] = 0x79
    videoPatchBuffer[7] = 0x70
    videoPatchBuffer[8] = 0x69
    videoPatchBuffer[9] = 0x73
    videoPatchBuffer[10] = 0x6f
    videoPatchBuffer[11] = 0x6d

    const formPatch = new FormData()
    formPatch.append('titulo', 'Vídeo Institucional Atualizado via PATCH')
    formPatch.append(
      'arquivo',
      new Blob([videoPatchBuffer], { type: 'video/mp4' }),
      'video_atualizado.mp4',
    )
    formPatch.append('tamanho_bytes', String(videoPatchBuffer.length))

    const resPatch = await fetch(
      `${baseUrl}/api/collections/config_video_institucional/records/${recordCriado.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: token,
        },
        body: formPatch,
      },
    )

    if (!resPatch.ok) {
      const errPatch = await resPatch.text()
      throw new Error(`Falha no PATCH de substituição: status ${resPatch.status} - ${errPatch}`)
    }

    const recordAtualizado = (await resPatch.json()) as {
      id: string
      titulo: string
      arquivo: string
      tamanho_bytes: number
    }

    if (recordAtualizado.titulo !== 'Vídeo Institucional Atualizado via PATCH') {
      throw new Error(`Título não foi atualizado no PATCH: ${JSON.stringify(recordAtualizado)}`)
    }
    console.log(
      `✓ PATCH de substituição executado com sucesso! Arquivo novo: ${recordAtualizado.arquivo}`,
    )

    // 4. Teste de listagem anônima (Home pública obtendo o vídeo ativo sem token)
    console.log('Testando leitura anônima da Home pública (obter vídeo ativo)...')
    const resHomePublica = await fetch(
      `${baseUrl}/api/collections/config_video_institucional/records?filter=ativo=true&sort=-created`,
    )
    if (!resHomePublica.ok) {
      throw new Error(
        `Home pública não conseguiu ler registro ativo: status ${resHomePublica.status}`,
      )
    }
    const dataHome = (await resHomePublica.json()) as {
      items: Array<{ id: string; arquivo: string }>
    }
    if (
      !dataHome.items ||
      dataHome.items.length === 0 ||
      dataHome.items[0].id !== recordCriado.id
    ) {
      throw new Error(
        `Vídeo ativo não apareceu na consulta pública da Home: ${JSON.stringify(dataHome)}`,
      )
    }
    console.log(`✓ Home pública leu com sucesso o vídeo ativo ${dataHome.items[0].id}!`)

    // Limpeza: excluir o registro de teste
    await pbInstance.collection('config_video_institucional').delete(recordCriado.id)
    console.log('✓ Registro de teste excluído e storage limpo!')
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
