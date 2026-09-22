/**
 * Utilitários e serviços para busca automática e formatação de CEP e CNPJ
 * Integração com ViaCEP e BrasilAPI com fallback e timeout seguro (~8s)
 */

export interface EnderecoConsulta {
  cep: string
  logradouro: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
  ibge?: string
  ddd?: string
  enderecoCompleto?: string
}

export interface CnpjConsulta {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  abertura?: string
  situacaoCadastral?: string
  status?: string
  naturezaJuridica?: string
  atividadePrincipal?: string
  cnae?: string
  telefone?: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  enderecoCompleto?: string
}

/**
 * Remove caracteres não numéricos
 */
export function apenasDigitos(valor: string | undefined | null): string {
  if (!valor) return ''
  return valor.replace(/\D/g, '')
}

/**
 * Aplica máscara de CEP (00000-000)
 */
export function formatarCep(valor: string | undefined | null): string {
  const d = apenasDigitos(valor).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/**
 * Aplica máscara de CNPJ (00.000.000/0000-00)
 */
export function formatarCnpj(valor: string | undefined | null): string {
  const d = apenasDigitos(valor).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Aplica máscara de CPF (000.000.000-00)
 */
export function formatarCpf(valor: string | undefined | null): string {
  const d = apenasDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Detecta se é CPF ou CNPJ e aplica máscara progressiva
 */
export function formatarCpfCnpj(valor: string | undefined | null): string {
  const d = apenasDigitos(valor)
  if (d.length > 11) {
    return formatarCnpj(d)
  }
  return formatarCpf(d)
}

/**
 * Validação de dígitos verificadores de CNPJ
 */
export function validarCnpj(cnpj: string): boolean {
  const clean = apenasDigitos(cnpj)
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  let tamanho = 12
  let numeros = clean.substring(0, tamanho)
  const digitos = clean.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false

  tamanho = 13
  numeros = clean.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  return resultado === parseInt(digitos.charAt(1), 10)
}

/**
 * Validação de dígitos verificadores de CPF
 */
export function validarCpf(cpf: string): boolean {
  const clean = apenasDigitos(cpf)
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false

  let soma = 0
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(clean.substring(10, 11), 10)
}

/**
 * Helper para fetch com timeout configurável (default 8s)
 */
async function fetchComTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('A consulta excedeu o tempo limite (timeout de 8s). Tente novamente.')
    }
    throw err
  }
}

/**
 * Busca dados de CEP: tenta ViaCEP e faz fallback para BrasilAPI
 */
export async function buscarCep(cepInput: string): Promise<EnderecoConsulta> {
  const cepLimpo = apenasDigitos(cepInput)
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos numéricos.')
  }

  // 1ª tentativa: ViaCEP
  try {
    const resViaCep = await fetchComTimeout(`https://viacep.com.br/ws/${cepLimpo}/json/`, 7000)
    if (resViaCep.ok) {
      const data = await resViaCep.json()
      if (!data.erro) {
        const logradouro = data.logradouro ? data.logradouro.trim() : ''
        const bairro = data.bairro ? data.bairro.trim() : ''
        const cidade = data.localidade ? data.localidade.trim() : ''
        const uf = (data.uf || '').toUpperCase()
        const cepFormatado = formatarCep(cepLimpo)

        const partes: string[] = []
        if (logradouro) partes.push(logradouro)
        if (bairro) partes.push(bairro)

        return {
          cep: cepFormatado,
          logradouro,
          complemento: data.complemento || '',
          bairro,
          cidade,
          uf,
          ibge: data.ibge,
          ddd: data.ddd,
          enderecoCompleto: partes.join(', '),
        }
      }
    }
  } catch (e) {
    // ViaCEP falhou ou deu timeout, prossegue para o fallback BrasilAPI
    console.warn('ViaCEP indisponível ou falhou, tentando BrasilAPI:', e)
  }

  // 2ª tentativa: BrasilAPI (fallback)
  try {
    const resBrasilApi = await fetchComTimeout(
      `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`,
      7000,
    )
    if (resBrasilApi.ok) {
      const data = await resBrasilApi.json()
      const logradouro = data.street ? data.street.trim() : ''
      const bairro = data.neighborhood ? data.neighborhood.trim() : ''
      const cidade = data.city ? data.city.trim() : ''
      const uf = (data.state || '').toUpperCase()
      const cepFormatado = formatarCep(cepLimpo)

      const partes: string[] = []
      if (logradouro) partes.push(logradouro)
      if (bairro) partes.push(bairro)

      return {
        cep: cepFormatado,
        logradouro,
        bairro,
        cidade,
        uf,
        enderecoCompleto: partes.join(', '),
      }
    }
  } catch (e) {
    console.warn('BrasilAPI CEP também falhou:', e)
  }

  throw new Error(`CEP ${formatarCep(cepLimpo)} não encontrado nas bases públicas.`)
}

/**
 * Constrói string legível de endereço a partir de logradouro, número, complemento e bairro
 */
