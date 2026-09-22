import * as XLSX from 'xlsx'
import {
  inferirCompetenciaAba,
  detectarLinhaCabecalho,
  normalizarNomeColuna,
  parseValorPagar,
  parseDataPagar,
} from './src/components/financeiro/ImportadorContasPagarModal'

function testParser() {
  console.log('=== INICIANDO TESTE SINTETICO DO PARSER ===')

  // 1. Testar inferência de competência
  const compSet2 = inferirCompetenciaAba('SETEMBRO_2026.2')
  console.assert(
    compSet2.ano === 2026 && compSet2.mes === 9 && compSet2.sufixo === '.2',
    'Falha comp SETEMBRO_2026.2',
  )

  const compOut = inferirCompetenciaAba('OUTUBRO_2026')
  console.assert(compOut.ano === 2026 && compOut.mes === 10, 'Falha comp OUTUBRO_2026')

  const compNov = inferirCompetenciaAba('NOVEMBRO_2026')
  console.assert(compNov.ano === 2026 && compNov.mes === 11, 'Falha comp NOVEMBRO_2026')

  const compDez = inferirCompetenciaAba('DEZEMBRO_2026')
  console.assert(compDez.ano === 2026 && compDez.mes === 12, 'Falha comp DEZEMBRO_2026')

  // 2. Testar detecção de cabeçalho com título mesclado no topo
  const matrixComTitulo = [
    ['RELATÓRIO DE CONTAS A PAGAR - PEDREIRA CORDEIRO 2026', '', '', ''],
    ['', '', '', ''],
    ['DT VENC', 'FAVORECIDO / CREDOR', 'HISTÓRICO', 'VALOR (R$)'],
    ['01/09/2026', 'FORNECEDOR A', 'COMPRA BRITA', '1.500,50'],
    ['SUBTOTAL SEMANA 1', '', '', '1.500,50'],
    ['15/09/2026', 'FORNECEDOR B', 'SERVIÇO MECÂNICO', '2.300,00'],
    ['TOTAL DO MÊS', '', '', '3.800,50'],
  ]
  const cabecalhoLinha = detectarLinhaCabecalho(matrixComTitulo)
  console.assert(cabecalhoLinha === 3, `Cabeçalho esperado linha 3, obteve ${cabecalhoLinha}`)

  // 3. Testar normalizarNomeColuna
  console.assert(
    normalizarNomeColuna('VALOR\u00A0(R$)') === 'VALOR R',
    'Falha normalizar valor NBSP',
  )
  console.assert(normalizarNomeColuna('DT. VENC.') === 'DT VENC', 'Falha normalizar DT. VENC.')
  console.assert(
    normalizarNomeColuna('HISTÓRICO / FAVORECIDO') === 'HISTORICO FAVORECIDO',
    'Falha normalizar historico',
  )

  // 4. Testar parseDataPagar com múltiplos formatos e fuso
  const d1 = parseDataPagar('Mon Jun 01 2026 00:00:00 GMT-0300', 2026, 6)
  console.assert(d1.startsWith('2026-06-01'), `Data texto falhou: ${d1}`)

  const d2 = parseDataPagar('15 / 09 / 2026', 2026, 9)
  console.assert(d2.startsWith('2026-09-15'), `Data com espaços falhou: ${d2}`)

  const d3 = parseDataPagar(46265) // Excel serial
  console.assert(d3.includes('2026'), `Serial Excel falhou: ${d3}`)

  // 5. Testar parseValorPagar
  console.assert(parseValorPagar('R$\u00A01.250,75') === 1250.75, 'Falha parse valor R$ NBSP')
  console.assert(parseValorPagar('3.450,00') === 3450, 'Falha parse valor milhar')

  // 6. Testar simulação de extração de linhas em memória com subtotais no meio
  const headerIdx = cabecalhoLinha
  const currentSheetHeaders = matrixComTitulo[headerIdx - 1].map((c: any) => String(c || '').trim())
  const dataRows = matrixComTitulo.slice(headerIdx)

  const findColInSheet = (pattern: RegExp) =>
    currentSheetHeaders.find(
      (h: string) => pattern.test(normalizarNomeColuna(h)) || pattern.test(h),
    ) || ''

  const vencCol = findColInSheet(/^VENC|VENCIMENTO|DT VENC|DATA VENC|DIA|DATA/i)
  const fornCol = findColInSheet(
    /FORNECEDOR|FAVORECIDO|CREDOR|BENEFICIARIO|EMPRESA|HISTORICO FAVORECIDO/i,
  )
  const valCol = findColInSheet(/VALOR TOTAL|VALOR R|VALOR|BRUTO|A PAGAR/i)

  console.assert(
    Boolean(vencCol && fornCol && valCol),
    `Colunas não resolvidas: venc=${vencCol}, forn=${fornCol}, val=${valCol}`,
  )

  const lancamentosValidos = []
  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r]
    const rowTextJoined = row
      .map((c: any) => normalizarNomeColuna(c))
      .filter(Boolean)
      .join(' ')
    if (
      rowTextJoined.startsWith('TOTAL') ||
      rowTextJoined.startsWith('SUBTOTAL') ||
      rowTextJoined.startsWith('SUB TOTAL') ||
      rowTextJoined.startsWith('SALDO') ||
      rowTextJoined.includes('TOTAL SEMANA') ||
      rowTextJoined.includes('SUBTOTAL SEMANA')
    ) {
      continue
    }

    const colIdxVal = currentSheetHeaders.indexOf(valCol)
    const rawVal = parseValorPagar(row[colIdxVal])
    if (rawVal > 0) {
      lancamentosValidos.push({
        venc: row[currentSheetHeaders.indexOf(vencCol)],
        forn: row[currentSheetHeaders.indexOf(fornCol)],
        valor: rawVal,
      })
    }
  }

  console.assert(
    lancamentosValidos.length === 2,
    `Esperado 2 lançamentos (sem subtotal nem total), obteve ${lancamentosValidos.length}`,
  )
  console.assert(
    lancamentosValidos[0].forn === 'FORNECEDOR A' && lancamentosValidos[0].valor === 1500.5,
    'Lançamento 1 incorreto',
  )
  console.assert(
    lancamentosValidos[1].forn === 'FORNECEDOR B' && lancamentosValidos[1].valor === 2300,
    'Lançamento 2 incorreto',
  )

  console.log('=== TODOS OS TESTES SINTETICOS PASSARAM COM SUCESSO! ===')
}

testParser()
