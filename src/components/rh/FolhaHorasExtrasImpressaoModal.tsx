import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Building, FileSpreadsheet } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { FolhaHorasExtras, Empresa } from '@/types/erp'

interface FolhaHorasExtrasImpressaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itens: FolhaHorasExtras[]
  empresa: Empresa | null
  mesReferenciaFiltro?: string
  modoCalculoFiltro?: string
}

export const FolhaHorasExtrasImpressaoModal: React.FC<FolhaHorasExtrasImpressaoModalProps> = ({
  open,
  onOpenChange,
  itens,
  empresa,
  mesReferenciaFiltro = 'todos',
  modoCalculoFiltro = 'todos',
}) => {
  const handlePrint = () => {
    window.print()
  }

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // CNPJ e dados corporativos oficiais
  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'Grupo Pedreira Cordeiro'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  // Mês de referência para o título
  const tituloMes =
    mesReferenciaFiltro && mesReferenciaFiltro !== 'todos'
      ? mesReferenciaFiltro
      : itens.length > 0
        ? Array.from(new Set(itens.map((i) => i.mes_referencia))).join(', ')
        : 'Geral'

  // Modo de cálculo descritivo se filtrado
  const descricaoModo =
    modoCalculoFiltro === 'padrao_50'
      ? 'Modo: 50% para todas as horas'
      : modoCalculoFiltro === 'clt_vigente'
        ? 'Modo: CLT Vigente (50% úteis / 100% domingos e feriados)'
        : null

  // Totais consolidados
  const totalHorasGeral = itens.reduce((acc, f) => acc + (f.total_horas || 0), 0)
  const totalHoras50 = itens.reduce((acc, f) => acc + (f.horas_50 || 0), 0)
  const totalValor50 = itens.reduce((acc, f) => acc + (f.valor_horas_50 || 0), 0)
  const totalHoras100 = itens.reduce((acc, f) => acc + (f.horas_100 || 0), 0)
  const totalValor100 = itens.reduce((acc, f) => acc + (f.valor_horas_100 || 0), 0)
  const totalBrutoGeral = itens.reduce((acc, f) => acc + (f.total_valor || 0), 0)
  const totalGratificacoes = itens.reduce((acc, f) => acc + (f.gratificacao || 0), 0)
  const totalAdiantamentos = itens.reduce((acc, f) => acc + (f.adiantamento || 0), 0)
  const totalLiquidoGeral = itens.reduce((acc, f) => {
    const liq =
      typeof f.valor_liquido === 'number'
        ? f.valor_liquido
        : f.total_valor + (f.gratificacao || 0) - (f.adiantamento || 0)
    return acc + liq
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] lg:max-w-6xl max-h-[94vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4]"
        aria-describedby="folha-impressao-description"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              Folha Completa de Horas Extras — Impressão A4 Paisagem
            </DialogTitle>
            <DialogDescription
              id="folha-impressao-description"
              className="text-xs text-gray-500 mt-0.5"
            >
              Listagem consolidada em orientação <strong>A4 Paisagem</strong> com todos os
              funcionários filtrados, memória financeira, totalizadores e espaço para assinaturas.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Folha (A4 Paisagem)
            </Button>
          </div>
        </DialogHeader>

        {/* ÁREA DE IMPRESSÃO / FOLHA A4 PAISAGEM */}
        <div className="print-only-container mt-2">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-tight">
            {/* CABEÇALHO OFICIAL */}
            <div className="border-b-2 border-teal-800 pb-3 mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl print:text-teal-900 print:bg-transparent print:border print:border-teal-900 shrink-0">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-teal-950 uppercase">
                    {empresaNome}
                  </h1>
                  <div className="text-xs text-gray-700 font-medium">
                    {empresaRazao} • CNPJ:{' '}
                    <span className="font-mono font-bold">{empresaCnpj}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Mineração, Britagem, Fabricação de Concreto Usinado e Pavimentação
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-teal-50 border border-teal-300 text-teal-950 font-bold text-xs uppercase tracking-wider rounded">
                  FOLHA DE HORAS EXTRAS — {tituloMes}
                </div>
                {descricaoModo && (
                  <div className="text-[11px] text-gray-600 mt-1 font-medium">{descricaoModo}</div>
                )}
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Total de Funcionários Listados: <strong>{itens.length}</strong>
                </div>
              </div>
            </div>

            {/* TABELA COM THEAD DISPLAY: TABLE-HEADER-GROUP PARA REPETIÇÃO NATURAL ENTRE PÁGINAS A4 */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse text-[11px] border border-gray-300 folha-print-table">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-800 font-bold border-b border-gray-300 uppercase text-[10px]">
                    <th className="py-2 px-1.5 text-center w-8 border-r border-gray-300">Nº</th>
                    <th className="py-2 px-2.5 border-r border-gray-300">Funcionário / CPF</th>
                    <th className="py-2 px-2.5 border-r border-gray-300">Cargo / Setor</th>
                    <th className="py-2 px-2 text-center border-r border-gray-300">
                      HE 50%
                      <span className="block font-normal text-[9px] text-gray-600">Qtd / R$</span>
                    </th>
                    <th className="py-2 px-2 text-center border-r border-gray-300">
                      HE 100%
                      <span className="block font-normal text-[9px] text-gray-600">Qtd / R$</span>
                    </th>
                    <th className="py-2 px-1.5 text-center border-r border-gray-300">Total H.</th>
                    <th className="py-2 px-2 text-right border-r border-gray-300">Bruto HE</th>
                    <th className="py-2 px-2 text-right border-r border-gray-300 text-emerald-800">
                      Gratif. (+)
                    </th>
                    <th className="py-2 px-2 text-right border-r border-gray-300 text-red-700">
                      Adiant. (−)
                    </th>
                    <th className="py-2 px-2.5 text-right border-r border-gray-300 text-teal-950 bg-teal-50/70 print:bg-teal-100/50">
                      VALOR LÍQUIDO
                    </th>
                    <th className="py-2 px-2 text-center w-40">Assinatura do Funcionário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-500 italic">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    itens.map((folha, idx) => {
                      const func = folha.expand?.funcionario_id
                      const grat = folha.gratificacao || 0
                      const adiant = folha.adiantamento || 0
                      const liq =
                        typeof folha.valor_liquido === 'number'
                          ? folha.valor_liquido
                          : folha.total_valor + grat - adiant

                      return (
                        <tr
                          key={folha.id}
                          className="hover:bg-gray-50/50 print:hover:bg-transparent page-break-inside-avoid"
                        >
                          <td className="py-1.5 px-1.5 text-center font-mono text-gray-500 border-r border-gray-200">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200">
                            <div className="font-bold text-gray-900 leading-tight">
                              {func?.nome || 'Não informado'}
                            </div>
                            {func?.cpf && (
                              <div className="text-[9px] font-mono text-gray-500">
                                CPF: {func.cpf}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200">
                            <div className="font-medium text-gray-800 leading-tight">
                              {func?.cargo || 'Colaborador'}
                            </div>
                            <div className="text-[9px] text-gray-500">
                              {func?.setor || 'Operacional'}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono border-r border-gray-200 tabular-nums">
                            <div>{(folha.horas_50 || 0).toFixed(1)}h</div>
                            <div className="text-[9px] text-gray-500">
                              {formatCurrency(folha.valor_horas_50 || 0)}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono border-r border-gray-200 tabular-nums">
                            {folha.horas_100 && folha.horas_100 > 0 ? (
                              <>
                                <div>{folha.horas_100.toFixed(1)}h</div>
                                <div className="text-[9px] text-gray-500">
                                  {formatCurrency(folha.valor_horas_100 || 0)}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold text-gray-900 border-r border-gray-200 tabular-nums">
                            {(folha.total_horas || 0).toFixed(1)}h
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-semibold text-gray-800 border-r border-gray-200 tabular-nums">
                            {formatCurrency(folha.total_valor || 0)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-medium text-emerald-800 border-r border-gray-200 tabular-nums">
                            {grat > 0 ? (
                              `+${formatCurrency(grat)}`
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-medium text-red-700 border-r border-gray-200 tabular-nums">
                            {adiant > 0 ? (
                              `-${formatCurrency(adiant)}`
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-teal-950 border-r border-gray-200 tabular-nums bg-teal-50/40 print:bg-teal-100/40">
                            {formatCurrency(liq)}
                          </td>
                          <td className="py-1.5 px-2 text-center align-bottom">
                            <div className="w-full border-b border-gray-400 h-6"></div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>

                {/* TOTAIS DO MÊS CONSOLIDADOS */}
                <tfoot>
                  <tr className="bg-gray-100 print:bg-gray-200 border-t-2 border-gray-400 font-bold text-[11px] text-gray-900">
                    <td
                      colSpan={3}
                      className="py-2.5 px-3 text-right uppercase border-r border-gray-300"
                    >
                      TOTAIS GERAIS DO PERÍODO:
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono border-r border-gray-300 tabular-nums">
                      <div>{totalHoras50.toFixed(1)}h</div>
                      <div className="text-[9px] text-gray-600 font-normal">
                        {formatCurrency(totalValor50)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono border-r border-gray-300 tabular-nums">
                      <div>{totalHoras100.toFixed(1)}h</div>
                      <div className="text-[9px] text-gray-600 font-normal">
                        {formatCurrency(totalValor100)}
                      </div>
                    </td>
                    <td className="py-2.5 px-1.5 text-center font-mono font-extrabold border-r border-gray-300 tabular-nums">
                      {totalHorasGeral.toFixed(1)}h
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-extrabold text-gray-950 border-r border-gray-300 tabular-nums">
                      {formatCurrency(totalBrutoGeral)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-900 border-r border-gray-300 tabular-nums">
                      {totalGratificacoes > 0
                        ? `+${formatCurrency(totalGratificacoes)}`
                        : 'R$ 0,00'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-red-700 border-r border-gray-300 tabular-nums">
                      {totalAdiantamentos > 0
                        ? `-${formatCurrency(totalAdiantamentos)}`
                        : 'R$ 0,00'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-sm font-black text-teal-950 border-r border-gray-300 tabular-nums bg-teal-100/70 print:bg-teal-200/60">
                      {formatCurrency(totalLiquidoGeral)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-[10px] text-gray-500 font-medium">
                      {itens.length} {itens.length === 1 ? 'lançamento' : 'lançamentos'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SEÇÃO DE ASSINATURA DA EMPRESA E RESPONSÁVEL */}
            <div className="mt-8 pt-4 border-t border-gray-300 page-break-inside-avoid">
              <div className="flex justify-between items-center text-xs text-gray-700 mb-6 font-medium">
                <div>
                  <strong>Local / Emissão:</strong> São José do Egito / PB
                </div>
                <div>
                  <strong>Data de Fechamento da Folha:</strong> {dataExtenso}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-2">
                <div className="text-center">
                  <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                    DEPARTAMENTO PESSOAL / RH
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Elaboração & Apuração das Horas
                  </div>
                  <div className="text-[9px] text-gray-400">{empresaNome}</div>
                </div>

                <div className="text-center">
                  <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                    DIRETORIA / GERÊNCIA OPERACIONAL
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Aprovação da Folha de Horas Extras
                  </div>
                  <div className="text-[9px] text-gray-400">G C DO AMARAL SERTANIA</div>
                </div>

                <div className="text-center">
                  <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                    DIRETORIA FINANCEIRA / PAGAMENTOS
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Conferência e Liberação de Recursos
                  </div>
                  <div className="text-[9px] text-gray-400">CNPJ: {empresaCnpj}</div>
                </div>
              </div>

              {/* RODAPÉ DO DOCUMENTO */}
              <div className="mt-6 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
                Documento oficial emitido eletronicamente pelo Sistema de Gestão ERP Grupo Pedreira
                Cordeiro • Folha consolidada de horas extras e adicionais trabalhistas (A4
                Paisagem).
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
