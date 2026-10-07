import React, { useState } from 'react'
import {
  Truck,
  Building2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Gauge,
  Layers,
  ArrowRight,
  Flame,
  Award,
  Sparkles,
  Check,
  Zap,
  Radio,
  ExternalLink,
} from 'lucide-react'
import { INSTITUCIONAL_CONFIG, UNIDADES_GC } from '@/data/institucional'
import { ASSET_LOGO_BANNER, LogoGcMixVector } from '@/components/institucional/LogoGcMix'
import { FOTOS_ESTATICAS_PEDREIRA } from '@/lib/fotosReais'
import { Maximize2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FotoModalInfo {
  src: string
  fallback?: string
  titulo: string
  local: string
  descricao: string
  etiqueta?: string
}

interface SecaoGcMixConcretoProps {
  onSolicitarOrcamento?: (produtoOuDetalhe: string) => void
  onExpandirFoto?: (foto: FotoModalInfo) => void
}

/**
 * Traços e aplicações técnicas mais requisitadas para concreto usinado
 */
const TRACos_CONCRETO = [
  {
    fck: 'FCK 20 MPa',
    indicacao: 'Contrapisos, calçadas, baldrames leves e canaletas',
    slump: 'Slump 10 ± 2 cm',
    tag: 'Econômico',
  },
  {
    fck: 'FCK 25 MPa',
    indicacao: 'Lajes maciças e pré-moldadas, vigas residenciais e sapatas',
    slump: 'Slump 12 ± 2 cm',
    tag: 'Mais vendido',
    destaque: true,
  },
  {
    fck: 'FCK 30 MPa',
    indicacao: 'Pilares, estruturas comerciais, reservatórios e vigas de transição',
    slump: 'Slump 12 ± 2 cm',
    tag: 'Alta Resistência',
  },
  {
    fck: 'FCK 35 / 40 MPa',
    indicacao: 'Pisos industriais com acabamento polido, pontes e pré-moldados pesados',
    slump: 'Slump 14 ± 2 cm',
    tag: 'Industrial',
  },
]

export function SecaoGcMixConcreto({
  onSolicitarOrcamento,
  onExpandirFoto,
}: SecaoGcMixConcretoProps) {
  const [unidadeAtiva, setUnidadeAtiva] = useState<string>('monteiro')

  const handlePedirOrcamento = (detalhe: string) => {
    if (onSolicitarOrcamento) {
      onSolicitarOrcamento(detalhe)
    } else {
      const el = document.getElementById('orcamento')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section
      id="concreto-usinado"
      className="relative py-20 lg:py-28 bg-gradient-to-b from-[#0A2540] via-[#0E2F56] to-[#0A2540] text-white overflow-hidden border-b border-[#1E3A8A]"
    >
      {/* Background glow & iluminação Munique */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[22rem] bg-[#2563EB]/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#38BDF8]/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#60A5FA_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        {/* =========================================================
            HEADER DA SEÇÃO: GC MIX CONCRETO — OPÇÃO 1 DESTAQUE
            ========================================================= */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#1E40AF]/80 via-[#2563EB]/80 to-[#1D4ED8]/80 border border-[#60A5FA]/40 text-[#93C5FD] text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg shadow-blue-950/40">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Destaque Principal • Concreto Usinado</span>
          </div>

          <div className="flex items-center justify-center pt-2">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl hover:border-white/30 transition-all inline-block">
              <img
                src={ASSET_LOGO_BANNER}
                alt="GC MIX Concreto Usinado"
                className="h-14 sm:h-16 md:h-20 w-auto object-contain rounded-xl"
              />
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Central de Concreto & Frota de Betoneiras
          </h2>

          <p className="text-base sm:text-lg text-blue-100 max-w-2xl mx-auto leading-relaxed">
            O concreto usinado <strong>GC Mix</strong> é dosado por automação em central com
            agregados da nossa própria pedreira, garantindo precisão milimétrica de traço,
            resistência comprovada (FCK) e pontualidade na entrega com betoneiras em{' '}
            <strong>5 cidades-polo</strong>.
          </p>

          {/* CTAs rápidos no topo */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span>Pedir Cotação no WhatsApp</span>
            </a>

            <button
              onClick={() => handlePedirOrcamento('Concreto Usinado GC Mix')}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#1E40AF] hover:to-[#1D4ED8] text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-blue-950/40 border border-blue-400/40 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>Formulário de Orçamento</span>
              <ArrowRight className="w-4 h-4 text-blue-200" />
            </button>

            <a
              href={INSTITUCIONAL_CONFIG.telefoneTelLink}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-blue-100 hover:text-white font-semibold text-sm px-5 py-3.5 rounded-xl border border-white/20 transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4 text-amber-300" />
              <span>0800 083 1200</span>
            </a>
          </div>
        </div>

        {/* =========================================================
            DESTAQUE PRINCIPAL DA SEÇÃO: FOTO 2 REAL (BETONEIRAS CARREGANDO NA CENTRAL)
            Mostra as betoneiras GC Mix com 0800-083-1200 em plena operação na Filial Monteiro
            ========================================================= */}
        <div className="rounded-3xl overflow-hidden border-2 border-blue-400/40 bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] shadow-2xl relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Imagem real com proporção comercial e botão de expandir */}
            <div
              className="lg:col-span-7 relative min-h-[300px] sm:min-h-[380px] lg:min-h-[460px] overflow-hidden bg-slate-950 cursor-pointer group"
              onClick={() => {
                if (onExpandirFoto) {
                  onExpandirFoto({
                    src: FOTOS_ESTATICAS_PEDREIRA.monteiroBetoneirasCarregando,
                    titulo: 'Betoneiras Carregando na Central — Filial Monteiro (GC Mix)',
                    local: 'Central GC Mix • Filial Monteiro — PB',
                    descricao:
                      'Caminhões betoneira azul GC Mix (VW Constellation e Liebherr) com 0800-083-1200 na cuba, posicionados sob a torre de carregamento automatizada na filial de Monteiro-PB.',
                    etiqueta: 'Operação Real • Filial Monteiro',
                  })
                }
              }}
            >
              <img
                src={FOTOS_ESTATICAS_PEDREIRA.monteiroBetoneirasCarregando}
                alt="Betoneiras azul GC Mix carregando na central da filial Monteiro"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F3B]/80 via-transparent to-black/30 pointer-events-none" />

              {/* Badges sobre a foto */}
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-md shadow-md">
                  Foto Real da Operação
                </span>
                <span className="bg-[#0A2540]/90 text-white text-xs font-bold px-2.5 py-1 rounded-md border border-white/20 backdrop-blur-xs">
                  Filial Monteiro — PB
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/90">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 font-mono text-[11px]">
                  0800-083-1200 • Caminhões VW Constellation & Liebherr
                </span>
                <div className="bg-black/70 p-2 rounded-full group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shadow-md">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Conteúdo descritivo comercial ao lado */}
            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Central de Concreto • Filial Monteiro (GC Mix)</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[11px] font-bold uppercase tracking-wider">
                    Operação Ativa
                  </Badge>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Betoneiras em Carga Contínua Direto na Torre de Dosagem
                </h3>

                <p className="text-sm text-blue-100 leading-relaxed">
                  Registro autêntico da <strong>Filial Monteiro</strong>: caminhões betoneira azul
                  GC Mix sob a torre de carregamento da central, operando com pesagem eletrônica
                  computadorizada, dosagem automática de cimento e agregados selecionados da
                  Pedreira Cordeiro.
                </p>

                <div className="space-y-2.5 pt-2 border-t border-white/10 text-xs text-blue-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Caminhões VW Constellation com tambores Liebherr</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Central com torre dosadora de alta produtividade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Identificação comercial e suporte 0800-083-1200 na frota</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pátio amplo de manobra e lavagem de calhas</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                <a
                  href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Programar Carga em Monteiro</span>
                </a>
                <button
                  onClick={() =>
                    handlePedirOrcamento('Concreto Usinado GC Mix — Filial Monteiro (PB)')
                  }
                  className="inline-flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 px-4 rounded-xl border border-white/20 transition-all cursor-pointer"
                >
                  <span>Pedir Traço</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            3 PILARES COM FOTOS REAIS:
            - Card 1: Frota de Betoneiras (Foto 1: Vista Aérea Filial Monteiro)
            - Card 2: Central de Dosagem (Foto 3: Fachada e Silo Filial Monteiro)
            - Card 3: Agregados Próprios & Controle Tecnológico
            ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: Frota de Caminhões Betoneira — Foto Aérea de Monteiro */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <div>
              {/* Foto 1 Real: Vista Aérea da Filial Monteiro com Betoneiras */}
              <div
                className="relative h-56 sm:h-64 overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => {
                  if (onExpandirFoto) {
                    onExpandirFoto({
                      src: FOTOS_ESTATICAS_PEDREIRA.monteiroAerea,
                      titulo: 'Vista Aérea da Central GC Mix — Filial Monteiro',
                      local: 'Rodovia / Filial Monteiro — PB',
                      descricao:
                        'Vista panorâmica de drone: silo vertical GC Mix, edifícios administrativos brancos com detalhes azuis, pátio de agregados e duas betoneiras azul GC Mix operando em primeiro plano junto à rodovia.',
                      etiqueta: 'Visão Panorâmica Aérea',
                    })
                  }
                }}
              >
                <img
                  src={FOTOS_ESTATICAS_PEDREIRA.monteiroAerea}
                  alt="Vista aérea da central de concreto GC Mix filial Monteiro com betoneiras e rodovia"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F3B] via-transparent to-black/30 pointer-events-none" />

                <div className="absolute top-3 left-3">
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md shadow-md">
                    Foto Real Aérea
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>Filial Monteiro • PB (Rodovia)</span>
                </div>

                <div className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-full group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shadow-md">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                    <Truck className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge className="bg-blue-500/20 text-[#60A5FA] border-blue-400/40 text-[10px] font-bold uppercase tracking-wider">
                      Logística Ágil
                    </Badge>
                    <a
                      href={INSTITUCIONAL_CONFIG.rastreadorBetoneirasUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold transition-all shadow-xs hover:shadow-sm group/badge"
                      title="Rastrear frota de betoneiras em tempo real (SystemsAtx Tracking)"
                    >
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>Frota monitorada em tempo real</span>
                      <ExternalLink className="w-2.5 h-2.5 text-emerald-300/80 group-hover/badge:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                    Frota de Betoneiras
                  </h3>
                  <p className="text-xs text-blue-100/90 mt-2 leading-relaxed">
                    Caminhões betoneira modernos com tambores de alta capacidade e calhas
                    articuladas para descarregamento direto na obra, mantendo a trabalhabilidade e o
                    traço ideal.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs text-blue-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Entrega pontual com hora marcada na obra</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Rastreamento GPS via satélite em tempo real</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Agitação contínua durante todo o trajeto</span>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0 space-y-2">
              <a
                href={INSTITUCIONAL_CONFIG.rastreadorBetoneirasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#1E40AF] hover:to-[#1D4ED8] text-white font-bold text-xs py-2.5 rounded-xl border border-blue-400/40 shadow-xs transition-all"
                title="Acompanhar localização das betoneiras em tempo real"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Rastrear Betoneiras em Tempo Real</span>
                <ExternalLink className="w-3 h-3 text-amber-300" />
              </a>

              <button
                onClick={() => handlePedirOrcamento('Betoneira GC Mix — Programação de Entrega')}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2.5 rounded-xl border border-white/20 transition-all cursor-pointer"
              >
                <span>Programar Entrega de Betoneira</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </Card>

          {/* Card 2: Central de Concreto — Foto 3: Fachada e Silo Monteiro */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <div>
              {/* Foto 3 Real: Fachada e Silo da Filial Monteiro */}
              <div
                className="relative h-56 sm:h-64 overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => {
                  if (onExpandirFoto) {
                    onExpandirFoto({
                      src: FOTOS_ESTATICAS_PEDREIRA.monteiroFachadaSilo,
                      titulo: 'Fachada e Silo da Central GC Mix — Filial Monteiro',
                      local: 'Entrada da Filial Monteiro — PB',
                      descricao:
                        'Fachada da filial Monteiro com muro e silo vertical identificados com o telefone 0800-083-1200, prédio administrativo branco com faixa azul, portão metálico e árvores no acesso.',
                      etiqueta: 'Silo & Fachada da Filial',
                    })
                  }
                }}
              >
                <img
                  src={FOTOS_ESTATICAS_PEDREIRA.monteiroFachadaSilo}
                  alt="Fachada e silo da filial Monteiro da GC Mix Concreto com 0800-083-1200"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F3B] via-transparent to-black/30 pointer-events-none" />

                <div className="absolute top-3 left-3">
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md shadow-md">
                    Foto Real Fachada
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
                  <Building2 className="w-3 h-3 text-amber-400" />
                  <span>Silo GC Mix • 0800-083-1200</span>
                </div>

                <div className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-full group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shadow-md">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5 text-amber-300" />
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px] font-bold uppercase tracking-wider">
                    Automação Total
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                    Central de Dosagem
                  </h3>
                  <p className="text-xs text-blue-100/90 mt-2 leading-relaxed">
                    Silos de cimento de alta capacidade e balanças automatizadas. Cada metro cúbico
                    de concreto usinado segue rigorosamente as normas ABNT NBR 7212 e NBR 8953.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs text-blue-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Pesagem eletrônica de agregados e cimento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Aditivos plastificantes e retardadores dosados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Estrutura física própria em 5 polos estratégicos</span>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() =>
                  handlePedirOrcamento(
                    'Concreto Usinado Dosado em Central GC Mix (Monteiro/Região)',
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 rounded-xl border border-white/20 transition-all cursor-pointer"
              >
                <span>Consultar Traço Específico</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </Card>

          {/* Card 3: Agregados Próprios & Controle Tecnológico */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <div>
              {/* Foto Real de Agregados da Jazida/Britagem */}
              <div
                className="relative h-56 sm:h-64 overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => {
                  if (onExpandirFoto) {
                    onExpandirFoto({
                      src: FOTOS_ESTATICAS_PEDREIRA.patioDeBrita,
                      titulo: 'Agregados Próprios da Pedreira Cordeiro',
                      local: 'Pedreira Cordeiro • Patos — PB',
                      descricao:
                        'Brita 12 e pó de pedra calibrados originados do maciço granítico próprio da Pedreira Cordeiro, garantindo resistência mecânica e pureza ao concreto GC Mix.',
                      etiqueta: 'Agregados da Pedreira Cordeiro',
                    })
                  }
                }}
              >
                <img
                  src={FOTOS_ESTATICAS_PEDREIRA.patioDeBrita}
                  alt="Pátio de agregados da Pedreira Cordeiro com britas para o concreto GC Mix"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F3B] via-transparent to-black/30 pointer-events-none" />

                <div className="absolute top-3 left-3">
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md shadow-md">
                    Agregados Próprios
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>Pedreira Cordeiro • Brita 12 e Pó</span>
                </div>

                <div className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-full group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shadow-md">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                  </div>
                  <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/40 text-[10px] font-bold uppercase tracking-wider">
                    Qualidade Garantida
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                    Controle Tecnológico
                  </h3>
                  <p className="text-xs text-blue-100/90 mt-2 leading-relaxed">
                    Usamos Brita 12 e pó de pedra originados diretamente da nossa Pedreira Cordeiro,
                    com ensaios periódicos de resistência à compressão axial (FCK) e Slump Test.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs text-blue-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Rastreabilidade de cada carga enviada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Moldagem de corpos de prova (Slump Test)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Sem desperdício de areia, brita ou cimento na obra</span>
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0">
              <a
                href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Falar com Técnico de Concreto</span>
              </a>
            </div>
          </Card>
        </div>

        {/* =========================================================
            COBERTURA REGIONAL: AS 5 UNIDADES GC MIX CONCRETO
            Patos (matriz), Santa Luzia, Monteiro, São José do Egito e Caicó
            ========================================================= */}
        <div className="bg-gradient-to-br from-[#0F2244] to-[#0A1933] border border-blue-400/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Cobertura das 5 Unidades GC Mix</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Raio de Atendimento Estratégico no Sertão
              </h3>
              <p className="text-sm text-blue-200 mt-1 max-w-2xl leading-relaxed">
                Nossas concreteiras estão distribuídas para cobrir obras urbanas, industriais,
                rodoviárias e rurais com menor tempo de transporte e preservação do abatimento do
                concreto.
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white">5 Centrais Operando</strong> • PB, PE e RN
            </div>
          </div>

          {/* Cards das 5 Unidades */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-8">
            {UNIDADES_GC.map((unidade) => {
              const isSelected = unidadeAtiva === unidade.id
              const fotoUnidade =
                unidade.id === 'sao-jose-do-egito'
                  ? FOTOS_ESTATICAS_PEDREIRA.saoJoseDoEgitoSiloPatio
                  : unidade.id === 'monteiro'
                    ? FOTOS_ESTATICAS_PEDREIRA.monteiroFachadaSilo
                    : null
              const fotoTitulo =
                unidade.id === 'sao-jose-do-egito'
                  ? 'Silo e Pátio da Unidade — Filial São José do Egito-PE'
                  : 'Fachada e Silo da Central GC Mix — Filial Monteiro'
              const fotoDescricao =
                unidade.id === 'sao-jose-do-egito'
                  ? 'Silo vertical de concreto à esquerda, pátio com caminhonete prata e dois muros com a marca GC MIX Concreto & Pedreira e 0800-083-1200.'
                  : 'Fachada da filial Monteiro com silo vertical GC Mix identificado com 0800-083-1200.'
              const fotoLocal =
                unidade.id === 'sao-jose-do-egito'
                  ? 'São José do Egito, PE'
                  : 'Filial Monteiro — PB'

              return (
                <div
                  key={unidade.id}
                  onClick={() => setUnidadeAtiva(unidade.id)}
                  className={`rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between border overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#1E3A8A] to-[#172554] border-amber-400 shadow-xl ring-2 ring-amber-400/50 scale-[1.02]'
                      : 'bg-white/5 border-white/10 hover:border-blue-300/50 hover:bg-white/10'
                  }`}
                >
                  {fotoUnidade && (
                    <div
                      className="relative h-28 w-full overflow-hidden bg-slate-950 group/foto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onExpandirFoto) {
                          onExpandirFoto({
                            src: fotoUnidade,
                            titulo: fotoTitulo,
                            local: fotoLocal,
                            descricao: fotoDescricao,
                            etiqueta: `Foto Real • ${unidade.cidade}`,
                          })
                        }
                      }}
                      title="Clique para ver a foto real desta unidade"
                    >
                      <img
                        src={fotoUnidade}
                        alt={`Instalações reais da unidade ${unidade.cidade}`}
                        className="w-full h-full object-cover group-hover/foto:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-2 left-2">
                        <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs">
                          Foto Real
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white p-1 rounded-full group-hover/foto:bg-amber-400 group-hover/foto:text-slate-950 transition-colors">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                            unidade.destaque
                              ? 'bg-amber-400 text-slate-950 shadow-md'
                              : isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/10 text-blue-300'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </div>

                        {unidade.destaque ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                            Matriz
                          </span>
                        ) : fotoUnidade ? (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                            Unidade com Foto
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white">
                          {unidade.cidade}{' '}
                          <span className="text-xs text-blue-300 font-bold">({unidade.uf})</span>
                        </h4>
                        <p className="text-xs text-blue-200 mt-1 line-clamp-2 leading-relaxed">
                          {unidade.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-white/10">
                      <span className="text-[11px] font-bold text-amber-300 block">
                        {unidade.tipo}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePedirOrcamento(
                            `Concreto GC Mix — Unidade ${unidade.cidade}-${unidade.uf}`,
                          )
                        }}
                        className="mt-2 w-full text-center text-[11px] font-bold text-white bg-blue-600/60 hover:bg-blue-600 py-1.5 px-2 rounded-lg transition-colors cursor-pointer"
                      >
                        Cotar nesta unidade
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Destaque Interativo da Unidade Selecionada (São José do Egito ou Monteiro com Foto Real) */}
          {unidadeAtiva === 'sao-jose-do-egito' && (
            <div className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-[#172554] via-[#1E3A8A] to-[#0A2540] border-2 border-amber-400/60 shadow-xl text-white">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div
                  className="lg:col-span-5 relative h-56 sm:h-64 rounded-2xl overflow-hidden bg-slate-950 cursor-pointer group/card"
                  onClick={() => {
                    if (onExpandirFoto) {
                      onExpandirFoto({
                        src: FOTOS_ESTATICAS_PEDREIRA.saoJoseDoEgitoSiloPatio,
                        titulo: 'Silo e Pátio da Unidade — Filial São José do Egito-PE',
                        local: 'São José do Egito, PE',
                        descricao:
                          'Registro autêntico da filial de São José do Egito (PE) da Central GC Mix: silo de concreto à esquerda, pátio operacional com caminhonete prata, e muros perimetrais identificados com a marca "GC MIX Concreto & Pedreira — Patos/S.ta Luzia-PB/S.J. do Egito-PE/Caicó-RN — 0800-083-1200" e painel "GC MIX PISO-LAJE POLIMENTO 0800-083-1200".',
                        etiqueta: 'Foto Real • São José do Egito-PE',
                      })
                    }
                  }}
                >
                  <img
                    src={FOTOS_ESTATICAS_PEDREIRA.saoJoseDoEgitoSiloPatio}
                    alt="Silo, pátio e identificação visual da unidade São José do Egito da GC Mix"
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded-md shadow-md">
                      Foto Real da Unidade
                    </span>
                    <span className="bg-[#0A2540]/90 text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/20">
                      São José do Egito — PE
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-full group-hover/card:bg-amber-400 group-hover/card:text-slate-950 transition-colors shadow-md">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Unidade Operacional Ativa • Pajeú Pernambucano</span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white">
                    Filial São José do Egito — Concreto GC Mix
                  </h4>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    Unidade equipada com <strong>silo vertical de cimento</strong>, central dosadora
                    e pátio operacional para abastecimento rápido de São José do Egito, Tuparetama,
                    Itapetim, Ouro Velho e todo o Alto Pajeú e Cariri paraibano vizinho.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Silo vertical próprio e pátio de manobras</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Piso, Laje e Polimento com traço certificado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Atendimento gratuito pelo 0800 083 1200</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Integrada às filiais de Patos, Santa Luzia e Monteiro</span>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md text-xs cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Cotar Concreto em São José do Egito</span>
                    </a>
                    <button
                      onClick={() =>
                        handlePedirOrcamento('Concreto GC Mix — Filial São José do Egito (PE)')
                      }
                      className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 text-xs transition-all cursor-pointer"
                    >
                      <span>Formulário de Cotação</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {unidadeAtiva === 'monteiro' && (
            <div className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-[#172554] via-[#1E3A8A] to-[#0A2540] border-2 border-blue-400/60 shadow-xl text-white">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div
                  className="lg:col-span-5 relative h-56 sm:h-64 rounded-2xl overflow-hidden bg-slate-950 cursor-pointer group/card"
                  onClick={() => {
                    if (onExpandirFoto) {
                      onExpandirFoto({
                        src: FOTOS_ESTATICAS_PEDREIRA.monteiroFachadaSilo,
                        titulo: 'Fachada e Silo da Central GC Mix — Filial Monteiro',
                        local: 'Entrada da Filial Monteiro — PB',
                        descricao:
                          'Fachada da filial Monteiro com muro e silo vertical identificados com o telefone 0800-083-1200, prédio administrativo branco com faixa azul, portão metálico e árvores no acesso.',
                        etiqueta: 'Foto Real • Filial Monteiro',
                      })
                    }
                  }}
                >
                  <img
                    src={FOTOS_ESTATICAS_PEDREIRA.monteiroFachadaSilo}
                    alt="Fachada e silo da filial Monteiro da GC Mix"
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded-md shadow-md">
                      Foto Real da Unidade
                    </span>
                    <span className="bg-[#0A2540]/90 text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/20">
                      Monteiro — PB
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/70 text-white p-2 rounded-full group-hover/card:bg-amber-400 group-hover/card:text-slate-950 transition-colors shadow-md">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Unidade Operacional Ativa • Cariri Ocidental</span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white">
                    Filial Monteiro — Central GC Mix Concreto
                  </h4>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    Unidade estratégica com silo vertical, dosador computadorizado e frota de
                    betoneiras Liebherr/VW Constellation para atendimento em Monteiro, Sertânia,
                    Zabelê, São Sebastião do Umbuzeiro e região.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Silo vertical e prédio administrativo próprio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Caminhões betoneira dedicados à filial</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Acesso direto pela rodovia asfaltada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Atendimento gratuito pelo 0800 083 1200</span>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md text-xs cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Cotar Concreto em Monteiro</span>
                    </a>
                    <button
                      onClick={() =>
                        handlePedirOrcamento('Concreto Usinado GC Mix — Filial Monteiro (PB)')
                      }
                      className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 text-xs transition-all cursor-pointer"
                    >
                      <span>Formulário de Cotação</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Banner explicativo de atendimento integrado */}
          <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-[#0A1A3B]/80 border border-blue-400/20 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-amber-300" />
              </div>
              <p className="text-blue-100">
                <strong className="text-white">Obras em municípios vizinhos:</strong> Atendemos
                rotas em dezenas de cidades ao redor de Patos, Santa Luzia, Monteiro, São José do
                Egito e Caicó. Consulte a rota ideal para a sua concretagem.
              </p>
            </div>

            <a
              href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shrink-0 transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Consultar Raio de Entrega</span>
            </a>
          </div>
        </div>

        {/* =========================================================
            GRADE DE TRAÇOS TÉCNICOS FCK (20, 25, 30, 35+ MPa)
            ========================================================= */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs font-bold uppercase tracking-wider">
              Traços Sob Medida
            </Badge>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Resistências para Todo Tipo de Estrutura
            </h3>
            <p className="text-xs sm:text-sm text-blue-200">
              Dosagens convencionais, bombeáveis, auto-adensáveis e para pisos industriais de alto
              tráfego.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRACos_CONCRETO.map((item, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  item.destaque
                    ? 'bg-gradient-to-b from-[#1E3A8A] via-[#172554] to-[#0F1D36] border-amber-400 shadow-xl ring-2 ring-amber-400/40'
                    : 'bg-white/5 border-white/10 hover:border-blue-400/40 hover:bg-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        item.destaque
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                      }`}
                    >
                      {item.tag}
                    </span>
                    <Gauge className="w-4 h-4 text-blue-300" />
                  </div>

                  <div>
                    <h4 className="text-2xl font-black text-white">{item.fck}</h4>
                    <p className="text-xs text-blue-200 mt-2 leading-relaxed">{item.indicacao}</p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Trabalhabilidade:</span>
                    <strong className="text-white">{item.slump}</strong>
                  </div>

                  <button
                    onClick={() => handlePedirOrcamento(`Concreto Usinado GC Mix — ${item.fck}`)}
                    className="w-full text-center text-xs font-bold py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Cotar {item.fck}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================
            BANNER INFORMATIVO: VANTAGENS DO CONCRETO USINADO GC MIX
            ========================================================= */}
        <div className="rounded-3xl bg-gradient-to-r from-[#172554] via-[#1E3A8A] to-[#1D4ED8] p-8 sm:p-10 border border-blue-400/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center lg:text-left">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300 block">
              Por que escolher a GC Mix?
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Sua concretagem com garantia, sem dor de cabeça e com preço justo
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Elimine o custo de betoneiras manuais na obra, perdas de cimento em sacos e variações
              de resistência. A GC Mix entrega o volume exato, pronto para o lançamento e com
              controle tecnológico completo.
            </p>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-200">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero desperdício de agregados</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Maior rapidez no dia da laje</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Nota fiscal e laudos de ensaio</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
            <a
              href={INSTITUCIONAL_CONFIG.whatsappUrlConcreto}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 cursor-pointer text-center"
            >
              <MessageCircle className="w-5 h-5 text-slate-950" />
              <span>Pedir Orçamento Agora</span>
            </a>

            <a
              href={INSTITUCIONAL_CONFIG.telefoneTelLink}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-3 rounded-xl border border-white/20 transition-all text-center cursor-pointer"
            >
              <Phone className="w-4 h-4 text-amber-300" />
              <span>Central: {INSTITUCIONAL_CONFIG.telefoneFormatado}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
