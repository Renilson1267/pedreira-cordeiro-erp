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

    // Regra: Células mescladas propagam APENAS dentro do bloco visual mesclado
    // Se a mesclagem for vertical excessiva (ex: cobrindo a coluna inteira da aba com 100+ linhas),
    // não propaga arbitrariamente para evitar falsas datas idênticas em toda a planilha.
    const alturaMesclagem = range.e.r - range.s.r + 1
    if (alturaMesclagem > 60) {
      // Mesclagem acidental de coluna inteira — ignora preenchimento automático em massa
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
  /^(?:DATA\s*DE\s*VENCIMENTO|DATA\s*VENCIMENTO|DATA\s*VENC|DT\s*VENC|VENCIMENTO|VENC|DATA\s*DA\s*COMPRA|DATA\s*COMPRA|DATA|DT|DIA|PREVISAO|EMISSAO)\b|VENCIMENTO|DATA\s*VENC|DT\s*VENC|VENC/i
export const REGEX_COL_CLIENTE =
  /CLIENTE|SACADO|DEVEDOR|NOME|DESTINATARIO|COMPRADOR|RAZAO\s*SOCIAL|FAVORECIDO|HISTORICO\s*CLIENTE/i
export const REGEX_COL_DESCRICAO =
  /HISTORICO|DESCRICAO|DESC|SERV|PROD|REFERENCIA|ITEM|DISCRIM|DETALHE|OBS/i
export const REGEX_COL_VALOR =
  /^(?:VALOR\s*DA\s*COMPRA|VALOR\s*TOTAL|VALOR\s*BRUTO|VALOR\s*LIQUIDO|VALOR\s*A\s*RECEBER|VALOR\s*R\$?|VALOR\s*R|VALOR|TOTAL|LIQUIDO|BRUTO|CREDITO|CREDITOS|RECEITA|RECEITAS|ENTRADA|ENTRADAS)$/i
export const REGEX_COL_VALOR_RECEBIDO =
  /^(?:VALOR\s*RECEBIDO|VALOR\s*PAGO|VALOR\s*LIQUID|RECEBIDO|REC|LIQUID|PAGO)$/i
export const REGEX_COL_DATA_RECEBIMENTO =
  /DATA\s*(?:DE\s*)?PAG(?:AMENTO)?|DT\s*(?:DE\s*)?PAG(?:AMENTO)?|DATA\s*PAG|DT\s*PAG|DT\s*REC|DATA\s*REC|RECEBIMENTO|RECEB|BAIXA|DATA\s*BAIXA|LIQUID|QUITAC/i
export const REGEX_COL_FORMA_RECEBIMENTO =
  /TIPO\s*DE\s*PAGAMENTO|FORMA\s*DE\s*PAGAMENTO|TIPO\s*PAGAMENTO|FORMA\s*PAGAMENTO|FORMA|MEIO|TIPO\s*RECEB|TIPO\s*PAG|FORMA\s*PAG/i
export const REGEX_COL_STATUS = /SITUACAO|STATUS|SITUAC|CONDICAO|ESTADO/i
export const REGEX_COL_CENTRO_CUSTO = /CENTRO|CC|CUSTO|FRENTE|SETOR/i
export const REGEX_COL_CATEGORIA = /CATEG|PLANO|CONTA|NATUREZA/i
export const REGEX_COL_DOCUMENTO = /DOC|NF|NOTA|DUPLICATA|FATURA|PEDIDO|RECIBO/i
export const REGEX_COL_PARCELA = /PARCELA|PARC|N[ºO°]?\s*(?:DE\s*)?PARCELA/i
export const REGEX_COL_TELEFONE_OU_DOC =
  /TEL|TELEFONE|FONE|CELULAR|WHATS|CONTATO|CPF|CNPJ|INSCRIC|CHAVE/i

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

export const VALOR_MAXIMO_RECEBIMENTO = 2_000_000 // R$ 2 milhões para título individual de pedreira
export const LIMIAR_VALOR_SUSPEITO_RECEBER = 100_000 // Valores >= 100k exigem validação rigorosa no ERP de pedreira

/**
 * Detecta se um número ou string numérica corresponde a um número de cheque ou série bancária
 * e NÃO a um valor financeiro de título:
 * 1) Números inteiros na faixa de cheques do banco (800.000 a 865.000, ex: 850xxx, 851xxx, 852xxx, 855xxx)
 * 2) Números inteiros de 5 ou 6 dígitos que formam padrões de data compacta (DDMMAA / DMMAA)
 *    frequentemente lidos de colunas de compensação/data de compensação de cheque
 *    (ex: 120226 = 12/02/26, 250226 = 25/02/26, 70226, 80126, 200126, 131125, 41225)
 */
export function isNumeroChequeOuSerieBancaria(val: any): { ehCheque: boolean; motivo?: string } {
  if (val === null || val === undefined) return { ehCheque: false }

  let numVal: number
  let isInt = false

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return { ehCheque: false }
    numVal = Math.abs(val)
    isInt = Number.isInteger(numVal)
  } else {
    const raw = String(val)
      .replace(/\u00A0/g, ' ')
      .replace(/R\$/gi, '')
      .replace(/\s+/g, '')
      .trim()
    if (!raw) return { ehCheque: false }

    const parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    if (isNaN(parsed)) return { ehCheque: false }
    numVal = Math.abs(parsed)
    isInt = Number.isInteger(numVal) || Math.abs(numVal - Math.round(numVal)) < 0.001
  }

  // 1. Faixa explícita de série de talão de cheques do banco: 800.000 a 865.000
  // Padrão identificado: 850xxx, 851xxx, 852xxx, 855xxx
  if (numVal >= 800_000 && numVal <= 865_000) {
    return {
      ehCheque: true,
      motivo: `Número ${Math.round(numVal)} pertence à série de cheques do banco (faixa 800.000–865.000)`,
    }
  }

  // 2. Números inteiros de 5 a 6 dígitos que representam datas compactas de compensação de cheque
  // Ex: 120226 (12/02/26), 250226 (25/02/26), 70226 (07/02/26), 80126 (08/01/26), 200126 (20/01/26), 131125 (13/11/25)
  if (isInt && numVal >= 40_000 && numVal <= 311_228) {
    const s = String(Math.round(numVal))
    // Padrão DDMMAA (6 dígitos: DD 01..31, MM 01..12, AA 24..28)
    if (s.length === 6) {
      const d = parseInt(s.slice(0, 2), 10)
      const m = parseInt(s.slice(2, 4), 10)
      const y = parseInt(s.slice(4, 6), 10)
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 24 && y <= 28) {
        return {
          ehCheque: true,
          motivo: `Número inteiro ${s} representa data de compensação de cheque (formato ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/20${y})`,
        }
      }
    }
    // Padrão DMMAA (5 dígitos: D 1..9, MM 01..12, AA 24..28)
    if (s.length === 5) {
      const d = parseInt(s.slice(0, 1), 10)
      const m = parseInt(s.slice(1, 3), 10)
      const y = parseInt(s.slice(3, 5), 10)
      if (d >= 1 && d <= 9 && m >= 1 && m <= 12 && y >= 24 && y <= 28) {
        return {
          ehCheque: true,
          motivo: `Número inteiro ${s} representa data de compensação de cheque (formato 0${d}/${m.toString().padStart(2, '0')}/20${y})`,
        }
      }
    }
  }

  return { ehCheque: false }
}

