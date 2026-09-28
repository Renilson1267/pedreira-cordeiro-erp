import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { INSTITUCIONAL_CONFIG, PRODUTOS_PEDREIRA, ProdutoPedreiraItem } from '@/data/institucional'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Mail,
  ShieldCheck,
  Truck,
  Award,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ChevronDown,
  Building2,
  Sparkles,
  LogIn,
  Send,
  MessageCircle,
} from 'lucide-react'

export default function HomePublica() {
  // Estado do formulário de orçamento
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [produto, setProduto] = useState('Brita 1 2')
  const [quantidade, setQuantidade] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Feedback e erros
  const [erros, setErros] = useState<{ nome?: string; telefone?: string }>({})
  const [statusConfirmacao, setStatusConfirmacao] = useState<string | null>(null)

  // Rolagem suave até o formulário
  const rolarParaOrcamento = (produtoPreSelecionado?: string) => {
    if (produtoPreSelecionado) {
      setProduto(produtoPreSelecionado)
    }
    const el = document.getElementById('orcamento')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Validação básica (Nome e Telefone/WhatsApp obrigatórios)
  const validarFormulario = (): boolean => {
    const novosErros: { nome?: string; telefone?: string } = {}
    if (!nome.trim()) {
      novosErros.nome = 'Por favor, informe seu nome completo ou empresa.'
    }
    if (!telefone.trim() || telefone.replace(/\D/g, '').length < 8) {
      novosErros.telefone = 'Informe um telefone ou WhatsApp com DDD para retorno.'
    }
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  // Montagem do texto do orçamento
  const montarTextoOrcamento = (): string => {
    const linhas = [
      `*SOLICITAÇÃO DE ORÇAMENTO — PEDREIRA CORDEIRO*`,
      `----------------------------------------`,
      `*Nome/Empresa:* ${nome.trim()}`,
      `*Telefone/WhatsApp:* ${telefone.trim()}`,
      email.trim() ? `*E-mail:* ${email.trim()}` : null,
      `*Produto de interesse:* ${produto}`,
      quantidade.trim() ? `*Quantidade estimada:* ${quantidade.trim()}` : null,
      mensagem.trim() ? `*Mensagem/Detalhes:* ${mensagem.trim()}` : null,
      `----------------------------------------`,
      `Enviado via pedreiracordeiro.com.br`,
    ].filter(Boolean)

    return linhas.join('\n')
  }

  // Disparo 1: WhatsApp (wa.me)
  const enviarPorWhatsApp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarFormulario()) return

    const texto = montarTextoOrcamento()
    const encoded = encodeURIComponent(texto)
    const url = `https://wa.me/${INSTITUCIONAL_CONFIG.whatsappNumero}?text=${encoded}`

    window.open(url, '_blank', 'noopener,noreferrer')
    setStatusConfirmacao(
      'Seu orçamento foi encaminhado para o nosso WhatsApp comercial! Em instantes você receberá atendimento de nossa equipe.',
    )
  }

  // Disparo 2: E-mail (mailto:)
  const enviarPorEmail = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!validarFormulario()) return

    const texto = montarTextoOrcamento()
    const assunto = encodeURIComponent(`Solicitação de Orçamento - ${produto} - ${nome.trim()}`)
    const corpo = encodeURIComponent(texto)
    const mailtoUrl = `mailto:${INSTITUCIONAL_CONFIG.emailComercial}?subject=${assunto}&body=${corpo}`

    window.location.href = mailtoUrl
    setStatusConfirmacao(
      'Seu orçamento foi preparado e aberto no seu aplicativo de e-mail! Basta clicar em enviar.',
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-800 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Barra superior de utilidades / institucional */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              {INSTITUCIONAL_CONFIG.localizacao}
            </span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              {INSTITUCIONAL_CONFIG.horarioAtendimento}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-400">CNPJ: {INSTITUCIONAL_CONFIG.cnpj}</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              <LogIn className="w-3 h-3" />
              Entrar no Sistema
            </Link>
          </div>
        </div>
      </div>

      {/* Header de Navegação */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#ECEAE4] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-gray-900 block leading-tight">
                Pedreira Cordeiro
              </span>
              <span className="text-[11px] text-teal-700 font-bold uppercase tracking-wider block">
                {INSTITUCIONAL_CONFIG.nomeFantasia}
              </span>
            </div>
          </div>

          {/* Links desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#produtos" className="hover:text-teal-700 transition-colors">
              Produtos
            </a>
            <a href="#sobre" className="hover:text-teal-700 transition-colors">
              A Pedreira
            </a>
            <a href="#diferenciais" className="hover:text-teal-700 transition-colors">
              Diferenciais
            </a>
            <a href="#contato" className="hover:text-teal-700 transition-colors">
              Contato
            </a>
          </nav>

          {/* Ações do topo */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-700 hover:text-teal-700 hover:bg-gray-100 transition-colors border border-transparent hover:border-[#ECEAE4]"
            >
              <LogIn className="w-4 h-4 text-gray-500" />
              Entrar no ERP
            </Link>

            <Button
              onClick={() => rolarParaOrcamento()}
              className="bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20 rounded-xl px-4 py-2 font-semibold text-sm"
            >
              Pedir Orçamento
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-white via-[#FAF9F7] to-[#F4F1EA] border-b border-[#ECEAE4]">
          {/* Formas decorativas no fundo */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-teal-100/50 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Mineração de Agregados para Construção Civil e Infraestrutura
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.15]">
                  Pedra de qualidade para sua obra.{' '}
                  <span className="text-teal-700 block mt-1">
                    Direto da fonte, com pontualidade.
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  Fornecimento contínuo de <strong>Brita 1 2</strong>, <strong>Brita 1 9</strong>,{' '}
                  <strong>Pedra Rachão</strong>, <strong>Pó de Pedra</strong> e{' '}
                  <strong>Cascalhinho</strong> para construtoras, usinas de concreto, prefeituras e
                  obras particulares em toda a região.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Button
                    size="lg"
                    onClick={() => rolarParaOrcamento()}
                    className="w-full sm:w-auto bg-teal-700 hover:bg-teal-800 text-white font-semibold text-base px-7 py-6 rounded-xl shadow-lg shadow-teal-700/25 transition-all hover:-translate-y-0.5"
                  >
                    Pedir Orçamento Agora
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <Link
                    to="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-gray-300 hover:border-teal-600 bg-white text-gray-700 hover:text-teal-700 text-sm font-semibold shadow-xs transition-colors"
                  >
                    <LogIn className="w-4 h-4 mr-2 text-teal-600" />
                    Sou colaborador (Entrar no Sistema)
                  </Link>
                </div>

                {/* Métricas / Badges rápidos */}
                <div className="pt-6 border-t border-gray-200/80 grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
                  <div>
                    <div className="text-2xl font-bold text-gray-900 font-mono">5</div>
                    <div className="text-xs text-gray-500 font-medium">Produtos Padronizados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 font-mono">100%</div>
                    <div className="text-xs text-gray-500 font-medium">
                      Frota & Logística Própria
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-teal-700 font-mono">Sertânia-PE</div>
                    <div className="text-xs text-gray-500 font-medium">
                      Base de Produção Regional
                    </div>
                  </div>
                </div>
              </div>

              {/* Card visual / Ilustração Hero */}
              <div className="lg:col-span-5">
                <div className="relative rounded-3xl overflow-hidden border border-[#ECEAE4] bg-white shadow-2xl p-4 sm:p-6 space-y-5">
                  <div className="relative h-60 sm:h-72 rounded-2xl overflow-hidden">
                    <img
                      src="https://img.usecurling.com/p/800/500?q=rock%20quarry%20mining%20excavator&color=slate"
                      alt="Operação da Pedreira Cordeiro"
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-transparent flex items-end p-5">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950/70 px-2 py-0.5 rounded">
                          Unidade de Extração e Britagem
                        </span>
                        <h3 className="text-lg font-bold text-white mt-1">
                          Alto padrão em agregados minerais
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
                      <span>Modalidade de fornecimento</span>
                      <strong className="text-gray-800">Carga fechada ou fracionada</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
                      <span>Pesagem & Romaneio</span>
                      <strong className="text-teal-700">Controle rigoroso por m³ e Ton</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Canais de Atendimento</span>
                      <strong className="text-gray-800">WhatsApp & E-mail Comercial</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => rolarParaOrcamento()}
                    className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Consulte tabela e frete para sua cidade</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO PRODUTOS (Exatamente os 5 sob consulta) */}
        <section id="produtos" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="border-teal-600 text-teal-700 bg-teal-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-semibold"
              >
                Catálogo Oficial de Agregados
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Produtos da Pedreira Cordeiro
              </h2>
              <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed">
                Todos os agregados são produzidos em conformidade com as normas técnicas de
                granulometria e tenacidade. Trabalhamos sob consulta para garantir a melhor proposta
                por volume e localidade.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {PRODUTOS_PEDREIRA.map((item: ProdutoPedreiraItem) => (
                <Card
                  key={item.id}
                  className="group bg-[#FAF9F7] hover:bg-white border-[#ECEAE4] hover:border-teal-300 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                >
                  <div>
                    {/* Imagem do produto */}
                    <div className="relative h-48 overflow-hidden bg-gray-100">
                      <img
                        src={item.imagem}
                        alt={item.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-semibold px-2.5 py-1 rounded-md">
                          {item.codigoRef}
                        </span>
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <span className="bg-teal-700/90 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded">
                          Densidade {item.densidadeMedia}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-teal-700 transition-colors">
                        {item.nome}
                      </h3>

                      <div className="text-xs font-semibold text-teal-700 mb-3 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{item.granulometria}</span>
                      </div>

                      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{item.descricao}</p>

                      <div className="p-3 bg-white rounded-xl border border-[#ECEAE4] text-xs space-y-1">
                        <span className="font-semibold text-gray-700 block">
                          Principais Aplicações:
                        </span>
                        <span className="text-gray-500 leading-snug block">{item.aplicacao}</span>
                      </div>
                    </CardContent>
                  </div>

                  <div className="p-6 pt-0 border-t border-[#ECEAE4]/60 mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                        Valores
                      </span>
                      <span className="text-xs font-semibold text-gray-700">Sob Consulta</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => rolarParaOrcamento(item.nome)}
                      className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
                    >
                      Pedir Orçamento
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Card especial de Atendimento sob Medida */}
              <Card className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-2xl p-8 flex flex-col justify-between border-none shadow-xl">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold">Fornecimento para Grandes Obras</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Precisa de entrega programada, contratos contínuos ou mix de agregados para
                    usinas e rodovias? Nossa equipe técnica avalia a logística ideal para seu
                    projeto.
                  </p>
                  <ul className="text-xs text-slate-300 space-y-2 pt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      Programação semanal de viagens
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      Faturamento direto e romaneio oficial
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      Frota própria com caminhões traçados
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => rolarParaOrcamento('Outro / não sei ainda')}
                    className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl"
                  >
                    Falar com Especialista
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SEÇÃO SOBRE & DIFERENCIAIS */}
        <section id="sobre" className="py-20 bg-[#FAF9F7] border-y border-[#ECEAE4]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <Badge
                  variant="outline"
                  className="border-teal-600 text-teal-700 bg-teal-50 px-3 py-1 text-xs uppercase tracking-wider font-semibold"
                >
                  Sobre a Pedreira Cordeiro
                </Badge>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Compromisso com a solidez da sua infraestrutura
                </h2>

                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                  O <strong>{INSTITUCIONAL_CONFIG.nomeFantasia}</strong> atua no setor de mineração
                  e agregados para a construção civil, com jazidas operando com maquinário moderno
                  de britagem, peneiramento e separação granulométrica precisa.
                </p>

                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Localizada estrategicamente no Sertão do Pajeú e Moxotó, a pedreira atende
                  municípios de Pernambuco e Paraíba com agilidade logística, faturamento
                  transparente e pontualidade de entrega na obra.
                </p>

                <div className="p-4 bg-white rounded-2xl border border-[#ECEAE4] space-y-2">
                  <div className="text-xs font-semibold text-gray-800">
                    Razão Social & Dados Corporativos:
                  </div>
                  <div className="text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <strong className="text-gray-700">Razão Social:</strong>{' '}
                      {INSTITUCIONAL_CONFIG.razaoSocial}
                    </div>
                    <div>
                      <strong className="text-gray-700">CNPJ:</strong> {INSTITUCIONAL_CONFIG.cnpj}
                    </div>
                    <div>
                      <strong className="text-gray-700">Inscrição Estadual:</strong>{' '}
                      {INSTITUCIONAL_CONFIG.inscricaoEstadual}
                    </div>
                    <div>
                      <strong className="text-gray-700">Sede Operacional:</strong>{' '}
                      {INSTITUCIONAL_CONFIG.localizacao}
                    </div>
                  </div>
                </div>
              </div>

              {/* Imagem institucional */}
              <div className="lg:col-span-6">
                <div className="relative rounded-3xl overflow-hidden border border-[#ECEAE4] shadow-xl">
                  <img
                    src="https://img.usecurling.com/p/800/600?q=dump%20truck%20quarry%20gravel&color=slate"
                    alt="Frota e Logística Pedreira Cordeiro"
                    className="w-full h-80 sm:h-96 object-cover"
                  />
                  <div className="p-6 bg-white border-t border-[#ECEAE4] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        Logística Integrada e Pesagem Certificada
                      </div>
                      <div className="text-xs text-gray-500">
                        Romaneios oficiais emitidos diretamente pelo ERP
                      </div>
                    </div>
                    <Badge className="bg-teal-100 text-teal-800 border-teal-200">Garantia GC</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Diferenciais em 4 cards */}
            <div id="diferenciais" className="mt-20">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  Por que escolher a Pedreira Cordeiro?
                </h3>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  Estrutura preparada para obras de todos os portes com padrão de qualidade
                  inegociável.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] hover:border-teal-300 transition-all shadow-xs space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <Award className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Qualidade do Material</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Pedra com alta resistência mecânica à abrasão e esmagamento, ideal para
                    concretos de alto desempenho e pavimentações exigentes.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] hover:border-teal-300 transition-all shadow-xs space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Entrega com Frota Própria</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Caminhões e carretas basculantes próprios com acompanhamento de rotas, reduzindo
                    custos de intermediários e evitando atrasos na obra.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] hover:border-teal-300 transition-all shadow-xs space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Atendimento Ágil</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Cotação rápida por WhatsApp ou e-mail, facilidade de negociação para faturamento
                    corporativo e suporte comercial direto.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] hover:border-teal-300 transition-all shadow-xs space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Tradição e Confiabilidade</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Atuação consolidada no interior pernambucano e paraibano, com fornecimento para
                    as principais obras e construtoras regionais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO ORÇAMENTO (WhatsApp e E-mail — SEM GRAVAÇÃO NO ERP) */}
        <section id="orcamento" className="py-20 bg-white relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <Badge
                variant="outline"
                className="border-teal-600 text-teal-700 bg-teal-50 px-3 py-1 text-xs uppercase tracking-wider font-semibold mb-3"
              >
                Cotação Direta e Sem Burocracia
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Solicite seu Orçamento
              </h2>
              <p className="mt-3 text-base text-gray-600 max-w-xl mx-auto">
                Preencha os dados abaixo e escolha se deseja despachar a cotação pelo{' '}
                <strong>WhatsApp</strong> ou por <strong>E-mail</strong>. Nossa equipe comercial
                responderá rapidamente.
              </p>
            </div>

            <Card className="border-[#ECEAE4] shadow-xl rounded-3xl overflow-hidden bg-[#FAF9F7]">
              <div className="h-2 bg-gradient-to-r from-teal-700 via-teal-600 to-amber-500" />
              <CardContent className="p-6 sm:p-10">
                {statusConfirmacao && (
                  <div className="mb-8 p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 flex items-start gap-3 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="text-sm block">Seu orçamento foi encaminhado!</strong>
                      <p className="text-xs text-teal-800 leading-relaxed">{statusConfirmacao}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={enviarPorWhatsApp} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Nome */}
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-xs font-semibold text-gray-700">
                        Nome ou Razão Social <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => {
                          setNome(e.target.value)
                          if (erros.nome) setErros((prev) => ({ ...prev, nome: undefined }))
                        }}
                        placeholder="Ex: Construtora Silva ou João Santos"
                        className={`bg-white border-[#ECEAE4] h-11 ${
                          erros.nome ? 'border-red-500 focus-visible:ring-red-400' : ''
                        }`}
                      />
                      {erros.nome && <p className="text-[11px] text-red-600">{erros.nome}</p>}
                    </div>

                    {/* Telefone / WhatsApp */}
                    <div className="space-y-2">
                      <Label htmlFor="telefone" className="text-xs font-semibold text-gray-700">
                        Telefone / WhatsApp <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={(e) => {
                          setTelefone(e.target.value)
                          if (erros.telefone) setErros((prev) => ({ ...prev, telefone: undefined }))
                        }}
                        placeholder="Ex: (87) 99999-0000"
                        className={`bg-white border-[#ECEAE4] h-11 ${
                          erros.telefone ? 'border-red-500 focus-visible:ring-red-400' : ''
                        }`}
                      />
                      {erros.telefone && (
                        <p className="text-[11px] text-red-600">{erros.telefone}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* E-mail (opcional) */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-semibold text-gray-700">
                        E-mail de contato{' '}
                        <span className="text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contato@suaempresa.com.br"
                        className="bg-white border-[#ECEAE4] h-11"
                      />
                    </div>

                    {/* Produto de interesse */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-700">
                        Produto de interesse
                      </Label>
                      <Select value={produto} onValueChange={setProduto}>
                        <SelectTrigger className="bg-white border-[#ECEAE4] h-11">
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#ECEAE4]">
                          <SelectItem value="Brita 1 2">Brita 1 2</SelectItem>
                          <SelectItem value="Brita 1 9">Brita 1 9</SelectItem>
                          <SelectItem value="Pedra Rachão">Pedra Rachão</SelectItem>
                          <SelectItem value="Pó de Pedra">Pó de Pedra</SelectItem>
                          <SelectItem value="Cascalhinho">Cascalhinho</SelectItem>
                          <SelectItem value="Outro / não sei ainda">
                            Outro / não sei ainda
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Quantidade estimada */}
                  <div className="space-y-2">
                    <Label htmlFor="quantidade" className="text-xs font-semibold text-gray-700">
                      Quantidade estimada / Cidade de entrega{' '}
                      <span className="text-gray-400 font-normal">(texto livre)</span>
                    </Label>
                    <Input
                      id="quantidade"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      placeholder="Ex: 3 caçambas (45 m³) para entrega em Sertânia / PE"
                      className="bg-white border-[#ECEAE4] h-11"
                    />
                  </div>

                  {/* Mensagem / Observações */}
                  <div className="space-y-2">
                    <Label htmlFor="mensagem" className="text-xs font-semibold text-gray-700">
                      Mensagem adicional ou especificações da obra
                    </Label>
                    <Textarea
                      id="mensagem"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      rows={3}
                      placeholder="Descreva detalhes como prazo desejado, tipo de veículo que acessa o local, forma de pagamento preferida..."
                      className="bg-white border-[#ECEAE4] resize-none"
                    />
                  </div>

                  {/* Botões de Ação com os dois canais */}
                  <div className="pt-4 border-t border-[#ECEAE4] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-gray-500 text-center sm:text-left">
                      <span>Escolha o canal pelo qual prefere despachar:</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <Button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-12 px-6 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar pelo WhatsApp
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={enviarPorEmail}
                        className="bg-white hover:bg-gray-100 text-gray-700 border-gray-300 font-semibold rounded-xl h-12 px-6 flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4 text-teal-700" />
                        Enviar por E-mail
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SEÇÃO CONTATO DIRETO */}
        <section id="contato" className="py-16 bg-[#FAF9F7] border-t border-[#ECEAE4]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Phone className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">Atendimento WhatsApp</h4>
                <p className="text-xs text-gray-600">
                  Fale com um consultor comercial para cotações rápidas e agendamento de entregas.
                </p>
                <a
                  href={`https://wa.me/${INSTITUCIONAL_CONFIG.whatsappNumero}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:underline pt-1"
                >
                  {INSTITUCIONAL_CONFIG.whatsappNumeroFormatado}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Mail className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">E-mail Comercial</h4>
                <p className="text-xs text-gray-600">
                  Envie solicitações formais de cotação para licitações e contratos de suprimento.
                </p>
                <a
                  href={`mailto:${INSTITUCIONAL_CONFIG.emailComercial}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:underline pt-1"
                >
                  {INSTITUCIONAL_CONFIG.emailComercial}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#ECEAE4] space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <MapPin className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900">Localização e Operação</h4>
                <p className="text-xs text-gray-600">{INSTITUCIONAL_CONFIG.localizacao}</p>
                <div className="text-xs text-gray-500 font-medium pt-1">
                  Atendimento: {INSTITUCIONAL_CONFIG.horarioAtendimento}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ INSTITUCIONAL */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna 1: Marca & Descrição */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-bold text-white block">Pedreira Cordeiro</span>
                  <span className="text-[11px] text-teal-400 font-bold uppercase tracking-wider block">
                    {INSTITUCIONAL_CONFIG.nomeFantasia}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Mineração, extração e britagem de rocha granítica para construção civil, rodovias,
                concreto e obras de infraestrutura com excelência e pontualidade.
              </p>

              <div className="text-xs text-slate-500 space-y-1 pt-2 font-mono">
                <div>CNPJ: {INSTITUCIONAL_CONFIG.cnpj}</div>
                <div>Razão Social: {INSTITUCIONAL_CONFIG.razaoSocial}</div>
                <div>Website: {INSTITUCIONAL_CONFIG.site}</div>
              </div>
            </div>

            {/* Coluna 2: Produtos */}
            <div className="lg:col-span-3 space-y-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-200 block">
                Agregados Disponíveis
              </span>
              <ul className="text-xs space-y-2">
                {PRODUTOS_PEDREIRA.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => rolarParaOrcamento(p.nome)}
                      className="hover:text-teal-400 transition-colors cursor-pointer text-left"
                    >
                      {p.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coluna 3: Links e Acesso */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-200 block">
                Área Restrita do Colaborador
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Acesso exclusivo para funcionários, frotistas e setor administrativo realizarem
                lançamentos de romaneios, abastecimentos, exames e finanças.
              </p>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border border-slate-800 text-xs font-semibold transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar no Sistema (ERP Pedreira Cordeiro)</span>
              </Link>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div>
              © {new Date().getFullYear()} {INSTITUCIONAL_CONFIG.nomeFantasia}. Todos os direitos
              reservados.
            </div>

            <div className="flex items-center gap-6">
              <a
                href={`https://${INSTITUCIONAL_CONFIG.site}`}
                className="hover:text-slate-300 transition-colors"
              >
                {INSTITUCIONAL_CONFIG.site}
              </a>
              <Link to="/login" className="hover:text-teal-400 transition-colors text-slate-400">
                Área do Colaborador
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
