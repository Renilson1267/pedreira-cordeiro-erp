import { useEffect, useState } from 'react'

/**
 * Hook para atrasar a propagação de um valor em atualizações frequentes
 * (útil para campos de busca, autocompletes e filtros pesados).
 *
 * @param value Valor a ser debounced
 * @param delay Tempo em milissegundos (padrão 280ms)
 */
export function useDebounce<T>(value: T, delay: number = 280): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