/**
 * Valida se um número representa um valor monetário plausível no ERP da pedreira.
 * Rejeita valores acima de 2.000.000, números de cheque/série bancária e NaN/Infinity.
 */
export function isValorPlausivel(num: number | null | undefined): boolean {
  if (num === null || num === undefined || typeof num !== 'number') return false
  if (isNaN(num) || !isFinite(num)) return false
  if (num <= 0 || num > VALOR_MAXIMO_RECEBIMENTO) return false
  if (isNumeroChequeOuSerieBancaria(num).ehCheque) return false
  return true
}

export interface ParseValorResult {
  valor: number
  invalidoOuAbsurdo: boolean
  motivo?: string
}

/**
 * Converte e valida valores monetários aceitando R$, pontuação brasileira/americana,
 * parênteses contábeis etc.
 * Rejeita explicitamente:
 * 1) Números inteiros sem separador decimal com 10 ou mais dígitos (típicos números de telefone/celular com DDD, CNPJs, códigos de barras/boletos)
 * 2) Valores individuais que ultrapassam a barreira de R$ 2.000.000 em recebimento de pedra (viram divergência cadastral)
 */
/**
 * Verifica se um valor bruto corresponde ao formato/conteúdo de número de parcela
 * (número entre 0 e 12 com exatamente 1 casa decimal, ex: "1.1", "2.2", "1,1", "2,2").
 */
export function isPadraoNumeroParcela(val: any): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return false
    // Se for número com 1 casa decimal entre 0.5 e 24 (ex: 1.1, 2.2, 1.10, 2.20)
    if (val >= 0.5 && val <= 24 && !Number.isInteger(val)) {
      const arredondado1Casa = Math.round(val * 10) / 10
      if (Math.abs(val - arredondado1Casa) < 1e-6 && !Number.isInteger(arredondado1Casa)) {
        return true
      }
    }
    return false
  }
  const str = String(val)
    .replace(/\u00A0/g, ' ')
    .replace(/R\$/gi, '')
    .trim()
  if (!str) return false

  // Detecta padrões textuais de parcela: N.N, N.NN, N,N, N,NN, N/N, N-N, N.N.N (ex: "1.1", "2.2", "1.10", "2.20", "1/3", "01/10", "1.1.1")
  if (/^(?:[0-9]|1[0-9]|2[0-4])[.,/\\-](?:[0-9]|1[0-9]|2[0-4])(?:[.,/\\-]\d+)?$/.test(str)) {
    return true
  }

  // Detecta "1.1", "1,1", "1.10", "1,10", "2.2", "2,2", "2.20", "2,20"
  const matchDec = str.match(/^([0-9]|1[0-9]|2[0-4])[.,](\d{1,2})$/)
  if (matchDec) {
    const p1 = parseInt(matchDec[1], 10)
    const p2Str = matchDec[2]
    // Se a segunda parte for d (ex: 1) ou d0 (ex: 10), equivale a 1.1 ou 1.10
    const num = parseFloat(`${p1}.${p2Str}`)
    if (num >= 0.5 && num <= 24 && !Number.isInteger(num)) {
      // Rejeita valores que são claramente parcelas quando p2 for um dígito ou p2Str terminar em 0 com valor equivalente a 1 casa
      const arredondado = Math.round(num * 10) / 10
      if (Math.abs(num - arredondado) < 1e-6) {
        return true
      }
    }
  }

  // Strings com prefixo ou sufixo explícito de parcela: ex: "PARC 1", "P 1/3", "1ª"
  if (/^(?:PARC(?:ELA)?\.?|P\.?)\s*\d+/i.test(str)) {
    return true
  }

  return false
}

