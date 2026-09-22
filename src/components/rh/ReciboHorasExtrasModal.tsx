import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, Download, X, Calendar, User, Building, FileCheck } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { FolhaHorasExtras, Empresa, Funcionario } from '@/types/erp'

interface ReciboHorasExtrasProps {
  item: FolhaHorasExtras | null
  empresa: Empresa | null
  funcionario?: Funcionario | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ReciboHorasExtrasModal: React.FC<ReciboHorasExtrasProps> = ({
  item,
  empresa,
  funcionario: propFuncionario,
  open,
  onOpenChange,
}) => {
  if (!item) return null

  const funcionario = propFuncionario || (item.expand?.funcionario_id as Funcionario | undefined)

  const handlePrint = () => {
    window.print()
  }

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // CNPJ conforme regra do projeto / prompt: CNPJ 05.581.899/0001-05
  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'Grupo Pedreira Cordeiro'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[96vw] lg:max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4]"
        aria-describedby="recibo-description"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              Comprovante de Horas Extras para Assinatura
            </DialogTitle>
            <DialogDescription id="recibo-description" className="text-xs text-gray-500 mt-0.5">
              Formato otimizado para folha <strong>A4 Paisagem</strong>. Pronto para impressão ou
              salvar em PDF.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Recibo (A4 Paisagem)
            </Button>
          </div>
        </DialogHeader>

