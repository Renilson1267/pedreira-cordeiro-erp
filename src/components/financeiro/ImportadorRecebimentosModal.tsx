import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { formatCurrency } from '@/lib/formatters'
import type { Cliente, PlanoConta, CentroCusto, ContaReceber } from '@/types/erp'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Table,
  Check,
} from 'lucide-react'

interface ImportadorRecebimentosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  clientes: Cliente[]
  categorias: PlanoConta[]
  centrosCusto: CentroCusto[]
  contasExistentes: ContaReceber[]
  onImportComplete: () => Promise<void>
}

interface ColumnMapping {
  data: string
  cliente: string
  descricao: string
  valor: string
  formaRecebimento: string
  dataRecebimento: string
  status: string
  centroCusto: string
}

interface ImportSummary {
  totalLidos: number
  importados: number
  duplicadosPulados: number
  erros: { linha: number; aba: string; motivo: string }[]
  clientesCriados: string[]
  creditosGerados: number
}

export function ImportadorRecebimentosModal({
  open,
  onOpenChange,
  empresaId,
  clientes,
  categorias,
  centrosCusto,
  contasExistentes,
  onImportComplete,
}: ImportadorRecebimentosModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])

  // Raw data preview from first sheet
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])

  // Mapping configuration
  const [mapping, setMapping] = useState<ColumnMapping>({
    data: '',
    cliente: '',
    descricao: '',
    valor: '',
    formaRecebimento: '',
    dataRecebimento: '',
    status: '',
    centroCusto: '',
  })

  // Options
  const [criarClientesNaoEncontrados, setCriarClientesNaoEncontrados] = useState(true)
  const [classificacaoPadrao, setClassificacaoPadrao] = useState<
    'Recebida' | 'Aberta' | 'Recebimento Antecipado' | 'auto'
  >('auto')
  const [categoriaPadraoId, setCategoriaPadraoId] = useState<string>(categorias[0]?.id || '')
  const [centroCustoPadraoId, setCentroCustoPadraoId] = useState<string>('none')
  const [detectarDuplicados, setDetectarDuplicados] = useState(true)

  // Execution State
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetNames([])
    setSelectedSheets([])
    setSheetHeaders([])
    setPreviewRows([])
    setSummary(null)
    setIsProcessing(false)
  }

  // Step 1: Handle File Upload & SheetJS Parse
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      setFile(selectedFile)
      const data = await selectedFile.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: true })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      setSelectedSheets(wb.SheetNames) // All selected by default

      // Load headers and preview from the first sheet
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (json.length > 0) {
        const headers = Object.keys(json[0])
        setSheetHeaders(headers)
        setPreviewRows(json.slice(0, 5))

        // Auto-detect columns heuristics
        const autoMap: ColumnMapping = {
          data: headers.find((h) => /data|venc|emiss/i.test(h)) || headers[0] || '',
          cliente: headers.find((h) => /cli|nome|sacad|destinat/i.test(h)) || '',
          descricao: headers.find((h) => /hist|desc|prod|serv|obs/i.test(h)) || '',
          valor: headers.find((h) => /val|total|preco|mont/i.test(h)) || '',
          formaRecebimento: headers.find((h) => /forma|tipo|meio|pag/i.test(h)) || '',
          dataRecebimento: headers.find((h) => /receb|liquid|pagam/i.test(h)) || '',
          status: headers.find((h) => /situa|status|cond/i.test(h)) || '',
          centroCusto: headers.find((h) => /centro|cc|custo|frente/i.test(h)) || '',
        }
        setMapping(autoMap)
      }

      setStep(2)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir arquivo Excel',
        description: 'Verifique se o arquivo é um .xlsx ou .xls válido.',
        variant: 'destructive',
      })
    }
  }

  const toggleSheet = (name: string) => {
    if (selectedSheets.includes(name)) {
      setSelectedSheets(selectedSheets.filter((s) => s !== name))
    } else {
      setSelectedSheets([...selectedSheets, name])
    }
  }

  const selectAllSheets = () => setSelectedSheets(sheetNames)
  const unselectAllSheets = () => setSelectedSheets([])

  // Parse Date helper
  const parseCellDate = (val: any): string => {
    if (!val) return new Date().toISOString()
    if (val instanceof Date) return val.toISOString()
    if (typeof val === 'number') {
      // Excel serial date number
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    }
    const str = String(val).trim()
    // DD/MM/YYYY or DD-MM-YYYY
    const brMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
    if (brMatch) {
      const d = parseInt(brMatch[1], 10)
      const m = parseInt(brMatch[2], 10) - 1
      let y = parseInt(brMatch[3], 10)
      if (y < 100) y += 2000
      const date = new Date(Date.UTC(y, m, d, 12, 0, 0))
      if (!isNaN(date.getTime())) return date.toISOString()
    }
    const d = new Date(str)
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }

  // Parse Value helper
  const parseCellValue = (val: any): number => {
    if (typeof val === 'number') return val
    if (!val) return 0
    let str = String(val).replace(/R\$/g, '').trim()
    // formato brasileiro: 1.250,50 -> 1250.50
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.')
    } else if (str.includes(',')) {
      str = str.replace(',', '.')
    }
    const num = parseFloat(str)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  // Step 4: Execute Batch Import
  const handleExecuteImport = async () => {
    if (!workbook) return
    setIsProcessing(true)
    setStep(4)

    const resultSummary: ImportSummary = {
      totalLidos: 0,
      importados: 0,
      duplicadosPulados: 0,
      erros: [],
      clientesCriados: [],
      creditosGerados: 0,
    }

    try {
      // Clientes cache
      const clientesCache = new Map<string, Cliente>()
      clientes.forEach((c) => {
        clientesCache.set(c.nome.trim().toLowerCase(), c)
      })

      // Centros custo cache
      const centrosCache = new Map<string, CentroCusto>()
      centrosCusto.forEach((cc) => {
        centrosCache.set(cc.codigo.trim().toLowerCase(), cc)
        centrosCache.set(cc.nome.trim().toLowerCase(), cc)
      })

      // Duplicates index (cliente_id + YYYY-MM-DD + valor.toFixed(2))
      const existingKeys = new Set<string>()
      contasExistentes.forEach((c) => {
        const d = c.vencimento.slice(0, 10)
        const key = `${c.cliente_id || ''}_${d}_${Number(c.valor).toFixed(2)}`
        existingKeys.add(key)
      })

      // Process each selected sheet
      for (const sheetName of selectedSheets) {
        setProgressMsg(`Lendo aba ${sheetName}...`)
        const ws = workbook.Sheets[sheetName]
        if (!ws) continue

        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex]
          resultSummary.totalLidos += 1

          try {
            // Extrair dados mapeados
            const rawCliente = mapping.cliente ? String(row[mapping.cliente] || '').trim() : ''
            const rawValor = mapping.valor ? parseCellValue(row[mapping.valor]) : 0
            const rawData = mapping.data
              ? parseCellDate(row[mapping.data])
              : new Date().toISOString()
            const rawDesc = mapping.descricao
              ? String(row[mapping.descricao] || '').trim()
              : `Recebimento Ref. ${sheetName}`
            const rawForma = mapping.formaRecebimento
              ? String(row[mapping.formaRecebimento] || '').trim()
              : 'Pix'
            const rawStatusCol = mapping.status
              ? String(row[mapping.status] || '').toLowerCase()
              : ''
            const rawCentro = mapping.centroCusto
              ? String(row[mapping.centroCusto] || '').trim()
              : ''

            if (rawValor <= 0 && !rawDesc) {
              // Linha vazia ou totalizador, pula graciosamente
              continue
            }

            // 1. Resolver Cliente
            let clienteId: string | null = null
            if (rawCliente) {
              const keyCli = rawCliente.toLowerCase()
              if (clientesCache.has(keyCli)) {
                clienteId = clientesCache.get(keyCli)!.id
              } else if (criarClientesNaoEncontrados) {
                // Criar novo cliente em runtime
                try {
                  const novoCliente = await pb.collection('clientes').create<Cliente>({
                    empresa_id: empresaId,
                    nome: rawCliente,
                    observacoes: `Criado automaticamente na importação da planilha (aba ${sheetName})`,
                  })
                  clientesCache.set(keyCli, novoCliente)
                  clienteId = novoCliente.id
                  if (!resultSummary.clientesCriados.includes(rawCliente)) {
                    resultSummary.clientesCriados.push(rawCliente)
                  }
                } catch (e) {
                  console.warn('Erro ao criar cliente automaticamente:', rawCliente, e)
                }
              }
            }

            // 2. Verificar duplicidade
            const dateOnly = rawData.slice(0, 10)
            const dedupeKey = `${clienteId || ''}_${dateOnly}_${rawValor.toFixed(2)}`
            if (detectarDuplicados && existingKeys.has(dedupeKey)) {
              resultSummary.duplicadosPulados += 1
              continue
            }

            // 3. Determinar Status
            let finalStatus: 'Aberta' | 'Recebida' | 'Recebimento Antecipado' = 'Recebida'
            if (classificacaoPadrao === 'auto') {
              if (
                rawStatusCol.includes('antecip') ||
                rawStatusCol.includes('adiant') ||
                rawDesc.toLowerCase().includes('antecip') ||
                rawDesc.toLowerCase().includes('deposito') ||
                rawDesc.toLowerCase().includes('crédito') ||
                rawDesc.toLowerCase().includes('credito')
              ) {
                finalStatus = 'Recebimento Antecipado'
              } else if (
                rawStatusCol.includes('abert') ||
                rawStatusCol.includes('pendent') ||
                rawStatusCol.includes('a vencer')
              ) {
                finalStatus = 'Aberta'
              } else {
                finalStatus = 'Recebida'
              }
            } else {
              finalStatus = classificacaoPadrao
            }

            // 4. Determinar Centro de Custo
            let centroCustoId: string | null =
              centroCustoPadraoId && centroCustoPadraoId !== 'none' ? centroCustoPadraoId : null

            if (rawCentro) {
              const keyCentro = rawCentro.toLowerCase()
              if (centrosCache.has(keyCentro)) {
                centroCustoId = centrosCache.get(keyCentro)!.id
              }
            }

            // 5. Determinar Forma de Recebimento
            let finalForma: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' = 'Pix'
            const lowerForma = rawForma.toLowerCase()
            if (lowerForma.includes('bol')) finalForma = 'Boleto'
            else if (
              lowerForma.includes('ted') ||
              lowerForma.includes('doc') ||
              lowerForma.includes('transf')
            )
              finalForma = 'Transferência'
            else if (
              lowerForma.includes('cart') ||
              lowerForma.includes('deb') ||
              lowerForma.includes('cred')
            )
              finalForma = 'Cartão'
            else if (lowerForma.includes('dinh') || lowerForma.includes('espec'))
              finalForma = 'Dinheiro'

            // 6. Gravar Conta a Receber no PocketBase
            const recConta = await pb.collection('contas_receber').create<ContaReceber>({
              empresa_id: empresaId,
              cliente_id: clienteId || null,
              categoria_id: categoriaPadraoId || null,
              centro_custo_id: centroCustoId || null,
              descricao: rawDesc || `Recebimento ${rawCliente || sheetName}`,
              valor: rawValor,
              vencimento: rawData,
              status: finalStatus,
              data_recebimento: finalStatus !== 'Aberta' ? rawData : null,
              forma_recebimento: finalStatus !== 'Aberta' ? finalForma : null,
              observacoes: `Importado de ${file?.name} [Aba: ${sheetName}]`,
            })

            // Se for Recebimento Antecipado, gera crédito correspondente para o cliente
            if (finalStatus === 'Recebimento Antecipado' && clienteId) {
              await pb.collection('creditos_clientes').create({
                empresa_id: empresaId,
                cliente_id: clienteId,
                valor: rawValor,
                saldo_restante: rawValor,
                origem: `Recebimento Antecipado (${sheetName})`,
                descricao: `Depósito/Adiantamento ref. ${rawDesc} [Conta ${recConta.id}]`,
                data: rawData,
                status: 'disponivel',
                referencia_conta_id: recConta.id,
              })
              resultSummary.creditosGerados += 1
            }

            // Se recebida ou antecipado, gera movimento financeiro de entrada
            if (finalStatus === 'Recebida' || finalStatus === 'Recebimento Antecipado') {
              await pb.collection('movimentos_financeiros').create({
                empresa_id: empresaId,
                tipo: 'Entrada',
                descricao: `Recebimento: ${recConta.descricao} [${rawCliente || 'Geral'}]`,
                valor: rawValor,
                data: rawData,
                categoria_id: categoriaPadraoId || null,
                centro_custo_id: centroCustoId || null,
                origem: 'ContaReceber',
                referencia_id: recConta.id,
                conciliado: false,
              })
            }

            existingKeys.add(dedupeKey)
            resultSummary.importados += 1
          } catch (lineErr: any) {
            resultSummary.erros.push({
              aba: sheetName,
              linha: rowIndex + 2,
              motivo: lineErr?.message || 'Erro desconhecido ao processar linha',
            })
          }
        }
      }

      setSummary(resultSummary)
      setStep(5)
      await onImportComplete()
      toast({
        title: 'Importação concluída!',
        description: `${resultSummary.importados} títulos importados com sucesso.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro geral durante importação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isProcessing) {
          onOpenChange(val)
          if (!val) handleReset()
        }
      }}
    >
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b border-[#ECEAE4] bg-[#FAF9F7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Importador de Planilha de Recebimentos (XLSX)
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  Etapa {step} de 5 • Wizard de importação inteligente e seguro
                </p>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    step === s ? 'bg-teal-700' : step > s ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {/* STEP 1: Upload Arquivo */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#ECEAE4] hover:border-teal-600 rounded-2xl p-8 text-center transition-colors bg-[#FAF9F7]/50">
                <Upload className="w-10 h-10 mx-auto text-teal-700 mb-3" />
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  Selecione sua planilha de recebimentos (.xlsx ou .xls)
                </h3>
                <p className="text-gray-500 text-xs max-w-md mx-auto mb-4">
                  Suporta arquivos com múltiplas abas mensais (ex.: JANEIRO_26, FEVEREIRO_26,
                  MARÇO_26...). Os dados são lidos em tempo de execução no seu navegador e gravados
                  com segurança.
                </p>
                <label className="cursor-pointer">
                  <span className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Procurar Arquivo XLSX
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Idempotência garantida:</strong> Você poderá escolher se deseja ignorar
                lançamentos já existentes (mesmo cliente, data e valor) para evitar duplicidades
                caso reimporte a planilha.
              </div>
            </div>
          )}

          {/* STEP 2: Seleção de Abas */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#ECEAE4]">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Abas identificadas no arquivo ({sheetNames.length})
                  </h3>
                  <p className="text-gray-500 text-xs">
                    Marque os meses/abas que deseja consolidar e importar agora:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={selectAllSheets}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Marcar Todas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={unselectAllSheets}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    Desmarcar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                {sheetNames.map((sheet) => {
                  const isChecked = selectedSheets.includes(sheet)
                  return (
                    <label
                      key={sheet}
                      onClick={() => toggleSheet(sheet)}
                      className={`flex items-center space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-teal-600 bg-teal-50/60 font-semibold text-teal-900'
                          : 'border-[#ECEAE4] bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox checked={isChecked} />
                      <span className="truncate">{sheet}</span>
                    </label>
                  )
                })}
              </div>

              <div className="text-[11px] text-gray-500 pt-2">
                Arquivo: <strong className="text-gray-800">{file?.name}</strong> •{' '}
                {selectedSheets.length} aba(s) selecionada(s)
              </div>
            </div>
          )}

          {/* STEP 3: Mapeamento de Colunas e Opções */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-teal-950">
                    Mapeamento Heurístico de Cabeçalhos
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    Identificamos as colunas da planilha automaticamente. Ajuste se necessário:
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-teal-700 border-teal-300">
                  {sheetHeaders.length} Colunas Detectadas
                </Badge>
              </div>

              {/* Grid de Campos Mapeados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Vencimento / Emissão *
                  </Label>
                  <Select
                    value={mapping.data}
                    onValueChange={(val) => setMapping({ ...mapping, data: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Cliente / Sacado *</Label>
                  <Select
                    value={mapping.cliente}
                    onValueChange={(val) => setMapping({ ...mapping, cliente: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Descrição / Histórico *
                  </Label>
                  <Select
                    value={mapping.descricao}
                    onValueChange={(val) => setMapping({ ...mapping, descricao: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Valor Recebido / Título (R$) *
                  </Label>
                  <Select
                    value={mapping.valor}
                    onValueChange={(val) => setMapping({ ...mapping, valor: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Forma de Pagamento (opcional)
                  </Label>
                  <Select
                    value={mapping.formaRecebimento || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, formaRecebimento: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Padrão: Pix" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Padrão / Não mapear (Pix)</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Status / Situação (opcional)
                  </Label>
                  <Select
                    value={mapping.status || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, status: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Usar classificação padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Usar regra de classificação abaixo</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Coluna Centro de Custo (opcional)
                  </Label>
                  <Select
                    value={mapping.centroCusto || 'none'}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, centroCusto: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Coluna de centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem coluna de centro de custo</SelectItem>
                      {sheetHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Centro de Custo Padrão
                  </Label>
                  <Select value={centroCustoPadraoId} onValueChange={setCentroCustoPadraoId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o centro de custo padrão..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum / Não alocado</SelectItem>
                      {centrosCusto.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.codigo} - {cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Opções de Processamento */}
              <div className="pt-3 border-t border-[#ECEAE4] space-y-3">
                <h4 className="font-bold text-gray-900 text-xs">
                  Regras de Negócio e Classificação
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Como classificar os títulos:
                    </Label>
                    <Select
                      value={classificacaoPadrao}
                      onValueChange={(val: any) => setClassificacaoPadrao(val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          Auto-detectar (identifica "Recebimento Antecipado", "Aberta" ou
                          "Recebida")
                        </SelectItem>
                        <SelectItem value="Recebida">
                          Marcar todas como Recebida (Baixada)
                        </SelectItem>
                        <SelectItem value="Aberta">Marcar todas como Aberta (A Receber)</SelectItem>
                        <SelectItem value="Recebimento Antecipado">
                          Marcar como Recebimento Antecipado (Gera Crédito ao Cliente)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Categoria Contábil Padrão:
                    </Label>
                    <Select value={categoriaPadraoId} onValueChange={setCategoriaPadraoId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione categoria de receita..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.codigo} - {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={criarClientesNaoEncontrados}
                      onCheckedChange={(c) => setCriarClientesNaoEncontrados(!!c)}
                    />
                    <span>Cadastrar novos clientes automaticamente caso não constem na base</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={detectarDuplicados}
                      onCheckedChange={(c) => setDetectarDuplicados(!!c)}
                    />
                    <span>
                      Idempotência: Pular registros duplicados (mesmo cliente, data e valor)
                    </span>
                  </label>
                </div>
              </div>

              {/* Preview das primeiras 3 linhas */}
              {previewRows.length > 0 && (
                <div className="pt-2">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Pré-visualização das Primeiras Linhas:
                  </span>
                  <div className="border border-[#ECEAE4] rounded-xl overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500">
                        <tr>
                          {mapping.data && <th className="p-2">Data</th>}
                          {mapping.cliente && <th className="p-2">Cliente</th>}
                          {mapping.descricao && <th className="p-2">Descrição</th>}
                          {mapping.valor && <th className="p-2 text-right">Valor</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEAE4]">
                        {previewRows.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            {mapping.data && (
                              <td className="p-2 font-mono">{String(r[mapping.data] || '')}</td>
                            )}
                            {mapping.cliente && (
                              <td className="p-2 font-medium">
                                {String(r[mapping.cliente] || '')}
                              </td>
                            )}
                            {mapping.descricao && (
                              <td className="p-2 text-gray-600">
                                {String(r[mapping.descricao] || '')}
                              </td>
                            )}
                            {mapping.valor && (
                              <td className="p-2 text-right font-mono font-bold text-gray-900">
                                {formatCurrency(parseCellValue(r[mapping.valor]))}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Processando */}
          {step === 4 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-700" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Processando e gravando registros...
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  {progressMsg || 'Consolidando abas mensais...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Relatório Final */}
          {step === 5 && summary && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-950 text-sm">
                    Importação Concluída com Sucesso!
                  </h3>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Todos os lançamentos foram processados e integrados ao banco de dados da sua
                    empresa.
                  </p>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Lidos</span>
                  <span className="text-lg font-bold text-gray-800 font-mono">
                    {summary.totalLidos}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">
                    Importados
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {summary.importados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">
                    Duplicados
                  </span>
                  <span className="text-lg font-bold text-amber-700 font-mono">
                    {summary.duplicadosPulados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">
                    Créditos Gerados
                  </span>
                  <span className="text-lg font-bold text-teal-700 font-mono">
                    {summary.creditosGerados}
                  </span>
                </div>
              </div>

              {summary.clientesCriados.length > 0 && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="font-semibold text-gray-800 block mb-1">
                    Novos Clientes Cadastrados ({summary.clientesCriados.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {summary.clientesCriados.map((cli, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] bg-white text-gray-700"
                      >
                        {cli}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {summary.erros.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="font-semibold text-red-900 block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Linhas com Inconsistências ({summary.erros.length}):
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto text-[11px] text-red-800">
                    {summary.erros.map((err, i) => (
                      <div key={i}>
                        [{err.aba}] Linha {err.linha}: {err.motivo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-[#ECEAE4] bg-[#FAF9F7] flex items-center justify-between">
          {step > 1 && step < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="text-xs border-[#ECEAE4]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>
          )}

          {step === 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
          )}

          {step === 2 && (
            <Button
              type="button"
              size="sm"
              disabled={selectedSheets.length === 0}
              onClick={() => setStep(3)}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto"
            >
              Avançar p/ Mapeamento
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 3 && (
            <Button
              type="button"
              size="sm"
              disabled={!mapping.valor || !mapping.data}
              onClick={handleExecuteImport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs ml-auto shadow-xs font-semibold"
            >
              Iniciar Importação de {selectedSheets.length} aba(s)
              <Check className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 5 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                handleReset()
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto"
            >
              Concluir e Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
