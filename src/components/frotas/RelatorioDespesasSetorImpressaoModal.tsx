import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Building, Truck, Wrench, Fuel, Shield, Layers } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Empresa, DespesaFrota, Veiculo } from '@/types/erp'

export interface ItemDespesaImpressao {
  id: string
  data: string
  veiculo_codigo: string
  veiculo_modelo?: string
  placa?: string
  setor: string
  tipo: string
  descricao: string
  fornecedor: string
  valor: number
  natureza: 'Despesa' | 'Abatimento'
  status: string
}

interface RelatorioDespesasSetorImpressaoModalProps {
  setor: string
  empresa: Empresa | null
  itens: ItemDespesaImpressao[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const RelatorioDespesasSetorImpressaoModal: React.FC<
  RelatorioDespesasSetorImpressaoModalProps
> = ({ setor, empresa, itens, open, onOpenChange }) => {
  const handlePrint = () => {
    window.print()
  }

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  // Cálculos consolidados
  const totalDespesas = itens
    .filter((i) => i.natureza !== 'Abatimento' && i.status !== 'Cancelado')
    .reduce((acc, i) => acc + (i.valor || 0), 0)

  const totalAbatimentos = itens
    .filter((i) => i.natureza === 'Abatimento' && i.status !== 'Cancelado')
    .reduce((acc, i) => acc + (i.valor || 0), 0)

  const saldoLiquido = totalDespesas - totalAbatimentos

  // Agrupamento por equipamento
  const porEquipamento = itens.reduce(
    (acc, item) => {
      const chave = item.veiculo_codigo || 'Sem código'
      if (!acc[chave]) {
        acc[chave] = {
          codigo: item.veiculo_codigo,
          modelo: item.veiculo_modelo || '',
          placa: item.placa || '',
          totalDespesas: 0,
          totalAbatimentos: 0,
          qtd: 0,
        }
      }
      acc[chave].qtd += 1
      if (item.natureza === 'Abatimento') {
        acc[chave].totalAbatimentos += item.valor || 0
      } else {
        acc[chave].totalDespesas += item.valor || 0
      }
      return acc
    },
    {} as Record<
      string,
      {
        codigo: string
        modelo: string
        placa: string
        totalDespesas: number
        totalAbatimentos: number
        qtd: number
      }
    >,
  )

  const listaAgrupada = Object.values(porEquipamento)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-documento-impressao="relatorio-despesas-setor"
        className="max-w-[96vw] lg:max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4] print:static print:transform-none print:max-w-full print:p-0 print:border-none print:shadow-none print:bg-white print:overflow-visible"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              <span>Relatório Oficial de Despesas da Frota por Setor</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 mt-0.5">
              Setor: <strong>{setor}</strong> • Formato <strong>A4</strong> para impressão e PDF
              oficial com cabeçalho Grupo Pedreira Cordeiro.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Relatório (A4)
            </Button>
          </div>
        </DialogHeader>

        {/* CONTAINER IMPRESSÃO A4 */}
        <div className="print-only-container mt-2">
          <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-relaxed text-xs">
            {/* CABEÇALHO OFICIAL */}
            <div className="border-b-2 border-teal-800 pb-3 mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl print:text-teal-900 print:bg-transparent print:border print:border-teal-900">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-teal-950 uppercase">
                    {empresaNome}
                  </h1>
                  <div className="text-xs text-gray-700 font-semibold">
                    {empresaRazao} • CNPJ: <span className="font-mono">{empresaCnpj}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Demonstrativo Integrado de Custos e Despesas Operacionais de Equipamentos
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-teal-50 border border-teal-300 text-teal-900 font-bold text-xs uppercase tracking-wider rounded">
                  Setor: {setor}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Emissão: <strong>{dataExtenso}</strong>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Total de Lançamentos: {itens.length}
                </div>
              </div>
            </div>

            {/* RESUMO CONSOLIDADO POR EQUIPAMENTO DESTE SETOR */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5 mb-2">
                <Truck className="w-3.5 h-3.5" />
                Consolidação por Equipamento — Setor {setor}
              </h2>

              <table className="w-full text-left border-collapse text-xs border border-gray-300 mb-2">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-2 px-3">Cód. Interno</th>
                    <th className="py-2 px-3">Equipamento / Modelo</th>
                    <th className="py-2 px-3">Placa</th>
                    <th className="py-2 px-3 text-center">Itens</th>
                    <th className="py-2 px-3 text-right">Despesas (R$)</th>
                    <th className="py-2 px-3 text-right">Abatimentos (R$)</th>
                    <th className="py-2 px-3 text-right">Custo Líquido (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {listaAgrupada.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-gray-400">
                        Nenhum lançamento no período para o setor {setor}.
                      </td>
                    </tr>
                  ) : (
                    listaAgrupada.map((eq) => {
                      const liq = eq.totalDespesas - eq.totalAbatimentos
                      return (
                        <tr key={eq.codigo}>
                          <td className="py-2 px-3 font-mono font-bold text-teal-950">
                            {eq.codigo}
                          </td>
                          <td className="py-2 px-3 text-gray-800">{eq.modelo || '—'}</td>
                          <td className="py-2 px-3 font-mono text-gray-600 uppercase">
                            {eq.placa || '—'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-gray-600">
                            {eq.qtd}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-red-700 font-semibold">
                            {formatCurrency(eq.totalDespesas)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {formatCurrency(eq.totalAbatimentos)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                            {formatCurrency(liq)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-100 print:bg-gray-200 border-t-2 border-gray-400 font-bold">
                  <tr>
                    <td colSpan={4} className="py-2 px-3 text-gray-900">
                      TOTAL DO SETOR ({setor.toUpperCase()})
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-red-800">
                      {formatCurrency(totalDespesas)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800">
                      {formatCurrency(totalAbatimentos)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-teal-950 text-sm">
                      {formatCurrency(saldoLiquido)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* DETALHAMENTO ITEM POR ITEM DE TODAS AS DESPESAS DOS EQUIPAMENTOS */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5 mb-2">
                <Wrench className="w-3.5 h-3.5" />
                Discriminação Completa de Despesas e Abatimentos (Item a Item)
              </h2>

              <table className="w-full text-left border-collapse text-[11px] border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-1.5 px-2">Data</th>
                    <th className="py-1.5 px-2">Equipamento</th>
                    <th className="py-1.5 px-2">Placa</th>
                    <th className="py-1.5 px-2">Tipo</th>
                    <th className="py-1.5 px-2">Descrição do Serviço / Peça</th>
                    <th className="py-1.5 px-2">Fornecedor</th>
                    <th className="py-1.5 px-2 text-center">Nat.</th>
                    <th className="py-1.5 px-2 text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-400">
                        Nenhuma despesa detalhada neste setor.
                      </td>
                    </tr>
                  ) : (
                    itens.map((it) => {
                      const isAbatimento = it.natureza === 'Abatimento'
                      return (
                        <tr key={it.id}>
                          <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                            {formatDate(it.data)}
                          </td>
                          <td className="py-1.5 px-2 font-mono font-bold text-gray-900 whitespace-nowrap">
                            {it.veiculo_codigo}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-gray-600 uppercase">
                            {it.placa || '—'}
                          </td>
                          <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap">{it.tipo}</td>
                          <td className="py-1.5 px-2 text-gray-900 font-medium">{it.descricao}</td>
                          <td className="py-1.5 px-2 text-gray-600">{it.fornecedor || '—'}</td>
                          <td className="py-1.5 px-2 text-center font-bold">
                            <span className={isAbatimento ? 'text-emerald-700' : 'text-red-700'}>
                              {isAbatimento ? 'ABAT' : 'DESP'}
                            </span>
                          </td>
                          <td
                            className={`py-1.5 px-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                              isAbatimento ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isAbatimento ? '- ' : '+ '}
                            {formatCurrency(it.valor)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-100 print:bg-gray-200 border-t-2 border-gray-400 font-bold">
                  <tr>
                    <td colSpan={7} className="py-2 px-2 text-right text-gray-900">
                      TOTAL LÍQUIDO CONSOLIDADO ({itens.length} lançamentos):
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-teal-950 text-sm">
                      {formatCurrency(saldoLiquido)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* DATA E ASSINATURAS */}
            <div className="text-right text-xs text-gray-700 mb-6 font-medium">
              Sertânia / São José do Egito — PE, {dataExtenso}.
            </div>

            <div className="grid grid-cols-2 gap-12 pt-2">
              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900 uppercase">
                  Gestão de Frotas & Equipamentos
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Responsável Operacional / Manutenção
                </div>
              </div>

              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900 uppercase">
                  Diretoria / Controladoria Financeira
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {empresaNome}
                </div>
              </div>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="mt-8 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
              {empresaNome} • {empresaRazao} • CNPJ: {empresaCnpj} • Relatório Oficial de Frotas.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
