import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, toInputDate } from '@/lib/formatters'
import { calcularDatasPeriodoRapido, estaDentroDoPeriodo } from '@/lib/periodo'
import FiltroPeriodoBar from '@/components/financeiro/FiltroPeriodoBar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  RelatorioListagemImpressaoModal,
  type ColunaRelatorioImpressao,
  type TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import { RomaneioEntregaImpressaoModal } from '@/components/frotas/RomaneioEntregaImpressaoModal'
import type {
  Venda,
  Cliente,
  Produto,
  Entrega,
  StatusVenda,
  FormaPagamentoVenda,
  TipoEntregaVenda,
} from '@/types/erp'
import { vendasService } from '@/services/vendas'
import { entregasService } from '@/services/entregas'
import {
  historicoService,
  calcularDiffAlteracoes,
  CAMPOS_CONFIG_VENDAS,
} from '@/services/historico'
import {
  calcularConversaoVenda,
  formatarNumeroBR,
  obterDensidadeEfetiva,
  extrairEquivalenciaOriginal,
} from '@/lib/unidades'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  Layers,
  Truck,
  ArrowUpRight,
  Receipt,
  Eye,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Tag,
  Printer,
  Hash,
  Scale,
} from 'lucide-react'

// 5 Produtos padrão da Pedreira Cordeiro
const PRODUTOS_PEDREIRA_PADRAO = [
  'Brita 12',
  'Brita 19',
  'Pedra rachão',
  'Pó de pedra',
  'Cascalhinho',
]

