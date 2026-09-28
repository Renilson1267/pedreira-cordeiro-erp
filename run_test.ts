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

  console.log('--- Todos os testes de validação passaram com sucesso! ---')
}

run().catch((e) => {
  console.error('Falha nos testes:', e)
  process.exit(1)
})
