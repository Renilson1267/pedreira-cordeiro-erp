import * as XLSX from 'xlsx'

// Mapeamento completo de meses em português e inglês com abreviações
export const MESES_MAP: Record<string, number> = {
  JANEIRO: 1,
  JAN: 1,
  FEVEREIRO: 2,
  FEV: 2,
  MARCO: 3,
  MARÇO: 3,
  MAR: 3,
  ABRIL: 4,
  ABR: 4,
  MAIO: 5,
  MAI: 5,
  JUNHO: 6,
  JUN: 6,
  JULHO: 7,
  JUL: 7,
  AGOSTO: 8,
  AGO: 8,
  SETEMBRO: 9,
  SETEMB: 9,
  SETE: 9,
  SET: 9,
  SEPTEMBER: 9,
  SEP: 9,
  OUTUBRO: 10,
  OUTUB: 10,
  OUTU: 10,
  OUT: 10,
  OCTOBER: 10,
  OCT: 10,
  NOVEMBRO: 11,
  NOVEMB: 11,
  NOVE: 11,
  NOV: 11,
  NOVEMBER: 11,
  DEZEMBRO: 12,
  DEZEMB: 12,
  DEZE: 12,
  DEZ: 12,
  DECEMBER: 12,
  DEC: 12,
}

export const MESES_ENTRIES_ORDENADOS = Object.entries(MESES_MAP).sort(
  (a, b) => b[0].length - a[0].length,
)

export const MESES_INGLES_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

export const MESES_PT_MAP: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

export function normalizarNomeColuna(str: any): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/\u00A0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Infere mês e ano a partir do nome da aba.
 * Trata especificamente sufixos "_26" como 2026, folhas ".2", abas como "Planilha7" etc.
 */
export function inferirCompetenciaAba(sheetName: string): {
  ano: number
  mes: number
  sufixo: string
} {
  const currentYear = new Date().getFullYear()
  const raw = String(sheetName || '').trim()

  let sufixo = ''
  const sufixoMatch = raw.match(/(?:[._\-\s])(\d+)$/)
  if (sufixoMatch) {
    sufixo = `.${sufixoMatch[1]}`
  }

  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  let ano = 2026
  const ano4Match = norm.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/)
  if (ano4Match) {
    ano = parseInt(ano4Match[1], 10)
  } else {
    // Tratar sufixos _26 ou -26 ou 26 isolado
    const ano2Match = norm.match(/[_\s-](\d{2})(?:\.|$)/) || norm.match(/(?:^|[^0-9])(\d{2})$/)
    if (ano2Match) {
      const yy = parseInt(ano2Match[1], 10)
      ano = 2000 + yy
    } else {
      ano = currentYear >= 2020 && currentYear <= 2035 ? currentYear : 2026
    }
  }

  if (ano < 2020 || ano > 2035) {
    ano = 2026
  }

  let mes = 1
  let encontrouMes = false

  for (const [nomeMes, numMes] of MESES_ENTRIES_ORDENADOS) {
    const regex = new RegExp(`(?:^|[^A-Z0-9])${nomeMes}(?:[^A-Z0-9]|$)`, 'i')
    if (regex.test(norm)) {
      mes = numMes
      encontrouMes = true
      break
    }
  }

  if (!encontrouMes) {
    for (const [nomeMes, numMes] of MESES_ENTRIES_ORDENADOS) {
      if (norm.includes(nomeMes)) {
        mes = numMes
        encontrouMes = true
        break
      }
    }
  }

  if (!encontrouMes) {
    const numMesMatch =
      norm.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[-_])20\d{2}/) ||
      norm.match(/20\d{2}(?:[-_])(0?[1-9]|1[0-2])/)
    if (numMesMatch) {
      mes = parseInt(numMesMatch[1], 10)
      encontrouMes = true
    }
  }

  return { ano, mes, sufixo }
}

/**
 * Desdobra células mescladas preenchendo as dependentes com o valor da célula mestre.
 */
export function desdobrarCelulasMescladas(ws: XLSX.WorkSheet): void {
  if (!ws || !ws['!merges'] || !Array.isArray(ws['!merges']) || ws['!merges'].length === 0) {
    return
  }

  ws['!merges'].forEach((range: XLSX.Range) => {
    const startCellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c })
    const masterCell = ws[startCellAddress]
    if (!masterCell || masterCell.v === undefined || masterCell.v === null || masterCell.v === '') {
      return
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (r === range.s.r && c === range.s.c) continue

        const cellAddr = XLSX.utils.encode_cell({ r, c })
        if (
          !ws[cellAddr] ||
          ws[cellAddr].v === undefined ||
          ws[cellAddr].v === null ||
          ws[cellAddr].v === ''
        ) {
          ws[cellAddr] = {
            t: masterCell.t,
            v: masterCell.v,
            w: masterCell.w,
            z: masterCell.z,
          }
        }
      }
    }
  })
}

