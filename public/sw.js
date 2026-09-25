// Service Worker for Pedreira Cordeiro ERP (NovaGest)
// Estratégia de cache:
// 1. App Shell (HTML, CSS, JS estáticos compilados com hash, ícones e fontes): Stale-While-Revalidate / Cache-First
// 2. NUNCA cachear chamadas de API do PocketBase (/api/*), rotas autenticadas ou dados mutáveis do banco
// 3. Fallback gracioso para offline no app shell

const CACHE_NAME = 'pedreira-cordeiro-v2-perf'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
]

// Instalação do Service Worker: pré-cache do App Shell mínimo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          // Falha silenciosa caso algum asset inicial não esteja imediatamente acessível
          console.warn('[SW] Falha ao pré-cachear assets estáticos iniciais:', err)
        })
      })
      .then(() => self.skipWaiting()),
  )
})

// Ativação: limpeza de versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Ignorar métodos não GET (POST, PUT, DELETE, PATCH)
  if (request.method !== 'GET') {
    return
  }

  // NUNCA cachear:
  // - Chamadas à API do PocketBase (/api/...)
  // - Requisições para autenticação, realtime, SSE ou admin
  // - Esquemas não HTTP(S) como chrome-extension://
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/_/') ||
    url.pathname.includes('/api/collections/') ||
    url.searchParams.has('token') ||
    request.headers.get('Authorization') ||
    !url.protocol.startsWith('http')
  ) {
    // Busca direto da rede (Network-Only)
    return
  }

  // Para navegação SPA (documentos HTML):
  // Network-first com fallback para o cache e index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const indexFallback = await caches.match('/index.html')
          if (indexFallback) return indexFallback
          return new Response('Sem conexão com a internet', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }),
    )
    return
  }

  // Para assets estáticos compilados do Vite (scripts, estilos, fontes, imagens):
  // Stale-While-Revalidate com prioridade de rede para arquivos externos
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.host === 'fonts.googleapis.com' ||
    url.host === 'fonts.gstatic.com'

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        // Se já temos em cache, retorna de imediato e atualiza em background;
        // caso contrário aguarda a rede
        return cachedResponse || fetchPromise
      }),
    )
    return
  }

  // Para todo o restante que não é asset estático: Network-first
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse
      })
      .catch(async () => {
        return caches.match(request)
      }),
  )
})
