import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Checkbox } from '@/components/ui/checkbox'
import {
  RelatorioListagemImpressaoModal,
  type ColunaRelatorioImpressao,
  type TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import { calcularDatasPeriodoRapido, estaDentroDoPeriodo } from '@/lib/periodo'
import FiltroPeriodoBar from '@/components/financeiro/FiltroPeriodoBar'
import type {
  Entrega,
  Veiculo,
  Funcionario,
  Produto,
  PlanoConta,
  CentroCusto,
  StatusEntrega,
  UnidadeMedidaCarga,
  Abastecimento,
  Venda,
  Cliente,
} from '@/types/erp'
import { normalizarSetorFrota } from '@/lib/frota'
import { entregasService } from '@/services/entregas'
import { vendasService } from '@/services/vendas'
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
  Truck,
  Plus,
  Search,
  Trash2,
  MapPin,
  TrendingUp,
  Receipt,
  Route,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  Layers,
  Sparkles,
  Calculator,
  Navigation,
  Printer,
  DollarSign,
  AlertCircle,
  Link as LinkIcon,
} from 'lucide-react'
import { CidadeInputAutocomplete } from '@/components/frotas/CidadeInputAutocomplete'
import { BlocoKmRota } from '@/components/frotas/BlocoKmRota'
import { BadgeComparativoKm } from '@/components/frotas/BadgeComparativoKm'
import { RomaneioEntregaImpressaoModal } from '@/components/frotas/RomaneioEntregaImpressaoModal'
import {
  converterM3ParaToneladas,
  converterToneladasParaM3,
  sugerirDensidadePorNome,
} from '@/services/produtos'
import {
  calcularDistanciaRotaOSRM,
  COORDENADAS_PEDREIRA_PADRAO,
  buscarCidadesNominatim,
} from '@/services/rotasGeocoding'
import { extrairEquivalenciaOriginal } from '@/lib/unidades'

// Origens frequentes sugeridas na Pedreira
const ORIGENS_SUGERIDAS = [
  'Pedreira Cordeiro (Britador Principal)',
  'Central de Britagem GC',
  'Pátio de Agregados / Estoque',
  'Central de Concreto',
]

// Produtos padrão da pedreira
const PRODUTOS_PEDREIRA_NOMES = [
  'Brita 12',
  'Brita 19',
  'Pedra rachão',
  'Pó de pedra',
  'Cascalhinho',
]

