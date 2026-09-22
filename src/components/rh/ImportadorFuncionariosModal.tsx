import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { apenasDigitos, formatarCpf } from '@/lib/brasilApi'
import { formatDate } from '@/lib/formatters'
import type { Funcionario, SetorFuncionario, StatusFuncionario } from '@/types/erp'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  Check,
  Users,
} from 'lucide-react'

interface ImportadorFuncionariosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  funcionariosExistentes: Funcionario[]
  onImportComplete: () => Promise<void>
}

export interface ColumnMappingFuncionarios {
  nome: string
  cargo: string
  cpf: string
  admissao: string
  setor: string
  salario: string
  telefone: string
  email: string
  chavePix: string
  bancoConta: string
  observacoes: string
}

export interface FuncionarioImportSummary {
  totalLidos: number
  importados: number
  duplicadosPulados: { nome: string; cpf?: string; motivo: string }[]
  erros: { linha: number; motivo: string }[]
  importadosLista: { nome: string; cargo: string; setor: SetorFuncionario }[]
}

// Converte texto em Caixa Título elegante (ex: "AUXILIAR DE ALMOXARIFADO" -> "Auxiliar de Almoxarifado")
export function toTitleCase(str: string): string {
  if (!str) return ''
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com'])
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && minusculas.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

// Sugere o setor da pedreira a partir de palavras-chave do cargo
export function sugerirSetorPorCargo(cargoRaw: string): SetorFuncionario {
  if (!cargoRaw) return 'Outro'
  const c = cargoRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  // Britagem e Lavra
  if (
    c.includes('BRITAD') ||
    c.includes('BRITAG') ||
    c.includes('PERFURATRIZ') ||
    c.includes('PA CARREGADEIRA') ||
    c.includes('CARREGADEIRA') ||
    c.includes('ESCAVADEIRA') ||
    c.includes('OPERADOR DE MAQUINA') ||
    c.includes('OPERADOR MAQUINA') ||
    c.includes('LOKOTRACK') ||
    c.includes('TRATOR') ||
    c.includes('LAVRA')
  ) {
    if (c.includes('LOKOTRACK')) return 'Lokotrack'
    return 'Britagem'
  }

  // Concreto e Usinas
  if (
    c.includes('BETONEIRA') ||
    c.includes('BOMBA') ||
    c.includes('CONCRETO') ||
    c.includes('DOSADOR') ||
    c.includes('USINA')
  ) {
    return 'Concreto'
  }

  // Frota, Transporte e Oficina Mecânica
  if (
    c.includes('MOTORISTA') ||
    c.includes('FROTA') ||
    c.includes('MECANIC') ||
    c.includes('MECÂNICO') ||
    c.includes('OFICINA') ||
    c.includes('SOLDADOR') ||
    c.includes('PIPA') ||
    c.includes('TRANSPORTE')
  ) {
    return 'Frota'
  }

  // Administrativo, Apoio e Engenharia
  if (
    c.includes('ESCRITORIO') ||
    c.includes('ADMINISTRATIV') ||
    c.includes('ALMOXARIF') ||
    c.includes('GERENTE') ||
    c.includes('VENDAS') ||
    c.includes('ESTAGIAR') ||
    c.includes('FINANCEIR') ||
    c.includes('CONTABIL') ||
    c.includes('ENGENHEIR') ||
    c.includes('BALANCEIR') ||
    c.includes('RH') ||
    c.includes('COMPRAS')
  ) {
    return 'Administrativo'
  }

  // Obras / Operações Gerais
  return 'Outro'
}

// Parser tolerante de datas da planilha (suporta serial do Excel, datas JS e strings DD/MM/AAAA)
export function parseDataAdmissao(val: any): string | null {
  if (val === null || val === undefined || val === '') return null

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString()
    }
    return null
  }

  if (typeof val === 'number') {
    // Número serial Excel
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const str = String(val).trim()
  if (!str) return null

  // Formato brasileiro DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (brMatch) {
    const dia = parseInt(brMatch[1], 10)
    const mes = parseInt(brMatch[2], 10) - 1
    let ano = parseInt(brMatch[3], 10)
    if (ano < 100) ano += 2000
    const d = new Date(Date.UTC(ano, mes, dia, 12, 0, 0))
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Formato YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (isoMatch) {
    const ano = parseInt(isoMatch[1], 10)
    const mes = parseInt(isoMatch[2], 10) - 1
    const dia = parseInt(isoMatch[3], 10)
    const d = new Date(Date.UTC(ano, mes, dia, 12, 0, 0))
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // String completa ex: "Wed Mar 06 2024 00:00:00 GMT+0000 (Coordinated Universal Time)"
  const parsedDate = new Date(str)
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString()
  }

  return null
}

