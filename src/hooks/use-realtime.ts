import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

export interface UseRealtimeOptions {
  /** Se false, desativa a subscription. Padrão: true */
  enabled?: boolean
  /** Debounce em milissegundos para agrupar múltiplos eventos em rajada. Padrão: 350ms */
  debounceMs?: number
  /** Se fornecido, filtra apenas eventos da empresa atual (evita re-render por eventos de outras empresas) */
  empresaId?: string
}

/**
 * Hook para subscrições em tempo real resilientes com PocketBase.
 *
 * Melhorias de estabilidade:
 * 1. Backoff exponencial silencioso em caso de queda temporária ou falha de conexão SSE
 * 2. Debounce inteligente das notificações recebidas para evitar re-render/refetch em rajadas
 * 3. Cancelamento e limpeza segura do listener sem colisão entre componentes
 * 4. Não causa piscares nem loops de renderização na interface
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabledOrOptions: boolean | UseRealtimeOptions = true,
) {
  const options: UseRealtimeOptions =
    typeof enabledOrOptions === 'boolean' ? { enabled: enabledOrOptions } : enabledOrOptions

  const { enabled = true, debounceMs = 350, empresaId } = options

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPendingDataRef = useRef<RecordSubscription<TRecord> | null>(null)

  useEffect(() => {
    if (!enabled) return

    let isDisposed = false
    let unsubscribeFn: (() => Promise<void>) | undefined
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0

    const emitDebounced = (data: RecordSubscription<TRecord>) => {
      // Se configurado empresaId, descarta eventos que comprovadamente pertençam a outra empresa
      if (empresaId && (data.record as any)?.empresa_id) {
        if ((data.record as any).empresa_id !== empresaId) {
          return
        }
      }

      lastPendingDataRef.current = data
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        if (!isDisposed && lastPendingDataRef.current) {
          try {
            callbackRef.current(lastPendingDataRef.current)
          } catch (err) {
            console.error(
              `[useRealtime] Erro ao executar callback da coleção "${collectionName}":`,
              err,
            )
          }
        }
      }, debounceMs)
    }

    const connectSubscription = () => {
      if (isDisposed) return

      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          if (!isDisposed) {
            emitDebounced(e)
          }
        })
        .then((fn) => {
          if (isDisposed) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            retryAttempt = 0 // Conexão estabelecida com sucesso
          }
        })
        .catch((err) => {
          if (isDisposed) return

          // Falha de conexão inicial ou reconexão SSE: retry silencioso com backoff exponencial
          retryAttempt = Math.min(retryAttempt + 1, 5)
          const delay = Math.min(1000 * Math.pow(2, retryAttempt), 15000)

          console.warn(
            `[useRealtime] Subscription silenciosa falhou para "${collectionName}". Tentando novamente em ${delay}ms...`,
            err?.message || err,
          )

          reconnectTimeout = setTimeout(() => {
            if (!isDisposed) {
              connectSubscription()
            }
          }, delay)
        })
    }

    connectSubscription()

    return () => {
      isDisposed = true

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }

      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
        unsubscribeFn = undefined
      }
    }
  }, [collectionName, enabled, debounceMs, empresaId])
}

export default useRealtime
