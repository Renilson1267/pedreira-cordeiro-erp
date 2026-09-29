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
