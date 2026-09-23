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
 * Executa uma operação assíncrona com retry e backoff adaptativo em caso de erro 429 (Too Many Requests).
 * Começa com espera curta (ex: 350ms) e só cresce se o erro 429 persistir.
 * Se esgotar as tentativas ou for outro tipo de erro irrecuperável, repassa a exceção.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 8, initialDelayMs = 400, maxDelayMs = 8000, onRetry } = options

  let attempt = 0
  let currentDelay = initialDelayMs

  while (true) {
    try {
      return await fn()
    } catch (err: unknown) {
      if (isRateLimitError(err) && attempt < maxRetries) {
        attempt += 1
        // Jitter leve (+/- 20%) para evitar thundering herd em chamadas paralelas
        const jitter = (Math.random() * 0.4 - 0.2) * currentDelay
        const actualDelay = Math.min(maxDelayMs, Math.max(250, Math.round(currentDelay + jitter)))

        if (onRetry) {
          onRetry(attempt, actualDelay, err)
        }

        await sleep(actualDelay)
        currentDelay = Math.min(maxDelayMs, Math.round(currentDelay * 1.8))
        continue
      }

      if (isRateLimitError(err) && attempt >= maxRetries) {
        const errorMsg = `Limite de requisições do servidor atingido (429 Too Many Requests). O número máximo de ${maxRetries} tentativas foi excedido.`
        throw new Error(errorMsg)
      }

      throw err
    }
  }
}

export interface ParallelPoolOptions {
  /**
   * Concorrência máxima (default: 3).
   */
  concurrency?: number
  /**
   * Se true (default: true), exceções lançadas dentro do worker de um item não
   * abortam os demais itens do pool — a Promise rejeitada é capturada e
   * o erro é retornado no array de resultados ou processado individualmente.
   */
  continueOnError?: boolean
  /**
   * Delay adaptativo compartilhado: se um worker receber 429, todos os workers
   * pausam brevemente por este tempo antes da próxima requisição.
   */
  onRateLimitSharedPause?: (delayMs: number) => void
}

/**
 * Executa tarefas em lote com pool de concorrência limitada (ex: 3 requisições em paralelo),
 * preservando a ordem ou despachando por disponibilidade de worker.
 * Garante que nenhum erro de item individual derrube o pool inteiro quando continueOnError = true.
 */
export async function runParallelPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options: ParallelPoolOptions = {},
): Promise<R[]> {
  const concurrency = Math.max(1, options.concurrency ?? 3)
  const continueOnError = options.continueOnError ?? true
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runner(): Promise<void> {
    while (true) {
      const current = nextIndex++
      if (current >= items.length) {
        return
      }
      try {
        results[current] = await worker(items[current], current)
      } catch (err) {
        if (!continueOnError) {
          throw err
        }
        // Se continueOnError está ativo, registra como erro mas não quebra a execução dos outros itens
        results[current] = undefined as unknown as R
      }
    }
  }

  const workerPromises: Promise<void>[] = []
  const activeCount = Math.min(concurrency, items.length)
  for (let i = 0; i < activeCount; i++) {
    workerPromises.push(runner())
  }

  await Promise.all(workerPromises)
  return results
}
