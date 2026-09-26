import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadForFreshVersion } from '@/lib/chunkAutoReload'
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Nome ou identificador da tela para contextualizar o usuário */
  screenName?: string
  /** Se true, renderiza fallback minimalista/inline em vez de tela inteira */
  inline?: boolean
  /** Callback customizado quando ocorre um erro */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isChunkError: boolean
}

/**
 * Rede de proteção contra telas brancas (Error Boundary).
 * Captura erros de ciclo de vida e renderização do React, exibindo uma interface
 * amigável em português com opções de recarregar a tela ou voltar ao Dashboard.
 *
 * Se o erro for uma falha de importação de versão antiga (chunk/bundle desatualizado),
 * aciona automaticamente o auto-reload inteligente controlado.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const isChunk = isChunkLoadError(error)
    return {
      hasError: true,
      error,
      isChunkError: isChunk,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary] Erro capturado na tela "${this.props.screenName || 'Geral'}":`,
      error,
      errorInfo,
    )

    this.setState({ errorInfo })

    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo)
      } catch (cbErr) {
        console.error('[ErrorBoundary] Falha no onError callback:', cbErr)
      }
    }

    // Se for erro de módulo dinâmico desatualizado, tenta auto-reload automático
    if (isChunkLoadError(error)) {
      console.warn(
        '[ErrorBoundary] ChunkLoadError detectado — disparando auto-reload de nova versão...',
      )
      reloadForFreshVersion(`ErrorBoundary: ${this.props.screenName || 'chunk'}`)
    }
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    })
  }

  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    })
    window.location.href = '/'
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { screenName, inline } = this.props
    const { error, isChunkError } = this.state

    if (inline) {
      return (
        <div className="p-4 my-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Algo deu errado ao carregar este bloco {screenName ? `(${screenName})` : ''}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="h-7 text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
            >
              Tentar Novamente
            </Button>
            <Button
              size="sm"
              onClick={this.handleReload}
              className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Recarregar
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4 sm:p-6 w-full animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-[#ECEAE4] shadow-sm p-6 sm:p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
            {isChunkError ? (
              <RefreshCw className="w-7 h-7 text-teal-700 animate-spin" />
            ) : (
              <ShieldAlert className="w-7 h-7 text-amber-600" />
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            {isChunkError ? 'Nova versão do sistema detectada' : 'Algo deu errado nesta tela'}
          </h2>

          <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
            {isChunkError
              ? 'Uma nova versão do ERP Pedreira Cordeiro foi publicada. Estamos atualizando a aplicação para que você continue trabalhando normalmente.'
              : `Ocorreu uma instabilidade inesperada ao exibir o conteúdo ${
                  screenName ? `de ${screenName}` : 'desta página'
                }. Os dados salvos continuam seguros no banco de dados.`}
          </p>

          {error?.message && !isChunkError && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Detalhe técnico para suporte:
              </span>
              <p className="text-xs font-mono text-gray-700 break-words line-clamp-3">
                {error.message}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Button
              onClick={this.handleReload}
              className="w-full sm:w-auto bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 px-4 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Recarregar Tela
            </Button>

            <Button
              variant="outline"
              onClick={this.handleGoHome}
              className="w-full sm:w-auto border-[#ECEAE4] hover:bg-[#FAF9F7] text-gray-700 rounded-xl text-xs h-9 px-4"
            >
              <Home className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Voltar ao Dashboard
            </Button>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <span>Pedreira Cordeiro ERP • NovaGest</span>
            <span>•</span>
            <span className="font-mono">Ambiente Estável</span>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