export function parseValorReceberDetalhado(val: any): ParseValorResult {
  if (val === null || val === undefined || val === '') {
    return { valor: 0, invalidoOuAbsurdo: false }
  }

  // Barreira anti-parcela prévia sobre o dado bruto (número ou texto)
  if (isPadraoNumeroParcela(val)) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo: `Número de parcela ("${val}") lido como valor monetário (padrão anti-parcela X.Y)`,
    }
  }

  // Se já for número
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      return { valor: 0, invalidoOuAbsurdo: false }
    }
    const absVal = Math.abs(val)
    if (absVal === 0) return { valor: 0, invalidoOuAbsurdo: false }

    // Números inteiros enormes sem casas decimais são telefones ou documentos
    if (absVal > VALOR_MAXIMO_RECEBIMENTO) {
      return {
        valor: 0,
        invalidoOuAbsurdo: true,
        motivo: `Valor de R$ ${absVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassa o limite individual de R$ 2.000.000 (divergência cadastral)`,
      }
    }

    // Barreira anti-cheque / série bancária / datas de compensação
    const chequeNumCheck = isNumeroChequeOuSerieBancaria(absVal)
    if (chequeNumCheck.ehCheque) {
      return {
        valor: 0,
        invalidoOuAbsurdo: true,
        motivo:
          chequeNumCheck.motivo ||
          `Número ${absVal} lido como valor, mas pertence à série de cheques/compensação`,
      }
    }

    // Se tiver 10+ dígitos inteiros
    if (Number.isInteger(absVal) && absVal >= 10_000_000_000) {
      return {
        valor: 0,
        invalidoOuAbsurdo: true,
        motivo: `Número de 11+ dígitos lido como valor monetário (${absVal})`,
      }
    }

    // Barreira anti-parcela sobre valor numérico
    if (isPadraoNumeroParcela(absVal)) {
      return {
        valor: 0,
        invalidoOuAbsurdo: true,
        motivo: `Número de parcela (${absVal}) lido como valor monetário (padrão anti-parcela X.Y)`,
      }
    }

    return { valor: absVal, invalidoOuAbsurdo: false }
  }

  const raw = String(val)
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!raw) return { valor: 0, invalidoOuAbsurdo: false }

  // Rejeitar strings puramente de telefone (ex: (83) 99999-9999, 83999999999, 99999-9999)
  const apenasDigitosStr = raw.replace(/\D/g, '')
  const temParentesesDDD = /\(\d{2}\)/.test(raw)
  const temTracoTelefone = /\d{4,5}-\d{4}/.test(raw)
  if (temParentesesDDD || temTracoTelefone) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo: `Telefone/celular ("${raw}") não é um valor monetário válido`,
    }
  }

  // Se for apenas dígitos sem separador e tiver 10 ou mais dígitos (ex: 101454102275, 9303494463)
  if (/^\d{10,}$/.test(raw.replace(/\s+/g, ''))) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo: `Número de ${apenasDigitosStr.length} dígitos contínuos sem separador decimal ("${raw}") tratado como telefone/documento`,
    }
  }

  let str = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,+-]/g, '')
    .trim()

  if (!str) return { valor: 0, invalidoOuAbsurdo: false }

  // Parse estrito PT-BR / US respeitando pontos de milhar e vírgula decimal
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Padrão brasileiro: "1.234.567,89" -> pontos são milhar, vírgula é decimal
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // Padrão americano: "1,234,567.89" -> vírgulas são milhar, ponto é decimal
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: padrão PT-BR ("1234,56") -> vira decimal
    str = str.replace(',', '.')
  } else if (str.includes('.')) {
    // Apenas ponto: pode ser decimal "1234.56" ou ponto de milhar PT-BR sem decimais "1.234"
    const parts = str.split('.')
    if (parts.length > 2) {
      // Múltiplos pontos ("1.234.567"): claramente separador de milhar brasileiro
      str = str.replace(/\./g, '')
    } else if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0], 10) > 0) {
      // Um único ponto com exatamente 3 dígitos depois ("1.234"): se for número inteiro sem vírgula, avaliar milhar
      // Mas para evitar ambiguidade se for valor monetário sem vírgula, mantemos decimal padrão a menos que venha formatado
    }
  }

  const num = parseFloat(str)
  if (isNaN(num)) return { valor: 0, invalidoOuAbsurdo: false }

  const absNum = Math.abs(num)
  if (absNum === 0) return { valor: 0, invalidoOuAbsurdo: false }

  // Barreira anti-cheque / série bancária / datas de compensação
  const chequeStrCheck = isNumeroChequeOuSerieBancaria(absNum)
  if (chequeStrCheck.ehCheque) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo:
        chequeStrCheck.motivo ||
        `Número ${absNum} lido como valor, mas pertence à série de cheques/compensação`,
    }
  }

  // Barreira anti-parcela sobre o número resultante do parse
  if (isPadraoNumeroParcela(absNum)) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo: `Número de parcela (${absNum}) lido como valor monetário (padrão anti-parcela X.Y)`,
    }
  }

  // Barreira de R$ 2 milhões para título individual de pedreira
  if (absNum > VALOR_MAXIMO_RECEBIMENTO) {
    return {
      valor: 0,
      invalidoOuAbsurdo: true,
      motivo: `Valor de R$ ${absNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} excede o limite máximo plausível de R$ 2.000.000 para recebimento individual (divergência cadastral)`,
    }
  }

  // Arredondar para no máximo 2 casas decimais
  const rounded = Math.round(absNum * 100) / 100
  return { valor: rounded, invalidoOuAbsurdo: false }
}

/**
 * Converte valores monetários aceitando R$, pontuação brasileira/americana, parênteses contábeis etc.
 * Retorna 0 se o valor for nulo ou se for detectado número implausível (> 50M ou telefone).
 */
export function parseValorReceber(val: any): number {
  return parseValorReceberDetalhado(val).valor
}

/**
 * Parse robusto de datas evitando deslocamento de fuso (shift UTC vs local).
 */
/**
 * Valida se um ano e data calculados pertencem a um intervalo sanitário plausível (2024 a 2028).
 */
export function isAnoDataSanitario(ano: number, anoCompetencia?: number): boolean {
  if (isNaN(ano) || ano < 2024 || ano > 2028) {
    return false
  }
  if (anoCompetencia && anoCompetencia >= 2024 && anoCompetencia <= 2028) {
    // Tolerância em torno da competência da aba (ex.: até 1 ano antes/depois)
    if (Math.abs(ano - anoCompetencia) > 2) {
      return false
    }
  }
  return true
}

/**
 * Valida se uma string ISO representa uma data sanitária.
 */
export function isIsoDataSanitaria(
  isoString: string | null | undefined,
  anoCompetencia?: number,
): boolean {
  if (!isoString || typeof isoString !== 'string') return false
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return false
  const ano = parseInt(match[1], 10)
  return isAnoDataSanitario(ano, anoCompetencia)
}

/**
 * Parse robusto de datas evitando deslocamento de fuso (shift UTC vs local)
 * e com barreira sanitária estrita de ano (2024–2028).
 */
