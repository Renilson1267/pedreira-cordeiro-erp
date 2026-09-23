import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PlusCircle,
  FileSpreadsheet,
  Printer,
  Upload,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { ContaReceber, Cliente } from '@/types/erp'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  inferirCompetenciaAba,
  normalizarNomeColuna,
  desdobrarCelulasMescladas,
  detectarLinhaCabecalho,
  parseValorReceberDetalhado,
  parseDataReceber,
  classificarStatusRecebimento,
  extrairCidadeENota,
  REGEX_COL_DATA,
  REGEX_COL_CLIENTE,
  REGEX_COL_DESCRICAO,
  REGEX_COL_VALOR,
  REGEX_COL_VALOR_RECEBIDO,
  REGEX_COL_DATA_RECEBIMENTO,
  REGEX_COL_FORMA_RECEBIMENTO,
  REGEX_COL_STATUS,
  REGEX_COL_DOCUMENTO,
} from '@/lib/planilhaRecebimentosUtils'

export interface ConferirPlanilhaRecebimentosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contasExistentes: ContaReceber[]
  clientes: Cliente[]
  empresaNome?: string
}

export type DivergenciaTipoReceber =
  | 'conferido' // ✅ Presente em ambos com dados convergentes
  | 'divergente' // ⚠️ Encontrado no sistema, mas valor/status/datas divergem
  | 'planilha_apenas' // ❌ Presente na planilha, mas ausente em contas_receber
  | 'sistema_apenas' // ➕ Lançado no sistema, mas ausente na planilha (possível duplicidade ou lançamento manual)

export interface DivergenciaDetalheReceber {
  campo: string
  valorPlanilha: string
  valorSistema: string
}

export interface ItemConferenciaReceber {
  id: string
  numLinhaPlanilha?: number
  tipo: DivergenciaTipoReceber
  aba: string
  clienteNome: string
  documentoNota?: string
  descricao: string
  vencimentoPlanilha?: string
  vencimentoSistema?: string
  valorPlanilha?: number
  valorSistema?: number
  valorRecebidoPlanilha?: number
  valorRecebidoSistema?: number
  dataRecebimentoPlanilha?: string
  dataRecebimentoSistema?: string
  statusPlanilha?: string
  statusSistema?: string
  divergencias: DivergenciaDetalheReceber[]
  contaSistemaId?: string
}

export interface ResumoAbaReceber {
  aba: string
  ano: number
  mes: number
  totalPlanilha: number
  totalSistema: number
  conferidos: number
  divergentes: number
  planilhaApenas: number
  sistemaApenas: number
  valorTotalPlanilha: number
  valorTotalSistema: number
}

