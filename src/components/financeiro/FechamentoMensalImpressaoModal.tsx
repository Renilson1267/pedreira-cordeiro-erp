import React, { useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Download, Building, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { FechamentoMensal, Empresa } from '@/types/erp'

interface FechamentoMensalImpressaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fechamento: FechamentoMensal | null
  empresa: Empresa | null
}

const MESES_NOMES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function FechamentoMensalImpressaoModal({
  open,
  onOpenChange,
  fechamento,
  empresa,
}: FechamentoMensalImpressaoModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!fechamento) return null

  const handlePrint = () => {
    window.print()
  }

  // Competência formatada
  const [anoStr, mesStr] = fechamento.competencia ? fechamento.competencia.split('-') : ['', '']
  const mesNum = Number(mesStr || fechamento.mes || 0)
  const anoNum = Number(anoStr || fechamento.ano || 0)
  const mesNomeExtenso = MESES_NOMES[mesNum] || mesStr
  const competenciaTexto = `${mesNomeExtenso.toUpperCase()} / ${anoNum}`

  const faturamento = Number(fechamento.faturamento || 0)
  const producaoM3 = Number(fechamento.producao_m3 || 0)
  const valorMedioM3 =
    fechamento.valor_medio_m3 !== undefined && fechamento.valor_medio_m3 !== null
      ? Number(fechamento.valor_medio_m3)
      : producaoM3 > 0
        ? faturamento / producaoM3
        : 0

  const despesasItens = fechamento.despesas_itens || []
  const totalDespesas =
    fechamento.total_despesas !== undefined && fechamento.total_despesas !== null
      ? Number(fechamento.total_despesas)
      : despesasItens.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)

  const investimento = Number(fechamento.investimento || 0)
  const saldoAposInvestimento =
    fechamento.saldo_apos_investimento !== undefined && fechamento.saldo_apos_investimento !== null
      ? Number(fechamento.saldo_apos_investimento)
      : faturamento - totalDespesas - investimento

  const formatNumero = (val?: number | null, sufixo = '') => {
    if (val === undefined || val === null || isNaN(val)) return '—'
    return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${sufixo}`.trim()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border border-gray-200">
        {/* Barra superior de ações na tela */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 bg-gray-900 text-white shadow-md print:hidden">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-teal-400" />
            <span className="text-sm font-semibold">
              Fechamento de Caixa — Diretoria ({fechamento.filial_nome || 'Filial'} •{' '}
              {competenciaTexto})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir / Salvar PDF (A4)
            </Button>
          </div>
        </div>

        {/* Folha do Relatório de Diretoria A4 */}
        <div
          ref={printRef}
          className="bg-white text-gray-900 p-8 sm:p-12 print:p-6 print:m-0 print:shadow-none font-sans text-sm"
        >
          {/* Estilos específicos de impressão para A4 limpo */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 15mm 15mm 15mm;
              }
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              nav, aside, header, footer, button, .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>

          {/* CABEÇALHO FORMAL DE DIRETORIA */}
          <div className="border-b-2 border-teal-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">
                  GRUPO PEDREIRA CORDEIRO / GC MIX
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">
                  FECHAMENTO DE CAIXA MENSAL
                </h1>
                <div className="text-sm font-semibold text-gray-700 mt-1 flex items-center gap-2">
                  <span>FILIAL / UNIDADE:</span>
                  <span className="inline-block bg-teal-50 text-teal-900 px-2 py-0.5 rounded font-bold border border-teal-200">
                    {fechamento.filial_nome || empresa?.nome_fantasia || 'São José do Egito (SJE)'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 uppercase font-semibold block">
                  COMPETÊNCIA
                </span>
                <span className="text-xl font-black text-teal-800 block">{competenciaTexto}</span>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Emitido em: {new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* 1. SEÇÃO: RESUMO COM FATURAMENTO, PRODUÇÃO M³ E VALOR MÉDIO */}
          <section className="mb-7">
            <div className="flex items-center justify-between bg-teal-900 text-white px-3 py-1.5 rounded-t-md font-bold text-xs uppercase tracking-wider">
              <span>1. RESUMO OPERACIONAL & FATURAMENTO</span>
              <span>UNIDADE / CONCRETO</span>
            </div>
            <div className="border border-t-0 border-gray-300 rounded-b-md p-4 bg-gray-50/50">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Faturamento Bruto
                  </span>
                  <span className="text-xl font-black text-emerald-700 block mt-1">
                    {formatCurrency(faturamento)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Volume faturado no mês
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Produção Concreto (m³)
                  </span>
                  <span className="text-xl font-black text-teal-900 block mt-1">
                    {formatNumero(producaoM3, 'm³')}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Volume usinado no período
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Valor Médio por m³
                  </span>
                  <span className="text-xl font-black text-blue-800 block mt-1">
                    {valorMedioM3 > 0 ? formatCurrency(valorMedioM3) : 'R$ 0,00'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Preço médio praticado / m³
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. SEÇÃO: DESPESAS POR ITEM COM VALOR E % DO TOTAL */}
          <section className="mb-7">
            <div className="flex items-center justify-between bg-teal-900 text-white px-3 py-1.5 rounded-t-md font-bold text-xs uppercase tracking-wider">
              <span>2. DESPESAS POR ITEM</span>
              <span>PARTICIPAÇÃO %</span>
            </div>
            <div className="border border-t-0 border-gray-300 rounded-b-md overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-700">
                    <th className="py-2 px-3 font-bold w-12 text-center">Nº</th>
                    <th className="py-2 px-3 font-bold">ITEM / DESCRIÇÃO DA DESPESA</th>
                    <th className="py-2 px-3 font-bold text-right w-36">VALOR (R$)</th>
                    <th className="py-2 px-3 font-bold text-right w-24">% DO TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {despesasItens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-400 italic">
                        Nenhum item de despesa registrado neste fechamento.
                      </td>
                    </tr>
                  ) : (
                    despesasItens.map((item, idx) => {
                      const v = Number(item.valor) || 0
                      const perc =
                        item.percentual !== undefined && item.percentual !== null
                          ? item.percentual
                          : totalDespesas > 0
                            ? (v / totalDespesas) * 100
                            : 0
                      const isVazioOuZero = isNaN(v) || v === 0

                      return (
                        <tr
                          key={item.id || idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}
                        >
                          <td className="py-1.5 px-3 text-center text-gray-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3 font-semibold text-gray-800">
                            {item.nome}
                            {item.observacao && (
                              <span className="text-[10px] text-gray-400 font-normal ml-2">
                                ({item.observacao})
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-medium text-gray-900">
                            {isVazioOuZero && item.nome.toUpperCase().includes('GABRIEL')
                              ? '—'
                              : isVazioOuZero
                                ? 'R$ 0,00'
                                : formatCurrency(v)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-600">
                            {isVazioOuZero ? '0,00 %' : `${perc.toFixed(2)} %`}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50 border-t-2 border-teal-800 font-bold text-teal-950">
                    <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-xs">
                      TOTAL DAS DESPESAS OPERACIONAIS
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-red-700">
                      {formatCurrency(totalDespesas)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      {totalDespesas > 0 ? '100,00 %' : '0,00 %'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* 3. SEÇÃO: CONSUMO DE INSUMOS */}
          <section className="mb-7">
            <div className="flex items-center justify-between bg-teal-900 text-white px-3 py-1.5 rounded-t-md font-bold text-xs uppercase tracking-wider">
              <span>3. CONSUMO DE INSUMOS NO PERÍODO</span>
              <span>VOLUMES & PESOS</span>
            </div>
            <div className="border border-t-0 border-gray-300 rounded-b-md p-4 bg-gray-50/40">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Cimento
                  </span>
                  <span className="text-base font-black text-gray-900 block mt-0.5">
                    {formatNumero(fechamento.consumo_cimento_kg, 'kg')}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {fechamento.consumo_cimento_kg
                      ? `~ ${(Number(fechamento.consumo_cimento_kg) / 50).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} sacos 50kg`
                      : '—'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Brita</span>
                  <span className="text-base font-black text-gray-900 block mt-0.5">
                    {formatNumero(fechamento.consumo_brita_kg, 'kg')}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {fechamento.consumo_brita_kg
                      ? `~ ${(Number(fechamento.consumo_brita_kg) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton`
                      : '—'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Areia</span>
                  <span className="text-base font-black text-gray-900 block mt-0.5">
                    {formatNumero(fechamento.consumo_areia_m3, 'm³')}
                  </span>
                  <span className="text-[10px] text-gray-400">Agregado miúdo</span>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Pó de Pedra
                  </span>
                  <span className="text-base font-black text-gray-900 block mt-0.5">
                    {formatNumero(fechamento.consumo_po_pedra)}
                  </span>
                  <span className="text-[10px] text-gray-400">Pedreira Cordeiro</span>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Aditivo
                  </span>
                  <span className="text-base font-black text-gray-900 block mt-0.5">
                    {formatNumero(fechamento.consumo_aditivo)}
                  </span>
                  <span className="text-[10px] text-gray-400">Plastificante / acelerador</span>
                </div>

                <div className="bg-white p-3 rounded border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Combustível
                  </span>
                  <span className="text-base font-black text-amber-700 block mt-0.5">
                    {formatNumero(fechamento.consumo_combustivel_litros, 'litros')}
                  </span>
                  <span className="text-[10px] text-gray-400">Diesel frota / betoneiras</span>
                </div>
              </div>
            </div>
          </section>

          {/* 4 & 5. SEÇÃO: INVESTIMENTO E SALDO APÓS INVESTIMENTO */}
          <section className="mb-6">
            <div className="flex items-center justify-between bg-teal-900 text-white px-3 py-1.5 rounded-t-md font-bold text-xs uppercase tracking-wider">
              <span>4. INVESTIMENTO & 5. RESULTADO FINAL</span>
              <span>SALDO DO CAIXA</span>
            </div>
            <div className="border border-t-0 border-gray-300 rounded-b-md p-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                {/* 4. Investimento */}
                <div className="bg-white p-4 rounded border border-gray-200">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                    4. Investimento
                  </span>
                  <span className="text-xl font-black text-amber-800 block mt-1">
                    {formatCurrency(investimento)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 block italic">
                    {fechamento.investimento_descricao || 'Nenhum detalhe especificado'}
                  </span>
                </div>

                {/* 5. Saldo após Investimento */}
                <div
                  className={`p-4 rounded border ${
                    saldoAposInvestimento >= 0
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                      : 'bg-red-50/70 border-red-300 text-red-950'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    5. Saldo após Investimento
                  </span>
                  <span
                    className={`text-2xl font-black block mt-1 ${
                      saldoAposInvestimento >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {formatCurrency(saldoAposInvestimento)}
                  </span>
                  <span className="text-xs text-gray-600 mt-1 block">
                    Resultado líquido final (Faturamento - Despesas - Investimento)
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Observações e Rodapé com assinaturas */}
          {fechamento.observacoes && (
            <div className="mb-8 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-700">
              <span className="font-bold block uppercase text-[10px] text-gray-400">
                Observações:
              </span>
              <p className="mt-0.5 whitespace-pre-line">{fechamento.observacoes}</p>
            </div>
          )}

          {/* Assinaturas formais de diretoria */}
          <div className="pt-10 mt-8 border-t border-gray-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-t border-gray-400 mx-auto w-48 mb-1.5" />
              <span className="font-bold text-gray-800 block">
                {fechamento.responsavel_nome || 'Responsável Operacional'}
              </span>
              <span className="text-[10px] text-gray-500 block">
                Filial {fechamento.filial_nome || 'São José do Egito'}
              </span>
            </div>
            <div>
              <div className="border-t border-gray-400 mx-auto w-48 mb-1.5" />
              <span className="font-bold text-gray-800 block">Diretoria Executiva</span>
              <span className="text-[10px] text-gray-500 block">
                Grupo Pedreira Cordeiro / GC Mix
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