export function parseDataReceber(val: any, anoFallback?: number, mesFallback?: number): string {
  const fallbackYear =
    anoFallback && anoFallback >= 2024 && anoFallback <= 2028 ? anoFallback : 2026
  const fallbackMonth = mesFallback && mesFallback >= 1 && mesFallback <= 12 ? mesFallback : 1

  const toUtcNoon = (y: number, m: number, d: number) => {
    // Barreira sanitária de ano
    let safeYear = y
    if (!isAnoDataSanitario(safeYear, fallbackYear)) {
      safeYear = fallbackYear
    }
    const safeMonth = Math.min(12, Math.max(1, m))
    const clampedDay = Math.min(31, Math.max(1, d))
    return new Date(Date.UTC(safeYear, safeMonth - 1, clampedDay, 12, 0, 0)).toISOString()
  }

  if (val === null || val === undefined || val === '') {
    return ''
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear()
      const m = val.getUTCMonth() + 1
      const d = val.getUTCDate()
      return toUtcNoon(y, m, d)
    }
    return ''
  }

  if (typeof val === 'number') {
    // Número serial Excel (ex: 46265)
    // Limite sanitário para número serial: ~45000 a 47000 (anos 2023 a 2028)
    if (!isNaN(val) && val > 0) {
      const ms = Math.round((val - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear()
        if (isAnoDataSanitario(y, fallbackYear)) {
          return toUtcNoon(y, d.getUTCMonth() + 1, d.getUTCDate())
        }
      }
    }
  }

  const str = String(val).trim()
  if (!str) {
    return ''
  }

  const textDateMatch = str.match(
    /^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/,
  )
  if (textDateMatch) {
    const rawMesNome = textDateMatch[1].toLowerCase()
    const mesNum = MESES_INGLES_MAP[rawMesNome] || MESES_PT_MAP[rawMesNome]
    if (mesNum) {
      const diaNum = parseInt(textDateMatch[2], 10)
      let anoNum = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : fallbackYear
      if (anoNum < 100) anoNum += 2000
      return toUtcNoon(anoNum, mesNum, diaNum)
    }
  }

  // Proibido interpretar número avulso puro como dia do mês sem contexto explícito de coluna de data
  if (/^\d{1,2}$/.test(str)) {
    const dia = parseInt(str, 10)
    // Se for dia do mês entre 1 e 31, aceita apenas se for número sanitário com mês/ano de fallback
    if (dia >= 1 && dia <= 31 && fallbackMonth && fallbackYear) {
      return toUtcNoon(fallbackYear, fallbackMonth, dia)
    }
    return ''
  }

  const brMatch = str.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/)
  if (brMatch) {
    const d = parseInt(brMatch[1], 10)
    const m = parseInt(brMatch[2], 10)
    let y = brMatch[3] ? parseInt(brMatch[3], 10) : fallbackYear
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
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && isAnoDataSanitario(y, fallbackYear)) {
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
      const y = ptExtensoMatch[3] ? parseInt(ptExtensoMatch[3], 10) : fallbackYear
      return toUtcNoon(y, mesNum, d)
    }
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str)
    const y = isIsoDateOnly ? parsed.getUTCFullYear() : parsed.getFullYear()
    const m = isIsoDateOnly ? parsed.getUTCMonth() + 1 : parsed.getMonth() + 1
    const d = isIsoDateOnly ? parsed.getUTCDate() : parsed.getDate()
    if (isAnoDataSanitario(y, fallbackYear)) {
      return toUtcNoon(y, m, d)
    }
  }

  return ''
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
/**
 * Normaliza string removendo acentos, pontuação e convertendo para maiúsculas
 */
