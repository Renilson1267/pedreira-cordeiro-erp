/**
 * Helper para lidar com requisições com Rate Limit (HTTP 429 Too Many Requests)
 * no PocketBase / Skip Cloud e espaçamento preventivo de requisições.
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

/**
 * Aguarda um determinado tempo em milissegundos.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Identifica se um erro lançado por chamada PocketBase ou fetch é rate limit (429).
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any
  if (anyErr?.status === 429 || anyErr?.statusCode === 429) return true
  if (anyErr?.response?.status === 429) return true
  const msg = String(anyErr?.message || anyErr?.data?.message || anyErr || '').toLowerCase()
  if (msg.includes('too many requests') || msg.includes('429') || msg.includes('rate limit')) {
    return true
  }
  return false
}

/**
 * Executa uma operação assíncrona com retry e backoff exponencial em caso de erro 429 (Too Many Requests).
 * Se esgotar as tentativas ou for outro tipo de erro irrecuperável, repassa a exceção.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 6, initialDelayMs = 800, maxDelayMs = 8000, onRetry } = options

  let attempt = 0
  let currentDelay = initialDelayMs

  while (true) {
    try {
      return await fn()
    } catch (err: unknown) {
      if (isRateLimitError(err) && attempt < maxRetries) {
        attempt += 1
        // Jitter leve (+/- 10%) para evitar rajadas simultâneas de clientes sincronizados
        const jitter = (Math.random() * 0.2 - 0.1) * currentDelay
        const actualDelay = Math.min(maxDelayMs, Math.max(300, Math.round(currentDelay + jitter)))

        if (onRetry) {
          onRetry(attempt, actualDelay, err)
        }

        await sleep(actualDelay)
        currentDelay = Math.min(maxDelayMs, currentDelay * 2)
        continue
      }

      if (isRateLimitError(err) && attempt >= maxRetries) {
        const errorMsg =
          'Limite de requisições do servidor atingido (429 Too Many Requests). O número máximo de tentativas foi excedido; tente novamente mais tarde.'
        throw new Error(errorMsg)
      }

      throw err
    }
  }
}
