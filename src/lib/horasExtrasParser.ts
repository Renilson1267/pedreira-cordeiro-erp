/**
 * Utilitários para parsing, conversão e formatação de horas extras.
 * Permite digitação tanto em formato hora:minuto ("07:30", "7:30", "7h30", "07h30min")
 * quanto decimal ("7,5", "7.5", "7,5h"), normalizando internamente para decimal (number)
 * compatível com o banco de dados e cálculos existentes da CLT.
 */

export interface HorasParseResult {
  /** Se a string informada é válida ou vazia */
  valido: boolean
  /** Valor decimal normalizado (ex: 7.5 para 7h30min). null se vazio ou inválido. */
  decimal: number | null
  /** Horas inteiras apuradas */
  horas: number
  /** Minutos inteiros apurados (0-59) */
  minutos: number
  /** Formato detectado na digitação */
  tipoDetectado: 'vazio' | 'hora_minuto' | 'decimal' | 'invalido'
  /** String formatada no padrão hora:minuto (ex: "07:30") */
  horaMinutoFormatado: string
  /** String formatada no padrão decimal com 2 casas (ex: "7,50h") */
  decimalFormatado: string
  /** Equivalente em tempo real para exibir ao lado do campo (ex: "07:30 = 7,50h" ou "7,50h = 07:30") */
  equivalenciaRealTime: string
  /** Mensagem de erro amigável se inválido */
  mensagemErro?: string
}

/**
 * Converte um valor numérico decimal em horas e minutos inteiros.
 * Ex: 7.5 -> { horas: 7, minutos: 30 }
 * Ex: 7.25 -> { horas: 7, minutos: 15 }
 * Ex: 7.3333 -> { horas: 7, minutos: 20 }
 */
export function decimalParaHorasMinutos(decimal: number | undefined | null): {
  horas: number
  minutos: number
} {
  if (decimal === undefined || decimal === null || isNaN(decimal) || decimal <= 0) {
    return { horas: 0, minutos: 0 }
  }
  const decPositivo = Math.max(0, decimal)
  const horas = Math.floor(decPositivo)
  const fracao = decPositivo - horas
  const minutos = Math.round(fracao * 60)
  if (minutos >= 60) {
    return { horas: horas + 1, minutos: 0 }
  }
  return { horas, minutos }
}

/**
 * Converte horas e minutos inteiros em valor decimal com até 4 casas (arredondado pra 2 casas em cálculo padrão).
 * Ex: (7, 30) -> 7.5
 * Ex: (7, 15) -> 7.25
 * Ex: (7, 45) -> 7.75
 */
export function horasMinutosParaDecimal(horas: number, minutos: number): number {
  const h = Math.max(0, Math.floor(horas || 0))
  const m = Math.max(0, Math.min(59, Math.round(minutos || 0)))
  const dec = h + m / 60
  return Number(dec.toFixed(4))
}

/**
 * Formata um valor numérico decimal no padrão "HH:MM" (ex: 7.5 -> "07:30", 0 -> "00:00").
 */