export function normalizarTextoStatus(str: any): string {
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
 * Varre TODAS as células de uma linha da planilha (mesmo fora da coluna mapeada de status,
 * lidando com mesclagens e deslocamentos) e detecta se há indicador explícito de quitação,
 * aberto ou parcial.
 *
 * Termos de quitação priorizados:
 * "JA PAGA", "JA PAGO", "JÁ PAGA", "JÁ PAGO", "PAGO", "PAGA", "RECEBIDO", "RECEBIDA",
 * "QUITADO", "QUITADA", "LIQUIDADO", "LIQUIDADA", "BAIXADO", "BAIXADA".
 *
 * Termos de aberto: "CONTA VENCIDA", "VENCIDA", "VENCIDO", "ABERTA", "ABERTO", "EM ABERTO",
 * "PROXIMO DE VENCER", "A RECEBER", "PENDENTE", "NAO PAGO", "NAO RECEBIDO".
 *
 * Termos de parcial: "PARCIAL", "PAGO PARCIAL", "PAGA PARCIAL", "PARCIALMENTE PAGO".
 */
export function detectarStatusNaLinha(
  row: any[] | null | undefined,
  fallbackStatusColVal?: any,
): {
  statusPriorizado: 'Recebida' | 'Aberta' | 'Parcial' | 'Recebimento Antecipado' | null
  termoDetectado: string
  fonte: 'celula_linha' | 'coluna_mapeada' | 'nenhuma'
} {
  const celulas: any[] = []
  if (Array.isArray(row)) {
    celulas.push(...row)
  }
  if (fallbackStatusColVal !== undefined && fallbackStatusColVal !== null) {
    celulas.push(fallbackStatusColVal)
  }

  // 1ª PASSAGEM: Varredura de Quitação Explícita ("JÁ PAGA", "PAGO", "QUITADO", etc.)
  // Tem prioridade máxima sobre qualquer valor zero/vazio de valor pago
  for (const c of celulas) {
    if (c === null || c === undefined) continue
    if (typeof c === 'number' || c instanceof Date) continue
    const norm = normalizarTextoStatus(c)
    if (!norm) continue

    // Ignorar negações tipo "NAO PAGO", "NAO RECEBIDO", "NAO QUITADO"
    const isNegacao =
      norm === 'NAO PAGO' ||
      norm === 'NAO PAGA' ||
      norm === 'NAO RECEBIDO' ||
      norm === 'NAO RECEBIDA' ||
      norm.includes('NAO PAG') ||
      norm.includes('NAO RECEB') ||
      norm.includes('NAO QUIT')
    if (isNegacao) continue

    // Já Paga / Já Pago
    const isJaPaga =
      norm === 'JA PAGA' ||
      norm === 'JA PAGO' ||
      norm.startsWith('JA PAG') ||
      norm.includes('JA PAGA') ||
      norm.includes('JA PAGO')

    // Outros termos de quitação explícita
    const isQuitada =
      isJaPaga ||
      norm === 'RECEBIDA' ||
      norm === 'RECEBIDO' ||
      norm === 'PAGO' ||
      norm === 'PAGA' ||
      norm === 'QUITADO' ||
      norm === 'QUITADA' ||
      norm === 'LIQUIDADO' ||
      norm === 'LIQUIDADA' ||
      norm === 'BAIXADO' ||
      norm === 'BAIXADA' ||
      /\b(?:JA\s*PAG[OA]S?|RECEBID[OA]S?|PAG[OA]S?|QUITAD[OA]S?|LIQUIDAD[OA]S?|BAIXAD[OA]S?)\b/.test(
        norm,
      )

    if (isQuitada) {
      return {
        statusPriorizado: 'Recebida',
        termoDetectado: norm,
        fonte: 'celula_linha',
      }
    }
  }

  // 2ª PASSAGEM: Parcial ("PARCIAL", "PAGO PARCIAL", etc.)
  for (const c of celulas) {
    if (c === null || c === undefined) continue
    if (typeof c === 'number' || c instanceof Date) continue
    const norm = normalizarTextoStatus(c)
    if (!norm) continue

    if (
      norm === 'PARCIAL' ||
      norm === 'PAGO PARCIAL' ||
      norm === 'PAGA PARCIAL' ||
      norm === 'PARCIALMENTE PAGO' ||
      norm === 'PARCIALMENTE PAGA' ||
      norm === 'RECEBIDO PARCIAL' ||
      norm === 'RECEBIDA PARCIAL' ||
      /\bPARCIAL(?:MENTE)?\b/.test(norm)
    ) {
      return {
        statusPriorizado: 'Parcial',
        termoDetectado: norm,
        fonte: 'celula_linha',
      }
    }
  }

  // 3ª PASSAGEM: Adiantamento / Antecipado
  for (const c of celulas) {
    if (c === null || c === undefined) continue
    if (typeof c === 'number' || c instanceof Date) continue
    const norm = normalizarTextoStatus(c)
    if (!norm) continue

    if (
      norm === 'RECEBIMENTO ANTECIPADO' ||
      norm === 'ANTECIPADO' ||
      norm === 'ADIANTAMENTO' ||
      norm.includes('ANTECIP') ||
      norm.includes('ADIANT')
    ) {
      return {
        statusPriorizado: 'Recebimento Antecipado',
        termoDetectado: norm,
        fonte: 'celula_linha',
      }
    }
  }

  // 4ª PASSAGEM: Aberta / Conta Vencida / Pendente
  for (const c of celulas) {
    if (c === null || c === undefined) continue
    if (typeof c === 'number' || c instanceof Date) continue
    const norm = normalizarTextoStatus(c)
    if (!norm) continue

    const isAberta =
      norm === 'CONTA VENCIDA' ||
      norm.startsWith('CONTA VENCID') ||
      norm.includes('CONTA VENCID') ||
      norm === 'VENCIDA' ||
      norm === 'VENCIDO' ||
      norm === 'ABERTA' ||
      norm === 'ABERTO' ||
      norm === 'EM ABERTO' ||
      norm === 'PROXIMO DE VENCER' ||
      norm === 'PROXIMO A VENCER' ||
      norm === 'PROXIMA DE VENCER' ||
      norm === 'PROXIMA A VENCER' ||
      norm === 'A VENCER' ||
      norm === 'A RECEBER' ||
      norm === 'PENDENTE' ||
      norm === 'PENDENTES' ||
      norm === 'NAO PAGO' ||
      norm === 'NAO PAGA' ||
      norm.includes('NAO PAG') ||
      norm.includes('NAO RECEB')
    if (isAberta) {
      return {
        statusPriorizado: 'Aberta',
        termoDetectado: norm,
        fonte: 'celula_linha',
      }
    }
  }

  return {
    statusPriorizado: null,
    termoDetectado: '',
    fonte: 'nenhuma',
  }
}

/**
 * Classifica a linha de recebimento conforme a coluna de situação/status, varredura de linha e valores:
 * - Se a linha da planilha contiver (em qualquer célula da linha ou na coluna de status) "JA PAGA", "JA PAGO",
 *   "RECEBIDO", "RECEBIDA", "PAGO", "PAGA", "QUITADO", "QUITADA", "LIQUIDADO", "LIQUIDADA", "BAIXADO", "BAIXADA":
 *   priorizar 'Recebida' com valor_recebido = valor previsto (caso valor pago venha zerado/vazio).
 * - "CONTA VENCIDA" e termos de aberto continuam -> "Aberta".
 * - "PARCIAL" -> "Parcial".
 * - O fallback "Aberta" (valor pago vazio) só vale quando NENHUM indicador de quitação existir na linha inteira.
 */
/**
 * Sanitiza nome de cliente removendo traços, hífens, barras e espaços no final
 * (ex.: "GAMARRA CONSTRUTORA E LOCADORA LTDA -" -> "GAMARRA CONSTRUTORA E LOCADORA LTDA").
 */
export function sanitizarNomeCliente(nome: string | null | undefined): string {
  if (!nome || typeof nome !== 'string') return ''
  let s = nome.trim()
  // Remove repetidamente hífens, meias-riscas, travessões, barras e espaços no fim
  s = s.replace(/[\s\-_–—/\\|:]+$/g, '').trim()
  return s
}

export function classificarStatusRecebimento(params: {
  rawStatus?: string | null
  row?: any[] | null
  descFinal?: string | null
  valorPrevisto: number
  valorRecebido: number
  temColunaValorRecebido: boolean
  temColunaDataRecebimento: boolean
  rawDataRecebimentoValida: boolean
  classificacaoPadrao?: 'auto' | 'Recebida' | 'Aberta' | 'Recebimento Antecipado'
}): {
  status: 'Recebida' | 'Aberta' | 'Parcial' | 'Recebimento Antecipado'
  valorEfetivoRecebido: number
  situacaoExplicitamenteAberta: boolean
} {
  const {
    rawStatus,
    row,
    descFinal = '',
    valorPrevisto,
    valorRecebido,
    temColunaValorRecebido,
    temColunaDataRecebimento,
    rawDataRecebimentoValida,
    classificacaoPadrao = 'auto',
  } = params

  if (classificacaoPadrao === 'Recebida') {
    const valEfetivo = valorRecebido > 0 ? valorRecebido : valorPrevisto
    return {
      status: 'Recebida',
      valorEfetivoRecebido: valEfetivo,
      situacaoExplicitamenteAberta: false,
    }
  }
  if (classificacaoPadrao === 'Aberta') {
    return { status: 'Aberta', valorEfetivoRecebido: 0, situacaoExplicitamenteAberta: true }
  }
  if (classificacaoPadrao === 'Recebimento Antecipado') {
    return {
      status: 'Recebimento Antecipado',
      valorEfetivoRecebido: valorPrevisto,
      situacaoExplicitamenteAberta: false,
    }
  }

  // 1. Detecção profunda na linha inteira (varre todas as células da linha + coluna de status)
  // A situação "Já paga", "Quitado", "Recebida" tem precedência INCONDICIONAL sobre qualquer
  // valor zero/vazio de coluna de valor pago ou valor previsto.
  const deteccaoLinha = detectarStatusNaLinha(row, rawStatus)

  if (deteccaoLinha.statusPriorizado === 'Recebida') {
    // Se valorRecebido for positivo, usa ele; se valorPrevisto for positivo, usa ele;
    // ou se ambos forem vazios/zero mas um deles vier depois, garante o maior valor positivo
    const valEfetivo = valorRecebido > 0 ? valorRecebido : valorPrevisto
    return {
      status: 'Recebida',
      valorEfetivoRecebido: valEfetivo,
      situacaoExplicitamenteAberta: false,
    }
  }

  if (deteccaoLinha.statusPriorizado === 'Aberta') {
    return {
      status: 'Aberta',
      valorEfetivoRecebido: 0,
      situacaoExplicitamenteAberta: true,
    }
  }

  if (deteccaoLinha.statusPriorizado === 'Parcial') {
    const valEfetivo = valorRecebido > 0 ? valorRecebido : 0
    return {
      status: 'Parcial',
      valorEfetivoRecebido: valEfetivo,
      situacaoExplicitamenteAberta: false,
    }
  }

  if (deteccaoLinha.statusPriorizado === 'Recebimento Antecipado') {
    return {
      status: 'Recebimento Antecipado',
      valorEfetivoRecebido: valorPrevisto,
      situacaoExplicitamenteAberta: false,
    }
  }

  const normStatus = normalizarTextoStatus(rawStatus)
  const normDesc = normalizarTextoStatus(descFinal)

  // 2. Checagem de Adiantamento / Recebimento Antecipado na descrição
  const isAntecipado =
    normDesc.includes('ANTECIP') ||
    normDesc.includes('ADIANT') ||
    normDesc.includes('DEPOSITO') ||
    normDesc.includes('CREDITO')

  if (isAntecipado) {
    return {
      status: 'Recebimento Antecipado',
      valorEfetivoRecebido: valorPrevisto,
      situacaoExplicitamenteAberta: false,
    }
  }

  // 3. Sem indicador na linha inteira:
  // Aplicar heurística de valores (apenas quando NENHUM indicador de quitação existir na linha inteira)
  if (temColunaValorRecebido) {
    if (valorRecebido <= 0.009) {
      return {
        status: 'Aberta',
        valorEfetivoRecebido: 0,
        situacaoExplicitamenteAberta: false,
      }
    }
    if (valorRecebido >= valorPrevisto - 0.009) {
      return {
        status: 'Recebida',
        valorEfetivoRecebido: valorRecebido,
        situacaoExplicitamenteAberta: false,
      }
    }
    // Recebimento parcial com situação vazia
    return {
      status: 'Parcial',
      valorEfetivoRecebido: valorRecebido,
      situacaoExplicitamenteAberta: false,
    }
  }

  if (temColunaDataRecebimento && rawDataRecebimentoValida) {
    const valEfetivo = valorRecebido > 0 ? valorRecebido : valorPrevisto
    return {
      status: 'Recebida',
      valorEfetivoRecebido: valEfetivo,
      situacaoExplicitamenteAberta: false,
    }
  }

  // Título previsto sem quitação na linha entra como 'Aberta'
  return {
    status: 'Aberta',
    valorEfetivoRecebido: 0,
    situacaoExplicitamenteAberta: false,
  }
}

/**
 * Normaliza e mapeia o valor da coluna "TIPO DE PAGAMENTO" ou "FORMA" da planilha
 * para os valores aceitos no select do schema de Contas a Receber:
 * 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' (fallback: 'Pix')
 */
export function normalizarFormaRecebimento(
  forma: string | null | undefined,
  descricaoFallback: string = '',
): 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência' {
  const normForma = normalizarTextoStatus(forma)
  const normDesc = normalizarTextoStatus(descricaoFallback)

  // 1. Depósito / Transferência / TED / DOC (com ou sem menção a banco, ex.: "DEPOSITO BRAD", "DEPOSITO BRADESCO")
  if (
    normForma.includes('DEPOSITO') ||
    normForma.includes('DEPOS') ||
    normForma.includes('TRANSF') ||
    normForma.includes('TED') ||
    normForma.includes('DOC') ||
    normDesc.includes('TRANSF') ||
    normDesc.includes('TED') ||
    normDesc.includes('DOC') ||
    normDesc.includes('DEPOSITO') ||
    normDesc.includes('DEPOS')
  ) {
    return 'Transferência'
  }

  // 2. Boleto
  if (
    normForma.includes('BOLETO') ||
    normForma.includes('BOL') ||
    normDesc.includes('BOLETO') ||
    normDesc.includes('BOL')
  ) {
    return 'Boleto'
  }

  // 3. Pix
  if (normForma.includes('PIX') || normForma.includes('CHAVE') || normDesc.includes('PIX')) {
    return 'Pix'
  }

  // 4. Cartão (Débito/Crédito)
  if (
    normForma.includes('CART') ||
    normForma.includes('DEBITO') ||
    normForma.includes('CREDITO') ||
    normDesc.includes('CARTAO') ||
    normDesc.includes('DEBITO')
  ) {
    return 'Cartão'
  }

  // 5. Dinheiro / Espécie
  if (
    normForma.includes('DINHEIRO') ||
    normForma.includes('ESPECIE') ||
    normForma.includes('CASH') ||
    normDesc.includes('DINHEIRO') ||
    normDesc.includes('ESPECIE')
  ) {
    return 'Dinheiro'
  }

  // 6. Menção a bancos na forma ou descrição (Santander, Bradesco, etc.) sem depósito/transf costumam ser boletos/cobrança bancária
  if (
    normForma.includes('SANTANDER') ||
    normForma.includes('BRADESCO') ||
    normForma.includes('BRAD') ||
    normForma.includes('BANCO') ||
    normDesc.includes('SANTANDER') ||
    normDesc.includes('BRADESCO') ||
    normDesc.includes('BRAD')
  ) {
    return 'Boleto'
  }
  // Padrão do ERP da pedreira
  return 'Pix'
}

