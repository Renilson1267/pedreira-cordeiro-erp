import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Building, FileCheck, Truck, Route, Calendar, User, Package } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Entrega, Empresa } from '@/types/erp'

interface RomaneioEntregaImpressaoModalProps {
  entrega: Entrega | null
  empresa: Empresa | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const RomaneioEntregaImpressaoModal: React.FC<RomaneioEntregaImpressaoModalProps> = ({
  entrega,
  empresa,
  open,
  onOpenChange,
}) => {
  if (!entrega) return null

  const handlePrint = () => {
    window.print()
  }

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Dados da Matriz / Empresa Pedreira Cordeiro
  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  const veiculo = entrega.expand?.veiculo_id
  const motorista =
    entrega.motorista || entrega.expand?.funcionario_id?.nome || 'Motorista não informado'
  const venda = entrega.expand?.venda_id
  const clienteNome =
    entrega.cliente_nome ||
    entrega.expand?.cliente_id?.nome ||
    venda?.expand?.cliente_id?.nome ||
    entrega.destino

  const valorVenda = Number(entrega.valor_venda) || Number(venda?.valor_total) || 0
  const custoViagem = Number(entrega.custo_estimado) || 0
  const margem = valorVenda - custoViagem

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] lg:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4]"
        aria-describedby="romaneio-description"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              Romaneio / Comprovante Oficial de Entrega
            </DialogTitle>
            <DialogDescription id="romaneio-description" className="text-xs text-gray-500 mt-0.5">
              Documento formatado para folha <strong>A4</strong>. Pronto para impressão física ou
              salvar em PDF.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Romaneio (A4)
            </Button>
          </div>
        </DialogHeader>

        {/* CONTAINER DE IMPRESSÃO */}
        <div className="print-only-container mt-2">
          <div className="romaneio-a4 bg-white p-6 sm:p-8 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-relaxed">
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
                    Mineração, Britagem, Fabricação de Concreto Usinado, Cargas e Pavimentação
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-teal-50 border border-teal-300 text-teal-900 font-bold text-xs uppercase tracking-wider rounded">
                  Romaneio de Entrega
                </div>
                {entrega.venda_id && (
                  <div className="mt-1 inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-[11px] rounded font-mono">
                    Venda Vinculada #{entrega.venda_id.slice(0, 8).toUpperCase()}
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1">
                  Data da Carga: <strong>{formatDate(entrega.data)}</strong>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Controle ID: #{entrega.id.slice(-8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* DADOS DA ROTA E TRANSPORTE */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5 mb-2">
                <Route className="w-3.5 h-3.5" />
                Dados da Rota e Transporte
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 print:bg-gray-100 p-3 rounded-lg border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                    Origem da Carga
                  </span>
                  <span className="font-bold text-gray-900">{entrega.origem}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                    Destino / Cliente
                  </span>
                  <span className="font-bold text-teal-950">{clienteNome}</span>
                  {entrega.destino && entrega.destino !== clienteNome && (
                    <span className="text-[10px] text-gray-500 block">
                      Local: {entrega.destino}
                    </span>
                  )}
                  {venda && (
                    <span className="text-[10px] text-teal-700 block font-semibold mt-0.5">
                      Venda #{venda.id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                    Veículo / Placa
                  </span>
                  <span className="font-mono font-semibold text-gray-900">
                    {veiculo?.codigo_interno || '—'} {veiculo?.modelo ? `• ${veiculo.modelo}` : ''}
                  </span>
                  {veiculo?.placa && (
                    <span className="text-[10px] text-gray-500 block font-mono">
                      Placa: {veiculo.placa}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                    Motorista / Condutor
                  </span>
                  <span className="font-bold text-gray-900">{motorista}</span>
                </div>
              </div>
            </div>

            {/* QUILOMETRAGEM E ROTA */}
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                    Km Rodado (Motorista)
                  </span>
                  <span className="text-base font-bold font-mono text-gray-900">
                    {entrega.km_rodado?.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) || 0}{' '}
                    km
                  </span>
                  {entrega.km_inicial !== undefined &&
                    entrega.km_final !== undefined &&
                    entrega.km_final > 0 && (
                      <span className="text-[9px] font-mono text-gray-400 block mt-0.5">
                        Odômetro: {entrega.km_inicial} ➔ {entrega.km_final}
                      </span>
                    )}
                </div>

                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                    Km Rota Automática (OSRM)
                  </span>
                  <span className="text-base font-bold font-mono text-teal-900">
                    {entrega.km_rota ? `${entrega.km_rota} km` : 'Não calculada'}
                  </span>
                  <span className="text-[9px] text-gray-400 block mt-0.5">
                    Distância rodoviária de referência
                  </span>
                </div>

                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                    Consumo Estimado
                  </span>
                  <span className="text-base font-bold font-mono text-gray-900">
                    {entrega.consumo_estimado_km_l || 2.8} km/l
                  </span>
                  <span className="text-[9px] text-gray-400 block mt-0.5">
                    {entrega.litros_estimados
                      ? `${entrega.litros_estimados.toFixed(1)} L estimados`
                      : 'Diesel S10'}
                  </span>
                </div>

                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                    Status Operacional
                  </span>
                  <span className="text-base font-bold text-teal-800 uppercase text-xs inline-block mt-1">
                    {entrega.status === 'concluida'
                      ? '✓ Concluída'
                      : entrega.status === 'em_transito'
                        ? 'Em Trânsito'
                        : 'Cancelada'}
                  </span>
                </div>
              </div>
            </div>

            {/* DISCRIMINAÇÃO DO PRODUTO E VALORES */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5" />
                Discriminação da Carga & Valores Financeiros
              </h2>

              <table className="w-full text-left border-collapse text-xs border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-2 px-3">Produto da Pedreira</th>
                    <th className="py-2 px-3 text-center">Unidade</th>
                    <th className="py-2 px-3 text-right">Quantidade</th>
                    <th className="py-2 px-3 text-right">Preço Unit. Venda</th>
                    <th className="py-2 px-3 text-right">Valor da Venda (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-gray-900 block text-sm">
                        {entrega.produto_nome || venda?.produto_nome || 'Agregados da Pedreira'}
                      </span>
                      {entrega.expand?.produto_id?.codigo && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Código: {entrega.expand.produto_id.codigo}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-gray-700 font-medium">
                      {entrega.unidade_medida || venda?.unidade || 'm³'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 text-sm">
                      {entrega.quantidade !== undefined && entrega.quantidade !== null
                        ? Number(entrega.quantidade).toLocaleString('pt-BR', {
                            maximumFractionDigits: 2,
                          })
                        : venda?.quantidade !== undefined
                          ? Number(venda.quantidade).toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-800">
                      {entrega.preco_unitario_venda && entrega.preco_unitario_venda > 0
                        ? formatCurrency(entrega.preco_unitario_venda)
                        : venda?.preco_unitario
                          ? formatCurrency(venda.preco_unitario)
                          : entrega.expand?.produto_id?.preco_venda
                            ? formatCurrency(entrega.expand.produto_id.preco_venda)
                            : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 text-base tabular-nums">
                      {valorVenda > 0 ? formatCurrency(valorVenda) : 'Não informado'}
                    </td>
                  </tr>

                  {/* SUBTOTAIS E MARGEM */}
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={4} className="py-2 px-3 text-right font-semibold text-gray-700">
                      Custo Estimado da Viagem / Frete (Combustível):
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-red-700 tabular-nums">
                      {formatCurrency(custoViagem)}
                    </td>
                  </tr>

                  {valorVenda > 0 && (
                    <tr className="bg-teal-50/80 print:bg-teal-100/60 font-bold border-t-2 border-teal-800 text-teal-950">
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-xs">
                        Margem da Operação (Venda − Custo Viagem):
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono text-base font-extrabold tabular-nums ${
                          margem >= 0 ? 'text-teal-950' : 'text-red-700'
                        }`}
                      >
                        {formatCurrency(margem)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* OBSERVAÇÕES E CONDIÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-gray-600 mb-6 border border-gray-200 rounded-lg p-3 bg-white">
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">
                  Observações da Entrega:
                </span>
                <p className="italic text-gray-600">
                  {entrega.observacoes || 'Nenhuma observação operacional registrada.'}
                </p>
              </div>
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">Termo de Recebimento:</span>
                <p className="text-justify text-gray-500 leading-tight">
                  Declaramos haver recebido os materiais acima discriminados, em perfeitas condições
                  de qualidade e na quantidade contratada, conferidos no ato do descarregamento na
                  obra/destino.
                </p>
              </div>
            </div>

            {/* DATA E LOCAL */}
            <div className="text-right text-xs text-gray-700 mb-8 font-medium">
              São José do Egito / Sertânia, {dataExtenso}.
            </div>

            {/* CAMPOS DE ASSINATURA */}
            <div className="grid grid-cols-2 gap-12 pt-2">
              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                  {motorista}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Motorista / Transportador
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  Veículo: {veiculo?.codigo_interno || 'Frota Cordeiro'}
                </div>
              </div>

              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                  RESPONSÁVEL PELO RECEBIMENTO
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Assinatura / Carimbo do Cliente ou Encarregado da Obra
                </div>
                <div className="text-[10px] text-gray-400">
                  Nome / RG / CPF Legível: ___________
                </div>
              </div>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="mt-8 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
              {empresaNome} • {empresaRazao} • CNPJ: {empresaCnpj} • Sistema ERP Pedreira Cordeiro.
              Via Oficial de Conferência e Transporte.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
