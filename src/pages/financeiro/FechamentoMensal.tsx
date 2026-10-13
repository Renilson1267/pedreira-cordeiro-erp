import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { FechamentoMensal, ItemDespesaFechamento, Empresa } from '@/types/erp'
import {
  fechamentosMensaisService,
  CreateFechamentoMensalPayload,
  PuxarFinanceiroResultado,
  ITENS_DESPESAS_PADRAO_DIRETORIA,
} from '@/services/fechamentosMensais'
import { UNIDADES_GC } from '@/data/institucional'
import { FechamentoMensalImpressaoModal } from '@/components/financeiro/FechamentoMensalImpressaoModal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  FileText,
  Plus,
  Trash2,
  Printer,
  Download,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Calculator,
  RefreshCw,
  Edit,
  DollarSign,
  TrendingUp,
  Fuel,
  Package,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

const MESES = [
  { value: 1, label: '01 - Janeiro' },
  { value: 2, label: '02 - Fevereiro' },
  { value: 3, label: '03 - Março' },
  { value: 4, label: '04 - Abril' },
  { value: 5, label: '05 - Maio' },
  { value: 6, label: '06 - Junho' },
  { value: 7, label: '07 - Julho' },
  { value: 8, label: '08 - Agosto' },
  { value: 9, label: '09 - Setembro' },
  { value: 10, label: '10 - Outubro' },
  { value: 11, label: '11 - Novembro' },
  { value: 12, label: '12 - Dezembro' },
]