// Lista de cidades/municípios conhecidos da região da pedreira para extração confiável
export const CIDADES_CONHECIDAS_PEDREIRA = [
  'CACIMBAS DE DESTERRO',
  'SÃO JOSE DO BONFIM',
  'SÃO JOSÉ DO BONFIM',
  'SÃO JOSE DE ESPINHARAS',
  'SÃO JOSÉ DE ESPINHARAS',
  'SÃO JOSE CAIANA',
  'SÃO JOSÉ CAIANA',
  'SÃO SEBASTIÃO CAÇIMBAS',
  'SÃO SEBASTIAO CACIMBAS',
  'SANTA TEREZINHA',
  'SANTANA DOS GARROTES',
  'VISTA SERRANA',
  "OLHO D'AGUA",
  'OLHO DAGUA',
  'NOVA OLINDA',
  'PATOS',
  'TEIXEIRA',
  'COREMAS',
  'ITAPORANGA',
  'PIANCO',
  'PIANCÓ',
  'DESTERRO',
  'LAGOINHA',
  'MALTA',
  'PASSAGEM',
  'IMACULADA',
  'IGARACY',
  'AGUIAR',
  'EMAS',
  'SJE',
  'CONDADO',
  'CATURITE',
  'POMBAL',
  'SOUSA',
  'JUAZEIRINHO',
  'CAAPORA',
]

