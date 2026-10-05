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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SecaoGcMixConcretoProps {
  onSolicitarOrcamento?: (produtoOuDetalhe: string) => void
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

export function SecaoGcMixConcreto({ onSolicitarOrcamento }: SecaoGcMixConcretoProps) {
  const [unidadeAtiva, setUnidadeAtiva] = useState<string>('patos')

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
            3 PILARES: BETONEIRAS, CENTRAL E QUALIDADE CONTROLADA
            ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: Frota de Caminhões Betoneira */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <CardContent className="p-7 sm:p-8 space-y-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                  <Truck className="w-7 h-7 text-amber-300" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge className="bg-blue-500/20 text-[#60A5FA] border-blue-400/40 text-[11px] font-bold uppercase tracking-wider">
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
                <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                  Frota de Betoneiras
                </h3>
                <p className="text-sm text-blue-100/90 mt-2.5 leading-relaxed">
                  Caminhões betoneira modernos com tambores de alta capacidade e calhas articuladas
                  para descarregamento direto no local da concretagem, mantendo a plasticidade e a
                  homogeneidade do traço.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Entrega pontual com hora marcada na obra</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Rastreamento GPS via satélite em tempo real</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Agitação contínua durante todo o trajeto</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Motoristas-operadores experientes na descarga</span>
                </div>
              </div>
            </CardContent>

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

          {/* Card 2: Central de Concreto Automatizada */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <CardContent className="p-7 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                  <Building2 className="w-7 h-7 text-amber-300" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[11px] font-bold uppercase tracking-wider">
                  Automação Total
                </Badge>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                  Central de Dosagem
                </h3>
                <p className="text-sm text-blue-100/90 mt-2.5 leading-relaxed">
                  Balanças computadorizadas e dosadores automáticos de aditivos e água. Cada m³ de
                  concreto é produzido sob parâmetros rígidos das normas ABNT NBR 7212 e NBR 8953.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pesagem eletrônica de agregados e cimento</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Aditivos plastificantes e retardadores dosados</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Integração direta com a britagem da Pedreira</span>
                </div>
              </div>
            </CardContent>

            <div className="p-6 pt-0">
              <button
                onClick={() => handlePedirOrcamento('Concreto Usinado Dosado em Central GC Mix')}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 rounded-xl border border-white/20 transition-all cursor-pointer"
              >
                <span>Consultar Traço Específico</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </Card>

          {/* Card 3: Agregados Próprios & Controle Tecnológico */}
          <Card className="bg-gradient-to-br from-[#0F284E] via-[#0A1F3B] to-[#0A1933] border-blue-400/30 text-white rounded-3xl overflow-hidden shadow-2xl hover:border-blue-400/60 transition-all group flex flex-col justify-between">
            <CardContent className="p-7 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-7 h-7 text-amber-300" />
                </div>
                <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/40 text-[11px] font-bold uppercase tracking-wider">
                  Qualidade Garantida
                </Badge>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                  Controle Tecnológico
                </h3>
                <p className="text-sm text-blue-100/90 mt-2.5 leading-relaxed">
                  Usamos Brita 12 e pó de pedra originados diretamente da nossa Pedreira Cordeiro,
                  com granulometria estável e ensaios periódicos de resistência à compressão axial.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Rastreabilidade de cada carga enviada</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Moldagem de corpos de prova (Slump Test)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sem desperdício de areia, brita ou cimento na obra</span>
                </div>
              </div>
            </CardContent>

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
              return (
                <div
                  key={unidade.id}
                  onClick={() => setUnidadeAtiva(unidade.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#1E3A8A] to-[#172554] border-amber-400 shadow-xl ring-2 ring-amber-400/50 scale-[1.02]'
                      : 'bg-white/5 border-white/10 hover:border-blue-300/50 hover:bg-white/10'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                          unidade.destaque
                            ? 'bg-amber-400 text-slate-950 shadow-md'
                            : isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-blue-300'
                        }`}
                      >
                        <MapPin className="w-5 h-5" />
                      </div>

                      {unidade.destaque && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                          Matriz
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-white">
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
              )
            })}
          </div>

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