export function ConferirPlanilhaRecebimentosModal({
  open,
  onOpenChange,
  contasExistentes,
  clientes,
  empresaNome = 'Grupo Pedreira Cordeiro',
}: ConferirPlanilhaRecebimentosModalProps) {
  const { toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetsList, setSheetsList] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<Record<string, boolean>>({})

  // Tolerâncias de comparação
  const [toleranciaCentavos, setToleranciaCentavos] = useState<number>(0.05) // R$ 0,05
  const [toleranciaDiasVenc, setToleranciaDiasVenc] = useState<number>(5) // 5 dias quando sem nota

  // Resultados do processamento
  const [isProcessing, setIsProcessing] = useState(false)
  const [itensConferencia, setItensConferencia] = useState<ItemConferenciaReceber[]>([])
  const [activeTabAba, setActiveTabAba] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [termoBusca, setTermoBusca] = useState<string>('')

  // Mapas e índices auxiliares para otimizar busca de clientes
  const clientesMap = useMemo(() => {
    const map = new Map<string, string>() // id -> nome
    clientes.forEach((c) => {
      map.set(c.id, c.nome)
    })
    return map
  }, [clientes])

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setWorkbook(null)
    setSheetsList([])
    setSelectedSheets({})
    setItensConferencia([])
    setActiveTabAba('todas')
    setFiltroTipo('todos')
    setTermoBusca('')
    setIsProcessing(false)
  }

  // 1. Carregamento do arquivo XLSX
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      setFile(selectedFile)
      const data = await selectedFile.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: true })

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        toast({
          title: 'Arquivo sem planilhas legíveis',
          description: 'O arquivo enviado não possui abas disponíveis.',
          variant: 'destructive',
        })
        return
      }

      setWorkbook(wb)
      setSheetsList(wb.SheetNames)

      // Por padrão, marcar todas as abas que não sejam puramente de rascunho/resumo
      const initialSelected: Record<string, boolean> = {}
      wb.SheetNames.forEach((sName) => {
        initialSelected[sName] = true
      })
      setSelectedSheets(initialSelected)
      setStep(2)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir arquivo Excel',
        description: err.message || 'Verifique se o arquivo é um .xlsx ou .xls válido.',
        variant: 'destructive',
      })
    }
  }

  // Normalizador de strings para matching inteligente
  const normalizar = (txt: any) =>
    String(txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const apenasNumeros = (txt: any) => String(txt || '').replace(/\D/g, '')

  // 2. Executar conferência cruzada linha a linha
  const handleExecutarConferencia = () => {
    if (!workbook) return
    setIsProcessing(true)

    try {
      const todosItens: ItemConferenciaReceber[] = []
      const contasPareadasIds = new Set<string>()

      const abasParaProcessar = sheetsList.filter((s) => selectedSheets[s])

      // Para cada aba selecionada na planilha
      for (const sheetName of abasParaProcessar) {
        const ws = workbook.Sheets[sheetName]
        if (!ws) continue

        // Desdobrar células mescladas na aba para garantir leitura linha a linha correta
        desdobrarCelulasMescladas(ws)

        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        })
        if (!matrix || matrix.length === 0) continue

        const comp = inferirCompetenciaAba(sheetName)
        const headerRow = detectarLinhaCabecalho(matrix)
        const headerCells = matrix[headerRow - 1] || []
        const headers = headerCells.map((c, idx) => String(c || '').trim() || `Coluna_${idx + 1}`)

        const findCol = (pattern: RegExp) =>
          headers.find((h) => pattern.test(normalizarNomeColuna(h)) || pattern.test(h)) || ''

        let dataCol = findCol(REGEX_COL_DATA) || headers[0] || ''
        let cliCol = findCol(REGEX_COL_CLIENTE)
        let descCol = findCol(REGEX_COL_DESCRICAO)
        let valCol = findCol(REGEX_COL_VALOR)
        let valRecCol = findCol(REGEX_COL_VALOR_RECEBIDO)
        let dataRecCol = findCol(REGEX_COL_DATA_RECEBIMENTO)
        let formaCol = findCol(REGEX_COL_FORMA_RECEBIMENTO)
        let statusCol = findCol(REGEX_COL_STATUS)
        let docCol = findCol(REGEX_COL_DOCUMENTO)

        const dataRows = matrix.slice(headerRow)
        let ultimaDataValida: any = null

        // Filtrar contas do sistema pertencentes à mesma competência aproximada desta aba
        // Para abas nomeadas com mês (ex: JANEIRO_26 -> mes 1, ano 2026)
        const contasDoMes = contasExistentes.filter((c) => {
          if (!c.vencimento) return false
          const venc = c.vencimento.slice(0, 10) // YYYY-MM-DD
          const parts = venc.split('-')
          const anoC = parseInt(parts[0], 10)
          const mesC = parseInt(parts[1], 10)
          if (comp.ano && comp.mes) {
            return anoC === comp.ano && mesC === comp.mes
          }
          return true
        })

        // Processar linhas da planilha
        for (let r = 0; r < dataRows.length; r++) {
          const row = dataRows[r]
          const numLinha = r + headerRow + 1

          const temConteudo = row.some((c) => String(c ?? '').trim().length > 0)
          if (!temConteudo) continue

          const rowTextJoined = row
            .map((c) => normalizarNomeColuna(c))
            .filter(Boolean)
            .join(' ')

          // Separador de quinzena, semana ou cabeçalhos repetidos
          if (
            rowTextJoined.includes('QUINZENA') ||
            rowTextJoined.includes('SEMANA') ||
            rowTextJoined.startsWith('BLOCO') ||
            ((rowTextJoined.includes('DATA') || rowTextJoined.includes('VENC')) &&
              rowTextJoined.includes('VALOR'))
          ) {
            ultimaDataValida = null
            continue
          }

          if (
            rowTextJoined.startsWith('TOTAL') ||
            rowTextJoined.startsWith('SUBTOTAL') ||
            rowTextJoined.startsWith('SALDO')
          ) {
            ultimaDataValida = null
            continue
          }

          const getVal = (colName: string) => {
            if (!colName) return ''
            const idx = headers.indexOf(colName)
            if (idx === -1) return ''
            return row[idx] ?? ''
          }

          let rawData = getVal(dataCol)
          let rawCli = String(getVal(cliCol) || '').trim()
          let rawDesc = String(getVal(descCol) || '').trim()
          const rawDoc = String(getVal(docCol) || '').trim()

          if (!rawCli && !rawDesc) {
            // Buscar texto plausível na linha
            for (let cIdx = 0; cIdx < row.length; cIdx++) {
              const cv = row[cIdx]
              if (
                cv &&
                typeof cv === 'string' &&
                cv.trim().length > 1 &&
                !/^\d+([.,]\d+)?$/.test(cv.trim())
              ) {
                rawDesc = cv.trim()
                break
              }
            }
          }

          if (!rawCli && rawDesc) {
            rawCli = rawDesc
          }

          const valDet = parseValorReceberDetalhado(getVal(valCol))
          const valRecDet = parseValorReceberDetalhado(getVal(valRecCol))
          const valorPlanilha = valDet.valor > 0 ? valDet.valor : valRecDet.valor
          const valorRecebidoPlanilha = valRecDet.valor

          if (valorPlanilha <= 0) {
            continue // Linhas sem valor não são lançamentos contábeis
          }

          // Resolução de data de vencimento com a mesma lógica do importador
          let dataVencPlanilhaISO = ''
          const rawDataStr = String(rawData ?? '').trim()
          if (rawDataStr) {
            dataVencPlanilhaISO = parseDataReceber(rawData, comp.ano, comp.mes)
            ultimaDataValida = rawData
          } else if (ultimaDataValida) {
            dataVencPlanilhaISO = parseDataReceber(ultimaDataValida, comp.ano, comp.mes)
          } else {
            const y = comp.ano || 2026
            const m = comp.mes || 1
            dataVencPlanilhaISO = `${y}-${String(m).padStart(2, '0')}-01T12:00:00.000Z`
          }

          // Resolução de nota/doc e endereço
          const extraido = extrairCidadeENota(rawDesc || rawCli)
          const notaPlanilha = rawDoc || extraido.nota || ''

          // Determinar status na planilha
          const rawStatus = String(getVal(statusCol) || '').trim()
          const rawDataRec = getVal(dataRecCol)
          const statusClass = classificarStatusRecebimento({
            rawStatus,
            descFinal: rawDesc,
            valorPrevisto: valorPlanilha,
            valorRecebido: valorRecebidoPlanilha,
            temColunaValorRecebido: Boolean(valRecCol),
            temColunaDataRecebimento: Boolean(dataRecCol),
            rawDataRecebimentoValida: Boolean(rawDataRec),
          })

          const statusPlanilhaCalculado = statusClass.status
          const dataRecebimentoPlanilhaISO =
            statusClass.status === 'Recebida' || statusClass.status === 'Parcial'
              ? parseDataReceber(rawDataRec || rawData, comp.ano, comp.mes)
              : undefined

          // BUSCA DE CASAMENTO COM CONTAS DO SISTEMA
          // Prioridade 1: Match por Nota/Doc (se existir e tiver dígitos) + valor com tolerância
          // Prioridade 2: Match por Cliente similar + valor com tolerância + vencimento aproximado
          let melhorCandidato: ContaReceber | null = null
          let melhorDistancia = Infinity

          const notaNumeros = apenasNumeros(notaPlanilha)
          const cliNormPlanilha = normalizar(rawCli)

          for (const conta of contasDoMes) {
            if (contasPareadasIds.has(conta.id)) continue

            const difValor = Math.abs(Number(conta.valor || 0) - valorPlanilha)
            if (difValor > toleranciaCentavos) continue

            const contaNotaNumeros = apenasNumeros(conta.nota || '')
            const contaCliNome = clientesMap.get(conta.cliente_id) || conta.descricao || ''
            const contaCliNorm = normalizar(contaCliNome)

            // Match por documento/nota idênticos ou contidos
            if (
              notaNumeros.length >= 3 &&
              contaNotaNumeros.length >= 3 &&
              (notaNumeros === contaNotaNumeros ||
                notaNumeros.includes(contaNotaNumeros) ||
                contaNotaNumeros.includes(notaNumeros))
            ) {
              melhorCandidato = conta
              break
            }

            // Match por cliente + vencimento próximo
            const clienteBate =
              cliNormPlanilha &&
              contaCliNorm &&
              (cliNormPlanilha.includes(contaCliNorm) ||
                contaCliNorm.includes(cliNormPlanilha) ||
                cliNormPlanilha.slice(0, 10) === contaCliNorm.slice(0, 10))

            if (clienteBate) {
              // Calcular diferença em dias de vencimento
              const dPl = new Date(dataVencPlanilhaISO).getTime()
              const dSis = new Date(conta.vencimento).getTime()
              const difDias = Math.abs(dPl - dSis) / (1000 * 60 * 60 * 24)

              if (difDias <= toleranciaDiasVenc && difDias < melhorDistancia) {
                melhorDistancia = difDias
                melhorCandidato = conta
              }
            }
          }

          // Se não achou na competência restrita e tinha nota clara, procurar em todo o contas_receber
          if (!melhorCandidato && notaNumeros.length >= 4) {
            for (const conta of contasExistentes) {
              if (contasPareadasIds.has(conta.id)) continue
              const contaNotaNumeros = apenasNumeros(conta.nota || '')
              const difValor = Math.abs(Number(conta.valor || 0) - valorPlanilha)

              if (
                difValor <= toleranciaCentavos &&
                (notaNumeros === contaNotaNumeros || contaNotaNumeros.includes(notaNumeros))
              ) {
                melhorCandidato = conta
                break
              }
            }
          }

          if (melhorCandidato) {
            contasPareadasIds.add(melhorCandidato.id)

            // Checar divergências campo a campo
            const divergencias: DivergenciaDetalheReceber[] = []

            const difValor = Math.abs(Number(melhorCandidato.valor || 0) - valorPlanilha)
            if (difValor > 0.01) {
              divergencias.push({
                campo: 'Valor Previsto',
                valorPlanilha: formatCurrency(valorPlanilha),
                valorSistema: formatCurrency(melhorCandidato.valor),
              })
            }

            // Comparar status (Normalizar: Recebida vs Aberta vs Parcial)
            const stPlanilha = statusPlanilhaCalculado
            const stSistema = melhorCandidato.status || 'Aberta'
            if (stPlanilha !== stSistema) {
              divergencias.push({
                campo: 'Status',
                valorPlanilha: stPlanilha,
                valorSistema: stSistema,
              })
            }

            // Comparar vencimento (apenas ano-mês-dia)
            const vPl = dataVencPlanilhaISO.slice(0, 10)
            const vSis = (melhorCandidato.vencimento || '').slice(0, 10)
            if (vPl && vSis && vPl !== vSis) {
              divergencias.push({
                campo: 'Data de Vencimento',
                valorPlanilha: formatDate(dataVencPlanilhaISO),
                valorSistema: formatDate(melhorCandidato.vencimento),
              })
            }

            // Comparar valor recebido / baixado se algum dos dois tiver quitação
            const vRecPl = statusClass.valorEfetivoRecebido
            const vRecSis = Number(melhorCandidato.valor_recebido || 0)
            if (Math.abs(vRecPl - vRecSis) > 0.05 && (vRecPl > 0 || vRecSis > 0)) {
              divergencias.push({
                campo: 'Valor Recebido',
                valorPlanilha: formatCurrency(vRecPl),
                valorSistema: formatCurrency(vRecSis),
              })
            }

            todosItens.push({
              id: `item_pl_${sheetName}_${r}`,
              numLinhaPlanilha: numLinha,
              tipo: divergencias.length === 0 ? 'conferido' : 'divergente',
              aba: sheetName,
              clienteNome: rawCli || 'Cliente não identificado',
              documentoNota: notaPlanilha,
              descricao: rawDesc || rawCli,
              vencimentoPlanilha: dataVencPlanilhaISO,
              vencimentoSistema: melhorCandidato.vencimento,
              valorPlanilha,
              valorSistema: melhorCandidato.valor,
              valorRecebidoPlanilha: vRecPl,
              valorRecebidoSistema: vRecSis,
              dataRecebimentoPlanilha: dataRecebimentoPlanilhaISO,
              dataRecebimentoSistema: melhorCandidato.data_recebimento,
              statusPlanilha: stPlanilha,
              statusSistema: stSistema,
              divergencias,
              contaSistemaId: melhorCandidato.id,
            })
          } else {
            // Ausente no sistema
            todosItens.push({
              id: `item_pl_nao_cad_${sheetName}_${r}`,
              numLinhaPlanilha: numLinha,
              tipo: 'planilha_apenas',
              aba: sheetName,
              clienteNome: rawCli || 'Cliente não identificado',
              documentoNota: notaPlanilha,
              descricao: rawDesc || rawCli,
              vencimentoPlanilha: dataVencPlanilhaISO,
              valorPlanilha,
              valorRecebidoPlanilha: statusClass.valorEfetivoRecebido,
              dataRecebimentoPlanilha: dataRecebimentoPlanilhaISO,
              statusPlanilha: statusPlanilhaCalculado,
              divergencias: [
                {
                  campo: 'Lançamento no Sistema',
                  valorPlanilha: 'Presente na planilha',
                  valorSistema: 'NÃO ENCONTRADO em Contas a Receber',
                },
              ],
            })
          }
        }

        // Lançamentos do sistema que NÃO foram casados com nenhuma linha desta aba
        for (const conta of contasDoMes) {
          if (!contasPareadasIds.has(conta.id)) {
            contasPareadasIds.add(conta.id)
            const cliNome = clientesMap.get(conta.cliente_id) || conta.descricao || 'Cliente'
            todosItens.push({
              id: `item_sis_so_${conta.id}`,
              tipo: 'sistema_apenas',
              aba: sheetName,
              clienteNome: cliNome,
              documentoNota: conta.nota,
              descricao: conta.descricao,
              vencimentoSistema: conta.vencimento,
              valorSistema: conta.valor,
              valorRecebidoSistema: conta.valor_recebido,
              dataRecebimentoSistema: conta.data_recebimento,
              statusSistema: conta.status,
              divergencias: [
                {
                  campo: 'Lançamento na Planilha',
                  valorPlanilha: 'AUSENTE na aba',
                  valorSistema: 'Lançado no sistema (possível duplicidade ou avulso)',
                },
              ],
              contaSistemaId: conta.id,
            })
          }
        }
      }

      setItensConferencia(todosItens)
      setStep(3)
      toast({
        title: 'Conferência concluída!',
        description: `${todosItens.length} itens analisados entre a planilha e o Contas a Receber.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro durante a conferência',
        description: err.message || 'Falha ao cruzar dados com lançamentos do sistema.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Resumo estatístico geral e por aba
  const resumosPorAba = useMemo(() => {
    const abas = Array.from(new Set(itensConferencia.map((i) => i.aba)))
    const lista: ResumoAbaReceber[] = []

    abas.forEach((abaName) => {
      const comp = inferirCompetenciaAba(abaName)
      const doMes = itensConferencia.filter((i) => i.aba === abaName)

      let conferidos = 0
      let divergentes = 0
      let planilhaApenas = 0
      let sistemaApenas = 0
      let valPlan = 0
      let valSis = 0

      doMes.forEach((item) => {
        if (item.tipo === 'conferido') conferidos++
        else if (item.tipo === 'divergente') divergentes++
        else if (item.tipo === 'planilha_apenas') planilhaApenas++
        else if (item.tipo === 'sistema_apenas') sistemaApenas++

        if (item.valorPlanilha) valPlan += item.valorPlanilha
        if (item.valorSistema) valSis += item.valorSistema
      })

      lista.push({
        aba: abaName,
        ano: comp.ano || 2026,
        mes: comp.mes || 1,
        totalPlanilha: conferidos + divergentes + planilhaApenas,
        totalSistema: conferidos + divergentes + sistemaApenas,
        conferidos,
        divergentes,
        planilhaApenas,
        sistemaApenas,
        valorTotalPlanilha: valPlan,
        valorTotalSistema: valSis,
      })
    })

    return lista
  }, [itensConferencia])

  const totaisGerais = useMemo(() => {
    let conferidos = 0
    let divergentes = 0
    let planilhaApenas = 0
    let sistemaApenas = 0
    let valPlan = 0
    let valSis = 0

    itensConferencia.forEach((item) => {
      if (item.tipo === 'conferido') conferidos++
      else if (item.tipo === 'divergente') divergentes++
      else if (item.tipo === 'planilha_apenas') planilhaApenas++
      else if (item.tipo === 'sistema_apenas') sistemaApenas++

      if (item.valorPlanilha) valPlan += item.valorPlanilha
      if (item.valorSistema) valSis += item.valorSistema
    })

    return {
      totalItens: itensConferencia.length,
      conferidos,
      divergentes,
      planilhaApenas,
      sistemaApenas,
      valorTotalPlanilha: valPlan,
      valorTotalSistema: valSis,
    }
  }, [itensConferencia])

  // Filtragem dos itens exibidos
  const itensFiltrados = useMemo(() => {
    return itensConferencia.filter((item) => {
      if (activeTabAba !== 'todas' && item.aba !== activeTabAba) return false
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false

      if (termoBusca.trim()) {
        const q = normalizar(termoBusca)
        const matchCli = normalizar(item.clienteNome).includes(q)
        const matchDesc = normalizar(item.descricao).includes(q)
        const matchDoc = normalizar(item.documentoNota).includes(q)
        const matchVal = (item.valorPlanilha || item.valorSistema || 0).toString().includes(q)
        if (!matchCli && !matchDesc && !matchDoc && !matchVal) return false
      }

      return true
    })
  }, [itensConferencia, activeTabAba, filtroTipo, termoBusca])

  // Impressão A4 do Relatório de Conferência no padrão Pedreira Cordeiro
  const handleImprimirRelatorio = () => {
    const dataHoraEmissao = new Date().toLocaleString('pt-BR')

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Conferência de Recebimentos - ${empresaNome}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 11px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header-left h1 {
            font-size: 16px;
            margin: 0 0 2px 0;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-left p {
            margin: 0;
            font-size: 11px;
            color: #475569;
          }
          .header-right {
            text-align: right;
            font-size: 10px;
            color: #64748b;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }
          .summary-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 10px;
            background: #f8fafc;
          }
          .summary-card .label {
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
          }
          .summary-card .value {
            font-size: 15px;
            font-weight: 700;
            margin-top: 2px;
          }
          .summary-card.green .value { color: #15803d; }
          .summary-card.amber .value { color: #b45309; }
          .summary-card.red .value { color: #b91c1c; }
          .summary-card.blue .value { color: #1d4ed8; }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            padding: 6px 6px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 5px 6px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background-color: #fafafa;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 9px;
            font-weight: 700;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .badge-green { background: #dcfce7; color: #15803d; }
          .badge-amber { background: #fef3c7; color: #b45309; }
          .badge-red { background: #fee2e2; color: #b91c1c; }
          .badge-blue { background: #dbeafe; color: #1d4ed8; }
          .divergencia-box {
            margin-top: 4px;
            padding: 4px;
            background: #fffbeb;
            border-left: 2px solid #f59e0b;
            font-size: 9px;
            color: #78350f;
          }
          .footer {
            margin-top: 20px;
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>${empresaNome}</h1>
            <p>Conferência de Planilha vs. Contas a Receber • Arquivo: ${file?.name || 'XLSX'}</p>
          </div>
          <div class="header-right">
            <div>Emissão: ${dataHoraEmissao}</div>
            <div>Aba: ${activeTabAba === 'todas' ? 'Todas as Abas' : activeTabAba}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card green">
            <div class="label">Conferidos (Batem)</div>
            <div class="value">${totaisGerais.conferidos}</div>
          </div>
          <div class="summary-card amber">
            <div class="label">Com Divergência</div>
            <div class="value">${totaisGerais.divergentes}</div>
          </div>
          <div class="summary-card red">
            <div class="label">Só na Planilha (Ausente)</div>
            <div class="value">${totaisGerais.planilhaApenas}</div>
          </div>
          <div class="summary-card blue">
            <div class="label">Só no Sistema (Avulso)</div>
            <div class="value">${totaisGerais.sistemaApenas}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 75px;">Status</th>
              <th style="width: 70px;">Aba / Linha</th>
              <th>Cliente / Descrição</th>
              <th style="width: 80px;">Doc / NF</th>
              <th style="width: 80px;">Vencimento</th>
              <th style="width: 90px; text-align: right;">Valor Planilha</th>
              <th style="width: 90px; text-align: right;">Valor Sistema</th>
              <th style="width: 80px;">Situação</th>
            </tr>
          </thead>
          <tbody>
            ${itensFiltrados
              .map((it) => {
                let badgeClass = 'badge-green'
                let badgeTxt = 'Conferido'
                if (it.tipo === 'divergente') {
                  badgeClass = 'badge-amber'
                  badgeTxt = 'Divergência'
                } else if (it.tipo === 'planilha_apenas') {
                  badgeClass = 'badge-red'
                  badgeTxt = 'Só Planilha'
                } else if (it.tipo === 'sistema_apenas') {
                  badgeClass = 'badge-blue'
                  badgeTxt = 'Só Sistema'
                }

                const divHtml =
                  it.divergencias.length > 0
                    ? `<div class="divergencia-box">${it.divergencias
                        .map(
                          (d) =>
                            `<strong>${d.campo}:</strong> Planilha [${d.valorPlanilha}] ⇄ Sistema [${d.valorSistema}]`,
                        )
                        .join('<br>')}</div>`
                    : ''

                return `
                <tr>
                  <td><span class="badge ${badgeClass}">${badgeTxt}</span></td>
                  <td>${it.aba}${it.numLinhaPlanilha ? ` (L.${it.numLinhaPlanilha})` : ''}</td>
                  <td>
                    <strong>${it.clienteNome}</strong><br>
                    <span style="color: #64748b; font-size: 9px;">${it.descricao}</span>
                    ${divHtml}
                  </td>
                  <td>${it.documentoNota || '-'}</td>
                  <td>${formatDate(it.vencimentoPlanilha || it.vencimentoSistema)}</td>
                  <td style="text-align: right; font-weight: 600;">
                    ${it.valorPlanilha ? formatCurrency(it.valorPlanilha) : '-'}
                  </td>
                  <td style="text-align: right; font-weight: 600;">
                    ${it.valorSistema ? formatCurrency(it.valorSistema) : '-'}
                  </td>
                  <td>${it.statusSistema || it.statusPlanilha || '-'}</td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Grupo Pedreira Cordeiro ERP • Módulo Financeiro Contas a Receber</div>
          <div>Total de Lançamentos Listados: ${itensFiltrados.length}</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `

    const printWin = window.open('', '_blank')
    if (printWin) {
      printWin.document.open()
      printWin.document.write(htmlContent)
      printWin.document.close()
    } else {
      toast({
        title: 'Pop-up bloqueado',
        description: 'Permita abertura de pop-ups para imprimir o relatório de conferência.',
        variant: 'destructive',
      })
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
      <DialogContent className="sm:max-w-[96vw] max-w-[1240px] max-h-[94vh] flex flex-col bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b border-[#ECEAE4] bg-[#FAF9F7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Conferência de Planilha vs. Contas a Receber
                </DialogTitle>
                <p className="text-xs text-gray-500">
                  {step === 1 && 'Envie a planilha de recebimentos para comparar com o sistema'}
                  {step === 2 && 'Selecione as abas e configure as tolerâncias de casamento'}
                  {step === 3 && 'Resultado detalhado da conferência cruzada com relatório'}
                </p>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    step === s ? 'bg-blue-600' : step > s ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {/* ETAPA 1: Upload do Arquivo */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Selecione a planilha de recebimentos (XLSX / XLS)
              </h3>
              <p className="text-xs text-gray-500 max-w-md mb-6">
                O arquivo será analisado aba por aba (ex: JANEIRO_26 a DEZEMBRO_26) e comparado
                contra todos os lançamentos já existentes em Contas a Receber.
              </p>

              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition shadow-sm">
                <Upload className="w-4 h-4" />
                <span>Escolher Arquivo XLSX</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* ETAPA 2: Seleção de Abas e Tolerâncias */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-3">
                <SlidersHorizontal className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-semibold">Parâmetros de Comparação Inteligente</p>
                  <p className="text-blue-700">
                    O sistema casa lançamentos primeiro por <strong>(Nota/Doc + Valor)</strong>. Na
                    falta de documento, casa por{' '}
                    <strong>(Cliente + Valor + Vencimento próximo)</strong>.
                  </p>
                </div>
              </div>

              {/* Controles de Tolerância */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Tolerância de Valor (Centavos)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={toleranciaCentavos}
                      onChange={(e) => setToleranciaCentavos(parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs w-32"
                    />
                    <span className="text-xs text-gray-500">
                      R$ {toleranciaCentavos.toFixed(2)} (absorve pequenos arredondamentos)
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Tolerância de Vencimento (Dias)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="30"
                      value={toleranciaDiasVenc}
                      onChange={(e) => setToleranciaDiasVenc(parseInt(e.target.value, 10) || 0)}
                      className="h-9 text-xs w-32"
                    />
                    <span className="text-xs text-gray-500">
                      dias de diferença aceitáveis ao casar sem nota
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Abas Encontradas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Abas Encontradas no Arquivo ({sheetsList.length})
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const all: Record<string, boolean> = {}
                        sheetsList.forEach((s) => (all[s] = true))
                        setSelectedSheets(all)
                      }}
                    >
                      Marcar Todas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedSheets({})}
                    >
                      Desmarcar Todas
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {sheetsList.map((sName) => {
                    const comp = inferirCompetenciaAba(sName)
                    return (
                      <label
                        key={sName}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                          selectedSheets[sName]
                            ? 'bg-blue-50/50 border-blue-300 text-blue-900 font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={Boolean(selectedSheets[sName])}
                          onCheckedChange={(checked) =>
                            setSelectedSheets((prev) => ({
                              ...prev,
                              [sName]: Boolean(checked),
                            }))
                          }
                        />
                        <div className="truncate">
                          <div className="truncate font-medium">{sName}</div>
                          {comp.mes && comp.ano && (
                            <div className="text-[10px] text-gray-400">
                              Mês {comp.mes}/{comp.ano}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Relatório da Conferência */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Cards de Métricas Gerais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  onClick={() => setFiltroTipo(filtroTipo === 'conferido' ? 'todos' : 'conferido')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    filtroTipo === 'conferido'
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400'
                      : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-800 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      ✅ Conferidos
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-emerald-900">
                    {totaisGerais.conferidos}
                  </div>
                  <div className="text-[10px] text-emerald-700">Batem integralmente</div>
                </div>

                <div
                  onClick={() =>
                    setFiltroTipo(filtroTipo === 'divergente' ? 'todos' : 'divergente')
                  }
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    filtroTipo === 'divergente'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400'
                      : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-800 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      ⚠️ Divergências
                    </span>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-xl font-bold text-amber-900">{totaisGerais.divergentes}</div>
                  <div className="text-[10px] text-amber-700">Valor, status ou data diferem</div>
                </div>

                <div
                  onClick={() =>
                    setFiltroTipo(filtroTipo === 'planilha_apenas' ? 'todos' : 'planilha_apenas')
                  }
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    filtroTipo === 'planilha_apenas'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400'
                      : 'bg-rose-50/40 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-800 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      ❌ Só Planilha
                    </span>
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-xl font-bold text-rose-900">
                    {totaisGerais.planilhaApenas}
                  </div>
                  <div className="text-[10px] text-rose-700">Não lançados no sistema</div>
                </div>

                <div
                  onClick={() =>
                    setFiltroTipo(filtroTipo === 'sistema_apenas' ? 'todos' : 'sistema_apenas')
                  }
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    filtroTipo === 'sistema_apenas'
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400'
                      : 'bg-blue-50/40 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-800 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      ➕ Só Sistema
                    </span>
                    <PlusCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xl font-bold text-blue-900">
                    {totaisGerais.sistemaApenas}
                  </div>
                  <div className="text-[10px] text-blue-700">Ausentes na planilha</div>
                </div>
              </div>

              {/* Barra de Filtro e Busca */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <Input
                      placeholder="Buscar cliente, nota, valor..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="h-8 pl-8 text-xs bg-white"
                    />
                  </div>

                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-8 text-xs w-40 bg-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Status</SelectItem>
                      <SelectItem value="conferido">✅ Conferidos</SelectItem>
                      <SelectItem value="divergente">⚠️ Divergências</SelectItem>
                      <SelectItem value="planilha_apenas">❌ Só Planilha</SelectItem>
                      <SelectItem value="sistema_apenas">➕ Só Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs text-gray-500">
                    Mostrando <strong>{itensFiltrados.length}</strong> de{' '}
                    <strong>{itensConferencia.length}</strong> itens
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImprimirRelatorio}
                    className="h-8 text-xs gap-1.5 bg-white border-gray-300 hover:bg-gray-100"
                  >
                    <Printer className="w-3.5 h-3.5 text-gray-700" />
                    <span>Imprimir Relatório A4</span>
                  </Button>
                </div>
              </div>

              {/* Tabs por Aba da Planilha */}
              <Tabs value={activeTabAba} onValueChange={setActiveTabAba} className="w-full">
                <TabsList className="bg-gray-100/80 p-1 flex overflow-x-auto justify-start h-auto scrollbar-thin">
                  <TabsTrigger value="todas" className="text-xs py-1.5 px-3">
                    Todas as Abas ({itensConferencia.length})
                  </TabsTrigger>
                  {resumosPorAba.map((r) => (
                    <TabsTrigger key={r.aba} value={r.aba} className="text-xs py-1.5 px-3">
                      {r.aba}
                      {r.divergentes + r.planilhaApenas > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                          {r.divergentes + r.planilhaApenas}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Tabela de Lançamentos Conferidos */}
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10">
                      <TableRow className="text-[11px]">
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[90px]">Aba / Linha</TableHead>
                        <TableHead>Cliente / Descrição</TableHead>
                        <TableHead className="w-[90px]">Doc / Nota</TableHead>
                        <TableHead className="w-[90px]">Vencimento</TableHead>
                        <TableHead className="w-[110px] text-right">Valor Planilha</TableHead>
                        <TableHead className="w-[110px] text-right">Valor Sistema</TableHead>
                        <TableHead className="w-[90px]">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {itensFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            Nenhum lançamento encontrado para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        itensFiltrados.map((it) => (
                          <TableRow key={it.id} className="hover:bg-gray-50/80">
                            <TableCell>
                              {it.tipo === 'conferido' && (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-[10px]"
                                >
                                  ✅ Batem
                                </Badge>
                              )}
                              {it.tipo === 'divergente' && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-300 font-medium text-[10px]"
                                >
                                  ⚠️ Divergente
                                </Badge>
                              )}
                              {it.tipo === 'planilha_apenas' && (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-50 text-rose-700 border-rose-300 font-medium text-[10px]"
                                >
                                  ❌ Só Planilha
                                </Badge>
                              )}
                              {it.tipo === 'sistema_apenas' && (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-300 font-medium text-[10px]"
                                >
                                  ➕ Só Sistema
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="font-mono text-[11px] text-gray-600">
                              {it.aba}
                              {it.numLinhaPlanilha ? ` :${it.numLinhaPlanilha}` : ''}
                            </TableCell>

                            <TableCell>
                              <div className="font-semibold text-gray-900">{it.clienteNome}</div>
                              <div className="text-[11px] text-gray-500 line-clamp-1">
                                {it.descricao}
                              </div>

                              {/* Exibição detalhada de divergências */}
                              {it.divergencias.length > 0 && (
                                <div className="mt-1.5 space-y-1 p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-[11px]">
                                  {it.divergencias.map((div, dIdx) => (
                                    <div key={dIdx} className="flex items-center gap-1.5">
                                      <span className="font-semibold text-amber-900">
                                        {div.campo}:
                                      </span>
                                      <span className="text-gray-600">
                                        Planilha: <strong>{div.valorPlanilha}</strong>
                                      </span>
                                      <span className="text-gray-400">⇄</span>
                                      <span className="text-gray-600">
                                        Sistema: <strong>{div.valorSistema}</strong>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="font-mono text-[11px]">
                              {it.documentoNota || <span className="text-gray-400">-</span>}
                            </TableCell>

                            <TableCell className="text-[11px]">
                              {formatDate(it.vencimentoPlanilha || it.vencimentoSistema)}
                            </TableCell>

                            <TableCell className="text-right font-medium">
                              {it.valorPlanilha ? (
                                formatCurrency(it.valorPlanilha)
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-medium">
                              {it.valorSistema ? (
                                formatCurrency(it.valorSistema)
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {it.statusSistema || it.statusPlanilha || 'Aberta'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-[#ECEAE4] bg-[#FAF9F7] flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                disabled={isProcessing}
                className="text-xs"
              >
                Voltar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="text-xs"
            >
              Fechar
            </Button>

            {step === 2 && (
              <Button
                size="sm"
                onClick={handleExecutarConferencia}
                disabled={
                  isProcessing || Object.values(selectedSheets).filter(Boolean).length === 0
                }
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Conferindo...</span>
                  </>
                ) : (
                  <>
                    <span>Conferir Lançamentos</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleImprimirRelatorio}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Relatório</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
