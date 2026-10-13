import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Phone, Copy, Check, X, Smartphone, Clock, ShieldCheck } from 'lucide-react'
import { INSTITUCIONAL_CONFIG } from '@/data/institucional'

/**
 * Detecta se o dispositivo é realmente móvel (smartphone/tablet com discador nativo).
 * Critério: User-Agent mobile/tablet OU (touch habilitado AND pointer coarse).
 * Garante que desktops com telas estreitas continuem abrindo o modal,
 * e notebooks com touch screen híbrido e mouse mantenham comportamento desktop,
 * enquanto celulares reais abram o discador via tel:.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const userAgent =
    navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || ''

  // Expressão regular com principais plataformas móveis
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i

  const isMobileUA = mobileRegex.test(userAgent)

  // Suporte a iPadOS modernos que fingem ser MacIntel mas têm maxTouchPoints > 1
  const isIPadOS =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1

  // Detecção via media query de ponteiro touch exclusivo (coarse) e sem hover preciso
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse) and (hover: none)').matches

  return isMobileUA || isIPadOS || hasCoarsePointer
}

interface SmartLigacaoContextValue {
  abrirModalLigacao: (origem?: string) => void
  fecharModalLigacao: () => void
  handleClickLigacao: (e?: React.MouseEvent, origem?: string) => void
}

const SmartLigacaoContext = React.createContext<SmartLigacaoContextValue | null>(null)

export function useSmartLigacao(): SmartLigacaoContextValue {
  const context = React.useContext(SmartLigacaoContext)
  if (!context) {
    throw new Error('useSmartLigacao deve ser utilizado dentro de um SmartLigacaoProvider')
  }
  return context
}

interface SmartLigacaoProviderProps {
  children: React.ReactNode
}

export function SmartLigacaoProvider({ children }: SmartLigacaoProviderProps) {
  const [modalAberto, setModalAberto] = React.useState(false)
  const [copiado, setCopiado] = React.useState(false)
  const [origemChamada, setOrigemChamada] = React.useState<string | undefined>()

  const abrirModalLigacao = React.useCallback((origem?: string) => {
    setOrigemChamada(origem)
    setModalAberto(true)
    setCopiado(false)
  }, [])

  const fecharModalLigacao = React.useCallback(() => {
    setModalAberto(false)
    setCopiado(false)
  }, [])

  const handleClickLigacao = React.useCallback(
    (e?: React.MouseEvent, origem?: string) => {
      // Se for dispositivo móvel, permite que o link tel: seja seguido naturalmente
      if (isMobileDevice()) {
        return
      }

      // Em desktop/notebook: previne o clique do link tel: e exibe o modal inteligente
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      abrirModalLigacao(origem)
    },
    [abrirModalLigacao],
  )

  const copiarNumero = React.useCallback(async () => {
    const numero = INSTITUCIONAL_CONFIG.telefoneNumero // '08000831200'
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(numero)
      } else {
        // Fallback para navegadores sem Clipboard API
        const textarea = document.createElement('textarea')
        textarea.value = numero
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiado(true)
      setTimeout(() => {
        setCopiado(false)
      }, 3000)
    } catch {
      // Erro silencioso de cópia; usuário ainda vê o número na tela
    }
  }, [])

  return (
    <SmartLigacaoContext.Provider
      value={{
        abrirModalLigacao,
        fecharModalLigacao,
        handleClickLigacao,
      }}
    >
      {children}

      <Dialog
        open={modalAberto}
        onOpenChange={(open) => (!open ? fecharModalLigacao() : setModalAberto(true))}
      >
        <DialogContent className="sm:max-w-[480px] bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border border-blue-200">
          {/* Topo em Azul Munique Oficial com iluminação suave */}
          <div className="bg-gradient-to-br from-[#0A2540] via-[#113264] to-[#1E3A8A] text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-[#38BDF8]/20 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-36 h-36 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />

            <DialogHeader className="relative z-10 text-left space-y-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E40AF]/80 border border-[#60A5FA]/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Central de Ligação Gratuita</span>
                </div>
              </div>

              <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Ligue para a Central 0800
              </DialogTitle>

              <DialogDescription className="text-xs sm:text-sm text-blue-100 font-normal leading-relaxed">
                Ligação 100% gratuita para telefones fixos e celulares de todo o Brasil. Atendimento
                para Pedreira Cordeiro, GC Mix Concreto e Britador Lokotrack.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Corpo com o número em destaque grande e botão de cópia */}
          <div className="p-6 sm:p-7 space-y-5 bg-white">
            {/* Bloco de destaque do número de telefone */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-blue-50/80 to-slate-50 border-2 border-blue-200 text-center space-y-3 relative">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Número para discagem
              </div>

              <div className="text-3xl sm:text-4xl font-black text-[#0A2540] tracking-tight font-mono select-all">
                {INSTITUCIONAL_CONFIG.telefoneFormatado}
              </div>

              <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                {origemChamada
                  ? `Atendimento comercial e técnico direto para: ${origemChamada}`
                  : 'Atendimento comercial, cotações de concreto usinado, agregados e locação de Lokotrack.'}
              </p>

              {/* Botão de Copiar Número */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button
                  onClick={copiarNumero}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer ${
                    copiado
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#1E40AF] hover:to-[#1D4ED8] text-white'
                  }`}
                >
                  {copiado ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span>Número copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-blue-200" />
                      <span>Copiar número</span>
                    </>
                  )}
                </Button>

                {/* Link direto tel: caso o desktop tenha app de telefonia instalado (ex: Teams/Skype/FaceTime) */}
                <a
                  href={INSTITUCIONAL_CONFIG.telefoneTelLink}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1D4ED8] px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Tentar discar pelo aplicativo padrão do computador"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Tentar discar no PC</span>
                </a>
              </div>
            </div>

            {/* Dicas / Garantias de atendimento */}
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Chamada gratuita de celular ou fixo (0800 083 1200)</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <Clock className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>{INSTITUCIONAL_CONFIG.horarioAtendimento}</span>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 flex items-center justify-end">
              <Button
                variant="outline"
                onClick={fecharModalLigacao}
                className="w-full sm:w-auto rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs px-5 py-2.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SmartLigacaoContext.Provider>
  )
}

interface SmartLigacaoButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode
  origem?: string
  className?: string
}

/**
 * Componente âncora inteligente para os botões de 0800.
 * Mantém href="tel:08000831200" para SEO e suporte nativo mobile,
 * intercepta o clique em desktops para exibir o modal sem que a tela fique inerte.
 */
export function SmartLigacaoButton({
  children,
  origem,
  className = '',
  onClick,
  ...rest
}: SmartLigacaoButtonProps) {
  const { handleClickLigacao } = useSmartLigacao()

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e)
    }
    handleClickLigacao(e, origem)
  }

  return (
    <a
      href={INSTITUCIONAL_CONFIG.telefoneTelLink}
      onClick={handleAnchorClick}
      className={className}
      {...rest}
    >
      {children}
    </a>
  )
}
