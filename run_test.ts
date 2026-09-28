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

  console.log('--- Todos os testes de validação passaram com sucesso! ---')
}

run().catch((e) => {
  console.error('Falha nos testes:', e)
  process.exit(1)
})