export function formatarLinhaEndereco(opts: {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
}): string {
  const { logradouro, numero, complemento, bairro } = opts
  const partes: string[] = []

  let ruaNum = (logradouro || '').trim()
  if (numero && numero.trim() && numero.trim().toLowerCase() !== 's/n') {
    ruaNum = ruaNum ? `${ruaNum}, ${numero.trim()}` : numero.trim()
  } else if (numero && numero.trim()) {
    ruaNum = ruaNum ? `${ruaNum}, S/N` : 'S/N'
  }
  if (ruaNum) partes.push(ruaNum)

  if (complemento && complemento.trim()) {
    partes.push(complemento.trim())
  }

  if (bairro && bairro.trim()) {
    partes.push(bairro.trim())
  }

  return partes.join(' - ')
}

/**
 * Busca dados de CNPJ: tenta BrasilAPI e faz fallback para OpenCNPJ / ReceitaWS
 */
export async function buscarCnpj(cnpjInput: string): Promise<CnpjConsulta> {
  const cnpjLimpo = apenasDigitos(cnpjInput)
  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ deve conter exatamente 14 dígitos numéricos.')
  }

  // 1ª tentativa: BrasilAPI (gratuita, sem chave, rápida)
  try {
    const resBrasilApi = await fetchComTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
      8000,
    )
    if (resBrasilApi.ok) {
      const data = await resBrasilApi.json()
      const razaoSocial = (data.razao_social || data.nome_fantasia || '').trim()
      const nomeFantasia = (data.nome_fantasia || data.razao_social || '').trim()
      const logradouro = (data.logradouro || '').trim()
      const numero = (data.numero || '').trim()
      const complemento = (data.complemento || '').trim()
      const bairro = (data.bairro || '').trim()
      const cidade = (data.municipio || '').trim()
      const uf = (data.uf || '').toUpperCase()
      const cepFormatado = data.cep ? formatarCep(data.cep) : undefined
      const telefone = (data.ddd_telefone_1 || data.telefone || '').trim()
      const email = (data.email || '').toLowerCase().trim()

      const linhaEndereco = formatarLinhaEndereco({
        logradouro,
        numero,
        complemento,
        bairro,
      })

      return {
        cnpj: formatarCnpj(cnpjLimpo),
        razaoSocial,
        nomeFantasia,
        abertura: data.data_inicio_atividade,
        situacaoCadastral: data.descricao_situacao_cadastral,
        naturezaJuridica: data.natureza_juridica,
        cnae: data.cnae_fiscal_descricao,
        telefone: telefone ? formatarTelefoneBrasil(telefone) : undefined,
        email: email || undefined,
        cep: cepFormatado,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        enderecoCompleto: linhaEndereco || undefined,
      }
    }
  } catch (e) {
    console.warn('BrasilAPI CNPJ falhou, tentando fallback OpenCNPJ:', e)
  }

  // 2ª tentativa: OpenCNPJ (gratuita pública alternativa)
  try {
    const resOpen = await fetchComTimeout(`https://open.cnpja.com/office/${cnpjLimpo}`, 7000)
    if (resOpen.ok) {
      const data = await resOpen.json()
      const company = data.company || {}
      const address = data.address || {}
      const razaoSocial = (company.name || data.alias || '').trim()
      const nomeFantasia = (data.alias || company.name || '').trim()
      const logradouro = (address.street || '').trim()
      const numero = (address.number || '').trim()
      const complemento = (address.details || '').trim()
      const bairro = (address.district || '').trim()
      const cidade = (address.city || '').trim()
      const uf = (address.state || '').toUpperCase()
      const cepFormatado = address.zip ? formatarCep(address.zip) : undefined
      const emails = data.emails || []
      const phones = data.phones || []

      const tel = phones[0] ? `${phones[0].area || ''}${phones[0].number || ''}` : ''
      const email = emails[0]?.address || ''

      const linhaEndereco = formatarLinhaEndereco({
        logradouro,
        numero,
        complemento,
        bairro,
      })

      return {
        cnpj: formatarCnpj(cnpjLimpo),
        razaoSocial,
        nomeFantasia,
        abertura: data.founded,
        situacaoCadastral: data.status?.text,
        telefone: tel ? formatarTelefoneBrasil(tel) : undefined,
        email: email || undefined,
        cep: cepFormatado,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        enderecoCompleto: linhaEndereco || undefined,
      }
    }
  } catch (e) {
    console.warn('Fallback OpenCNPJ falhou:', e)
  }

  throw new Error(
    `CNPJ ${formatarCnpj(cnpjLimpo)} não foi encontrado ou está inacessível no momento.`,
  )
}

/**
 * Normaliza e formata telefones brasileiros: (00) 00000-0000 ou (00) 0000-0000
 */
export function formatarTelefoneBrasil(tel: string): string {
  const d = apenasDigitos(tel)
  if (!d) return ''
  // Com DDD (10 ou 11 dígitos)
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  if (d.length > 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
  }
  return tel
}