export default function Vendas() {
  const { currentEmpresa, canEdit } = useCompany()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(false)

  // Seleção múltipla para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClienteFilter, setSelectedClienteFilter] = useState('todos')
  const [selectedProdutoFilter, setSelectedProdutoFilter] = useState('todos')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')

  // Filtro de período padrão Contas a Pagar/Receber
  const [opcaoPeriodo, setOpcaoPeriodo] = useState<string>('este_mes')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').inicio
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').fim
  })

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoNome, setProdutoNome] = useState('Brita 12')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [unidade, setUnidade] = useState<'m³' | 'ton' | 'un' | 'viagem'>('m³')
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)
  const [valorTotal, setValorTotal] = useState<number>(0)
  // Desconto
  const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'valor'>('percentual')
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [descontoValor, setDescontoValor] = useState<number>(0)
  // Tipo de Entrega: Frota Própria ou Terceiro
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntregaVenda>('frota_propria')
  const [dataVenda, setDataVenda] = useState(() => toInputDate(new Date().toISOString()))
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoVenda>('Pix')
  const [status, setStatus] = useState<StatusVenda>('Pendente')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [gerarReceberAoSalvar, setGerarReceberAoSalvar] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Diálogo de Confirmação
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive'
    action?: () => Promise<void>
  } | null>(null)

  // Romaneio A4 Impressão (2 vias: Cliente & Empresa)
  const [romaneioModalOpen, setRomaneioModalOpen] = useState(false)
  const [vendaRomaneio, setVendaRomaneio] = useState<Venda | null>(null)

  // Previsão do próximo sequencial (somente leitura na UI)
  const [proximoSequencialPrevisto, setProximoSequencialPrevisto] = useState<string>('')

  // Detalhes da Venda & Entregas Vinculadas Modal
  const [detalheVenda, setDetalheVenda] = useState<Venda | null>(null)

  // Modal para Gerar Conta a Receber individual
  const [modalReceberOpen, setModalReceberOpen] = useState(false)
  const [vendaParaReceber, setVendaParaReceber] = useState<Venda | null>(null)
  const [vencimentoReceber, setVencimentoReceber] = useState(() =>
    toInputDate(new Date().toISOString()),
  )
  const [parcelasReceber, setParcelasReceber] = useState<number>(1)

  // Realtime listeners
  useRealtime('vendas', () => loadData())
  useRealtime('entregas', () => loadData())
  useRealtime('contas_receber', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [vList, cList, pList, eList] = await Promise.all([
        vendasService.listar(currentEmpresa.id),
        pb.collection('clientes').getFullList<Cliente>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('produtos').getFullList<Produto>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        entregasService.listar(currentEmpresa.id),
      ])

      setVendas(vList)
      setClientes(cList)
      setProdutos(pList)
      setEntregas(eList)
    } catch (err) {
      console.error('Erro ao carregar vendas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Produto selecionado no formulário da Venda
  const produtoSelecionado = useMemo(() => {
    return produtos.find((p) => p.id === produtoId) || null
  }, [produtos, produtoId])

  // Cálculo de conversão de unidades (m³ ⇄ ton)
  // Se o produto está cadastrado em tonelada e a venda é em m³, ou vice-versa,
  // converte a quantidade antes de aplicar o preço unitário.
  const conversaoUnidades = useMemo(() => {
    return calcularConversaoVenda({
      quantidade,
      unidadeVenda: unidade,
      unidadeCadastro: produtoSelecionado?.unidade,
      precoUnitario,
      densidade: produtoSelecionado?.densidade,
      nomeProduto: produtoNome,
    })
  }, [quantidade, unidade, produtoSelecionado, precoUnitario, produtoNome])

  // Cálculo de desconto da Venda com base no valor bruto convertido
  const valorBrutoCalc = useMemo(() => {
    return conversaoUnidades.valorBruto
  }, [conversaoUnidades.valorBruto])

  const valorDescontoEfetivo = useMemo(() => {
    if (tipoDesconto === 'percentual') {
      const perc = Math.min(100, Math.max(0, Number(descontoPercentual || 0)))
      return Number(((valorBrutoCalc * perc) / 100).toFixed(2))
    } else {
      const v = Math.max(0, Number(descontoValor || 0))
      return Number(Math.min(valorBrutoCalc, v).toFixed(2))
    }
  }, [valorBrutoCalc, tipoDesconto, descontoPercentual, descontoValor])

  const valorLiquidoCalc = useMemo(() => {
    return Number(Math.max(0, valorBrutoCalc - valorDescontoEfetivo).toFixed(2))
  }, [valorBrutoCalc, valorDescontoEfetivo])

  // Abrir criação
  const openCreateModal = () => {
    setEditingId(null)
    if (currentEmpresa) {
      vendasService
        .obterProximoSequencial(currentEmpresa.id)
        .then((seq) => setProximoSequencialPrevisto(seq))
        .catch(() => setProximoSequencialPrevisto(''))
    } else {
      setProximoSequencialPrevisto('')
    }
    setClienteId(clientes[0]?.id || '')

    // Produto padrão Brita 12
    const pPadrao = produtos.find((p) => p.nome.toLowerCase().includes('brita 12')) || produtos[0]
    setProdutoId(pPadrao?.id || '')
    setProdutoNome(pPadrao?.nome || 'Brita 12')
    setUnidade((pPadrao?.unidade as any) || 'm³')
    const preco = pPadrao?.preco_venda || 95
    setPrecoUnitario(preco)
    setQuantidade(14) // Padrão comum de caçamba (14 m³ / ~20 ton)
    setTipoDesconto('percentual')
    setDescontoPercentual(0)
    setDescontoValor(0)
    setTipoEntrega('frota_propria')
    setValorTotal(Number((14 * preco).toFixed(2)))
    setDataVenda(toInputDate(new Date().toISOString()))
    setFormaPagamento('Pix')
    setStatus('Pendente')
    setNotaFiscal('')
    setObservacoes('')
    setGerarReceberAoSalvar(false)
    setIsDrawerOpen(true)
  }

  const handleAbrirRomaneioVenda = (v: Venda) => {
    setVendaRomaneio(v)
    setRomaneioModalOpen(true)
  }

  // Quando seleciona produto no cadastro de venda
  const handleProdutoChange = (id: string) => {
    setProdutoId(id)
    const prod = produtos.find((p) => p.id === id)
    if (prod) {
      setProdutoNome(prod.nome)
      setUnidade((prod.unidade as any) || 'm³')
      const pUnit = prod.preco_venda || 0
      setPrecoUnitario(pUnit)
    }
  }

  // Atualização dinâmica de quantidade e preço
  const handleQuantidadeChange = (novaQtd: number) => {
    setQuantidade(novaQtd)
  }

  const handlePrecoUnitarioChange = (novoPreco: number) => {
    setPrecoUnitario(novoPreco)
  }

  const handleEdit = (v: Venda) => {
    setEditingId(v.id)
    setProximoSequencialPrevisto(v.sequencial_romaneio || '')
    setClienteId(v.cliente_id || '')
    setProdutoId(v.produto_id || '')
    setProdutoNome(v.produto_nome || '')
    setQuantidade(v.quantidade)
    setUnidade(v.unidade)
    setPrecoUnitario(v.preco_unitario)
    setTipoDesconto(v.tipo_desconto || 'percentual')
    setDescontoPercentual(v.desconto_percentual || 0)
    setDescontoValor(v.valor_desconto || 0)
    setTipoEntrega(v.tipo_entrega || 'frota_propria')
    setValorTotal(v.valor_total)
    setDataVenda(toInputDate(v.data_venda))
    setFormaPagamento(v.forma_pagamento || 'Pix')
    setStatus(v.status)
    setNotaFiscal(v.nota_fiscal || '')
    setObservacoes(v.observacoes || '')
    setGerarReceberAoSalvar(false)
    setIsDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) {
      toast({ title: 'Selecione um cliente cadastrado', variant: 'destructive' })
      return
    }
    if (quantidade <= 0 || precoUnitario <= 0) {
      toast({ title: 'Informe quantidade e preço unitário válidos', variant: 'destructive' })
      return
    }

    // Validações de desconto
    if (tipoDesconto === 'percentual') {
      if (descontoPercentual < 0 || descontoPercentual > 100) {
        toast({
          title: 'Desconto inválido',
          description: 'O desconto percentual deve estar entre 0% e 100%.',
          variant: 'destructive',
        })
        return
      }
    } else {
      if (descontoValor < 0) {
        toast({
          title: 'Desconto inválido',
          description: 'O valor do desconto não pode ser negativo.',
          variant: 'destructive',
        })
        return
      }
      if (descontoValor > valorBrutoCalc) {
        toast({
          title: 'Desconto excede valor bruto',
          description: `O valor do desconto (${formatCurrency(descontoValor)}) não pode ser superior ao valor bruto (${formatCurrency(valorBrutoCalc)}).`,
          variant: 'destructive',
        })
        return
      }
    }

    const valorFinalLiquido = valorLiquidoCalc
    if (valorFinalLiquido <= 0) {
      toast({
        title: 'Valor líquido inválido',
        description: 'O valor líquido da venda deve ser superior a zero.',
        variant: 'destructive',
      })
      return
    }

    const cli = clientes.find((c) => c.id === clienteId)
    const isEdit = Boolean(editingId)
    const tipoEntregaRotulo = tipoEntrega === 'frota_propria' ? 'Frota Própria' : 'Terceiro'

    // Regra: se houver conversão de unidade, a quantidade e a unidade oficiais da venda
    // são gravadas na unidade de cadastro do produto (ex.: toneladas).
    const qtdOficial = conversaoUnidades.precisaConversao
      ? conversaoUnidades.quantidadeConvertida
      : Number(quantidade)
    const unidadeOficial = conversaoUnidades.precisaConversao
      ? (conversaoUnidades.unidadeCadastro as 'm³' | 'ton' | 'un' | 'viagem')
      : unidade

    const textoConversao = conversaoUnidades.precisaConversao
      ? ` [Conversão: ${conversaoUnidades.equivalenciaCard} | ${conversaoUnidades.explicacaoFormula}]`
      : ''

    // Montar observação preservando a equivalência informada pelo usuário (ex: "10 m³ ≈ 14,5 t")
    let observacoesComEquivalencia = observacoes.trim()
    if (conversaoUnidades.precisaConversao && conversaoUnidades.tagObservacao) {
      if (!observacoesComEquivalencia.includes(conversaoUnidades.tagObservacao)) {
        observacoesComEquivalencia = observacoesComEquivalencia
          ? `${observacoesComEquivalencia} ${conversaoUnidades.tagObservacao}`
          : conversaoUnidades.tagObservacao
      }
    }

    setConfirmDialogData({
      title: isEdit ? 'Confirmar alteração da venda' : 'Confirmar gravação da venda',
      description: isEdit
        ? `Deseja atualizar a venda para "${cli?.nome || 'Cliente'}"? Quantidade oficial: ${qtdOficial} ${unidadeOficial}${conversaoUnidades.precisaConversao ? ` (original: ${quantidade} ${unidade})` : ''}. Tipo de Entrega: ${tipoEntregaRotulo}.${textoConversao} Valor Bruto: ${formatCurrency(valorBrutoCalc)}, Desconto: ${formatCurrency(valorDescontoEfetivo)}, Valor Líquido: ${formatCurrency(valorFinalLiquido)}.`
        : `Deseja registrar a nova venda de ${qtdOficial} ${unidadeOficial}${conversaoUnidades.precisaConversao ? ` (informado: ${quantidade} ${unidade})` : ''} de ${produtoNome} para "${cli?.nome || 'Cliente'}" no valor líquido de ${formatCurrency(valorFinalLiquido)}? (${tipoEntregaRotulo})${textoConversao}${tipoEntrega === 'frota_propria' ? ' — Será gerada uma entrega na relação de entregas.' : ''}${valorDescontoEfetivo > 0 ? ` [Desconto: ${formatCurrency(valorDescontoEfetivo)}]` : ''}`,
      confirmLabel: isEdit ? 'Confirmar Alteração' : 'Gravar Venda',
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsSubmitting(true)
          const dataIso = new Date(`${dataVenda}T12:00:00Z`).toISOString()

          const payload = {
            empresa_id: currentEmpresa!.id,
            cliente_id: clienteId,
            produto_id: produtoId || null,
            produto_nome: produtoNome,
            quantidade: Number(qtdOficial),
            unidade: unidadeOficial,
            preco_unitario: Number(precoUnitario),
            valor_bruto: Number(valorBrutoCalc),
            tipo_desconto: valorDescontoEfetivo > 0 ? tipoDesconto : null,
            desconto_percentual:
              valorDescontoEfetivo > 0 && tipoDesconto === 'percentual'
                ? Number(descontoPercentual)
                : null,
            valor_desconto: valorDescontoEfetivo > 0 ? Number(valorDescontoEfetivo) : 0,
            valor_total: Number(valorFinalLiquido),
            tipo_entrega: tipoEntrega,
            data_venda: dataIso,
            forma_pagamento: formaPagamento,
            status,
            nota_fiscal: notaFiscal.trim() || null,
            observacoes: observacoesComEquivalencia || null,
          }

          let vendaSalva: Venda
          let entregaGeradaId: string | null = null

          if (editingId) {
            const vendaAntes = vendas.find((v) => v.id === editingId)
            vendaSalva = await vendasService.atualizar(editingId, payload)

            // Se for Frota Própria e ainda não existir entrega vinculada, criar
            if (tipoEntrega === 'frota_propria') {
              const jaTemEntrega = entregas.some((e) => e.venda_id === editingId)
              if (!jaTemEntrega) {
                const destinoCli = cli?.cidade
                  ? `${cli.nome} - ${cli.cidade}`
                  : cli?.nome || 'Destino cliente'
                const obsEntrega = conversaoUnidades.precisaConversao
                  ? `Entrega gerada da Venda Pedreira #${editingId.slice(0, 8)} (${produtoNome} - ${qtdOficial} ${unidadeOficial} ≡ ${quantidade} ${unidade}). ${conversaoUnidades.tagObservacao}`
                  : `Entrega gerada da Venda Pedreira #${editingId.slice(0, 8)} (${produtoNome} - ${qtdOficial} ${unidadeOficial}).`
                const entregaCriada = await entregasService.criar({
                  empresa_id: currentEmpresa!.id,
                  venda_id: editingId,
                  cliente_id: clienteId,
                  cliente_nome: cli?.nome || 'Cliente',
                  data: dataIso,
                  origem: 'Pedreira Cordeiro - Sertânia/PE',
                  destino: destinoCli,
                  produto_nome: produtoNome,
                  quantidade: Number(qtdOficial),
                  unidade_medida: (unidadeOficial as any) || 'ton',
                  valor_venda: Number(valorFinalLiquido),
                  status: 'pendente',
                  observacoes: obsEntrega,
                })
                entregaGeradaId = entregaCriada.id
              }
            }

            // Histórico de alteração
            if (vendaAntes) {
              const diffs = calcularDiffAlteracoes(
                {
                  ...vendaAntes,
                  cliente_nome: vendaAntes.expand?.cliente_id?.nome || cli?.nome,
                },
                {
                  ...vendaSalva,
                  cliente_nome: cli?.nome,
                },
                CAMPOS_CONFIG_VENDAS,
              )
              await historicoService.registrar({
                empresaId: currentEmpresa!.id,
                colecaoOrigem: 'vendas',
                registroId: editingId,
                acao: 'editar',
                usuarioId: user?.id,
                usuarioNome: user?.name || user?.email || 'Usuário',
                descricao: `Venda #${editingId.slice(0, 8)} atualizada (${formatCurrency(valorFinalLiquido)}) - Cliente: ${cli?.nome || 'Cliente'}. ${tipoEntrega === 'frota_propria' ? 'Frota Própria' : 'Terceiro'}. ${diffs.length > 0 ? `${diffs.length} campo(s) modificado(s).` : 'Sem alteração de campos chave.'}${entregaGeradaId ? ' Entrega criada na relação de entregas.' : ''}`,
                detalhes: {
                  alteracoes: diffs,
                  valor: valorFinalLiquido,
                  extra: {
                    tipo_entrega: tipoEntrega,
                    entrega_id: entregaGeradaId,
                    conversao: conversaoUnidades.precisaConversao
                      ? {
                          tipo: conversaoUnidades.tipoConversao,
                          quantidade_informada: conversaoUnidades.quantidadeInformada,
                          quantidade_convertida: conversaoUnidades.quantidadeConvertida,
                          fator: conversaoUnidades.fatorConversao,
                          formula: conversaoUnidades.explicacaoFormula,
                        }
                      : null,
                  },
                },
              })
            }

            toast({ title: 'Venda atualizada com sucesso!' })
          } else {
            vendaSalva = await vendasService.criar(payload)

            // Quando for Frota Própria: criar o registro de entrega vinculado à venda na relação de Entrega
            if (tipoEntrega === 'frota_propria') {
              const destinoCli = cli?.cidade
                ? `${cli.nome} - ${cli.cidade}`
                : cli?.nome || 'Destino cliente'
              const obsEntrega = conversaoUnidades.precisaConversao
                ? `Entrega gerada automaticamente a partir da Venda Pedreira #${vendaSalva.id.slice(0, 8)} (${produtoNome} - ${qtdOficial} ${unidadeOficial} ≡ ${quantidade} ${unidade}). ${conversaoUnidades.tagObservacao}`
                : `Entrega gerada automaticamente a partir da Venda Pedreira #${vendaSalva.id.slice(0, 8)} (${produtoNome} - ${qtdOficial} ${unidadeOficial}).`
              const entregaCriada = await entregasService.criar({
                empresa_id: currentEmpresa!.id,
                venda_id: vendaSalva.id,
                cliente_id: clienteId,
                cliente_nome: cli?.nome || 'Cliente',
                data: dataIso,
                origem: 'Pedreira Cordeiro - Sertânia/PE',
                destino: destinoCli,
                produto_nome: produtoNome,
                quantidade: Number(qtdOficial),
                unidade_medida: (unidadeOficial as any) || 'ton',
                valor_venda: Number(valorFinalLiquido),
                status: 'pendente',
                observacoes: obsEntrega,
              })
              entregaGeradaId = entregaCriada.id
            }

            // Gravar histórico de criação
            await historicoService.registrar({
              empresaId: currentEmpresa!.id,
              colecaoOrigem: 'vendas',
              registroId: vendaSalva.id,
              acao: 'criar',
              usuarioId: user?.id,
              usuarioNome: user?.name || user?.email || 'Usuário',
              descricao: `Venda registrada no valor líquido de ${formatCurrency(valorFinalLiquido)} (${quantidade} ${unidade} de ${produtoNome}) para "${cli?.nome || 'Cliente'}". Entrega: ${tipoEntrega === 'frota_propria' ? 'Frota Própria (incluída na relação de entrega)' : 'Terceiro (retirada/frete terceiro)'}.`,
              detalhes: {
                valor: valorFinalLiquido,
                extra: {
                  tipo_entrega: tipoEntrega,
                  entrega_id: entregaGeradaId,
                  cliente: cli?.nome,
                  produto: produtoNome,
                  quantidade,
                  unidade,
                  valor_bruto: valorBrutoCalc,
                  valor_desconto: valorDescontoEfetivo,
                  conversao: conversaoUnidades.precisaConversao
                    ? {
                        tipo: conversaoUnidades.tipoConversao,
                        quantidade_informada: conversaoUnidades.quantidadeInformada,
                        quantidade_convertida: conversaoUnidades.quantidadeConvertida,
                        fator: conversaoUnidades.fatorConversao,
                        formula: conversaoUnidades.explicacaoFormula,
                      }
                    : null,
                },
              },
            })

            // Se marcou para gerar Conta a Receber automaticamente
            if (gerarReceberAoSalvar) {
              await criarContaReceberParaVenda(vendaSalva, dataVenda, 1)
            }

            toast({
              title: 'Venda cadastrada com sucesso!',
              description:
                tipoEntrega === 'frota_propria'
                  ? 'Entrega vinculada e incluída na relação de entregas da frota (status: Pendente).'
                  : 'Entrega do tipo Terceiro (sem romaneio de frota própria).',
            })
          }

          setIsDrawerOpen(false)
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao salvar venda',
            description: err.message,
            variant: 'destructive',
          })
        } finally {
          setIsSubmitting(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  // Gerar Conta a Receber vinculada à Venda
  const criarContaReceberParaVenda = async (
    v: Venda,
    dataVencimentoStr: string,
    numParcelas: number,
  ) => {
    try {
      const cli = clientes.find((c) => c.id === v.cliente_id)
      const equivOrig = extrairEquivalenciaOriginal(v.observacoes)
      const sufEquiv = equivOrig ? ` (≡ ${equivOrig})` : ''
      const desc = `Venda ${v.produto_nome || 'Brita'} - ${v.quantidade} ${v.unidade}${sufEquiv} (${cli?.nome || 'Cliente'})`
      const vencIso = new Date(`${dataVencimentoStr}T12:00:00Z`).toISOString()

      // Buscar categoria de receita com brita ou vendas
      const categorias = await pb.collection('plano_contas').getFullList({
        filter: `empresa_id = '${currentEmpresa!.id}' && tipo = 'Receita'`,
      })
      const catVendas =
        categorias.find((c) => c.nome.toLowerCase().includes('venda')) || categorias[0]

      const contaCriada = await pb.collection('contas_receber').create({
        empresa_id: currentEmpresa!.id,
        cliente_id: v.cliente_id || null,
        descricao: desc,
        categoria_id: catVendas?.id || null,
        valor: v.valor_total, // Valor líquido vai para o título e caixa
        valor_bruto: v.valor_bruto || v.valor_total,
        tipo_desconto: v.tipo_desconto || null,
        desconto_percentual: v.desconto_percentual || null,
        valor_desconto: v.valor_desconto || 0,
        vencimento: vencIso,
        parcelas: numParcelas,
        status: v.status === 'Paga' ? 'Recebida' : 'Aberta',
        forma_recebimento: v.forma_pagamento === 'Pix' ? 'Pix' : 'Boleto',
        venda_id: v.id,
        nota: v.nota_fiscal || '',
        observacoes: `Título gerado a partir da Venda Pedreira #${v.id}.${v.valor_desconto && v.valor_desconto > 0 ? ` [Desconto: ${formatCurrency(v.valor_desconto)}]` : ''} ${v.observacoes || ''}`,
      })

      // Atualizar venda gravando o conta_receber_id para rastreabilidade bidirecional
      await vendasService.atualizar(v.id, {
        conta_receber_id: contaCriada.id,
        status: v.status === 'Paga' ? 'Paga' : 'Faturada',
      })

      toast({
        title: 'Conta a Receber gerada!',
        description: `Título de ${formatCurrency(v.valor_total)} criado e vinculado à venda.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar conta a receber',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (v: Venda) => {
    setConfirmDialogData({
      title: 'Confirmar exclusão da venda',
      description: `Deseja realmente remover esta venda de ${v.produto_nome} (${formatCurrency(v.valor_total)})? Esta ação removerá o registro.`,
      confirmLabel: 'Excluir Venda',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          await vendasService.remover(v.id)
          toast({ title: 'Venda excluída com sucesso.' })
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao excluir venda',
            description: err.message,
            variant: 'destructive',
          })
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  // Filtragem
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      if (selectedClienteFilter !== 'todos' && v.cliente_id !== selectedClienteFilter) {
        return false
      }
      if (selectedProdutoFilter !== 'todos') {
        const prodMatch =
          v.produto_id === selectedProdutoFilter ||
          (v.produto_nome &&
            v.produto_nome.toLowerCase().includes(selectedProdutoFilter.toLowerCase()))
        if (!prodMatch) return false
      }
      if (selectedStatusFilter !== 'todos' && v.status !== selectedStatusFilter) {
        return false
      }
      if (!estaDentroDoPeriodo(v.data_venda, dataInicio, dataFim)) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cliNome = v.expand?.cliente_id?.nome?.toLowerCase() || ''
        const prodNome = (v.produto_nome || '').toLowerCase()
        const nf = (v.nota_fiscal || '').toLowerCase()
        return cliNome.includes(q) || prodNome.includes(q) || nf.includes(q)
      }
      return true
    })
  }, [
    vendas,
    selectedClienteFilter,
    selectedProdutoFilter,
    selectedStatusFilter,
    dataInicio,
    dataFim,
    searchQuery,
  ])

  // KPIs do topo
  const kpis = useMemo(() => {
    const totalQtd = filteredVendas.reduce((acc, v) => acc + (v.quantidade || 0), 0)
    const totalFaturado = filteredVendas.reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const pagasTotal = filteredVendas
      .filter((v) => v.status === 'Paga')
      .reduce((acc, v) => acc + (v.valor_total || 0), 0)
    const pendentesTotal = filteredVendas
      .filter((v) => v.status === 'Pendente' || v.status === 'Faturada')
      .reduce((acc, v) => acc + (v.valor_total || 0), 0)

    return {
      totalVendas: filteredVendas.length,
      totalQtd,
      totalFaturado,
      pagasTotal,
      pendentesTotal,
    }
  }, [filteredVendas])

  // Entregas vinculadas à venda selecionada para detalhes
  const entregasDaVenda = useMemo(() => {
    if (!detalheVenda) return []
    return entregas.filter(
      (e) =>
        e.venda_id === detalheVenda.id ||
        (e.cliente_id === detalheVenda.cliente_id &&
          e.data.slice(0, 10) === detalheVenda.data_venda.slice(0, 10)),
    )
  }, [detalheVenda, entregas])

  // Handlers de seleção por checkbox
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredVendas.length && filteredVendas.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredVendas.map((v) => v.id))
    }
  }

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Itens para impressão: selecionados quando houver, senão filtrados
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return filteredVendas.filter((v) => set.has(v.id))
    }
    return filteredVendas
  }, [filteredVendas, selectedIds])

  // Descrição dos filtros aplicados
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (dataInicio || dataFim) {
      const de = dataInicio ? formatDate(dataInicio) : 'Início'
      const ate = dataFim ? formatDate(dataFim) : 'Fim'
      partes.push(`Período: ${de} a ${ate}`)
    } else {
      partes.push('Período: Todas as vendas')
    }
    if (selectedClienteFilter !== 'todos') {
      const c = clientes.find((cli) => cli.id === selectedClienteFilter)
      if (c) partes.push(`Cliente: ${c.nome}`)
    }
    if (selectedProdutoFilter !== 'todos') {
      partes.push(`Produto: ${selectedProdutoFilter}`)
    }
    if (selectedStatusFilter !== 'todos') {
      partes.push(`Status: ${selectedStatusFilter}`)
    }
    if (searchQuery.trim()) {
      partes.push(`Busca: "${searchQuery.trim()}"`)
    }
    if (selectedIds.length > 0) {
      partes.push(`Seleção ativa: ${selectedIds.length} item(ns)`)
    }
    return partes.join(' · ')
  }, [
    dataInicio,
    dataFim,
    selectedClienteFilter,
    clientes,
    selectedProdutoFilter,
    selectedStatusFilter,
    searchQuery,
    selectedIds.length,
  ])

  // Colunas do relatório de vendas
  const colunasRelatorioVendas = useMemo<ColunaRelatorioImpressao<Venda>[]>(() => {
    return [
      {
        key: 'data',
        header: 'Data',
        className: 'font-mono whitespace-nowrap',
        render: (v) => formatDate(v.data_venda),
      },
      {
        key: 'cliente',
        header: 'Cliente / Comprador',
        render: (v) => {
          const cliNome = v.expand?.cliente_id?.nome || 'Cliente não identificado'
          return (
            <div>
              <div className="font-semibold text-gray-900">{cliNome}</div>
              {v.nota_fiscal && (
                <div className="text-[10px] text-gray-500 font-mono">NF: {v.nota_fiscal}</div>
              )}
            </div>
          )
        },
      },
      {
        key: 'produto',
        header: 'Produto',
        render: (v) => v.produto_nome || 'Brita',
      },
      {
        key: 'quantidade',
        header: 'Qtd / Un.',
        align: 'right',
        className: 'font-mono whitespace-nowrap',
        render: (v) => {
          const equiv = extrairEquivalenciaOriginal(v.observacoes)
          return (
            <div>
              <span className="font-bold text-gray-900">{`${v.quantidade} ${v.unidade}`}</span>
              {equiv && <div className="text-[10px] text-teal-700 font-normal">≡ {equiv}</div>}
            </div>
          )
        },
      },
      {
        key: 'preco_unitario',
        header: 'Unitário (R$)',
        align: 'right',
        className: 'font-mono whitespace-nowrap',
        render: (v) => formatCurrency(v.preco_unitario),
      },
      {
        key: 'desconto',
        header: 'Desc. (R$)',
        align: 'right',
        className: 'font-mono text-amber-700 whitespace-nowrap',
        render: (v) =>
          v.valor_desconto && v.valor_desconto > 0 ? formatCurrency(v.valor_desconto) : '—',
      },
      {
        key: 'valor_total',
        header: 'Valor Total (R$)',
        align: 'right',
        className: 'font-mono font-bold text-gray-900 whitespace-nowrap',
        render: (v) => formatCurrency(v.valor_total),
      },
      {
        key: 'tipo_entrega',
        header: 'Entrega',
        render: (v) =>
          v.tipo_entrega === 'terceiro'
            ? 'Terceiro'
            : v.tipo_entrega === 'frota_propria'
              ? 'Frota Própria'
              : '—',
      },
      {
        key: 'forma',
        header: 'Forma Pgto',
        render: (v) => v.forma_pagamento || '—',
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (v) => (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              v.status === 'Paga'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : v.status === 'Faturada'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300'
                  : v.status === 'Cancelada'
                    ? 'bg-red-50 text-red-800 border border-red-300'
                    : 'bg-amber-50 text-amber-900 border border-amber-300'
            }`}
          >
            {v.status}
          </span>
        ),
      },
    ]
  }, [])

  // Totalizadores do relatório de vendas
  const totalizadoresRelatorioVendas = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaQtd = itensParaImpressao.reduce((acc, v) => acc + (v.quantidade || 0), 0)
    const somaDesc = itensParaImpressao.reduce((acc, v) => acc + (v.valor_desconto || 0), 0)
    const somaTotal = itensParaImpressao.reduce((acc, v) => acc + (v.valor_total || 0), 0)

    return [
      {
        label: 'TOTAIS:',
        value: `${itensParaImpressao.length} venda(s)`,
        colSpan: 3,
        align: 'left',
      },
      {
        label: 'Qtd:',
        value: somaQtd.toLocaleString('pt-BR'),
        colSpan: 1,
        align: 'right',
      },
      {
        label: '',
        value: '',
        colSpan: 1,
        align: 'center',
      },
      {
        label: '',
        value: somaDesc > 0 ? formatCurrency(somaDesc) : '—',
        colSpan: 1,
        align: 'right',
        className: 'text-amber-800',
      },
      {
        label: '',
        value: formatCurrency(somaTotal),
        colSpan: 1,
        align: 'right',
        className: 'text-teal-950 font-extrabold',
      },
      {
        label: '',
        value: '',
        colSpan: 3,
        align: 'center',
      },
    ]
  }, [itensParaImpressao])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Gestão de Vendas da Pedreira
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Financeiro Integrado
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cadastro de vendas com amarração direta a Entregas da frota e Contas a Receber
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={openCreateModal}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Venda
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total de Vendas</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">{kpis.totalVendas}</div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            {kpis.totalQtd.toLocaleString('pt-BR')} m³ / ton carregados
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Faturamento Total</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-800 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.totalFaturado)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Volume do período filtrado</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Recebido / Pago</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-900 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.pagasTotal)}
          </div>
          <p className="text-[11px] text-blue-600 mt-0.5">Vendas liquidadas</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              A Receber / Aberto
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-900 mt-2 font-mono tabular-nums">
            {formatCurrency(kpis.pendentesTotal)}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">Pendentes ou faturadas</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente, produto ou nota fiscal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Cliente */}
            <Select value={selectedClienteFilter} onValueChange={setSelectedClienteFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Produto */}
            <Select value={selectedProdutoFilter} onValueChange={setSelectedProdutoFilter}>
              <SelectTrigger className="w-[160px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Produtos</SelectItem>
                {PRODUTOS_PEDREIRA_PADRAO.map((pNome) => (
                  <SelectItem key={pNome} value={pNome}>
                    {pNome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Status */}
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="w-[140px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Faturada">Faturada</SelectItem>
                <SelectItem value="Paga">Paga</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Barra de Filtro de Período padrão Contas a Pagar/Receber */}
        <FiltroPeriodoBar
          rotulo="Data da venda:"
          opcaoPeriodo={opcaoPeriodo}
          onOpcaoChange={setOpcaoPeriodo}
          dataInicio={dataInicio}
          onDataInicioChange={setDataInicio}
          dataFim={dataFim}
          onDataFimChange={setDataFim}
          onImprimir={() => setRelatorioImpressaoOpen(true)}
          totalSelecionados={selectedIds.length}
          mostrarLimpar={
            opcaoPeriodo !== 'todos' ||
            Boolean(dataInicio || dataFim) ||
            selectedClienteFilter !== 'todos' ||
            selectedProdutoFilter !== 'todos' ||
            selectedStatusFilter !== 'todos' ||
            Boolean(searchQuery.trim()) ||
            selectedIds.length > 0
          }
          onLimpar={() => {
            setOpcaoPeriodo('todos')
            setDataInicio('')
            setDataFim('')
            setSelectedClienteFilter('todos')
            setSelectedProdutoFilter('todos')
            setSelectedStatusFilter('todos')
            setSearchQuery('')
            setSelectedIds([])
          }}
        />
      </Card>

      {/* Tabela de Vendas */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-3 text-center w-8">
                  <Checkbox
                    checked={
                      filteredVendas.length > 0 && selectedIds.length === filteredVendas.length
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Selecionar todas as vendas visíveis"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Produto da Pedreira</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4 text-right">Preço Unit.</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4">Romaneio</th>
                <th className="py-3 px-4 text-center">Entrega</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Entregas</th>
                <th className="py-3 px-4 text-center">Receber</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    Carregando vendas...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    Nenhuma venda encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredVendas.map((v) => {
                  const cliNome = v.expand?.cliente_id?.nome || 'Cliente não identificado'
                  const entregasVinculadas = entregas.filter((e) => e.venda_id === v.id)
                  const temContaReceber = !!v.conta_receber_id
                  const isSelected = selectedIds.includes(v.id)
                  const isFrota = v.tipo_entrega !== 'terceiro'

                  return (
                    <tr
                      key={v.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/60 hover:bg-teal-50/80' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(v.id)}
                          aria-label={`Selecionar venda ${v.id}`}
                          className="border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(v.data_venda)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 max-w-[220px] truncate">
                        {cliNome}
                        {v.nota_fiscal && (
                          <span className="block text-[10px] text-gray-400 font-mono">
                            NF: {v.nota_fiscal}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Package className="w-3.5 h-3.5 text-teal-700" />
                          <span>{v.produto_nome || 'Brita'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                        <div>
                          {v.quantidade}{' '}
                          <span className="font-normal text-gray-500">{v.unidade}</span>
                        </div>
                        {extrairEquivalenciaOriginal(v.observacoes) && (
                          <div className="text-[10px] text-teal-700 font-normal">
                            ≡ {extrairEquivalenciaOriginal(v.observacoes)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatCurrency(v.preco_unitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-800 tabular-nums">
                        <div>{formatCurrency(v.valor_total)}</div>
                        {v.valor_desconto && v.valor_desconto > 0 ? (
                          <div className="text-[10px] text-amber-700 font-normal flex items-center justify-end gap-1">
                            <span>Desc: -{formatCurrency(v.valor_desconto)}</span>
                            {v.desconto_percentual ? (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                                {v.desconto_percentual}%
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {v.sequencial_romaneio ? (
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-teal-950 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded shadow-2xs">
                            <Hash className="w-3 h-3 text-teal-700" />
                            <span>{v.sequencial_romaneio}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isFrota ? (
                          <Badge className="bg-teal-100 text-teal-900 border-teal-300 text-[10px] font-semibold flex items-center gap-1 mx-auto w-fit">
                            <Truck className="w-3 h-3 text-teal-700" />
                            Frota Própria
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-gray-100 text-gray-700 border-gray-300 text-[10px] font-semibold mx-auto w-fit"
                          >
                            Terceiro
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={`text-[10px] uppercase font-semibold ${
                            v.status === 'Paga'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : v.status === 'Faturada'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : v.status === 'Cancelada'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {entregasVinculadas.length > 0 ? (
                          <Badge
                            variant="outline"
                            onClick={() => setDetalheVenda(v)}
                            className="cursor-pointer border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 text-[10px]"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            {entregasVinculadas.length} entrega(s)
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {temContaReceber ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px]"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Gerada
                          </Badge>
                        ) : canEdit && v.status !== 'Cancelada' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVendaParaReceber(v)
                              setVencimentoReceber(toInputDate(new Date().toISOString()))
                              setParcelasReceber(1)
                              setModalReceberOpen(true)
                            }}
                            className="h-7 text-[10px] text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 font-semibold"
                          >
                            <Receipt className="w-3 h-3 mr-1" />
                            Gerar Título
                          </Button>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAbrirRomaneioVenda(v)}
                            title="Imprimir Romaneio A4 (2 Vias: Cliente & Empresa)"
                            className="h-7 w-7 text-teal-700 hover:text-teal-900 hover:bg-teal-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetalheVenda(v)}
                            title="Ver detalhes e entregas vinculadas"
                            className="h-7 w-7 text-gray-500 hover:text-teal-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(v)}
                                title="Editar venda"
                                className="h-7 w-7 text-gray-500 hover:text-gray-900"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(v)}
                                title="Excluir venda"
                                className="h-7 w-7 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredVendas.length > 0 && (
              <tfoot className="bg-[#FAF9F7] border-t-2 border-[#ECEAE4] font-bold text-gray-900">
                <tr>
                  <td colSpan={4} className="py-3 px-4">
                    TOTALIZADOR ({filteredVendas.length} vendas)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {kpis.totalQtd.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400">—</td>
                  <td className="py-3 px-4 text-right font-mono text-teal-900 text-sm">
                    {formatCurrency(kpis.totalFaturado)}
                  </td>
                  <td colSpan={5} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Drawer de Cadastro / Edição de Venda */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-[#ECEAE4]">
            <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-700" />
              <span>{editingId ? 'Editar Venda' : 'Nova Venda da Pedreira'}</span>
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            {/* SEQUENCIAL NUMERAL DO ROMANEIO (SOMENTE LEITURA - SEM POSSIBILIDADE DE ALTERAÇÃO) */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <Label className="text-gray-600 block text-[11px] font-semibold uppercase tracking-wider">
                  Nº Sequencial do Romaneio
                </Label>
                <div className="text-[10px] text-gray-500">
                  Gerado automaticamente pelo sistema (imutável)
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-teal-300 rounded-lg shadow-2xs font-mono font-black text-sm text-teal-950">
                <Hash className="w-4 h-4 text-teal-700" />
                <span>
                  {editingId
                    ? proximoSequencialPrevisto || 'RMD-AUTOMÁTICO'
                    : proximoSequencialPrevisto
                      ? `${proximoSequencialPrevisto} (previsto)`
                      : 'RMD-AUTOMÁTICO'}
                </span>
              </div>
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Cliente *</Label>
              <ComboboxPesquisavel
                value={clienteId}
                onChange={setClienteId}
                placeholder="Pesquisar ou selecionar cliente..."
                searchPlaceholder="Digitar nome do cliente..."
                emptyText="Nenhum cliente encontrado."
                triggerClassName="bg-[#FAF9F7] border-[#ECEAE4]"
                options={clientes.map((c) => ({
                  id: c.id,
                  label: c.nome,
                  sublabel: c.cidade || c.cnpj_cpf || undefined,
                }))}
              />
            </div>

            {/* Tipo de Entrega: Frota Própria ou Terceiro */}
            <div className="space-y-1.5 p-3 rounded-xl border border-teal-200 bg-teal-50/40">
              <Label className="text-gray-900 font-semibold flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-teal-700" />
                <span>Tipo de Entrega *</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTipoEntrega('frota_propria')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    tipoEntrega === 'frota_propria'
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Truck
                    className={`w-4 h-4 ${tipoEntrega === 'frota_propria' ? 'text-white' : 'text-teal-700'}`}
                  />
                  <span>Frota Própria</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEntrega('terceiro')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    tipoEntrega === 'terceiro'
                      ? 'bg-gray-800 text-white border-gray-800 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Package
                    className={`w-4 h-4 ${tipoEntrega === 'terceiro' ? 'text-white' : 'text-gray-500'}`}
                  />
                  <span>Terceiro</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                {tipoEntrega === 'frota_propria'
                  ? '• Frota Própria: gerará automaticamente registro na relação de entregas com status Pendente.'
                  : '• Terceiro: cliente retira na pedreira ou frete de terceiro (não entra na relação de entrega).'}
              </p>
            </div>

            {/* Produto da Pedreira */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Produto da Pedreira *</Label>
                <ComboboxPesquisavel
                  value={produtoId}
                  onChange={handleProdutoChange}
                  placeholder="Pesquisar ou selecionar produto..."
                  searchPlaceholder="Digitar produto..."
                  emptyText="Nenhum produto encontrado."
                  triggerClassName="bg-[#FAF9F7] border-[#ECEAE4]"
                  options={produtos.map((p) => ({
                    id: p.id,
                    label: p.nome,
                    sublabel:
                      p.categoria || (p.preco_venda ? formatCurrency(p.preco_venda) : undefined),
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Unidade de Medida</Label>
                <Select value={unidade} onValueChange={(u: any) => setUnidade(u)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³ (Metro Cúbico)</SelectItem>
                    <SelectItem value="ton">ton (Tonelada)</SelectItem>
                    <SelectItem value="viagem">viagem (Carga Fechada)</SelectItem>
                    <SelectItem value="un">un (Unidade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantidade e Preço Unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700 font-medium">Quantidade *</Label>
                  <span className="text-[10px] text-gray-500 font-mono font-semibold">
                    ({unidade})
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantidade}
                  onChange={(e) => handleQuantidadeChange(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700 font-medium">Preço Unitário (R$) *</Label>
                  {produtoSelecionado?.unidade && (
                    <span className="text-[10px] text-teal-800 font-mono font-semibold">
                      (R$/{produtoSelecionado.unidade})
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoUnitario}
                  onChange={(e) => handlePrecoUnitarioChange(parseFloat(e.target.value) || 0)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* CARD TRANSPARENTE DE CONVERSÃO DE UNIDADES SE HOUVER DIVERGÊNCIA */}
            {conversaoUnidades.precisaConversao && (
              <div className="p-3 bg-teal-50/80 rounded-xl border border-teal-200/90 space-y-2 text-xs text-teal-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-teal-700" />
                    <span>Conversão Automática: Valor E Quantidade</span>
                  </span>
                  <Badge className="bg-teal-700 text-white font-mono text-[10px]">
                    Densidade: {formatarNumeroBR(conversaoUnidades.fatorConversao, 2)} t/m³
                  </Badge>
                </div>

                {/* Destaque principal da quantidade convertida */}
                <div className="p-2.5 bg-white rounded-lg border-2 border-teal-400 font-mono text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-teal-950">
                    <span className="text-[11px] uppercase font-bold text-teal-800">
                      Conversão de Quantidade:
                    </span>
                    <span className="text-sm font-extrabold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded">
                      {conversaoUnidades.equivalenciaCard}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-700 flex items-center justify-between">
                    <span>Quantidade oficial gravada:</span>
                    <strong className="text-teal-950 font-bold">
                      {formatarNumeroBR(conversaoUnidades.quantidadeConvertida, 2)}{' '}
                      {conversaoUnidades.unidadeCadastro}
                    </strong>
                  </div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-1 border-t border-teal-100 pt-1">
                    <span>Fórmula:</span>
                    <strong className="text-teal-800">{conversaoUnidades.explicacaoFormula}</strong>
                  </div>
                  <div className="text-[11px] text-teal-900 pt-1 border-t border-teal-100 flex justify-between">
                    <span>Preço equivalente por {unidade}:</span>
                    <strong>
                      R$ {formatarNumeroBR(conversaoUnidades.precoUnitarioEquivalente, 2)}/{unidade}
                    </strong>
                  </div>
                </div>

                <p className="text-[10px] text-teal-900/90 leading-tight">
                  O produto é precificado em <strong>{conversaoUnidades.unidadeCadastro}</strong> e
                  a venda foi informada em <strong>{unidade}</strong>. O sistema converte tanto o{' '}
                  <strong>VALOR</strong> quanto a <strong>QUANTIDADE</strong> (
                  {formatarNumeroBR(conversaoUnidades.quantidadeConvertida, 2)}{' '}
                  {conversaoUnidades.unidadeCadastro}), propagando para Conta a Receber, romaneio e
                  entregas.
                </p>
              </div>
            )}

            {/* Seção de Desconto */}
            <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-xs">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Desconto na Venda</span>
                </div>
                {/* Seletor Tipo: Percentual (%) ou Valor (R$) */}
                <div className="inline-flex rounded-lg border border-amber-300 bg-white p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoDesconto('percentual')
                      if (valorBrutoCalc > 0 && descontoValor > 0) {
                        const perc = Number(((descontoValor / valorBrutoCalc) * 100).toFixed(2))
                        setDescontoPercentual(Math.min(100, perc))
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tipoDesconto === 'percentual'
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoDesconto('valor')
                      if (valorBrutoCalc > 0 && descontoPercentual > 0) {
                        const val = Number(((valorBrutoCalc * descontoPercentual) / 100).toFixed(2))
                        setDescontoValor(Math.min(valorBrutoCalc, val))
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tipoDesconto === 'valor'
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Valor (R$)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                {tipoDesconto === 'percentual' ? (
                  <div className="space-y-1">
                    <Label className="text-gray-700 font-medium text-[11px]">
                      Percentual de Desconto (0–100%)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={descontoPercentual || ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0
                          setDescontoPercentual(v)
                        }}
                        placeholder="0.00"
                        className="bg-white border-amber-300 text-xs h-8 font-mono pr-7"
                      />
                      <Percent className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-gray-700 font-medium text-[11px]">
                      Valor do Desconto (R$)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={valorBrutoCalc}
                        value={descontoValor || ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0
                          setDescontoValor(v)
                        }}
                        placeholder="0,00"
                        className="bg-white border-amber-300 text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="text-right pb-1">
                  <span className="text-[10px] text-gray-500 block uppercase">
                    Desconto Aplicado
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-800">
                    {valorDescontoEfetivo > 0
                      ? `− ${formatCurrency(valorDescontoEfetivo)}`
                      : 'R$ 0,00'}
                  </span>
                </div>
              </div>

              {/* Box de Totais em Tempo Real */}
              <div className="pt-2 border-t border-amber-200/80 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-medium">
                    Valor Bruto
                  </span>
                  <span className="text-xs font-mono font-semibold text-gray-800">
                    {formatCurrency(valorBrutoCalc)}
                  </span>
                </div>
                <div className="bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-800 uppercase block font-medium">
                    Desconto
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900">
                    {valorDescontoEfetivo > 0
                      ? `− ${formatCurrency(valorDescontoEfetivo)}`
                      : 'R$ 0,00'}
                  </span>
                </div>
                <div className="bg-teal-50 p-2 rounded-lg border border-teal-200">
                  <span className="text-[10px] text-teal-800 uppercase block font-bold">
                    Valor Líquido
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-900">
                    {formatCurrency(valorLiquidoCalc)}
                  </span>
                </div>
              </div>
            </div>

            {/* Data e Forma de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Data da Venda *</Label>
                <Input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={(f: any) => setFormaPagamento(f)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferência">Transferência / TED</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="A Prazo">A Prazo / Faturado</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status e Nota Fiscal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Status da Venda *</Label>
                <Select value={status} onValueChange={(s: any) => setStatus(s)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Faturada">Faturada</SelectItem>
                    <SelectItem value="Paga">Paga</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Nota Fiscal / Documento</Label>
                <Input
                  placeholder="Ex: NF-e 1420"
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Checkbox para Gerar Conta a Receber automaticamente se for novo */}
            {!editingId && (
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gerarReceberCheck"
                  checked={gerarReceberAoSalvar}
                  onChange={(e) => setGerarReceberAoSalvar(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                />
                <label
                  htmlFor="gerarReceberCheck"
                  className="text-xs text-teal-900 font-medium cursor-pointer"
                >
                  Gerar Conta a Receber automaticamente no Financeiro
                </label>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-medium">Observações</Label>
              <Textarea
                placeholder="Detalhes adicionais, instrução de descarregamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="bg-[#FAF9F7] border-[#ECEAE4] text-xs"
              />
            </div>

            <SheetFooter className="pt-4 border-t border-[#ECEAE4]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDrawerOpen(false)}
                className="border-[#ECEAE4] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Venda'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal para Gerar Conta a Receber a partir da Venda */}
      <Dialog open={modalReceberOpen} onOpenChange={setModalReceberOpen}>
        <DialogContent className="max-w-md bg-white border-[#ECEAE4] p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-700" />
              <span>Gerar Conta a Receber da Venda</span>
            </DialogTitle>
          </DialogHeader>

          {vendaParaReceber && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-semibold text-gray-900">
                    {vendaParaReceber.expand?.cliente_id?.nome || 'Cliente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Produto:</span>
                  <span className="font-semibold text-gray-900">
                    {vendaParaReceber.produto_nome} ({vendaParaReceber.quantidade}{' '}
                    {vendaParaReceber.unidade})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor do Título:</span>
                  <span className="font-bold text-teal-800 text-sm font-mono">
                    {formatCurrency(vendaParaReceber.valor_total)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Data de Vencimento</Label>
                <Input
                  type="date"
                  value={vencimentoReceber}
                  onChange={(e) => setVencimentoReceber(e.target.value)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium">Número de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={parcelasReceber}
                  onChange={(e) => setParcelasReceber(parseInt(e.target.value) || 1)}
                  className="bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-[#ECEAE4]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReceberOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (vendaParaReceber) {
                  criarContaReceberParaVenda(vendaParaReceber, vencimentoReceber, parcelasReceber)
                  setModalReceberOpen(false)
                }
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              Confirmar e Gerar Título
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Venda & Entregas Vinculadas */}
      <Dialog open={!!detalheVenda} onOpenChange={(open) => !open && setDetalheVenda(null)}>
        <DialogContent className="max-w-2xl bg-white border-[#ECEAE4] p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
          {detalheVenda && (
            <>
              <DialogHeader className="pb-3 border-b border-[#ECEAE4]">
                <DialogTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-teal-700" />
                    <span>Detalhes da Venda #{detalheVenda.id.slice(0, 8)}</span>
                  </div>
                  <Badge className="bg-teal-100 text-teal-900 text-xs">{detalheVenda.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Resumo da Venda */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Nº Romaneio</span>
                    <span className="font-bold font-mono text-teal-900 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-teal-700" />
                      {detalheVenda.sequencial_romaneio || 'RMD-AUTOMÁTICO'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Quantidade Oficial
                    </span>
                    <span className="font-semibold font-mono text-gray-900">
                      {detalheVenda.quantidade} {detalheVenda.unidade}
                    </span>
                    {extrairEquivalenciaOriginal(detalheVenda.observacoes) && (
                      <span className="block text-[10px] text-teal-700 font-normal">
                        ≡ {extrairEquivalenciaOriginal(detalheVenda.observacoes)}
                      </span>
                    )}
                  </div>{' '}
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Produto</span>
                    <span className="font-semibold text-gray-900">{detalheVenda.produto_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Quantidade</span>
                    <span className="font-semibold font-mono text-gray-900">
                      {formatarNumeroBR(detalheVenda.quantidade, 2)} {detalheVenda.unidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Preço Unitário
                    </span>
                    <span className="font-semibold font-mono text-gray-900">
                      {formatCurrency(detalheVenda.preco_unitario)}/{detalheVenda.unidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Valor Bruto</span>
                    <span className="font-semibold font-mono text-gray-900">
                      {formatCurrency(detalheVenda.valor_bruto || detalheVenda.valor_total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Desconto</span>
                    <span className="font-semibold font-mono text-amber-800">
                      {detalheVenda.valor_desconto && detalheVenda.valor_desconto > 0
                        ? `− ${formatCurrency(detalheVenda.valor_desconto)} (${detalheVenda.desconto_percentual ? `${detalheVenda.desconto_percentual}%` : detalheVenda.tipo_desconto === 'percentual' ? '%' : 'R$'})`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-800 block uppercase font-bold">
                      Valor Líquido
                    </span>
                    <span className="font-bold font-mono text-teal-800 text-sm">
                      {formatCurrency(detalheVenda.valor_total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Data</span>
                    <span className="font-mono text-gray-900">
                      {formatDate(detalheVenda.data_venda)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Tipo de Entrega
                    </span>
                    <span className="font-semibold text-gray-900">
                      {detalheVenda.tipo_entrega === 'terceiro'
                        ? 'Terceiro (Retirada/Terceiro)'
                        : 'Frota Própria'}
                    </span>
                  </div>
                </div>

                {detalheVenda.observacoes && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-400 block uppercase font-semibold">
                      Observações
                    </span>
                    <p className="text-gray-700 mt-1">{detalheVenda.observacoes}</p>
                  </div>
                )}

                {/* Seção de Entregas Vinculadas */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                      <Truck className="w-4 h-4 text-teal-700" />
                      <span>Entregas Vinculadas a esta Venda ({entregasDaVenda.length})</span>
                    </div>
                  </div>

                  {entregasDaVenda.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-[#ECEAE4] rounded-xl text-gray-400">
                      Nenhuma entrega da frota vinculada a esta venda ainda.
                      <p className="text-[11px] text-gray-500 mt-1">
                        Cadastre na tela de <strong>Entrega</strong> selecionando esta venda.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-[#ECEAE4] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase">
                          <tr>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Veículo / Placa</th>
                            <th className="py-2 px-3">Motorista</th>
                            <th className="py-2 px-3 text-right">Qtd Entregue</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ECEAE4]">
                          {entregasDaVenda.map((e) => (
                            <tr key={e.id}>
                              <td className="py-2 px-3 font-mono">{formatDate(e.data)}</td>
                              <td className="py-2 px-3 font-semibold text-gray-900">
                                {e.expand?.veiculo_id?.codigo_interno || 'Veículo'} •{' '}
                                {e.expand?.veiculo_id?.placa || e.expand?.veiculo_id?.modelo}
                              </td>
                              <td className="py-2 px-3 text-gray-600">
                                {e.motorista || 'Motorista padrão'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-gray-800">
                                {e.quantidade || 0} {e.unidade_medida || 'm³'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  className={`text-[9px] uppercase ${
                                    e.status === 'concluida'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {e.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#ECEAE4] flex items-center justify-between sm:justify-between w-full">
                <Button
                  type="button"
                  onClick={() => handleAbrirRomaneioVenda(detalheVenda)}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-8 px-3 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Imprimir Romaneio (2 Vias A4)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetalheVenda(null)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação Obrigatório */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4] max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              {confirmDialogData?.title || 'Confirmar ação'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              {confirmDialogData?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isSubmitting} className="text-xs rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async (e) => {
                e.preventDefault()
                if (confirmDialogData?.action) {
                  await confirmDialogData.action()
                }
                setConfirmDialogOpen(false)
              }}
              className={`text-xs rounded-xl text-white ${
                confirmDialogData?.confirmVariant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {isSubmitting ? 'Processando...' : confirmDialogData?.confirmLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal Romaneio A4 (2 Vias: Cliente e Empresa) com sequencial imutável */}
      <RomaneioEntregaImpressaoModal
        venda={vendaRomaneio}
        entrega={
          vendaRomaneio ? entregas.find((e) => e.venda_id === vendaRomaneio.id) || null : null
        }
        empresa={currentEmpresa}
        open={romaneioModalOpen}
        onOpenChange={setRomaneioModalOpen}
      />

      {/* Relatório de Impressão A4 de Vendas */}
      <RelatorioListagemImpressaoModal
        open={relatorioImpressaoOpen}
        onOpenChange={setRelatorioImpressaoOpen}
        titulo="Vendas da Pedreira — Relatório de Itens"
        subtitulo="Demonstrativo de Vendas de Britas, Agregados e Materiais da Pedreira"
        badgeDestaque="Vendas Pedreira"
        empresa={currentEmpresa}
        usuarioNome={user?.name || user?.email || 'Administrador'}
        filtrosDescricao={descricaoFiltrosAplicados}
        itens={itensParaImpressao}
        colunas={colunasRelatorioVendas}
        totais={totalizadoresRelatorioVendas}
        mensagemVazio="Nenhuma venda encontrada para os filtros ou seleção atual."
      />
    </div>
  )
}