// Regex padronizadas para identificação de colunas em recebimentos
export const REGEX_COL_DATA =
  /^(?:DT\s*REC|DATA\s*REC|DT\s*VENC|DATA\s*VENC|RECEBIMENTO|VENCIMENTO|VENC|DATA|DT|DIA|PREVISAO|EMISSAO)\b|RECEB|LIQUID|PAGAM|VENC|DT\s*VENC|DATA\s*VENC|PREVISAO/i
export const REGEX_COL_CLIENTE =
  /CLIENTE|SACADO|DEVEDOR|NOME|DESTINATARIO|COMPRADOR|RAZAO\s*SOCIAL|FAVORECIDO|HISTORICO\s*CLIENTE/i
export const REGEX_COL_DESCRICAO =
  /HISTORICO|DESCRICAO|DESC|SERV|PROD|REFERENCIA|ITEM|DISCRIM|DETALHE|OBS/i
export const REGEX_COL_VALOR =
  /VALOR\s*RECEBIDO|VALOR\s*TOTAL|VALOR\s*A\s*RECEBER|VALOR\s*LIQUIDO|VALOR\s*BRUTO|VALOR\s*R\$?|VALOR\s*R|RECEBIDO|REALIZADO|PREVISTO|VALOR|TOTAL|LIQUIDO|BRUTO|R\$|CREDITO|CREDITOS|RECEITA|RECEITAS|ENTRADA|ENTRADAS/i
export const REGEX_COL_VALOR_RECEBIDO = /VALOR\s*RECEBIDO|RECEBIDO|REC|LIQUID|PAGO|VALOR\s*PAGO/i
export const REGEX_COL_DATA_RECEBIMENTO =
  /DT\s*REC|DATA\s*REC|RECEB|BAIXA|DATA\s*BAIXA|LIQUID|QUITAC/i
export const REGEX_COL_FORMA_RECEBIMENTO = /FORMA|MEIO|TIPO\s*RECEB|TIPO\s*PAG|FORMA\s*PAG/i
export const REGEX_COL_STATUS = /STATUS|SITUACAO|CONDICAO|ESTADO/i
export const REGEX_COL_CENTRO_CUSTO = /CENTRO|CC|CUSTO|FRENTE|SETOR/i
export const REGEX_COL_CATEGORIA = /CATEG|PLANO|CONTA|NATUREZA/i
export const REGEX_COL_DOCUMENTO = /DOC|NF|NOTA|DUPLICATA|FATURA|PEDIDO|RECIBO/i

/**
 * Detecta a linha de cabeçalho na matriz até ~50 linhas usando pontuação e heurística.
 */