export default function FechamentoMensalPage() {
  const { currentEmpresa, canEdit, isReadOnly } = useCompany()
  const { user } = useAuth()

  const [fechamentos, setFechamentos] = useState<FechamentoMensal[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(false)
  const [filtroEmpresaId, setFiltroEmpresaId] = useState<string>('todas')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('')

  // Estado do modal de cadastro/edição
  const [modalFormOpen, setModalFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [puxandoFinanceiro, setPuxandoFinanceiro] = useState(false)

  // Estado do modal de confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Estado do modal de impressão de diretoria
  const [modalImpressaoOpen, setModalImpressaoOpen] = useState(false)
  const [fechamentoImpressao, setFechamentoImpressao] = useState<FechamentoMensal | null>(null)

  // Campos do formulário
  const [formEmpresaId, setFormEmpresaId] = useState<string>('')
  const [formFilialNome, setFormFilialNome] = useState<string>('São José do Egito (SJE)')
  const [formAno, setFormAno] = useState<number>(2026)
  const [formMes, setFormMes] = useState<number>(9)
  const [formFaturamento, setFormFaturamento] = useState<string>('')
  const [formProducaoM3, setFormProducaoM3] = useState<string>('')
  const [formValorMedioM3Manual, setFormValorMedioM3Manual] = useState<string>('')
  const [formDespesas, setFormDespesas] = useState<ItemDespesaFechamento[]>([])
  const [formConsumoCimentoKg, setFormConsumoCimentoKg] = useState<string>('')
  const [formConsumoBritaKg, setFormConsumoBritaKg] = useState<string>('')
  const [formConsumoAreiaM3, setFormConsumoAreiaM3] = useState<string>('')
  const [formConsumoPoPedra, setFormConsumoPoPedra] = useState<string>('')
  const [formConsumoAditivo, setFormConsumoAditivo] = useState<string>('')
  const [formConsumoCombustivelLitros, setFormConsumoCombustivelLitros] = useState<string>('')
  const [formInvestimento, setFormInvestimento] = useState<string>('')
  const [formInvestimentoDescricao, setFormInvestimentoDescricao] = useState<string>('')
  const [formStatus, setFormStatus] = useState<'rascunho' | 'fechado' | 'entregue_diretoria'>(
    'fechado',
  )
  const [formObservacoes, setFormObservacoes] = useState<string>('')
  const [formResponsavelNome, setFormResponsavelNome] = useState<string>('')

  // Lista de filiais pré-sugeridas para preenchimento ágil
  const filiaisSugeridas = useMemo(() => {
    return ['São José do Egito (SJE)', 'Patos (Matriz)', 'Monteiro', 'Santa Luzia', 'Caicó']
  }, [])

  // Carregar lista de fechamentos
  const carregarFechamentos = useCallback(async () => {
    try {
      setLoading(true)
      const lista = await fechamentosMensaisService.listar()
      setFechamentos(lista)
    } catch (err) {
      console.error('Erro ao listar fechamentos mensais:', err)
      toast({
        title: 'Erro ao carregar fechamentos',
        description: 'Não foi possível carregar a listagem.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Carregar lista de empresas cadastradas
  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const emps = await pb.collection('empresas').getFullList<Empresa>({ sort: 'nome_fantasia' })
        setEmpresas(emps)
      } catch (err) {
        console.warn('Erro ao carregar empresas:', err)
      }
    }
    carregarEmpresas()
    carregarFechamentos()
  }, [carregarFechamentos])

  // Inicializar formulário vazio com modelo padrão de despesas
  const inicializarFormVazio = (predefinirSJE = false) => {
    setEditingId(null)
    setFormEmpresaId(currentEmpresa?.id || (empresas[0]?.id ?? ''))
    setFormFilialNome(
      predefinirSJE
        ? 'São José do Egito (SJE)'
        : currentEmpresa?.nome_fantasia || 'São José do Egito (SJE)',
    )
    setFormAno(2026)
    setFormMes(9) // 09/2026 solicitado para estar pronto para a filial SJE
    setFormFaturamento('')
    setFormProducaoM3('')
    setFormValorMedioM3Manual('')
    setFormConsumoCimentoKg('')
    setFormConsumoBritaKg('')
    setFormConsumoAreiaM3('')
    setFormConsumoPoPedra('')
    setFormConsumoAditivo('')
    setFormConsumoCombustivelLitros('')
    setFormInvestimento('')
    setFormInvestimentoDescricao('')
    setFormStatus('fechado')
    setFormObservacoes('')
    setFormResponsavelNome(user?.name || '')

    // Inicializar despesas padrão do PDF do usuário
    // Linha PRO LAB GABRIEL (sem valor no PDF inicial) e USINA (R$ 0,00 no PDF)
    const despesasBase: ItemDespesaFechamento[] = [
      { id: '1', nome: 'PRO LAB GABRIEL', valor: 0, ordem: 1 },
      { id: '2', nome: 'USINA', valor: 0, ordem: 2 },
      { id: '3', nome: 'FOLHA DE PAGAMENTO', valor: 0, ordem: 3 },
      { id: '4', nome: 'COMBUSTÍVEL', valor: 0, ordem: 4 },
      { id: '5', nome: 'MANUTENÇÃO / PEÇAS', valor: 0, ordem: 5 },
      { id: '6', nome: 'ALUGUEL', valor: 0, ordem: 6 },
      { id: '7', nome: 'ENERGIA', valor: 0, ordem: 7 },
      { id: '8', nome: 'IMPOSTOS', valor: 0, ordem: 8 },
      { id: '9', nome: 'ALIMENTAÇÃO / REFEIÇÃO', valor: 0, ordem: 9 },
    ]
    setFormDespesas(despesasBase)
  }

  const abrirNovoFechamento = () => {
    inicializarFormVazio(true)
    setModalFormOpen(true)
  }

  const abrirEdicao = (fechamento: FechamentoMensal) => {
    setEditingId(fechamento.id)
    setFormEmpresaId(fechamento.empresa_id)
    setFormFilialNome(fechamento.filial_nome || 'São José do Egito (SJE)')

    const [a, m] = fechamento.competencia ? fechamento.competencia.split('-') : ['2026', '9']
    setFormAno(Number(a) || fechamento.ano || 2026)
    setFormMes(Number(m) || fechamento.mes || 9)

    setFormFaturamento(fechamento.faturamento !== undefined ? String(fechamento.faturamento) : '')
    setFormProducaoM3(fechamento.producao_m3 !== undefined ? String(fechamento.producao_m3) : '')
    setFormValorMedioM3Manual(
      fechamento.valor_medio_m3 !== undefined ? String(fechamento.valor_medio_m3) : '',
    )

    setFormDespesas(
      fechamento.despesas_itens && fechamento.despesas_itens.length > 0
        ? fechamento.despesas_itens
        : [
            { id: '1', nome: 'PRO LAB GABRIEL', valor: 0, ordem: 1 },
            { id: '2', nome: 'USINA', valor: 0, ordem: 2 },
          ],
    )

    setFormConsumoCimentoKg(
      fechamento.consumo_cimento_kg !== undefined ? String(fechamento.consumo_cimento_kg) : '',
    )
    setFormConsumoBritaKg(
      fechamento.consumo_brita_kg !== undefined ? String(fechamento.consumo_brita_kg) : '',
    )
    setFormConsumoAreiaM3(
      fechamento.consumo_areia_m3 !== undefined ? String(fechamento.consumo_areia_m3) : '',
    )
    setFormConsumoPoPedra(
      fechamento.consumo_po_pedra !== undefined ? String(fechamento.consumo_po_pedra) : '',
    )
    setFormConsumoAditivo(
      fechamento.consumo_aditivo !== undefined ? String(fechamento.consumo_aditivo) : '',
    )
    setFormConsumoCombustivelLitros(
      fechamento.consumo_combustivel_litros !== undefined
        ? String(fechamento.consumo_combustivel_litros)
        : '',
    )

    setFormInvestimento(
      fechamento.investimento !== undefined ? String(fechamento.investimento) : '',
    )
    setFormInvestimentoDescricao(fechamento.investimento_descricao || '')
    setFormStatus(fechamento.status || 'fechado')
    setFormObservacoes(fechamento.observacoes || '')
    setFormResponsavelNome(fechamento.responsavel_nome || '')

    setModalFormOpen(true)
  }

  // Cálculos automáticos do formulário
  const totalDespesasCalculado = useMemo(() => {
    return formDespesas.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
  }, [formDespesas])

  const despesasComPercentual = useMemo(() => {
    return formDespesas.map((it) => {
      const v = Number(it.valor) || 0
      const perc = totalDespesasCalculado > 0 ? (v / totalDespesasCalculado) * 100 : 0
      return {
        ...it,
        valor: v,
        percentual: Number(perc.toFixed(2)),
      }
    })
  }, [formDespesas, totalDespesasCalculado])

  const fatNum = Number(formFaturamento) || 0
  const prodNum = Number(formProducaoM3) || 0

  const valorMedioM3Calculado = useMemo(() => {
    if (formValorMedioM3Manual.trim() !== '') {
      return Number(formValorMedioM3Manual) || 0
    }
    return prodNum > 0 ? fatNum / prodNum : 0
  }, [formValorMedioM3Manual, prodNum, fatNum])

  const invNum = Number(formInvestimento) || 0
  const saldoFinalCalculado = useMemo(() => {
    return fatNum - totalDespesasCalculado - invNum
  }, [fatNum, totalDespesasCalculado, invNum])

  // Manipulação de despesas na grade
  const handleAlterarItemDespesa = (
    index: number,
    campo: 'nome' | 'valor' | 'observacao',
    valor: any,
  ) => {
    setFormDespesas((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [campo]: campo === 'valor' ? (valor === '' ? 0 : Number(valor)) : valor,
      }
      return next
    })
  }

  const handleAdicionarItemDespesa = () => {
    setFormDespesas((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        nome: '',
        valor: 0,
        ordem: prev.length + 1,
      },
    ])
  }

  const handleRemoverItemDespesa = (index: number) => {
    setFormDespesas((prev) => prev.filter((_, i) => i !== index))
  }

  // BOTÃO "Puxar do Financeiro"
  const handlePuxarDoFinanceiro = async () => {
    const empresaTarget = formEmpresaId || currentEmpresa?.id
    if (!empresaTarget) {
      toast({
        title: 'Selecione a empresa',
        description: 'É necessário indicar a empresa antes de buscar lançamentos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setPuxandoFinanceiro(true)
      const res: PuxarFinanceiroResultado = await fechamentosMensaisService.puxarDoFinanceiro(
        empresaTarget,
        formAno,
        formMes,
      )

      // Preencher campos que vierem do financeiro e que ainda não estejam bloqueados
      if (res.faturamentoSugerido > 0) {
        setFormFaturamento(String(res.faturamentoSugerido))
      }
      if (res.producaoM3Sugerida > 0) {
        setFormProducaoM3(String(res.producaoM3Sugerida))
      }
      if (res.combustivelLitrosTotal > 0) {
        setFormConsumoCombustivelLitros(String(res.combustivelLitrosTotal))
      }

      // Se houver despesas identificadas no financeiro, mesclar mantendo itens manuais
      if (res.despesasSugeridas.length > 0) {
        setFormDespesas((prev) => {
          // Manter linhas PRO LAB GABRIEL e USINA se já existirem
          const mapaExistentes = new Map<string, ItemDespesaFechamento>()
          prev.forEach((d) => mapaExistentes.set(d.nome.trim().toUpperCase(), d))

          res.despesasSugeridas.forEach((dSug) => {
            const key = dSug.nome.trim().toUpperCase()
            if (mapaExistentes.has(key)) {
              // Se já existia e não tinha valor preenchido ou tinha 0, atualizar
              const exist = mapaExistentes.get(key)!
              if (exist.valor === 0 && dSug.valor > 0) {
                mapaExistentes.set(key, { ...exist, valor: dSug.valor })
              }
            } else {
              mapaExistentes.set(key, dSug)
            }
          })

          return Array.from(mapaExistentes.values())
        })
      }

      toast({
        title: 'Lançamentos puxados com sucesso!',
        description: `Encontrados R$ ${formatCurrency(res.faturamentoSugerido)} em recebimentos/vendas e ${res.despesasSugeridas.length} agrupamentos de despesas.`,
      })
    } catch (err) {
      console.error('Erro ao puxar dados do financeiro:', err)
      toast({
        title: 'Aviso',
        description:
          'Não foram encontrados lançamentos suficientes para essa competência ou ocorreu uma falha.',
      })
    } finally {
      setPuxandoFinanceiro(false)
    }
  }

  // Salvar fechamento (criar ou atualizar)
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()

    const empresaTarget = formEmpresaId || currentEmpresa?.id
    if (!empresaTarget) {
      toast({
        title: 'Empresa obrigatória',
        description: 'Por favor, selecione a empresa/filial.',
        variant: 'destructive',
      })
      return
    }

    const competenciaFormatada = `${formAno}-${String(formMes).padStart(2, '0')}`

    try {
      setSaving(true)

      const payload: CreateFechamentoMensalPayload = {
        empresa_id: empresaTarget,
        filial_nome: formFilialNome.trim() || 'São José do Egito (SJE)',
        competencia: competenciaFormatada,
        mes: formMes,
        ano: formAno,
        faturamento: fatNum,
        producao_m3: prodNum,
        valor_medio_m3: valorMedioM3Calculado,
        despesas_itens: despesasComPercentual,
        total_despesas: totalDespesasCalculado,
        consumo_cimento_kg: formConsumoCimentoKg ? Number(formConsumoCimentoKg) : undefined,
        consumo_brita_kg: formConsumoBritaKg ? Number(formConsumoBritaKg) : undefined,
        consumo_areia_m3: formConsumoAreiaM3 ? Number(formConsumoAreiaM3) : undefined,
        consumo_po_pedra: formConsumoPoPedra ? Number(formConsumoPoPedra) : undefined,
        consumo_aditivo: formConsumoAditivo ? Number(formConsumoAditivo) : undefined,
        consumo_combustivel_litros: formConsumoCombustivelLitros
          ? Number(formConsumoCombustivelLitros)
          : undefined,
        investimento: invNum,
        investimento_descricao: formInvestimentoDescricao.trim(),
        saldo_apos_investimento: saldoFinalCalculado,
        status: formStatus,
        observacoes: formObservacoes.trim(),
        responsavel_nome: formResponsavelNome.trim(),
      }

      if (editingId) {
        await fechamentosMensaisService.atualizar(editingId, payload)
        toast({
          title: 'Fechamento atualizado com sucesso!',
          description: `Competência ${competenciaFormatada} salva.`,
        })
      } else {
        // Verificar se já existe fechamento para filial + competência
        const existente = await fechamentosMensaisService.buscarPorCompetencia(
          empresaTarget,
          competenciaFormatada,
        )
        if (existente) {
          toast({
            title: 'Fechamento já existente',
            description: `Já existe um fechamento cadastrado para esta filial na competência ${competenciaFormatada}. Edite o registro existente ou escolha outro mês/filial.`,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }

        await fechamentosMensaisService.criar(payload)
        toast({
          title: 'Fechamento mensal registrado com sucesso!',
          description: `Competência ${competenciaFormatada} pronta para entrega à diretoria.`,
        })
      }

      setModalFormOpen(false)
      await carregarFechamentos()
    } catch (err: any) {
      console.error('Erro ao salvar fechamento mensal:', err)
      const msg = err?.message || 'Verifique os campos e tente novamente.'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Excluir fechamento
  const handleConfirmarExclusao = async () => {
    if (!deletingId) return
    try {
      await fechamentosMensaisService.excluir(deletingId)
      toast({
        title: 'Fechamento excluído com sucesso!',
      })
      setDeleteConfirmOpen(false)
      setDeletingId(null)
      await carregarFechamentos()
    } catch (err) {
      console.error('Erro ao excluir fechamento:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o registro.',
        variant: 'destructive',
      })
    }
  }

  // Filtragem da tabela
  const fechamentosFiltrados = useMemo(() => {
    return fechamentos.filter((f) => {
      if (filtroEmpresaId !== 'todas' && f.empresa_id !== filtroEmpresaId) {
        return false
      }
      if (filtroCompetencia && !f.competencia.includes(filtroCompetencia)) {
        return false
      }
      return true
    })
  }, [fechamentos, filtroEmpresaId, filtroCompetencia])

  const abrirImpressao = (f: FechamentoMensal) => {
    setFechamentoImpressao(f)
    setModalImpressaoOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fechamento Mensal</h1>
            <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200">
              Diretoria
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Fechamento de caixa por filial e competência para prestação de contas à diretoria
            (Resumo, Despesas com %, Insumos, Investimento e Saldo).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canEdit && (
            <Button
              onClick={abrirNovoFechamento}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-xs"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Fechamento
            </Button>
          )}
        </div>
      </div>

      {/* Cartão de Destaque / Instruções */}
      <Card className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white border-none shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-1.5 bg-teal-600/40 text-teal-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pronto para 09/2026 — Filial São José do Egito (SJE)</span>
              </div>
              <h2 className="text-lg font-bold">Relatório Oficial de Caixa de Diretoria</h2>
              <p className="text-xs text-teal-100/90 max-w-2xl leading-relaxed">
                Estrutura idêntica ao demonstrativo do grupo: <strong>Resumo</strong> (faturamento,
                m³ e preço médio), <strong>Despesas por item</strong> com percentual calculado,{' '}
                <strong>Consumo de insumos</strong> (cimento, brita, areia, pó de pedra, aditivo e
                combustível), <strong>Investimento</strong> e <strong>Saldo final</strong>.
              </p>
            </div>
            {canEdit && (
              <Button
                onClick={() => {
                  inicializarFormVazio(true)
                  setModalFormOpen(true)
                }}
                variant="secondary"
                size="sm"
                className="bg-white text-teal-900 hover:bg-teal-50 font-bold shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Registrar Fechamento SJE
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filtros da Tabela */}
      <Card className="bg-white border-[#ECEAE4]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs text-gray-500 font-medium">Filial / Empresa</Label>
              <Select value={filtroEmpresaId} onValueChange={setFiltroEmpresaId}>
                <SelectTrigger className="mt-1 h-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-500 font-medium">Competência (ex: 2026-09)</Label>
              <Input
                type="text"
                placeholder="AAAA-MM (ex: 2026-09)"
                value={filtroCompetencia}
                onChange={(e) => setFiltroCompetencia(e.target.value)}
                className="mt-1 h-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={carregarFechamentos}
                disabled={loading}
                className="h-9 text-xs border-[#ECEAE4]"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar Lista
              </Button>
              {(filtroEmpresaId !== 'todas' || filtroCompetencia) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroEmpresaId('todas')
                    setFiltroCompetencia('')
                  }}
                  className="h-9 text-xs text-gray-500"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Fechamentos Mensais */}
      <Card className="bg-white border-[#ECEAE4]">
        <CardHeader className="py-4 px-6 border-b border-[#ECEAE4]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                Histórico de Fechamentos Registrados
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                {fechamentosFiltrados.length} fechamento(s) encontrado(s)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-600">
                  <th className="py-3 px-4 font-semibold">Competência</th>
                  <th className="py-3 px-4 font-semibold">Filial / Unidade</th>
                  <th className="py-3 px-4 font-semibold text-right">Faturamento</th>
                  <th className="py-3 px-4 font-semibold text-right">Produção m³</th>
                  <th className="py-3 px-4 font-semibold text-right">Valor Médio / m³</th>
                  <th className="py-3 px-4 font-semibold text-right">Despesas</th>
                  <th className="py-3 px-4 font-semibold text-right">Saldo Final</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE4]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-teal-600" />
                      Carregando fechamentos mensais...
                    </td>
                  </tr>
                ) : fechamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="font-medium text-gray-700">
                        Nenhum fechamento registrado ainda.
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Clique em <strong>Novo Fechamento</strong> para cadastrar o mês de
                        competência (como 09/2026 da filial SJE).
                      </p>
                      {canEdit && (
                        <Button
                          onClick={abrirNovoFechamento}
                          size="sm"
                          className="mt-4 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Criar Primeiro Fechamento
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  fechamentosFiltrados.map((item) => {
                    const [a, m] = item.competencia ? item.competencia.split('-') : ['', '']
                    const mesLabel =
                      MESES.find((x) => x.value === Number(m))?.label.replace(/^\d+\s-\s/, '') || m
                    const rotuloCompetencia = `${mesLabel} / ${a}`

                    const faturamento = Number(item.faturamento || 0)
                    const producaoM3 = Number(item.producao_m3 || 0)
                    const valorMedio =
                      item.valor_medio_m3 !== undefined && item.valor_medio_m3 !== null
                        ? Number(item.valor_medio_m3)
                        : producaoM3 > 0
                          ? faturamento / producaoM3
                          : 0
                    const despesas = Number(item.total_despesas || 0)
                    const saldo =
                      item.saldo_apos_investimento !== undefined &&
                      item.saldo_apos_investimento !== null
                        ? Number(item.saldo_apos_investimento)
                        : faturamento - despesas - Number(item.investimento || 0)

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                          <span className="font-mono text-teal-800">{item.competencia}</span>
                          <span className="block text-[11px] font-normal text-gray-500">
                            {rotuloCompetencia}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-800 block">
                            {item.filial_nome || 'Filial não especificada'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.expand?.empresa_id?.nome_fantasia || 'Grupo GC'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                          {formatCurrency(faturamento)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-800">
                          {producaoM3 > 0 ? `${producaoM3.toLocaleString('pt-BR')} m³` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-700">
                          {valorMedio > 0 ? formatCurrency(valorMedio) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-700">
                          {formatCurrency(despesas)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          <span className={saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                            {formatCurrency(saldo)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold ${
                              item.status === 'entregue_diretoria'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : item.status === 'fechado'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {item.status === 'entregue_diretoria'
                              ? 'Entregue Diretoria'
                              : item.status === 'fechado'
                                ? 'Fechado'
                                : 'Rascunho'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirImpressao(item)}
                              title="Visualizar / Imprimir Layout Diretoria (A4)"
                              className="h-7 px-2 text-xs bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              Imprimir A4
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEdicao(item)}
                                title="Editar fechamento"
                                className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingId(item.id)
                                  setDeleteConfirmOpen(true)
                                }}
                                title="Excluir fechamento"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </CardContent>
      </Card>

      {/* MODAL DE CADASTRO / EDIÇÃO MANUAL COMPLETO */}
      <Dialog open={modalFormOpen} onOpenChange={setModalFormOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="border-b border-[#ECEAE4] pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  {editingId ? 'Editar Fechamento Mensal' : 'Novo Fechamento Mensal — Diretoria'}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Preencha manualmente todos os campos do relatório do grupo ou use o botão para
                  puxar do financeiro.
                </DialogDescription>
              </div>
              <Badge className="bg-teal-700 text-white text-[11px]">
                {formFilialNome || 'Filial'} • {String(formMes).padStart(2, '0')}/{formAno}
              </Badge>
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-6 pt-2">
            {/* BARRA SUPERIOR: Competência, Filial e Botão "Puxar do Financeiro" */}
            <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#ECEAE4] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Empresa / Grupo *</Label>
                  <Select value={formEmpresaId} onValueChange={setFormEmpresaId}>
                    <SelectTrigger className="mt-1 h-9 bg-white border-[#ECEAE4] text-xs">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome_fantasia || e.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Filial / Unidade *</Label>
                  <Input
                    value={formFilialNome}
                    onChange={(e) => setFormFilialNome(e.target.value)}
                    placeholder="Ex: São José do Egito (SJE)"
                    className="mt-1 h-9 bg-white border-[#ECEAE4] text-xs font-medium"
                    required
                  />
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {filiaisSugeridas.slice(0, 3).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormFilialNome(f)}
                        className="text-[10px] text-teal-700 hover:underline bg-teal-50 px-1 py-0.2 rounded"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Mês *</Label>
                  <Select value={String(formMes)} onValueChange={(val) => setFormMes(Number(val))}>
                    <SelectTrigger className="mt-1 h-9 bg-white border-[#ECEAE4] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Ano *</Label>
                  <Input
                    type="number"
                    value={formAno}
                    onChange={(e) => setFormAno(Number(e.target.value))}
                    min={2020}
                    max={2035}
                    className="mt-1 h-9 bg-white border-[#ECEAE4] text-xs font-mono font-medium"
                    required
                  />
                </div>
              </div>

              {/* Botão de Integração Automática com o Financeiro */}
              <div className="pt-2 border-t border-[#ECEAE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    Puxa automaticamente contas a pagar, receber, abastecimentos e vendas do
                    período. O que não existir fica 100% manual.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePuxarDoFinanceiro}
                  disabled={puxandoFinanceiro}
                  className="bg-white hover:bg-teal-50 text-teal-800 border-teal-300 font-semibold text-xs shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 text-teal-600 ${
                      puxandoFinanceiro ? 'animate-spin' : ''
                    }`}
                  />
                  Puxar do Financeiro
                </Button>
              </div>
            </div>

            {/* 1. SEÇÃO: RESUMO (FATURAMENTO, PRODUÇÃO M³, VALOR MÉDIO POR M³) */}
            <div className="border border-[#ECEAE4] rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center space-x-2 text-teal-900 border-b border-[#ECEAE4] pb-2">
                <Calculator className="w-4 h-4 text-teal-700" />
                <h3 className="font-bold text-sm">1. Resumo Operacional e Faturamento</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 font-medium">Faturamento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formFaturamento}
                    onChange={(e) => setFormFaturamento(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Receita total faturada no mês
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Produção em m³</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formProducaoM3}
                    onChange={(e) => setFormProducaoM3(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Volume de concreto usinado
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">
                    Valor Médio por m³ (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={
                      valorMedioM3Calculado > 0
                        ? `Auto: ${valorMedioM3Calculado.toFixed(2)}`
                        : '0.00'
                    }
                    value={formValorMedioM3Manual}
                    onChange={(e) => setFormValorMedioM3Manual(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {valorMedioM3Calculado > 0
                      ? `Calculado: ${formatCurrency(valorMedioM3Calculado)}/m³`
                      : 'Faturamento ÷ Produção m³'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. SEÇÃO: DESPESAS POR ITEM COM VALOR E % CALCULADO */}
            <div className="border border-[#ECEAE4] rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-[#ECEAE4] pb-2">
                <div className="flex items-center space-x-2 text-teal-900">
                  <TrendingUp className="w-4 h-4 text-teal-700" />
                  <h3 className="font-bold text-sm">2. Despesas por Item</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-red-700">
                    Total: {formatCurrency(totalDespesasCalculado)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdicionarItemDespesa}
                    className="h-7 text-xs border-[#ECEAE4]"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Item
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 bg-amber-50/70 p-2 rounded-md border border-amber-200">
                Linhas obrigatórias da estrutura da diretoria: <strong>PRO LAB GABRIEL</strong>{' '}
                (pode ficar zerado ou sem valor) e <strong>USINA</strong> (R$ 0,00). O percentual de
                cada item é calculado dinamicamente sobre o total de despesas.
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {despesasComPercentual.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center gap-2 bg-[#FAF9F7] p-2 rounded-lg border border-[#ECEAE4]"
                  >
                    <span className="text-[11px] font-mono font-bold text-gray-400 w-5 text-center">
                      {idx + 1}
                    </span>
                    <Input
                      placeholder="Nome da despesa (ex: USINA)"
                      value={item.nome}
                      onChange={(e) => handleAlterarItemDespesa(idx, 'nome', e.target.value)}
                      className="h-8 text-xs font-semibold flex-1 bg-white"
                      required
                    />
                    <div className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.valor === 0 ? '0' : item.valor}
                        onChange={(e) => handleAlterarItemDespesa(idx, 'valor', e.target.value)}
                        className="h-8 text-xs font-mono text-right bg-white"
                      />
                    </div>
                    <div className="w-20 text-right pr-2">
                      <span className="text-xs font-mono font-bold text-gray-600 block">
                        {item.percentual || 0}%
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoverItemDespesa(idx)}
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                      title="Remover linha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. SEÇÃO: CONSUMO DE INSUMOS */}
            <div className="border border-[#ECEAE4] rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center space-x-2 text-teal-900 border-b border-[#ECEAE4] pb-2">
                <Package className="w-4 h-4 text-teal-700" />
                <h3 className="font-bold text-sm">3. Consumo de Insumos</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 font-medium">Cimento (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 50000"
                    value={formConsumoCimentoKg}
                    onChange={(e) => setFormConsumoCimentoKg(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Peso em quilogramas
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Brita (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 120000"
                    value={formConsumoBritaKg}
                    onChange={(e) => setFormConsumoBritaKg(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Peso em quilogramas
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Areia (m³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 85"
                    value={formConsumoAreiaM3}
                    onChange={(e) => setFormConsumoAreiaM3(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Volume em metros cúbicos
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Pó de Pedra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 40"
                    value={formConsumoPoPedra}
                    onChange={(e) => setFormConsumoPoPedra(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Pedreira Cordeiro</span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Aditivo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 250"
                    value={formConsumoAditivo}
                    onChange={(e) => setFormConsumoAditivo(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Aditivo químico</span>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 font-medium">Combustível (litros)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1800"
                    value={formConsumoCombustivelLitros}
                    onChange={(e) => setFormConsumoCombustivelLitros(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Consumo total frota
                  </span>
                </div>
              </div>
            </div>

            {/* 4. INVESTIMENTO & 5. SALDO APÓS INVESTIMENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 4. Investimento */}
              <div className="border border-[#ECEAE4] rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 border-b border-[#ECEAE4] pb-2">
                  <TrendingUp className="w-4 h-4 text-amber-700" />
                  <h3 className="font-bold text-sm">4. Investimento</h3>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 font-medium">
                    Valor do Investimento (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formInvestimento}
                    onChange={(e) => setFormInvestimento(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 font-medium">Descrição / Destino</Label>
                  <Input
                    placeholder="Ex: Aquisição de motor da usina, ampliação de pátio..."
                    value={formInvestimentoDescricao}
                    onChange={(e) => setFormInvestimentoDescricao(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {/* 5. Saldo após Investimento */}
              <div className="border border-[#ECEAE4] rounded-xl p-4 bg-white space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-teal-900 border-b border-[#ECEAE4] pb-2">
                    <DollarSign className="w-4 h-4 text-teal-700" />
                    <h3 className="font-bold text-sm">5. Saldo após Investimento</h3>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-[#ECEAE4]">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block">
                      Resultado Líquido Final
                    </span>
                    <span
                      className={`text-2xl font-black font-mono block mt-1 ${
                        saldoFinalCalculado >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatCurrency(saldoFinalCalculado)}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Faturamento ({formatCurrency(fatNum)}) − Despesas (
                      {formatCurrency(totalDespesasCalculado)}) − Investimento (
                      {formatCurrency(invNum)})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-xs text-gray-600 font-medium">Status</Label>
                    <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                      <SelectTrigger className="mt-1 h-8 text-xs bg-white border-[#ECEAE4]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="fechado">Fechado</SelectItem>
                        <SelectItem value="entregue_diretoria">Entregue Diretoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium">Responsável</Label>
                    <Input
                      value={formResponsavelNome}
                      onChange={(e) => setFormResponsavelNome(e.target.value)}
                      placeholder="Nome do operador"
                      className="mt-1 h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Observações gerais */}
            <div>
              <Label className="text-xs text-gray-600 font-medium">
                Observações Adicionais para a Diretoria
              </Label>
              <Textarea
                rows={2}
                placeholder="Observações operacionais ou notas explicativas sobre o fechamento..."
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="border-t border-[#ECEAE4] pt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalFormOpen(false)}
                disabled={saving}
                className="text-xs border-[#ECEAE4]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    {editingId ? 'Atualizar Fechamento' : 'Salvar Fechamento de Caixa'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE IMPRESSÃO / PDF A4 FORMAL DE DIRETORIA */}
      <FechamentoMensalImpressaoModal
        open={modalImpressaoOpen}
        onOpenChange={setModalImpressaoOpen}
        fechamento={fechamentoImpressao}
        empresa={currentEmpresa}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-gray-900 font-bold">
              Excluir fechamento mensal?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              Esta ação removerá o registro de fechamento selecionado. Esta operação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
