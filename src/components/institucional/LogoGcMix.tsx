import React from 'react'

interface LogoGcMixProps {
  variant?: 'banner' | 'badge' | 'compact'
  className?: string
  priorityBannerImg?: boolean
}

// Imagens salvas diretamente dos anexos enviados pelo cliente
import bannerImage from '@/assets/whatsapp-image-2026-09-26-at-16.17.32-1-9f1a9.jpeg'
import squareImage from '@/assets/whatsapp-image-2026-09-26-at-16.17.59-64cca.jpeg'

export const ASSET_LOGO_BANNER = bannerImage
export const ASSET_LOGO_SQUARE = squareImage

export function LogoGcMixVector({
  className = '',
  subtitulo = 'CONCRETO USINADO & PEDREIRA CORDEIRO',
  comCaminhao = true,
}: {
  className?: string
  subtitulo?: string
  comCaminhao?: boolean
}) {
  return (
    <div
      className={`inline-flex flex-col select-none relative ${className}`}
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bloco GC + MIX */}
        <div className="relative inline-flex items-center">
          {/* Letras GC com contorno azul e preenchimento branco */}
          <div className="relative z-10 flex items-center tracking-tighter">
            <span
              className="text-4xl sm:text-5xl md:text-6xl font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              style={{
                WebkitTextStroke: '3px #1E40AF',
                paintOrder: 'stroke fill',
                textShadow: '0 2px 8px rgba(10,37,64,0.5)',
                letterSpacing: '-0.04em',
              }}
            >
              GC
            </span>
          </div>

          {/* Faixa cinza horizontal com a palavra MIX em azul */}
          <div className="relative -ml-2 z-20 flex items-center">
            <div className="bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 border-2 border-slate-100 rounded-sm px-2.5 py-0.5 sm:px-3 sm:py-1 shadow-md">
              <span
                className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-wider text-[#1E3A8A]"
                style={{
                  fontFamily: "Impact, Haettenschweiler, 'Arial Black', sans-serif",
                }}
              >
                MIX
              </span>
            </div>
          </div>
        </div>

        {/* Desenho do caminhão betoneira estilizado */}
        {comCaminhao && (
          <div className="shrink-0 text-white/90 drop-shadow-md hidden xs:flex sm:flex items-center">
            <svg
              className="w-12 h-9 sm:w-16 sm:h-12 md:w-20 md:h-14 text-white"
              viewBox="0 0 120 70"
              fill="currentColor"
              aria-hidden="true"
            >
              {/* Cabine */}
              <path
                d="M85 30 L102 30 Q112 30 115 42 L117 56 Q117 58 114 58 L85 58 Z"
                fill="currentColor"
                opacity="0.95"
              />
              {/* Janela cabine */}
              <path d="M90 35 L102 35 Q108 35 110 44 L90 44 Z" fill="#1E3A8A" />
              {/* Balão da betoneira (tambor rotativo inclinado) */}
              <ellipse
                cx="52"
                cy="32"
                rx="30"
                ry="18"
                transform="rotate(-18 52 32)"
                fill="currentColor"
                opacity="0.9"
              />
              {/* Linhas de hélice do tambor */}
              <path d="M32 26 Q52 30 72 38" stroke="#1E3A8A" strokeWidth="2.5" fill="none" />
              <path d="M36 38 Q56 42 74 30" stroke="#1E3A8A" strokeWidth="2.5" fill="none" />
              {/* Chassi do caminhão */}
              <rect x="18" y="52" width="82" height="7" rx="2" fill="currentColor" opacity="0.95" />
              {/* Rodas traseiras duplas */}
              <circle cx="32" cy="58" r="9" fill="#1E3A8A" stroke="white" strokeWidth="3" />
              <circle cx="32" cy="58" r="4" fill="white" />
              <circle cx="54" cy="58" r="9" fill="#1E3A8A" stroke="white" strokeWidth="3" />
              <circle cx="54" cy="58" r="4" fill="white" />
              {/* Roda dianteira */}
              <circle cx="102" cy="58" r="9" fill="#1E3A8A" stroke="white" strokeWidth="3" />
              <circle cx="102" cy="58" r="4" fill="white" />
              {/* Calha de descarga traseira */}
              <path d="M16 28 L24 38 L21 40 L13 30 Z" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>

      {/* Subtítulo em itálico branco */}
      {subtitulo && (
        <div className="mt-0.5 sm:mt-1">
          <span
            className="text-[10px] sm:text-xs md:text-sm font-black italic uppercase tracking-wider text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            style={{
              textShadow: '0 1px 2px rgba(10,37,64,0.8), 0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            {subtitulo}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Componente principal da Logo GC Mix
 * Exibe a imagem real enviada pelo cliente (com altíssima fidelidade fotográfica)
 * e oferece modo SVG vetorial como fallback ou escolha de estilo.
 */
export function LogoGcMix({ variant = 'banner', className = '' }: LogoGcMixProps) {
  if (variant === 'badge') {
    return (
      <div
        className={`relative inline-block rounded-xl overflow-hidden shadow-lg border border-blue-400/40 ${className}`}
      >
        <img
          src={squareImage}
          alt="GC MIX & Pedreira Cordeiro"
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative h-10 w-24 sm:w-28 overflow-hidden rounded-md flex items-center">
          <img
            src={bannerImage}
            alt="GC MIX Logo"
            className="w-full h-full object-cover object-left scale-110"
            loading="eager"
          />
        </div>
      </div>
    )
  }

  // Variant "banner" (Padrão e Hero)
  return (
    <div
      className={`relative inline-block overflow-hidden rounded-2xl shadow-2xl border border-white/20 group ${className}`}
    >
      <img
        src={bannerImage}
        alt="GC MIX — Concreto Usinado & Pedreira Cordeiro"
        className="w-full h-auto max-h-36 sm:max-h-44 md:max-h-52 object-contain rounded-2xl"
        loading="eager"
      />
    </div>
  )
}
