import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Building, Route, Package, Scissors, Hash } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Entrega, Empresa, Venda } from '@/types/erp'
import { extrairEquivalenciaOriginal } from '@/lib/unidades'

interface RomaneioEntregaImpressaoModalProps {
  entrega?: Entrega | null
  venda?: Venda | null
  empresa: Empresa | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ViaRomaneioProps {
  tipoVia: 'CLIENTE' | 'EMPRESA'
  subtituloVia: string
  sequencial: string
  empresaNome: string
  empresaRazao: string
  empresaCnpj: string
  dataCarga: string
  dataExtenso: string
  vendaId?: string
  origem: string
  destino: string
  clienteNome: string
  veiculoDescricao: string
  veiculoPlaca?: string
  motorista: string
  kmRodado?: number
  kmRota?: number
  kmInicial?: number
  kmFinal?: number
  consumoKmL?: number
  produtoNome: string
  produtoCodigo?: string
  unidadeMedida: string
  quantidade?: number
  equivalenciaOriginal?: string | null
  precoUnitario?: number
  valorTotal: number
  valorDesconto?: number
  descontoPercentual?: number
  custoViagem?: number
  margem?: number
  statusEntrega?: string
  formaPagamento?: string
  observacoes?: string
}

const ViaRomaneio: React.FC<ViaRomaneioProps> = ({
  tipoVia,
  subtituloVia,
  sequencial,
  empresaNome,
  empresaRazao,
  empresaCnpj,
  dataCarga,
  dataExtenso,
  vendaId,
  origem,
  destino,
  clienteNome,
  veiculoDescricao,
  veiculoPlaca,
  motorista,
  kmRodado,
  kmRota,
  kmInicial,
  kmFinal,
  consumoKmL,
  produtoNome,
  produtoCodigo,
  unidadeMedida,
  quantidade,
  equivalenciaOriginal,
  precoUnitario,
  valorTotal,
  valorDesconto,
  descontoPercentual,
  custoViagem,
  margem,
  statusEntrega,
  formaPagamento,
  observacoes,
}) => {
  const isCliente = tipoVia === 'CLIENTE'

  return (
    <div className="via-romaneio bg-white p-3 sm:p-3.5 print:p-2.5 rounded-lg border border-gray-300 print:border-gray-800 text-gray-900 font-sans text-[10.5px] print:text-[10px] leading-tight flex flex-col justify-between box-border overflow-hidden">
      {/* CABEÇALHO DA VIA */}
      <div>
        <div className="border-b border-teal-800 pb-1.5 mb-1.5 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 print:w-6 print:h-6 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0 print:text-teal-900 print:bg-transparent print:border print:border-teal-900">
              <Building className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-teal-950 uppercase leading-none">
                  {empresaNome}
                </h1>
                <span
                  className={`inline-block px-1.5 py-0.5 font-bold text-[8.5px] print:text-[8px] uppercase tracking-wider rounded border ${
                    isCliente
                      ? 'bg-blue-50 text-blue-900 border-blue-300 print:bg-gray-100 print:border-gray-700'
                      : 'bg-amber-50 text-amber-900 border-amber-300 print:bg-gray-100 print:border-gray-700'
                  }`}
                >
                  {isCliente ? '1ª VIA — CLIENTE' : '2ª VIA — EMPRESA (TRANSPORTADORA)'}
                </span>
              </div>
              <div className="text-[9.5px] print:text-[9px] text-gray-700 font-medium">
                {empresaRazao} • CNPJ:{' '}
                <span className="font-mono font-semibold">{empresaCnpj}</span>
              </div>
              <div className="text-[8.5px] print:text-[8px] text-gray-500">
                Mineração, Britagem, Fabricação de Concreto Usinado, Cargas e Pavimentação
              </div>
            </div>
          </div>

          {/* DESTAQUE DO SEQUENCIAL NUMERAL (SEM POSSIBILIDADE DE ALTERAÇÃO) */}
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-900 text-white font-mono font-black text-xs tracking-wider rounded shadow-xs print:bg-transparent print:text-gray-950 print:border-2 print:border-gray-900">
              <Hash className="w-3 h-3 text-teal-300 print:text-black" />
              <span>{sequencial}</span>
            </div>
            <div className="text-[8.5px] print:text-[8px] text-gray-600 mt-0.5">
              Data: <strong className="text-gray-900">{dataCarga}</strong>
              {vendaId && (
                <span className="ml-1.5 font-mono text-teal-900 font-bold">
                  • Venda #{vendaId.slice(0, 8).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-[7.5px] print:text-[7.5px] text-gray-400 uppercase tracking-wider font-semibold">
              {subtituloVia}
            </div>
          </div>
        </div>

        {/* DADOS DA ROTA E TRANSPORTE */}
        <div className="mb-1.5">
          <div className="grid grid-cols-4 gap-1.5 bg-gray-50 print:bg-gray-100 p-1.5 rounded border border-gray-200 text-[9.5px] print:text-[9px]">
            <div>
              <span className="text-gray-500 block text-[7.5px] uppercase font-bold">
                Origem da Carga
              </span>
              <span className="font-semibold text-gray-900 truncate block">{origem}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[7.5px] uppercase font-bold">
                Destino / Cliente Recebedor
              </span>
              <span className="font-bold text-teal-950 truncate block">{clienteNome}</span>
              {destino && destino !== clienteNome && (
                <span className="text-[7.5px] text-gray-500 truncate block">Local: {destino}</span>
              )}
            </div>
            <div>
              <span className="text-gray-500 block text-[7.5px] uppercase font-bold">
                Veículo / Placa
              </span>
              <span className="font-mono font-semibold text-gray-900 truncate block">
                {veiculoDescricao}
              </span>
              {veiculoPlaca && (
                <span className="text-[7.5px] text-gray-500 block font-mono">
                  Placa: {veiculoPlaca}
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-500 block text-[7.5px] uppercase font-bold">
                Motorista / Condutor
              </span>
              <span className="font-bold text-gray-900 truncate block">{motorista}</span>
              {statusEntrega && (
                <span className="text-[7.5px] text-teal-800 uppercase font-semibold block">
                  Status: {statusEntrega}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TABELA DE PRODUTOS E VALORES */}
        <div className="mb-1.5">
          <table className="w-full text-left border-collapse text-[9.5px] print:text-[9px] border border-gray-300">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300 text-[8.5px] print:text-[8px]">
                <th className="py-0.5 px-2">Produto da Pedreira</th>
                <th className="py-0.5 px-2 text-center">Unidade</th>
                <th className="py-0.5 px-2 text-right">Qtd</th>
                <th className="py-0.5 px-2 text-right">Preço Unit.</th>
                <th className="py-0.5 px-2 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-0.5 px-2">
                  <span className="font-bold text-gray-900 block text-[10px] leading-tight">
                    {produtoNome}
                  </span>
                  {produtoCodigo && (
                    <span className="text-[7.5px] text-gray-400 font-mono">
                      Cód: {produtoCodigo}
                    </span>
                  )}
                </td>
                <td className="py-0.5 px-2 text-center font-mono text-gray-700 font-medium">
                  {unidadeMedida}
                </td>
                <td className="py-0.5 px-2 text-right font-mono font-bold text-gray-900 text-[10.5px]">
                  <div>
                    {quantidade !== undefined && quantidade !== null
                      ? Number(quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                      : '—'}
                  </div>
                  {equivalenciaOriginal && (
                    <div className="text-[8.5px] font-sans font-medium text-teal-800 print:text-black">
                      ≡ {equivalenciaOriginal}
                    </div>
                  )}
                </td>
                <td className="py-0.5 px-2 text-right font-mono text-gray-800">
                  {precoUnitario && precoUnitario > 0 ? formatCurrency(precoUnitario) : '—'}
                </td>
                <td className="py-0.5 px-2 text-right font-mono font-bold text-emerald-800 text-[11px] tabular-nums">
                  {valorTotal > 0 ? formatCurrency(valorTotal) : 'A faturar'}
                </td>
              </tr>

              {/* DESCONTO CONCEDIDO SE HOUVER */}
              {valorDesconto && valorDesconto > 0 ? (
                <tr className="bg-amber-50/50 print:bg-amber-50/30 text-[8.5px]">
                  <td colSpan={4} className="py-0.5 px-2 text-right font-semibold text-amber-900">
                    Desconto Concedido {descontoPercentual ? `(${descontoPercentual}%)` : ''}:
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold text-amber-900 tabular-nums">
                    − {formatCurrency(valorDesconto)}
                  </td>
                </tr>
              ) : null}

              {/* FORMA DE PAGAMENTO E CUSTO VIAGEM */}
              <tr className="bg-gray-50 print:bg-gray-100 text-[8.5px]">
                <td colSpan={3} className="py-0.5 px-2 text-gray-600">
                  {formaPagamento && (
                    <span>
                      Forma de Pgto: <strong className="text-gray-800">{formaPagamento}</strong>
                    </span>
                  )}
                  {kmRodado && kmRodado > 0 ? (
                    <span className="ml-2 font-mono">
                      • Km Viagem: <strong>{kmRodado} km</strong>
                    </span>
                  ) : kmRota && kmRota > 0 ? (
                    <span className="ml-2 font-mono">
                      • Km Rota: <strong>{kmRota} km</strong>
                    </span>
                  ) : null}
                </td>
                <td className="py-0.5 px-2 text-right font-semibold text-gray-700">
                  Total Líquido:
                </td>
                <td className="py-0.5 px-2 text-right font-mono font-black text-teal-950 text-[11px] tabular-nums">
                  {valorTotal > 0 ? formatCurrency(valorTotal) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* OBSERVAÇÕES E DECLARAÇÃO */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px] print:text-[8px] text-gray-600 mb-1.5 border border-gray-200 rounded p-1.5 bg-white">
          <div>
            <span className="font-bold text-gray-700 block mb-0.5">Observações Operacionais:</span>
            <p className="italic text-gray-600 truncate">
              {observacoes || 'Carga conferida na expedição da pedreira.'}
            </p>
          </div>
          <div>
            <span className="font-bold text-gray-700 block mb-0.5">Termo de Recebimento:</span>
            <p className="text-gray-500 leading-tight">
              Declaramos haver recebido os materiais acima discriminados, em perfeitas condições e
              na quantidade conferida no ato do descarregamento.
            </p>
          </div>
        </div>
      </div>

      {/* RODAPÉ E ASSINATURAS */}
      <div>
        <div className="grid grid-cols-2 gap-6 pt-1">
          <div className="text-center">
            <div className="border-t border-gray-900 pt-1 font-bold text-[9.5px] print:text-[9px] text-gray-900 leading-none">
              {motorista}
            </div>
            <div className="text-[7.5px] print:text-[7px] text-gray-500 uppercase tracking-wider">
              Transportador / Motorista
            </div>
          </div>

          <div className="text-center">
            <div className="border-t border-gray-900 pt-1 font-bold text-[9.5px] print:text-[9px] text-gray-900 leading-none">
              {isCliente ? 'ASSINATURA DO CLIENTE / RECEBEDOR' : 'CANHOTO ASSINADO / FISCALIZAÇÃO'}
            </div>
            <div className="text-[7.5px] print:text-[7px] text-gray-500 uppercase tracking-wider">
              {isCliente
                ? 'Nome Legível / RG / CPF / Carimbo da Obra'
                : 'Devolver via assinada para arquivo fiscal da Pedreira'}
            </div>
          </div>
        </div>

        <div className="mt-1 pt-1 border-t border-gray-200 text-center text-[7.5px] print:text-[7px] text-gray-400 flex items-center justify-between">
          <span>
            {empresaNome} • CNPJ: {empresaCnpj}
          </span>
          <span className="font-mono font-bold text-gray-600">SEQUENCIAL: {sequencial}</span>
          <span>São José do Egito / Sertânia, {dataExtenso}.</span>
        </div>
      </div>
    </div>
  )
}

export const RomaneioEntregaImpressaoModal: React.FC<RomaneioEntregaImpressaoModalProps> = ({
  entrega,
  venda,
  empresa,
  open,
  onOpenChange,
}) => {
  if (!entrega && !venda) return null

  const handlePrint = () => {
    window.print()
  }

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Dados da Empresa
  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  // Consolidação dos dados (seja aberto por Entrega ou diretamente por Venda)
  const vendaVinculada = entrega?.expand?.venda_id || venda || null
  const veiculo = entrega?.expand?.veiculo_id

  const dataCarga = formatDate(entrega?.data || venda?.data_venda || hoje.toISOString())
  const vendaId = entrega?.venda_id || venda?.id || undefined

  const clienteNome =
    entrega?.cliente_nome ||
    entrega?.expand?.cliente_id?.nome ||
    vendaVinculada?.expand?.cliente_id?.nome ||
    'Cliente não informado'

  const destino = entrega?.destino || clienteNome || 'Sertânia / Região'
  const origem = entrega?.origem || 'Pedreira Cordeiro - Sertânia/PE'

  // Veículo e identificação: prioriza dados da entrega vinculada, depois da venda vinculada
  const veiculoVenda = vendaVinculada?.expand?.veiculo_id
  const veiculoEfetivo = veiculo || veiculoVenda

  const veiculoDescricao = veiculoEfetivo?.codigo_interno
    ? `${veiculoEfetivo.codigo_interno}${veiculoEfetivo.modelo ? ` • ${veiculoEfetivo.modelo}` : ''}`
    : vendaVinculada?.veiculo_identificacao
      ? vendaVinculada.veiculo_identificacao
      : vendaVinculada?.transportador_terceiro
        ? `Terceiro: ${vendaVinculada.transportador_terceiro}`
        : venda?.tipo_entrega === 'terceiro'
          ? 'Retirada / Frete Terceiro'
          : 'Frota Pedreira Cordeiro'

  const veiculoPlaca = veiculoEfetivo?.placa || vendaVinculada?.placa || undefined

  const motorista =
    entrega?.motorista ||
    entrega?.expand?.funcionario_id?.nome ||
    vendaVinculada?.motorista ||
    (venda?.tipo_entrega === 'terceiro'
      ? vendaVinculada?.transportador_terceiro
        ? `Terceiro (${vendaVinculada.transportador_terceiro})`
        : 'Transportador Terceiro'
      : 'Motorista da Frota')

  const produtoNome =
    entrega?.produto_nome ||
    entrega?.expand?.produto_id?.nome ||
    vendaVinculada?.produto_nome ||
    'Brita / Agregados da Pedreira'

  const produtoCodigo =
    entrega?.expand?.produto_id?.codigo || vendaVinculada?.expand?.produto_id?.codigo || undefined

  const unidadeMedida = entrega?.unidade_medida || vendaVinculada?.unidade || 'm³'

  const quantidade =
    entrega?.quantidade !== undefined && entrega?.quantidade !== null
      ? Number(entrega.quantidade)
      : vendaVinculada?.quantidade !== undefined
        ? Number(vendaVinculada.quantidade)
        : undefined

  const precoUnitario =
    entrega?.preco_unitario_venda && entrega.preco_unitario_venda > 0
      ? Number(entrega.preco_unitario_venda)
      : vendaVinculada?.preco_unitario
        ? Number(vendaVinculada.preco_unitario)
        : entrega?.expand?.produto_id?.preco_venda
          ? Number(entrega.expand.produto_id.preco_venda)
          : undefined

  const valorTotal = Number(entrega?.valor_venda) || Number(vendaVinculada?.valor_total) || 0

  const valorDesconto =
    vendaVinculada?.valor_desconto && vendaVinculada.valor_desconto > 0
      ? Number(vendaVinculada.valor_desconto)
      : undefined

  const descontoPercentual =
    vendaVinculada?.desconto_percentual && vendaVinculada.desconto_percentual > 0
      ? Number(vendaVinculada.desconto_percentual)
      : undefined

  const custoViagem = Number(entrega?.custo_estimado) || 0
  const margem = valorTotal > 0 ? valorTotal - custoViagem : undefined

  const statusEntrega =
    entrega?.status === 'concluida'
      ? 'Concluída'
      : entrega?.status === 'em_transito'
        ? 'Em Trânsito'
        : entrega?.status === 'pendente'
          ? 'Pendente'
          : venda?.status || undefined

  const formaPagamento = vendaVinculada?.forma_pagamento || undefined
  const observacoes = entrega?.observacoes || vendaVinculada?.observacoes || undefined
  const equivalenciaOriginal =
    extrairEquivalenciaOriginal(entrega?.observacoes) ||
    extrairEquivalenciaOriginal(vendaVinculada?.observacoes)

  // Sequencial numeral do romaneio (sem possibilidade de alteração, exibido em destaque)
  const sequencial =
    entrega?.sequencial_romaneio ||
    vendaVinculada?.sequencial_romaneio ||
    `RMD-${hoje.getFullYear()}-${String(entrega?.numero_sequencial || vendaVinculada?.numero_sequencial || 1).padStart(5, '0')}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-documento-impressao="romaneio"
        className="max-w-[96vw] lg:max-w-4xl max-h-[95vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4] print:static print:transform-none print:max-w-full print:p-0 print:border-none print:shadow-none print:bg-white print:overflow-visible"
        aria-describedby="romaneio-description"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              <span>Romaneio Oficial (Folha A4 — 2 Vias: Cliente & Empresa)</span>
            </DialogTitle>
            <DialogDescription id="romaneio-description" className="text-xs text-gray-500 mt-0.5">
              Sequencial Numeral imutável:{' '}
              <strong className="font-mono text-teal-900 font-bold">{sequencial}</strong>. Dividido
              em 2 vias na mesma folha A4 com divisória de corte.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4 font-semibold"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Romaneio (A4)
            </Button>
          </div>
        </DialogHeader>

        {/* CONTAINER DA FOLHA A4 ÚNICA */}
        <div className="print-only-container documento-impressao-a4 mt-2 print:mt-0 print:p-0">
          <div className="folha-a4-romaneio bg-white print:bg-white flex flex-col justify-between w-full box-border">
            {/* 1ª VIA: CLIENTE */}
            <ViaRomaneio
              tipoVia="CLIENTE"
              subtituloVia="Via do Destinatário / Comprovante do Cliente"
              sequencial={sequencial}
              empresaNome={empresaNome}
              empresaRazao={empresaRazao}
              empresaCnpj={empresaCnpj}
              dataCarga={dataCarga}
              dataExtenso={dataExtenso}
              vendaId={vendaId}
              origem={origem}
              destino={destino}
              clienteNome={clienteNome}
              veiculoDescricao={veiculoDescricao}
              veiculoPlaca={veiculoPlaca}
              motorista={motorista}
              kmRodado={entrega?.km_rodado}
              kmRota={entrega?.km_rota}
              kmInicial={entrega?.km_inicial}
              kmFinal={entrega?.km_final}
              consumoKmL={entrega?.consumo_estimado_km_l}
              produtoNome={produtoNome}
              produtoCodigo={produtoCodigo}
              unidadeMedida={unidadeMedida}
              quantidade={quantidade}
              equivalenciaOriginal={equivalenciaOriginal}
              precoUnitario={precoUnitario}
              valorTotal={valorTotal}
              valorDesconto={valorDesconto}
              descontoPercentual={descontoPercentual}
              custoViagem={custoViagem}
              margem={margem}
              statusEntrega={statusEntrega}
              formaPagamento={formaPagamento}
              observacoes={observacoes}
            />

            {/* LINHA DE CORTE TRACEJADA COM ÍCONE DE TESOURA */}
            <div className="linha-corte relative my-1.5 py-0.5 print:my-1 text-center select-none flex items-center justify-center">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t-2 border-dashed border-gray-400 print:border-gray-600" />
              </div>
              <div className="relative inline-flex items-center gap-1.5 bg-white px-2.5 py-0.5 text-[9px] print:text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest border border-gray-300 rounded-full print:border-gray-500 print:text-gray-700">
                <Scissors className="w-3 h-3" />
                <span>Linha de Corte — Destaque aqui</span>
                <Scissors className="w-3 h-3 rotate-180" />
              </div>
            </div>

            {/* 2ª VIA: EMPRESA (TRANSPORTADORA) */}
            <ViaRomaneio
              tipoVia="EMPRESA"
              subtituloVia="Via da Empresa / Arquivo Fiscal e Transportadora"
              sequencial={sequencial}
              empresaNome={empresaNome}
              empresaRazao={empresaRazao}
              empresaCnpj={empresaCnpj}
              dataCarga={dataCarga}
              dataExtenso={dataExtenso}
              vendaId={vendaId}
              origem={origem}
              destino={destino}
              clienteNome={clienteNome}
              veiculoDescricao={veiculoDescricao}
              veiculoPlaca={veiculoPlaca}
              motorista={motorista}
              kmRodado={entrega?.km_rodado}
              kmRota={entrega?.km_rota}
              kmInicial={entrega?.km_inicial}
              kmFinal={entrega?.km_final}
              consumoKmL={entrega?.consumo_estimado_km_l}
              produtoNome={produtoNome}
              produtoCodigo={produtoCodigo}
              unidadeMedida={unidadeMedida}
              quantidade={quantidade}
              equivalenciaOriginal={equivalenciaOriginal}
              precoUnitario={precoUnitario}
              valorTotal={valorTotal}
              valorDesconto={valorDesconto}
              descontoPercentual={descontoPercentual}
              custoViagem={custoViagem}
              margem={margem}
              statusEntrega={statusEntrega}
              formaPagamento={formaPagamento}
              observacoes={observacoes}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