export function detectarLinhaCabecalho(
  matrix: any[][],
  startRow: number = 0,
  maxScanCount: number = 50,
): number {
  if (!matrix || matrix.length === 0) return 1

  const sRow = Math.max(0, startRow)
  const maxScan = Math.min(matrix.length, sRow + maxScanCount)

  let bestRow = -1
  let bestScore = 0
  let bestHeaderCount = 0

  for (let r = sRow; r < maxScan; r++) {
    const row = matrix[r] || []
    if (!Array.isArray(row) || row.length === 0) continue

    const texts = row.map((cell) => normalizarNomeColuna(cell)).filter((t) => t.length > 0)
    if (texts.length < 2) continue

    const rowJoin = texts.join(' ')
    const isPureTitle =
      texts.length <= 2 &&
      (rowJoin.includes('RELATORIO') ||
        rowJoin.includes('CONSOLIDADO') ||
        rowJoin.includes('PEDREIRA') ||
        rowJoin.includes('EXTRATO'))
    if (isPureTitle) continue

    const hasData = texts.some(
      (t) =>
        t === 'DATA' ||
        t === 'DT' ||
        t === 'DIA' ||
        t === 'VENC' ||
        t === 'VENCIMENTO' ||
        t === 'RECEBIMENTO' ||
        t.includes('DATA') ||
        t.includes('VENC') ||
        t.includes('RECEB') ||
        t.includes('EMISS'),
    )
    const hasCli = texts.some(
      (t) =>
        t === 'CLIENTE' ||
        t === 'SACADO' ||
        t === 'NOME' ||
        t.includes('CLI') ||
        t.includes('SACAD') ||
        t.includes('DEVED') ||
        t.includes('DESTINAT') ||
        t.includes('CLIENTE'),
    )
    const hasVal = texts.some(
      (t) =>
        t === 'VALOR' ||
        t === 'VALOR R' ||
        t === 'VALOR R$' ||
        t === 'VALOR TOTAL' ||
        t === 'VALOR RECEBIDO' ||
        t === 'TOTAL' ||
        t === 'LIQUIDO' ||
        t === 'BRUTO' ||
        t === 'CREDITO' ||
        t === 'CREDITOS' ||
        t === 'RECEITA' ||
        t === 'RECEITAS' ||
        t === 'ENTRADA' ||
        t === 'ENTRADAS' ||
        t.includes('VALOR') ||
        t.includes('RECEB') ||
        t.includes('TOTAL') ||
        t.includes('CREDIT') ||
        t.includes('RECEIT') ||
        t.includes('ENTRAD'),
    )
    const hasDesc = texts.some(
      (t) =>
        t === 'DESCRICAO' ||
        t === 'HISTORICO' ||
        t.includes('HIST') ||
        t.includes('DESC') ||
        t.includes('REF') ||
        t.includes('DISCRIM') ||
        t.includes('PROD') ||
        t.includes('SERV'),
    )
    const hasDoc = texts.some((t) => t.includes('DOC') || t.includes('NF') || t.includes('NOTA'))
    const hasForma = texts.some(
      (t) => t.includes('FORMA') || t.includes('TIPO') || t.includes('PAG'),
    )
    const hasStatus = texts.some(
      (t) => t.includes('STATUS') || t.includes('SITUAC') || t.includes('COND'),
    )

    let score = 0
    let validHeaderCount = 0
    if (hasData) {
      score += 4
      validHeaderCount++
    }
    if (hasVal) {
      score += 4
      validHeaderCount++
    }
    if (hasCli) {
      score += 3
      validHeaderCount++
    }
    if (hasDesc) {
      score += 2
      validHeaderCount++
    }
    if (hasDoc) {
      score += 1
      validHeaderCount++
    }
    if (hasForma) {
      score += 1
      validHeaderCount++
    }
    if (hasStatus) {
      score += 1
      validHeaderCount++
    }

    if (
      rowJoin.startsWith('TOTAL') ||
      rowJoin.startsWith('SUBTOTAL') ||
      rowJoin.startsWith('SALDO')
    ) {
      score -= 5
    }

    if (score >= 4) {
      const isBetter =
        score > bestScore ||
        (score === bestScore &&
          (validHeaderCount > bestHeaderCount ||
            (validHeaderCount === bestHeaderCount &&
              texts.length > (matrix[bestRow - 1]?.length || 0))))

      if (isBetter) {
        bestScore = score
        bestHeaderCount = validHeaderCount
        bestRow = r + 1
      }
    }
  }

  if (bestRow > 0) {
    return bestRow
  }

  // Fallback
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const row = matrix[r] || []
    const filled = row.filter((c) => String(c ?? '').trim().length > 0)
    if (filled.length >= 2) return r + 1
  }

  return 1
}

/**
 * Converte valores monetários aceitando R$, pontuação brasileira/americana, parênteses contábeis etc.
 */
export function parseValorReceber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val)
  if (val === null || val === undefined || val === '') return 0

  const raw = String(val)
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!raw) return 0

  let str = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,+-]/g, '')
    .trim()

  if (!str) return 0

  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }

  const num = parseFloat(str)
  if (isNaN(num)) return 0
  return Math.abs(num)
}

/**
 * Parse robusto de datas evitando deslocamento de fuso (shift UTC vs local).
 */
