import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  INSTITUCIONAL_CONFIG,
  PRODUTOS_PEDREIRA,
  ProdutoPedreiraItem,
  UNIDADES_GC,
  SERVICOS_GC,
} from '@/data/institucional'
import { FOTOS_ESTATICAS_PEDREIRA, getFotoRealUrl } from '@/lib/fotosReais'
import { LogoGcMix, ASSET_LOGO_BANNER } from '@/components/institucional/LogoGcMix'
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
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  LogIn,
  MessageCircle,
  Target,
  Eye,
  TrendingUp,
  Check,
  Wrench,
  Boxes,
  Compass,
  Building2,
  Sparkles,
  Maximize2,
  X,
  Cpu,
  Video,
  Play,
  Tv,
} from 'lucide-react'

// As fotos reais autênticas importadas diretamente como assets compilados
// (100% à prova de falhas: se estiver sob domínio de redirecionamento ou CSP estrita,
// os assets estáticos sempre são servidos pelo bundle com hash de produção e cache perfeito)
const FOTOS_REAIS = {
  aereaJazida: {
    src: FOTOS_ESTATICAS_PEDREIRA.vistaDeCima,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.heroAerea,
    titulo: 'Vista Aérea da Jazida Própria',
    local: 'Pedreira Cordeiro • Patos — PB',
    descricao:
      'Maciço rochoso granítico próprio de alta tenacidade, base de extração com licenciamento pleno e capacidade para atender obras civis de grande porte no sertão.',
    etiqueta: 'Jazida Própria',
  },
  aereaTopoPlanta: {
    src: FOTOS_ESTATICAS_PEDREIRA.vistaDeCima,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.aereaTopoPlanta,
    titulo: 'Vista de Topo da Jazida & Usina Solar',
    local: 'Planta Industrial • Patos — PB',
    descricao:
      'Registro aéreo vertical completo da jazida: área de britagem com pilhas e correias, pátio de maquinários pesados, galpão operacional, frota de caminhões e grande conjunto de energia solar fotovoltaica.',
    etiqueta: 'Infraestrutura & Energia Solar',
  },
  patioBrita: {
    src: FOTOS_ESTATICAS_PEDREIRA.patioDeBrita,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.patioBrita,
    titulo: 'Pátio de Agregados e Peneira Vibratória',
    local: 'Central de Britagem • Patos — PB',
    descricao:
      'Pátio de classificação com sistema de peneiramento e expedição simultânea para carretas, caçambas e centrais de concreto usinado.',
    etiqueta: 'Pátio de Classificação',
  },
  patioBritaPilhas: {
    src: FOTOS_ESTATICAS_PEDREIRA.patioDeBrita,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.patioBritaPilhas,
    titulo: 'Grandes Pilhas de Brita 1 e Brita 2',
    local: 'Pátio de Britas • Patos — PB',
    descricao:
      'Estoque calibrado de Brita 1 e Brita 2 sob céu do sertão, com caminhão basculante basculando rocha na peneira vibrolimpeza ao fundo e expedição contínua.',
    etiqueta: 'Estoque de Brita 1 e 2',
  },
  correiaProducao: {
    src: FOTOS_ESTATICAS_PEDREIRA.poDePedra,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.correiaPoDePedra,
    titulo: 'Correia Transportadora e Pilha de Pó de Pedra',
    local: 'Linha de Britagem • Patos — PB',
    descricao:
      'Produção contínua de pó de pedra e agregados finos com controle rigoroso de curva granulométrica para argamassas e concreto usinado.',
    etiqueta: 'Britagem Contínua',
  },
  pilhaPoDePedra: {
    src: FOTOS_ESTATICAS_PEDREIRA.poDePedra,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.pilhaPoDePedra,
    titulo: 'Pilha de Pó de Pedra e Linha de Correia',
    local: 'Setor de Agregados Miúdos • Patos — PB',
    descricao:
      'Grande volume de pó de pedra claro pronto para carregamento em primeiro plano, com correia transportadora empilhando brita ao fundo, cerca de contenção e vegetação nativa da caatinga.',
    etiqueta: 'Pó de Pedra Selecionado',
  },
  lokotrackMovel: {
    src: FOTOS_ESTATICAS_PEDREIRA.lokotrackMovel,
    fallback: INSTITUCIONAL_CONFIG.fotosReais.lokotrackMovel,
    titulo: 'Britador Móvel Lokotrack em Operação',
    local: 'C M Construções • Operação em Campo',
    descricao:
      'Conjunto móvel sobre esteiras com peneiras vibratórias e correias levantadas, pilhas de agregados britados e equipe técnica em campo. Alta produtividade direto na frente de lavra.',
    etiqueta: 'C M Construções — Lokotrack',
  },
}

