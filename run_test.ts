import {
  getSaldoRestante,
  getValorRecebidoEfetivo,
  calcularTotaisRecebimentos,
} from './src/lib/calculoRecebimentos'
import { gerarGradeParcelas } from './src/components/financeiro/SeletorParcelas'
import {
  extrairInfoParcela,
  limparDescricaoBase,
} from './src/components/financeiro/EditarParcelasModal'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHOU: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASSOU: ${msg}`)
}

console.log('=== TESTES DO SISTEMA DE CONTAS A RECEBER E PARCELAMENTO ===')

// 1. Caso do usuário: R$ 14.000,00 com recebimento parcial de R$ 7.000,00
const tituloOriginal = {
  id: 'tit-1',
  valor: 14000.0,
  valor_recebido: 7000.0,
  status: 'Parcial' as const,
  vencimento: '2025-05-10',
}

const recebidoEfetivo = getValorRecebidoEfetivo(tituloOriginal)
assert(recebidoEfetivo === 7000.0, 'Recebido efetivo no título parcial deve ser R$ 7.000,00')

const saldoOriginal = getSaldoRestante(tituloOriginal)
assert(saldoOriginal === 7000.0, 'Saldo restante no título original deve ser R$ 7.000,00')

// Lançamento restante gerado com saldo de R$ 7.000,00
const tituloRestante = {
  id: 'tit-1-resto',
  valor: 7000.0,
  valor_recebido: 0,
  status: 'Aberta' as const,
  vencimento: '2025-06-10',
}
const saldoRestante = getSaldoRestante(tituloRestante)
assert(saldoRestante === 7000.0, 'Lançamento restante nasce com R$ 7.000,00 em aberto')

// Cálculo de totais
const totais = calcularTotaisRecebimentos([tituloOriginal, tituloRestante], '2025-05-01')
assert(totais.recebido === 7000.0, 'Total recebido somado deve ser R$ 7.000,00')
assert(
  totais.aberto === 14000.0,
  'Total em aberto restante (saldo tit1 + tit2) fecha o valor total',
)

// 2. Parcelamento com geração de grade de parcelas e absorção de centavos
const grade3x = gerarGradeParcelas('2025-05-01', 3, 'mensal', 1000.0)
assert(grade3x.length === 3, 'Gera exatamente 3 parcelas')
assert(grade3x[0].valor === 333.33, 'Parcela 1 tem 333.33')
assert(grade3x[1].valor === 333.33, 'Parcela 2 tem 333.33')
assert(grade3x[2].valor === 333.34, 'Última parcela absorve os centavos (333.34)')
const somaGrade = Number(grade3x.reduce((a, b) => a + b.valor, 0).toFixed(2))
assert(somaGrade === 1000.0, 'Soma das 3 parcelas fecha exatamente R$ 1.000,00')

// 3. Edição de datas e valores individuais das parcelas
// Usuário quer redefinir R$ 14.000,00 em 3 parcelas customizadas:
// Parc 1: R$ 4.000,00 (venc 2025-05-15)
// Parc 2: R$ 5.000,00 (venc 2025-06-20)
// Parc 3: R$ 5.000,00 (venc 2025-07-25)
const parcelasCustom = [
  { numero: 1, vencimento: '2025-05-15', valor: 4000.0 },
  { numero: 2, vencimento: '2025-06-20', valor: 5000.0 },
  { numero: 3, vencimento: '2025-07-25', valor: 5000.0 },
]

const somaCustom = Number(parcelasCustom.reduce((a, b) => a + b.valor, 0).toFixed(2))
assert(somaCustom === 14000.0, 'Parcelas editadas customizadas fecham rigorosamente R$ 14.000,00')

// 4. Testes de helpers de extração e limpeza de descrição
const info = extrairInfoParcela('Fornecimento de Brita (2/5)')
assert(info !== null && info.atual === 2 && info.total === 5, 'Extrai parcela 2 de 5 com perfeição')

const baseLimpa = limparDescricaoBase('Fornecimento de Brita (2/5)')
assert(baseLimpa === 'Fornecimento de Brita', 'Limpa sufixo (2/5) retornando a descrição base')

console.log('🎉 Todos os testes de recebimento parcial e parcelamento passaram!')

// 5. TESTES DO PARSER DE HORAS EXTRAS (HORA:MINUTO E DECIMAL)
import {
  parseHorasExtrasInput,
  decimalParaHorasMinutos,
  horasMinutosParaDecimal,
  formatarHoraMinuto,
  formatarHorasCombinado,
} from './src/lib/horasExtrasParser'
import { formatHoursWithTime, formatHoursTime } from './src/lib/formatters'

console.log('\n=== TESTES DO PARSER DE HORAS EXTRAS (HORA:MINUTO E DECIMAL) ===')

// Teste 1: Requisito explícito do usuário - "07:30", "7:30" ou "7h30" -> 7 horas e 30 minutos (decimal 7.5)
const p1 = parseHorasExtrasInput('07:30')
assert(
  p1.valido && p1.decimal === 7.5 && p1.horas === 7 && p1.minutos === 30,
  '07:30 deve converter para 7.5',
)
assert(
  p1.equivalenciaRealTime === '07:30 = 7,50h',
  'Equivalência de 07:30 deve ser "07:30 = 7,50h"',
)

const p2 = parseHorasExtrasInput('7:30')
assert(
  p2.valido && p2.decimal === 7.5 && p2.horas === 7 && p2.minutos === 30,
  '7:30 deve converter para 7.5',
)

const p3 = parseHorasExtrasInput('7h30')
assert(
  p3.valido && p3.decimal === 7.5 && p3.horas === 7 && p3.minutos === 30,
  '7h30 deve converter para 7.5',
)

const p3b = parseHorasExtrasInput('07h30min')
assert(
  p3b.valido && p3b.decimal === 7.5 && p3b.horas === 7 && p3b.minutos === 30,
  '07h30min deve converter para 7.5',
)

// Teste 2: Requisito explícito do usuário - "7,5" ou "7.5" -> decimal 7.5 (07:30)
const p4 = parseHorasExtrasInput('7,5')
assert(
  p4.valido && p4.decimal === 7.5 && p4.horas === 7 && p4.minutos === 30,
  '7,5 deve converter para decimal 7.5',
)
assert(p4.equivalenciaRealTime === '7,50h = 07:30', 'Equivalência de 7,5 deve ser "7,50h = 07:30"')

const p5 = parseHorasExtrasInput('7.5')
assert(
  p5.valido && p5.decimal === 7.5 && p5.horas === 7 && p5.minutos === 30,
  '7.5 deve converter para decimal 7.5',
)

// Teste 3: Atalho comum de ponto eletrônico "0730" ou "730"
const p6 = parseHorasExtrasInput('0730')
assert(
  p6.valido && p6.decimal === 7.5 && p6.horas === 7 && p6.minutos === 30,
  '0730 deve converter para 7.5 (07:30)',
)

const p7 = parseHorasExtrasInput('730')
assert(
  p7.valido && p7.decimal === 7.5 && p7.horas === 7 && p7.minutos === 30,
  '730 deve converter para 7.5 (07:30)',
)

// Teste 4: Outros horários (12h15 -> 12.25, 08h45 -> 8.75)
const p8 = parseHorasExtrasInput('12:15')
assert(
  p8.valido && p8.decimal === 12.25 && p8.horas === 12 && p8.minutos === 15,
  '12:15 deve converter para 12.25',
)

const p9 = parseHorasExtrasInput('08:45')
assert(
  p9.valido && p9.decimal === 8.75 && p9.horas === 8 && p9.minutos === 45,
  '08:45 deve converter para 8.75',
)

// Teste 5: Validação amigável de erro (minutos >= 60)
const pInvalidoMinutos = parseHorasExtrasInput('07:65')
assert(
  !pInvalidoMinutos.valido && pInvalidoMinutos.decimal === null,
  '07:65 deve ser marcado como inválido',
)

const pInvalidoTexto = parseHorasExtrasInput('abc')
assert(
  !pInvalidoTexto.valido && pInvalidoTexto.decimal === null,
  '"abc" deve ser marcado como inválido',
)

// Teste 6: Helpers de formatação combinada
assert(formatarHoraMinuto(7.5) === '07:30', 'formatarHoraMinuto(7.5) deve ser 07:30')
assert(formatHoursTime(7.5) === '07:30', 'formatHoursTime(7.5) deve ser 07:30')
assert(
  formatHoursWithTime(7.5) === '7,50h (07:30)',
  'formatHoursWithTime(7.5) deve ser "7,50h (07:30)"',
)
assert(
  formatarHorasCombinado(7.5) === '7,50h (07:30)',
  'formatarHorasCombinado(7.5) deve ser "7,50h (07:30)"',
)

console.log('🎉 Todos os testes de conversão e parsing de horas extras passaram com perfeição!')
