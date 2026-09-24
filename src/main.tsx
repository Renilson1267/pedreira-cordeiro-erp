/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// Registro silencioso do Service Worker para suporte a PWA (Progressive Web App)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Verifica atualizações do service worker em background
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão instalada em segundo plano
                console.log('[PWA] Nova versão do app disponível.')
              }
            })
          }
        })
      })
      .catch((_err) => {
        // Falha silenciosa: garante que o sistema funcione normalmente mesmo se o SW falhar
      })
  })
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