/**
 * Valida se uma string é um documento/número fiscal legítimo (ex: "90569", "86716 A 91585", "NF 1234", "90559 a 93000", "87205/91484").
 * Rejeita textos livres explicativos como "PAGAMENTO DE BRITA", "ADIANTAMENTO", "VENDA DE BRITADOR" etc.
 */
export function isNotaValida(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()
  if (!trimmed) return false

  // Se tiver palavras-chave de texto descritivo livre, NÃO é nota fiscal
  const textoLivre =
    /PAGAMENTO|BRITA|ADIANTAMENTO|VENDA|SERVIÇO|SERVICO|VIGILANCIA|VIGILÂNCIA|BRITADOR|MENSALIDADE|VALE|ABASTECIMENTO|DIARIA|PEDREIRA/i
  if (textoLivre.test(trimmed)) {
    return false
  }

  // Uma nota/documento fiscal precisa conter pelo menos um dígito
  if (!/\d/.test(trimmed)) {
    return false
  }

  // Padrão aceito: dígitos com barras, hífens, letras 'A'/'a' indicando intervalo, ou prefixos NF/NFe/Doc
  // Aceita prefixo com separador opcional (ex.: "NF9482/90570 A 92", "NF-1234", "DOC 5543", "90569")
  const docPattern =
    /^(?:(?:NF|NF-e|NFe|Nota|Doc|Duplicata|Fatura|Ch|Cheque)[\s.:#-]*|)[\d\s/\-–Aa,.&]+$/i
  return docPattern.test(trimmed)
}

/**
 * Extrai cidade e número de nota a partir da descrição ou texto consolidado da linha da planilha.
 * Regras:
 * - Nota só aceita conteúdo numérico/documento fiscal (rejeita texto livre como "PAGAMENTO DE BRITA").
 * - Cidade/endereço nunca engole nomes entre parênteses (ex: "(JOSE VIEIRA DE SOUSA)", "(C PINHEIROS & CIA LTDA)").
 * - Parênteses com nome de cliente ou empresa NÃO são cidades; na dúvida, deixa endereço vazio.
 */
export function extrairCidadeENota(descricao: string | null | undefined): {
  cidade: string
  nota: string
  textoLivreObservacao?: string
} {
  if (!descricao || typeof descricao !== 'string') {
    return { cidade: '', nota: '' }
  }

  const desc = descricao.trim()
  if (!desc) {
    return { cidade: '', nota: '' }
  }

  let rawNotaCandidate = ''
  let textoLivreObservacao = ''

  // 1. Extração da Nota / Documento
  // Padrões com colchetes: [Doc: 90566], [Doc: NF9436/91679 A 92219], [NF: 1234]
  const bracketDocMatch = desc.match(/\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*([^\]]+)\]/i)
  if (bracketDocMatch && bracketDocMatch[1].trim()) {
    rawNotaCandidate = bracketDocMatch[1].trim()
  } else {
    // Padrão inline com "Doc" / "NF" / "NF-e" seguido pelo número até o fim ou antes de colchetes
    const inlineDocMatch = desc.match(
      /\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+([A-Z0-9/\s\-–]+?)(?:\s+às?\s+|\s*\[|$)/i,
    )
    if (inlineDocMatch && inlineDocMatch[1].trim()) {
      rawNotaCandidate = inlineDocMatch[1].trim().replace(/\s+$/, '')
    } else {
      // Padrão com dígitos no final após traço ou "Doc": ex "... - 90566" ou "... Doc 90566"
      const endDigitsMatch = desc.match(/(?:Doc|NF|\s[-–])\s*(\d{3,8}(?:\s*[/\-A]\s*\d{3,8})*)$/i)
      if (endDigitsMatch && endDigitsMatch[1].trim()) {
        rawNotaCandidate = endDigitsMatch[1].trim()
      }
    }
  }

  // Normalizar nota removendo prefixo "Doc: " se existir (com separador opcional para NF/Doc)
  if (rawNotaCandidate) {
    rawNotaCandidate = rawNotaCandidate.replace(/^(?:Doc|NF|NF-e|NFe|Nota)[\s.:#-]*/i, '').trim()
  }

  // Validar se o candidato a nota é documento fiscal ou texto livre
  let nota = ''
  if (isNotaValida(rawNotaCandidate)) {
    nota = rawNotaCandidate
  } else if (rawNotaCandidate) {
    // Se era texto descritivo como "PAGAMENTO DE BRITA", vira observação e nota fica vazia
    textoLivreObservacao = rawNotaCandidate
  }

  // 2. Extração da Cidade / Endereço
  // Remover qualquer trecho entre colchetes [Doc: ...] ou inline Doc/NF
  let textWithoutDoc = desc
    .replace(/\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*[^\]]+\]/gi, '')
    .replace(/\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+.*$/i, '')
    .trim()

  // REGRA ESTRITA DE PARÊNTESES:
  // Parênteses contendo nome de cliente, sócios, razão social ou apelidos (ex: "(JOSE VIEIRA DE SOUSA)",
  // "(C PINHEIROS & CIA LTDA)", "(SUNCITY EMPREENDIMENTOS)", "JOSE HENRIUE AMORIM DE SOUZA)")
  // NUNCA devem ser capturados como endereço/cidade.
  // Removemos qualquer conteúdo entre parênteses e caracteres de parênteses soltos antes de procurar a cidade.
  const textoSemParenteses = textWithoutDoc
    .replace(/\(.*?\)/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let cidade = ''

  // Verificar se alguma cidade conhecida da região ocorre no texto
  const upperSemParenteses = textoSemParenteses.toUpperCase()
  for (const cid of CIDADES_CONHECIDAS_PEDREIRA) {
    // Procura por palavra inteira correspondente à cidade
    const regexCidade = new RegExp(`(?:^|[\\s\\-_/])${cid}(?:$|[\\s\\-_/])`, 'i')
    if (regexCidade.test(upperSemParenteses)) {
      cidade = cid
      break
    }
  }

  // Se não encontrou cidade conhecida da lista, tentar analisar padrão de partes separadas por hífen
  if (!cidade && (textoSemParenteses.includes('-') || textoSemParenteses.includes('–'))) {
    const parts = textoSemParenteses
      .replace(/[-–]/g, ' - ')
      .split(/\s+-\s+/)
      .map((p) => p.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      const bancosOuFormas =
        /^(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|NUBANK|INTER|PIX|BOLETO|TED|DOC|CHEQUE)$/i

      let candidateParts = parts.slice(1)
      if (
        candidateParts.length > 1 &&
        bancosOuFormas.test(candidateParts[candidateParts.length - 1])
      ) {
        candidateParts.pop()
      }

      if (candidateParts.length > 0) {
        let cand = candidateParts[candidateParts.length - 1]
        cand = cand
          .replace(
            /\b(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|PIX|BOLETO)\b/gi,
            '',
          )
          .trim()

        // Barreira sanitária de cidade: não pode ser número, nem nome próprio longo (> 35 chars ou 4+ palavras)
        const candWords = cand.split(/\s+/).filter(Boolean)
        const pareceNomeProprio =
          candWords.length >= 4 || /\b(?:LTDA|ME|EPP|EIRELI|S\/A|CIA)\b/i.test(cand)
        if (cand && cand.length >= 2 && !/^\d+$/.test(cand) && !pareceNomeProprio) {
          cidade = cand
        }
      }
    }
  }

  return { cidade, nota, textoLivreObservacao }
}

/**
 * Extrai números de nota/documento de observações legadas ou textos livres
 * (ex.: "Obs: NF9551/94824", "Doc: 94825", "NF9493/93194 A NF9505/94669", "90486 A 90549").
 * Retorna uma lista de strings de documentos candidatos limpos.
 */
export function extrairDocumentosDeObservacao(observacoes: string | null | undefined): string[] {
  if (!observacoes || typeof observacoes !== 'string') return []
  const obs = observacoes.trim()
  if (!obs) return []

  const resultados = new Set<string>()

  // Padrões explícitos com prefixos "Doc: X", "Obs: NF...", "NF...", "[Doc: X]"
  const padroes = [
    /\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*([^\]|]+)\]/gi,
    /(?:(?:Doc|Nota|Duplicata|Fatura)[\s.:#-]+|Obs:\s*(?:NF[\s.:#-]*|Doc[\s.:#-]*|))([A-Z0-9/\s\-–Aa,.]+)/gi,
    /\bNF[\s.:#-]*([0-9/\s\-–Aa,.]+)/gi,
  ]

  for (const regex of padroes) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(obs)) !== null) {
      const cand = (match[1] || '').trim()
      if (cand && isNotaValida(cand)) {
        resultados.add(cand.replace(/^(?:Doc|NF|NF-e|NFe|Nota)[\s.:#-]+/i, '').trim())
      }
    }
  }

  // Se não capturou por regex estruturada, tentar extrair trechos com dígitos/barras/intervalos
  const partes = obs.split(/[|;\n]/)
  for (const p of partes) {
    const trimmed = p.trim()
    const matchTrecho = trimmed.match(
      /(?:(?:Doc|NF|Nota)[\s.:#-]+)?([0-9]{3,8}(?:[\s/A\-–]+[0-9]{3,8})*)/i,
    )
    if (matchTrecho && matchTrecho[1]) {
      const cand = matchTrecho[1].trim()
      if (isNotaValida(cand)) {
        resultados.add(cand)
      }
    }
  }

  return Array.from(resultados).filter(Boolean)
}