export function parseDataReceber(val: any, anoFallback?: number, mesFallback?: number): string {
  const toUtcNoon = (y: number, m: number, d: number) => {
    const clampedDay = Math.min(31, Math.max(1, d))
    return new Date(Date.UTC(y, m - 1, clampedDay, 12, 0, 0)).toISOString()
  }

  if (val === null || val === undefined || val === '') {
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear()
      const m = val.getUTCMonth() + 1
      const d = val.getUTCDate()
      return toUtcNoon(y, m, d)
    }
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  if (typeof val === 'number') {
    if (!isNaN(val) && val > 0) {
      const ms = Math.round((val - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        return toUtcNoon(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      }
    }
  }

  const str = String(val).trim()
  if (!str) {
    if (anoFallback && mesFallback) {
      return toUtcNoon(anoFallback, mesFallback, 10)
    }
    const now = new Date()
    return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  }

  const textDateMatch = str.match(
    /^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/,
  )
  if (textDateMatch) {
    const rawMesNome = textDateMatch[1].toLowerCase()
    const mesNum = MESES_INGLES_MAP[rawMesNome] || MESES_PT_MAP[rawMesNome]
    if (mesNum) {
      const diaNum = parseInt(textDateMatch[2], 10)
      let anoNum = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : anoFallback || 2026
      if (anoNum < 100) anoNum += 2000
      return toUtcNoon(anoNum, mesNum, diaNum)
    }
  }

  if (/^\d{1,2}$/.test(str)) {
    const dia = parseInt(str, 10)
    if (dia >= 1 && dia <= 31) {
      const y = anoFallback || 2026
      const m = mesFallback || 1
      return toUtcNoon(y, m, dia)
    }
  }

  const brMatch = str.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/)
  if (brMatch) {
    const d = parseInt(brMatch[1], 10)
    const m = parseInt(brMatch[2], 10)
    let y = brMatch[3] ? parseInt(brMatch[3], 10) : anoFallback || 2026
    if (y < 100) y += 2000
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return toUtcNoon(y, m, d)
    }
  }

  const digits8Match = str.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (digits8Match) {
    const d = parseInt(digits8Match[1], 10)
    const m = parseInt(digits8Match[2], 10)
    const y = parseInt(digits8Match[3], 10)
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2035) {
      return toUtcNoon(y, m, d)
    }
  }

  const isoMatch = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    const d = parseInt(isoMatch[3], 10)
    if (m >= 1 && m <= 12) {
      return toUtcNoon(y, m, d)
    }
  }

  const ptExtensoMatch = str.match(/^(\d{1,2})\s*(?:de\s+)?([A-Za-zçÇ]+)(?:\s*(?:de\s+)?(\d{4}))?/i)
  if (ptExtensoMatch) {
    const d = parseInt(ptExtensoMatch[1], 10)
    const nomeMes = ptExtensoMatch[2].slice(0, 3).toLowerCase()
    const mesNum = MESES_PT_MAP[nomeMes] || MESES_INGLES_MAP[nomeMes]
    if (mesNum && d >= 1 && d <= 31) {
      const y = ptExtensoMatch[3] ? parseInt(ptExtensoMatch[3], 10) : anoFallback || 2026
      return toUtcNoon(y, mesNum, d)
    }
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str)
    const y = isIsoDateOnly ? parsed.getUTCFullYear() : parsed.getFullYear()
    const m = isIsoDateOnly ? parsed.getUTCMonth() + 1 : parsed.getMonth() + 1
    const d = isIsoDateOnly ? parsed.getUTCDate() : parsed.getDate()
    return toUtcNoon(y, m, d)
  }

  if (anoFallback && mesFallback) {
    return toUtcNoon(anoFallback, mesFallback, 1)
  }

  const now = new Date()
  return toUtcNoon(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}

/**
 * Tenta inferir a competência da aba Planilha7 a partir das células de datas.
 */
export function inferirMesPorDatasDaPlanilha(
  matrix: any[][],
  headerRow: number,
  anoFallback: number = 2026,
): { ano: number; mes: number } | null {
  if (!matrix || matrix.length <= headerRow) return null

  const dataRows = matrix.slice(headerRow)
  const contagemMeses: Record<number, number> = {}

  for (let r = 0; r < Math.min(dataRows.length, 60); r++) {
    const row = dataRows[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell === null || cell === undefined || cell === '') continue
      if (cell instanceof Date && !isNaN(cell.getTime())) {
        const m = cell.getUTCMonth() + 1
        contagemMeses[m] = (contagemMeses[m] || 0) + 1
      } else if (typeof cell === 'number' && cell > 35000 && cell < 55000) {
        const ms = Math.round((cell - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) {
          const m = d.getUTCMonth() + 1
          contagemMeses[m] = (contagemMeses[m] || 0) + 1
        }
      } else if (typeof cell === 'string') {
        const brMatch = cell.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
        if (brMatch) {
          const m = parseInt(brMatch[2], 10)
          if (m >= 1 && m <= 12) {
            contagemMeses[m] = (contagemMeses[m] || 0) + 1
          }
        }
      }
    }
  }

  let melhorMes = 0
  let maiorContagem = 0
  for (const [mStr, count] of Object.entries(contagemMeses)) {
    const m = parseInt(mStr, 10)
    if (count > maiorContagem) {
      maiorContagem = count
      melhorMes = m
    }
  }

  if (melhorMes > 0 && maiorContagem >= 2) {
    return { ano: anoFallback, mes: melhorMes }
  }

  return null
}

