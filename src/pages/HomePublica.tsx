import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  INSTITUCIONAL_CONFIG,
  PRODUTOS_PEDREIRA,
  ProdutoPedreiraItem,
  UNIDADES_GC,
  SERVICOS_GC,
} from '@/data/institucional'
import { videoInstitucionalService, VideoInstitucionalRecord } from '@/services/videoInstitucional'
import { LogoGcMix, LogoGcMixVector, ASSET_LOGO_BANNER } from '@/components/institucional/LogoGcMix'
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
  MessageCircle,
  Target,
  Eye,
  TrendingUp,
  Play,
  Image as ImageIcon,
  Check,
  Wrench,
  Flame,
  Boxes,
  Compass,
} from 'lucide-react'

export default function HomePublica() {
  // Estado do formulário de orçamento
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [produto, setProduto] = useState('Concreto Usinado GC Mix')
  const [quantidade, setQuantidade] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Modalidade de foto expandida na galeria
  const [fotoAtiva, setFotoAtiva] = useState<string | null>(null)

  // Vídeo institucional ativo gerenciado via ERP (PocketBase)
  const [videoAtivo, setVideoAtivo] = useState<VideoInstitucionalRecord | null>(null)
  const [carregandoVideo, setCarregandoVideo] = useState(true)

  // Estado de reprodução/erro do vídeo institucional
  const [videoErro, setVideoErro] = useState(false)

  // Buscar vídeo institucional ativo no PocketBase ao carregar
  useEffect(() => {
    let ativo = true
    async function carregarVideoInstitucional() {
      try {
        const video = await videoInstitucionalService.obterAtivo()
        if (ativo) {
          setVideoAtivo(video)
        }
      } catch (err) {
        console.warn('Erro ao carregar vídeo institucional ativo na Home:', err)
      } finally {
        if (ativo) {
          setCarregandoVideo(false)
        }
      }
    }
    carregarVideoInstitucional()
    return () => {
      ativo = false
    }
  }, [])

  // Feedback e erros
  const [erros, setErros] = useState<{ nome?: string; telefone?: string }>({})
  const [statusConfirmacao, setStatusConfirmacao] = useState<string | null>(null)

  // Rolagem suave até o formulário
  const rolarParaSecao = (id: string, produtoPreSelecionado?: string) => {
    if (produtoPreSelecionado) {
      setProduto(produtoPreSelecionado)
    }
    const el = document.getElementById(id)
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
      `*SOLICITAÇÃO DE ORÇAMENTO — ${INSTITUCIONAL_CONFIG.nomeFantasia.toUpperCase()}*`,
      `----------------------------------------`,
      `*Nome/Empresa:* ${nome.trim()}`,
      `*Telefone/WhatsApp:* ${telefone.trim()}`,
      email.trim() ? `*E-mail:* ${email.trim()}` : null,
      `*Produto/Serviço:* ${produto}`,
      quantidade.trim() ? `*Quantidade/Local da Obra:* ${quantidade.trim()}` : null,
      mensagem.trim() ? `*Mensagem/Detalhes:* ${mensagem.trim()}` : null,
      `----------------------------------------`,
      `Enviado via ${INSTITUCIONAL_CONFIG.site}`,
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#1E40AF] selection:text-white">
      {/* Barra superior de utilidades / institucional */}
      <div className="bg-[#0A1A3B] text-slate-300 text-xs py-2 px-4 border-b border-[#1A2E56]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              {INSTITUCIONAL_CONFIG.localizacao}
            </span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              {INSTITUCIONAL_CONFIG.horarioAtendimento}
            </span>
            <span className="hidden lg:inline text-slate-600">•</span>
            <a
              href={INSTITUCIONAL_CONFIG.telefoneTelLink}
              className="hidden lg:flex items-center gap-1.5 text-amber-300 font-semibold hover:text-amber-200"
            >
              <Phone className="w-3.5 h-3.5" />
              Central 0800: {INSTITUCIONAL_CONFIG.telefoneFormatado}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp: {INSTITUCIONAL_CONFIG.whatsappNumeroFormatado}
            </a>
            <span className="hidden sm:inline text-slate-700">|</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-[#60A5FA] hover:text-white transition-colors bg-[#1E3A8A]/50 hover:bg-[#1E3A8A] px-2.5 py-1 rounded-md border border-[#2563EB]/40"
            >
              <LogIn className="w-3 h-3" />
              Sou colaborador
            </Link>
          </div>
        </div>
      </div>

      {/* Header de Navegação */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Marca GC MIX em Azul Munique */}
          <a href="#" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="h-12 w-auto max-w-[130px] sm:max-w-[160px] md:max-w-[190px] flex items-center group-hover:scale-105 transition-transform">
              <img
                src={ASSET_LOGO_BANNER}
                alt="GC MIX Concreto Usinado & Pedreira Cordeiro"
                className="h-11 sm:h-12 w-auto object-contain rounded-lg shadow-xs"
              />
            </div>
            <div className="hidden xl:block pl-1 border-l border-slate-200">
              <span className="text-xs font-black tracking-tight text-[#0A2540] block">
                GC do Amaral
              </span>
              <span className="text-[10px] text-[#1D4ED8] font-bold uppercase tracking-wider block">
                Pedreira Cordeiro • C M Lokotrack
              </span>
            </div>
          </a>

          {/* Links desktop */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-sm font-semibold text-slate-700">
            <a href="#servicos" className="hover:text-[#1D4ED8] transition-colors">
              O que fazemos
            </a>
            <a
              href="#cm-lokotrack"
              className="text-[#1D4ED8] hover:text-[#1E3A8A] transition-colors flex items-center gap-1 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Britador Lokotrack
            </a>
            <a href="#pedreira" className="hover:text-[#1D4ED8] transition-colors">
              Pedreira Cordeiro
            </a>
            <a href="#produtos" className="hover:text-[#1D4ED8] transition-colors">
              Agregados
            </a>
            <a href="#unidades" className="hover:text-[#1D4ED8] transition-colors">
              Unidades
            </a>
            <a href="#sobre" className="hover:text-[#1D4ED8] transition-colors">
              Quem somos
            </a>
            <a href="#galeria" className="hover:text-[#1D4ED8] transition-colors">
              Fotos
            </a>
            <a href="#contato" className="hover:text-[#1D4ED8] transition-colors">
              Contato
            </a>
          </nav>

          {/* Ações do topo */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 hover:text-[#1D4ED8] hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
            >
              <LogIn className="w-4 h-4 text-[#1D4ED8]" />
              Área Restrita
            </Link>

            <Button
              onClick={() => rolarParaSecao('orcamento')}
              className="bg-gradient-to-r from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB] hover:from-[#172554] hover:to-[#1E40AF] text-white shadow-md shadow-blue-800/25 rounded-xl px-5 py-2.5 font-bold text-sm transition-all hover:scale-[1.02]"
            >
              Pedir Orçamento
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION EM AZUL MUNIQUE DOMINANTE COM LOGO GC MIX EM DESTAQUE NO TOPO */}
        <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 bg-gradient-to-br from-[#0A2540] via-[#113264] to-[#1E3A8A] text-white border-b border-[#1E3A8A]">
          {/* Efeitos de iluminação azul profunda */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[36rem] h-[36rem] rounded-full bg-[#2563EB]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-[32rem] h-[32rem] rounded-full bg-[#38BDF8]/20 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(#60A5FA_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* 1. LOGO GC MIX EM DESTAQUE NA PARTE SUPERIOR DO SITE */}
            <div className="mb-8 lg:mb-10 flex flex-col items-center lg:items-start">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl hover:border-white/40 transition-all max-w-full">
                <LogoGcMix variant="banner" className="max-w-md sm:max-w-lg md:max-w-xl w-full" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold tracking-wide">
                  Identidade Oficial • Concreto Usinado & Pedreira Cordeiro
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Coluna Texto */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E40AF]/60 border border-[#60A5FA]/30 text-[#93C5FD] text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Atendendo Paraíba • Pernambuco • Rio Grande do Norte
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
                  Concreto usinado e agregados de qualidade para a sua obra no{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-amber-300 italic font-serif">
                    sertão
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  <strong>5 unidades</strong> e <strong>1 pedreira própria</strong> atendendo
                  Paraíba, Pernambuco e Rio Grande do Norte com agilidade, dosagem controlada e
                  entrega no prazo.
                </p>

                {/* CTAs do Hero */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <a
                    href={INSTITUCIONAL_CONFIG.telefoneTelLink}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base px-6 py-4 rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <Phone className="w-5 h-5" />
                    Ligar: {INSTITUCIONAL_CONFIG.telefoneFormatado}
                  </a>

                  <a
                    href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-base px-6 py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5 border border-blue-400/40"
                  >
                    <MessageCircle className="w-5 h-5 text-emerald-300" />
                    Chamar no WhatsApp
                  </a>

                  <a
                    href="#galeria"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-200 hover:text-white px-4 py-3 rounded-xl border border-blue-400/20 hover:border-blue-300/40 hover:bg-white/5 transition-colors"
                  >
                    Ver nossas fotos
                    <ArrowRight className="w-4 h-4 text-blue-300" />
                  </a>
                </div>

                {/* Stats do Hero do site antigo */}
                <div className="pt-8 border-t border-blue-400/20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
                  {INSTITUCIONAL_CONFIG.statsHero.map((stat, i) => (
                    <div
                      key={i}
                      className="bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-xs"
                    >
                      <div className="text-3xl font-black text-white font-mono tracking-tight text-amber-300">
                        {stat.valor}
                      </div>
                      <div className="text-xs text-blue-200 font-medium leading-tight mt-0.5">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card visual Hero com foto da pedreira / usina */}
              <div className="lg:col-span-5">
                <div className="relative rounded-3xl overflow-hidden border border-blue-300/20 bg-white/10 backdrop-blur-md shadow-2xl p-4 sm:p-5 space-y-4">
                  <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden group">
                    <img
                      src={INSTITUCIONAL_CONFIG.fotosReais.heroAerea}
                      alt="Vista aérea da Pedreira Cordeiro — Foto real"
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                      loading="eager"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="bg-[#0A2540]/85 backdrop-blur-xs text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-400/30 shadow-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Foto Real da Jazida
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540]/90 via-[#0A2540]/30 to-transparent flex items-end p-5">
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-[#0A2540]/80 px-2 py-0.5 rounded border border-amber-400/30">
                          Patos — PB • Matriz
                        </span>
                        <h3 className="text-lg font-extrabold text-white mt-1 leading-snug">
                          Pedreira Cordeiro & Usina GC Mix
                        </h3>
                        <p className="text-xs text-blue-200 mt-0.5">
                          Agregados e concreto usinado com controle de qualidade e pontualidade
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#0A2540]/70 p-3 rounded-xl border border-blue-400/20">
                      <div className="text-blue-300 font-medium text-[11px]">Concreto Usinado</div>
                      <div className="text-white font-bold text-sm mt-0.5">GC Mix Sertão</div>
                      <div className="text-[10px] text-blue-200">Traços e laudos técnicos</div>
                    </div>
                    <div className="bg-[#0A2540]/70 p-3 rounded-xl border border-blue-400/20">
                      <div className="text-blue-300 font-medium text-[11px]">Britador Móvel</div>
                      <div className="text-amber-300 font-bold text-sm mt-0.5">Lokotrack C M</div>
                      <div className="text-[10px] text-blue-200">Esmagamento na obra</div>
                    </div>
                  </div>

                  <a
                    href="#cm-lokotrack"
                    className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <span>Conheça a locação do Britador Móvel Lokotrack</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CALLOUT DESTAQUE: C M CONSTRUÇÕES / LOKOTRACK NO TOPO (Como no site antigo) */}
        <section className="bg-gradient-to-r from-[#172554] via-[#1E3A8A] to-[#1E40AF] text-white py-6 px-4 border-b border-blue-700/50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-300 block">
                  Outra Empresa do Grupo GC do Amaral
                </span>
                <span className="text-base font-extrabold text-white block">
                  C M Construções — Britador Móvel Lokotrack
                </span>
                <span className="text-xs text-blue-200 hidden sm:inline">
                  Locação de britador de mandíbula móvel: esmagamos a pedra direto na sua obra, com
                  alta produção e sem custo de transporte.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <a
                href="#cm-lokotrack"
                className="w-full md:w-auto text-center px-4 py-2.5 bg-white hover:bg-blue-50 text-[#1E3A8A] font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
              >
                Conhecer o Lokotrack →
              </a>
              <a
                href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto text-center px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-colors shrink-0"
              >
                Orçamento Lokotrack
              </a>
            </div>
          </div>
        </section>

        {/* SEÇÃO O QUE FAZEMOS / SERVIÇOS (Conteúdo real do site antigo) */}
        <section id="servicos" className="py-20 bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                Serviços do Grupo
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                O Que Fazemos
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Do britado à dosagem do concreto — tudo com produção própria, controle de qualidade
                e frota integrada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICOS_GC.map((servico) => (
                <Card
                  key={servico.id}
                  className={`rounded-2xl border transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
                    servico.destaque
                      ? 'border-[#2563EB] bg-gradient-to-b from-blue-50/50 to-white shadow-md'
                      : 'border-slate-200 bg-white hover:border-[#3B82F6]'
                  }`}
                >
                  <CardContent className="p-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-13 h-13 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-md shadow-blue-900/20">
                        {servico.icone === 'concreto' && (
                          <Building2 className="w-6 h-6 text-amber-300" />
                        )}
                        {servico.icone === 'betoneira' && <Truck className="w-6 h-6 text-white" />}
                        {servico.icone === 'agregados' && (
                          <Layers className="w-6 h-6 text-amber-300" />
                        )}
                        {servico.icone === 'dosagem' && <Compass className="w-6 h-6 text-white" />}
                        {servico.icone === 'lokotrack' && (
                          <Wrench className="w-6 h-6 text-amber-300" />
                        )}
                      </div>

                      {servico.destaque && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1D4ED8] text-white uppercase tracking-wider">
                          Destaque
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-[#0A2540]">{servico.titulo}</h3>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        {servico.descricao}
                      </p>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0">
                    {servico.link ? (
                      <a
                        href={servico.link}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:text-[#1E3A8A]"
                      >
                        <span>Saiba mais detalhes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => rolarParaSecao('orcamento', servico.titulo)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:text-[#1E3A8A] cursor-pointer"
                      >
                        <span>Solicitar cotação</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              ))}

              {/* Card CTA Direto */}
              <Card className="rounded-2xl border-none bg-gradient-to-br from-[#0A2540] via-[#1E3A8A] to-[#1D4ED8] text-white p-7 flex flex-col justify-between shadow-xl">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
                    Atendimento Imediato
                  </span>
                  <h3 className="text-2xl font-black">Precisa de concreto ou brita hoje?</h3>
                  <p className="text-xs text-blue-100 leading-relaxed">
                    Nossa equipe comercial programa o volume e o horário exato da entrega na sua
                    obra.
                  </p>
                  <div className="pt-2 text-xs text-blue-200 space-y-1">
                    <div>✓ Atendimento pelo 0800 083 1200</div>
                    <div>✓ WhatsApp direto com consultores</div>
                    <div>✓ 5 unidades para entrega rápida</div>
                  </div>
                </div>

                <div className="pt-6">
                  <a
                    href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chamar no WhatsApp agora
                  </a>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SEÇÃO EXCLUSIVA DE DESTAQUE: LOCAÇÃO DO BRITADOR MÓVEL LOKOTRACK */}
        <section
          id="lokotrack-patos"
          className="py-16 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0A2540] text-white border-y border-amber-500/30 relative overflow-hidden"
        >
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-slate-900/80 border border-amber-400/40 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Painel Gráfico / Destaque de Serviço do Lokotrack */}
                <div className="lg:col-span-6">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950 p-8 shadow-2xl flex flex-col justify-between min-h-[300px] sm:min-h-[360px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          Patos — PB e Região
                        </span>
                        <span className="bg-[#0A2540]/90 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-400/30">
                          C M Construções
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                        <Wrench className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="my-6 space-y-3">
                      <div className="text-2xl sm:text-3xl font-black text-white leading-tight">
                        Britador Móvel de Mandíbula sobre Esteiras
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Solução móvel de alta performance para britagem primária e secundária.
                        Mobilidade total para operar diretamente na jazida da sua pedreira ou na
                        frente de serviço da sua obra.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-center">
                      <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                        <div className="text-base sm:text-lg font-black text-amber-400">100%</div>
                        <div className="text-[10px] text-slate-300">Móvel sobre esteiras</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                        <div className="text-base sm:text-lg font-black text-emerald-400">Zero</div>
                        <div className="text-[10px] text-slate-300">Frete de rocha bruta</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                        <div className="text-base sm:text-lg font-black text-blue-400">Alta</div>
                        <div className="text-[10px] text-slate-300">Produção horária</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Texto explicativo e cotação */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Equipamento para Locação
                  </div>

                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">
                    Locação do Britador Móvel <span className="text-amber-400">Lokotrack</span>
                  </h3>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    O <strong>britador móvel Lokotrack</strong> disponibilizado pela C M Construções
                    oferece tecnologia avançada para esmagamento contínuo de rochas. Com capacidade
                    para atuar na britagem primária e secundária no próprio canteiro, viabiliza o
                    aproveitamento imediato de rocha in loco.
                  </p>

                  <div className="space-y-2 text-xs sm:text-sm text-slate-200 pt-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Produção de britas e agregados com máxima granulometria</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Locação para obras de infraestrutura, estradas e pedreiras</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Elimina custo de transporte de rocha bruta pesada</span>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row gap-3">
                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-5 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Alugar Britador Lokotrack
                    </a>

                    <button
                      onClick={() =>
                        rolarParaSecao('orcamento', 'Britador Móvel Lokotrack — C M Construções')
                      }
                      className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-3.5 rounded-xl border border-white/20 transition-colors cursor-pointer"
                    >
                      Solicitar cotação
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO DEDICADA: C M CONSTRUÇÕES — BRITADOR MÓVEL LOKOTRACK */}
        <section
          id="cm-lokotrack"
          className="py-20 bg-gradient-to-b from-[#0A2540] to-[#0F172A] text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#1D4ED8]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Outra empresa do grupo
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                C M Construções — Britador Móvel Lokotrack
              </h2>
              <p className="mt-4 text-base sm:text-lg text-blue-100 leading-relaxed font-normal">
                Locação de britador de mandíbula móvel <strong>Lokotrack</strong> — esmagamento de
                pedra direto na sua obra, pedreira ou serviço, com produção alta e mobilidade total.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <a
                  href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:scale-105"
                >
                  <MessageCircle className="w-4 h-4" />
                  Pedir orçamento do Lokotrack
                </a>

                <button
                  onClick={() =>
                    rolarParaSecao('orcamento', 'Britador Móvel Lokotrack — C M Construções')
                  }
                  className="inline-flex items-center gap-2 bg-[#1E3A8A] hover:bg-[#1D4ED8] text-white font-bold text-sm px-6 py-3.5 rounded-xl border border-blue-400/40 transition-colors cursor-pointer"
                >
                  Solicitar via formulário
                </button>
              </div>
            </div>

            {/* Grid com Fotos Reais de Estoque e Produção de Brita — C M Construções */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Card 1: Pilhas de Brita Produzida */}
              <div className="group rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-b from-slate-900/90 to-blue-950/80 shadow-2xl backdrop-blur-xs relative ring-2 ring-amber-400/20">
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={INSTITUCIONAL_CONFIG.fotosReais.cmPilhas1}
                    alt="Pilhas de brita produzida — C M Construções"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    loading="lazy"
                    onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPilhas1)}
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md shadow-md uppercase tracking-wider">
                      Produção Real
                    </span>
                    <span className="bg-[#0A2540]/90 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-md border border-amber-400/30">
                      Brita Produzida
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <span className="bg-black/75 backdrop-blur-xs text-blue-200 text-[10px] px-2 py-0.5 rounded font-mono">
                      Foto real da unidade
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black text-amber-300">Brita Produzida</h4>
                    <Badge className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px]">
                      C M Construções
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    Brita produzida com granulometria uniforme e alta qualidade. A locação do
                    britador móvel permite produzir agregados diretamente na frente da obra ou na
                    jazida, atendendo demandas de grande porte.
                  </p>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-300">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      Produção in loco
                    </span>
                    <button
                      onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPilhas1)}
                      className="text-amber-300 hover:underline font-bold cursor-pointer"
                    >
                      Ampliar foto ↗
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Pátio de Estoque e Operação */}
              <div className="group rounded-2xl overflow-hidden border border-blue-400/20 bg-slate-900/60 shadow-xl backdrop-blur-xs">
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={INSTITUCIONAL_CONFIG.fotosReais.cmPatio}
                    alt="Pátio de estoque e expedição de brita"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    loading="lazy"
                    onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPatio)}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="bg-[#0A2540]/90 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-400/30">
                      Pátio de Estoque
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <span className="bg-black/75 backdrop-blur-xs text-blue-200 text-[10px] px-2 py-0.5 rounded font-mono">
                      Foto real da unidade
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-white">Pátio de Estoque</h4>
                    <Badge className="bg-blue-900/60 text-blue-200 border border-blue-400/30 text-[10px]">
                      Patos — PB
                    </Badge>
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed">
                    Pátio de estoque organizado com britas e agregados prontos para carregamento e
                    distribuição para obras de infraestrutura, pavimentação e centrais dosadoras da
                    região.
                  </p>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-300">
                    <span className="text-slate-400">Estoque pronto</span>
                    <button
                      onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPatio)}
                      className="text-amber-300 hover:underline font-bold cursor-pointer"
                    >
                      Ampliar foto ↗
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha adicional com pilhas de brita e capacidade */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="group rounded-2xl overflow-hidden border border-blue-400/20 bg-slate-900/60">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={INSTITUCIONAL_CONFIG.fotosReais.cmPilhas1}
                    alt="Brita produzida na pedreira"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    loading="lazy"
                    onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPilhas1)}
                  />
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold text-white">Brita Produzida na Obra</div>
                  <div className="text-[11px] text-blue-200">Alta produtividade por hora</div>
                </div>
              </div>

              <div className="group rounded-2xl overflow-hidden border border-blue-400/20 bg-slate-900/60">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={INSTITUCIONAL_CONFIG.fotosReais.cmPilhas2}
                    alt="Pilha de brita uniforme"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    loading="lazy"
                    onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPilhas2)}
                  />
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold text-white">Pilha de Brita Uniforme</div>
                  <div className="text-[11px] text-blue-200">Controle rigoroso de qualidade</div>
                </div>
              </div>

              <div className="group rounded-2xl overflow-hidden border border-blue-400/20 bg-slate-900/60">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={INSTITUCIONAL_CONFIG.fotosReais.cmPatio}
                    alt="Pátio de brita e pó de pedra"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    loading="lazy"
                    onClick={() => setFotoAtiva(INSTITUCIONAL_CONFIG.fotosReais.cmPatio)}
                  />
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold text-white">Pátio de Brita e Pó de Pedra</div>
                  <div className="text-[11px] text-blue-200">Estoque pronto para carregamento</div>
                </div>
              </div>
            </div>

            {/* Banner de Vantagens da locação */}
            <div className="mt-10 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#1E3A8A]/80 via-[#1D4ED8]/60 to-[#0A2540] border border-blue-400/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="text-lg font-bold text-white">
                  Por que alugar o Britador Móvel Lokotrack da C M Construções?
                </h4>
                <p className="text-xs text-blue-100">
                  Zero frete de transporte de pedra bruta • Operação rápida no local • Capacidade
                  para grandes volumes de britagem.
                </p>
              </div>

              <a
                href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-6 py-3 rounded-xl shadow-md shrink-0 transition-transform hover:scale-105"
              >
                <Phone className="w-3.5 h-3.5" />
                Falar com consultor Lokotrack
              </a>
            </div>
          </div>
        </section>

        {/* SEÇÃO PEDREIRA CORDEIRO (PRODUÇÃO PRÓPRIA — CONTEÚDO REAL) */}
        <section id="pedreira" className="py-20 bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <Badge
                  variant="outline"
                  className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 text-xs uppercase tracking-wider font-bold"
                >
                  Produção Própria
                </Badge>

                <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                  Pedreira Cordeiro
                </h2>

                <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                  Nossa pedreira própria em <strong>Patos — PB</strong> garante matéria-prima de
                  qualidade e preço competitivo para as obras da região.
                </p>

                {/* Bullets reais do site antigo */}
                <div className="space-y-3 pt-2">
                  {INSTITUCIONAL_CONFIG.pedreiraDestaques.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-4 h-4 font-bold" />
                      </div>
                      <span className="text-sm font-semibold text-[#0A2540]">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={() => rolarParaSecao('produtos')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-md shadow-blue-800/20 transition-colors cursor-pointer"
                  >
                    <Boxes className="w-4 h-4" />
                    Ver Catálogo de Agregados
                  </button>

                  <a
                    href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-[#1D4ED8] text-[#1D4ED8] hover:bg-blue-50 font-bold text-sm px-6 py-3.5 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Orçamento Direto
                  </a>
                </div>
              </div>

              {/* Foto real aérea da Pedreira Cordeiro */}
              <div className="lg:col-span-6">
                <div className="relative rounded-3xl overflow-hidden border border-blue-100 shadow-2xl bg-white">
                  <div className="relative h-80 sm:h-96 overflow-hidden group">
                    <img
                      src={INSTITUCIONAL_CONFIG.fotosReais.pedreiraBritador}
                      alt="Usina de britagem da Pedreira Cordeiro em Patos PB"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="bg-[#0A2540]/90 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1 rounded-full border border-blue-400/30 shadow-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Patos — PB
                      </span>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-white border-t border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#0A2540]">
                        Jazida Própria & Central de Britagem
                      </div>
                      <div className="text-xs text-slate-600">
                        Fazenda Várzea da Jurema, S/N — Patos — PB
                      </div>
                    </div>
                    <Badge className="bg-[#1D4ED8] text-white hover:bg-[#1E40AF]">
                      Pedreira Cordeiro
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO PRODUTOS / AGREGADOS DA PEDREIRA */}
        <section id="produtos" className="py-20 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                Catálogo de Agregados
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Produtos da Pedreira Cordeiro
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Brita 12, Brita 19, Pedra rachão, Pó de pedra e Cascalhinho. Controle granulométrico
                para concreto estrutural, pavimentação e drenagem.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {PRODUTOS_PEDREIRA.map((item: ProdutoPedreiraItem) => (
                <Card
                  key={item.id}
                  className="group bg-white hover:border-[#2563EB] border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                >
                  <div>
                    {/* Imagem do produto com fallback resiliente */}
                    <div className="relative h-52 overflow-hidden bg-slate-900 group/img">
                      <img
                        src={item.imagem}
                        alt={item.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget
                          if (item.imagemSecundaria && target.src !== item.imagemSecundaria) {
                            target.src = item.imagemSecundaria
                          } else {
                            // Imagem fallback padrão local de agregados da pedreira
                            target.src = '/site-img/cm-patio.svg'
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="bg-[#0A2540]/90 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/20">
                          {item.codigoRef}
                        </span>
                        <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                          Foto da Usina
                        </span>
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <span className="bg-[#1D4ED8]/95 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-md">
                          Densidade {item.densidadeMedia}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <h3 className="text-2xl font-bold text-[#0A2540] mb-1 group-hover:text-[#1D4ED8] transition-colors">
                        {item.nome}
                      </h3>

                      <div className="text-xs font-bold text-[#1D4ED8] mb-3 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{item.granulometria}</span>
                      </div>

                      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                        {item.descricao}
                      </p>

                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs space-y-1">
                        <span className="font-bold text-[#0A2540] block">
                          Principais Aplicações:
                        </span>
                        <span className="text-slate-600 leading-snug block">{item.aplicacao}</span>
                      </div>
                    </CardContent>
                  </div>

                  <div className="p-6 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                        Valores
                      </span>
                      <span className="text-xs font-bold text-[#0A2540]">Sob Consulta</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => rolarParaSecao('orcamento', item.nome)}
                      className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Pedir Orçamento
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Card Concreto GC Mix Integrado */}
              <Card className="bg-gradient-to-br from-[#0A2540] via-[#1E3A8A] to-[#1D4ED8] text-white rounded-2xl p-8 flex flex-col justify-between border-none shadow-xl">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider font-bold text-amber-300 block">
                      Concreto Usinado
                    </span>
                    <h3 className="text-2xl font-black mt-1">Concreto Usinado GC Mix</h3>
                  </div>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    Produzido com brita e pó de pedra da nossa própria pedreira, garantindo o mais
                    alto rigor de traço, resistência (FCK) e agilidade de entrega com caminhões
                    betoneira.
                  </p>
                  <ul className="text-xs text-blue-100 space-y-2 pt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Dosagem computadorizada em central
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Frota de betoneiras para despejo pontual
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Traços para laje, piso, fundação e muro
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => rolarParaSecao('orcamento', 'Concreto Usinado GC Mix')}
                    className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl cursor-pointer"
                  >
                    Cotar Concreto Usinado
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SEÇÃO NOSSAS UNIDADES (Conteúdo real do site antigo) */}
        <section id="unidades" className="py-20 bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                Onde Estamos
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Nossas Unidades
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Onde você estiver na região, tem uma unidade <strong>GC do Amaral</strong> perto de
                você.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {UNIDADES_GC.map((unidade) => (
                <div
                  key={unidade.id}
                  className={`rounded-2xl p-6 text-center flex flex-col justify-between transition-all duration-300 hover:shadow-lg ${
                    unidade.destaque
                      ? 'bg-gradient-to-b from-[#1E3A8A] to-[#0A2540] text-white shadow-md ring-2 ring-[#2563EB]'
                      : 'bg-[#F8FAFC] border border-blue-100 text-slate-800 hover:border-[#2563EB]'
                  }`}
                >
                  <div className="space-y-3">
                    <div
                      className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center font-bold ${
                        unidade.destaque
                          ? 'bg-amber-400 text-slate-950 shadow-md'
                          : 'bg-blue-100 text-[#1D4ED8]'
                      }`}
                    >
                      <MapPin className="w-6 h-6" />
                    </div>

                    <div>
                      <h3 className="text-xl font-black">
                        {unidade.cidade} — {unidade.uf}
                      </h3>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          unidade.destaque ? 'text-blue-200' : 'text-slate-600'
                        }`}
                      >
                        {unidade.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-blue-200/40">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        unidade.destaque
                          ? 'bg-white/10 text-amber-300 border border-white/20'
                          : 'bg-blue-50 text-[#1D4ED8] border border-blue-200'
                      }`}
                    >
                      {unidade.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Banner de Atendimento Regional */}
            <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 border border-blue-200 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <span className="text-xs uppercase font-bold text-[#1D4ED8] tracking-wider block">
                  Logística Integrada no Sertão
                </span>
                <h4 className="text-xl font-black text-[#0A2540]">
                  Entregas programadas em dezenas de municípios da PB, PE e RN
                </h4>
                <p className="text-xs text-slate-600">
                  Matriz em Patos (PB), concreteiras em Santa Luzia, Monteiro, São José do Egito e
                  Caicó.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={INSTITUCIONAL_CONFIG.telefoneTelLink}
                  className="px-5 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  0800 083 1200
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO MISSÃO, VISÃO E OBJETIVOS (Conteúdo oficial do site antigo) */}
        <section id="sobre" className="py-20 bg-[#F8FAFC] border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                O Grupo
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Quem Somos
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Missão, visão e objetivos do <strong>{INSTITUCIONAL_CONFIG.nomeFantasia}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card Missão */}
              <Card className="bg-white border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
                <CardContent className="p-8 space-y-4">
                  <div className="w-13 h-13 rounded-2xl bg-blue-50 border border-blue-200 text-[#1D4ED8] flex items-center justify-center shadow-xs">
                    <Target className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                      Nosso Propósito
                    </span>
                    <h3 className="text-2xl font-black text-[#0A2540] mt-1">Missão</h3>
                  </div>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-normal">
                    &ldquo;{INSTITUCIONAL_CONFIG.missao}&rdquo;
                  </p>
                </CardContent>
                <div className="px-8 py-3 bg-blue-50/70 border-t border-blue-100 text-xs font-bold text-[#1D4ED8] flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1D4ED8]" />
                  Qualidade, prazo e preço justo
                </div>
              </Card>

              {/* Card Visão */}
              <Card className="bg-white border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
                <CardContent className="p-8 space-y-4">
                  <div className="w-13 h-13 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs">
                    <Eye className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                      Onde queremos chegar
                    </span>
                    <h3 className="text-2xl font-black text-[#0A2540] mt-1">Visão</h3>
                  </div>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-normal">
                    &ldquo;{INSTITUCIONAL_CONFIG.visao}&rdquo;
                  </p>
                </CardContent>
                <div className="px-8 py-3 bg-amber-50/70 border-t border-amber-100 text-xs font-bold text-amber-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-600" />
                  Referência no sertão (PB, PE e RN)
                </div>
              </Card>

              {/* Card Objetivos */}
              <Card className="bg-white border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
                <CardContent className="p-8 space-y-4">
                  <div className="w-13 h-13 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
                    <TrendingUp className="w-7 h-7 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Nossas Metas Práticas
                    </span>
                    <h3 className="text-2xl font-black text-[#0A2540] mt-1">Objetivos</h3>
                  </div>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 pt-1">
                    {INSTITUCIONAL_CONFIG.objetivos.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="px-8 py-3 bg-blue-50/70 border-t border-blue-100 text-xs font-bold text-[#0A2540] flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1D4ED8]" />
                  Pontualidade e geração de emprego local
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SEÇÃO VÍDEO INSTITUCIONAL (Oficial — exibida apenas quando há vídeo ativo cadastrado pelo ERP) */}
        {!carregandoVideo && videoAtivo && (
          <section id="video" className="py-20 bg-[#0A2540] text-white relative overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#1D4ED8]/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="text-center max-w-3xl mx-auto mb-12">
                <Badge
                  variant="outline"
                  className="border-blue-400 text-blue-300 bg-blue-950/60 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
                >
                  Nossa História
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {videoAtivo.titulo || 'A História da Empresa'}
                </h2>
                <p className="mt-3 text-base sm:text-lg text-blue-100 leading-relaxed">
                  {videoAtivo.descricao || (
                    <>
                      Do primeiro caminhão à frota de hoje — a caminhada do{' '}
                      <strong>Grupo GC do Amaral</strong>.
                    </>
                  )}
                </p>
              </div>

              {/* Cartão Elegante do Vídeo Institucional */}
              <div className="max-w-4xl mx-auto">
                <div className="relative rounded-3xl overflow-hidden border border-blue-400/30 bg-slate-950 shadow-2xl">
                  {!videoErro ? (
                    <div className="aspect-video w-full bg-black relative flex items-center justify-center group">
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        poster={
                          videoAtivo.capa || videoAtivo.poster
                            ? videoInstitucionalService.obterUrlArquivo(
                                videoAtivo,
                                videoAtivo.capa || videoAtivo.poster || '',
                              )
                            : INSTITUCIONAL_CONFIG.fotosReais.heroAerea
                        }
                        className="w-full h-full object-cover"
                        onError={() => setVideoErro(true)}
                      >
                        <source
                          src={videoInstitucionalService.obterUrlArquivo(
                            videoAtivo,
                            videoAtivo.arquivo,
                          )}
                          type="video/mp4"
                        />
                        Formato de vídeo não suportado pelo navegador.
                      </video>
                    </div>
                  ) : (
                    <div className="relative aspect-video w-full overflow-hidden group bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-400" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white max-w-md mb-2">
                        Formato de vídeo não suportado pelo navegador
                      </h3>
                      <p className="text-xs sm:text-sm text-amber-200/90 max-w-md mb-4 leading-relaxed">
                        O navegador não conseguiu decodificar esta faixa de vídeo (codec não
                        suportado ou arquivo de áudio renomeado). Por favor, envie um arquivo em
                        formato MP4 autêntico com codec de vídeo padrão H.264 (AVC).
                      </p>
                      <a
                        href={videoInstitucionalService.obterUrlArquivo(
                          videoAtivo,
                          videoAtivo.arquivo,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
                      >
                        Baixar arquivo diretamente
                      </a>
                    </div>
                  )}

                  <div className="p-5 sm:p-6 bg-[#0A1A3B] border-t border-blue-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1D4ED8]/30 border border-[#1D4ED8]/50 flex items-center justify-center text-amber-300 shrink-0">
                        <Play className="w-5 h-5 fill-amber-300/20" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{videoAtivo.titulo}</h4>
                        <p className="text-xs text-blue-200">
                          {videoAtivo.descricao ||
                            'Vídeo institucional oficial gravado nas instalações do grupo'}
                        </p>
                      </div>
                    </div>

                    <a
                      href={videoInstitucionalService.obterUrlArquivo(
                        videoAtivo,
                        videoAtivo.arquivo,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1D4ED8] text-white text-xs font-bold border border-blue-400/30 transition-colors"
                    >
                      <span>Abrir em tela cheia</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SEÇÃO GALERIA DE FOTOS REAIS (Enriquecida com fotos reais do site antigo) */}
        <section id="galeria" className="py-20 bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                Galeria
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Nossa Estrutura em Ação
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Frota, equipamentos e obras atendidas pela GC do Amaral, GC Mix, Pedreira Cordeiro e
                C M Construções.
              </p>
            </div>

            {/* Grid de Fotos Reais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.betoneira1,
                  titulo: 'Betoneira GC Mix em Entrega',
                  legenda: 'Frota ativa atendendo obras na Paraíba',
                  badge: 'Betoneira GC Mix',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.betoneira2,
                  titulo: 'Betoneira GC Mix & Pedreira',
                  legenda: 'Carregamento no pátio de agregados',
                  badge: 'Operação Integrada',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.frotaGcMix,
                  titulo: 'Frota de Betoneiras GC Mix',
                  legenda: 'Caminhões traçados para entregas volumosas',
                  badge: 'Frota Própria',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.betoneiraRota,
                  titulo: 'Betoneira em Rota',
                  legenda: 'Logística ágil no interior',
                  badge: 'Logística',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.betoneira5,
                  titulo: 'Caminhão Betoneira GC Mix',
                  legenda: 'Equipamentos revisados e com lacre',
                  badge: 'Qualidade',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.betoneira7,
                  titulo: 'Betoneira GC Mix em Canteiro',
                  legenda: 'Descarga direta na bomba ou caçamba',
                  badge: 'Canteiro de Obras',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.silo2,
                  titulo: 'Silo GC Mix',
                  legenda: 'Central dosadora de alta capacidade',
                  badge: 'Central Dosadora',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.siloMonteiro,
                  titulo: 'Silo GC Mix — Monteiro — PB',
                  legenda: 'Central com atendimento 0800 083 1200',
                  badge: 'Unidade Monteiro',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.concretagemPatos,
                  titulo: 'Concretagem em Patos — PB',
                  legenda: 'Despejo contínuo em laje estrutural',
                  badge: 'Patos — PB',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.pisoIndustrial,
                  titulo: 'Piso de Concreto Industrial',
                  legenda: 'Resistência calculada e nivelamento',
                  badge: 'Piso Industrial',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.pisoAcabamento,
                  titulo: 'Acabamento de Piso',
                  legenda: 'Polimento e cura do concreto usinado',
                  badge: 'Acabamento',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.preparacaoObra,
                  titulo: 'Preparação de Obra',
                  legenda: 'Nivelamento com motoniveladora',
                  badge: 'Terraplanagem',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.pedreiraAerea2,
                  titulo: 'GCA Pedreira Cordeiro',
                  legenda: 'Vista aérea da jazida de extração',
                  badge: 'Jazida Própria',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.pedreiraBritador,
                  titulo: 'Britador Visto do Alto',
                  legenda: 'Peneiramento contínuo de rocha',
                  badge: 'Central Britagem',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.pedreiraRegiao,
                  titulo: 'Pedreira Cordeiro e Região',
                  legenda: 'Inserção estratégica no sertão',
                  badge: 'Região Sertão',
                },
                {
                  src: INSTITUCIONAL_CONFIG.fotosReais.britadorFixoCm3,
                  titulo: 'Instalação de Britagem',
                  legenda: 'Britador fixo em atividade na pedreira',
                  badge: 'Central Britagem',
                },
              ].map((foto, idx) => (
                <div
                  key={idx}
                  onClick={() => setFotoAtiva(foto.src)}
                  className="group rounded-2xl overflow-hidden border border-slate-200 bg-[#F8FAFC] shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer"
                >
                  <div className="relative h-48 overflow-hidden bg-slate-100">
                    <img
                      src={foto.src}
                      alt={foto.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="bg-[#0A2540]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {foto.badge}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-white">
                    <h4 className="text-xs font-bold text-[#0A2540] group-hover:text-[#1D4ED8] transition-colors line-clamp-1">
                      {foto.titulo}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{foto.legenda}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Aviso sobre fotos oficiais */}
            <div className="mt-10 p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-700 gap-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>
                  Fotos e identidade visual 100% integradas da empresa (GC Mix, Pedreira Cordeiro e
                  C M Construções).
                </span>
              </div>
              <button
                onClick={() => rolarParaSecao('orcamento')}
                className="inline-flex items-center gap-1 font-bold text-[#1D4ED8] hover:underline shrink-0 cursor-pointer"
              >
                <span>Solicitar cotação online</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* MODAL / LIGHTBOX DE FOTO EXPANDIDA */}
        {fotoAtiva && (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setFotoAtiva(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl">
              <img
                src={fotoAtiva}
                alt="Foto ampliada da Pedreira Cordeiro"
                className="w-full h-full max-h-[85vh] object-contain"
              />
              <button
                onClick={() => setFotoAtiva(null)}
                className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 text-xs font-bold transition-colors cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        )}

        {/* SEÇÃO ORÇAMENTO (WhatsApp e E-mail — SEM GRAVAÇÃO NO ERP) */}
        <section id="orcamento" className="py-20 bg-[#F8FAFC] relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 text-xs uppercase tracking-wider font-bold mb-3"
              >
                Cotação Rápida Sem Burocracia
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Solicite seu Orçamento
              </h2>
              <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
                Preencha os dados abaixo e envie diretamente para o nosso{' '}
                <strong>WhatsApp comercial</strong> ou por <strong>E-mail</strong>. Orçamentos
                rápidos e sem compromisso.
              </p>
            </div>

            <Card className="border-blue-100 shadow-xl rounded-3xl overflow-hidden bg-white">
              <div className="h-2.5 bg-gradient-to-r from-[#0A2540] via-[#1D4ED8] to-amber-400" />
              <CardContent className="p-6 sm:p-10">
                {statusConfirmacao && (
                  <div className="mb-8 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="text-sm block">Seu orçamento foi encaminhado!</strong>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        {statusConfirmacao}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={enviarPorWhatsApp} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Nome */}
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="text-xs font-bold text-slate-700">
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
                        className={`bg-white border-slate-200 h-11 focus-visible:ring-[#1D4ED8] ${
                          erros.nome ? 'border-red-500' : ''
                        }`}
                      />
                      {erros.nome && <p className="text-[11px] text-red-600">{erros.nome}</p>}
                    </div>

                    {/* Telefone / WhatsApp */}
                    <div className="space-y-2">
                      <Label htmlFor="telefone" className="text-xs font-bold text-slate-700">
                        Telefone / WhatsApp <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={(e) => {
                          setTelefone(e.target.value)
                          if (erros.telefone) setErros((prev) => ({ ...prev, telefone: undefined }))
                        }}
                        placeholder="Ex: (83) 98899-0000"
                        className={`bg-white border-slate-200 h-11 focus-visible:ring-[#1D4ED8] ${
                          erros.telefone ? 'border-red-500' : ''
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
                      <Label htmlFor="email" className="text-xs font-bold text-slate-700">
                        E-mail de contato{' '}
                        <span className="text-slate-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contato@suaempresa.com.br"
                        className="bg-white border-slate-200 h-11 focus-visible:ring-[#1D4ED8]"
                      />
                    </div>

                    {/* Produto de interesse */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">
                        Produto ou Serviço de Interesse
                      </Label>
                      <Select value={produto} onValueChange={setProduto}>
                        <SelectTrigger className="bg-white border-slate-200 h-11">
                          <SelectValue placeholder="Selecione o produto ou serviço" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="Concreto Usinado GC Mix">
                            Concreto Usinado GC Mix (Traços diversos)
                          </SelectItem>
                          <SelectItem value="Brita 12">Brita 12 (9,5 a 19 mm)</SelectItem>
                          <SelectItem value="Brita 19">Brita 19 (19 a 25 mm)</SelectItem>
                          <SelectItem value="Pedra rachão">
                            Pedra rachão (Muros/Contenções)
                          </SelectItem>
                          <SelectItem value="Pó de pedra">
                            Pó de pedra (Argamassas e assentamento)
                          </SelectItem>
                          <SelectItem value="Cascalhinho">Cascalhinho (Pedrisco limpo)</SelectItem>
                          <SelectItem value="Britador Móvel Lokotrack — C M Construções">
                            Britador Móvel Lokotrack (C M Construções)
                          </SelectItem>
                          <SelectItem value="Outro / Mix de Materiais">
                            Outro / Mix de Materiais
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Quantidade estimada e Cidade */}
                  <div className="space-y-2">
                    <Label htmlFor="quantidade" className="text-xs font-bold text-slate-700">
                      Volume estimado / Cidade e Local da Obra
                    </Label>
                    <Input
                      id="quantidade"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      placeholder="Ex: 8 m³ de concreto usinado para laje em Patos — PB"
                      className="bg-white border-slate-200 h-11 focus-visible:ring-[#1D4ED8]"
                    />
                  </div>

                  {/* Mensagem / Observações */}
                  <div className="space-y-2">
                    <Label htmlFor="mensagem" className="text-xs font-bold text-slate-700">
                      Observações adicionais ou data desejada da entrega
                    </Label>
                    <Textarea
                      id="mensagem"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      rows={3}
                      placeholder="Descreva detalhes como fck do concreto, necessidade de bomba, tipo de acesso para caminhões..."
                      className="bg-white border-slate-200 resize-none focus-visible:ring-[#1D4ED8]"
                    />
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-slate-500 text-center sm:text-left">
                      <span>Orçamento rápido despachado diretamente para nossos consultores:</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <Button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12 px-6 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar pelo WhatsApp
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={enviarPorEmail}
                        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 font-bold rounded-xl h-12 px-6 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[#1D4ED8]" />
                        Enviar por E-mail
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SEÇÃO CONTATO DIRETO / FALE COM A GENTE (Com o endereço corrigido e telefones reais) */}
        <section id="contato" className="py-16 bg-white border-t border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-2 text-xs uppercase tracking-wider font-bold"
              >
                Contato
              </Badge>
              <h3 className="text-3xl font-black text-[#0A2540]">Fale com a Gente</h3>
              <p className="text-sm text-slate-600 mt-1">
                Atendimento de segunda a sábado, em todas as unidades.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Telefone 0800 */}
              <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-blue-100 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center shadow-md shadow-blue-800/20">
                  <Phone className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#0A2540]">Central de Atendimento</h4>
                <p className="text-xs text-slate-600">Ligação gratuita para todo o Brasil.</p>
                <div className="pt-1">
                  <a
                    href={INSTITUCIONAL_CONFIG.telefoneTelLink}
                    className="inline-flex items-center gap-1.5 text-base font-black text-[#1D4ED8] hover:underline"
                  >
                    {INSTITUCIONAL_CONFIG.telefoneFormatado}
                  </a>
                </div>
              </div>

              {/* WhatsApp Oficial */}
              <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-blue-100 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#0A2540]">WhatsApp Comercial</h4>
                <p className="text-xs text-slate-600">Cotações de concreto e do Lokotrack.</p>
                <div className="pt-1">
                  <a
                    href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-base font-black text-emerald-700 hover:underline"
                  >
                    {INSTITUCIONAL_CONFIG.whatsappNumeroFormatado}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Endereço Exato da Matriz */}
              <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-blue-100 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-md shadow-blue-900/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#0A2540]">Endereço da Matriz</h4>
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong>{INSTITUCIONAL_CONFIG.enderecoMatriz}</strong>
                  <div>{INSTITUCIONAL_CONFIG.cidadeUfCepMatriz}</div>
                </div>
                <div className="text-[11px] text-slate-500 font-medium pt-1">
                  Matriz • Pedreira Cordeiro e GC Mix
                </div>
              </div>

              {/* Horário */}
              <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-blue-100 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-[#0A2540]">Horário de Funcionamento</h4>
                <div className="text-xs text-slate-700 leading-relaxed font-semibold">
                  {INSTITUCIONAL_CONFIG.horarioAtendimento}
                </div>
                <div className="text-[11px] text-slate-500">
                  Plantão comercial e logística de concretagem
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ INSTITUCIONAL EM AZUL PROFUNDO MUNIQUE */}
      <footer className="bg-[#0A1A3B] text-slate-300 border-t border-[#1E3A8A] pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna 1: Marca & Descrição com Logo GC MIX */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-auto max-w-[140px] sm:max-w-[170px] overflow-hidden rounded-xl border border-white/20 bg-white/5 p-1 flex items-center">
                  <img
                    src={ASSET_LOGO_BANNER}
                    alt="GC MIX Concreto Usinado"
                    className="h-full w-auto object-contain"
                  />
                </div>
                <div>
                  <span className="text-lg font-black text-white block">
                    {INSTITUCIONAL_CONFIG.nomeFantasia}
                  </span>
                  <span className="text-[11px] text-[#60A5FA] font-bold uppercase tracking-wider block">
                    GC Mix • Pedreira Cordeiro • C M Construções
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                Concreto usinado dosado em central, extração e britagem de rocha granítica, e
                locação de britador móvel Lokotrack para Paraíba, Pernambuco e Rio Grande do Norte.
              </p>

              <div className="text-xs text-slate-400 space-y-1 pt-2 font-mono">
                <div>CNPJ: {INSTITUCIONAL_CONFIG.cnpj}</div>
                <div>Razão Social: {INSTITUCIONAL_CONFIG.razaoSocial}</div>
                <div>
                  Endereço: {INSTITUCIONAL_CONFIG.enderecoMatriz} —{' '}
                  {INSTITUCIONAL_CONFIG.cidadeUfCepMatriz}
                </div>
              </div>
            </div>

            {/* Coluna 2: Unidades e Serviços */}
            <div className="lg:col-span-3 space-y-3">
              <span className="text-xs uppercase tracking-wider font-bold text-white block">
                Nossas Unidades
              </span>
              <ul className="text-xs space-y-2 text-slate-300">
                {UNIDADES_GC.map((u) => (
                  <li key={u.id} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                    <span>
                      {u.cidade} — {u.uf} ({u.tipo})
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <span className="text-xs uppercase tracking-wider font-bold text-white block mb-1">
                  C M Construções
                </span>
                <a href="#cm-lokotrack" className="text-xs text-amber-300 hover:underline block">
                  Britador Móvel Lokotrack →
                </a>
              </div>
            </div>

            {/* Coluna 3: Acesso Restrito & Colaborador */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-xs uppercase tracking-wider font-bold text-white block">
                Área Restrita do Colaborador
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Acesso exclusivo para colaboradores e setor administrativo para romaneios, vendas,
                frotas, contas a pagar/receber e exames.
              </p>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#1D4ED8] hover:from-[#172554] hover:to-[#1E40AF] text-white text-xs font-bold transition-all shadow-md border border-blue-400/30"
              >
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>Entrar no Sistema (ERP Pedreira Cordeiro)</span>
              </Link>

              <div className="pt-2 flex flex-col gap-1 text-xs text-slate-400">
                <div>
                  Central 0800:{' '}
                  <strong className="text-white">{INSTITUCIONAL_CONFIG.telefoneFormatado}</strong>
                </div>
                <div>
                  WhatsApp:{' '}
                  <strong className="text-emerald-400">
                    {INSTITUCIONAL_CONFIG.whatsappNumeroFormatado}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-[#1E3A8A]/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <div>
              © {new Date().getFullYear()} {INSTITUCIONAL_CONFIG.nomeFantasia}. Todos os direitos
              reservados.
            </div>

            <div className="flex items-center gap-6">
              <span className="text-slate-400 font-medium">{INSTITUCIONAL_CONFIG.site}</span>
              <Link
                to="/login"
                className="hover:text-[#60A5FA] transition-colors text-slate-300 font-semibold"
              >
                Área do Colaborador
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
