import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Funcionario, SetorFuncionario, StatusFuncionario, PlanoConta } from '@/types/erp'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ComboboxPesquisavel } from '@/components/ui/ComboboxPesquisavel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import {
  RelatorioListagemImpressaoModal,
  type ColunaRelatorioImpressao,
  type TotalizadorRelatorioImpressao,
} from '@/components/financeiro/RelatorioListagemImpressaoModal'
import { toast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  DollarSign,
  Briefcase,
  Building,
  FileSpreadsheet,
  Receipt,
  UserCheck,
  Clock,
  HeartPulse,
  Printer,
  X,
} from 'lucide-react'
import { formatarCpf, apenasDigitos, formatarTelefoneBrasil, validarCpf } from '@/lib/brasilApi'
import { ImportadorFuncionariosModal } from '@/components/rh/ImportadorFuncionariosModal'
import { useDebounce } from '@/hooks/useDebounce'

const SETOR_COLORS: Record<SetorFuncionario, { bg: string; text: string; border: string }> = {
  Britagem: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  Concreto: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Lokotrack: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Frota: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  Administrativo: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' },
  Outro: { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
}

export default function Funcionarios() {
  const { currentEmpresa, canEdit } = useCompany()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros da listagem
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 280)
  const [setorFilter, setSetorFilter] = useState<string>('todos')
  const [cargoFilter, setCargoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Seleção múltipla para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [relatorioImpressaoOpen, setRelatorioImpressaoOpen] = useState(false)

  // Importador Modal
  const [importadorOpen, setImportadorOpen] = useState(false)

  // Drawer Form
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cargo, setCargo] = useState('')
  const [setor, setSetor] = useState<SetorFuncionario>('Britagem')
  const [dataAdmissao, setDataAdmissao] = useState(() => new Date().toISOString().slice(0, 10))
  const [salario, setSalario] = useState<number>(0)
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<StatusFuncionario>('ativo')
  const [chavePix, setChavePix] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Gerar Conta a Pagar (Folha/Salário com Adiantamento e Gratificação)
  const [gerarContaModalOpen, setGerarContaModalOpen] = useState(false)
  const [selectedFuncionarioParaFolha, setSelectedFuncionarioParaFolha] =
    useState<Funcionario | null>(null)
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [vencimentoFolha, setVencimentoFolha] = useState(() => {
    const d = new Date()
    // 5º dia útil do mês seguinte normalmente
    d.setDate(5)
    return d.toISOString().slice(0, 10)
  })
  const [valorFolha, setValorFolha] = useState<number>(0)
  const [gratificacaoFolha, setGratificacaoFolha] = useState<number | ''>('')
  const [adiantamentoFolha, setAdiantamentoFolha] = useState<number | ''>('')
  const [gerandoFolha, setGerandoFolha] = useState(false)

  useRealtime('funcionarios', () => loadFuncionarios())

  const loadFuncionarios = async () => {
    if (!currentEmpresa) return
    try {
      setLoading(true)
      const [fList, pList] = await Promise.all([
        pb.collection('funcionarios').getFullList<Funcionario>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
          sort: 'nome',
        }),
        pb.collection('plano_contas').getFullList<PlanoConta>({
          filter: `empresa_id = '${currentEmpresa.id}'`,
        }),
      ])
      setFuncionarios(fList)
      setPlanoContas(pList)
    } catch (err) {
      console.error('Error fetching funcionarios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFuncionarios()
  }, [currentEmpresa])

  const openCreateModal = () => {
    setEditingId(null)
    setNome('')
    setCpf('')
    setCargo('')
    setSetor('Britagem')
    setDataAdmissao(new Date().toISOString().slice(0, 10))
    setSalario(0)
    setTelefone('')
    setEmail('')
    setStatus('ativo')
    setChavePix('')
    setBancoConta('')
    setObservacoes('')
    setIsDrawerOpen(true)
  }

  const handleEdit = (f: Funcionario) => {
    setEditingId(f.id)
    setNome(f.nome)
    setCpf(f.cpf ? formatarCpf(f.cpf) : '')
    setCargo(f.cargo)
    setSetor(f.setor)
    setDataAdmissao(f.data_admissao ? f.data_admissao.slice(0, 10) : '')
    setSalario(f.salario || 0)
    setTelefone(f.telefone ? formatarTelefoneBrasil(f.telefone) : '')
    setEmail(f.email || '')
    setStatus(f.status)
    setChavePix(f.chave_pix || '')
    setBancoConta(f.banco_conta || '')
    setObservacoes(f.observacoes || '')
    setIsDrawerOpen(true)
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatarCpf(e.target.value))
  }

  const handleCpfBlur = () => {
    const clean = apenasDigitos(cpf)
    if (clean.length === 11 && !validarCpf(clean)) {
      toast({
        title: 'CPF com dígito verificador inválido',
        description: 'Verifique se os números digitados estão corretos.',
        variant: 'destructive',
      })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !cargo.trim()) {
      toast({ title: 'Preencha o nome completo e o cargo', variant: 'destructive' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        empresa_id: currentEmpresa!.id,
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        cargo: cargo.trim(),
        setor,
        data_admissao: dataAdmissao ? new Date(dataAdmissao).toISOString() : null,
        salario: Number(salario) || 0,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        status,
        chave_pix: chavePix.trim() || null,
        banco_conta: bancoConta.trim() || null,
        observacoes: observacoes.trim() || null,
      }

      if (editingId) {
        await pb.collection('funcionarios').update(editingId, payload)
        toast({ title: 'Colaborador atualizado com sucesso!' })
      } else {
        await pb.collection('funcionarios').create(payload)
        toast({ title: 'Colaborador cadastrado com sucesso!' })
      }

      setIsDrawerOpen(false)
      await loadFuncionarios()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar colaborador',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, nomeFunc: string) => {
    if (!confirm(`Deseja realmente remover o cadastro de ${nomeFunc}?`)) return
    try {
      await pb.collection('funcionarios').delete(id)
      toast({ title: 'Colaborador excluído com sucesso.' })
      await loadFuncionarios()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Abertura do modal de geração de salário a pagar
  const handleOpenGerarFolha = (f: Funcionario) => {
    setSelectedFuncionarioParaFolha(f)
    setValorFolha(f.salario || 0)
    setGratificacaoFolha('')
    setAdiantamentoFolha('')
    setGerarContaModalOpen(true)
  }

  // Cálculo do líquido da folha mensal
  const liquidoFolhaCalculado = useMemo(() => {
    const base = Number(valorFolha) || 0
    const grat = Number(gratificacaoFolha) || 0
    const adiant = Number(adiantamentoFolha) || 0
    return Number((base + grat - adiant).toFixed(2))
  }, [valorFolha, gratificacaoFolha, adiantamentoFolha])

  const handleConfirmarGeracaoFolha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFuncionarioParaFolha || valorFolha <= 0) {
      toast({ title: 'Informe um valor de salário válido', variant: 'destructive' })
      return
    }

    if (liquidoFolhaCalculado <= 0) {
      toast({
        title: 'O valor líquido da folha deve ser maior que zero',
        description: 'Verifique os valores de salário, gratificação e adiantamento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setGerandoFolha(true)

      // Categoria de folha de pagamento no plano de contas
      const catFolha =
        planoContas.find((pc) => pc.nome.toLowerCase().includes('salário')) ||
        planoContas.find((pc) => pc.nome.toLowerCase().includes('pessoal')) ||
        planoContas.find((pc) => pc.codigo === '2.1') ||
        planoContas[0] ||
        null

      const partesObs: string[] = [
        `Colaborador: ${selectedFuncionarioParaFolha.nome}`,
        `Cargo: ${selectedFuncionarioParaFolha.cargo}`,
        `Setor: ${selectedFuncionarioParaFolha.setor}`,
        `Salário Base: ${formatCurrency(valorFolha)}`,
      ]
      if (Number(gratificacaoFolha) > 0) {
        partesObs.push(`Gratificação (+): ${formatCurrency(Number(gratificacaoFolha))}`)
      }
      if (Number(adiantamentoFolha) > 0) {
        partesObs.push(`Adiantamento (-): ${formatCurrency(Number(adiantamentoFolha))}`)
      }
      partesObs.push(`Líquido a Pagar: ${formatCurrency(liquidoFolhaCalculado)}`)
      partesObs.push(`Chave PIX: ${selectedFuncionarioParaFolha.chave_pix || 'Não cadastrada'}`)

      const payloadConta = {
        empresa_id: currentEmpresa!.id,
        descricao: `Salário / Folha Líquida: ${selectedFuncionarioParaFolha.nome} (${mesReferencia})`,
        categoria_id: catFolha?.id || null,
        valor: liquidoFolhaCalculado,
        vencimento: new Date(vencimentoFolha).toISOString(),
        parcelas: 1,
        status: 'Aberta',
        observacoes: partesObs.join(' | '),
      }

      await pb.collection('contas_pagar').create(payloadConta)

      toast({
        title: 'Conta a Pagar de Folha gerada com sucesso!',
        description: `Lançado no financeiro pelo valor líquido de ${formatCurrency(
          liquidoFolhaCalculado,
        )}.`,
      })
      setGerarContaModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar conta de folha',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setGerandoFolha(false)
    }
  }

  // Lista única de cargos existentes para o filtro de Cargo
  const listaCargos = useMemo(() => {
    const cargosSet = new Set<string>()
    funcionarios.forEach((f) => {
      if (f.cargo?.trim()) {
        cargosSet.add(f.cargo.trim())
      }
    })
    return Array.from(cargosSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [funcionarios])

  // Lista única de setores encontrados na base (combina setores padrão + setores cadastrados)
  const listaSetoresDisponiveis = useMemo(() => {
    const setoresPadrao: SetorFuncionario[] = [
      'Britagem',
      'Concreto',
      'Lokotrack',
      'Frota',
      'Administrativo',
      'Outro',
    ]
    const set = new Set<string>(setoresPadrao)
    funcionarios.forEach((f) => {
      if (f.setor) set.add(f.setor)
    })
    return Array.from(set)
  }, [funcionarios])

  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((f) => {
      if (setorFilter !== 'todos' && f.setor !== setorFilter) return false
      if (
        cargoFilter !== 'todos' &&
        f.cargo?.trim().toLowerCase() !== cargoFilter.trim().toLowerCase()
      ) {
        return false
      }
      if (statusFilter !== 'todos' && f.status !== statusFilter) return false
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase()
        const n = (f.nome || '').toLowerCase()
        const c = (f.cargo || '').toLowerCase()
        const s = (f.setor || '').toLowerCase()
        const doc = (f.cpf || '').replace(/\D/g, '')
        const tel = (f.telefone || '').replace(/\D/g, '')
        const pix = (f.chave_pix || '').toLowerCase()
        const qDigits = q.replace(/\D/g, '')

        const matchText = n.includes(q) || c.includes(q) || s.includes(q) || pix.includes(q)
        const matchDigits = qDigits.length > 2 && (doc.includes(qDigits) || tel.includes(qDigits))
        return matchText || matchDigits
      }
      return true
    })
  }, [funcionarios, setorFilter, cargoFilter, statusFilter, debouncedSearchQuery])

  // Handlers de seleção por checkbox (padrão ContasPagar / HorasExtras)
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredFuncionarios.length && filteredFuncionarios.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredFuncionarios.map((f) => f.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Itens a serem impressos: se houver seleção, imprime os selecionados; senão, todos os filtrados
  const itensParaImpressao = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      return filteredFuncionarios.filter((f) => set.has(f.id))
    }
    return filteredFuncionarios
  }, [filteredFuncionarios, selectedIds])

  // Descrição legível dos filtros aplicados (aparece no cabeçalho do relatório impresso)
  const descricaoFiltrosAplicados = useMemo(() => {
    const partes: string[] = []
    if (setorFilter !== 'todos') {
      partes.push(`Setor: ${setorFilter}`)
    } else {
      partes.push('Setor: Todos')
    }
    if (cargoFilter !== 'todos') {
      partes.push(`Cargo: ${cargoFilter}`)
    }
    if (statusFilter !== 'todos') {
      const labelStatus =
        statusFilter === 'ativo'
          ? 'Ativo'
          : statusFilter === 'ferias'
            ? 'Férias'
            : statusFilter === 'afastado'
              ? 'Afastado'
              : 'Demitido'
      partes.push(`Situação: ${labelStatus}`)
    } else {
      partes.push('Situação: Todas')
    }
    if (searchQuery.trim()) {
      partes.push(`Busca: "${searchQuery.trim()}"`)
    }
    if (selectedIds.length > 0) {
      partes.push(`Seleção ativa: ${selectedIds.length} colaborador(es) selecionado(s)`)
    }
    return partes.join(' · ')
  }, [setorFilter, cargoFilter, statusFilter, searchQuery, selectedIds.length])

  // Colunas do relatório oficial de listagem de funcionários A4
  const colunasRelatorioFuncionarios = useMemo<ColunaRelatorioImpressao<Funcionario>[]>(
    () => [
      {
        key: 'nome',
        header: 'Nome do Colaborador',
        render: (f) => (
          <div>
            <div className="font-bold text-gray-900">{f.nome}</div>
            {f.chave_pix && (
              <div className="text-[10px] text-gray-500 font-mono">PIX: {f.chave_pix}</div>
            )}
          </div>
        ),
      },
      {
        key: 'cargo',
        header: 'Cargo / Função',
        render: (f) => <span className="font-medium text-gray-800">{f.cargo || '—'}</span>,
      },
      {
        key: 'setor',
        header: 'Setor',
        align: 'center',
        render: (f) => (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800 border border-gray-300">
            {f.setor || 'Geral'}
          </span>
        ),
      },
      {
        key: 'cpf',
        header: 'CPF',
        align: 'center',
        className: 'font-mono whitespace-nowrap text-gray-700',
        render: (f) => (f.cpf ? formatarCpf(f.cpf) : '—'),
      },
      {
        key: 'telefone',
        header: 'Telefone / Contato',
        align: 'center',
        className: 'font-mono whitespace-nowrap text-gray-600',
        render: (f) => (f.telefone ? formatarTelefoneBrasil(f.telefone) : '—'),
      },
      {
        key: 'admissao',
        header: 'Admissão',
        align: 'center',
        className: 'font-mono whitespace-nowrap text-gray-700',
        render: (f) => (f.data_admissao ? formatDate(f.data_admissao) : '—'),
      },
      {
        key: 'salario',
        header: 'Salário Base (R$)',
        align: 'right',
        className: 'font-mono font-bold whitespace-nowrap text-gray-900',
        render: (f) => (f.salario ? formatCurrency(f.salario) : '—'),
      },
      {
        key: 'status',
        header: 'Situação',
        align: 'center',
        className: 'whitespace-nowrap',
        render: (f) => {
          const rotulo =
            f.status === 'ativo'
              ? 'Ativo'
              : f.status === 'ferias'
                ? 'Férias'
                : f.status === 'afastado'
                  ? 'Afastado'
                  : 'Demitido'
          return (
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                f.status === 'ativo'
                  ? 'text-emerald-800 bg-emerald-50 border border-emerald-300'
                  : f.status === 'ferias'
                    ? 'text-blue-800 bg-blue-50 border border-blue-300'
                    : f.status === 'afastado'
                      ? 'text-amber-800 bg-amber-50 border border-amber-300'
                      : 'text-red-800 bg-red-50 border border-red-300'
              }`}
            >
              {rotulo}
            </span>
          )
        },
      },
    ],
    [],
  )

  // Totalizadores do rodapé do relatório impresso
  const totalizadoresRelatorioFuncionarios = useMemo<TotalizadorRelatorioImpressao[]>(() => {
    const somaSalarios = itensParaImpressao.reduce((acc, f) => acc + (f.salario || 0), 0)
    const totalAtivosNaLista = itensParaImpressao.filter((f) => f.status === 'ativo').length

    return [
      {
        label: 'TOTAL DE COLABORADORES:',
        value: `${itensParaImpressao.length} registro(s) (${totalAtivosNaLista} ativos)`,
        colSpan: 5,
        align: 'left',
      },
      {
        label: 'TOTAL SALÁRIOS:',
        value: formatCurrency(somaSalarios),
        colSpan: 2,
        align: 'right',
        className: 'text-teal-950 font-extrabold',
      },
      {
        label: '',
        value: '',
        colSpan: 1,
        align: 'center',
      },
    ]
  }, [itensParaImpressao])

  // KPIs — recalculados conforme o filtro ativo na tela
  const totalEquipeFiltrada = filteredFuncionarios.length
  const totalAtivosFiltrados = filteredFuncionarios.filter((f) => f.status === 'ativo').length
  const totalFolhaFiltrada = filteredFuncionarios
    .filter((f) => f.status === 'ativo')
    .reduce((acc, f) => acc + (f.salario || 0), 0)
  const totalSetorBritagem = filteredFuncionarios.filter((f) => f.setor === 'Britagem').length
  const totalSetorConcreto = filteredFuncionarios.filter((f) => f.setor === 'Concreto').length
  const totalSetorFrota = filteredFuncionarios.filter((f) => f.setor === 'Frota').length

  const temFiltroAtivo =
    setorFilter !== 'todos' ||
    cargoFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    searchQuery.trim().length > 0 ||
    selectedIds.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Recursos Humanos & Colaboradores
            </h1>
            <Badge className="bg-teal-100 text-teal-900 border-teal-300">Equipe Operacional</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de funcionários da pedreira, operadores de máquinas pesadas, motoristas e folha
            salarial
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/rh/exames-periodicos')}
              className="border-teal-300 text-teal-900 bg-teal-50/50 hover:bg-teal-100/70 rounded-xl shadow-xs text-xs"
              title="Exames Ocupacionais e Periódicos"
            >
              <HeartPulse className="w-4 h-4 mr-1.5 text-teal-700" />
              Exames Periódicos
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/rh/horas-extras')}
              className="border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100/70 rounded-xl shadow-xs text-xs"
              title="Folha e Cálculo de Horas Extras"
            >
              <Clock className="w-4 h-4 mr-1.5 text-amber-700" />
              Folha Horas Extras
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportadorOpen(true)}
              className="border-teal-300 text-teal-800 hover:bg-teal-50 rounded-xl shadow-xs text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-teal-700" />
              Importar Planilha
            </Button>
            <Button
              onClick={openCreateModal}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Colaborador
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards (Recalculados conforme o filtro ativo) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Equipe Ativa</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalAtivosFiltrados}
            {totalEquipeFiltrada !== totalAtivosFiltrados && (
              <span className="text-xs text-gray-400 font-normal ml-1.5">
                / {totalEquipeFiltrada} total
              </span>
            )}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            {setorFilter !== 'todos' || statusFilter !== 'todos' || cargoFilter !== 'todos'
              ? 'Ativos no filtro selecionado'
              : 'Colaboradores ativos'}
          </p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Folha Mensal Base</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-900 mt-2 font-mono tabular-nums">
            {formatCurrency(totalFolhaFiltrada)}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Soma salários equipe ativa (filtrada)</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Britagem & Lavra</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalSetorBritagem}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Operadores e técnicos</p>
        </Card>

        <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Usinas / Concreto / Frota
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            {totalSetorConcreto + totalSetorFrota}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Concreto: {totalSetorConcreto} · Frota: {totalSetorFrota}
          </p>
        </Card>
      </div>

      {/* Filters Bar (Padrão ERP: Setor combobox, Cargo combobox, Situação, Busca e Impressão com Seleção) */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Setor via Combobox Pesquisável */}
            <ComboboxPesquisavel
              value={setorFilter}
              onChange={setSetorFilter}
              placeholder="Setor: Todos"
              searchPlaceholder="Pesquisar setor..."
              emptyText="Nenhum setor encontrado."
              className="w-[190px]"
              triggerClassName="bg-[#FAF9F7] border-[#ECEAE4] h-9 rounded-xl text-xs"
              aria-label="Filtrar por setor"
              options={[
                { id: 'todos', label: 'Todos os Setores' },
                ...listaSetoresDisponiveis.map((s) => ({
                  id: s,
                  label: s,
                  sublabel: `Área operacional`,
                  keywords: [s],
                })),
              ]}
            />

            {/* Filtro Cargo via Combobox Pesquisável */}
            <ComboboxPesquisavel
              value={cargoFilter}
              onChange={setCargoFilter}
              placeholder="Cargo: Todos"
              searchPlaceholder="Pesquisar função..."
              emptyText="Nenhum cargo encontrado."
              className="w-[200px]"
              triggerClassName="bg-[#FAF9F7] border-[#ECEAE4] h-9 rounded-xl text-xs"
              aria-label="Filtrar por cargo"
              options={[
                { id: 'todos', label: 'Todos os Cargos' },
                ...listaCargos.map((c) => ({
                  id: c,
                  label: c,
                  keywords: [c],
                })),
              ]}
            />

            {/* Filtro Situação / Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Situações</SelectItem>
                <SelectItem value="ativo">● Ativo</SelectItem>
                <SelectItem value="ferias">● Férias</SelectItem>
                <SelectItem value="afastado">● Afastado</SelectItem>
                <SelectItem value="demitido">● Demitido</SelectItem>
              </SelectContent>
            </Select>

            {temFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSetorFilter('todos')
                  setCargoFilter('todos')
                  setStatusFilter('todos')
                  setSearchQuery('')
                  setSelectedIds([])
                }}
                className="h-8 px-2 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar colaborador, cargo, CPF, chave PIX..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
              />
            </div>

            {/* Botão de Impressão (padrão Imprimir / Imprimir Selecionados com destaque teal) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRelatorioImpressaoOpen(true)}
              className={`h-9 px-3 text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 ${
                selectedIds.length > 0
                  ? 'bg-teal-700 text-white hover:bg-teal-800 border-teal-700'
                  : 'border-teal-300 text-teal-800 bg-teal-50/60 hover:bg-teal-100/80 hover:text-teal-950'
              }`}
              title={
                selectedIds.length > 0
                  ? `Imprimir os ${selectedIds.length} colaboradores selecionados`
                  : 'Imprimir relatório da lista de colaboradores'
              }
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {selectedIds.length > 0
                ? `Imprimir Selecionados (${selectedIds.length})`
                : 'Imprimir'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Table of Employees */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500 uppercase font-semibold">
                <th className="py-3 px-3 text-center w-8">
                  <Checkbox
                    checked={
                      filteredFuncionarios.length > 0 &&
                      selectedIds.length === filteredFuncionarios.length
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Selecionar todos os colaboradores visíveis"
                    className="border-gray-300"
                  />
                </th>
                <th className="py-3 px-4">Nome do Colaborador</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4">CPF / Contato</th>
                <th className="py-3 px-4">Admissão</th>
                <th className="py-3 px-4 text-right">Salário Base</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações & Folha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEAE4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Carregando colaboradores da pedreira...
                  </td>
                </tr>
              ) : filteredFuncionarios.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Nenhum colaborador encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredFuncionarios.map((f) => {
                  const sColor = SETOR_COLORS[f.setor] || SETOR_COLORS.Outro
                  const isSelected = selectedIds.includes(f.id)
                  return (
                    <tr
                      key={f.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/60 hover:bg-teal-50/80' : 'hover:bg-teal-50/20'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectOne(f.id)}
                          aria-label={`Selecionar colaborador ${f.nome}`}
                          className="border-gray-300"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{f.nome}</div>
                        {f.chave_pix && (
                          <div className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                            PIX: {f.chave_pix}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700">{f.cargo}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${sColor.bg} ${sColor.text} ${sColor.border}`}
                        >
                          {f.setor}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-gray-700">{f.cpf || '—'}</div>
                        {f.telefone && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{f.telefone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">
                        {f.data_admissao ? formatDate(f.data_admissao) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 tabular-nums">
                        {f.salario ? formatCurrency(f.salario) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            f.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : f.status === 'ferias'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : f.status === 'afastado'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {f.status === 'ativo'
                            ? '● Ativo'
                            : f.status === 'ferias'
                              ? '● Férias'
                              : f.status === 'afastado'
                                ? '● Afastado'
                                : '● Demitido'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/rh/horas-extras`)}
                              className="h-7 px-2 text-[11px] text-amber-900 border-amber-200 hover:bg-amber-50"
                              title="Calcular Horas Extras para este Colaborador"
                            >
                              <Clock className="w-3 h-3 mr-1 text-amber-700" />
                              Horas Extras
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/rh/exames-periodicos?funcionario=${f.id}`)}
                              className="h-7 px-2 text-[11px] text-teal-900 border-teal-200 hover:bg-teal-50"
                              title="Ver e Gerenciar Exames deste Colaborador"
                            >
                              <HeartPulse className="w-3 h-3 mr-1 text-teal-700" />
                              Exames
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenGerarFolha(f)}
                              className="h-7 px-2 text-[11px] text-teal-800 border-teal-200 hover:bg-teal-50"
                              title="Lançar Salário / Conta a Pagar"
                            >
                              <Receipt className="w-3 h-3 mr-1" />
                              Lançar Salário
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(f)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-800"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(f.id, f.nome)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                              title="Excluir"
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

      {/* Drawer Create / Edit */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-[520px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Sebastião Antunes"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">CPF</Label>
                <Input
                  value={cpf}
                  onChange={handleCpfChange}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Cargo / Função *</Label>
                <Input
                  required
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Operador de Escavadeira"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Setor / Área *</Label>
                <Select value={setor} onValueChange={(v: SetorFuncionario) => setSetor(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Britagem">Central Britagem</SelectItem>
                    <SelectItem value="Concreto">Central Concreto</SelectItem>
                    <SelectItem value="Lokotrack">Britagem Lokotrack</SelectItem>
                    <SelectItem value="Frota">Frota & Transporte</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Status</Label>
                <Select value={status} onValueChange={(v: StatusFuncionario) => setStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="demitido">Demitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Data de Admissão</Label>
                <Input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Salário Base Mensal (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salario || ''}
                  onChange={(e) => setSalario(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 font-mono font-bold text-teal-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Telefone / WhatsApp</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(83) 98899-0000"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@gcpedreira.com.br"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Chave PIX</Label>
                <Input
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, email ou telefone"
                  className="mt-1 bg-white font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Conta Bancária</Label>
                <Input
                  value={bancoConta}
                  onChange={(e) => setBancoConta(e.target.value)}
                  placeholder="Banco, agência e conta"
                  className="mt-1 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Observações / Informações Complementares
              </Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: CNH categoria E, cursos NR-12, NR-11, histórico..."
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
                {isSubmitting ? 'Salvando...' : 'Salvar Colaborador'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal Gerar Folha a Pagar */}
      <Sheet open={gerarContaModalOpen} onOpenChange={setGerarContaModalOpen}>
        <SheetContent className="sm:max-w-[480px] w-full bg-white border-l border-[#ECEAE4] p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              Lançar Folha / Salário a Pagar
            </SheetTitle>
          </SheetHeader>

          {selectedFuncionarioParaFolha && (
            <form onSubmit={handleConfirmarGeracaoFolha} className="space-y-4 py-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-[#ECEAE4]">
                <div className="font-semibold text-gray-900 text-sm">
                  {selectedFuncionarioParaFolha.nome}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedFuncionarioParaFolha.cargo} • {selectedFuncionarioParaFolha.setor}
                </div>
                {selectedFuncionarioParaFolha.chave_pix && (
                  <div className="text-[11px] text-teal-700 font-mono mt-1">
                    PIX: {selectedFuncionarioParaFolha.chave_pix}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Mês de Referência *</Label>
                <Input
                  required
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  placeholder="Ex: 2026-09 ou Setembro/2026"
                  className="mt-1 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">
                    Data de Vencimento *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={vencimentoFolha}
                    onChange={(e) => setVencimentoFolha(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-gray-700">Salário Base (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={valorFolha || ''}
                    onChange={(e) => setValorFolha(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="mt-1 font-mono font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Gratificação e Adiantamento na Folha Mensal */}
              <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                    Gratificação (+) e Adiantamento (−)
                  </span>
                  <span className="text-[10px] text-amber-800">Ajustes da Folha</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
                      Gratificação / Bônus (R$)
                      <span className="text-[10px] font-normal text-emerald-700">(Soma +)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={gratificacaoFolha}
                      onChange={(e) =>
                        setGratificacaoFolha(
                          e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0,00"
                      className="mt-1 font-mono font-bold text-emerald-800 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-red-900 flex items-center gap-1">
                      Adiantamento (R$)
                      <span className="text-[10px] font-normal text-red-700">(Desconta −)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={adiantamentoFolha}
                      onChange={(e) =>
                        setAdiantamentoFolha(
                          e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0,00"
                      className="mt-1 font-mono font-bold text-red-700 bg-white"
                    />
                  </div>
                </div>

                {/* Resumo do Cálculo e Líquido Destacado */}
                <div className="pt-2 border-t border-amber-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Salário Base:</span>
                    <span className="font-mono">{formatCurrency(valorFolha || 0)}</span>
                  </div>
                  {Number(gratificacaoFolha) > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-800">
                      <span>(+) Gratificação / Bônus:</span>
                      <span className="font-mono font-semibold">
                        +{formatCurrency(Number(gratificacaoFolha))}
                      </span>
                    </div>
                  )}
                  {Number(adiantamentoFolha) > 0 && (
                    <div className="flex items-center justify-between text-xs text-red-700">
                      <span>(−) Adiantamento:</span>
                      <span className="font-mono font-semibold">
                        -{formatCurrency(Number(adiantamentoFolha))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-amber-300 bg-emerald-50/80 p-2 rounded-lg text-emerald-950">
                    <div>
                      <span className="font-bold text-xs block">Valor Líquido a Pagar:</span>
                      <span className="text-[10px] text-emerald-700">
                        Base + Gratificação − Adiantamento
                      </span>
                    </div>
                    <span className="font-mono font-bold text-lg tabular-nums">
                      {formatCurrency(liquidoFolhaCalculado)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-600 text-[11px]">
                Esta ação gerará uma nova <strong>Conta a Pagar</strong> no valor{' '}
                <strong>LÍQUIDO ({formatCurrency(liquidoFolhaCalculado)})</strong> no módulo
                financeiro para controle de baixa bancária e histórico do colaborador.
              </div>

              <SheetFooter className="pt-4 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setGerarContaModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={gerandoFolha}
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                >
                  {gerandoFolha ? 'Gerando...' : 'Confirmar Lançamento'}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Importador de Planilha Excel de Funcionários */}
      {currentEmpresa && (
        <ImportadorFuncionariosModal
          open={importadorOpen}
          onOpenChange={setImportadorOpen}
          empresaId={currentEmpresa.id}
          funcionariosExistentes={funcionarios}
          onImportComplete={loadFuncionarios}
        />
      )}

      {/* Relatório A4 Oficial de Listagem de Funcionários (com cabeçalho, filtros descritos e totais) */}
      <RelatorioListagemImpressaoModal
        open={relatorioImpressaoOpen}
        onOpenChange={setRelatorioImpressaoOpen}
        titulo="Quadro Geral de Funcionários & Equipe"
        subtitulo="Relação de Colaboradores Operacionais, Cargos, Setores e Salários Base"
        badgeDestaque="Recursos Humanos"
        empresa={currentEmpresa}
        usuarioNome={user?.name || user?.email || 'Administrador'}
        filtrosDescricao={descricaoFiltrosAplicados}
        itens={itensParaImpressao}
        colunas={colunasRelatorioFuncionarios}
        totais={totalizadoresRelatorioFuncionarios}
        mensagemVazio="Nenhum funcionário encontrado para os filtros ou seleção atual."
        orientacao="landscape"
      />
    </div>
  )
}