export default function HomePublica() {
  // Estado do formulário de orçamento
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [produto, setProduto] = useState('Concreto Usinado GC Mix')
  const [quantidade, setQuantidade] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Modalidade de foto expandida (lightbox para as 6 fotos reais)
  const [fotoAtiva, setFotoAtiva] = useState<{
    src: string
    fallback?: string
    titulo: string
    local: string
    descricao: string
    etiqueta?: string
  } | null>(null)

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
                Pedreira Cordeiro • C M Construções
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
            <a
              href="#videos-operacao"
              className="hover:text-[#1D4ED8] transition-colors flex items-center gap-1 font-semibold text-[#1D4ED8]"
            >
              <Video className="w-3.5 h-3.5 text-[#1D4ED8]" />
              Vídeos
            </a>
            <a href="#operacao-real" className="hover:text-[#1D4ED8] transition-colors">
              Nossa Operação
            </a>
            <a href="#unidades" className="hover:text-[#1D4ED8] transition-colors">
              Unidades
            </a>
            <a href="#sobre" className="hover:text-[#1D4ED8] transition-colors">
              Quem somos
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
              className="bg-gradient-to-r from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB] hover:from-[#172554] hover:to-[#1E40AF] text-white shadow-md shadow-blue-800/25 rounded-xl px-5 py-2.5 font-bold text-sm transition-all hover:scale-[1.02] cursor-pointer"
            >
              Pedir Orçamento
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* =========================================================
            DOBRA 1: HERO COM FOTO REAL 1 (AÉREA DA JAZIDA)
            ========================================================= */}
        <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 bg-gradient-to-br from-[#0A2540] via-[#113264] to-[#1E3A8A] text-white border-b border-[#1E3A8A]">
          {/* Efeitos de iluminação azul profunda */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-[36rem] h-[36rem] rounded-full bg-[#2563EB]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-[32rem] h-[32rem] rounded-full bg-[#38BDF8]/20 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(#60A5FA_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Logo GC MIX em destaque no topo */}
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

                  <button
                    onClick={() => rolarParaSecao('produtos')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-200 hover:text-white px-4 py-3 rounded-xl border border-blue-400/20 hover:border-blue-300/40 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Ver agregados
                    <ArrowRight className="w-4 h-4 text-blue-300" />
                  </button>
                </div>

                {/* Stats do Hero */}
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

              {/* Coluna Visual: Foto Real no Hero com alternador entre Vista Aérea e Vista de Topo da Jazida */}
              <div className="lg:col-span-5">
                <div className="relative rounded-3xl overflow-hidden border border-blue-300/20 bg-white/10 backdrop-blur-md shadow-2xl p-4 sm:p-5 space-y-4">
                  <div
                    className="relative h-64 sm:h-84 rounded-2xl overflow-hidden group cursor-pointer"
                    onClick={() => setFotoAtiva(FOTOS_REAIS.aereaJazida)}
                  >
                    <img
                      src={FOTOS_REAIS.aereaJazida.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.aereaJazida.fallback &&
                          target.src !== FOTOS_REAIS.aereaJazida.fallback
                        ) {
                          target.src = FOTOS_REAIS.aereaJazida.fallback
                        }
                      }}
                      alt="Vista aérea da Pedreira Cordeiro em Patos PB — Foto real"
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                      loading="eager"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="bg-[#0A2540]/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-blue-400/30 shadow-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Foto Real da Jazida
                      </span>
                      <span className="bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540]/95 via-[#0A2540]/30 to-transparent flex items-end p-5">
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-[#0A2540]/80 px-2 py-0.5 rounded border border-amber-400/30">
                          Patos — PB • Jazida Própria
                        </span>
                        <h3 className="text-lg font-extrabold text-white mt-1 leading-snug">
                          Pedreira Cordeiro & Central GC Mix
                        </h3>
                        <p className="text-xs text-blue-200 mt-0.5">
                          Agregados e concreto usinado com controle de qualidade e pontualidade
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Atalho interativo para a foto de topo / usina solar */}
                  <div
                    onClick={() => setFotoAtiva(FOTOS_REAIS.aereaTopoPlanta)}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/40 hover:bg-white/10 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={FOTOS_REAIS.aereaTopoPlanta.src}
                        onError={(e) => {
                          const target = e.currentTarget
                          if (
                            FOTOS_REAIS.aereaTopoPlanta.fallback &&
                            target.src !== FOTOS_REAIS.aereaTopoPlanta.fallback
                          ) {
                            target.src = FOTOS_REAIS.aereaTopoPlanta.fallback
                          }
                        }}
                        alt="Miniatura planta completa e usina solar"
                        className="w-11 h-9 rounded-lg object-cover border border-white/20 shrink-0"
                      />
                      <div className="text-left">
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>Ver vista de topo completa</span>
                          <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded">
                            NOVA
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-200">
                          Planta industrial, pátios e parque solar
                        </div>
                      </div>
                    </div>
                    <Maximize2 className="w-3.5 h-3.5 text-amber-300 shrink-0 mr-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#0A2540]/70 p-3 rounded-xl border border-blue-400/20">
                      <div className="text-blue-300 font-medium text-[11px]">Concreto Usinado</div>
                      <div className="text-white font-bold text-sm mt-0.5">GC Mix Sertão</div>
                      <div className="text-[10px] text-blue-200">5 Centrais integradas</div>
                    </div>
                    <div className="bg-[#0A2540]/70 p-3 rounded-xl border border-blue-400/20">
                      <div className="text-blue-300 font-medium text-[11px]">Britador Móvel</div>
                      <div className="text-amber-300 font-bold text-sm mt-0.5">Lokotrack C M</div>
                      <div className="text-[10px] text-blue-200">Locação para obras</div>
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

        {/* CALLOUT DESTAQUE: C M CONSTRUÇÕES / LOKOTRACK NO TOPO */}
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
                  Locação de britador de mandíbula móvel: esmagamos a rocha direto na sua obra, com
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

        {/* SEÇÃO O QUE FAZEMOS / SERVIÇOS (Baseada em tipografia, cartões e ícones) */}
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

        {/* =========================================================
            SEÇÃO C M CONSTRUÇÕES — BRITADOR MÓVEL LOKOTRACK
            (Design editorial de alto padrão, puramente tipográfico/stats/ícones — SEM ilustrações SVG nem fotos indevidas)
            ========================================================= */}
        <section
          id="cm-lokotrack"
          className="py-20 bg-gradient-to-b from-[#0A2540] via-[#0F1D36] to-[#0A2540] text-white relative overflow-hidden border-b border-[#1E3A8A]"
        >
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#1D4ED8]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header da Seção Lokotrack */}
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Empresa do Grupo GC do Amaral
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                C M Construções — Britador Móvel Lokotrack
              </h2>
              <p className="mt-4 text-base sm:text-lg text-blue-100 leading-relaxed font-normal">
                Locação de britador de mandíbula móvel <strong>Lokotrack</strong> — esmagamento de
                pedra direto na sua obra, pedreira ou serviço, com produção alta e mobilidade total.
              </p>
            </div>

            {/* Banner com Foto Real do Lokotrack Móvel em Operação */}
            <div className="mb-12 rounded-3xl overflow-hidden border border-amber-400/40 bg-slate-900/90 shadow-2xl backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                {/* Imagem Grande Clicável para Lightbox */}
                <div
                  className="lg:col-span-7 relative min-h-[300px] sm:min-h-[420px] overflow-hidden group cursor-pointer bg-slate-950"
                  onClick={() => setFotoAtiva(FOTOS_REAIS.lokotrackMovel)}
                >
                  <img
                    src={FOTOS_REAIS.lokotrackMovel.src}
                    onError={(e) => {
                      const target = e.currentTarget
                      if (
                        FOTOS_REAIS.lokotrackMovel.fallback &&
                        target.src !== FOTOS_REAIS.lokotrackMovel.fallback
                      ) {
                        target.src = FOTOS_REAIS.lokotrackMovel.fallback
                      }
                    }}
                    alt="Britador móvel Lokotrack em operação em campo — C M Construções"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  {/* Badges sobre a foto */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Foto Real da Operação
                    </span>
                    <span className="bg-[#0A2540]/90 backdrop-blur-md text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-400/30">
                      Britador Móvel sobre Esteiras
                    </span>
                  </div>

                  <div className="absolute bottom-4 right-4 bg-slate-950/80 hover:bg-slate-900 text-white p-2.5 rounded-full backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-lg">
                    <Maximize2 className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">Ampliar Foto</span>
                  </div>

                  <div className="absolute bottom-4 left-4 hidden sm:block">
                    <span className="bg-black/70 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10">
                      Esteiras • Peneiras Vibratórias • Correias de Descarga
                    </span>
                  </div>
                </div>

                {/* Painel com Ficha Técnica da Foto Real */}
                <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-[#0F2244] to-[#0A1A3B] border-t lg:border-t-0 lg:border-l border-amber-400/20">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs uppercase font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-amber-400" />
                        Ficha do Equipamento em Campo
                      </span>
                      <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
                        Equipamento Próprio
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white leading-tight">
                        Lokotrack em Operação Real
                      </h3>
                      <p className="mt-2 text-xs text-blue-200 leading-relaxed">
                        Registro autêntico do caminhão britador móvel sobre esteiras em plena
                        produção: correias transportadoras elevadas, pilhas de agregados graduados e
                        equipe técnica especializada da C M Construções com apoio operacional
                        completo.
                      </p>
                    </div>

                    {/* Dados técnicos rápidos */}
                    <div className="space-y-2.5">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Equipamento:</span>
                        <strong className="text-white">Britador de Mandíbula sobre Esteiras</strong>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Empresa Responsável:</span>
                        <strong className="text-amber-300">C M Construções (Grupo GC)</strong>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Mobilização:</span>
                        <strong className="text-white">Paraíba • Pernambuco • RN</strong>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Vantagem Direta:</span>
                        <strong className="text-emerald-300">Elimina frete de rocha bruta</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={() => setFotoAtiva(FOTOS_REAIS.lokotrackMovel)}
                      className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-xl border border-white/20 transition-all cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4 text-amber-300" />
                      <span>Ver em Tela Cheia</span>
                    </button>

                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all hover:scale-105"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Cotar Locação</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Painel Central Lokotrack: Destaques Técnicos e Operacionais */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-12">
              {/* Card Esquerdo: Apresentação Técnica */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-amber-400/40 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      Britador de Mandíbula sobre Esteiras
                    </span>
                    <span className="bg-blue-950/80 border border-blue-400/30 text-blue-200 text-xs font-semibold px-3 py-1 rounded-lg">
                      Disponível para Locação
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      Britagem Primária e Secundária no Próprio Canteiro
                    </h3>
                    <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                      O conjunto móvel <strong>Lokotrack</strong> opera diretamente na frente de
                      lavra ou no canteiro de obras, eliminando a etapa mais custosa da
                      infraestrutura: o transporte rodoviário de rocha bruta pesada até um britador
                      convencional.
                    </p>
                  </div>

                  {/* 4 Diferenciais em destaque */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Mobilidade Total</div>
                        <div className="text-[11px] text-slate-300 leading-snug">
                          Desloca-se sobre esteiras dentro do canteiro sem necessidade de
                          desmontagem.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Economia com Frete</div>
                        <div className="text-[11px] text-slate-300 leading-snug">
                          Transforma o matacão e rocha bruta em agregado pronto no local da
                          aplicação.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-400/20 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Alta Produção Contínua</div>
                        <div className="text-[11px] text-slate-300 leading-snug">
                          Capacidade horária para atender cronogramas exigentes de rodovias e
                          barragens.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Operação e Apoio</div>
                        <div className="text-[11px] text-slate-300 leading-snug">
                          Equipe técnica da C M Construções com know-how do Grupo GC do Amaral.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400 text-center sm:text-left">
                    Atendimento em toda a <strong>Paraíba, Pernambuco e Rio Grande do Norte</strong>
                    .
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all hover:scale-105"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp Lokotrack
                    </a>
                  </div>
                </div>
              </div>

              {/* Card Direito: Especificações Técnicas e Aplicações */}
              <div className="lg:col-span-5 bg-[#0F2244] border border-blue-400/30 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-amber-300 tracking-wider">
                      Ficha de Aplicações
                    </span>
                    <Wrench className="w-5 h-5 text-amber-400" />
                  </div>

                  <div>
                    <h4 className="text-xl font-bold text-white">
                      Onde a Locação do Lokotrack Faz a Diferença
                    </h4>
                    <p className="mt-2 text-xs text-blue-200 leading-relaxed">
                      Ideal para projetos onde o transporte de agregados até a obra inviabiliza o
                      custo ou o prazo de execução:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-[#0A1A3B] rounded-xl border border-blue-900/60">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Obras Rodoviárias e Pavimentação
                      </div>
                      <p className="text-[11px] text-blue-200 mt-1 pl-3.5">
                        Britagem de subleito, base e sub-base diretamente ao longo do traçado da
                        rodovia.
                      </p>
                    </div>

                    <div className="p-3 bg-[#0A1A3B] rounded-xl border border-blue-900/60">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Pedreiras e Jazidas Temporárias
                      </div>
                      <p className="text-[11px] text-blue-200 mt-1 pl-3.5">
                        Aproveitamento de jazidas licenciadas sem o custo de montar uma planta fixa.
                      </p>
                    </div>

                    <div className="p-3 bg-[#0A1A3B] rounded-xl border border-blue-900/60">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                        Barragens, Canais e Grandes Contenções
                      </div>
                      <p className="text-[11px] text-blue-200 mt-1 pl-3.5">
                        Esmagamento de rocha de desmonte de túneis e cortes para uso na própria
                        estrutura.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-blue-900/60">
                  <button
                    onClick={() =>
                      rolarParaSecao('orcamento', 'Britador Móvel Lokotrack — C M Construções')
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#1D4ED8] text-white font-bold text-xs px-5 py-3 rounded-xl border border-blue-400/40 transition-colors cursor-pointer"
                  >
                    <span>Solicitar Cotação Formal por Formulário</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de Atendimento Lokotrack */}
            <div className="p-6 rounded-2xl bg-[#0F2244]/80 border border-blue-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    Fale com o Engenheiro Responsável pela C M Construções
                  </div>
                  <div className="text-xs text-blue-200">
                    Consulte cronogramas de disponibilidade, mobilização e condições de locação.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <a
                  href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full md:w-auto text-center px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-colors shrink-0"
                >
                  Consultar Disponibilidade
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SEÇÃO DE VÍDEOS OFICIAIS — CALDAS & AMARAL GC MIX CONCRETO
            Operacional Lokotrack (18s) & Institucional (46s)
            ========================================================= */}
        <section
          id="videos-operacao"
          className="py-20 bg-gradient-to-b from-[#0F1D36] via-[#0A2540] to-[#0A1A3B] text-white relative overflow-hidden border-b border-[#1E3A8A]"
        >
          {/* Efeitos de iluminação sutil de fundo */}
          <div className="absolute top-0 left-1/4 -mt-20 w-96 h-96 rounded-full bg-[#1D4ED8]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-20 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header da Seção de Vídeos */}
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E3A8A]/60 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-md">
                <Video className="w-4 h-4 text-amber-400" />
                Registros em Vídeo • Operação em Movimento
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Conheça Nossa Operação
              </h2>
              <p className="mt-4 text-base sm:text-lg text-blue-100 leading-relaxed font-normal">
                Veja o britador móvel Lokotrack em plena atividade de britagem em campo e assista ao
                vídeo institucional que sintetiza a força de nossa estrutura, frota e equipe no
                Sertão.
              </p>
            </div>

            {/* Grid dos Dois Vídeos em 2 Colunas no Desktop / Empilhado no Mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Card 1: Vídeo Operacional Lokotrack */}
              <div className="rounded-3xl overflow-hidden border border-amber-400/40 bg-slate-900/90 shadow-2xl backdrop-blur-md flex flex-col justify-between group hover:border-amber-400 transition-colors">
                <div>
                  {/* Player Embed Responsivo 16:9 */}
                  <div className="relative w-full aspect-video bg-black overflow-hidden">
                    <iframe
                      src="https://www.youtube.com/embed/a9J67SERlgI"
                      title="Vídeo Operacional — Britador Móvel Lokotrack em Ação no Campo (C M Construções)"
                      aria-label="Vídeo Operacional do Britador Móvel Lokotrack em Ação no Campo"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  </div>

                  {/* Detalhes do Vídeo 1 */}
                  <div className="p-6 sm:p-8 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        Operacional • Lokotrack (18s)
                      </span>
                      <span className="bg-blue-950/80 border border-blue-400/30 text-blue-200 text-xs font-semibold px-2.5 py-1 rounded-lg">
                        C M Construções
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        Vídeo Operacional — Lokotrack em Ação
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-blue-100 leading-relaxed font-normal">
                        Filmagem autêntica do conjunto móvel de britagem Lokotrack sobre esteiras
                        processando rocha maciça em campo aberto: alimentação direta, peneiras
                        vibratórias calibradas e esteiras de descarga contínua com alta vazão
                        produtiva.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Aplicação:</span>
                        <strong className="text-white">
                          Britagem primária e secundária na lavra
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Canal Oficial:</span>
                        <strong className="text-amber-300">Caldas & Amaral GC Mix Concreto</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 sm:p-8 sm:pt-0">
                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 text-center sm:text-left">
                      Disponível para locação em obras na PB, PE e RN.
                    </span>
                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlLokotrack}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all shrink-0"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Cotar Lokotrack</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 2: Vídeo Institucional Telão do Evento */}
              <div className="rounded-3xl overflow-hidden border border-blue-400/40 bg-slate-900/90 shadow-2xl backdrop-blur-md flex flex-col justify-between group hover:border-blue-400 transition-colors">
                <div>
                  {/* Player Embed Responsivo 16:9 */}
                  <div className="relative w-full aspect-video bg-black overflow-hidden">
                    <iframe
                      src="https://www.youtube.com/embed/B2DUEa-9hjY"
                      title="Vídeo Institucional — GC MIX Concreto Usinado e Pedreira Cordeiro"
                      aria-label="Vídeo Institucional de Apresentação da GC MIX Concreto Usinado e Pedreira Cordeiro"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  </div>

                  {/* Detalhes do Vídeo 2 */}
                  <div className="p-6 sm:p-8 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="bg-[#1D4ED8] text-white text-xs font-black px-3 py-1 rounded-lg shadow-md uppercase tracking-wider flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5" />
                        Institucional • Grupo GC (46s)
                      </span>
                      <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                        GC Mix & Pedreira Cordeiro
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        Vídeo Institucional — Concreto & Pedreira
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-blue-100 leading-relaxed font-normal">
                        Apresentação oficial exibida no evento do Grupo GC do Amaral: infraestrutura
                        integrada da usina de concreto usinado GC Mix, jazida própria da Pedreira
                        Cordeiro, frotas de caminhões betoneira e atendimento dinâmico para as
                        maiores construtoras regionais.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Atuação:</span>
                        <strong className="text-white">5 Unidades & Pedreira Própria</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Canal Oficial:</span>
                        <strong className="text-blue-300">Caldas & Amaral GC Mix Concreto</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 sm:p-8 sm:pt-0">
                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 text-center sm:text-left">
                      Traços especiais de concreto e agregados selecionados.
                    </span>
                    <button
                      onClick={() => rolarParaSecao('orcamento', 'Concreto Usinado GC Mix')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Pedir Orçamento</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner de Rodapé da Seção com Canal do YouTube */}
            <div className="mt-10 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-200">
              <div className="flex items-center gap-2.5 text-center sm:text-left">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Play className="w-4 h-4 fill-white" />
                </div>
                <span>
                  Vídeos hospedados no canal oficial{' '}
                  <strong>CALDAS & AMARAL GC MIX CONCRETO</strong> no YouTube com alta definição e
                  reprodução ágil.
                </span>
              </div>
              <a
                href="https://youtu.be/B2DUEa-9hjY"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:text-amber-200 hover:underline font-bold shrink-0 flex items-center gap-1"
              >
                <span>Assistir no YouTube</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* =========================================================
            DOBRA 2: PEDREIRA CORDEIRO COM FOTO REAL 3 (CORREIA / PÓ DE PEDRA)
            ========================================================= */}
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

                {/* Bullets reais do site */}
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

              {/* Foto Real: Linha de Britagem, Pilhas e Correia de Pó de Pedra */}
              <div className="lg:col-span-6 space-y-4">
                <div className="relative rounded-3xl overflow-hidden border border-blue-100 shadow-2xl bg-white">
                  <div
                    className="relative h-72 sm:h-80 overflow-hidden group cursor-pointer"
                    onClick={() => setFotoAtiva(FOTOS_REAIS.pilhaPoDePedra)}
                  >
                    <img
                      src={FOTOS_REAIS.pilhaPoDePedra.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.pilhaPoDePedra.fallback &&
                          target.src !== FOTOS_REAIS.pilhaPoDePedra.fallback
                        ) {
                          target.src = FOTOS_REAIS.pilhaPoDePedra.fallback
                        }
                      }}
                      alt="Pilha de pó de pedra e correia ao fundo na Pedreira Cordeiro — Foto real"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="bg-[#0A2540]/90 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1 rounded-full border border-blue-400/30 shadow-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Foto Real da Produção
                      </span>
                      <span className="bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-[#0A2540]/85 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-400/30">
                        Pó de Pedra em Primeiro Plano • Correia ao Fundo
                      </span>
                    </div>
                  </div>
                  <div className="p-5 bg-gradient-to-r from-blue-50 to-white border-t border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#0A2540]">
                        Estoque de Pó de Pedra & Correia Transportadora
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

                {/* Mini-card de suporte com a foto de detalhe da correia */}
                <div
                  onClick={() => setFotoAtiva(FOTOS_REAIS.correiaProducao)}
                  className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70 flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-100/60 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={FOTOS_REAIS.correiaProducao.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.correiaProducao.fallback &&
                          target.src !== FOTOS_REAIS.correiaProducao.fallback
                        ) {
                          target.src = FOTOS_REAIS.correiaProducao.fallback
                        }
                      }}
                      alt="Detalhe da correia transportadora"
                      className="w-14 h-12 rounded-xl object-cover border border-blue-200 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#0A2540] group-hover:text-[#1D4ED8] transition-colors">
                        Ver detalhe: Correia transportadora e empilhamento contínuo
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Linha de britagem em operação contínua • Clique para ampliar
                      </div>
                    </div>
                  </div>
                  <Maximize2 className="w-4 h-4 text-[#1D4ED8] shrink-0 mr-1" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            DOBRA 3: PRODUTOS / AGREGADOS COM FOTO REAL 2 (PÁTIO DE BRITA)
            ========================================================= */}
        <section id="produtos" className="py-20 bg-[#F8FAFC] border-b border-blue-100">
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
                Brita 12, Brita 19, Pedra rachão, Pó de pedra e Cascalhinho. Matéria-prima
                selecionada com controle granulométrico rigoroso.
              </p>
            </div>

            {/* Banner Destaque com Fotos Reais dos Pátios de Brita */}
            <div className="mb-12 rounded-3xl overflow-hidden border border-blue-200 bg-white shadow-xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                <div
                  className="lg:col-span-7 relative h-72 sm:h-96 overflow-hidden group cursor-pointer"
                  onClick={() => setFotoAtiva(FOTOS_REAIS.patioBritaPilhas)}
                >
                  <img
                    src={FOTOS_REAIS.patioBritaPilhas.src}
                    onError={(e) => {
                      const target = e.currentTarget
                      if (
                        FOTOS_REAIS.patioBritaPilhas.fallback &&
                        target.src !== FOTOS_REAIS.patioBritaPilhas.fallback
                      ) {
                        target.src = FOTOS_REAIS.patioBritaPilhas.fallback
                      }
                    }}
                    alt="Pátio de brita 1 e brita 2 com caminhão e peneira ao fundo — Foto real"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="bg-[#0A2540]/90 backdrop-blur-xs text-amber-300 text-xs font-black px-3 py-1.5 rounded-lg border border-amber-400/40">
                      Foto Real da Operação
                    </span>
                    <span className="bg-emerald-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                      Pilhas de Brita 1 e 2
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-[#0A2540]/85 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md border border-white/20">
                      Caminhão basculante despejando pedra na peneira vibrolimpeza
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="lg:col-span-5 p-8 sm:p-10 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8] block">
                    Controle Granulométrico Rigoroso
                  </span>
                  <h3 className="text-2xl font-black text-[#0A2540] leading-tight">
                    Expedição Contínua e Pronta-Entrega de Agregados
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Nosso pátio em Patos — PB mantém estoques calibrados de{' '}
                    <strong>Brita 12</strong>, <strong>Brita 19</strong>,{' '}
                    <strong>Pó de pedra</strong>, <strong>Pedra rachão</strong> e{' '}
                    <strong>Cascalhinho</strong> prontos para carregamento rápido de caçambas ou
                    abastecimento direto das concreteiras GC Mix.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#0A2540]">
                    <span className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      ✓ Carga à pronta
                    </span>
                    <span className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      ✓ Laudo de densidade
                    </span>
                    <span className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      ✓ Pesagem em balança
                    </span>
                  </div>

                  <div className="pt-3 flex items-center gap-3">
                    <Button
                      onClick={() => rolarParaSecao('orcamento', 'Mix de Agregados')}
                      className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl px-5 py-2.5 cursor-pointer text-xs"
                    >
                      Cotar Carga de Agregados
                    </Button>
                    <button
                      onClick={() => setFotoAtiva(FOTOS_REAIS.patioBrita)}
                      className="text-xs font-bold text-[#1D4ED8] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver outro pátio</span>
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid dos 5 Produtos Oficiais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PRODUTOS_PEDREIRA.map((item: ProdutoPedreiraItem) => (
                <Card
                  key={item.id}
                  className="group bg-white hover:border-[#2563EB] border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                >
                  <CardContent className="p-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#1D4ED8] flex items-center justify-center font-black">
                        <Layers className="w-6 h-6" />
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border border-slate-200">
                        {item.codigoRef}
                      </span>
                    </div>

                    {/* Imagem autêntica do produto/material */}
                    <div className="relative h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={getFotoRealUrl(item.imagem)}
                        alt={item.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget
                          if (target.src !== item.imagem) {
                            target.src = item.imagem
                          }
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <span className="bg-[#0A2540]/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-xs">
                          Foto da Usina
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold text-[#0A2540] group-hover:text-[#1D4ED8] transition-colors">
                        {item.nome}
                      </h3>
                      <div className="text-xs font-bold text-[#1D4ED8] mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
                        <span>{item.granulometria}</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">{item.descricao}</p>

                    <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1">
                      <span className="font-bold text-[#0A2540] block">Principais Aplicações:</span>
                      <span className="text-slate-600 leading-snug block">{item.aplicacao}</span>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                        Densidade Média
                      </span>
                      <span className="text-xs font-bold text-[#0A2540]">
                        {item.densidadeMedia}
                      </span>
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
              <Card className="bg-gradient-to-br from-[#0A2540] via-[#1E3A8A] to-[#1D4ED8] text-white rounded-2xl p-7 flex flex-col justify-between border-none shadow-xl">
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
                  <ul className="text-xs text-blue-100 space-y-2 pt-1">
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
                    className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl cursor-pointer text-xs py-3"
                  >
                    Cotar Concreto Usinado
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* =========================================================
            SEÇÃO ESTRUTURA REAL EM FOCO (As 3 fotos reais em destaque)
            Substitui a galeria de ilustrações falsas por foco exclusivo na infraestrutura autêntica
            ========================================================= */}
        <section id="operacao-real" className="py-20 bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge
                variant="outline"
                className="border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 px-3 py-1 mb-3 text-xs uppercase tracking-wider font-bold"
              >
                Nossa Infraestrutura Real
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
                Operação, Jazida e Britagem em Campo
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Registros autênticos do Grupo GC do Amaral: da extração na jazida de granito aos
                pátios de classificação, esteiras de britagem contínua e o britador móvel Lokotrack
                operando em campo.
              </p>
            </div>

            {/* Grid Completo com os 7 Registros Fotográficos Autênticos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card Destaque: Britador Móvel Lokotrack em Operação Real */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.lokotrackMovel)}
                className="group rounded-3xl overflow-hidden border-2 border-amber-400/70 bg-gradient-to-b from-slate-900 to-[#0A1A3B] text-white shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between md:col-span-2 lg:col-span-3"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                  <div className="lg:col-span-7 relative h-72 sm:h-96 overflow-hidden bg-slate-950">
                    <img
                      src={FOTOS_REAIS.lokotrackMovel.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.lokotrackMovel.fallback &&
                          target.src !== FOTOS_REAIS.lokotrackMovel.fallback
                        ) {
                          target.src = FOTOS_REAIS.lokotrackMovel.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.lokotrackMovel.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-md shadow-md">
                        {FOTOS_REAIS.lokotrackMovel.etiqueta}
                      </span>
                      <span className="bg-[#0A2540]/90 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-md border border-amber-400/40">
                        Britador Móvel sobre Esteiras
                      </span>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white p-2.5 rounded-full group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shadow-md">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="lg:col-span-5 p-6 sm:p-8 space-y-4">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      {FOTOS_REAIS.lokotrackMovel.local}
                    </div>
                    <h3 className="text-2xl font-black text-white">
                      {FOTOS_REAIS.lokotrackMovel.titulo}
                    </h3>
                    <p className="text-sm text-blue-100 leading-relaxed">
                      {FOTOS_REAIS.lokotrackMovel.descricao}
                    </p>
                    <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-300 border-t border-white/10">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Clique para ampliar em tela cheia
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Card 1: Vista de Topo da Jazida & Usina Solar (Nova) */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.aereaTopoPlanta)}
                className="group rounded-3xl overflow-hidden border border-blue-200/80 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.aereaTopoPlanta.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.aereaTopoPlanta.fallback &&
                          target.src !== FOTOS_REAIS.aereaTopoPlanta.fallback
                        ) {
                          target.src = FOTOS_REAIS.aereaTopoPlanta.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.aereaTopoPlanta.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-400/30">
                        {FOTOS_REAIS.aereaTopoPlanta.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.aereaTopoPlanta.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.aereaTopoPlanta.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.aereaTopoPlanta.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 2: Vista Aérea em Ângulo da Jazida Própria */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.aereaJazida)}
                className="group rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.aereaJazida.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.aereaJazida.fallback &&
                          target.src !== FOTOS_REAIS.aereaJazida.fallback
                        ) {
                          target.src = FOTOS_REAIS.aereaJazida.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.aereaJazida.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-white/20">
                        {FOTOS_REAIS.aereaJazida.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.aereaJazida.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.aereaJazida.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.aereaJazida.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 3: Pátio de Brita 1 e 2 com Caminhão Despejando (Nova) */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.patioBritaPilhas)}
                className="group rounded-3xl overflow-hidden border border-blue-200/80 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.patioBritaPilhas.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.patioBritaPilhas.fallback &&
                          target.src !== FOTOS_REAIS.patioBritaPilhas.fallback
                        ) {
                          target.src = FOTOS_REAIS.patioBritaPilhas.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.patioBritaPilhas.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-400/30">
                        {FOTOS_REAIS.patioBritaPilhas.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.patioBritaPilhas.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.patioBritaPilhas.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.patioBritaPilhas.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 4: Pátio de Brita e Peneira Vibratória */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.patioBrita)}
                className="group rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.patioBrita.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.patioBrita.fallback &&
                          target.src !== FOTOS_REAIS.patioBrita.fallback
                        ) {
                          target.src = FOTOS_REAIS.patioBrita.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.patioBrita.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-white/20">
                        {FOTOS_REAIS.patioBrita.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.patioBrita.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.patioBrita.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.patioBrita.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 5: Pilha de Pó de Pedra em Primeiro Plano (Nova) */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.pilhaPoDePedra)}
                className="group rounded-3xl overflow-hidden border border-blue-200/80 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.pilhaPoDePedra.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.pilhaPoDePedra.fallback &&
                          target.src !== FOTOS_REAIS.pilhaPoDePedra.fallback
                        ) {
                          target.src = FOTOS_REAIS.pilhaPoDePedra.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.pilhaPoDePedra.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-400/30">
                        {FOTOS_REAIS.pilhaPoDePedra.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.pilhaPoDePedra.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.pilhaPoDePedra.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.pilhaPoDePedra.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 6: Correia Transportadora e Britagem Contínua */}
              <div
                onClick={() => setFotoAtiva(FOTOS_REAIS.correiaProducao)}
                className="group rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={FOTOS_REAIS.correiaProducao.src}
                      onError={(e) => {
                        const target = e.currentTarget
                        if (
                          FOTOS_REAIS.correiaProducao.fallback &&
                          target.src !== FOTOS_REAIS.correiaProducao.fallback
                        ) {
                          target.src = FOTOS_REAIS.correiaProducao.fallback
                        }
                      }}
                      alt={FOTOS_REAIS.correiaProducao.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#0A2540]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-white/20">
                        {FOTOS_REAIS.correiaProducao.etiqueta}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white p-2 rounded-full group-hover:bg-[#1D4ED8] transition-colors">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {FOTOS_REAIS.correiaProducao.local}
                    </div>
                    <h3 className="text-xl font-black text-[#0A2540]">
                      {FOTOS_REAIS.correiaProducao.titulo}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {FOTOS_REAIS.correiaProducao.descricao}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                  <span>Clique para ampliar foto</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Aviso informativo de transparência */}
            <div className="mt-10 p-5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-700 gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>
                  Fotos 100% autênticas da matriz em Patos — PB. Operação integrada de britagem e
                  concreto usinado para obras civis em todo o Sertão.
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

        {/* =========================================================
            SEÇÃO NOSSAS UNIDADES (Conteúdo real — 5 unidades)
            ========================================================= */}
        <section id="unidades" className="py-20 bg-[#F8FAFC] border-b border-blue-100">
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
                      : 'bg-white border border-blue-100 text-slate-800 hover:border-[#2563EB]'
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
            <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-white border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
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

        {/* =========================================================
            SEÇÃO MISSÃO, VISÃO E OBJETIVOS (Conteúdo oficial do Grupo)
            ========================================================= */}
        <section id="sobre" className="py-20 bg-white border-b border-blue-100">
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
              <Card className="bg-[#F8FAFC] border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
                <CardContent className="p-8 space-y-4">
                  <div className="w-13 h-13 rounded-2xl bg-blue-100 text-[#1D4ED8] flex items-center justify-center shadow-xs">
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
              <Card className="bg-[#F8FAFC] border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
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
              <Card className="bg-[#F8FAFC] border-blue-100 hover:border-[#2563EB] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between">
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

        {/* =========================================================
            MODAL / LIGHTBOX DE FOTO EXPANDIDA (Apenas para as 3 fotos reais)
            ========================================================= */}
        {fotoAtiva && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setFotoAtiva(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-blue-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative max-h-[75vh] bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={fotoAtiva.src}
                  onError={(e) => {
                    const target = e.currentTarget
                    if (fotoAtiva.fallback && target.src !== fotoAtiva.fallback) {
                      target.src = fotoAtiva.fallback
                    }
                  }}
                  alt={fotoAtiva.titulo}
                  className="w-full h-full max-h-[75vh] object-contain"
                />
                <button
                  onClick={() => setFotoAtiva(null)}
                  className="absolute top-4 right-4 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full p-2.5 transition-colors cursor-pointer border border-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-[#0A1A3B] border-t border-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-xs font-bold text-[#38BDF8] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {fotoAtiva.local}
                    </div>
                    {fotoAtiva.etiqueta && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/80 text-amber-300 border border-amber-400/30">
                        {fotoAtiva.etiqueta}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">{fotoAtiva.titulo}</h3>
                  <p className="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
                    {fotoAtiva.descricao}
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setFotoAtiva(null)
                    rolarParaSecao('orcamento')
                  }}
                  className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold px-4 py-2 rounded-xl shrink-0 cursor-pointer"
                >
                  Pedir Orçamento
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SEÇÃO ORÇAMENTO (WhatsApp e E-mail — SEM GRAVAÇÃO NO ERP)
            ========================================================= */}
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

        {/* =========================================================
            SEÇÃO CONTATO DIRETO / FALE COM A GENTE
            ========================================================= */}
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

      {/* =========================================================
          RODAPÉ INSTITUCIONAL EM AZUL PROFUNDO MUNIQUE
          ========================================================= */}
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

              <div className="pt-2 space-y-1">
                <span className="text-xs uppercase tracking-wider font-bold text-white block mb-1">
                  C M Construções & Vídeos
                </span>
                <a href="#cm-lokotrack" className="text-xs text-amber-300 hover:underline block">
                  Britador Móvel Lokotrack →
                </a>
                <a
                  href="#videos-operacao"
                  className="text-xs text-blue-300 hover:underline block flex items-center gap-1"
                >
                  <Video className="w-3 h-3 text-amber-300" />
                  Vídeos da Operação (YouTube) →
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
