import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import type {
  ContaReceber,
  Cliente,
  PlanoConta,
  CentroCusto,
  CreditoCliente,
  StatusContaReceber,
} from '@/types/erp'
import { ImportadorRecebimentosModal } from '@/components/financeiro/ImportadorRecebimentosModal'
import {
  SeletorParcelas,
  TipoPrazo,
  ItemParcela,
  gerarGradeParcelas,
} from '@/components/financeiro/SeletorParcelas'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import { toast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  CheckCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  ArrowDownLeft,
  FileSpreadsheet,
  Printer,
} from 'lucide-react'

export default function ContasReceber() {
  const { currentEmpresa, canEdit } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contas, setContas] = useState<ContaReceber[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [categorias, setCategorias] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [creditos, setCreditos] = useState<CreditoCliente[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    'Todas' | 'Aberta' | 'Parcial' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado'
  >('Todas')
  const [centroCustoFilter, setCentroCustoFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Drawer Create / Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [clienteId, setClienteId] = useState('')
  const [clienteDepositante, setClienteDepositante] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState<number>(0)
  const [vencimento, setVencimento] = useState('')
  const [parcelas, setParcelas] = useState<number>(1)
  const [prazoSelecionado, setPrazoSelecionado] = useState<TipoPrazo>('mensal')
  const [gradeParcelas, setGradeParcelas] = useState<ItemParcela[]>([])
  const [datasCustomizadasManuais, setDatasCustomizadasManuais] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [nota, setNota] = useState('')
  const [status, setStatus] = useState<
    'Aberta' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado'
  >('Aberta')
  const [observacoes, setObservacoes] = useState('')

  // Settle (Receber) Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false)
  const [settlingConta, setSettlingConta] = useState<ContaReceber | null>(null)
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [valorRecebido, setValorRecebido] = useState<number>(0)
  const [formaRecebimento, setFormaRecebimento] = useState<
    'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' | 'Crédito do Cliente'
  >('Pix')
  const [usarCreditoCliente, setUsarCreditoCliente] = useState(false)
  const [valorCreditoUsado, setValorCreditoUsado] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Read-only Detail Drawer
  const [detailItem, setDetailItem] = useState<ContaReceber | null>(null)

  useRealtime('contas_receber', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return

    try {
      setLoading(true)
      const [crList, cList, pcList, ccList, credList] = await Promise.all([
        pb.collection('contas_receber').getFullList<ContaReceber>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'vencimento',
          expand: 'cliente_id,categoria_id,centro_custo_id',
        }),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}' && (tipo = 'Receita' || tipo = 'Outro')`,
          sort: 'codigo',
        }),
        pb.collection('centros_custos').getFullList<CentroCusto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo',
        }),
        pb.collection('creditos_clientes').getFullList<CreditoCliente>({
          filter: `empresa_id = '${currentEmpresa.id}' && status != 'utilizado'`,
          sort: 'data',
        }),
      ])

      setContas(crList)
      setClientes(cList)
      setCategorias(pcList)
      setCentrosCusto(ccList)
      setCreditos(credList)
      const qNovo = searchParams.get('novo')
      const qId = searchParams.get('id')
      const qAction = searchParams.get('action')
      const qStatus = searchParams.get('status')

      if (qStatus === 'Vencidas') {
        setStatusFilter('Vencida')
      }

      if (qNovo && canEdit) {
        openCreateModal()
      } else if (qId) {
        const found = crList.find((c) => c.id === qId)
        if (found) {
          if (qAction === 'settle' && canEdit && found.status !== 'Recebida') {
            handleOpenSettle(found)
          } else {
            setDetailItem(found)
          }
        }
      }
    } catch (err) {
      console.error('Error loading contas a receber:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  const [centroCustoId, setCentroCustoId] = useState('')

  const openCreateModal = () => {
    const hoje = toInputDate(new Date().toISOString())
    setEditingId(null)
    setClienteId('')
    setClienteDepositante('')
    setCentroCustoId('')
    setDescricao('')
    setCategoriaId(categorias[0]?.id || '')
    setValor(0)
    setVencimento(hoje)
    setParcelas(1)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(hoje, 1, 'mensal', 0))
    setEndereco('')
    setNota('')
    setStatus('Aberta')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (c: ContaReceber) => {
    const venc = toInputDate(c.vencimento)
    const numP = c.parcelas || 1
    setEditingId(c.id)
    setClienteId(c.cliente_id || '')
    setClienteDepositante(c.cliente_depositante || '')
    setCentroCustoId(c.centro_custo_id || '')
    setDescricao(c.descricao)
    setCategoriaId(c.categoria_id || '')
    setValor(c.valor)
    setVencimento(venc)
    setParcelas(numP)
    setPrazoSelecionado('mensal')
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(venc, numP, 'mensal', c.valor))
    setEndereco(c.endereco || '')
    setNota(c.nota || '')
    setStatus(c.status === 'Recebida' ? 'Recebida' : 'Aberta')
    setObservacoes(c.observacoes || '')
    setIsDrawerOpen(true)
  }

  // Handlers para parcelamento com prazos rápidos e datas livres
  const handleChangeVencimentoBase = (novaData: string) => {
    setVencimento(novaData)
    if (!editingId && !datasCustomizadasManuais) {
      setGradeParcelas(gerarGradeParcelas(novaData, parcelas, prazoSelecionado, valor))
    } else if (!editingId && gradeParcelas.length > 0) {
      setGradeParcelas((prev) =>
        prev.map((item, idx) => (idx === 0 ? { ...item, vencimento: novaData } : item)),
      )
    }
  }

  const handleChangeValorTotal = (novoValor: number) => {
    setValor(novoValor)
    if (!editingId && gradeParcelas.length > 0) {
      const n = gradeParcelas.length
      const unit = novoValor > 0 ? Number((novoValor / n).toFixed(2)) : 0
      setGradeParcelas((prev) =>
        prev.map((item, idx) => {
          let v = unit
          if (idx === n - 1 && novoValor > 0) {
            const somaAnt = unit * (n - 1)
            const diff = Number((novoValor - somaAnt).toFixed(2))
            if (diff > 0) v = diff
          }
          return { ...item, valor: v }
        }),
      )
    }
  }

  const handleChangeNumParcelas = (novoNum: number) => {
    setParcelas(novoNum)
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(vencimento, novoNum, prazoSelecionado, valor))
  }

  const handleSelecionarPrazoRapido = (novoPrazo: TipoPrazo) => {
    setPrazoSelecionado(novoPrazo)
    setDatasCustomizadasManuais(false)
    setGradeParcelas(gerarGradeParcelas(vencimento, parcelas, novoPrazo, valor))
  }

  const handleChangeDataParcelaIndividual = (index: number, novaData: string) => {
    setDatasCustomizadasManuais(true)
    setGradeParcelas((prev) => {
      const novaGrade = prev.map((item, idx) =>
        idx === index ? { ...item, vencimento: novaData } : item,
      )
      return novaGrade
    })
    if (index === 0) {
      setVencimento(novaData)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim() || valor <= 0 || !vencimento) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)

      if (editingId) {
        await pb.collection('contas_receber').update(editingId, {
          descricao: descricao.trim(),
          cliente_id: clienteId === 'none' || !clienteId ? null : clienteId,
          cliente_depositante: clienteDepositante.trim() || '',
          categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
          centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
          valor: Number(valor),
          vencimento: new Date(vencimento).toISOString(),
          parcelas: Number(parcelas),
          status: status,
          endereco: endereco.trim(),
          nota: nota.trim(),
          observacoes: observacoes.trim(),
        })
        toast({ title: 'Conta a receber atualizada!' })
      } else {
        const numParcelas = Math.max(1, Number(parcelas))
        const parcelasParaSalvar =
          gradeParcelas.length === numParcelas
            ? gradeParcelas
            : gerarGradeParcelas(vencimento, numParcelas, prazoSelecionado, valor)

        for (let i = 0; i < parcelasParaSalvar.length; i++) {
          const item = parcelasParaSalvar[i]
          const dataVencIso = item.vencimento
            ? new Date(`${item.vencimento}T12:00:00Z`).toISOString()
            : new Date(vencimento).toISOString()

          const parcelValue =
            Number(item.valor) || Number(valor) / (numParcelas > 1 ? numParcelas : 1)

          const desc =
            numParcelas > 1 ? `${descricao.trim()} (${i + 1}/${numParcelas})` : descricao.trim()

          const createdConta = await pb.collection('contas_receber').create<ContaReceber>({
            empresa_id: currentEmpresa!.id,
            descricao: desc,
            cliente_id: clienteId === 'none' || !clienteId ? null : clienteId,
            cliente_depositante: clienteDepositante.trim() || '',
            categoria_id: categoriaId === 'none' || !categoriaId ? null : categoriaId,
            centro_custo_id: centroCustoId === 'none' || !centroCustoId ? null : centroCustoId,
            valor: parcelValue,
            vencimento: dataVencIso,
            parcelas: numParcelas,
            status: status,
            endereco: endereco.trim(),
            nota: nota.trim(),
            observacoes: observacoes.trim(),
            data_recebimento: status === 'Recebimento Antecipado' ? dataVencIso : undefined,
          })

          if (status === 'Recebimento Antecipado' && clienteId && clienteId !== 'none') {
            await pb.collection('creditos_clientes').create({
              empresa_id: currentEmpresa!.id,
              cliente_id: clienteId,
              valor: parcelValue,
              saldo_restante: parcelValue,
              origem: 'Recebimento Antecipado',
              descricao: `Depósito/Adiantamento ref. ${desc}`,
              data: dataVencIso,
              status: 'disponivel',
              referencia_conta_id: createdConta.id,
            })
          }
        }
        toast({ title: 'Conta a receber criada com sucesso!' })
      }

      setIsDrawerOpen(false)
      setSearchParams({})
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar conta', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return
    try {
      await pb.collection('contas_receber').delete(id)
      toast({ title: 'Lançamento excluído com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Crédito disponível para o cliente da conta selecionada para baixa
  const creditosDisponiveisCliente = useMemo(() => {
    if (!settlingConta?.cliente_id) return []
    return creditos.filter((c) => c.cliente_id === settlingConta.cliente_id && c.saldo_restante > 0)
  }, [settlingConta])

  const totalCreditoDisponivelCliente = useMemo(() => {
    return creditosDisponiveisCliente.reduce((sum, c) => sum + (c.saldo_restante || 0), 0)
  }, [creditosDisponiveisCliente])

  const getValorRecebidoEfetivo = (c: ContaReceber) => {
    if (c.status === 'Recebida') {
      return c.valor_recebido && c.valor_recebido > 0 ? c.valor_recebido : c.valor
    }
    return c.valor_recebido || 0
  }

  const getSaldoRestante = (c: ContaReceber) => {
    if (c.status === 'Recebida') return 0
    const jaRecebido = getValorRecebidoEfetivo(c)
    return Math.max(0, (c.valor || 0) - jaRecebido)
  }

  const handleImprimirComprovante = (c: ContaReceber) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900')
    if (!printWindow) {
      toast({
        title: 'Bloqueador de popups ativo',
        description: 'Permita popups para imprimir o comprovante.',
        variant: 'destructive',
      })
      return
    }

    const clienteComprador = c.expand?.cliente_id?.nome || c.descricao || 'Não informado'
    const clienteDepositanteTexto = c.cliente_depositante?.trim() || ''
    const documento = c.nota?.trim() || '—'
    const vencimentoFormatado = formatDate(c.vencimento)
    const valorTotalFormatado = formatCurrency(c.valor)
    const displayStatus = getContaStatusReal(c)
    const recebimentoFormatado = c.data_recebimento ? formatDate(c.data_recebimento) : '—'
    const formaRecebimentoTexto = c.forma_recebimento || '—'
    const centroCustoTexto = c.expand?.centro_custo_id
      ? `${c.expand.centro_custo_id.codigo} - ${c.expand.centro_custo_id.nome}`
      : '—'
    const categoriaTexto = c.expand?.categoria_id?.nome || '—'
    const observacoesTexto = c.observacoes?.trim() || 'Sem observações registradas.'
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const horaEmissao = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante de Conta a Receber - ${documento !== '—' ? documento : c.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #fff;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 {
      margin: 0;
      font-size: 17px;
      color: #0f766e;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header .subtitle {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #4b5563;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header .meta {
      font-size: 11px;
      color: #6b7280;
      text-align: right;
    }
    .badge-status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #d1d5db;
    }
    .badge-recebida {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }
    .badge-aberta {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .badge-vencida {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    .badge-parcial {
      background: #fffbeb;
      color: #b45309;
      border-color: #fde68a;
    }
    .badge-antecipado {
      background: #f0fdfa;
      color: #0f766e;
      border-color: #99f6e4;
    }
    .card-destaque-teal {
      background: #f0fdfa;
      border: 1.5px solid #0d9488;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .card-destaque-teal .titulo-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #0f766e;
      margin-bottom: 2px;
    }
    .card-destaque-teal .nome-depositante {
      font-size: 15px;
      font-weight: 700;
      color: #115e59;
    }
    .card-destaque-teal .aviso {
      font-size: 11px;
      color: #0f766e;
      margin-top: 2px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 20px;
      margin-bottom: 18px;
    }
    .field {
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 6px;
    }
    .field-full {
      grid-column: span 2;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }
    .field-value.mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .field-value.destaque {
      font-size: 17px;
      color: #0f766e;
      font-weight: 800;
    }
    .box-obs {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 6px;
      padding: 10px 12px;
      margin-top: 14px;
    }
    .box-obs .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #78716c;
      margin-bottom: 4px;
    }
    .box-obs .content {
      font-size: 12px;
      color: #44403c;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px dashed #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #9ca3af;
    }
    .assinatura-block {
      margin-top: 48px;
      display: flex;
      justify-content: space-around;
      gap: 30px;
    }
    .linha-assinatura {
      width: 220px;
      border-top: 1px solid #9ca3af;
      padding-top: 4px;
      text-align: center;
      font-size: 11px;
      color: #4b5563;
      font-weight: 600;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>GRUPO PEDREIRA CORDEIRO</h1>
      <div class="subtitle">Comprovante de Conta a Receber / Antecipação</div>
    </div>
    <div class="meta">
      <div>Emissão: ${dataEmissao} às ${horaEmissao}</div>
      <div style="margin-top: 4px;">ID Título: <span style="font-family: monospace;">${c.id}</span></div>
    </div>
  </div>

  ${
    clienteDepositanteTexto
      ? `<div class="card-destaque-teal">
          <div class="titulo-label">Cliente Depositante (Terceiro Pagador Identificado)</div>
          <div class="nome-depositante">${clienteDepositanteTexto}</div>
          <div class="aviso">Depósito/Transferência bancária efetuada por depositante terceiro em favor do cliente comprador.</div>
        </div>`
      : ''
  }

  <div class="grid">
    <div class="field">
      <div class="field-label">Cliente Comprador</div>
      <div class="field-value">${clienteComprador}</div>
    </div>

    <div class="field">
      <div class="field-label">Documento / NF</div>
      <div class="field-value mono">${documento}</div>
    </div>

    <div class="field">
      <div class="field-label">Situação / Status</div>
      <div class="field-value">
        <span class="badge-status ${
          displayStatus === 'Recebida'
            ? 'badge-recebida'
            : displayStatus === 'Vencida'
              ? 'badge-vencida'
              : displayStatus === 'Parcial'
                ? 'badge-parcial'
                : displayStatus === 'Recebimento Antecipado'
                  ? 'badge-antecipado'
                  : 'badge-aberta'
        }">${displayStatus}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-label">Data de Vencimento</div>
      <div class="field-value mono">${vencimentoFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Valor Total do Título</div>
      <div class="field-value destaque mono">${valorTotalFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Data de Recebimento / Baixa</div>
      <div class="field-value mono">${recebimentoFormatado}</div>
    </div>

    <div class="field">
      <div class="field-label">Forma de Recebimento</div>
      <div class="field-value">${formaRecebimentoTexto}</div>
    </div>

    <div class="field">
      <div class="field-label">Centro de Custo</div>
      <div class="field-value">${centroCustoTexto}</div>
    </div>

    ${
      c.endereco
        ? `<div class="field field-full">
            <div class="field-label">Cidade / Endereço</div>
            <div class="field-value">${c.endereco}</div>
          </div>`
        : ''
    }

    <div class="field field-full">
      <div class="field-label">Categoria Contábil</div>
      <div class="field-value">${categoriaTexto}</div>
    </div>
  </div>

  <div class="box-obs">
    <div class="label">Observações / Detalhes</div>
    <div class="content">${observacoesTexto}</div>
  </div>

  <div class="assinatura-block">
    <div class="linha-assinatura">Responsável Financeiro</div>
    <div class="linha-assinatura">Cliente / Depositante</div>
  </div>

  <div class="footer">
    <div>Grupo Pedreira Cordeiro — Sistema ERP de Gestão Integrada</div>
    <div>Página 1 de 1</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleOpenSettle = (conta: ContaReceber) => {
    setSettlingConta(conta)
    setDataRecebimento(toInputDate(new Date().toISOString()))
    const saldo = getSaldoRestante(conta)
    setValorRecebido(saldo > 0 ? saldo : conta.valor)
    setFormaRecebimento('Pix')
    setUsarCreditoCliente(false)
    setValorCreditoUsado(0)
    setSettleModalOpen(true)
  }

  const handleConfirmSettle = async () => {
    if (!settlingConta) return
    const valorBaixa = Number(valorRecebido)
    if (valorBaixa <= 0) {
      toast({ title: 'Informe um valor válido a receber', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const recDateISO = new Date(dataRecebimento).toISOString()

      // Abatimento de crédito se selecionado
      let formaFinal = formaRecebimento
      if (usarCreditoCliente && valorCreditoUsado > 0) {
        formaFinal = 'Crédito do Cliente' as any
        let restanteParaAbater = valorCreditoUsado

        for (const cred of creditosDisponiveisCliente) {
          if (restanteParaAbater <= 0) break
          const abatimento = Math.min(cred.saldo_restante, restanteParaAbater)
          const novoSaldo = cred.saldo_restante - abatimento
          const novoStatus = novoSaldo <= 0.001 ? 'utilizado' : 'parcial'

          await pb.collection('creditos_clientes').update(cred.id, {
            saldo_restante: novoSaldo,
            status: novoStatus,
          })

          restanteParaAbater -= abatimento
        }
      }

      const totalAcumuladoAntes = getValorRecebidoEfetivo(settlingConta)
      const novoTotalRecebido = totalAcumuladoAntes + valorBaixa
      const valorTituloTotal = Number(settlingConta.valor || 0)
      const estaQuitado = novoTotalRecebido >= valorTituloTotal - 0.009
      const novoStatus = estaQuitado ? 'Recebida' : 'Parcial'

      const obsBaixa = ` [Baixa ${novoStatus === 'Recebida' ? 'total' : 'parcial'} de ${formatCurrency(valorBaixa)} em ${formatDate(recDateISO)}${usarCreditoCliente ? ` (Crédito: ${formatCurrency(valorCreditoUsado)})` : ''}]`

      await pb.collection('contas_receber').update(settlingConta.id, {
        status: novoStatus,
        valor_recebido: novoTotalRecebido,
        data_recebimento: recDateISO,
        forma_recebimento: formaFinal,
        observacoes: (settlingConta.observacoes || '') + obsBaixa,
      })

      const clienteNomeTitulo = settlingConta.expand?.cliente_id?.nome || ''
      const rotuloTitulo = settlingConta.descricao
        ? `${settlingConta.descricao}${clienteNomeTitulo ? ` [${clienteNomeTitulo}]` : ''}`
        : clienteNomeTitulo || 'Recebimento'

      await pb.collection('movimentos_financeiros').create({
        empresa_id: currentEmpresa!.id,
        tipo: 'Entrada',
        descricao: `Recebimento${novoStatus === 'Parcial' ? ' parcial' : ''}: ${rotuloTitulo}${usarCreditoCliente ? ' (Compensado via Crédito)' : ''}${settlingConta.expand?.centro_custo_id ? ` [${settlingConta.expand.centro_custo_id.codigo}]` : ''}`,
        valor: valorBaixa,
        data: recDateISO,
        categoria_id: settlingConta.categoria_id || null,
        centro_custo_id: settlingConta.centro_custo_id || null,
        origem: 'ContaReceber',
        referencia_id: settlingConta.id,
        conciliado: false,
      })

      toast({
        title: estaQuitado
          ? 'Título quitado integralmente!'
          : 'Recebimento parcial registrado com sucesso!',
        description: estaQuitado
          ? `Valor recebido: ${formatCurrency(valorBaixa)}`
          : `Recebido: ${formatCurrency(valorBaixa)}. Saldo restante: ${formatCurrency(Math.max(0, valorTituloTotal - novoTotalRecebido))}`,
      })
      setSettleModalOpen(false)
      setSearchParams({})
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao liquidar recebimento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nowISO = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Saldo total em aberto (não vencido)
  const totalAberto = useMemo(() => {
    return contas
      .filter(
        (c) =>
          (c.status === 'Aberta' || c.status === 'Parcial') && c.vencimento.slice(0, 10) >= nowISO,
      )
      .reduce((sum, c) => sum + getSaldoRestante(c), 0)
  }, [contas, nowISO])

  // Saldo total vencido
  const totalVencido = useMemo(() => {
    return contas
      .filter(
        (c) =>
          c.status === 'Vencida' ||
          ((c.status === 'Aberta' || c.status === 'Parcial') && c.vencimento.slice(0, 10) < nowISO),
      )
      .reduce((sum, c) => sum + getSaldoRestante(c), 0)
  }, [contas, nowISO])

  // Total efetivamente recebido de todos os títulos
  const totalRecebido = useMemo(() => {
    return contas.reduce((sum, c) => sum + getValorRecebidoEfetivo(c), 0)
  }, [contas])

  const totalRecebidoMes = useMemo(() => {
    return contas
      .filter((c) => {
        if (!c.data_recebimento) return false
        const d = new Date(c.data_recebimento)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, c) => sum + getValorRecebidoEfetivo(c), 0)
  }, [contas, currentMonth, currentYear])

  const totalAntecipado = useMemo(() => {
    return contas
      .filter((c) => c.status === 'Recebimento Antecipado')
      .reduce((sum, c) => sum + (c.valor || 0), 0)
  }, [contas])

  const getContaStatusReal = (c: ContaReceber): StatusContaReceber => {
    // Decisão permanente v0.0.65: títulos "Aberta" exibem SEMPRE status Aberta (vencida/aberta/próximo de vencer = Aberta).
    // O controle gerencial de atraso é feito visualmente (destaque vermelho/âmbar) e no KPI de Vencidos.
    if (c.status === 'Aberta') return 'Aberta'
    return c.status
  }

  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const isOverdue =
        (c.status === 'Aberta' || c.status === 'Parcial') && c.vencimento.slice(0, 10) < nowISO

      if (statusFilter !== 'Todas') {
        if (statusFilter === 'Aberta') {
          // O filtro "Aberta" inclui tanto títulos a vencer quanto vencidos (decisão do usuário)
          if (c.status !== 'Aberta') return false
        } else if (statusFilter === 'Parcial') {
          if (c.status !== 'Parcial') return false
        } else if (statusFilter === 'Vencida') {
          // Aba Vencida continua permitindo ver apenas títulos em atraso para conveniência
          if (!isOverdue) return false
        } else if (c.status !== statusFilter) {
          return false
        }
      }
      if (centroCustoFilter !== 'todos' && c.centro_custo_id !== centroCustoFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const clienteNome = c.expand?.cliente_id?.nome?.toLowerCase() || ''
        const matchDesc = c.descricao.toLowerCase().includes(q)
        const matchCli = clienteNome.includes(q)
        const matchEnd = (c.endereco || '').toLowerCase().includes(q)
        const matchNota = (c.nota || '').toLowerCase().includes(q)
        if (!matchDesc && !matchCli && !matchEnd && !matchNota) return false
      }
      return true
    })
  }, [contas, statusFilter, centroCustoFilter, searchQuery, nowISO])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Contas a Receber</h1>
          <p className="text-xs text-gray-500">Gestão de faturamento, recebíveis e clientes</p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-teal-700" />
              Importar Planilha XLSX
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Conta a Receber
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Recebido</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalRecebido)}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Aberto</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalAberto)}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Vencido</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 font-mono">
            {formatCurrency(totalVencido)}
          </p>
        </Card>

        <Card className="rounded-2xl border-teal-200 bg-teal-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800 uppercase">
              Recebimento Antecipado
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-teal-900 mt-2 font-mono">
            {formatCurrency(totalAntecipado)}
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(
              [
                'Todas',
                'Aberta',
                'Parcial',
                'Recebida',
                'Vencida',
                'Recebimento Antecipado',
              ] as const
            ).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-[#FAF9F7] text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {st === 'Todas'
                  ? 'Todos os Status'
                  : st === 'Parcial'
                    ? 'Parciais'
                    : st === 'Recebimento Antecipado'
                      ? 'Antecipados'
                      : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={centroCustoFilter} onValueChange={setCentroCustoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Centros</SelectItem>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table / Cards List */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-2.5 px-2.5 whitespace-nowrap">Vencimento</th>
                <th className="py-2.5 px-2.5 min-w-[140px]">Cliente / Pagador</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Cidade</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Forma</th>
                <th className="py-2.5 px-2 whitespace-nowrap">C. Custo</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Valor Total</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Recebido</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Saldo</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-32">Doc / NF</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    Nenhuma conta a receber encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const displayStatus = getContaStatusReal(c)
                  const jaRecebido = getValorRecebidoEfetivo(c)
                  const saldoRestante = getSaldoRestante(c)
                  const nomeCliente = c.expand?.cliente_id?.nome || ''
                  const temDescricao = Boolean(c.descricao && c.descricao.trim())

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailItem(c)}
                      className="hover:bg-teal-50/20 cursor-pointer transition-colors"
                    >
                      {/* Vencimento */}
                      <td className="py-2 px-2.5 font-mono font-medium text-gray-800 whitespace-nowrap text-xs">
                        {formatDate(c.vencimento)}
                      </td>

                      {/* Cliente / Descrição */}
                      <td className="py-2 px-2.5 max-w-[240px]">
                        <div className="flex flex-col">
                          <span
                            className="font-semibold text-gray-900 truncate text-xs"
                            title={nomeCliente || c.descricao || 'Cliente não informado'}
                          >
                            {nomeCliente || (temDescricao ? c.descricao : '—')}
                          </span>
                          {c.cliente_depositante && (
                            <span
                              className="inline-block mt-0.5 max-w-[200px] truncate text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded font-medium border border-teal-100"
                              title={`Depositante: ${c.cliente_depositante}`}
                            >
                              Depositante: {c.cliente_depositante}
                            </span>
                          )}
                          {temDescricao && nomeCliente && (
                            <span
                              className="text-[11px] text-gray-500 truncate mt-0.5"
                              title={c.descricao}
                            >
                              {c.descricao}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cidade / Endereço */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                        {c.endereco ? (
                          <span className="truncate max-w-[100px] inline-block" title={c.endereco}>
                            {c.endereco}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Forma de Recebimento */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                        {c.forma_recebimento ? (
                          <span className="text-gray-700">{c.forma_recebimento}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Centro de Custo */}
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                        {c.expand?.centro_custo_id ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded"
                            title={`${c.expand.centro_custo_id.codigo} - ${c.expand.centro_custo_id.nome}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: c.expand.centro_custo_id.cor || '#0F766E' }}
                            />
                            {c.expand.centro_custo_id.codigo}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Valor Total */}
                      <td className="py-2 px-2.5 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap text-xs">
                        {formatCurrency(c.valor)}
                      </td>

                      {/* Já Recebido */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap text-xs">
                        {jaRecebido > 0 ? (
                          formatCurrency(jaRecebido)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Saldo Restante */}
                      <td className="py-2 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap text-xs">
                        {saldoRestante > 0 ? (
                          <span
                            className={
                              c.vencimento.slice(0, 10) < nowISO && c.status === 'Aberta'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }
                          >
                            {formatCurrency(saldoRestante)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium text-[11px]">Quitado</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {(() => {
                          const isAtrasado =
                            c.vencimento.slice(0, 10) < nowISO &&
                            (c.status === 'Aberta' || c.status === 'Parcial')
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[11px] px-1.5 py-0 leading-tight font-medium ${
                                displayStatus === 'Recebida'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : displayStatus === 'Parcial'
                                    ? isAtrasado
                                      ? 'bg-amber-50 text-red-700 border-red-300 font-semibold'
                                      : 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                    : displayStatus === 'Recebimento Antecipado'
                                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-semibold'
                                      : isAtrasado
                                        ? 'bg-red-50 text-red-700 border-red-300 font-semibold'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {displayStatus}
                            </Badge>
                          )
                        })()}
                      </td>

                      {/* Doc / Nota */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {c.nota ? (
                          <span
                            className="inline-flex items-center justify-center w-28 px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold font-mono text-[11px] border border-gray-200/80 whitespace-nowrap text-center"
                            title={c.nota}
                          >
                            {c.nota}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-28 text-gray-300 text-center font-mono">
                            —
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td
                        className="py-2 px-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && displayStatus !== 'Recebida' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSettle(c)}
                              className="h-6 px-2 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {c.status === 'Parcial' ? 'Amortizar' : 'Receber'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleImprimirComprovante(c)}
                            className="h-6 w-6 p-0 text-teal-700 hover:text-teal-900 hover:bg-teal-50"
                            title="Imprimir Comprovante"
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(c)}
                              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-900"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(c.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição (opcional)</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional — identificador ou detalhe do título"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nota / Documento</Label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex: NF 90566 ou Doc 91721"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Cidade / Endereço</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: PATOS ou SJE"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Cliente</Label>
              <ComboboxPesquisavel
                value={clienteId}
                onChange={setClienteId}
                placeholder="Pesquisar ou selecionar cliente..."
                searchPlaceholder="Digitar nome do cliente..."
                emptyText="Nenhum cliente encontrado."
                className="mt-1"
                options={[
                  { id: 'none', label: 'Nenhum / Não informado' },
                  ...clientes.map((cli) => ({
                    id: cli.id,
                    label: cli.nome,
                    sublabel: cli.cnpj_cpf || cli.cidade || undefined,
                  })),
                ]}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Cliente Depositante (Opcional)
              </Label>
              <Input
                value={clienteDepositante}
                onChange={(e) => setClienteDepositante(e.target.value)}
                placeholder="Ex: Nome da pessoa ou empresa que realizou o depósito"
                list="clientes-depositantes-list"
                className="mt-1"
              />
              <datalist id="clientes-depositantes-list">
                {clientes.map((cli) => (
                  <option key={cli.id} value={cli.nome} />
                ))}
              </datalist>
              <p className="text-[11px] text-gray-500 mt-1">
                Preencha caso o depósito/transferência tenha sido feito por um terceiro diferente do
                cliente comprador.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Centro de Custo</Label>
                <ComboboxPesquisavel
                  value={centroCustoId}
                  onChange={setCentroCustoId}
                  placeholder="Selecione o centro..."
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado."
                  className="mt-1"
                  options={[
                    { id: 'none', label: 'Nenhum / Não alocado' },
                    ...centrosCusto.map((cc) => ({
                      id: cc.id,
                      label: `${cc.codigo} - ${cc.nome}`,
                    })),
                  ]}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Categoria Contábil</Label>
                <ComboboxPesquisavel
                  value={categoriaId}
                  onChange={setCategoriaId}
                  placeholder="Selecione a categoria..."
                  searchPlaceholder="Buscar categoria..."
                  emptyText="Nenhuma categoria encontrada."
                  className="mt-1"
                  options={categorias.map((cat) => ({
                    id: cat.id,
                    label: `${cat.codigo} - ${cat.nome}`,
                    sublabel: cat.tipo,
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={valor || ''}
                  onChange={(e) => handleChangeValorTotal(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  {editingId || parcelas <= 1 ? 'Vencimento *' : '1º Vencimento (Data Base) *'}
                </Label>
                <Input
                  type="date"
                  required
                  value={vencimento}
                  onChange={(e) => handleChangeVencimentoBase(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {!editingId && (
              <SeletorParcelas
                parcelas={parcelas}
                onChangeParcelas={handleChangeNumParcelas}
                prazoSelecionado={prazoSelecionado}
                onSelecionarPrazo={handleSelecionarPrazoRapido}
                listaParcelas={gradeParcelas}
                onChangeDataParcela={handleChangeDataParcelaIndividual}
                valorTotal={valor}
              />
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Situação / Status *</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberta">Aberta (A Receber no Vencimento)</SelectItem>
                  <SelectItem value="Recebida">Recebida (Baixada)</SelectItem>
                  <SelectItem value="Recebimento Antecipado">
                    Recebimento Antecipado (Gera Crédito ao Cliente)
                  </SelectItem>
                  <SelectItem value="Vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
              {status === 'Recebimento Antecipado' && (
                <p className="text-[11px] text-teal-700 mt-1">
                  💡 Um saldo de crédito equivalente será adicionado à conta do cliente para ser
                  abatido em futuras entregas/vendas.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes da cobrança, notas fiscais, contrato..."
                className="mt-1"
              />
            </div>

            <SheetFooter className="pt-4 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setIsDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Título'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Settle (Receber) Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border-[#ECEAE4]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              Registrar Recebimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {settlingConta && (
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <div className="font-semibold text-gray-900 text-sm">
                  {settlingConta.expand?.cliente_id?.nome ||
                    settlingConta.descricao ||
                    'Título a Receber'}
                </div>
                {settlingConta.descricao && settlingConta.expand?.cliente_id?.nome && (
                  <div className="text-gray-500 text-xs">
                    Descrição:{' '}
                    <span className="font-medium text-gray-800">{settlingConta.descricao}</span>
                  </div>
                )}
                <div className="text-gray-500">
                  Cliente:{' '}
                  <span className="font-medium text-gray-800">
                    {settlingConta.expand?.cliente_id?.nome || 'Não informado'}
                  </span>
                  {settlingConta.nota && (
                    <span className="ml-2 font-mono text-[11px] bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">
                      Doc: {settlingConta.nota}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#ECEAE4] text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                      Valor Total
                    </span>
                    <strong className="text-gray-900 font-mono text-xs">
                      {formatCurrency(settlingConta.valor)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold block">
                      Já Recebido
                    </span>
                    <strong className="text-emerald-700 font-mono text-xs">
                      {formatCurrency(getValorRecebidoEfetivo(settlingConta))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">
                      Saldo em Aberto
                    </span>
                    <strong className="text-amber-800 font-mono text-xs">
                      {formatCurrency(getSaldoRestante(settlingConta))}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Data de Recebimento *</Label>
              <Input
                type="date"
                required
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">
                  Valor Desta Baixa (R$) *
                </Label>
                {settlingConta && (
                  <button
                    type="button"
                    onClick={() => {
                      const saldo = getSaldoRestante(settlingConta)
                      setValorRecebido(saldo)
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                  >
                    Quitar Saldo Total (
                    {settlingConta ? formatCurrency(getSaldoRestante(settlingConta)) : ''})
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valorRecebido || ''}
                onChange={(e) => setValorRecebido(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono text-base font-bold text-gray-900"
              />
              {settlingConta && (
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {Number(valorRecebido) < getSaldoRestante(settlingConta) ? (
                    <span className="text-amber-700 font-medium">
                      ⚠️ Baixa parcial: restará um saldo em aberto de{' '}
                      <strong>
                        {formatCurrency(
                          Math.max(0, getSaldoRestante(settlingConta) - Number(valorRecebido)),
                        )}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      ✓ Quitação integral do saldo restante
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Opção: Usar Crédito do Cliente */}
            {totalCreditoDisponivelCliente > 0 && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usarCreditoCliente}
                    onChange={(e) => {
                      const chk = e.target.checked
                      setUsarCreditoCliente(chk)
                      if (chk) {
                        const saldo = settlingConta ? getSaldoRestante(settlingConta) : 0
                        const valorAbater = Math.min(saldo, totalCreditoDisponivelCliente)
                        setValorCreditoUsado(valorAbater)
                        setValorRecebido(valorAbater)
                        setFormaRecebimento('Crédito do Cliente' as any)
                      } else {
                        setValorCreditoUsado(0)
                        setFormaRecebimento('Pix')
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-emerald-950 text-xs">
                    Usar Crédito Disponível deste Cliente (Saldo:{' '}
                    {formatCurrency(totalCreditoDisponivelCliente)})
                  </span>
                </label>

                {usarCreditoCliente && (
                  <div className="space-y-2 pt-1 border-t border-emerald-200">
                    <div>
                      <Label className="text-[11px] text-emerald-900 font-medium">
                        Valor do Crédito a Utilizar (R$):
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        max={Math.min(
                          settlingConta ? getSaldoRestante(settlingConta) : 0,
                          totalCreditoDisponivelCliente,
                        )}
                        value={valorCreditoUsado}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setValorCreditoUsado(val)
                          setValorRecebido(val)
                        }}
                        className="mt-1 font-mono font-bold text-emerald-900 h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-gray-700">Forma de Recebimento</Label>
              <Select value={formaRecebimento} onValueChange={(v: any) => setFormaRecebimento(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="Transferência">Transferência (TED/DOC)</SelectItem>
                  <SelectItem value="Cartão">Cartão de Crédito/Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro em Espécie</SelectItem>
                  <SelectItem value="Crédito do Cliente">
                    Crédito do Cliente (Saldo Antecipado)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setSettleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSettle}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Read-Only Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Detalhes da Conta a Receber
            </SheetTitle>
          </SheetHeader>

          {detailItem && (
            <div className="py-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100 text-center">
                <div>
                  <span className="text-[10px] text-teal-700 font-semibold uppercase block">
                    Valor Total
                  </span>
                  <div className="text-lg font-bold text-teal-950 mt-0.5 tabular-nums">
                    {formatCurrency(detailItem.valor)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 font-semibold uppercase block">
                    Recebido
                  </span>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5 tabular-nums">
                    {formatCurrency(getValorRecebidoEfetivo(detailItem))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-semibold uppercase block">
                    Saldo Restante
                  </span>
                  <div className="text-lg font-bold text-amber-900 mt-0.5 tabular-nums">
                    {formatCurrency(getSaldoRestante(detailItem))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#ECEAE4] pt-4">
                {detailItem.descricao && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Descrição:</span>
                    <span className="font-semibold text-gray-900">{detailItem.descricao}</span>
                  </div>
                )}
                {detailItem.nota && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Nota / Documento:</span>
                    <span className="font-mono font-semibold text-gray-800">{detailItem.nota}</span>
                  </div>
                )}
                {detailItem.endereco && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Cidade / Endereço:</span>
                    <span className="font-medium text-gray-800">{detailItem.endereco}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.cliente_id?.nome || 'Não informado'}
                  </span>
                </div>
                {detailItem.cliente_depositante && (
                  <div className="flex justify-between items-center py-1.5 px-2.5 bg-teal-50/70 border border-teal-200 rounded-lg">
                    <span className="text-teal-800 font-semibold text-[11px]">
                      Cliente Depositante:
                    </span>
                    <span className="font-bold text-teal-950 text-xs">
                      {detailItem.cliente_depositante}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Categoria Contábil:</span>
                  <span className="font-medium text-gray-800">
                    {detailItem.expand?.categoria_id?.nome || 'Geral'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Data de Vencimento:</span>
                  <span className="font-mono text-gray-800">
                    {formatDate(detailItem.vencimento)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Status:</span>
                  <Badge variant="outline">{detailItem.status}</Badge>
                </div>
                {detailItem.data_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Último Recebimento:</span>
                    <span className="font-mono text-emerald-700">
                      {formatDate(detailItem.data_recebimento)}
                    </span>
                  </div>
                )}
                {detailItem.forma_recebimento && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Forma de Recebimento:</span>
                    <span className="text-gray-800">{detailItem.forma_recebimento}</span>
                  </div>
                )}
              </div>

              {detailItem.observacoes && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] mt-4">
                  <span className="font-semibold text-gray-700 block mb-1">
                    Observações e Histórico:
                  </span>
                  <p className="text-gray-600 whitespace-pre-wrap">{detailItem.observacoes}</p>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleImprimirComprovante(detailItem)}
                  className="w-full border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl"
                >
                  <Printer className="w-4 h-4 mr-2 text-teal-700" />
                  Imprimir Comprovante
                </Button>

                {canEdit && detailItem.status !== 'Recebida' && (
                  <Button
                    onClick={() => {
                      const item = detailItem
                      setDetailItem(null)
                      handleOpenSettle(item)
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    {detailItem.status === 'Parcial'
                      ? 'Registrar Nova Baixa / Quitar'
                      : 'Receber Título Agora'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Modal Importador XLSX */}
      <ImportadorRecebimentosModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        empresaId={currentEmpresa?.id || ''}
        clientes={clientes}
        categorias={categorias}
        centrosCusto={centrosCusto}
        contasExistentes={contas}
        onImportComplete={loadData}
      />
    </div>
  )
}