/**
 * Extrai cidade/endereço e número de nota/documento a partir de descrições típicas da planilha de recebimentos,
 * como "Recebimento [cliente] - [cidade] Doc [num]", "Recebimento [cliente] - [cidade] [Doc: num]" etc.
 */
export function extrairCidadeENota(descricao: string | null | undefined): {
  cidade: string
  nota: string
} {
  if (!descricao || typeof descricao !== 'string') {
    return { cidade: '', nota: '' }
  }

  const desc = descricao.trim()
  if (!desc) {
    return { cidade: '', nota: '' }
  }

  let nota = ''
  let cidade = ''

  // 1. Extração da Nota / Documento
  // Padrões com colchetes: [Doc: 90566], [Doc: NF9436/91679 A 92219], [NF: 1234]
  const bracketDocMatch = desc.match(/\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*([^\]]+)\]/i)
  if (bracketDocMatch && bracketDocMatch[1].trim()) {
    nota = bracketDocMatch[1].trim()
  } else {
    // Padrão inline com "Doc" / "NF" / "NF-e" seguido pelo número até o fim ou antes de colchetes
    const inlineDocMatch = desc.match(
      /\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+([A-Z0-9/\s\-–]+)$/i,
    )
    if (inlineDocMatch && inlineDocMatch[1].trim()) {
      nota = inlineDocMatch[1].trim().replace(/\s+$/, '')
    } else {
      // Padrão com dígitos no final após traço ou "Doc": ex "... - 90566" ou "... Doc 90566"
      const endDigitsMatch = desc.match(/(?:Doc|NF|\s[-–])\s*(\d{3,8}(?:\s*[/\-A]\s*\d{3,8})*)$/i)
      if (endDigitsMatch && endDigitsMatch[1].trim()) {
        nota = endDigitsMatch[1].trim()
      }
    }
  }

  // 2. Extração da Cidade / Endereço
  // Remove a parte do documento para isolar o trecho do cliente e cidade
  let textWithoutDoc = desc
    .replace(/\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*[^\]]+\]/gi, '')
    .replace(/\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+.*$/i, '')
    .trim()

  // Se houver " - " separando partes:
  // ex: "Recebimento ELDORADO PRE MOLDADO - PATOS - SANTANDER"
  // ex: "Recebimento ADRIANO HELIO DE BRITO - SJE - BRADESCO"
  // ex: "Recebimento WALBER DE ALMEIDA - DESTERRO"
  // ex: "Recebimento KERLY CONSTRUÇÕES/ADRIANO - VISTA SERRANA- SANTADER"
  // ex: "Recebimento ECO FORTE - SÃO JOSE DO BONFIM - SANTANDER"
  if (textWithoutDoc.includes('-') || textWithoutDoc.includes('–')) {
    // Normalizar separadores com espaço ao redor para facilitar split
    const parts = textWithoutDoc
      .replace(/[-–]/g, ' - ')
      .split(/\s+-\s+/)
      .map((p) => p.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      // Remover termos de banco/forma do final se houver (ex: SANTANDER, BRADESCO, BANCO, PIX, BOLETO)
      const bancosOuFormas =
        /^(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|NUBANK|INTER|PIX|BOLETO|TED|DOC|CHEQUE)$/i

      // A cidade normalmente é a parte entre o cliente e o banco, ou a última parte após o cliente
      let candidateParts = parts.slice(1) // ignora a primeira parte que contém "Recebimento [cliente]"
      // Se a última parte for banco, retira
      if (
        candidateParts.length > 1 &&
        bancosOuFormas.test(candidateParts[candidateParts.length - 1])
      ) {
        candidateParts.pop()
      }

      if (candidateParts.length > 0) {
        let cand = candidateParts[candidateParts.length - 1]
        // Se ainda tiver um banco grudado no final (ex "VISTA SERRANA- SANTADER" que foi splitado)
        cand = cand
          .replace(
            /\b(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|PIX|BOLETO)\b/gi,
            '',
          )
          .trim()
        if (cand && cand.length >= 2 && !/^\d+$/.test(cand)) {
          cidade = cand
        }
      }
    }
  }

  // Normalizar nota removendo prefixo "Doc: " redundante se existir
  if (nota) {
    nota = nota.replace(/^(?:Doc|NF|NF-e|NFe|Nota)[\s.:#-]+/i, '').trim()
  }

  return { cidade, nota }
}
