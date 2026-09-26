/**
 * Utilitário de detecção e recuperação automática de falhas de carregamento
 * de módulos dinâmicos (chunks) gerados por novas versões/deploys do Vite/PWA.
 *
 * Previne tela branca quando o usuário está com uma versão antiga aberta no navegador
 * ou PWA e o bundle faz split import de um hash que não existe mais no servidor.
 */

const RELOAD_STORAGE_KEY = 'pedreira_erp_chunk_reload_ts'
const RELOAD_GUARD_WINDOW_MS = 15000 // Máximo 1 reload a cada 15s para evitar loop infinito

/**
 * Verifica se um erro (ou mensagem) corresponde a uma falha de importação de chunk dinâmico
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const message =
    typeof error === 'string'
      ? error
      : (error as Error)?.message || (error as any)?.reason?.message || ''

  const str = String(message).toLowerCase()

  return (
    str.includes('failed to fetch dynamically imported module') ||
    str.includes('error loading dynamically imported module') ||
    str.includes('loading chunk') ||
    str.includes('loading css chunk') ||
    str.includes('dynamically imported module') ||
    str.includes('importing a module script failed') ||
    str.includes('failed to load module script') ||
    str.includes('unable to preload css') ||
    (error as any)?.name === 'ChunkLoadError'
  )
}

/**
 * Executa o recarregamento controlado da aplicação quando detectada versão desatualizada
 */
export function reloadForFreshVersion(reason: string = 'nova versão do sistema'): boolean {
  try {
    const lastReload = sessionStorage.getItem(RELOAD_STORAGE_KEY)
    const now = Date.now()

    if (lastReload) {
      const diff = now - Number(lastReload)
      if (diff < RELOAD_GUARD_WINDOW_MS) {
        console.warn(
          `[Estabilidade] Reload cancelado para evitar loop (último reload há ${(diff / 1000).toFixed(1)}s):`,
          reason,
        )
        return false
      }
    }

    sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now))
    console.info(`[Estabilidade] Recarregando para obter versão atualizada (${reason})...`)

    // Se estiver em modo PWA e houver ServiceWorker, força update
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((reg) => reg.update().catch(() => {}))
        })
        .catch(() => {})
    }

    // Força recarga completa ignorando cache HTTP da página
    window.location.reload()
    return true
  } catch (err) {
    console.error('[Estabilidade] Falha ao tentar recarregar:', err)
    window.location.reload()
    return true
  }
}

/**
 * Instala handlers globais no window para interceptar erros não capturados de imports dinâmicos
 */
export function setupGlobalChunkErrorHandler(): void {
  // 1. Vite dispara evento vite:preloadError quando um chunk dinâmico falha
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Estabilidade] vite:preloadError detectado:', event)
    event.preventDefault()
    reloadForFreshVersion('vite:preloadError')
  })

  // 2. Erros globais não capturados (window.onerror)
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error || event.message)) {
      console.warn('[Estabilidade] Erro global de chunk capturado:', event.error || event.message)
      event.preventDefault()
      reloadForFreshVersion('window.error: chunkLoad')
    }
  })

  // 3. Unhandled promise rejections (quando import() rejeita e ninguém capturou)
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      console.warn('[Estabilidade] Unhandled rejection de chunk capturado:', event.reason)
      event.preventDefault()
      reloadForFreshVersion('unhandledrejection: chunkLoad')
    }
  })
}
