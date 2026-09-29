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

/**
 * Converte valor numérico decimal em horas e minutos ("HH:MM").
 * Ex: 7.5 -> "07:30"
 */
export function formatHoursTime(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value <= 0) {
    return '00:00'
  }
  const pos = Math.max(0, value)
  const h = Math.floor(pos)
  const m = Math.round((pos - h) * 60)
  const totalH = m >= 60 ? h + 1 : h
  const finalM = m >= 60 ? 0 : m
  return `${String(totalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
}

/**
 * Formata exibindo o decimal com o equivalente em hora:minuto junto.
 * Ex: 7.5 -> "7,50h (07:30)"
 */
export function formatHoursWithTime(
  value: number | undefined | null,
  opcoes?: { ocultarSeZero?: boolean },
): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0
  if (num <= 0 && opcoes?.ocultarSeZero) {
    return '—'
  }
  const hStr = formatHours(num, true)
  const tStr = formatHoursTime(num)
  return `${hStr} (${tStr})`
}