export default function Entregas() {
  const { currentEmpresa, canEdit } = useCompany()
  const { user } = useAuth()

  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [, setLoading] = useState(false)

  // Seleção múltipla para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)

  // Filtros da listagem
  const [selectedVeiculoFilter, setSelectedVeiculoFilter] = useState('todos')
  const [selectedProdutoFilter, setSelectedProdutoFilter] = useState('todos')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Filtro de período padrão Contas a Pagar/Receber
  const [opcaoPeriodo, setOpcaoPeriodo] = useState<string>('este_mes')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').inicio
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').fim
  })

  // Modal de Detalhes da Entrega
  const [selectedEntregaDetalhe, setSelectedEntregaDetalhe] = useState<Entrega | null>(null)

  // Modal de Impressão do Romaneio de Entrega
  const [selectedEntregaImpressao, setSelectedEntregaImpressao] = useState<Entrega | null>(null)

  // Drawer Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingEntregaId, setEditingEntregaId] = useState<string | null>(null)

  // Diálogo de Confirmação Obrigatório
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string
    description: string
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive'
    action?: () => Promise<void>
  } | null>(null)
  const [isProcessandoLote, setIsProcessandoLote] = useState(false)

  // Modal de Alocação Rápida de Frota (para entregas pendentes originadas de vendas)
  const [alocacaoModalOpen, setAlocacaoModalOpen] = useState(false)
  const [entregaParaAlocar, setEntregaParaAlocar] = useState<Entrega | null>(null)
  const [alocarVeiculoId, setAlocarVeiculoId] = useState('')
  const [alocarMotorista, setAlocarMotorista] = useState('')
  const [alocarKmRodado, setAlocarKmRodado] = useState<number>(0)
  const [alocarStatus, setAlocarStatus] = useState<StatusEntrega>('em_transito')
  const [isAlocando, setIsAlocando] = useState(false)
  const [vendaId, setVendaId] = useState<string>('nenhuma')
  const [clienteId, setClienteId] = useState<string>('')
  const [clienteNome, setClienteNome] = useState<string>('')
  const [veiculoId, setVeiculoId] = useState('')
  const [dataEntrega, setDataEntrega] = useState(() => new Date().toISOString().slice(0, 10))
  const [origem, setOrigem] = useState(ORIGENS_SUGERIDAS[0])
  const [destino, setDestino] = useState('')

  // Coordenadas e Km da rota automática (Nominatim + OSRM)
  const [origemCoords, setOrigemCoords] = useState<{ lat: number; lon: number } | null>(
    COORDENADAS_PEDREIRA_PADRAO,
  )
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [kmRotaCalculado, setKmRotaCalculado] = useState<number | null>(null)
  const [duracaoRotaMinutos, setDuracaoRotaMinutos] = useState<number | undefined>(undefined)
  const [carregandoRota, setCarregandoRota] = useState(false)
  const [erroRota, setErroRota] = useState<string | null>(null)

  // Km e Odômetro
  const [modoKm, setModoKm] = useState<'direto' | 'odometro'>('direto')
  const [kmRodado, setKmRodado] = useState<number>(0)
  const [kmInicial, setKmInicial] = useState<number>(0)
  const [kmFinal, setKmFinal] = useState<number>(0)

  // Motorista e Produto
  const [funcionarioId, setFuncionarioId] = useState<string>('')
  const [motoristaNome, setMotoristaNome] = useState('')
  const [produtoId, setProdutoId] = useState<string>('')
  const [produtoNome, setProdutoNome] = useState('')
  const [quantidade, setQuantidade] = useState<number>(0)
  const [unidadeMedida, setUnidadeMedida] = useState<UnidadeMedidaCarga>('m³')

  // Valor da Venda do Produto
  const [usarValorVendaManual, setUsarValorVendaManual] = useState(false)
  const [precoUnitarioVenda, setPrecoUnitarioVenda] = useState<number>(0)
  const [valorVendaManual, setValorVendaManual] = useState<number>(0)

  // Custo & Consumo
  const [usarCustoManual, setUsarCustoManual] = useState(false)
  const [consumoEstimadoKmL, setConsumoEstimadoKmL] = useState<number>(2.8)
  const [precoCombustivelLitro, setPrecoCombustivelLitro] = useState<number>(5.89)
  const [custoManualInformado, setCustoManualInformado] = useState<number>(0)

  // Configurações adicionais
  const [status, setStatus] = useState<StatusEntrega>('concluida')
  const [observacoes, setObservacoes] = useState('')
  const [gerarContaPagar, setGerarContaPagar] = useState(false)
  const [atualizarOdometro, setAtualizarOdometro] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Realtime listeners
  useRealtime('entregas', () => loadData())
  useRealtime('veiculos', () => loadData())
  useRealtime('abastecimentos', () => loadData())
  useRealtime('vendas', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [entList, vList, cList, veList, abList, fnList, prList, pcList, ccList] =
        await Promise.all([
          entregasService.listar(currentEmpresa.id),
          vendasService.listar(currentEmpresa.id),
          pb.collection('clientes').getFullList<Cliente>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
            sort: 'nome',
          }),
          pb.collection('veiculos').getFullList<Veiculo>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
            sort: 'codigo_interno',
          }),
          pb.collection('abastecimentos').getFullList<Abastecimento>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
            sort: '-data',
          }),
          pb.collection('funcionarios').getFullList<Funcionario>({
            filter: `empresa_id = '${currentEmpresa.id}' && status = 'ativo'`,
            sort: 'nome',
          }),
          pb.collection('produtos').getFullList<Produto>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
            sort: 'nome',
          }),
          pb.collection('plano_contas').getFullList<PlanoConta>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
          }),
          pb.collection('centros_custos').getFullList<CentroCusto>({
            filter: `empresa_id = '${currentEmpresa.id}'`,
          }),
        ])

      setEntregas(entList)
      setVendas(vList)
      setClientes(cList)
      setVeiculos(veList)
      setAbastecimentos(abList)
      setFuncionarios(fnList)
      setProdutos(prList)
      setPlanoContas(pcList)
      setCentrosCusto(ccList)
    } catch (err) {
      console.error('Erro ao carregar dados de entregas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Veículo selecionado no formulário
  const currentVeiculo = useMemo(() => {
    return veiculos.find((v) => v.id === veiculoId)
  }, [veiculos, veiculoId])

  // Produto selecionado no formulário
  const currentProduto = useMemo(() => {
    if (produtoId && produtoId !== 'nenhum') {
      return produtos.find((p) => p.id === produtoId) || null
    }
    if (produtoNome) {
      return (
        produtos.find(
          (p) =>
            p.nome.toLowerCase().trim() === produtoNome.toLowerCase().trim() ||
            p.nome.toLowerCase().includes(produtoNome.toLowerCase().trim()),
        ) || null
      )
    }
    return null
  }, [produtos, produtoId, produtoNome])

  // Cálculo da densidade do produto selecionado
  const densidadeProduto = useMemo(() => {
    if (currentProduto?.densidade && currentProduto.densidade > 0) {
      return currentProduto.densidade
    }
    if (produtoNome) {
      return sugerirDensidadePorNome(produtoNome) || 1.5
    }
    return 1.5
  }, [currentProduto, produtoNome])

  // Motoristas da frota
  const motoristasFrota = useMemo(() => {
    return funcionarios.filter(
      (f) => f.setor === 'Frota' || f.cargo.toLowerCase().includes('motorista'),
    )
  }, [funcionarios])

  // Médias globais de abastecimento para fallback
  const mediaCombustivelGeral = useMemo(() => {
    const abComConsumo = abastecimentos.filter((a) => (a.consumo_km_l || 0) > 0)
    const mediaKmL =
      abComConsumo.length > 0
        ? abComConsumo.reduce((acc, a) => acc + (a.consumo_km_l || 0), 0) / abComConsumo.length
        : 2.8

    const abComPreco = abastecimentos.filter((a) => (a.preco_litro || 0) > 0)
    const mediaPreco =
      abComPreco.length > 0
        ? abComPreco.reduce((acc, a) => acc + (a.preco_litro || 0), 0) / abComPreco.length
        : 5.89

    return { mediaKmL: Number(mediaKmL.toFixed(2)), mediaPreco: Number(mediaPreco.toFixed(2)) }
  }, [abastecimentos])

  // Média de consumo apurada especificamente para o veículo selecionado
  const mediaConsumoVeiculo = useMemo(() => {
    if (!veiculoId) return mediaCombustivelGeral.mediaKmL
    const absDoVeiculo = abastecimentos.filter(
      (a) => a.veiculo_id === veiculoId && (a.consumo_km_l || 0) > 0,
    )
    if (absDoVeiculo.length > 0) {
      const soma = absDoVeiculo.reduce((acc, a) => acc + (a.consumo_km_l || 0), 0)
      return Number((soma / absDoVeiculo.length).toFixed(2))
    }
    return mediaCombustivelGeral.mediaKmL
  }, [veiculoId, abastecimentos, mediaCombustivelGeral])

  // Preço do diesel apurado para o veículo ou pedreira
  const precoDieselApurado = useMemo(() => {
    if (!veiculoId) return mediaCombustivelGeral.mediaPreco
    const absDoVeiculo = abastecimentos.filter(
      (a) => a.veiculo_id === veiculoId && (a.preco_litro || 0) > 0,
    )
    if (absDoVeiculo.length > 0) {
      const soma = absDoVeiculo.reduce((acc, a) => acc + (a.preco_litro || 0), 0)
      return Number((soma / absDoVeiculo.length).toFixed(2))
    }
    return mediaCombustivelGeral.mediaPreco
  }, [veiculoId, abastecimentos, mediaCombustivelGeral])

  // Km efetivo rodado
  const kmEfetivo = useMemo(() => {
    if (modoKm === 'odometro') {
      if (kmFinal > kmInicial && kmInicial >= 0) {
        return Number((kmFinal - kmInicial).toFixed(1))
      }
      return 0
    }
    return Number(kmRodado) || 0
  }, [modoKm, kmRodado, kmInicial, kmFinal])

  // Litros estimados
  const litrosCalculados = useMemo(() => {
    if (consumoEstimadoKmL > 0 && kmEfetivo > 0) {
      return Number((kmEfetivo / consumoEstimadoKmL).toFixed(2))
    }
    return 0
  }, [kmEfetivo, consumoEstimadoKmL])

  // Custo estimado final da entrega
  const custoCalculado = useMemo(() => {
    if (usarCustoManual) {
      return Number(custoManualInformado) || 0
    }
    if (kmEfetivo > 0 && consumoEstimadoKmL > 0 && precoCombustivelLitro > 0) {
      return Number(((kmEfetivo / consumoEstimadoKmL) * precoCombustivelLitro).toFixed(2))
    }
    return 0
  }, [usarCustoManual, custoManualInformado, kmEfetivo, consumoEstimadoKmL, precoCombustivelLitro])

  const custoPorKmCalculado = useMemo(() => {
    if (kmEfetivo > 0 && custoCalculado > 0) {
      return Number((custoCalculado / kmEfetivo).toFixed(2))
    }
    return 0
  }, [kmEfetivo, custoCalculado])

  // Cálculo automático do valor de venda da carga
  const calculoVenda = useMemo(() => {
    const qtd = Number(quantidade) || 0
    if (qtd <= 0) {
      return {
        quantidadeBase: 0,
        quantidadeConvertida: 0,
        unidadeOriginal: unidadeMedida,
        unidadePreco: currentProduto?.unidade || 'm³',
        precisaConversao: false,
        densidadeUsada: densidadeProduto,
        precoUnitario: precoUnitarioVenda || 0,
        valorTotal: usarValorVendaManual ? Number(valorVendaManual) || 0 : 0,
        margem: 0,
      }
    }

    if (usarValorVendaManual) {
      const vManual = Number(valorVendaManual) || 0
      return {
        quantidadeBase: qtd,
        quantidadeConvertida: qtd,
        unidadeOriginal: unidadeMedida,
        unidadePreco: currentProduto?.unidade || 'm³',
        precisaConversao: false,
        densidadeUsada: densidadeProduto,
        precoUnitario: precoUnitarioVenda || (qtd > 0 ? vManual / qtd : 0),
        valorTotal: vManual,
        margem: vManual - (Number(custoCalculado) || 0),
      }
    }

    // Se temos preço unitário configurado
    const precoUnit = precoUnitarioVenda > 0 ? precoUnitarioVenda : currentProduto?.preco_venda || 0
    const unidProd = currentProduto?.unidade || 'm³'

    // Casos de conversão:
    // 1. Carga informada em TON, mas produto precificado em M³
    //    m³ = ton / densidade
    if (unidadeMedida === 'ton' && unidProd === 'm³') {
      const qtdEmM3 = converterToneladasParaM3(qtd, densidadeProduto)
      const total = Number((qtdEmM3 * precoUnit).toFixed(2))
      return {
        quantidadeBase: qtd,
        quantidadeConvertida: qtdEmM3,
        unidadeOriginal: 'ton',
        unidadePreco: 'm³',
        precisaConversao: true,
        densidadeUsada: densidadeProduto,
        precoUnitario: precoUnit,
        valorTotal: total,
        margem: total - (Number(custoCalculado) || 0),
      }
    }

    // 2. Carga informada em M³, mas produto precificado em TON
    //    ton = m³ * densidade
    if (unidadeMedida === 'm³' && unidProd === 'ton') {
      const qtdEmTon = converterM3ParaToneladas(qtd, densidadeProduto)
      const total = Number((qtdEmTon * precoUnit).toFixed(2))
      return {
        quantidadeBase: qtd,
        quantidadeConvertida: qtdEmTon,
        unidadeOriginal: 'm³',
        unidadePreco: 'ton',
        precisaConversao: true,
        densidadeUsada: densidadeProduto,
        precoUnitario: precoUnit,
        valorTotal: total,
        margem: total - (Number(custoCalculado) || 0),
      }
    }

    // 3. Mesma unidade ou viagem fechada
    const total = Number((qtd * precoUnit).toFixed(2))
    return {
      quantidadeBase: qtd,
      quantidadeConvertida: qtd,
      unidadeOriginal: unidadeMedida,
      unidadePreco: unidProd,
      precisaConversao: false,
      densidadeUsada: densidadeProduto,
      precoUnitario: precoUnit,
      valorTotal: total,
      margem: total - (Number(custoCalculado) || 0),
    }
  }, [
    quantidade,
    unidadeMedida,
    currentProduto,
    densidadeProduto,
    precoUnitarioVenda,
    usarValorVendaManual,
    valorVendaManual,
    custoCalculado,
  ])

  // Atualiza parâmetros de consumo quando o veículo muda
  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const v = veiculos.find((item) => item.id === vid)
    if (v) {
      const vKmAtual = v.km_atual || v.medidor_atual || 0
      setKmInicial(vKmAtual)
      setKmFinal(vKmAtual > 0 ? vKmAtual + 40 : 0)

      // Se há abastecimentos desse veículo, usa a média dele
      const absDoVeiculo = abastecimentos.filter(
        (a) => a.veiculo_id === vid && (a.consumo_km_l || 0) > 0,
      )
      if (absDoVeiculo.length > 0) {
        const media =
          absDoVeiculo.reduce((acc, a) => acc + (a.consumo_km_l || 0), 0) / absDoVeiculo.length
        setConsumoEstimadoKmL(Number(media.toFixed(2)))
      } else {
        setConsumoEstimadoKmL(mediaCombustivelGeral.mediaKmL)
      }
    }
  }

  // Recalcula rota OSRM entre origem e destino
  const recalcularRota = async (
    coordsOrig?: { lat: number; lon: number } | null,
    coordsDest?: { lat: number; lon: number } | null,
  ) => {
    let pA = coordsOrig !== undefined ? coordsOrig : origemCoords
    let pB = coordsDest !== undefined ? coordsDest : destinoCoords

    // Se origem for texto livre ou unidade da pedreira, tenta usar o ponto da pedreira ou geocodificar
    if (!pA && origem.trim()) {
      const eUnidadePedreira = ORIGENS_SUGERIDAS.some((u) =>
        origem.toLowerCase().includes(u.split('(')[0].trim().toLowerCase()),
      )
      if (eUnidadePedreira || origem.toLowerCase().includes('pedreira')) {
        pA = COORDENADAS_PEDREIRA_PADRAO
        setOrigemCoords(COORDENADAS_PEDREIRA_PADRAO)
      } else {
        const buscou = await buscarCidadesNominatim(origem)
        if (buscou.length > 0) {
          pA = { lat: buscou[0].lat, lon: buscou[0].lon }
          setOrigemCoords(pA)
        }
      }
    }

    // Se destino não tiver coordenadas, tenta resolver via Nominatim
    if (!pB && destino.trim()) {
      const buscou = await buscarCidadesNominatim(destino)
      if (buscou.length > 0) {
        pB = { lat: buscou[0].lat, lon: buscou[0].lon }
        setDestinoCoords(pB)
      }
    }

    if (!pA || !pB) {
      return
    }

    try {
      setCarregandoRota(true)
      setErroRota(null)
      const res = await calcularDistanciaRotaOSRM(pA, pB)
      if (res.sucesso) {
        setKmRotaCalculado(res.distanciaKm)
        setDuracaoRotaMinutos(res.duracaoMinutos)
      } else {
        setKmRotaCalculado(res.distanciaKm || null)
        setErroRota(res.erro || 'Falha ao traçar rota')
      }
    } catch (err: any) {
      console.warn('Erro ao calcular rota:', err)
      setErroRota(err.message || 'Erro ao traçar trajeto')
    } finally {
      setCarregandoRota(false)
    }
  }

  // Preenche o campo de km com o valor calculado pela rota
  const handleUsarKmRota = () => {
    if (!kmRotaCalculado || kmRotaCalculado <= 0) return

    if (modoKm === 'odometro') {
      const finalDerivado = Number(((kmInicial || 0) + kmRotaCalculado).toFixed(1))
      setKmFinal(finalDerivado)
    } else {
      setKmRodado(kmRotaCalculado)
    }

    toast({
      title: 'Quilometragem aplicada!',
      description: `${kmRotaCalculado} km preenchidos com base na rota rodoviária.`,
    })
  }

  // Manipular seleção de venda vinculada
  const handleVendaSelect = (vId: string) => {
    setVendaId(vId)
    if (vId === 'nenhuma') {
      return
    }
    const venda = vendas.find((v) => v.id === vId)
    if (venda) {
      setClienteId(venda.cliente_id || '')
      const cli = clientes.find((c) => c.id === venda.cliente_id)
      const nomeCli = cli?.nome || venda.expand?.cliente_id?.nome || ''
      setClienteNome(nomeCli)

      // Se cliente tiver cidade, sugere no destino
      if (cli?.cidade) {
        setDestino(`${cli.cidade} (${nomeCli})`)
      } else if (nomeCli) {
        setDestino(nomeCli)
      }

      if (venda.produto_id) {
        setProdutoId(venda.produto_id)
      }
      if (venda.produto_nome) {
        setProdutoNome(venda.produto_nome)
      }
      if (venda.quantidade) {
        setQuantidade(venda.quantidade)
      }
      if (venda.unidade === 'm³' || venda.unidade === 'ton' || venda.unidade === 'viagem') {
        setUnidadeMedida(venda.unidade)
      }
      if (venda.preco_unitario) {
        setPrecoUnitarioVenda(venda.preco_unitario)
      }
      if (venda.valor_total) {
        setValorVendaManual(venda.valor_total)
      }
      if (venda.observacoes) {
        setObservacoes(venda.observacoes)
      }
      if (venda.data_venda) {
        setDataEntrega(venda.data_venda.slice(0, 10))
      }
    }
  }

  // Modal de alocação de frota/motorista para entrega pendente vinda da venda
  const openAlocacaoModal = (ent: Entrega) => {
    setEntregaParaAlocar(ent)
    const veiculosEntrega = veiculos.filter(
      (v) => normalizarSetorFrota(v.setor) === 'Entrega' || v.tipo === 'caminhao',
    )
    const veicSugerido = ent.veiculo_id || veiculosEntrega[0]?.id || veiculos[0]?.id || ''
    setAlocarVeiculoId(veicSugerido)
    setAlocarMotorista(ent.motorista || ent.expand?.funcionario_id?.nome || '')
    setAlocarKmRodado(ent.km_rodado || ent.km_rota || 60)
    setAlocarStatus(ent.status === 'pendente' ? 'em_transito' : ent.status)
    setAlocacaoModalOpen(true)
  }

  const handleSalvarAlocacao = async (evt: React.FormEvent) => {
    evt.preventDefault()
    if (!entregaParaAlocar) return
    if (!alocarVeiculoId) {
      toast({ title: 'Selecione um veículo da frota', variant: 'destructive' })
      return
    }

    try {
      setIsAlocando(true)
      const vObj = veiculos.find((veic) => veic.id === alocarVeiculoId)
      const kmFinalNum = Number(alocarKmRodado) || entregaParaAlocar.km_rodado || 0
      const consumoEstimado = entregaParaAlocar.consumo_estimado_km_l || 2.8
      const precoDiesel = entregaParaAlocar.preco_combustivel_litro || precoDieselApurado || 5.89
      const litros = kmFinalNum > 0 && consumoEstimado > 0 ? kmFinalNum / consumoEstimado : null
      const custoCalc = litros && precoDiesel ? Number((litros * precoDiesel).toFixed(2)) : 0

      await entregasService.atualizar(entregaParaAlocar.id, {
        veiculo_id: alocarVeiculoId,
        motorista: alocarMotorista.trim() || null,
        km_rodado: kmFinalNum,
        consumo_estimado_km_l: consumoEstimado,
        preco_combustivel_litro: precoDiesel,
        litros_estimados: litros,
        custo_estimado: custoCalc > 0 ? custoCalc : entregaParaAlocar.custo_estimado || 0,
        status: alocarStatus,
      })

      toast({
        title: 'Alocação confirmada com sucesso!',
        description: `Veículo ${vObj?.codigo_interno || 'alocado'} associado à entrega. Novo status: ${
          alocarStatus === 'em_transito'
            ? 'Em Trânsito'
            : alocarStatus === 'concluida'
              ? 'Concluída'
              : 'Pendente'
        }.`,
      })

      setAlocacaoModalOpen(false)
      setEntregaParaAlocar(null)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao alocar veículo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsAlocando(false)
    }
  }

  // Prepara criação de nova entrega
  const openCreateModal = () => {
    setEditingEntregaId(null)
    setVendaId('nenhuma')
    setClienteId('')
    setClienteNome('')

    // Prioriza caçambas do setor "Entrega"
    const veiculosEntrega = veiculos.filter(
      (v) => normalizarSetorFrota(v.setor) === 'Entrega' || v.tipo === 'caminhao',
    )
    const veicPadrao = veiculosEntrega[0] || veiculos[0]

    const vid = veicPadrao ? veicPadrao.id : ''
    setVeiculoId(vid)
    setDataEntrega(new Date().toISOString().slice(0, 10))
    setOrigem(ORIGENS_SUGERIDAS[0])
    setOrigemCoords(COORDENADAS_PEDREIRA_PADRAO)
    setDestino('')
    setDestinoCoords(null)
    setKmRotaCalculado(null)
    setDuracaoRotaMinutos(undefined)
    setErroRota(null)

    setModoKm('direto')
    setKmRodado(45)

    const kmAtual = veicPadrao?.km_atual || veicPadrao?.medidor_atual || 0
    setKmInicial(kmAtual)
    setKmFinal(kmAtual + 45)

    setFuncionarioId('')
    setMotoristaNome('')
    setProdutoId('')
    setProdutoNome('')
    setQuantidade(14) // padrão 14m³ (caçamba toco/truck)
    setUnidadeMedida('m³')

    setUsarValorVendaManual(false)
    setPrecoUnitarioVenda(0)
    setValorVendaManual(0)

    setUsarCustoManual(false)
    setConsumoEstimadoKmL(mediaConsumoVeiculo || 2.8)
    setPrecoCombustivelLitro(precoDieselApurado || 5.89)
    setCustoManualInformado(0)
    setStatus('concluida')
    setObservacoes('')
    setGerarContaPagar(false)
    setAtualizarOdometro(true)

    setIsDrawerOpen(true)
  }

  const openEditModal = (ent: Entrega) => {
    setEditingEntregaId(ent.id)
    setVendaId(ent.venda_id || 'nenhuma')
    setClienteId(ent.cliente_id || '')
    setClienteNome(ent.cliente_nome || ent.expand?.cliente_id?.nome || '')
    setVeiculoId(ent.veiculo_id)
    setDataEntrega(ent.data ? ent.data.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setOrigem(ent.origem)
    setDestino(ent.destino)
    setKmRotaCalculado(ent.km_rota || null)
    setDuracaoRotaMinutos(undefined)
    setErroRota(null)

    // Define coords iniciais da pedreira se origem for pedreira
    if (ent.origem.toLowerCase().includes('pedreira')) {
      setOrigemCoords(COORDENADAS_PEDREIRA_PADRAO)
    } else {
      setOrigemCoords(null)
    }
    setDestinoCoords(null)

    if (ent.km_inicial !== undefined && ent.km_final !== undefined && (ent.km_final || 0) > 0) {
      setModoKm('odometro')
      setKmInicial(ent.km_inicial || 0)
      setKmFinal(ent.km_final || 0)
    } else {
      setModoKm('direto')
      setKmRodado(ent.km_rodado || 0)
      setKmInicial(ent.km_inicial || 0)
      setKmFinal(ent.km_final || 0)
    }

    setFuncionarioId(ent.funcionario_id || '')
    setMotoristaNome(ent.motorista || '')
    setProdutoId(ent.produto_id || '')
    setProdutoNome(ent.produto_nome || '')
    setQuantidade(ent.quantidade || 0)
    setUnidadeMedida(ent.unidade_medida || 'm³')

    const prodCorrespondente = ent.produto_id
      ? produtos.find((p) => p.id === ent.produto_id)
      : produtos.find((p) => p.nome === ent.produto_nome)

    setPrecoUnitarioVenda(ent.preco_unitario_venda || prodCorrespondente?.preco_venda || 0)
    setValorVendaManual(ent.valor_venda || 0)
    setUsarValorVendaManual(false)

    setConsumoEstimadoKmL(ent.consumo_estimado_km_l || 2.8)
    setPrecoCombustivelLitro(ent.preco_combustivel_litro || 5.89)
    setCustoManualInformado(ent.custo_estimado || 0)
    setUsarCustoManual(false)

    setStatus(ent.status)
    setObservacoes(ent.observacoes || '')
    setGerarContaPagar(false)
    setAtualizarOdometro(false)

    setIsDrawerOpen(true)

    // Se não tiver km_rota salvo, tenta traçar em background
    if (!ent.km_rota) {
      setTimeout(() => {
        recalcularRota()
      }, 500)
    }
  }

  // Preenche dados do motorista a partir do funcionário
  const handleFuncionarioChange = (fid: string) => {
    setFuncionarioId(fid)
    if (fid && fid !== 'nenhum') {
      const func = funcionarios.find((f) => f.id === fid)
      if (func) {
        setMotoristaNome(func.nome)
      }
    } else {
      setFuncionarioId('')
    }
  }

  // Preenche dados do produto a partir do catálogo
  const handleProdutoChange = (pid: string) => {
    setProdutoId(pid)
    if (pid && pid !== 'nenhum') {
      const prod = produtos.find((p) => p.id === pid)
      if (prod) {
        setProdutoNome(prod.nome)
        if (prod.unidade === 'ton' || prod.unidade === 'm³') {
          setUnidadeMedida(prod.unidade)
        }
        if (prod.preco_venda && prod.preco_venda > 0) {
          setPrecoUnitarioVenda(prod.preco_venda)
        }
      }
    } else {
      setProdutoId('')
    }
  }

  // Salvar entrega
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmpresa) return

    if (!veiculoId) {
      toast({ title: 'Selecione o veículo da entrega', variant: 'destructive' })
      return
    }

    if (!origem.trim()) {
      toast({ title: 'Informe a origem da entrega', variant: 'destructive' })
      return
    }

    if (!destino.trim()) {
      toast({ title: 'Informe o destino da entrega', variant: 'destructive' })
      return
    }

    if (kmEfetivo <= 0) {
      toast({ title: 'A quilometragem rodada deve ser maior que zero', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const v = currentVeiculo!

      let contaPagarId: string | null = null

      // 1. Gerar conta a pagar no financeiro se solicitado
      if (gerarContaPagar && custoCalculado > 0) {
        const catCombustivel =
          planoContas.find((pc) => pc.codigo === '2.2') ||
          planoContas.find((pc) => pc.nome.toLowerCase().includes('combust')) ||
          null

        const ccTransporte =
          centrosCusto.find((cc) => cc.codigo === 'CC-02') ||
          centrosCusto.find((cc) => cc.nome.toLowerCase().includes('transporte')) ||
          null

        const cp = await pb.collection('contas_pagar').create({
          empresa_id: currentEmpresa.id,
          fornecedor_id: null,
          descricao: `Custo Combustível Entrega - ${v.codigo_interno} (${origem} ➔ ${destino} - ${kmEfetivo} km)`,
          categoria_id: catCombustivel?.id || null,
          centro_custo_id: ccTransporte?.id || null,
          valor: custoCalculado,
          vencimento: new Date(dataEntrega).toISOString(),
          parcelas: 1,
          status: 'Aberta',
          observacoes: `Gerado automaticamente pelo módulo de Entregas. Carga: ${produtoNome || 'Agregados'} (${quantidade || ''} ${unidadeMedida}). Motorista: ${motoristaNome || 'Não informado'}`,
        })
        contaPagarId = cp.id
      }

      const kmCalculadoInicial = modoKm === 'odometro' ? kmInicial : null
      const kmCalculadoFinal =
        modoKm === 'odometro' ? kmFinal : (v?.km_atual || v?.medidor_atual || 0) + Number(kmEfetivo)

      const vSelected =
        vendaId && vendaId !== 'nenhuma' ? vendas.find((item) => item.id === vendaId) : null

      const payload = {
        empresa_id: currentEmpresa.id,
        veiculo_id: veiculoId,
        venda_id: vSelected ? vSelected.id : null,
        cliente_id: vSelected?.cliente_id || clienteId || null,
        cliente_nome: clienteNome.trim() || vSelected?.expand?.cliente_id?.nome || destino.trim(),
        data: new Date(dataEntrega).toISOString(),
        origem: origem.trim(),
        destino: destino.trim(),
        km_rodado: kmEfetivo,
        km_rota: kmRotaCalculado || null,
        km_inicial: kmCalculadoInicial,
        km_final: kmCalculadoFinal,
        motorista: motoristaNome.trim() || null,
        funcionario_id: funcionarioId || null,
        produto_id: produtoId || null,
        produto_nome: produtoNome.trim() || null,
        quantidade: Number(quantidade) || null,
        unidade_medida: unidadeMedida || null,
        consumo_estimado_km_l: consumoEstimadoKmL || null,
        preco_combustivel_litro: precoCombustivelLitro || null,
        litros_estimados: litrosCalculados || null,
        custo_estimado: custoCalculado,
        custo_por_km: custoPorKmCalculado || null,
        valor_venda: calculoVenda.valorTotal > 0 ? calculoVenda.valorTotal : null,
        preco_unitario_venda: calculoVenda.precoUnitario > 0 ? calculoVenda.precoUnitario : null,
        status,
        conta_pagar_id: contaPagarId,
        observacoes: observacoes.trim() || null,
      }

      if (editingEntregaId) {
        await entregasService.atualizar(editingEntregaId, payload)
        toast({ title: 'Entrega atualizada com sucesso!' })
      } else {
        await entregasService.criar(payload)

        // Atualizar odômetro do veículo se solicitado
        if (atualizarOdometro && kmCalculadoFinal) {
          const odometroAtualVeiculo = v.km_atual || v.medidor_atual || 0
          if (kmCalculadoFinal > odometroAtualVeiculo) {
            await pb.collection('veiculos').update(v.id, {
              km_atual: Number(kmCalculadoFinal),
              medidor_atual: Number(kmCalculadoFinal),
            })
          }
        }

        toast({
          title: 'Entrega registrada com sucesso!',
          description: contaPagarId
            ? 'Conta a pagar gerada no módulo financeiro.'
            : `${kmEfetivo} km registrados para o veículo ${v.codigo_interno}.`,
        })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      console.error('Erro ao salvar entrega:', err)
      toast({
        title: 'Erro ao salvar entrega',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (ent: Entrega) => {
    setConfirmDialogData({
      title: 'Confirmar exclusão da entrega',
      description: `Deseja realmente excluir a entrega de ${ent.origem} para ${ent.destino} (${ent.km_rodado} km)? Esta ação removerá o registro.`,
      confirmLabel: 'Excluir Entrega',
      confirmVariant: 'destructive',
      action: async () => {
        try {
          await entregasService.remover(ent.id)
          toast({ title: 'Entrega removida com sucesso.' })
          await loadData()
        } catch (err: any) {
          toast({
            title: 'Erro ao remover entrega',
            description: err.message,
            variant: 'destructive',
          })
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  // Estatísticas de vendas elegíveis para entrega (idempotente: Frota Própria sem entrega vinculada)
  const estatisticasEnvioLote = useMemo(() => {
    const entregasComVenda = new Set(entregas.filter((e) => e.venda_id).map((e) => e.venda_id!))
    const elegiveis = vendas.filter(
      (v) => (v.tipo_entrega === 'frota_propria' || !v.tipo_entrega) && !entregasComVenda.has(v.id),
    )
    const jaComEntrega = vendas.filter((v) => entregasComVenda.has(v.id))
    const terceiros = vendas.filter((v) => v.tipo_entrega === 'terceiro')
    const valorTotalElegiveis = elegiveis.reduce((acc, v) => acc + (v.valor_total || 0), 0)

    return {
      totalVendas: vendas.length,
      elegiveis,
      qtdElegiveis: elegiveis.length,
      qtdJaComEntrega: jaComEntrega.length,
      qtdTerceiros: terceiros.length,
      valorTotalElegiveis,
    }
  }, [vendas, entregas])

  // Ação em Lote: Enviar todas as vendas elegíveis para entrega
  const handleEnviarTodasVendasParaEntrega = () => {
    const { elegiveis, qtdElegiveis, qtdJaComEntrega, qtdTerceiros, valorTotalElegiveis } =
      estatisticasEnvioLote

    if (qtdElegiveis === 0) {
      toast({
        title: 'Nenhuma venda elegível para entrega',
        description: `Todas as vendas de Frota Própria (${qtdJaComEntrega}) já possuem entrega vinculada. ${qtdTerceiros > 0 ? `${qtdTerceiros} venda(s) de Terceiro são desconsideradas.` : ''}`,
      })
      return
    }

    setConfirmDialogData({
      title: 'Enviar todas as vendas para Entrega?',
      description: `Serão criadas ${qtdElegiveis} entrega(s) pendente(s) no Controle de Entregas & Rotas a partir das vendas de Frota Própria que ainda não possuem entrega vinculada (Total do lote: ${formatCurrency(valorTotalElegiveis)}).\n\n• ${qtdElegiveis} nova(s) entrega(s) pendente(s) serão criadas com cliente, produto, quantidade, valor e veículo/motorista da venda.\n• ${qtdJaComEntrega} venda(s) já possuem entrega vinculada e serão mantidas.\n• ${qtdTerceiros} venda(s) de Terceiro serão ignoradas (não utilizam frota própria).`,
      confirmLabel: `Enviar ${qtdElegiveis} venda(s) para Entrega`,
      confirmVariant: 'default',
      action: async () => {
        try {
          setIsProcessandoLote(true)
          let criadasCount = 0
          const falhas: string[] = []

          for (const venda of elegiveis) {
            try {
              const cli = clientes.find((c) => c.id === venda.cliente_id)
              const destinoCli = cli?.cidade
                ? `${cli.nome} - ${cli.cidade}`
                : cli?.nome || venda.expand?.cliente_id?.nome || 'Destino cliente'
              const nomeCli = cli?.nome || venda.expand?.cliente_id?.nome || 'Cliente'

              const obsEntrega = venda.observacoes
                ? `Entrega gerada em lote a partir da Venda Pedreira #${venda.id.slice(0, 8)} (${venda.produto_nome || 'Material'} - ${venda.quantidade} ${venda.unidade}). ${venda.observacoes}`
                : `Entrega gerada em lote a partir da Venda Pedreira #${venda.id.slice(0, 8)} (${venda.produto_nome || 'Material'} - ${venda.quantidade} ${venda.unidade}).`

              await entregasService.criar({
                empresa_id: currentEmpresa!.id,
                venda_id: venda.id,
                cliente_id: venda.cliente_id || null,
                cliente_nome: nomeCli,
                veiculo_id: venda.veiculo_id || null,
                motorista: venda.motorista || null,
                data: venda.data_venda || new Date().toISOString(),
                origem: 'Pedreira Cordeiro - Sertânia/PE',
                destino: destinoCli,
                produto_nome: venda.produto_nome || 'Material Pedreira',
                quantidade: Number(venda.quantidade) || 0,
                unidade_medida: (venda.unidade as any) || 'ton',
                valor_venda: Number(venda.valor_total) || null,
                status: 'pendente',
                observacoes: obsEntrega,
              })

              // Registrar histórico de alteração na venda
              await pb.collection('historico_alteracoes').create({
                empresa_id: currentEmpresa!.id,
                colecao_origem: 'vendas',
                registro_id: venda.id,
                acao: 'editar',
                usuario_id: user?.id || '',
                usuario_nome: user?.name || user?.email || 'Usuário',
                descricao: `Venda #${venda.id.slice(0, 8)} enviada para a Relação de Entrega via ação em lote (status: Pendente).`,
                detalhes: {
                  acao_em_lote: 'enviar_para_entrega',
                  origem: 'Frotas / Entregas & Rotas',
                  cliente: nomeCli,
                  produto: venda.produto_nome,
                  quantidade: venda.quantidade,
                  unidade: venda.unidade,
                  valor: venda.valor_total,
                },
              })

              criadasCount++
            } catch (itemErr: any) {
              console.error(`Erro ao criar entrega da venda #${venda.id}:`, itemErr)
              falhas.push(`#${venda.id.slice(0, 6)}`)
            }
          }

          await loadData()

          if (falhas.length > 0) {
            toast({
              title: 'Processamento parcial em lote',
              description: `${criadasCount} entrega(s) criada(s) com sucesso. Houve falha em ${falhas.length} venda(s) (${falhas.join(', ')}).`,
              variant: 'destructive',
            })
          } else {
            toast({
              title: 'Envio para Entrega concluído!',
              description: `${criadasCount} entrega(s) pendente(s) criada(s) com sucesso a partir das vendas da frota.`,
            })
          }
        } catch (batchErr: any) {
          toast({
            title: 'Erro no envio em lote',
            description: batchErr.message,
            variant: 'destructive',
          })
        } finally {
          setIsProcessandoLote(false)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  // Handlers de seleção por checkbox
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEntregas.length && filteredEntregas.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEntregas.map((e) => e.id))
    }
  }

  const handleToggleSelectOne = (id: string, evt?: React.MouseEvent) => {
    if (evt) evt.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Filtragem de entregas
  const filteredEntregas = useMemo(() => {
    return entregas.filter((ent) => {
      // Filtro de período padrão
      if (!estaDentroDoPeriodo(ent.data, dataInicio, dataFim)) {
        return false
      }

      // Filtro de veículo
      if (selectedVeiculoFilter !== 'todos' && ent.veiculo_id !== selectedVeiculoFilter) {
        return false
      }

      // Filtro de produto
      if (selectedProdutoFilter !== 'todos') {
        const prodMatch =
          ent.produto_id === selectedProdutoFilter ||
          (ent.produto_nome || '').toLowerCase().includes(selectedProdutoFilter.toLowerCase())
        if (!prodMatch) return false
      }

      // Filtro de status
      if (selectedStatusFilter !== 'todos' && ent.status !== selectedStatusFilter) {
        return false
      }

      // Busca textual livre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const orig = ent.origem.toLowerCase()
        const dest = ent.destino.toLowerCase()
        const mot = (ent.motorista || '').toLowerCase()
        const prod = (ent.produto_nome || '').toLowerCase()
        const veicCod = (ent.expand?.veiculo_id?.codigo_interno || '').toLowerCase()
        const veicMod = (ent.expand?.veiculo_id?.modelo || '').toLowerCase()
        return (
          orig.includes(q) ||
          dest.includes(q) ||
          mot.includes(q) ||
          prod.includes(q) ||
          veicCod.includes(q) ||
          veicMod.includes(q)
        )
      }

      return true
    })
  }, [
    entregas,
    dataInicio,
    dataFim,
    selectedVeiculoFilter,
    selectedProdutoFilter,
    selectedStatusFilter,
    searchQuery,
  ])

  // KPIs calculados sobre os itens filtrados
  const kpis = useMemo(() => {
    const totalEntregas = filteredEntregas.length
    const kmTotal = filteredEntregas.reduce((acc, e) => acc + (e.km_rodado || 0), 0)
    const custoTotal = filteredEntregas.reduce((acc, e) => acc + (e.custo_estimado || 0), 0)
    const vendaTotal = filteredEntregas.reduce((acc, e) => acc + (e.valor_venda || 0), 0)
    const margemTotal = vendaTotal - custoTotal
    const margemPercentual = vendaTotal > 0 ? (margemTotal / vendaTotal) * 100 : 0
    const custoMedioPorKm = kmTotal > 0 ? custoTotal / kmTotal : 0
    const custoMedioPorEntrega = totalEntregas > 0 ? custoTotal / totalEntregas : 0
    const volumeTotal = filteredEntregas.reduce((acc, e) => acc + (e.quantidade || 0), 0)

    return {
      totalEntregas,
      kmTotal,
      custoTotal,
      vendaTotal,
      margemTotal,
      margemPercentual,
      custoMedioPorKm,
      custoMedioPorEntrega,
      volumeTotal,
    }
  }, [filteredEntregas])

  // Resumo por veículo
  const resumoPorVeiculo = useMemo(() => {
    const mapa = new Map<
      string,
      {
        veiculo: Veiculo | undefined
        qtd: number
        km: number
        custo: number
      }
    >()

    filteredEntregas.forEach((e) => {
      const vid = e.veiculo_id
      const atual = mapa.get(vid) || {
        veiculo: e.expand?.veiculo_id || veiculos.find((v) => v.id === vid),
        qtd: 0,
        km: 0,
        custo: 0,
      }
      atual.qtd += 1
      atual.km += e.km_rodado || 0
      atual.custo += e.custo_estimado || 0
      mapa.set(vid, atual)
    })

    return Array.from(mapa.values()).sort((a, b) => b.km - a.km)
  }, [filteredEntregas, veiculos])

  // Rotas mais rodadas (origem ➔ destino)
  const rotasMaisRodadas = useMemo(() => {
    const mapa = new Map<
      string,
      {
        origem: string
        destino: string
        viagens: number
        kmTotal: number
        custoTotal: number
      }
    >()

    filteredEntregas.forEach((e) => {
      const chave = `${e.origem.trim().toLowerCase()}➔${e.destino.trim().toLowerCase()}`
      const atual = mapa.get(chave) || {
        origem: e.origem,
        destino: e.destino,
        viagens: 0,
        kmTotal: 0,
        custoTotal: 0,
      }
      atual.viagens += 1
      atual.kmTotal += e.km_rodado || 0
      atual.custoTotal += e.custo_estimado || 0
      mapa.set(chave, atual)
    })

    return Array.from(mapa.values())
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 5)
  }, [filteredEntregas])

  // Itens para impressão
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return filteredEntregas.filter((e) => set.has(e.id))
    }
    return filteredEntregas
  }, [filteredEntregas, selectedIds])

  // Descrição legível dos filtros aplicados
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (dataInicio || dataFim) {
      const de = dataInicio ? formatDate(dataInicio) : 'Início'
      const ate = dataFim ? formatDate(dataFim) : 'Fim'
      partes.push(`Período: ${de} a ${ate}`)
    } else {
      partes.push('Período: Todas as viagens')
    }
    if (selectedVeiculoFilter !== 'todos') {
      const v = veiculos.find((veic) => veic.id === selectedVeiculoFilter)
      if (v) partes.push(`Veículo: ${v.codigo_interno}`)
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
    selectedVeiculoFilter,
    veiculos,
    selectedProdutoFilter,
    selectedStatusFilter,
    searchQuery,
    selectedIds.length,
  ])

  // Colunas do relatório de entregas
  const colunasRelatorioEntregas = useMemo<ColunaRelatorioImpressao<Entrega>[]>(() => {
    return [
      {
        key: 'data',
        header: 'Data',
        className: 'font-mono whitespace-nowrap',
        render: (e) => formatDate(e.data),
      },
      {
        key: 'rota_cliente',
        header: 'Origem ➔ Destino / Cliente',
        render: (e) => {
          const cli =
            e.cliente_nome ||
            e.expand?.cliente_id?.nome ||
            e.expand?.venda_id?.expand?.cliente_id?.nome
          return (
            <div>
              <div className="font-semibold text-gray-900">
                {e.origem} ➔ {e.destino}
              </div>
              {cli && <div className="text-[10px] text-teal-800 font-medium">Cliente: {cli}</div>}
              {e.motorista && (
                <div className="text-[10px] text-gray-500">Motorista: {e.motorista}</div>
              )}
            </div>
          )
        },
      },
      {
        key: 'veiculo',
        header: 'Veículo',
        render: (e) => {
          const v = e.expand?.veiculo_id
          return (
            <div>
              <span className="font-mono font-bold text-gray-900">{v?.codigo_interno || '—'}</span>
              {v?.placa && <div className="text-[10px] text-gray-500 font-mono">{v.placa}</div>}
            </div>
          )
        },
      },
      {
        key: 'produto_carga',
        header: 'Carga',
        render: (e) => {
          const equiv = extrairEquivalenciaOriginal(e.observacoes)
          return (
            <div>
              <div className="font-semibold text-gray-800">{e.produto_nome || '—'}</div>
              {e.quantidade ? (
                <div className="text-[10px] font-mono text-gray-700 font-bold">
                  {e.quantidade} {e.unidade_medida || 'ton'}
                  {equiv && (
                    <span className="block text-[9px] font-normal text-teal-700">≡ {equiv}</span>
                  )}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        key: 'km',
        header: 'Km',
        align: 'right',
        className: 'font-mono font-bold whitespace-nowrap',
        render: (e) => `${(e.km_rodado || 0).toLocaleString('pt-BR')} km`,
      },
      {
        key: 'venda',
        header: 'Venda (R$)',
        align: 'right',
        className: 'font-mono text-emerald-800 whitespace-nowrap',
        render: (e) => (e.valor_venda && e.valor_venda > 0 ? formatCurrency(e.valor_venda) : '—'),
      },
      {
        key: 'custo',
        header: 'Custo Comb. (R$)',
        align: 'right',
        className: 'font-mono text-red-600 whitespace-nowrap',
        render: (e) =>
          e.custo_estimado && e.custo_estimado > 0 ? formatCurrency(e.custo_estimado) : '—',
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (e) => (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              e.status === 'concluida'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : e.status === 'em_transito'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {e.status === 'concluida'
              ? 'Concluída'
              : e.status === 'em_transito'
                ? 'Em Trânsito'
                : 'Cancelada'}
          </span>
        ),
      },
    ]
  }, [])

  // Totalizadores
  const totalizadoresRelatorioEntregas = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaKm = itensParaImpressao.reduce((acc, e) => acc + (e.km_rodado || 0), 0)
    const somaVenda = itensParaImpressao.reduce((acc, e) => acc + (e.valor_venda || 0), 0)
    const somaCusto = itensParaImpressao.reduce((acc, e) => acc + (e.custo_estimado || 0), 0)

    return [
      {
        label: 'TOTAIS:',
        value: `${itensParaImpressao.length} viagem(ns)`,
        colSpan: 4,
        align: 'left',
      },
      {
        label: 'Km:',
        value: `${somaKm.toLocaleString('pt-BR')} km`,
        colSpan: 1,
        align: 'right',
      },
      {
        label: '',
        value: somaVenda > 0 ? formatCurrency(somaVenda) : '—',
        colSpan: 1,
        align: 'right',
        className: 'text-emerald-800',
      },
      {
        label: '',
        value: somaCusto > 0 ? formatCurrency(somaCusto) : '—',
        colSpan: 1,
        align: 'right',
        className: 'text-red-700',
      },
      {
        label: '',
        value: '',
        colSpan: 1,
        align: 'center',
      },
    ]
  }, [itensParaImpressao])

  return (
    <div className="space-y-6">
      {/* Header com Título e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Controle de Entregas & Rotas
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">
              Cálculo Automático Km & Custo
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Registro de origem, destino, km rodado e apuração precisa do custo de combustível da
            frota
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                isProcessandoLote || isSubmitting || estatisticasEnvioLote.qtdElegiveis === 0
              }
              onClick={handleEnviarTodasVendasParaEntrega}
              className={`rounded-xl text-xs font-semibold h-9 transition-colors ${
                estatisticasEnvioLote.qtdElegiveis > 0
                  ? 'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:text-teal-900 shadow-2xs'
                  : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              }`}
              title={
                estatisticasEnvioLote.qtdElegiveis > 0
                  ? `Enviar ${estatisticasEnvioLote.qtdElegiveis} venda(s) de frota própria pendente(s) para a Relação de Entrega`
                  : 'Nenhuma venda de frota própria sem entrega cadastrada'
              }
            >
              <Truck className="w-4 h-4 mr-1.5 text-teal-700" />
              Enviar todas para Entrega
              {estatisticasEnvioLote.qtdElegiveis > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-200 text-teal-900 font-bold font-mono">
                  {estatisticasEnvioLote.qtdElegiveis}
                </span>
              )}
            </Button>

            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Lançar Nova Entrega
            </Button>
          </div>
        )}
      </div>

      {/* Banner Informativo sobre Vendas Pendentes de Envio para Entrega */}
      {canEdit && estatisticasEnvioLote.qtdElegiveis > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                {estatisticasEnvioLote.qtdElegiveis} venda(s) de Frota Própria aguardam inclusão na
                Entrega
              </p>
              <p className="text-[11px] text-amber-800">
                Clique no botão para criar as entregas pendentes em lote (
                {estatisticasEnvioLote.qtdJaComEntrega} já vinculadas e{' '}
                {estatisticasEnvioLote.qtdTerceiros} de terceiros ignoradas).
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleEnviarTodasVendasParaEntrega}
            disabled={isProcessandoLote}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0"
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            {isProcessandoLote ? 'Enviando...' : 'Enviar Agora'}
          </Button>
        </div>
      )}

      {/* 5 KPI Cards com Total Vendido e Margem */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Total Vendido
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1.5 font-mono tabular-nums">
            {formatCurrency(kpis.vendaTotal)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {kpis.totalEntregas} {kpis.totalEntregas === 1 ? 'viagem' : 'viagens'} no período
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Custo Combustível
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1.5 font-mono tabular-nums">
            {formatCurrency(kpis.custoTotal)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {kpis.kmTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km rodados
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Margem Bruta (Venda − Custo)
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono tabular-nums ${
              kpis.margemTotal >= 0 ? 'text-teal-900' : 'text-red-700'
            }`}
          >
            {formatCurrency(kpis.margemTotal)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {kpis.vendaTotal > 0 ? `${kpis.margemPercentual.toFixed(1)}% de margem` : 'Sem vendas'}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Custo Médio / Km
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Route className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1.5 font-mono tabular-nums">
            {formatCurrency(kpis.custoMedioPorKm)}{' '}
            <span className="text-xs font-normal text-gray-500">/ km</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Eficiência por quilômetro</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Custo Médio / Viagem
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1.5 font-mono tabular-nums">
            {formatCurrency(kpis.custoMedioPorEntrega)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Média por romaneio</p>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Veículo */}
            <Select value={selectedVeiculoFilter} onValueChange={setSelectedVeiculoFilter}>
              <SelectTrigger className="w-[220px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Filtrar por Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Veículos</SelectItem>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.codigo_interno} • {v.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Produto */}
            <Select value={selectedProdutoFilter} onValueChange={setSelectedProdutoFilter}>
              <SelectTrigger className="w-[180px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Filtrar por Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Produtos</SelectItem>
                {PRODUTOS_PEDREIRA_NOMES.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="w-[145px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente / Agendada</SelectItem>
                <SelectItem value="em_transito">Em Trânsito</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Busca textual */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar destino, motorista, rota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
        </div>

        {/* Filtro de Período padrão Contas a Pagar/Receber */}
        <FiltroPeriodoBar
          rotulo="Data da entrega / romaneio:"
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
            selectedVeiculoFilter !== 'todos' ||
            selectedProdutoFilter !== 'todos' ||
            selectedStatusFilter !== 'todos' ||
            Boolean(searchQuery) ||
            selectedIds.length > 0
          }
          onLimpar={() => {
            setOpcaoPeriodo('todos')
            setDataInicio('')
            setDataFim('')
            setSelectedVeiculoFilter('todos')
            setSelectedProdutoFilter('todos')
            setSelectedStatusFilter('todos')
            setSearchQuery('')
            setSelectedIds([])
          }}
        />
      </Card>

      {/* Painéis de Inteligência Rápida: Rotas Mais Frequentes e Resumo por Veículo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rotas Mais Rodadas */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 lg:col-span-1">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE4]">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-teal-700" />
              <h3 className="font-semibold text-xs text-gray-900 uppercase tracking-wider">
                Rotas Mais Frequentes
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Top 5</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {rotasMaisRodadas.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhuma rota registrada.</p>
            ) : (
              rotasMaisRodadas.map((r, i) => (
                <div
                  key={i}
                  className="p-2.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] hover:bg-gray-100/60 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                    <span className="truncate max-w-[150px]">{r.destino}</span>
                    <Badge variant="outline" className="text-[10px] bg-white">
                      {r.viagens} {r.viagens === 1 ? 'viagem' : 'viagens'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1 font-mono">
                    <span className="truncate max-w-[140px] text-[10px] text-gray-400">
                      De: {r.origem}
                    </span>
                    <span className="text-teal-800 font-semibold">
                      {r.kmTotal.toFixed(0)} km • {formatCurrency(r.custoTotal)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Resumo por Veículo */}
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE4]">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-teal-700" />
              <h3 className="font-semibold text-xs text-gray-900 uppercase tracking-wider">
                Desempenho por Caçamba / Veículo
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              {resumoPorVeiculo.length} veículos ativos
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-2 px-3">Veículo</th>
                  <th className="py-2 px-3 text-center">Entregas</th>
                  <th className="py-2 px-3 text-right">Km Rodado</th>
                  <th className="py-2 px-3 text-right">Custo Total</th>
                  <th className="py-2 px-3 text-right">Custo Médio/Km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE4]">
                {resumoPorVeiculo.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      Nenhum veículo com viagens no período.
                    </td>
                  </tr>
                ) : (
                  resumoPorVeiculo.map((item) => {
                    const custoKm = item.km > 0 ? item.custo / item.km : 0
                    return (
                      <tr key={item.veiculo?.id || Math.random()} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3">
                          <span className="font-mono font-semibold text-teal-900">
                            {item.veiculo?.codigo_interno || '—'}
                          </span>
                          <span className="text-gray-500 ml-1.5">{item.veiculo?.modelo || ''}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-medium text-gray-700">
                          {item.qtd}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                          {item.km.toFixed(1)} km
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-red-600 tabular-nums">
                          {formatCurrency(item.custo)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600 tabular-nums">
                          {formatCurrency(custoKm)} /km
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Tabela Principal de Entregas */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#ECEAE4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-700" />
            <h2 className="font-bold text-sm text-gray-900">Romaneios e Viagens Registradas</h2>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {filteredEntregas.length} registro(s) encontrado(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-3 text-center w-8">
                  <Checkbox
                    checked={
                      filteredEntregas.length > 0 && selectedIds.length === filteredEntregas.length
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Selecionar todas as entregas visíveis"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Venda Vinculada</th>
                <th className="py-3 px-4">Veículo</th>
                <th className="py-3 px-4">Rota / Cliente</th>
                <th className="py-3 px-4 text-right">Km Lançado</th>
                <th className="py-3 px-4 text-center">Km Rota × Motorista</th>
                <th className="py-3 px-4">Produto & Carga</th>
                <th className="py-3 px-4 text-right">Valor Venda</th>
                <th className="py-3 px-4 text-right">Custo Viagem</th>
                <th className="py-3 px-4 text-right">Margem</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {filteredEntregas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck className="w-8 h-8 text-gray-300" />
                      <p>Nenhuma entrega encontrada para os critérios selecionados.</p>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openCreateModal}
                          className="mt-2 text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Lançar Entrega
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntregas.map((ent) => {
                  const veic = ent.expand?.veiculo_id
                  const vVenda = Number(ent.valor_venda) || 0
                  const cViagem = Number(ent.custo_estimado) || 0
                  const margem = vVenda - cViagem

                  const venda = ent.expand?.venda_id
                  const clienteExibicao =
                    ent.cliente_nome ||
                    ent.expand?.cliente_id?.nome ||
                    venda?.expand?.cliente_id?.nome
                  const isSelected = selectedIds.includes(ent.id)

                  return (
                    <tr
                      key={ent.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/60 hover:bg-teal-50/80' : 'hover:bg-teal-50/20'
                      }`}
                    >
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(evt) => evt.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(ent.id)}
                          aria-label={`Selecionar entrega ${ent.id}`}
                          className="border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                        {formatDate(ent.data)}
                      </td>
                      <td className="py-3 px-4">
                        {venda ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant="outline"
                              className="bg-teal-50 text-teal-800 border-teal-300 text-[10px] font-mono flex items-center gap-1 w-fit font-semibold"
                            >
                              <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                              Venda #{venda.id.slice(0, 6)}
                            </Badge>
                            <div className="text-[11px] font-medium text-gray-900 truncate max-w-[170px]">
                              {clienteExibicao || venda.expand?.cliente_id?.nome || 'Cliente'}
                            </div>
                            {ent.destino && (
                              <div className="text-[10px] text-gray-500 truncate max-w-[170px] flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                                <span>{ent.destino}</span>
                              </div>
                            )}
                            {venda.status && (
                              <span className="text-[9px] font-semibold text-teal-700 block uppercase">
                                {venda.status}
                              </span>
                            )}
                          </div>
                        ) : ent.venda_id ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant="outline"
                              className="bg-teal-50 text-teal-800 border-teal-300 text-[10px] font-mono flex items-center gap-1 w-fit font-semibold"
                            >
                              <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                              Venda #{ent.venda_id.slice(0, 6)}
                            </Badge>
                            <div className="text-[11px] font-medium text-gray-900 truncate max-w-[170px]">
                              {clienteExibicao || 'Cliente'}
                            </div>
                            {ent.destino && (
                              <div className="text-[10px] text-gray-500 truncate max-w-[170px] flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                                <span>{ent.destino}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">
                            Avulsa / Sem venda
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span className="font-mono text-teal-800">
                            {veic?.codigo_interno || '—'}
                          </span>
                          <span>•</span>
                          <span className="text-gray-700 truncate max-w-[120px]">
                            {veic?.modelo || ''}
                          </span>
                        </div>
                        {veic?.placa && (
                          <div className="text-[10px] text-gray-400 font-mono">{veic.placa}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="flex items-center gap-1 text-gray-900 font-medium truncate">
                          <span className="text-gray-500 truncate">{ent.origem}</span>
                          <ArrowRight className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="font-semibold text-teal-900 truncate">
                            {ent.destino}
                          </span>
                        </div>
                        {ent.sequencial_romaneio && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-teal-900 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                              Romaneio: {ent.sequencial_romaneio}
                            </span>
                          </div>
                        )}
                        {clienteExibicao && (
                          <div className="text-[10px] text-teal-700 font-semibold truncate mt-0.5">
                            Cliente: {clienteExibicao}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          Motorista: {ent.motorista || ent.expand?.funcionario_id?.nome || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                        {ent.km_rodado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
                        <span className="text-[10px] text-gray-400 font-normal">km</span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {ent.km_rota ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <BadgeComparativoKm
                              kmMotorista={ent.km_rodado}
                              kmRota={ent.km_rota}
                              compacto
                            />
                            <span className="text-[9px] font-mono text-gray-400">
                              Rota: {ent.km_rota} km
                            </span>
                          </div>
                        ) : (
                          <span
                            className="text-gray-300 text-[10px]"
                            title="Distância da rota não calculada neste registro"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {ent.produto_nome ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-50/60 border-amber-200 text-amber-900 font-medium"
                              >
                                {ent.produto_nome}
                              </Badge>
                              {ent.quantidade ? (
                                <span className="text-[11px] font-mono font-bold text-gray-800">
                                  {ent.quantidade} {ent.unidade_medida || 'ton'}
                                </span>
                              ) : null}
                            </div>
                            {extrairEquivalenciaOriginal(ent.observacoes) && (
                              <span className="text-[10px] font-mono text-teal-700 font-medium">
                                ≡ {extrairEquivalenciaOriginal(ent.observacoes)}
                              </span>
                            )}
                            {ent.preco_unitario_venda && ent.preco_unitario_venda > 0 ? (
                              <span className="text-[10px] font-mono text-gray-400">
                                {formatCurrency(ent.preco_unitario_venda)} /{' '}
                                {ent.unidade_medida || 'ton'}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                        {vVenda > 0 ? (
                          formatCurrency(vVenda)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums whitespace-nowrap">
                        {formatCurrency(cViagem)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {vVenda > 0 ? (
                          <span className={margem >= 0 ? 'text-teal-900' : 'text-red-600'}>
                            {formatCurrency(margem)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ent.status === 'concluida' ? (
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Concluída
                          </Badge>
                        ) : ent.status === 'em_transito' ? (
                          <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-semibold">
                            <Truck className="w-3 h-3 mr-1 text-blue-600" />
                            Em Trânsito
                          </Badge>
                        ) : ent.status === 'pendente' ? (
                          <Badge className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-semibold shadow-xs">
                            <Clock className="w-3 h-3 mr-1 text-amber-700" />
                            Pendente
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-[10px] font-semibold">
                            <Ban className="w-3 h-3 mr-1 text-gray-500" />
                            Cancelada
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && ent.status === 'pendente' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAlocacaoModal(ent)}
                              className="h-7 px-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border-amber-300"
                              title="Alocar veículo e motorista para a entrega pendente"
                            >
                              <Truck className="w-3.5 h-3.5 mr-1" />
                              Alocar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedEntregaImpressao(ent)}
                            className="h-7 px-2 text-xs text-teal-800 hover:text-teal-950 hover:bg-teal-50"
                            title="Imprimir Romaneio de Entrega (A4)"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Imprimir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedEntregaDetalhe(ent)}
                            className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            title="Ver detalhes da entrega"
                          >
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(ent)}
                            className="h-7 px-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-50"
                          >
                            Editar
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(ent)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Drawer Formulário de Lançamento / Edição de Entrega */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[620px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <SheetTitle className="text-lg font-bold text-gray-900">
                {editingEntregaId ? 'Editar Entrega' : 'Lançar Entrega (Origem ➔ Destino)'}
              </SheetTitle>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Informe a rota, km e produto. O ERP calcula o consumo e custo estimado com base no
              histórico real do veículo.
            </p>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            {/* SELETOR DE VENDA VINCULADA (OPCIONAL) */}
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 space-y-1.5">
              <Label className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-teal-700" />
                Vincular a uma Venda (Opcional)
              </Label>
              <ComboboxPesquisavel
                value={vendaId}
                onChange={handleVendaSelect}
                placeholder="Pesquisar venda para vincular..."
                searchPlaceholder="Buscar por cliente, produto ou #ID..."
                emptyText="Nenhuma venda encontrada."
                triggerClassName="bg-white border-teal-200"
                options={[
                  { id: 'nenhuma', label: 'Nenhuma (Entrega avulsa de frotas)' },
                  ...vendas.map((v) => ({
                    id: v.id,
                    label: `#${v.id.slice(0, 6)} • ${v.expand?.cliente_id?.nome || 'Cliente'} — ${v.produto_nome || 'Produto'}`,
                    sublabel: `${v.quantidade} ${v.unidade} • ${formatCurrency(v.valor_total)}`,
                    keywords: [v.expand?.cliente_id?.nome || '', v.produto_nome || '', v.id],
                  })),
                ]}
              />
              <p className="text-[11px] text-teal-700">
                Ao selecionar a venda, os dados de cliente, produto, quantidade e valor são
                preenchidos automaticamente.
              </p>
            </div>

            {/* Veículo */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Veículo / Caçamba de Entrega *
              </Label>
              <ComboboxPesquisavel
                value={veiculoId}
                onChange={handleVeiculoChange}
                placeholder="Pesquisar veículo / caçamba..."
                searchPlaceholder="Buscar por código interno, modelo ou placa..."
                emptyText="Nenhum veículo encontrado."
                triggerClassName="mt-1 font-medium bg-white"
                options={veiculos.map((v) => ({
                  id: v.id,
                  label: `${v.codigo_interno} • ${v.modelo}${v.placa ? ` (${v.placa})` : ''}`,
                  sublabel: `${v.setor || 'Geral'} • Km atual: ${Number(v.km_atual || 0).toLocaleString('pt-BR')}`,
                  keywords: [v.codigo_interno, v.modelo, v.placa || '', v.setor || ''],
                }))}
              />
            </div>

            {/* Data e Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Data da Viagem *</Label>
                <Input
                  type="date"
                  required
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="mt-1 font-mono bg-white"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status Operacional *</Label>
                <Select value={status} onValueChange={(s: StatusEntrega) => setStatus(s)}>
                  <SelectTrigger className="mt-1 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente / Agendada</SelectItem>
                    <SelectItem value="em_transito">Em Trânsito</SelectItem>
                    <SelectItem value="concluida">Concluída (Realizada)</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ORIGEM E DESTINO COM AUTOCOMPLETE DE CIDADES */}
            <div className="p-3.5 bg-teal-50/50 rounded-xl border border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" />
                  <span>Definição da Rota de Transporte</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  Origem ➔ Destino (Cidades / Pedreira)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CidadeInputAutocomplete
                  label="Origem *"
                  required
                  value={origem}
                  placeholder="Ex: Pedreira Cordeiro ou Cidade de saída"
                  atalhos={ORIGENS_SUGERIDAS}
                  onSelectAtalho={(atalho) => {
                    setOrigem(atalho)
                    setOrigemCoords(COORDENADAS_PEDREIRA_PADRAO)
                    recalcularRota(COORDENADAS_PEDREIRA_PADRAO, destinoCoords)
                  }}
                  onChange={(val, coords) => {
                    setOrigem(val)
                    if (coords) {
                      setOrigemCoords(coords)
                      recalcularRota(coords, destinoCoords)
                    } else if (val.toLowerCase().includes('pedreira')) {
                      setOrigemCoords(COORDENADAS_PEDREIRA_PADRAO)
                      recalcularRota(COORDENADAS_PEDREIRA_PADRAO, destinoCoords)
                    } else {
                      setOrigemCoords(null)
                    }
                  }}
                  helperText="Selecione uma unidade da pedreira ou digite uma cidade"
                />

                <CidadeInputAutocomplete
                  label="Destino / Cidade do Cliente *"
                  required
                  value={destino}
                  placeholder="Digite a cidade de entrega (ex: Patos, Monteiro, Caicó...)"
                  onChange={(val, coords) => {
                    setDestino(val)
                    if (coords) {
                      setDestinoCoords(coords)
                      recalcularRota(origemCoords, coords)
                    } else {
                      setDestinoCoords(null)
                    }
                  }}
                  helperText="Nome da cidade, obra ou cliente recebedor"
                />
              </div>

              {/* BLOCO KM AUTOMÁTICO DA ROTA (OSRM) */}
              <BlocoKmRota
                kmRota={kmRotaCalculado}
                carregandoRota={carregandoRota}
                erroRota={erroRota}
                kmMotorista={kmEfetivo}
                origem={origem}
                destino={destino}
                duracaoMinutos={duracaoRotaMinutos}
                onUsarKmRota={handleUsarKmRota}
                onRecalcular={() => recalcularRota()}
              />
            </div>

            {/* QUILOMETRAGEM (DIRETA OU POR ODÔMETRO) */}
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <Route className="w-3.5 h-3.5 text-amber-800" />
                  <span>Quilometragem da Entrega</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModoKm('direto')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      modoKm === 'direto'
                        ? 'bg-amber-800 text-white'
                        : 'bg-white text-amber-900 border border-amber-200'
                    }`}
                  >
                    Informar Km Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoKm('odometro')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      modoKm === 'odometro'
                        ? 'bg-amber-800 text-white'
                        : 'bg-white text-amber-900 border border-amber-200'
                    }`}
                  >
                    Km Inicial / Final
                  </button>
                </div>
              </div>

              {modoKm === 'direto' ? (
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Distância Total Rodada (Km) *
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={kmRodado || ''}
                      onChange={(e) => setKmRodado(parseFloat(e.target.value) || 0)}
                      placeholder="0.0"
                      className="font-mono font-bold text-base bg-white pr-12 text-gray-900"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-mono text-gray-400">
                      km
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Km Inicial (Saída)
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={kmInicial || ''}
                      onChange={(e) => setKmInicial(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1 font-mono bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700">
                      Km Final (Chegada)
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={kmFinal || ''}
                      onChange={(e) => setKmFinal(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="mt-1 font-mono font-bold bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-amber-900 font-mono bg-amber-100/70 p-2 rounded-lg">
                <span>Distância Efetiva da Viagem:</span>
                <span className="font-bold text-xs">{kmEfetivo.toLocaleString('pt-BR')} km</span>
              </div>
            </div>

            {/* CÁLCULO AUTOMÁTICO DE CUSTO */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-[#ECEAE4] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                  <Calculator className="w-3.5 h-3.5 text-teal-700" />
                  <span>Cálculo de Consumo & Custo da Entrega</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUsarCustoManual(!usarCustoManual)}
                  className="text-[10px] text-teal-700 hover:underline font-medium"
                >
                  {usarCustoManual ? 'Usar cálculo automático' : 'Inserir custo manual'}
                </button>
              </div>

              {!usarCustoManual ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-700">
                          Consumo Médio (Km/l)
                        </Label>
                        <span className="text-[10px] text-teal-700">
                          {currentVeiculo ? 'Apurado' : 'Padrão'}
                        </span>
                      </div>
                      <Input
                        type="number"
                        step="0.05"
                        value={consumoEstimadoKmL || ''}
                        onChange={(e) => setConsumoEstimadoKmL(parseFloat(e.target.value) || 0)}
                        placeholder="2.8"
                        className="mt-1 font-mono bg-white"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Baseado nos abastecimentos do veículo
                      </span>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">
                        Preço do Diesel (R$/l)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={precoCombustivelLitro || ''}
                        onChange={(e) => setPrecoCombustivelLitro(parseFloat(e.target.value) || 0)}
                        placeholder="5.89"
                        className="mt-1 font-mono bg-white"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Preço médio apurado na pedreira
                      </span>
                    </div>
                  </div>

                  {/* Resumo do cálculo */}
                  <div className="p-3 bg-teal-50/80 rounded-xl border border-teal-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-teal-900 block">
                        Custo Estimado da Viagem
                      </span>
                      <span className="text-[11px] text-teal-700 font-mono">
                        {litrosCalculados.toFixed(1)} L estimados ({kmEfetivo} km ÷{' '}
                        {consumoEstimadoKmL} km/l)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-red-600 tabular-nums">
                        {formatCurrency(custoCalculado)}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {formatCurrency(custoPorKmCalculado)} /km
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Custo Total Informado Manualmente (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={custoManualInformado || ''}
                    onChange={(e) => setCustoManualInformado(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1 font-mono font-bold text-red-600 bg-white"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Custo fixado para viagens com valor acordado de frete
                  </span>
                </div>
              )}
            </div>

            {/* MOTORISTA & PRODUTO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Motorista */}
              <div>
                <Label className="text-xs font-semibold text-gray-700">Motorista</Label>
                <ComboboxPesquisavel
                  value={funcionarioId || 'nenhum'}
                  onChange={handleFuncionarioChange}
                  placeholder="Pesquisar motorista..."
                  searchPlaceholder="Digitar nome do motorista..."
                  emptyText="Nenhum motorista encontrado."
                  triggerClassName="mt-1 bg-white"
                  options={[
                    { id: 'nenhum', label: 'Digitar motorista avulso...' },
                    ...motoristasFrota.map((m) => ({
                      id: m.id,
                      label: m.nome,
                      sublabel: m.cargo || m.setor || undefined,
                    })),
                  ]}
                />
                {(!funcionarioId || funcionarioId === 'nenhum') && (
                  <Input
                    value={motoristaNome}
                    onChange={(e) => setMotoristaNome(e.target.value)}
                    placeholder="Nome do motorista / operador"
                    className="mt-1.5 bg-white"
                  />
                )}
              </div>

              {/* Produto */}
              <div>
                <Label className="text-xs font-semibold text-gray-700">Produto da Pedreira</Label>
                <ComboboxPesquisavel
                  value={produtoId || 'nenhum'}
                  onChange={handleProdutoChange}
                  placeholder="Pesquisar produto..."
                  searchPlaceholder="Digitar nome do produto..."
                  emptyText="Nenhum produto encontrado."
                  triggerClassName="mt-1 bg-white"
                  options={[
                    { id: 'nenhum', label: 'Outro / Avulso...' },
                    ...produtos.map((p) => ({
                      id: p.id,
                      label: p.nome,
                      sublabel: `Preço: ${formatCurrency(p.preco_venda || 0)}/${p.unidade || 'm³'}`,
                    })),
                  ]}
                />
                {(!produtoId || produtoId === 'nenhum') && (
                  <Input
                    value={produtoNome}
                    onChange={(e) => setProdutoNome(e.target.value)}
                    placeholder="Ex: Brita 12, Rachão..."
                    className="mt-1.5 bg-white"
                  />
                )}
              </div>
            </div>

            {/* Quantidade e Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Quantidade da Carga</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={quantidade || ''}
                  onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  placeholder="14"
                  className="mt-1 font-mono font-bold bg-white text-gray-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Unidade de Medida</Label>
                <Select
                  value={unidadeMedida}
                  onValueChange={(u: UnidadeMedidaCarga) => setUnidadeMedida(u)}
                >
                  <SelectTrigger className="mt-1 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">Metros Cúbicos (m³)</SelectItem>
                    <SelectItem value="ton">Toneladas (ton)</SelectItem>
                    <SelectItem value="viagem">Viagem Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DESTAQUE VISUAL: CÁLCULO AUTOMÁTICO DO VALOR DA VENDA */}
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>Valor da Venda da Carga (Automático)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUsarValorVendaManual(!usarValorVendaManual)}
                  className="text-[10px] text-emerald-800 hover:underline font-semibold"
                >
                  {usarValorVendaManual ? 'Usar cálculo automático' : 'Informar valor manual'}
                </button>
              </div>

              {!usarValorVendaManual ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-gray-700">
                        Preço Unitário de Venda (R$)
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={precoUnitarioVenda || ''}
                          onChange={(e) => setPrecoUnitarioVenda(parseFloat(e.target.value) || 0)}
                          placeholder={
                            currentProduto ? String(currentProduto.preco_venda || '') : '0.00'
                          }
                          className="font-mono bg-white text-xs pr-12"
                        />
                        <span className="absolute right-3 top-2.5 text-[11px] font-mono text-gray-400">
                          /{currentProduto?.unidade || unidadeMedida}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {currentProduto
                          ? `Cadastrado: ${formatCurrency(currentProduto.preco_venda || 0)}/${currentProduto.unidade || 'm³'}`
                          : 'Preço padrão do produto'}
                      </span>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">
                        Densidade do Material
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="text"
                          disabled
                          value={`${densidadeProduto.toFixed(2)} t/m³`}
                          className="font-mono bg-gray-100 text-xs text-gray-600"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Conversão volumétrica m³ ⇄ ton
                      </span>
                    </div>
                  </div>

                  {/* Alerta se o produto não tem preço cadastrado */}
                  {(!currentProduto ||
                    !currentProduto.preco_venda ||
                    currentProduto.preco_venda === 0) &&
                    precoUnitarioVenda === 0 && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Produto sem preço de venda cadastrado. Informe o preço unitário acima ou
                          digite o valor manual.
                        </span>
                      </div>
                    )}

                  {/* Informação sobre conversão se aplicável */}
                  {calculoVenda.precisaConversao && (
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-[11px]">
                      Conversão automática aplicada:{' '}
                      <strong>
                        {calculoVenda.quantidadeBase} {calculoVenda.unidadeOriginal}
                      </strong>{' '}
                      ={' '}
                      <strong>
                        {calculoVenda.quantidadeConvertida.toFixed(2)} {calculoVenda.unidadePreco}
                      </strong>{' '}
                      (densidade {densidadeProduto} t/m³).
                    </div>
                  )}

                  {/* Placa de destaque do Valor da Venda e Margem */}
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Total da Venda Estimado
                      </span>
                      <div className="text-2xl font-bold font-mono text-emerald-800 tabular-nums">
                        {formatCurrency(calculoVenda.valorTotal)}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {calculoVenda.quantidadeConvertida} {calculoVenda.unidadePreco} ×{' '}
                        {formatCurrency(calculoVenda.precoUnitario)}
                      </span>
                    </div>

                    <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Margem da Viagem (Venda − Custo)
                      </span>
                      <div
                        className={`text-xl font-bold font-mono tabular-nums ${
                          calculoVenda.margem >= 0 ? 'text-teal-900' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(calculoVenda.margem)}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Custo Viagem: {formatCurrency(custoCalculado)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Valor Total da Venda Manual (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorVendaManual || ''}
                    onChange={(e) => setValorVendaManual(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1 font-mono font-bold text-emerald-800 bg-white"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Valor faturado fixado para esta entrega
                  </span>
                </div>
              )}
            </div>

            {/* INTEGRAÇÕES COM OUTROS MÓDULOS */}
            <div className="space-y-2 pt-2 border-t border-[#ECEAE4]">
              {/* Odômetro */}
              <div className="p-3 bg-white rounded-xl border border-[#ECEAE4] flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="atualizarOdometro"
                  checked={atualizarOdometro}
                  onChange={(e) => setAtualizarOdometro(e.target.checked)}
                  className="mt-1 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
                />
                <label htmlFor="atualizarOdometro" className="cursor-pointer text-xs">
                  <span className="font-semibold text-gray-900 block">
                    Atualizar odômetro do veículo no cadastro da frota
                  </span>
                  <span className="text-gray-500 text-[11px] block mt-0.5">
                    Se marcado, avança o km_atual do caminhão para o km final desta entrega.
                  </span>
                </label>
              </div>

              {/* Financeiro */}
              <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="gerarContaPagar"
                  checked={gerarContaPagar}
                  onChange={(e) => setGerarContaPagar(e.target.checked)}
                  className="mt-1 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
                />
                <label htmlFor="gerarContaPagar" className="cursor-pointer text-xs">
                  <span className="font-semibold text-teal-900 block">
                    Lançar Conta a Pagar correspondente no Financeiro
                  </span>
                  <span className="text-teal-700 text-[11px] block mt-0.5">
                    Gera um título de {formatCurrency(custoCalculado)} no Centro de Custo
                    "Transporte e Frota" e categoria "Combustíveis - Frota".
                  </span>
                </label>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações da Viagem</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Entrega realizada com chuva, acesso íngreme na frente da obra..."
                className="mt-1 text-xs bg-white"
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
                {isSubmitting
                  ? 'Salvando...'
                  : editingEntregaId
                    ? 'Atualizar Entrega'
                    : 'Confirmar Entrega'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal de Alocação Rápida de Veículo / Motorista a partir do Estado Pendente */}
      <Dialog open={alocacaoModalOpen} onOpenChange={setAlocacaoModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-[#ECEAE4]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Alocar Veículo & Motorista (Frota Própria)
                </DialogTitle>
                <p className="text-[11px] text-gray-500">
                  {entregaParaAlocar?.expand?.venda_id
                    ? `Origem: Venda #${entregaParaAlocar.expand.venda_id.id.slice(0, 6)} • ${
                        entregaParaAlocar.cliente_nome ||
                        entregaParaAlocar.expand?.venda_id?.expand?.cliente_id?.nome ||
                        'Cliente'
                      }`
                    : 'Entrega pendente de alocação'}
                </p>
              </div>
            </div>
          </DialogHeader>

          {entregaParaAlocar && (
            <form onSubmit={handleSalvarAlocacao} className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>Carga: {entregaParaAlocar.produto_nome || 'Agregados da Pedreira'}</span>
                  <span className="font-mono font-bold text-amber-950">
                    {entregaParaAlocar.quantidade} {entregaParaAlocar.unidade_medida || 'm³'}
                  </span>
                </div>
                <div className="text-[11px] text-amber-900 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-700 shrink-0" />
                  <span className="truncate">Destino: {entregaParaAlocar.destino}</span>
                </div>
                {entregaParaAlocar.valor_venda && entregaParaAlocar.valor_venda > 0 ? (
                  <div className="text-[11px] font-mono text-emerald-800 font-semibold">
                    Valor faturado da carga: {formatCurrency(entregaParaAlocar.valor_venda)}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-semibold">Veículo / Caçamba da Frota *</Label>
                <ComboboxPesquisavel
                  value={alocarVeiculoId}
                  onChange={setAlocarVeiculoId}
                  placeholder="Selecione o caminhão/caçamba..."
                  searchPlaceholder="Buscar por código interno, placa ou modelo..."
                  emptyText="Nenhum veículo encontrado."
                  triggerClassName="bg-white border-[#ECEAE4] font-mono"
                  options={veiculos.map((v) => ({
                    id: v.id,
                    label: `${v.codigo_interno} • ${v.placa ? `${v.placa} (${v.modelo})` : v.modelo}`,
                    sublabel: v.setor || undefined,
                    keywords: [v.codigo_interno, v.placa || '', v.modelo],
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-700 font-semibold">Motorista / Condutor</Label>
                <Input
                  placeholder="Nome do motorista..."
                  value={alocarMotorista}
                  onChange={(e) => setAlocarMotorista(e.target.value)}
                  list="funcionarios-alocar-list-frota"
                  className="bg-white border-[#ECEAE4] text-xs h-9"
                />
                <datalist id="funcionarios-alocar-list-frota">
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.nome}>
                      {f.cargo ? `${f.cargo} - ${f.setor}` : f.setor}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-700 font-semibold">Quilometragem (Km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={alocarKmRodado}
                    onChange={(e) => setAlocarKmRodado(parseFloat(e.target.value) || 0)}
                    className="bg-white border-[#ECEAE4] text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700 font-semibold">Status Operacional *</Label>
                  <Select value={alocarStatus} onValueChange={(s: any) => setAlocarStatus(s)}>
                    <SelectTrigger className="bg-white border-[#ECEAE4] text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Manter Pendente</SelectItem>
                      <SelectItem value="em_transito">Em Trânsito (Saiu p/ viagem)</SelectItem>
                      <SelectItem value="concluida">Concluída (Entregue)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#ECEAE4] flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAlocacaoModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isAlocando}
                  size="sm"
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                >
                  {isAlocando ? 'Salvando...' : 'Confirmar Alocação'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Entrega com Comparativo Km da Rota vs Motorista */}
      <Dialog
        open={!!selectedEntregaDetalhe}
        onOpenChange={(open) => !open && setSelectedEntregaDetalhe(null)}
      >
        <DialogContent className="sm:max-w-[550px] bg-white border-[#ECEAE4]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Detalhes do Romaneio de Entrega
                </DialogTitle>
                <p className="text-[11px] text-gray-500 font-mono">
                  {selectedEntregaDetalhe && formatDate(selectedEntregaDetalhe.data)} •{' '}
                  {selectedEntregaDetalhe?.expand?.veiculo_id?.codigo_interno || 'Veículo'}
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedEntregaDetalhe && (
            <div className="space-y-3.5 py-2 text-xs">
              {/* Venda Vinculada e Cliente */}
              {(selectedEntregaDetalhe.venda_id || selectedEntregaDetalhe.expand?.venda_id) && (
                <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-teal-900 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-teal-700" />
                      Venda Vinculada ao Financeiro
                    </span>
                    <Badge className="bg-teal-700 text-white text-[10px] font-mono">
                      #{selectedEntregaDetalhe.venda_id?.slice(0, 8)}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-800 font-semibold mt-1">
                    Cliente:{' '}
                    <span className="text-teal-950 font-bold">
                      {selectedEntregaDetalhe.cliente_nome ||
                        selectedEntregaDetalhe.expand?.cliente_id?.nome ||
                        selectedEntregaDetalhe.expand?.venda_id?.expand?.cliente_id?.nome ||
                        '—'}
                    </span>
                  </div>
                  {selectedEntregaDetalhe.expand?.venda_id?.status && (
                    <div className="text-[10px] text-gray-500">
                      Status da Venda:{' '}
                      <strong>{selectedEntregaDetalhe.expand.venda_id.status}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Rota */}
              <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                  Percurso da Viagem
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span className="text-gray-700">{selectedEntregaDetalhe.origem}</span>
                  <ArrowRight className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-teal-900 font-bold">{selectedEntregaDetalhe.destino}</span>
                </div>
              </div>

              {/* Comparativo de Quilometragem */}
              <div className="p-3.5 bg-gradient-to-r from-teal-50/80 to-blue-50/60 rounded-xl border border-teal-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-teal-950">
                    <Route className="w-4 h-4 text-teal-700" />
                    <span>Conferência de Quilometragem</span>
                  </div>
                  {selectedEntregaDetalhe.km_rota && (
                    <BadgeComparativoKm
                      kmMotorista={selectedEntregaDetalhe.km_rodado}
                      kmRota={selectedEntregaDetalhe.km_rota}
                      compacto
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-teal-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                      Km Lançado pelo Motorista
                    </span>
                    <span className="text-lg font-bold font-mono text-gray-900">
                      {selectedEntregaDetalhe.km_rodado.toLocaleString('pt-BR', {
                        maximumFractionDigits: 1,
                      })}{' '}
                      km
                    </span>
                    {selectedEntregaDetalhe.km_inicial !== undefined &&
                      selectedEntregaDetalhe.km_final !== undefined && (
                        <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                          Odômetro: {selectedEntregaDetalhe.km_inicial} ➔{' '}
                          {selectedEntregaDetalhe.km_final}
                        </span>
                      )}
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-teal-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                      Km Calculado da Rota (OSRM)
                    </span>
                    <span className="text-lg font-bold font-mono text-teal-900">
                      {selectedEntregaDetalhe.km_rota
                        ? `${selectedEntregaDetalhe.km_rota} km`
                        : 'Não calculado'}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Distância rodoviária por satélite
                    </span>
                  </div>
                </div>

                {selectedEntregaDetalhe.km_rota && (
                  <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                    <BadgeComparativoKm
                      kmMotorista={selectedEntregaDetalhe.km_rodado}
                      kmRota={selectedEntregaDetalhe.km_rota}
                    />
                  </div>
                )}
              </div>

              {/* Informações Operacionais & Custo */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                    Carga Transportada
                  </span>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedEntregaDetalhe.produto_nome || 'Agregados'}
                  </div>
                  {selectedEntregaDetalhe.quantidade && (
                    <div className="text-[11px] font-mono text-gray-700 font-bold">
                      {selectedEntregaDetalhe.quantidade}{' '}
                      {selectedEntregaDetalhe.unidade_medida || 'ton'}
                      {extrairEquivalenciaOriginal(selectedEntregaDetalhe.observacoes) && (
                        <span className="block text-[10px] font-normal text-teal-700">
                          ≡ {extrairEquivalenciaOriginal(selectedEntregaDetalhe.observacoes)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4]">
                  <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                    Motorista / Condutor
                  </span>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedEntregaDetalhe.motorista ||
                      selectedEntregaDetalhe.expand?.funcionario_id?.nome ||
                      'Não informado'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {selectedEntregaDetalhe.expand?.veiculo_id?.modelo || 'Frota'}
                  </div>
                </div>
              </div>

              {/* Valores Financeiros: Valor da Venda, Custo da Viagem e Margem */}
              <div className="p-3 bg-white rounded-xl border border-[#ECEAE4] space-y-2">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100">
                  <span className="text-gray-500">Valor da Venda da Carga:</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {selectedEntregaDetalhe.valor_venda
                      ? formatCurrency(selectedEntregaDetalhe.valor_venda)
                      : 'Não informado'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100">
                  <div>
                    <span className="text-gray-500 block">Custo Viagem (Combustível):</span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {selectedEntregaDetalhe.consumo_estimado_km_l || 2.8} km/l • Diesel{' '}
                      {formatCurrency(selectedEntregaDetalhe.preco_combustivel_litro || 5.89)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-red-600 text-sm">
                    {formatCurrency(selectedEntregaDetalhe.custo_estimado)}
                  </span>
                </div>

                {selectedEntregaDetalhe.valor_venda ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-teal-950 uppercase text-[10px]">
                      Margem da Operação:
                    </span>
                    <span
                      className={`font-mono font-bold text-base ${
                        selectedEntregaDetalhe.valor_venda -
                          selectedEntregaDetalhe.custo_estimado >=
                        0
                          ? 'text-teal-950'
                          : 'text-red-700'
                      }`}
                    >
                      {formatCurrency(
                        selectedEntregaDetalhe.valor_venda - selectedEntregaDetalhe.custo_estimado,
                      )}
                    </span>
                  </div>
                ) : null}
              </div>

              {selectedEntregaDetalhe.observacoes && (
                <div className="p-2.5 bg-gray-50 rounded-xl border border-[#ECEAE4] text-[11px] text-gray-600">
                  <span className="font-semibold text-gray-700 block mb-0.5">Observações:</span>
                  {selectedEntregaDetalhe.observacoes}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedEntregaDetalhe(null)}
              className="text-xs"
            >
              Fechar
            </Button>
            <div className="flex items-center gap-2">
              {selectedEntregaDetalhe && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ent = selectedEntregaDetalhe
                    setSelectedEntregaDetalhe(null)
                    setSelectedEntregaImpressao(ent)
                  }}
                  className="text-xs text-teal-800 border-teal-300 hover:bg-teal-50"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Imprimir Romaneio
                </Button>
              )}
              {selectedEntregaDetalhe && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const ent = selectedEntregaDetalhe
                    setSelectedEntregaDetalhe(null)
                    openEditModal(ent)
                  }}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                >
                  Editar Registro
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Impressão do Romaneio Oficial de Entrega em A4 */}
      <RomaneioEntregaImpressaoModal
        entrega={selectedEntregaImpressao}
        empresa={currentEmpresa}
        open={!!selectedEntregaImpressao}
        onOpenChange={(open) => !open && setSelectedEntregaImpressao(null)}
      />
      {/* Relatório de Impressão A4 das Entregas e Rotas */}
      <RelatorioListagemImpressaoModal
        open={relatorioImpressaoOpen}
        onOpenChange={setRelatorioImpressaoOpen}
        titulo="Controle de Entregas & Rotas — Relatório de Itens"
        subtitulo="Demonstrativo de Romaneios, Quilometragem Rodada e Custos Operacionais"
        badgeDestaque="Entregas Frota"
        empresa={currentEmpresa}
        usuarioNome={user?.name || user?.email || 'Administrador'}
        filtrosDescricao={descricaoFiltrosAplicados}
        itens={itensParaImpressao}
        colunas={colunasRelatorioEntregas}
        totais={totalizadoresRelatorioEntregas}
        mensagemVazio="Nenhuma entrega encontrada para os filtros ou seleção atual."
      />

      {/* Diálogo de Confirmação Obrigatório */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-[#ECEAE4] max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">
              {confirmDialogData?.title || 'Confirmar ação'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {confirmDialogData?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isProcessandoLote} className="text-xs rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessandoLote}
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
              {isProcessandoLote
                ? 'Processando...'
                : confirmDialogData?.confirmLabel || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