// Parser numérico de salário (ex: "R$ 2.500,00", 2500, "2500.50")
export function parseSalario(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val)
  if (!val) return 0
  let str = String(val).replace(/R\$/g, '').trim()
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }
  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.max(0, num)
}

// Normaliza CPF: 11 dígitos com máscara ou vazio
export function normalizarCpfParaImportacao(val: any): string | null {
  if (!val) return null
  const digitos = apenasDigitos(String(val))
  if (digitos.length === 11) {
    return formatarCpf(digitos)
  }
  return null
}

export function ImportadorFuncionariosModal({
  open,
  onOpenChange,
  empresaId,
  funcionariosExistentes,
  onImportComplete,
}: ImportadorFuncionariosModalProps) {
  // Wizard steps: 1 = Upload, 2 = Mapeamento & Ajustes, 3 = Processando, 4 = Resultado
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Linha de cabeçalho detectada (1-based index na planilha: ex 1, 2, 3...)
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(1)
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([])
  const [rawRowsData, setRawRowsData] = useState<any[][]>([])

  // Mapeamento de colunas
  const [mapping, setMapping] = useState<ColumnMappingFuncionarios>({
    nome: '',
    cargo: '',
    cpf: '',
    admissao: '',
    setor: '',
    salario: '',
    telefone: '',
    email: '',
    chavePix: '',
    bancoConta: '',
    observacoes: '',
  })

  // Opções
  const [formatarNomesECargos, setFormatarNomesECargos] = useState(true)
  const [setorPadraoFallback, setSetorPadraoFallback] = useState<SetorFuncionario>('Outro')
  const [ignorarDuplicados, setIgnorarDuplicados] = useState(true)

  // Estado de execução e resumo
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [summary, setSummary] = useState<FuncionarioImportSummary | null>(null)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetNames([])
    setSelectedSheet('')
    setHeaderRowIndex(1)
    setSheetHeaders([])
    setRawRowsData([])
    setSummary(null)
    setIsProcessing(false)
    setProgressMsg('')
    setMapping({
      nome: '',
      cargo: '',
      cpf: '',
      admissao: '',
      setor: '',
      salario: '',
      telefone: '',
      email: '',
      chavePix: '',
      bancoConta: '',
      observacoes: '',
    })
  }

  // Função auxiliar para analisar aba e descobrir linha de cabeçalho
  const processSheetData = (wb: XLSX.WorkBook, sheetName: string, forcedHeaderRow?: number) => {
    const ws = wb.Sheets[sheetName]
    if (!ws) return

    // Lê como matriz de células (arrays 2D) com datas brutas para inspeção
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    setRawRowsData(rawMatrix)

    if (rawMatrix.length === 0) {
      setSheetHeaders([])
      return
    }

    // Heurística de detecção automática da linha de cabeçalho:
    // Procura uma linha que contenha palavras como "NOME", "FUNCAO", "CARGO", "CPF"
    let detectedHeaderRow = forcedHeaderRow !== undefined ? forcedHeaderRow : 1

    if (forcedHeaderRow === undefined) {
      for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
        const row = rawMatrix[r] || []
        const rowTexts = row.map((cell) => String(cell || '').toUpperCase())
        const hasNome = rowTexts.some(
          (t) => t.includes('NOME') || t.includes('COLABORADOR') || t.includes('FUNCIONARIO'),
        )
        const hasFuncao = rowTexts.some(
          (t) => t.includes('FUNCAO') || t.includes('FUNÇÃO') || t.includes('CARGO'),
        )
        const hasCpf = rowTexts.some((t) => t.includes('CPF') || t.includes('DOC'))

        if (hasNome || (hasFuncao && hasCpf)) {
          detectedHeaderRow = r + 1 // 1-based
          break
        }
      }
    }

    setHeaderRowIndex(detectedHeaderRow)

    // Cria os nomes de cabeçalhos da linha encontrada
    const headerRow = rawMatrix[detectedHeaderRow - 1] || []
    const headers: string[] = []

    for (let c = 0; c < headerRow.length; c++) {
      const cellVal = String(headerRow[c] || '').trim()
      const headerName = cellVal || `Coluna_${c + 1}`
      headers.push(headerName)
    }

    setSheetHeaders(headers)

    // Heurística de sugestão automática para as colunas
    const findCol = (regex: RegExp) => headers.find((h) => regex.test(h)) || ''

    setMapping({
      nome: findCol(/nome|colaborador|funcionario|empregado/i) || '',
      cargo: findCol(/fun[cç][aã]o|cargo|ocupa[cç][aã]o/i) || '',
      cpf: findCol(/cpf|documento/i) || '',
      admissao: findCol(/admiss[aã]o|data_adm|dt_adm|data/i) || '',
      setor: findCol(/setor|area|departamento|depto/i) || '',
      salario: findCol(/sal[aá]rio|remunera[cç][aã]o|vencimento/i) || '',
      telefone: findCol(/tel|fone|celular|whatsapp|contato/i) || '',
      email: findCol(/e-?mail|correio/i) || '',
      chavePix: findCol(/pix|chave/i) || '',
      bancoConta: findCol(/banco|ag[eê]ncia|conta/i) || '',
      observacoes: findCol(/obs|observa[cç][oõ]es|nota/i) || '',
    })
  }

  // Upload do arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      setFile(selectedFile)
      const buffer = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        toast({
          title: 'Arquivo sem planilhas',
          description: 'O arquivo enviado não possui abas válidas.',
          variant: 'destructive',
        })
        return
      }

      setWorkbook(wb)
      setSheetNames(wb.SheetNames)

      // Se existir a aba "TODOS OS FUNCIONARIOS GC MIX", seleciona-a preferencialmente
      const preferredSheet =
        wb.SheetNames.find(
          (s) => s.toLowerCase().includes('todos') || s.toLowerCase().includes('func'),
        ) || wb.SheetNames[0]

      setSelectedSheet(preferredSheet)
      processSheetData(wb, preferredSheet)
      setStep(2)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir arquivo Excel',
        description: err.message || 'Verifique se o arquivo é um .xlsx ou .xls válido.',
        variant: 'destructive',
      })
    }
  }

  // Troca de aba
  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet)
    if (workbook) {
      processSheetData(workbook, newSheet)
    }
  }

  // Troca manual da linha de cabeçalho
  const handleHeaderRowChange = (newRowIndex: number) => {
    if (newRowIndex < 1) return
    if (workbook && selectedSheet) {
      processSheetData(workbook, selectedSheet, newRowIndex)
    }
  }

  // Linhas de dados a partir do cabeçalho
  const previewRows = useMemo(() => {
    if (!rawRowsData || rawRowsData.length <= headerRowIndex) return []
    const dataRows = rawRowsData.slice(headerRowIndex)

    return dataRows.slice(0, 5).map((row) => {
      const rowObj: Record<string, any> = {}
      sheetHeaders.forEach((h, colIdx) => {
        rowObj[h] = row[colIdx] ?? ''
      })
      return rowObj
    })
  }, [rawRowsData, headerRowIndex, sheetHeaders])

  // Execução da importação no PocketBase
  const handleExecuteImport = async () => {
    if (!workbook || !selectedSheet || !rawRowsData.length) return
    setIsProcessing(true)
    setStep(3)

    const resultSummary: FuncionarioImportSummary = {
      totalLidos: 0,
      importados: 0,
      duplicadosPulados: [],
      erros: [],
      importadosLista: [],
    }

    try {
      // 1. Monta índices de duplicados já existentes no banco para verificação rápida
      const existingCpfs = new Set<string>()
      const existingNomes = new Set<string>()

      funcionariosExistentes.forEach((f) => {
        if (f.cpf) {
          const clean = apenasDigitos(f.cpf)
          if (clean) existingCpfs.add(clean)
        }
        if (f.nome) {
          const normNome = f.nome.trim().toUpperCase().replace(/\s+/g, ' ')
          existingNomes.add(normNome)
        }
      })

      // Índice das colunas selecionadas
      const getColIndex = (headerName: string) => {
        if (!headerName) return -1
        return sheetHeaders.indexOf(headerName)
      }

      const colNomeIdx = getColIndex(mapping.nome)
      const colCargoIdx = getColIndex(mapping.cargo)
      const colCpfIdx = getColIndex(mapping.cpf)
      const colAdmissaoIdx = getColIndex(mapping.admissao)
      const colSetorIdx = getColIndex(mapping.setor)
      const colSalarioIdx = getColIndex(mapping.salario)
      const colTelefoneIdx = getColIndex(mapping.telefone)
      const colEmailIdx = getColIndex(mapping.email)
      const colChavePixIdx = getColIndex(mapping.chavePix)
      const colBancoContaIdx = getColIndex(mapping.bancoConta)
      const colObsIdx = getColIndex(mapping.observacoes)

      const dataRows = rawRowsData.slice(headerRowIndex)

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const rowNumberInSheet = headerRowIndex + 1 + i
        resultSummary.totalLidos += 1

        try {
          // Extrai Nome
          const rawNome = colNomeIdx >= 0 ? String(row[colNomeIdx] || '').trim() : ''
          if (!rawNome) {
            // Linha vazia ou sem nome, pula silenciosamente
            continue
          }

          // Se a linha for cabeçalho repetido ou rodapé
          const upperNome = rawNome.toUpperCase()
          if (upperNome === 'NOME' || upperNome === 'TOTAL' || upperNome.includes('CNPJ:')) {
            continue
          }

          // Extrai Cargo
          const rawCargo = colCargoIdx >= 0 ? String(row[colCargoIdx] || '').trim() : ''
          const cargoFinal = rawCargo
            ? formatarNomesECargos
              ? toTitleCase(rawCargo)
              : rawCargo
            : 'Colaborador Operacional'

          // Extrai CPF
          const rawCpf = colCpfIdx >= 0 ? String(row[colCpfIdx] || '').trim() : ''
          const cpfDigitos = apenasDigitos(rawCpf)
          const cpfFormatado = cpfDigitos.length === 11 ? formatarCpf(cpfDigitos) : null

          // Verifica duplicidade
          const normNome = rawNome.toUpperCase().replace(/\s+/g, ' ')
          let isDuplicado = false
          let motivoDuplicado = ''

          if (cpfDigitos && cpfDigitos.length === 11 && existingCpfs.has(cpfDigitos)) {
            isDuplicado = true
            motivoDuplicado = `CPF ${formatarCpf(cpfDigitos)} já cadastrado`
          } else if (existingNomes.has(normNome)) {
            isDuplicado = true
            motivoDuplicado = `Nome já cadastrado na empresa`
          }

          if (ignorarDuplicados && isDuplicado) {
            resultSummary.duplicadosPulados.push({
              nome: rawNome,
              cpf: cpfFormatado || undefined,
              motivo: motivoDuplicado,
            })
            continue
          }

          // Setor: se mapeado e preenchido, usa; senão sugere pelo cargo
          const rawSetor = colSetorIdx >= 0 ? String(row[colSetorIdx] || '').trim() : ''
          let setorFinal: SetorFuncionario = setorPadraoFallback

          const validSetores: SetorFuncionario[] = [
            'Britagem',
            'Concreto',
            'Lokotrack',
            'Frota',
            'Administrativo',
            'Outro',
          ]

          if (rawSetor && validSetores.includes(rawSetor as SetorFuncionario)) {
            setorFinal = rawSetor as SetorFuncionario
          } else {
            const sugerido = sugerirSetorPorCargo(rawCargo)
            setorFinal = sugerido
          }

          // Data Admissão
          const rawAdmissao = colAdmissaoIdx >= 0 ? row[colAdmissaoIdx] : null
          const dataAdmissaoIso = parseDataAdmissao(rawAdmissao)

          // Salário
          const rawSalario = colSalarioIdx >= 0 ? row[colSalarioIdx] : null
          const salarioNum = parseSalario(rawSalario)

          // Contatos e outros
          const rawTelefone = colTelefoneIdx >= 0 ? String(row[colTelefoneIdx] || '').trim() : ''
          const rawEmail = colEmailIdx >= 0 ? String(row[colEmailIdx] || '').trim() : ''
          const rawPix = colChavePixIdx >= 0 ? String(row[colChavePixIdx] || '').trim() : ''
          const rawBanco = colBancoContaIdx >= 0 ? String(row[colBancoContaIdx] || '').trim() : ''
          const rawObs = colObsIdx >= 0 ? String(row[colObsIdx] || '').trim() : ''

          // Nome final
          const nomeFinal = formatarNomesECargos ? toTitleCase(rawNome) : rawNome

          // Monta payload conforme schema do PocketBase
          const payload = {
            empresa_id: empresaId,
            nome: nomeFinal,
            cpf: cpfFormatado || null,
            cargo: cargoFinal,
            setor: setorFinal,
            data_admissao: dataAdmissaoIso,
            salario: salarioNum || 0,
            telefone: rawTelefone || null,
            email: rawEmail || null,
            status: 'ativo' as StatusFuncionario,
            chave_pix: rawPix || null,
            banco_conta: rawBanco || null,
            observacoes: rawObs || `Importado da planilha (${selectedSheet})`,
          }

          setProgressMsg(`Cadastrando ${nomeFinal}... (${i + 1}/${dataRows.length})`)

          await pb.collection('funcionarios').create(payload)

          // Atualiza índice de duplicados na memória
          if (cpfDigitos && cpfDigitos.length === 11) {
            existingCpfs.add(cpfDigitos)
          }
          existingNomes.add(normNome)

          resultSummary.importados += 1
          resultSummary.importadosLista.push({
            nome: nomeFinal,
            cargo: cargoFinal,
            setor: setorFinal,
          })
        } catch (lineErr: any) {
          resultSummary.erros.push({
            linha: rowNumberInSheet,
            motivo: lineErr?.message || 'Falha ao gravar registro',
          })
        }
      }

      setSummary(resultSummary)
      setStep(4)
      await onImportComplete()
      toast({
        title: 'Importação concluída!',
        description: `${resultSummary.importados} colaboradores cadastrados com sucesso.`,
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
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b border-[#ECEAE4] bg-[#FAF9F7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Importar Colaboradores de Planilha Excel (XLSX)
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  Etapa {step} de 4 • Cadastro em lote com detecção inteligente de cabeçalhos e
                  setores
                </p>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((s) => (
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
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#ECEAE4] hover:border-teal-600 rounded-2xl p-8 text-center transition-colors bg-[#FAF9F7]/50">
                <Upload className="w-10 h-10 mx-auto text-teal-700 mb-3" />
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  Selecione sua planilha de funcionários (.xlsx ou .xls)
                </h3>
                <p className="text-gray-500 text-xs max-w-md mx-auto mb-4">
                  Suporta arquivos com títulos de cabeçalho na primeira linha ou linhas superiores
                  (ex.: "Planilha de Funcionários"). O importador detecta automaticamente os nomes e
                  cargos.
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

              <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200 text-teal-950 text-[11px] leading-relaxed">
                <div className="font-semibold mb-1 flex items-center gap-1.5 text-teal-900">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  Regras automáticas aplicadas na importação:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-teal-800">
                  <li>
                    Detecção automática de setor por função (Britagem, Concreto, Frota ou
                    Administrativo).
                  </li>
                  <li>
                    Normalização e formatação de CPF (com ou sem máscara) e nomes em caixa título.
                  </li>
                  <li>
                    Prevenção de duplicidade por CPF ou Nome idêntico já cadastrado na empresa.
                  </li>
                  <li>Tolerância com CPFs ausentes ou datas com horários/fusos da planilha.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: Seleção de Aba, Linha de Cabeçalho e Mapeamento de Colunas */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Seleção de Aba e Linha de Cabeçalho */}
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <Label className="text-xs font-semibold text-gray-700">Aba da Planilha:</Label>
                    <Select value={selectedSheet} onValueChange={handleSheetChange}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sn) => (
                          <SelectItem key={sn} value={sn}>
                            {sn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-48">
                    <Label className="text-xs font-semibold text-gray-700">
                      Linha do Cabeçalho Real:
                    </Label>
                    <Select
                      value={String(headerRowIndex)}
                      onValueChange={(v) => handleHeaderRowChange(Number(v))}
                    >
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <SelectItem key={num} value={String(num)}>
                            Linha {num} {num === 2 ? '(Comum em planilhas GC)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500">
                  Arquivo: <strong className="text-gray-800">{file?.name}</strong> •{' '}
                  <span className="text-teal-700 font-semibold">{sheetHeaders.length} colunas</span>{' '}
                  detectadas na linha {headerRowIndex}.
                </div>
              </div>

              {/* Grid de Mapeamento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-xs">Mapeamento de Colunas</span>
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200">
                    Obrigatórios: Nome e Função
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Nome do Colaborador *
                    </Label>
                    <Select
                      value={mapping.nome}
                      onValueChange={(val) => setMapping({ ...mapping, nome: val })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a coluna de Nome..." />
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
                    <Label className="text-xs font-semibold text-gray-700">Cargo / Função *</Label>
                    <Select
                      value={mapping.cargo}
                      onValueChange={(val) => setMapping({ ...mapping, cargo: val })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a coluna de Função..." />
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
                    <Label className="text-xs font-semibold text-gray-700">CPF (opcional)</Label>
                    <Select
                      value={mapping.cpf || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, cpf: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione coluna de CPF..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear / Deixar vazio</SelectItem>
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
                      Data de Admissão (opcional)
                    </Label>
                    <Select
                      value={mapping.admissao || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, admissao: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione coluna de Admissão..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear / Deixar vazio</SelectItem>
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
                      Coluna Setor (opcional - auto se vazia)
                    </Label>
                    <Select
                      value={mapping.setor || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, setor: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Auto sugerido pelo cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Auto sugerir por palavra-chave do cargo
                        </SelectItem>
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
                      Salário Base (opcional)
                    </Label>
                    <Select
                      value={mapping.salario || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, salario: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Coluna de Salário..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem coluna de salário (padrão 0,00)</SelectItem>
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
                      Telefone / Contato
                    </Label>
                    <Select
                      value={mapping.telefone || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, telefone: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Coluna de Telefone..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear</SelectItem>
                        {sheetHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Chave PIX / Banco</Label>
                    <Select
                      value={mapping.chavePix || 'none'}
                      onValueChange={(val) =>
                        setMapping({ ...mapping, chavePix: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Coluna de Chave PIX..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mapear</SelectItem>
                        {sheetHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Opções e Regras */}
              <div className="pt-3 border-t border-[#ECEAE4] space-y-2">
                <span className="font-bold text-gray-900 text-xs block">Opções e Validações:</span>

                <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                  <Checkbox
                    checked={ignorarDuplicados}
                    onCheckedChange={(c) => setIgnorarDuplicados(!!c)}
                  />
                  <span>
                    <strong>Pular duplicados:</strong> ignorar colaborador com CPF já cadastrado ou
                    mesmo nome
                  </span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                  <Checkbox
                    checked={formatarNomesECargos}
                    onCheckedChange={(c) => setFormatarNomesECargos(!!c)}
                  />
                  <span>
                    Formatar nomes e cargos em Caixa Título (ex.: "Operador de Perfuratriz" em vez
                    de tudo maiúsculo)
                  </span>
                </label>
              </div>

              {/* Preview das primeiras linhas */}
              {previewRows.length > 0 && (
                <div className="pt-2">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Prévia dos Primeiros Colaboradores Detectados:
                  </span>
                  <div className="border border-[#ECEAE4] rounded-xl overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                        <tr>
                          <th className="p-2">Nome</th>
                          <th className="p-2">Função</th>
                          <th className="p-2">Setor Sugerido</th>
                          <th className="p-2">CPF</th>
                          <th className="p-2">Admissão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEAE4]">
                        {previewRows.map((r, i) => {
                          const n = mapping.nome ? String(r[mapping.nome] || '') : ''
                          const c = mapping.cargo ? String(r[mapping.cargo] || '') : ''
                          const rawCpf = mapping.cpf ? String(r[mapping.cpf] || '') : ''
                          const doc = normalizarCpfParaImportacao(rawCpf) || (rawCpf ? rawCpf : '—')
                          const admIso = mapping.admissao
                            ? parseDataAdmissao(r[mapping.admissao])
                            : null
                          const sSug = c ? sugerirSetorPorCargo(c) : 'Outro'

                          return (
                            <tr key={i} className="hover:bg-teal-50/20">
                              <td className="p-2 font-medium text-gray-900">
                                {formatarNomesECargos ? toTitleCase(n) : n || '—'}
                              </td>
                              <td className="p-2 text-gray-700">
                                {formatarNomesECargos ? toTitleCase(c) : c || '—'}
                              </td>
                              <td className="p-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-white text-teal-800"
                                >
                                  {sSug}
                                </Badge>
                              </td>
                              <td className="p-2 font-mono text-gray-600">{doc}</td>
                              <td className="p-2 font-mono text-gray-600">
                                {admIso ? formatDate(admIso) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Processando */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-700" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Cadastrando colaboradores no RH...
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  {progressMsg || 'Processando linhas e vinculando à empresa atual...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Resultado / Relatório Final */}
          {step === 4 && summary && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-950 text-sm">
                    Importação Concluída com Sucesso!
                  </h3>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Os funcionários da planilha foram inseridos no módulo RH da sua empresa com
                    todos os dados validados.
                  </p>
                </div>
              </div>

              {/* Cards com Métricas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">
                    Lidos na Planilha
                  </span>
                  <span className="text-lg font-bold text-gray-800 font-mono">
                    {summary.totalLidos}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">
                    Novos Cadastrados
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {summary.importados}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#ECEAE4] rounded-xl text-center">
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">
                    Duplicados Ignorados
                  </span>
                  <span className="text-lg font-bold text-amber-700 font-mono">
                    {summary.duplicadosPulados.length}
                  </span>
                </div>
              </div>

              {/* Lista dos Importados */}
              {summary.importadosLista.length > 0 && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="font-semibold text-gray-800 block mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-700" />
                    Colaboradores Importados ({summary.importadosLista.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px]">
                    {summary.importadosLista.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1 px-2 bg-white rounded-lg border border-gray-100"
                      >
                        <span className="font-medium text-gray-900 truncate max-w-[280px]">
                          {i + 1}. {f.nome}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[10px] truncate max-w-[180px]">
                            {f.cargo}
                          </span>
                          <Badge variant="outline" className="text-[9px] bg-teal-50 text-teal-800">
                            {f.setor}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicados Ignorados */}
              {summary.duplicadosPulados.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="font-semibold text-amber-900 block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Ignorados por Duplicidade ({summary.duplicadosPulados.length}):
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px] text-amber-800">
                    {summary.duplicadosPulados.map((dup, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{dup.nome}</span>
                        <span className="text-[10px] text-amber-600">{dup.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Erros de Linha */}
              {summary.erros.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="font-semibold text-red-900 block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Linhas com Falhas ({summary.erros.length}):
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px] text-red-800">
                    {summary.erros.map((err, i) => (
                      <div key={i}>
                        Linha {err.linha}: {err.motivo}
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
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="text-xs border-[#ECEAE4]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Trocar Arquivo
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
              disabled={!mapping.nome || !mapping.cargo}
              onClick={handleExecuteImport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs ml-auto shadow-xs font-semibold"
            >
              Iniciar Importação de Funcionários
              <Check className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 4 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                handleReset()
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs ml-auto"
            >
              Concluir e Ver Funcionários
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
