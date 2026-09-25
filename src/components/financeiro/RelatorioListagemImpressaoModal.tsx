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
import type { Empresa } from '@/types/erp'

export interface ColunaRelatorioImpressao<T> {
  key: string
  header: string
  align?: 'left' | 'center' | 'right'
  className?: string
  headerClassName?: string
  render: (item: T, index: number) => React.ReactNode
}

export interface TotalizadorRelatorioImpressao {
  label: string
  value: React.ReactNode
  colSpan?: number
  align?: 'left' | 'center' | 'right'
  className?: string
}

export interface RelatorioListagemImpressaoModalProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  subtitulo?: string
  empresa: Empresa | null
  usuarioNome?: string
  filtrosDescricao?: string
  itens: T[]
  colunas: ColunaRelatorioImpressao<T>[]
  totais?: TotalizadorRelatorioImpressao[]
  mensagemVazio?: string
  orientacao?: 'portrait' | 'landscape'
  badgeDestaque?: string
}

export function RelatorioListagemImpressaoModal<T extends { id?: string | number }>({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  empresa,
  usuarioNome,
  filtrosDescricao,
  itens,
  colunas,
  totais,
  mensagemVazio = 'Nenhum registro encontrado para impressão.',
  orientacao = 'portrait',
  badgeDestaque,
}: RelatorioListagemImpressaoModalProps<T>) {
  const handlePrint = () => {
    window.print()
  }

  const agora = new Date()
  const dataExtenso = agora.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const horaExtenso = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const empresaCnpj = empresa?.cnpj || '05.581.899/0001-05'
  const empresaNome = empresa?.nome_fantasia || 'GRUPO PEDREIRA CORDEIRO'
  const empresaRazao = empresa?.razao_social || 'G C DO AMARAL SERTANIA'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-[96vw] ${
          orientacao === 'landscape' ? 'lg:max-w-6xl' : 'lg:max-w-5xl'
        } max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white border-[#ECEAE4]`}
        aria-describedby="relatorio-impressao-desc"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-700" />
              <span>{titulo}</span>
            </DialogTitle>
            <DialogDescription
              id="relatorio-impressao-desc"
              className="text-xs text-gray-500 mt-0.5"
            >
              Visualização prévia do relatório em folha{' '}
              <strong>A4 {orientacao === 'landscape' ? 'Paisagem' : 'Retrato'}</strong> com
              cabeçalho oficial e totalizadores.
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
          <div
            className={`bg-white p-5 sm:p-7 rounded-xl border border-gray-300 print:border-none print:p-0 text-gray-900 font-sans leading-relaxed text-xs ${
              orientacao === 'landscape' ? 'print-landscape' : ''
            }`}
          >
            {/* CABEÇALHO OFICIAL DO ERP */}
            <div className="border-b-2 border-teal-800 pb-3 mb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-lg print:text-teal-900 print:bg-transparent print:border print:border-teal-900 shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-teal-950 uppercase leading-snug">
                    {empresaNome}
                  </h1>
                  <div className="text-[11px] text-gray-700 font-semibold">
                    {empresaRazao} • CNPJ: <span className="font-mono">{empresaCnpj}</span>
                  </div>
                  {subtitulo && <div className="text-[10px] text-gray-500 mt-0.5">{subtitulo}</div>}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-2.5 py-1 bg-teal-50 border border-teal-300 text-teal-900 font-bold text-[11px] uppercase tracking-wider rounded">
                  {badgeDestaque || titulo}
                </div>
                <div className="text-[11px] text-gray-600 mt-1">
                  Emissão: <strong>{dataExtenso}</strong> às <strong>{horaExtenso}</strong>
                </div>
                {usuarioNome && (
                  <div className="text-[10px] text-gray-500">
                    Emitido por: <strong>{usuarioNome}</strong>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Total de Itens: <strong>{itens.length}</strong>
                </div>
              </div>
            </div>

            {/* BARRA DE FILTROS APLICADOS */}
            {filtrosDescricao && (
              <div className="mb-3 px-3 py-1.5 bg-gray-50 print:bg-gray-100 rounded-lg border border-gray-200 text-[11px] text-gray-700 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-gray-900">Parâmetros / Filtros: </span>
                  <span className="text-gray-700">{filtrosDescricao}</span>
                </div>
                <div className="text-gray-500 font-mono text-[10px] shrink-0">
                  {itens.length} registro(s) listado(s)
                </div>
              </div>
            )}

            {/* TABELA DE REGISTROS */}
            <div className="mb-4">
              <table className="w-full text-left border-collapse text-[11px] border border-gray-300 folha-print-table">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-700 font-semibold border-b border-gray-300">
                    <th className="py-1.5 px-2 text-center w-8">#</th>
                    {colunas.map((col) => {
                      const alignClass =
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      return (
                        <th
                          key={col.key}
                          className={`py-1.5 px-2 ${alignClass} ${col.headerClassName || ''}`}
                        >
                          {col.header}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itens.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colunas.length + 1}
                        className="py-8 text-center text-gray-400 text-xs"
                      >
                        <FileSpreadsheet className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                        {mensagemVazio}
                      </td>
                    </tr>
                  ) : (
                    itens.map((item, index) => (
                      <tr
                        key={item.id !== undefined ? String(item.id) : index}
                        className="hover:bg-gray-50"
                      >
                        <td className="py-1.5 px-2 text-center font-mono text-gray-400 text-[10px]">
                          {index + 1}
                        </td>
                        {colunas.map((col) => {
                          const alignClass =
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                          return (
                            <td
                              key={col.key}
                              className={`py-1.5 px-2 ${alignClass} ${col.className || ''}`}
                            >
                              {col.render(item, index)}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {totais && totais.length > 0 && itens.length > 0 && (
                  <tfoot className="bg-gray-100 print:bg-gray-200 border-t-2 border-gray-400 font-bold">
                    <tr>
                      {totais.map((tot, idx) => {
                        const alignClass =
                          tot.align === 'right'
                            ? 'text-right'
                            : tot.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        return (
                          <td
                            key={idx}
                            colSpan={tot.colSpan || 1}
                            className={`py-2 px-2 text-gray-900 ${alignClass} ${
                              tot.className || ''
                            }`}
                          >
                            {tot.label ? (
                              <span className="mr-1.5 text-gray-700">{tot.label}</span>
                            ) : null}
                            <span className="font-mono">{tot.value}</span>
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] text-gray-400 page-break-inside-avoid">
              <div>
                {empresaNome} • {empresaRazao} • CNPJ: {empresaCnpj} • Relatório Operacional ERP
              </div>
              <div>
                Documento gerado em {dataExtenso} às {horaExtenso}
                {usuarioNome ? ` por ${usuarioNome}` : ''}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RelatorioListagemImpressaoModal