export function formatarHoraMinuto(decimal: number | undefined | null): string {
  if (decimal === undefined || decimal === null || isNaN(decimal) || decimal <= 0) {
    return '00:00'
  }
  const { horas, minutos } = decimalParaHorasMinutos(decimal)
  const hh = String(horas).padStart(2, '0')
  const mm = String(minutos).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Formata exibindo o decimal acompanhado do formato hora:minuto para conferência rápida.
 * Ex: 7.5 -> "7,50h (07:30)"
 * Ex: 12 -> "12,00h (12:00)"
 * Ex: 0 ou nulo -> "0,00h (00:00)"
 */
export function formatarHorasCombinado(
  decimal: number | undefined | null,
  opcoes?: { ocultarSeZero?: boolean; prefixo?: string },
): string {
  const num = typeof decimal === 'number' && !isNaN(decimal) ? decimal : 0
  if (num <= 0 && opcoes?.ocultarSeZero) {
    return '—'
  }
  const decStr = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const hmStr = formatarHoraMinuto(num)
  return `${decStr}h (${hmStr})`
}

/**
 * Normaliza e analisa qualquer entrada digitada pelo usuário no campo de horas extras.
 * Aceita:
 * - "07:30", "7:30", "7:3", "07:05"
 * - "7h30", "07h30", "7h30min", "7h 30m", "7 h 30 min", "7h"
 * - "7,5", "7.5", "7,50", "7.50", "7,5h", "7.5h"
 * - "0730" ou "730" (4 ou 3 dígitos sem separador, ex: 0730 = 07:30, 730 = 07:30)
 *
 * Retorna o resultado parseado com o decimal equivalente e mensagem de validação amigável.
 */
export function parseHorasExtrasInput(input: string | number | undefined | null): HorasParseResult {
  if (input === undefined || input === null) {
    return {
      valido: true,
      decimal: null,
      horas: 0,
      minutos: 0,
      tipoDetectado: 'vazio',
      horaMinutoFormatado: '',
      decimalFormatado: '',
      equivalenciaRealTime: '',
    }
  }

  // Se já for número
  if (typeof input === 'number') {
    if (isNaN(input) || input < 0) {
      return {
        valido: false,
        decimal: null,
        horas: 0,
        minutos: 0,
        tipoDetectado: 'invalido',
        horaMinutoFormatado: '',
        decimalFormatado: '',
        equivalenciaRealTime: '',
        mensagemErro: 'Valor numérico inválido.',
      }
    }
    const dec = Number(input.toFixed(4))
    const { horas, minutos } = decimalParaHorasMinutos(dec)
    const hmStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
    const decStr = `${dec.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
    return {
      valido: true,
      decimal: dec,
      horas,
      minutos,
      tipoDetectado: 'decimal',
      horaMinutoFormatado: hmStr,
      decimalFormatado: decStr,
      equivalenciaRealTime: `${decStr} = ${hmStr}`,
    }
  }

  const raw = String(input).trim()
  if (raw === '') {
    return {
      valido: true,
      decimal: null,
      horas: 0,
      minutos: 0,
      tipoDetectado: 'vazio',
      horaMinutoFormatado: '',
      decimalFormatado: '',
      equivalenciaRealTime: '',
    }
  }

  // Limpeza de sufixos de texto informativos (ex: "h", "min", "m", "hs", "hrs", "horas")
  const cleaned = raw.toLowerCase().replace(/\s+/g, ' ')

  // 1. Caso com ":" (ex: "07:30", "7:30", "7:5", "00:45")
  const matchDoisPontos = cleaned.match(/^(\d{1,3}):(\d{1,2})$/)
  if (matchDoisPontos) {
    const horas = parseInt(matchDoisPontos[1], 10)
    let minStr = matchDoisPontos[2]
    // se digitou "7:3" interpreta como 30 min se só tem 1 digito? Ou 3 min?
    // Em digitação de relógio, geralmente "7:5" ou "7:30". Se 1 dígito no final, se for 0..5 pode ser dezena (30),
    // mas o padrão estrito é padStart: se 1 digito '5' => 5 minutos ou se o usuário digitou "7:3" esperava 7:30?
    // Regra amigável: se 1 dígito (ex: "7:5"), 5 min. Para 30 min ele digita 30 ou 3. Tratamos 1 dígito como minutos (05).
    const minutos = parseInt(minStr.length === 1 ? minStr.padEnd(2, '0') : minStr, 10)
    if (minutos >= 60) {
      return {
        valido: false,
        decimal: null,
        horas,
        minutos,
        tipoDetectado: 'invalido',
        horaMinutoFormatado: '',
        decimalFormatado: '',
        equivalenciaRealTime: '',
        mensagemErro: 'Os minutos devem ser entre 00 e 59 (ex: 07:30).',
      }
    }
    const dec = horasMinutosParaDecimal(horas, minutos)
    const hmStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
    const decStr = `${dec.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
    return {
      valido: true,
      decimal: dec,
      horas,
      minutos,
      tipoDetectado: 'hora_minuto',
      horaMinutoFormatado: hmStr,
      decimalFormatado: decStr,
      equivalenciaRealTime: `${hmStr} = ${decStr}`,
    }
  }

  // 2. Caso com 'h' separador (ex: "07h30", "7h30", "7h30min", "7h 30m", "7h", "07h")
  const matchH = cleaned.match(
    /^(\d{1,3})\s*h(?:oras?)?(?:\s*[:.]?\s*(\d{1,2}))?(?:\s*(?:min|m)?)?$/,
  )
  if (matchH) {
    const horas = parseInt(matchH[1], 10)
    const minRaw = matchH[2]
    let minutos = 0
    if (minRaw !== undefined && minRaw !== '') {
      minutos = parseInt(minRaw.length === 1 ? minRaw.padEnd(2, '0') : minRaw, 10)
      if (minutos >= 60) {
        return {
          valido: false,
          decimal: null,
          horas,
          minutos,
          tipoDetectado: 'invalido',
          horaMinutoFormatado: '',
          decimalFormatado: '',
          equivalenciaRealTime: '',
          mensagemErro: 'Os minutos devem ser entre 00 e 59 (ex: 7h30).',
        }
      }
    }
    const dec = horasMinutosParaDecimal(horas, minutos)
    const hmStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
    const decStr = `${dec.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
    return {
      valido: true,
      decimal: dec,
      horas,
      minutos,
      tipoDetectado: 'hora_minuto',
      horaMinutoFormatado: hmStr,
      decimalFormatado: decStr,
      equivalenciaRealTime: `${hmStr} = ${decStr}`,
    }
  }

  // 3. Caso decimal com vírgula ou ponto (ex: "7,5", "7.5", "7,50", "7.5h", "12,25", "0,5")
  const matchDecimal = cleaned.match(/^(\d{1,3})[,.](\d{1,4})(?:\s*h(?:oras?)?)?$/)
  if (matchDecimal) {
    const inteira = parseInt(matchDecimal[1], 10)
    const fracionaria = matchDecimal[2]
    const dec = parseFloat(`${inteira}.${fracionaria}`)
    if (isNaN(dec)) {
      return {
        valido: false,
        decimal: null,
        horas: 0,
        minutos: 0,
        tipoDetectado: 'invalido',
        horaMinutoFormatado: '',
        decimalFormatado: '',
        equivalenciaRealTime: '',
        mensagemErro: 'Formato decimal inválido.',
      }
    }
    const decNormalizado = Number(dec.toFixed(4))
    const { horas, minutos } = decimalParaHorasMinutos(decNormalizado)
    const hmStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
    const decStr = `${decNormalizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
    return {
      valido: true,
      decimal: decNormalizado,
      horas,
      minutos,
      tipoDetectado: 'decimal',
      horaMinutoFormatado: hmStr,
      decimalFormatado: decStr,
      equivalenciaRealTime: `${decStr} = ${hmStr}`,
    }
  }

  // 4. Caso numérico puro sem pontuação:
  // - 1 ou 2 dígitos (ex: "7", "12") -> 7 horas exatas (decimal 7.0)
  // - 3 ou 4 dígitos (ex: "0730", "730", "1230", "0845") -> atalho comum de ponto eletrônico para HH:MM!
  const matchApenasDigitos = cleaned.match(/^(\d{1,4})(?:\s*h(?:oras?)?)?$/)
  if (matchApenasDigitos) {
    const digitos = matchApenasDigitos[1]
    if (digitos.length <= 2) {
      // Horas inteiras (ex: "7" -> 7,00h)
      const horas = parseInt(digitos, 10)
      const dec = Number(horas.toFixed(2))
      const hmStr = `${String(horas).padStart(2, '0')}:00`
      const decStr = `${dec.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
      return {
        valido: true,
        decimal: dec,
        horas,
        minutos: 0,
        tipoDetectado: 'decimal',
        horaMinutoFormatado: hmStr,
        decimalFormatado: decStr,
        equivalenciaRealTime: `${decStr} = ${hmStr}`,
      }
    } else {
      // 3 ou 4 dígitos: atalho amigável "0730" -> 07:30, "730" -> 07:30, "1245" -> 12:45
      const horas = parseInt(digitos.slice(0, -2), 10)
      const minutos = parseInt(digitos.slice(-2), 10)
      if (minutos >= 60) {
        return {
          valido: false,
          decimal: null,
          horas,
          minutos,
          tipoDetectado: 'invalido',
          horaMinutoFormatado: '',
          decimalFormatado: '',
          equivalenciaRealTime: '',
          mensagemErro: `Os dois últimos dígitos (${minutos}) indicam minutos e devem ser menores que 60.`,
        }
      }
      const dec = horasMinutosParaDecimal(horas, minutos)
      const hmStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
      const decStr = `${dec.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`
      return {
        valido: true,
        decimal: dec,
        horas,
        minutos,
        tipoDetectado: 'hora_minuto',
        horaMinutoFormatado: hmStr,
        decimalFormatado: decStr,
        equivalenciaRealTime: `${hmStr} = ${decStr}`,
      }
    }
  }

  return {
    valido: false,
    decimal: null,
    horas: 0,
    minutos: 0,
    tipoDetectado: 'invalido',
    horaMinutoFormatado: '',
    decimalFormatado: '',
    equivalenciaRealTime: '',
    mensagemErro: 'Formato não reconhecido. Use "07:30", "7h30", "7,5" ou "7.5".',
  }
}