        {/* ÁREA DE IMPRESSÃO / FOLHA A4 PAISAGEM */}
        <div className="print-only-container mt-2">
          <div className="recibo-a4-landscape bg-white p-6 sm:p-8 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-relaxed">
            {/* CABEÇALHO */}
            <div className="border-b-2 border-teal-800 pb-3 mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl print:text-teal-900 print:bg-transparent print:border print:border-teal-900">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-teal-950 uppercase">
                    {empresaNome}
                  </h1>
                  <div className="text-xs text-gray-600 font-medium">
                    {empresaRazao} • CNPJ: <span className="font-mono">{empresaCnpj}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Mineração, Britagem, Fabricação de Concreto Usinado e Pavimentação
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-teal-50 border border-teal-200 text-teal-900 font-bold text-xs uppercase tracking-wider rounded">
                  Comprovante de Horas Extras
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Mês de Referência:{' '}
                  <strong className="text-gray-900 font-semibold">{item.mes_referencia}</strong>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Controle ID: #{item.id.slice(-8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* DADOS DO FUNCIONÁRIO */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 print:bg-gray-100 p-3 rounded-lg border border-gray-200 text-xs mb-4">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                  Colaborador
                </span>
                <span className="font-bold text-gray-900 text-sm">
                  {funcionario?.nome || 'Não informado'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                  Cargo / Função
                </span>
                <span className="font-medium text-gray-800">
                  {funcionario?.cargo || 'Colaborador Operacional'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                  Setor / Lotação
                </span>
                <span className="font-medium text-gray-800">
                  {funcionario?.setor || 'Britagem / Operacional'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-semibold">
                  CPF / Doc
                </span>
                <span className="font-mono text-gray-800">
                  {funcionario?.cpf || 'Não cadastrado'}
                </span>
              </div>
            </div>

            {/* MEMÓRIA DE CÁLCULO DAS HORAS EXTRAS */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  Demonstrativo e Memória de Cálculo
                </h3>
                <span className="text-[11px] text-gray-500">
                  Critério:{' '}
                  <strong>
                    {item.modo_calculo === 'padrao_50'
                      ? '50% para todas as horas'
                      : 'CLT Vigente (50% dias úteis / 100% domingos e feriados)'}
                  </strong>{' '}
                  • Jornada base mensal: 220h
                </span>
              </div>

              <table className="w-full text-left border-collapse text-xs border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-2 px-3">Item / Rubrica</th>
                    <th className="py-2 px-3 text-center">Base / Fator</th>
                    <th className="py-2 px-3 text-right">Valor Hora Base</th>
                    <th className="py-2 px-3 text-right">Valor Hora c/ Adicional</th>
                    <th className="py-2 px-3 text-right">Qtd. Horas</th>
                    <th className="py-2 px-3 text-right">Total Bruto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 px-3 font-medium">Salário Base Mensal do Colaborador</td>
                    <td className="py-2 px-3 text-center text-gray-500">220h / mês</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-600">—</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-600">—</td>
                    <td className="py-2 px-3 text-right text-gray-500">220h</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-gray-800">
                      {formatCurrency(item.salario_base)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-medium">
                      Hora Extra 50%{' '}
                      <span className="text-[11px] text-gray-500">
                        {item.modo_calculo === 'padrao_50'
                          ? '(Todas as Horas Praticadas)'
                          : '(Dias Úteis / Seg a Sáb)'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[10px]">
                        +50% (x1,50)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatCurrency(item.valor_hora_normal)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-teal-800">
                      {formatCurrency(item.valor_hora_normal * 1.5)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      {item.horas_50?.toFixed(1) || '0.0'}h
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      {formatCurrency(item.valor_horas_50 || 0)}
                    </td>
                  </tr>

                  {item.modo_calculo === 'clt_vigente' && (
                    <tr>
                      <td className="py-2 px-3 font-medium">
                        Hora Extra 100%{' '}
                        <span className="text-[11px] text-gray-500">
                          (Domingos e Feriados - CLT Art. 59/Lei 605)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200 text-[10px]">
                          +100% (x2,00)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(item.valor_hora_normal)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-teal-800">
                        {formatCurrency(item.valor_hora_normal * 2.0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {item.horas_100?.toFixed(1) || '0.0'}h
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(item.valor_horas_100 || 0)}
                      </td>
                    </tr>
                  )}

                  {/* LINHA DE TOTAL BRUTO DE HORAS EXTRAS */}
                  <tr className="bg-gray-100/70 print:bg-gray-200 font-bold border-t border-gray-300 text-gray-900">
                    <td colSpan={4} className="py-2 px-3 uppercase text-right">
                      Total Bruto das Horas Extras:
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-gray-900">
                      {item.total_horas?.toFixed(1)}h
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-gray-900 tabular-nums">
                      {formatCurrency(item.total_valor)}
                    </td>
                  </tr>

                  {/* GRATIFICAÇÃO (SE HOUVER OU SEMPRE MOSTRAR QUANDO REGISTRADA) */}
                  {((item.gratificacao !== undefined && item.gratificacao > 0) ||
                    (item.adiantamento !== undefined && item.adiantamento > 0)) && (
                    <>
                      <tr>
                        <td colSpan={5} className="py-1.5 px-3 font-medium text-emerald-800">
                          (+) Gratificação / Bônus Extraordinário
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-800 tabular-nums">
                          {item.gratificacao && item.gratificacao > 0
                            ? `+ ${formatCurrency(item.gratificacao)}`
                            : '+ R$ 0,00'}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="py-1.5 px-3 font-medium text-red-700">
                          (−) Adiantamento / Vales Anteriores (Desconto)
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-red-700 tabular-nums">
                          {item.adiantamento && item.adiantamento > 0
                            ? `- ${formatCurrency(item.adiantamento)}`
                            : '- R$ 0,00'}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* LINHA DE VALOR LÍQUIDO A RECEBER */}
                  <tr className="bg-teal-50/80 print:bg-teal-100/60 font-bold border-t-2 border-teal-800 text-teal-950">
                    <td colSpan={4} className="py-2.5 px-3 uppercase text-right text-xs">
                      Valor Líquido a Receber / Pagar:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-teal-900">
                      {item.total_horas?.toFixed(1)}h
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-base font-extrabold text-teal-950 tabular-nums">
                      {formatCurrency(
                        typeof item.valor_liquido === 'number'
                          ? item.valor_liquido
                          : item.total_valor + (item.gratificacao || 0) - (item.adiantamento || 0),
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* OBSERVAÇÕES E DECLARAÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-gray-600 mb-6 border border-gray-200 rounded-lg p-3 bg-white">
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">
                  Observações Operacionais:
                </span>
                <p className="italic text-gray-600">
                  {item.observacoes || 'Nenhuma observação complementar registrada.'}
                </p>
                {funcionario?.chave_pix && (
                  <div className="mt-1.5 text-[10px] text-teal-800 font-mono">
                    PIX para pagamento: <strong>{funcionario.chave_pix}</strong>
                  </div>
                )}
              </div>
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">
                  Declaração do Colaborador:
                </span>
                <p className="text-justify text-gray-500 leading-tight">
                  Reconheço como exatas as horas extraordinárias prestadas no período de referência
                  acima assinalado, bem como a apuração dos respectivos adicionais legais,
                  conferidos e aprovados para fins de pagamento.
                </p>
              </div>
            </div>

            {/* DATA E LOCALIDADE */}
            <div className="text-right text-xs text-gray-700 mb-8 font-medium">
              São José do Egito / PB, {dataExtenso}.
            </div>

            {/* CAMPOS DE ASSINATURA */}
            <div className="grid grid-cols-2 gap-12 pt-2">
              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                  {funcionario?.nome || 'ASSINATURA DO FUNCIONÁRIO'}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Assinatura do Funcionário (Colaborador)
                </div>
                {funcionario?.cpf && (
                  <div className="text-[10px] text-gray-400 font-mono">CPF: {funcionario.cpf}</div>
                )}
              </div>

              <div className="text-center">
                <div className="border-t border-gray-900 pt-1.5 font-bold text-xs text-gray-900">
                  {empresaNome}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Responsável / Recursos Humanos & Departamento Pessoal
                </div>
                <div className="text-[10px] text-gray-400 font-mono">CNPJ: {empresaCnpj}</div>
              </div>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="mt-6 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
              Documento emitido eletronicamente pelo Sistema de Gestão ERP Pedreira Cordeiro • Via
              única para arquivo físico e quitação de proventos trabalhistas.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
