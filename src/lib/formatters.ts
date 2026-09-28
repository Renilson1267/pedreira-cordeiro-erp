export function formatCurrency(value: number | undefined | null): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  } catch {
    return '-'
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('pt-BR')
  } catch {
    return '-'
  }
}

export function toInputDate(dateString: string | undefined | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function getInitials(name: string | undefined | null): string {
  if (!name) return 'NG'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Formata quantidade de horas com 2 dígitos decimais no padrão brasileiro (ex: "7,35h" ou "15,50h").
 */
export function formatHours(value: number | undefined | null, includeUnit = true): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0
  const formatted = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return includeUnit ? `${formatted}h` : formatted
}
