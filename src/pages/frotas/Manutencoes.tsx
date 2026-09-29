import React, { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { calcularDatasPeriodoRapido, estaDentroDoPeriodo } from '@/lib/periodo'
import FiltroPeriodoBar from '@/components/financeiro/FiltroPeriodoBar'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  RelatorioListagemImpressaoModal,
  type ColunaRelatorioImpressao,
  type TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import { FornecedoresPecasTab } from '@/components/frotas/FornecedoresPecasTab'
import { fornecedoresPecasService } from '@/services/fornecedoresPecas'
import type { Manutencao, Veiculo, Fornecedor, PlanoConta, FornecedorPecas } from '@/types/erp'
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
import { toast } from '@/hooks/use-toast'
import {
  Wrench,
  Plus,
  Search,
  Trash2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Gauge,
  Receipt,
  FileCheck2,
  Unlink,
  Pencil,
  Building2,
} from 'lucide-react'

export default function Manutencoes() {
  const { currentEmpresa, canEdit } = useCompany()
  const { user } = useAuth()

  // Aba ativa: 'ordens' | 'fornecedores_pecas'
  const [activeTab, setActiveTab] = useState<'ordens' | 'fornecedores_pecas'>('ordens')

  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [fornecedoresPecas, setFornecedoresPecas] = useState<FornecedorPecas[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  // Seleção múltipla para impressão e lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)
  const [isProcessandoLote, setIsProcessandoLote] = useState(false)

  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Filtro de Período padrão Contas a Pagar / Dashboard
  const [opcaoPeriodo, setOpcaoPeriodo] = useState<string>('este_mes')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').inicio
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    return calcularDatasPeriodoRapido('este_mes').fim
  })

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [existingContaPagarId, setExistingContaPagarId] = useState<string | null>(null)

  const [veiculoId, setVeiculoId] = useState('')
  const [tipo, setTipo] = useState<'preventiva' | 'corretiva'>('preventiva')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [fornecedorPecaId, setFornecedorPecaId] = useState<string>('')
  const [oficinaNome, setOficinaNome] = useState('')
  const [dataManut, setDataManut] = useState(() => new Date().toISOString().slice(0, 10))

  // CONTROLE DUPLO: Km e Horímetro independentes no momento da manutenção
  const [kmNoMomento, setKmNoMomento] = useState<number>(0)
  const [horimetroNoMomento, setHorimetroNoMomento] = useState<number>(0)

  const [custo, setCusto] = useState<number>(0)
  const [status, setStatus] = useState<'agendada' | 'em_andamento' | 'concluida' | 'cancelada'>(
    'concluida',
  )

  // Próxima revisão (data, km ou horímetro)
  const [proximaRevisaoData, setProximaRevisaoData] = useState('')
  const [proximaRevisaoKm, setProximaRevisaoKm] = useState<number>(0)
  const [proximaRevisaoHorimetro, setProximaRevisaoHorimetro] = useState<number>(0)

  const [gerarFinanceiro, setGerarFinanceiro] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useRealtime('manutencoes', () => loadData())
  useRealtime('veiculos', () => loadData())
  useRealtime('fornecedores_pecas', () => loadData())

  const loadData = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [mList, vList, fList, pList, fpList] = await Promise.all([
        pb.collection('manutencoes').getFullList<Manutencao>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          expand: 'veiculo_id,fornecedor_id,conta_pagar_id',
          sort: '-data',
        }),
        pb.collection('veiculos').getFullList<Veiculo>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'codigo_interno',
        }),
        pb.collection('fornecedores').getFullList<Fornecedor>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
        fornecedoresPecasService.listar(currentEmpresa.id).catch(() => []),
      ])

      setManutencoes(mList)
      setVeiculos(vList)
      setFornecedores(fList)
      setPlanoContas(pList)
      setFornecedoresPecas(fpList)
    } catch (err) {
      console.error('Error fetching manutencoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentEmpresa])

  // Opções unificadas de Oficinas/Fornecedores de Peças para o Combobox
  const opcoesOficinasFornecedores = useMemo(() => {
    const list: Array<{ id: string; label: string; sublabel?: string; keywords?: string[] }> = [
      { id: '', label: 'Nenhum / Oficina Própria da Pedreira' },
    ]

    // 1. Cadastrados no módulo da Frota (Peças & Oficinas)
    fornecedoresPecas.forEach((fp) => {
      list.push({
        id: `peca:${fp.id}`,
        label: fp.nome,
        sublabel: `Oficina/Peças da Frota${fp.tipo_pecas ? ` • ${fp.tipo_pecas}` : ''}${fp.cidade ? ` • ${fp.cidade}` : ''}`,
        keywords: [fp.nome, fp.tipo_pecas || '', fp.cidade || '', fp.cnpj || ''],
      })
    })

    // 2. Fornecedores gerais
    fornecedores.forEach((f) => {
      list.push({
        id: `forn:${f.id}`,
        label: f.nome,
        sublabel: `Fornecedor Geral${f.cidade ? ` • ${f.cidade}` : ''}`,
        keywords: [f.nome, f.cidade || '', f.cnpj_cpf || ''],
      })
    })

    return list
  }, [fornecedoresPecas, fornecedores])

  // Helper do seletor atual
  const selectedOficinaOuFornId = useMemo(() => {
    if (fornecedorPecaId) return `peca:${fornecedorPecaId}`
    if (fornecedorId) return `forn:${fornecedorId}`
    return ''
  }, [fornecedorPecaId, fornecedorId])

  const handleSelectOficinaOuForn = (val: string) => {
    if (!val) {
      setFornecedorPecaId('')
      setFornecedorId('')
      return
    }
    if (val.startsWith('peca:')) {
      const pId = val.replace('peca:', '')
      setFornecedorPecaId(pId)
      const fp = fornecedoresPecas.find((item) => item.id === pId)
      if (fp) {
        setOficinaNome(fp.nome)
        const matchingForn = fornecedores.find(
          (f) =>
            f.nome.trim().toLowerCase() === fp.nome.trim().toLowerCase() ||
            (fp.cnpj && f.cnpj_cpf && f.cnpj_cpf.replace(/\D/g, '') === fp.cnpj.replace(/\D/g, '')),
        )
        setFornecedorId(matchingForn ? matchingForn.id : '')
      }
    } else if (val.startsWith('forn:')) {
      const fId = val.replace('forn:', '')
      setFornecedorId(fId)
      setFornecedorPecaId('')
      const f = fornecedores.find((item) => item.id === fId)
      if (f) setOficinaNome(f.nome)
    }
  }

  const openCreateModal = () => {
    setEditingId(null)
    setExistingContaPagarId(null)
    const firstVeic = veiculos[0]
    setVeiculoId(firstVeic ? firstVeic.id : '')
    setTipo('preventiva')
    setDescricao('')

    const primeiraOficina = fornecedoresPecas[0]
    if (primeiraOficina) {
      setFornecedorPecaId(primeiraOficina.id)
      setOficinaNome(primeiraOficina.nome)
      const matchingForn = fornecedores.find(
        (f) => f.nome.trim().toLowerCase() === primeiraOficina.nome.trim().toLowerCase(),
      )
      setFornecedorId(matchingForn ? matchingForn.id : '')
    } else {
      setFornecedorPecaId('')
      setFornecedorId(fornecedores[0]?.id || '')
      setOficinaNome(fornecedores[0]?.nome || '')
    }

    setDataManut(new Date().toISOString().slice(0, 10))
    setKmNoMomento(firstVeic?.km_atual || 0)
    setHorimetroNoMomento(firstVeic?.horimetro_atual || 0)
    setCusto(0)
    setStatus('concluida')

    // Prazos sugeridos de revisão
    const nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth() + 3)
    setProximaRevisaoData(nextDate.toISOString().slice(0, 10))
    setProximaRevisaoKm(firstVeic?.km_atual ? firstVeic.km_atual + 10000 : 0)
    setProximaRevisaoHorimetro(firstVeic?.horimetro_atual ? firstVeic.horimetro_atual + 250 : 0)

    setGerarFinanceiro(true)
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const openEditModal = (m: Manutencao) => {
    setEditingId(m.id)
    setExistingContaPagarId(m.conta_pagar_id || null)
    setVeiculoId(m.veiculo_id)
    setTipo(m.tipo)
    setDescricao(m.descricao)
    setOficinaNome(m.oficina_nome || '')
    setFornecedorId(m.fornecedor_id || '')

    // Tenta casar com oficina cadastrada na frota
    const fpMatch = fornecedoresPecas.find(
      (fp) =>
        (m.oficina_nome && fp.nome.trim().toLowerCase() === m.oficina_nome.trim().toLowerCase()) ||
        (m.expand?.fornecedor_id &&
          fp.nome.trim().toLowerCase() === m.expand.fornecedor_id.nome.trim().toLowerCase()),
    )
    if (fpMatch) {
      setFornecedorPecaId(fpMatch.id)
    } else {
      setFornecedorPecaId('')
    }

    setDataManut(m.data ? m.data.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setKmNoMomento(m.km_no_momento || 0)
    setHorimetroNoMomento(m.horimetro_no_momento || 0)
    setCusto(m.custo || 0)
    setStatus(m.status)

    setProximaRevisaoData(m.proxima_revisao_data ? m.proxima_revisao_data.slice(0, 10) : '')
    setProximaRevisaoKm(m.proxima_revisao_km || 0)
    setProximaRevisaoHorimetro(m.proxima_revisao_horimetro || 0)

    setGerarFinanceiro(Boolean(m.conta_pagar_id))
    setObservacoes(m.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const v = veiculos.find((x) => x.id === vid)
    if (v) {
      setKmNoMomento(v.km_atual || 0)
      setHorimetroNoMomento(v.horimetro_atual || 0)
      setProximaRevisaoKm(v.km_atual ? v.km_atual + 10000 : 0)
      setProximaRevisaoHorimetro(v.horimetro_atual ? v.horimetro_atual + 250 : 0)
    }
  }

  // Descrição rica para manutenção
  const gerarDescricaoRicaManut = (
    v: Veiculo,
    tipoM: string,
    desc: string,
    oficinaTxt?: string,
  ) => {
    const ofTxt = oficinaTxt ? ` — Oficina: ${oficinaTxt}` : ''
    const veicTxt = `[${v.codigo_interno}${v.placa ? ` ${v.placa}` : ''}]`
    return `Manutenção ${tipoM.toUpperCase()}${ofTxt} — ${veicTxt} — ${desc}`
  }

  // Ação individual: Gerar Conta a Pagar para registro antigo/sem vínculo
  const handleGerarContaPagarIndividual = async (m: Manutencao) => {
    if (!currentEmpresa) return
    if (m.conta_pagar_id) {
      toast({ title: 'Esta manutenção já possui título em Contas a Pagar.' })
      return
    }
    if (!m.custo || m.custo <= 0) {
      toast({
        title: 'Custo zerado',
        description: 'Informe um custo válido na manutenção para gerar o título a pagar.',
        variant: 'destructive',
      })
      return
    }

    try {
      const v = m.expand?.veiculo_id || veiculos.find((ve) => ve.id === m.veiculo_id)
      const descRica = gerarDescricaoRicaManut(
        v || ({ codigo_interno: 'VEIC' } as any),
        m.tipo,
        m.descricao,
        m.oficina_nome || m.expand?.fornecedor_id?.nome,
      )

      const catManut =
        planoContas.find((pc) => pc.codigo === '2.3') ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('manuten')) ||
        null

      const payloadConta = {
        empresa_id: currentEmpresa.id,
        fornecedor_id: m.fornecedor_id || null,
        veiculo_id: m.veiculo_id || null,
        origem_frota: 'manutencao',
        descricao: descRica,
        categoria_id: catManut?.id || null,
        valor: Number(m.custo),
        vencimento: new Date(m.data).toISOString(),
        data_emissao: new Date(m.data).toISOString(),
        parcelas: 1,
        status: 'Aberta',
        observacoes: `Gerado manualmente pela listagem de manutenções. Oficina: ${m.oficina_nome || 'Oficina própria/credenciada'}. Km: ${m.km_no_momento || '—'}, Horas: ${m.horimetro_no_momento || '—'}`,
      }

      const cp = await pb.collection('contas_pagar').create(payloadConta)
      await pb.collection('manutencoes').update(m.id, { conta_pagar_id: cp.id })

      toast({
        title: 'Título gerado com sucesso!',
        description: `Conta a Pagar de ${formatCurrency(m.custo)} vinculada à manutenção.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar Conta a Pagar',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Ação: Desvincular Conta a Pagar
  const handleDesvincularContaPagar = async (m: Manutencao) => {
    if (
      !confirm(
        'Deseja desvincular esta manutenção do Contas a Pagar? O título financeiro existente não será apagado, apenas desvinculado.',
      )
    ) {
      return
    }
    try {
      await pb.collection('manutencoes').update(m.id, { conta_pagar_id: null })
      toast({ title: 'Vínculo removido com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao desvincular', description: err.message, variant: 'destructive' })
    }
  }

  // Ação em Lote: Gerar Contas a Pagar para selecionadas sem vínculo e com custo > 0
  const handleGerarLoteContasPagar = async () => {
    if (selectedIds.length === 0) return
    const elegiveis = manutencoes.filter(
      (m) => selectedIds.includes(m.id) && !m.conta_pagar_id && (m.custo || 0) > 0,
    )

    if (elegiveis.length === 0) {
      toast({
        title: 'Nenhuma manutenção elegível',
        description:
          'Selecione manutenções sem vínculo com o Contas a Pagar e com custo maior que zero.',
      })
      return
    }

    if (
      !confirm(
        `Gerar ${elegiveis.length} título(s) em Contas a Pagar para as manutenções selecionadas?`,
      )
    ) {
      return
    }

    try {
      setIsProcessandoLote(true)
      let sucessos = 0
      const catManut =
        planoContas.find((pc) => pc.codigo === '2.3') ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('manuten')) ||
        null

      for (const m of elegiveis) {
        try {
          const v = m.expand?.veiculo_id || veiculos.find((ve) => ve.id === m.veiculo_id)
          const descRica = gerarDescricaoRicaManut(
            v || ({ codigo_interno: 'VEIC' } as any),
            m.tipo,
            m.descricao,
            m.oficina_nome || m.expand?.fornecedor_id?.nome,
          )

          const payloadConta = {
            empresa_id: currentEmpresa!.id,
            fornecedor_id: m.fornecedor_id || null,
            veiculo_id: m.veiculo_id || null,
            origem_frota: 'manutencao',
            descricao: descRica,
            categoria_id: catManut?.id || null,
            valor: Number(m.custo),
            vencimento: new Date(m.data).toISOString(),
            data_emissao: new Date(m.data).toISOString(),
            parcelas: 1,
            status: 'Aberta',
            observacoes: `Gerado em lote pelo Módulo de Frotas. Oficina: ${m.oficina_nome || 'Oficina própria/credenciada'}. Km: ${m.km_no_momento || '—'}, Horas: ${m.horimetro_no_momento || '—'}`,
          }

          const cp = await pb.collection('contas_pagar').create(payloadConta)
          await pb.collection('manutencoes').update(m.id, { conta_pagar_id: cp.id })
          sucessos++
        } catch (itemErr) {
          console.error(`Erro ao processar manutenção ${m.id}:`, itemErr)
        }
      }

      toast({
        title: 'Geração em lote concluída!',
        description: `${sucessos} título(s) gerado(s) em Contas a Pagar.`,
      })
      setSelectedIds([])
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro na geração em lote',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessandoLote(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veiculoId || !descricao.trim()) {
      toast({ title: 'Selecione o veículo e preencha a descrição', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const v = veiculos.find((item) => item.id === veiculoId)!

      const catManut =
        planoContas.find((pc) => pc.codigo === '2.3') ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('manuten')) ||
        null

      const descRica = gerarDescricaoRicaManut(v, tipo, descricao.trim(), oficinaNome.trim())

      let contaPagarIdFinal: string | null = existingContaPagarId

      // Anti-duplicação: sincroniza existente ou cria novo se solicitado e custo > 0
      if (gerarFinanceiro && custo > 0) {
        if (existingContaPagarId) {
          try {
            await pb.collection('contas_pagar').update(existingContaPagarId, {
              descricao: descRica,
              valor: Number(custo),
              fornecedor_id: fornecedorId || null,
              veiculo_id: v.id,
              origem_frota: 'manutencao',
              vencimento: new Date(dataManut).toISOString(),
            })
          } catch (syncErr) {
            console.warn('Não foi possível sincronizar título existente:', syncErr)
          }
        } else {
          const payloadConta = {
            empresa_id: currentEmpresa!.id,
            fornecedor_id: fornecedorId || null,
            veiculo_id: v.id,
            origem_frota: 'manutencao',
            descricao: descRica,
            categoria_id: catManut?.id || null,
            valor: Number(custo),
            vencimento: new Date(dataManut).toISOString(),
            data_emissao: new Date(dataManut).toISOString(),
            parcelas: 1,
            status: 'Aberta',
            observacoes: `Módulo de Frotas. Oficina: ${oficinaNome || 'Oficina própria/credenciada'}. Km: ${kmNoMomento || '—'}, Horas: ${horimetroNoMomento || '—'}`,
          }

          const cp = await pb.collection('contas_pagar').create(payloadConta)
          contaPagarIdFinal = cp.id
        }
      }

      const medidorPrincipal = kmNoMomento > 0 ? kmNoMomento : horimetroNoMomento || 0
      const medidorProx = proximaRevisaoKm > 0 ? proximaRevisaoKm : proximaRevisaoHorimetro || 0

      const payloadManut = {
        empresa_id: currentEmpresa!.id,
        veiculo_id: veiculoId,
        tipo,
        descricao: descricao.trim(),
        fornecedor_id: fornecedorId || null,
        oficina_nome: oficinaNome.trim() || null,
        data: new Date(dataManut).toISOString(),
        medidor_no_momento: medidorPrincipal,
        km_no_momento: Number(kmNoMomento) || null,
        horimetro_no_momento: Number(horimetroNoMomento) || null,
        custo: Number(custo) || 0,
        status,
        proxima_revisao_data: proximaRevisaoData
          ? new Date(proximaRevisaoData).toISOString()
          : null,
        proxima_revisao_medidor: medidorProx || null,
        proxima_revisao_km: Number(proximaRevisaoKm) || null,
        proxima_revisao_horimetro: Number(proximaRevisaoHorimetro) || null,
        conta_pagar_id: contaPagarIdFinal,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('manutencoes').update(editingId, payloadManut)
        toast({ title: 'Manutenção atualizada com sucesso!' })
      } else {
        await pb.collection('manutencoes').create(payloadManut)

        // Se a manutenção está em andamento, marca o status do veículo como "manutencao"
        if (status === 'em_andamento') {
          await pb.collection('veiculos').update(v.id, { status: 'manutencao' })
        } else if (status === 'concluida' && v.status === 'manutencao') {
          await pb.collection('veiculos').update(v.id, { status: 'ativo' })
        }

        toast({
          title: 'Manutenção registrada!',
          description: contaPagarIdFinal
            ? 'Conta a pagar vinculada no módulo financeiro.'
            : undefined,
        })
      }

      setIsDrawerOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar manutenção',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (m: Manutencao) => {
    if (!confirm('Deseja realmente remover esta manutenção?')) return
    try {
      await pb.collection('manutencoes').delete(m.id)
      toast({ title: 'Manutenção excluída com sucesso.' })
      await loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Alertas de Manutenção Preventiva Próxima ou Vencida (por Data, Km ou Horímetro)
  const alertasList = useMemo(() => {
    const list: Array<{
      veiculo: Veiculo
      motivo: string
      tipoAlerta: 'vencida' | 'proxima'
    }> = []

    const now = new Date()

    veiculos.forEach((v) => {
      const ultManut = manutencoes.find(
        (m) =>
          m.veiculo_id === v.id &&
          (m.proxima_revisao_data || m.proxima_revisao_km || m.proxima_revisao_horimetro),
      )

      if (!ultManut) return

      // Alerta por Data
      if (ultManut.proxima_revisao_data) {
        const dRev = new Date(ultManut.proxima_revisao_data)
        const diffDays = Math.ceil((dRev.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 0) {
          list.push({
            veiculo: v,
            motivo: `Revisão periódica vencida em ${formatDate(ultManut.proxima_revisao_data)}`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffDays <= 15) {
          list.push({
            veiculo: v,
            motivo: `Revisão agendada em ${diffDays} dias (${formatDate(ultManut.proxima_revisao_data)})`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }

      // Alerta por Km
      if (ultManut.proxima_revisao_km && v.km_atual) {
        const diffKm = ultManut.proxima_revisao_km - v.km_atual
        if (diffKm <= 0) {
          list.push({
            veiculo: v,
            motivo: `Limite de Km atingido (${v.km_atual} / ${ultManut.proxima_revisao_km} km)`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffKm <= 1000) {
          list.push({
            veiculo: v,
            motivo: `Faltam apenas ${diffKm} km para a próxima revisão`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }

      // Alerta por Horímetro
      if (ultManut.proxima_revisao_horimetro && v.horimetro_atual) {
        const diffHoras = ultManut.proxima_revisao_horimetro - v.horimetro_atual
        if (diffHoras <= 0) {
          list.push({
            veiculo: v,
            motivo: `Limite de Horas atingido (${v.horimetro_atual}h / ${ultManut.proxima_revisao_horimetro}h)`,
            tipoAlerta: 'vencida',
          })
          return
        } else if (diffHoras <= 50) {
          list.push({
            veiculo: v,
            motivo: `Faltam apenas ${diffHoras} horas para a próxima revisão`,
            tipoAlerta: 'proxima',
          })
          return
        }
      }
    })

    return list
  }, [veiculos, manutencoes])

  // Handlers de seleção por checkbox
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredManutencoes.length && filteredManutencoes.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredManutencoes.map((m) => m.id))
    }
  }

  const handleToggleSelectOne = (id: string, evt?: React.MouseEvent) => {
    if (evt) evt.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter((m) => {
      if (tipoFilter !== 'todos' && m.tipo !== tipoFilter) return false
      if (statusFilter !== 'todos' && m.status !== statusFilter) return false
      if (!estaDentroDoPeriodo(m.data, dataInicio, dataFim)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const cod = m.expand?.veiculo_id?.codigo_interno?.toLowerCase() || ''
        const mod = m.expand?.veiculo_id?.modelo?.toLowerCase() || ''
        const desc = m.descricao?.toLowerCase() || ''
        const ofi = m.oficina_nome?.toLowerCase() || ''
        const forn = m.expand?.fornecedor_id?.nome?.toLowerCase() || ''
        return (
          cod.includes(q) ||
          mod.includes(q) ||
          desc.includes(q) ||
          ofi.includes(q) ||
          forn.includes(q)
        )
      }
      return true
    })
  }, [manutencoes, tipoFilter, statusFilter, dataInicio, dataFim, searchQuery])

  // Contagem de elegíveis sem conta a pagar para botão de lote
  const selecionadasSemContaCount = useMemo(() => {
    return manutencoes.filter(
      (m) => selectedIds.includes(m.id) && !m.conta_pagar_id && (m.custo || 0) > 0,
    ).length
  }, [manutencoes, selectedIds])

  // Itens para impressão
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return filteredManutencoes.filter((m) => set.has(m.id))
    }
    return filteredManutencoes
  }, [filteredManutencoes, selectedIds])

  // Descrição dos filtros aplicados
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (dataInicio || dataFim) {
      const de = dataInicio ? formatDate(dataInicio) : 'Início'
      const ate = dataFim ? formatDate(dataFim) : 'Fim'
      partes.push(`Período: ${de} a ${ate}`)
    } else {
      partes.push('Período: Todas as manutenções')
    }
    if (tipoFilter !== 'todos') {
      partes.push(`Tipo: ${tipoFilter === 'preventiva' ? 'Preventiva' : 'Corretiva'}`)
    }
    if (statusFilter !== 'todos') {
      partes.push(`Status: ${statusFilter}`)
    }
    if (searchQuery.trim()) {
      partes.push(`Busca: "${searchQuery.trim()}"`)
    }
    if (selectedIds.length > 0) {
      partes.push(`Seleção ativa: ${selectedIds.length} item(ns)`)
    }
    return partes.join(' · ')
  }, [dataInicio, dataFim, tipoFilter, statusFilter, searchQuery, selectedIds.length])

  // Colunas do relatório de manutenções
  const colunasRelatorioManut = useMemo<ColunaRelatorioImpressao<Manutencao>[]>(() => {
    return [
      {
        key: 'data',
        header: 'Data',
        className: 'font-mono whitespace-nowrap',
        render: (m) => formatDate(m.data),
      },
      {
        key: 'veiculo',
        header: 'Veículo / Equipamento',
        render: (m) => {
          const veic = m.expand?.veiculo_id
          return (
            <div>
              <span className="font-mono font-bold text-gray-900">
                {veic?.codigo_interno || '—'}
              </span>{' '}
              <span className="text-gray-600">{veic?.modelo}</span>
            </div>
          )
        },
      },
      {
        key: 'tipo',
        header: 'Tipo',
        render: (m) => (m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'),
      },
      {
        key: 'descricao',
        header: 'Descrição do Serviço',
        render: (m) => m.descricao,
      },
      {
        key: 'oficina',
        header: 'Oficina / Fornecedor',
        render: (m) => m.oficina_nome || m.expand?.fornecedor_id?.nome || 'Oficina Própria',
      },
      {
        key: 'medidor',
        header: 'Km / Horas',
        align: 'right',
        className: 'font-mono whitespace-nowrap',
        render: (m) => {
          const parts: string[] = []
          if (m.km_no_momento) parts.push(`${Number(m.km_no_momento).toLocaleString('pt-BR')} km`)
          if (m.horimetro_no_momento) {
            parts.push(`${Number(m.horimetro_no_momento).toLocaleString('pt-BR')} h`)
          }
          return parts.length > 0 ? parts.join(' · ') : '—'
        },
      },
      {
        key: 'custo',
        header: 'Custo Total (R$)',
        align: 'right',
        className: 'font-mono font-bold text-gray-900 whitespace-nowrap',
        render: (m) => formatCurrency(m.custo || 0),
      },
      {
        key: 'status',
        header: 'Status',
        render: (m) => {
          if (m.status === 'concluida') return 'Concluída'
          if (m.status === 'em_andamento') return 'Em Serviço'
          if (m.status === 'agendada') return 'Agendada'
          return 'Cancelada'
        },
      },
      {
        key: 'proxima',
        header: 'Próxima Revisão',
        className: 'font-mono whitespace-nowrap',
        render: (m) => {
          const parts: string[] = []
          if (m.proxima_revisao_data) parts.push(formatDate(m.proxima_revisao_data))
          if (m.proxima_revisao_km) {
            parts.push(`${Number(m.proxima_revisao_km).toLocaleString('pt-BR')} km`)
          }
          if (m.proxima_revisao_horimetro) {
            parts.push(`${Number(m.proxima_revisao_horimetro).toLocaleString('pt-BR')} h`)
          }
          return parts.length > 0 ? parts.join(' / ') : '—'
        },
      },
    ]
  }, [])

  // Totalizadores do relatório de manutenções
  const totalizadoresRelatorioManut = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaCusto = itensParaImpressao.reduce((acc, m) => acc + (m.custo || 0), 0)
    const prevCount = itensParaImpressao.filter((m) => m.tipo === 'preventiva').length
    const corrCount = itensParaImpressao.filter((m) => m.tipo === 'corretiva').length

    return [
      {
        label: 'TOTAIS:',
        value: `${itensParaImpressao.length} O.S. (${prevCount} Prev. / ${corrCount} Corr.)`,
        colSpan: 4,
        align: 'left',
      },
      {
        label: '',
        value: '',
        colSpan: 2,
        align: 'center',
      },
      {
        label: '',
        value: formatCurrency(somaCusto),
        colSpan: 1,
        align: 'right',
        className: 'text-teal-950 font-extrabold',
      },
      {
        label: '',
        value: '',
        colSpan: 2,
        align: 'center',
      },
    ]
  }, [itensParaImpressao])

  // Total de custo de manutenções filtradas por período
  const totalCustoPeriodo = useMemo(() => {
    return filteredManutencoes.reduce((acc, m) => acc + (m.custo || 0), 0)
  }, [filteredManutencoes])

  return (
    <div className="space-y-6">
      {/* Header com Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Ordens de Manutenção & Oficinas
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300">
              Preventivas & Corretivas
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de ordens de serviço da frota pesada, trocas de dentes/peças, tornearia e
            integração financeira
          </p>
        </div>

        {canEdit && activeTab === 'ordens' && (
          <div className="flex items-center gap-2">
            {selecionadasSemContaCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarLoteContasPagar}
                disabled={isProcessandoLote}
                className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs rounded-xl"
              >
                <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
                {isProcessandoLote
                  ? 'Gerando...'
                  : `Gerar Contas a Pagar em Lote (${selecionadasSemContaCount})`}
              </Button>
            )}
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Manutenção
            </Button>
          </div>
        )}
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="bg-white border border-[#ECEAE4] p-1 rounded-xl">
          <TabsTrigger
            value="ordens"
            className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-900 text-xs rounded-lg"
          >
            <Wrench className="w-3.5 h-3.5 mr-1.5" />
            Ordens de Manutenção ({manutencoes.length})
          </TabsTrigger>
          <TabsTrigger
            value="fornecedores_pecas"
            className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-900 text-xs rounded-lg"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Fornecedores de Peças & Oficinas ({fornecedoresPecas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fornecedores_pecas" className="mt-4">
          <FornecedoresPecasTab
            empresaId={currentEmpresa?.id || ''}
            fornecedoresPecas={fornecedoresPecas}
            canEdit={canEdit}
            onReload={loadData}
          />
        </TabsContent>

        <TabsContent value="ordens" className="mt-4 space-y-6">
          {/* Alertas de Revisão Preventiva (Data, Km ou Horímetro) */}
          {alertasList.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Alertas de Manutenção Preventiva ({alertasList.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {alertasList.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      alerta.tipoAlerta === 'vencida'
                        ? 'bg-red-50/80 border-red-200 text-red-900'
                        : 'bg-white border-amber-200 text-amber-950'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-teal-800">
                          {alerta.veiculo.codigo_interno}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            alerta.tipoAlerta === 'vencida'
                              ? 'bg-red-100 text-red-800 border-red-300 text-[9px]'
                              : 'bg-amber-100 text-amber-800 border-amber-300 text-[9px]'
                          }
                        >
                          {alerta.tipoAlerta === 'vencida' ? 'Vencida' : 'Próxima'}
                        </Badge>
                      </div>
                      <p className="font-medium mt-1 truncate">{alerta.veiculo.modelo}</p>
                      <p className="text-[11px] mt-1 text-gray-600">{alerta.motivo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  O.S. no Período
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
                {filteredManutencoes.length}{' '}
                <span className="text-xs font-normal text-gray-500">registros</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {filteredManutencoes.filter((m) => m.tipo === 'preventiva').length} preventivas •{' '}
                {filteredManutencoes.filter((m) => m.tipo === 'corretiva').length} corretivas
              </p>
            </Card>

            <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Custo Total em O.S.
                </span>
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600 mt-2 font-mono tabular-nums">
                {formatCurrency(totalCustoPeriodo)}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Integrado com Contas a Pagar</p>
            </Card>

            <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Máquinas em Serviço
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
                {manutencoes.filter((m) => m.status === 'em_andamento').length}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Equipamentos parados/na oficina</p>
            </Card>
          </div>

          {/* Filtros e Busca */}
          <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-[150px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue placeholder="Tipo de O.S." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="agendada">Agendada</SelectItem>
                    <SelectItem value="em_andamento">Em Serviço</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <Input
                  placeholder="Buscar por veículo, oficina, serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            {/* Barra de Filtro de Período Padrão */}
            <FiltroPeriodoBar
              rotulo="Data da O.S.:"
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
                tipoFilter !== 'todos' ||
                statusFilter !== 'todos' ||
                Boolean(searchQuery.trim()) ||
                selectedIds.length > 0
              }
              onLimpar={() => {
                setOpcaoPeriodo('todos')
                setDataInicio('')
                setDataFim('')
                setTipoFilter('todos')
                setStatusFilter('todos')
                setSearchQuery('')
                setSelectedIds([])
              }}
            />
          </Card>

          {/* Table */}
          <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                    <th className="py-3 px-3 text-center w-8">
                      <Checkbox
                        checked={
                          filteredManutencoes.length > 0 &&
                          selectedIds.length === filteredManutencoes.length
                        }
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Selecionar todas as manutenções visíveis"
                        className="border-gray-300"
                      />
                    </th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Veículo / Máquina</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Descrição do Serviço</th>
                    <th className="py-3 px-4">Oficina / Fornecedor</th>
                    <th className="py-3 px-4 text-right">Km no Momento</th>
                    <th className="py-3 px-4 text-right">Horas no Momento</th>
                    <th className="py-3 px-4 text-right">Custo Total</th>
                    <th className="py-3 px-4 text-center">Financeiro</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEAE4]">
                  {filteredManutencoes.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-gray-400">
                        Nenhuma ordem de manutenção encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredManutencoes.map((m) => {
                      const veic = m.expand?.veiculo_id
                      const temConta = !!m.conta_pagar_id
                      const isSelected = selectedIds.includes(m.id)

                      return (
                        <tr
                          key={m.id}
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
                              onCheckedChange={() => handleToggleSelectOne(m.id)}
                              aria-label={`Selecionar manutenção ${m.id}`}
                              className="border-gray-300"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">
                            {formatDate(m.data)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              <span className="font-mono text-teal-800">
                                {veic?.codigo_interno}
                              </span>
                              <span>•</span>
                              <span className="text-gray-700 truncate max-w-[130px]">
                                {veic?.modelo}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                m.tipo === 'preventiva'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                            >
                              {m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-900 font-medium max-w-[200px] truncate">
                            {m.descricao}
                          </td>
                          <td className="py-3 px-4 text-gray-600 truncate max-w-[140px]">
                            {m.oficina_nome || m.expand?.fornecedor_id?.nome || 'Oficina Própria'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-gray-700">
                            {m.km_no_momento ? (
                              <span>{Number(m.km_no_momento).toLocaleString('pt-BR')} km</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-800">
                            {m.horimetro_no_momento ? (
                              <span>
                                {Number(m.horimetro_no_momento).toLocaleString('pt-BR')} h
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                            {formatCurrency(m.custo || 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {temConta ? (
                              <div className="inline-flex items-center gap-1">
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-normal">
                                  ✓ Vinculado
                                </Badge>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDesvincularContaPagar(m)}
                                    className="text-gray-400 hover:text-red-600 p-0.5 rounded"
                                    title="Desvincular título"
                                  >
                                    <Unlink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ) : canEdit && (m.custo || 0) > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGerarContaPagarIndividual(m)}
                                className="h-6 px-2 text-[10px] border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100"
                              >
                                + Gerar Título
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Sem vínculo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                m.status === 'concluida'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : m.status === 'em_andamento'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : m.status === 'agendada'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                            >
                              {m.status === 'concluida'
                                ? '● Concluída'
                                : m.status === 'em_andamento'
                                  ? '● Em Serviço'
                                  : m.status === 'agendada'
                                    ? '● Agendada'
                                    : '● Cancelada'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {canEdit && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditModal(m)}
                                  className="h-7 w-7 p-0 text-gray-500 hover:text-teal-700 hover:bg-teal-50"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(m)}
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer Create/Edit Form */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[560px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Ordem de Manutenção' : 'Registrar Manutenção de Frota'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Veículo / Equipamento *</Label>
              <ComboboxPesquisavel
                value={veiculoId}
                onChange={handleVeiculoChange}
                placeholder="Pesquisar veículo / equipamento..."
                searchPlaceholder="Buscar por código ou modelo..."
                emptyText="Nenhum equipamento encontrado."
                triggerClassName="mt-1 font-medium"
                options={veiculos.map((v) => ({
                  id: v.id,
                  label: `${v.codigo_interno} • ${v.modelo}`,
                  sublabel: `${v.setor || 'Geral'}${v.placa ? ` • Placa: ${v.placa}` : ''}`,
                  keywords: [v.codigo_interno, v.modelo, v.placa || ''],
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo de Serviço *</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva (Revisão periódica)</SelectItem>
                    <SelectItem value="corretiva">Corretiva (Conserto emergencial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Data da Execução *</Label>
                <Input
                  type="date"
                  required
                  value={dataManut}
                  onChange={(e) => setDataManut(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição do Serviço *</Label>
              <Input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Troca de dentes de caçamba, revisão 10.000km, troca de filtros"
                className="mt-1"
              />
            </div>

            {/* CONTROLE DUPLO: KM E HORÍMETRO NO MOMENTO */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                <span>Leitura dos Medidores no Momento (Km & Horímetro)</span>
                <span className="text-[10px] text-amber-800 font-normal">Opcionais</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-teal-700" />
                    <span>Km no Momento</span>
                  </Label>
                  <Input
                    type="number"
                    value={kmNoMomento || ''}
                    onChange={(e) => setKmNoMomento(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Horímetro no Momento (h)</span>
                  </Label>
                  <Input
                    type="number"
                    value={horimetroNoMomento || ''}
                    onChange={(e) => setHorimetroNoMomento(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Custo Total das Peças/Serviço (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={custo || ''}
                  onChange={(e) => setCusto(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-red-600"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status da O.S.</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendada">Agendada</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-700">
                    Oficina / Fornecedor
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false)
                      setActiveTab('fornecedores_pecas')
                    }}
                    className="text-[11px] text-teal-700 hover:underline"
                  >
                    + Nova Oficina
                  </button>
                </div>
                <ComboboxPesquisavel
                  value={selectedOficinaOuFornId}
                  onChange={handleSelectOficinaOuForn}
                  placeholder="Selecione a oficina ou fornecedor..."
                  searchPlaceholder="Buscar oficina cadastrada..."
                  emptyText="Nenhuma oficina encontrada."
                  triggerClassName="mt-1"
                  options={opcoesOficinasFornecedores}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Nome da Oficina (Livre / Histórico)
                </Label>
                <Input
                  value={oficinaNome}
                  onChange={(e) => setOficinaNome(e.target.value)}
                  placeholder="Ex: Oficina Mecânica Sertânia"
                  className="mt-1"
                />
              </div>
            </div>

            {/* PROGRAMAÇÃO DA PRÓXIMA REVISÃO */}
            <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-3">
              <span className="font-semibold text-gray-900 block text-xs">
                Programação da Próxima Revisão Preventiva
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-gray-600">Próxima Data</Label>
                  <Input
                    type="date"
                    value={proximaRevisaoData}
                    onChange={(e) => setProximaRevisaoData(e.target.value)}
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-600">Próximo Km</Label>
                  <Input
                    type="number"
                    value={proximaRevisaoKm || ''}
                    onChange={(e) => setProximaRevisaoKm(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-600">Próximas Horas (h)</Label>
                  <Input
                    type="number"
                    value={proximaRevisaoHorimetro || ''}
                    onChange={(e) => setProximaRevisaoHorimetro(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1 font-mono text-[11px] h-8 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox Integração Financeiro com Anti-Duplicação */}
            <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200 flex items-start space-x-3">
              <input
                type="checkbox"
                id="gerarFinanceiroManut"
                checked={gerarFinanceiro}
                onChange={(e) => setGerarFinanceiro(e.target.checked)}
                className="mt-1 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
              />
              <label htmlFor="gerarFinanceiroManut" className="cursor-pointer text-xs">
                <span className="font-semibold text-teal-900 block">
                  {existingContaPagarId
                    ? 'Sincronizar título correspondente em Contas a Pagar'
                    : 'Gerar Conta a Pagar automaticamente no Financeiro'}
                </span>
                <span className="text-teal-700 text-[11px] block mt-0.5">
                  {existingContaPagarId
                    ? `Título vinculado #${existingContaPagarId.slice(0, 8)}. Salvar atualizará valor (${formatCurrency(custo)}) e descrição sem duplicar registro.`
                    : `Lança o valor total de ${formatCurrency(custo)} na categoria "Manutenção - Frota" vinculada ao fornecedor ou oficina.`}
                </span>
              </label>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações Técnicas</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Peças substituídas, garantia de 90 dias, notas de peças..."
                className="mt-1 text-xs"
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
                  : editingId
                    ? 'Atualizar Manutenção'
                    : 'Confirmar Manutenção'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Relatório de Impressão A4 de Manutenções */}
      <RelatorioListagemImpressaoModal
        open={relatorioImpressaoOpen}
        onOpenChange={setRelatorioImpressaoOpen}
        titulo="Ordens de Manutenção de Frota — Relatório de Itens"
        subtitulo="Demonstrativo de Serviços Preventivos e Corretivos, Oficinas e Custos da Frota"
        badgeDestaque="Manutenção Frota"
        empresa={currentEmpresa}
        usuarioNome={user?.name || user?.email || 'Administrador'}
        filtrosDescricao={descricaoFiltrosAplicados}
        itens={itensParaImpressao}
        colunas={colunasRelatorioManut}
        totais={totalizadoresRelatorioManut}
        mensagemVazio="Nenhuma manutenção encontrada para os filtros ou seleção atual."
      />
    </div>
  )
}
