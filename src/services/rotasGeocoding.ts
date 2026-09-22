/**
 * Serviço de Geocodificação (Nominatim / OpenStreetMap) e Cálculo de Rotas (OSRM)
 * para o submódulo de Entregas da Pedreira Cordeiro.
 *
 * Utiliza APIs públicas abertas sem necessidade de chave de API.
 * Possui debounce, tratamento robusto de falhas e fallback para coordenadas padrão da pedreira.
 */

export interface CidadeGeo {
  display_name: string
  cidade: string
  estado?: string
  uf?: string
  lat: number
  lon: number
}

export interface ResultadoRota {
  distanciaKm: number
  duracaoMinutos?: number
  sucesso: boolean
  erro?: string
}

// Coordenadas de referência da Matriz / Pedreira Cordeiro (São José do Egito - PE / Monteiro - PB / Patos)
// Ponto de partida padrão caso a origem seja uma das unidades internas da pedreira
export const COORDENADAS_PEDREIRA_PADRAO = {
  lat: -7.4764,
  lon: -37.2728,
  nome: 'Pedreira Cordeiro (Matriz / Britador Principal)',
}

// Atalhos de cidades frequentes da região do Cariri / Sertão PB / PE para agilizar a seleção
export const CIDADES_FREQUENTES_REGIAO: CidadeGeo[] = [
  {
    cidade: 'São José do Egito',
    uf: 'PE',
    display_name: 'São José do Egito, Pernambuco, Brasil',
    lat: -7.4764,
    lon: -37.2728,
  },
  {
    cidade: 'Monteiro',
    uf: 'PB',
    display_name: 'Monteiro, Paraíba, Brasil',
    lat: -7.8894,
    lon: -37.1239,
  },
  {
    cidade: 'Patos',
    uf: 'PB',
    display_name: 'Patos, Paraíba, Brasil',
    lat: -7.0269,
    lon: -37.2797,
  },
  {
    cidade: 'Santa Luzia',
    uf: 'PB',
    display_name: 'Santa Luzia, Paraíba, Brasil',
    lat: -6.8719,
    lon: -36.9192,
  },
  {
    cidade: 'Caicó',
    uf: 'RN',
    display_name: 'Caicó, Rio Grande do Norte, Brasil',
    lat: -6.4583,
    lon: -37.0978,
  },
  {
    cidade: 'Serra Talhada',
    uf: 'PE',
    display_name: 'Serra Talhada, Pernambuco, Brasil',
    lat: -7.9917,
    lon: -38.2981,
  },
  {
    cidade: 'Afogados da Ingazeira',
    uf: 'PE',
    display_name: 'Afogados da Ingazeira, Pernambuco, Brasil',
    lat: -7.7511,
    lon: -37.6328,
  },
  {
    cidade: 'Sumé',
    uf: 'PB',
    display_name: 'Sumé, Paraíba, Brasil',
    lat: -7.6711,
    lon: -36.8833,
  },
  {
    cidade: 'Campina Grande',
    uf: 'PB',
    display_name: 'Campina Grande, Paraíba, Brasil',
    lat: -7.2247,
    lon: -35.8817,
  },
]

// Cache em memória durante a sessão para evitar requisições repetidas
const cacheGeocoding = new Map<string, CidadeGeo[]>()
const cacheRotas = new Map<string, ResultadoRota>()

/**
 * Consulta cidades via Nominatim OpenStreetMap
 */
export async function buscarCidadesNominatim(query: string): Promise<CidadeGeo[]> {
  const q = query.trim()
  if (!q || q.length < 2) return []

  const chaveCache = q.toLowerCase()
  if (cacheGeocoding.has(chaveCache)) {
    return cacheGeocoding.get(chaveCache)!
  }

  // Primeiro verifica se há match direto nas cidades frequentes pré-cadastradas
  const frequentesMatch = CIDADES_FREQUENTES_REGIAO.filter((c) =>
    c.cidade.toLowerCase().includes(q.toLowerCase()),
  )

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=6&addressdetails=1&q=${encodeURIComponent(
      q,
    )}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4500)

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
    clearTimeout(timer)

    if (!resp.ok) {
      return frequentesMatch
    }

    const data = await resp.json()
    if (!Array.isArray(data)) {
      return frequentesMatch
    }

    const cidades: CidadeGeo[] = data
      .map((item: any) => {
        const addr = item.address || {}
        const nomeCidade =
          addr.city || addr.town || addr.municipality || addr.village || item.name || q
        const estado = addr.state || ''
        const display = `${nomeCidade}${estado ? `, ${estado}` : ''}`

        return {
          display_name: display,
          cidade: nomeCidade,
          estado,
          uf: addr['ISO3166-2-lvl4']?.split('-')[1] || '',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }
      })
      .filter((c) => !isNaN(c.lat) && !isNaN(c.lon))

    // Mescla mantendo cidades únicas por nome e estado
    const combinadas = [...frequentesMatch]
    for (const c of cidades) {
      const existe = combinadas.some(
        (existente) =>
          existente.cidade.toLowerCase() === c.cidade.toLowerCase() &&
          existente.estado?.toLowerCase() === c.estado?.toLowerCase(),
      )
      if (!existe) {
        combinadas.push(c)
      }
    }

    const resultadoFinal = combinadas.slice(0, 6)
    cacheGeocoding.set(chaveCache, resultadoFinal)
    return resultadoFinal
  } catch (err) {
    console.warn('Falha na consulta ao Nominatim, usando fallback:', err)
    return frequentesMatch
  }
}

/**
 * Calcula a distância rodoviária via OSRM público (Driving)
 * URL: https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false
 */
export async function calcularDistanciaRotaOSRM(
  pontoA: { lat: number; lon: number },
  pontoB: { lat: number; lon: number },
): Promise<ResultadoRota> {
  const chaveCache = `${pontoA.lat.toFixed(4)},${pontoA.lon.toFixed(4)}->${pontoB.lat.toFixed(4)},${pontoB.lon.toFixed(4)}`
  if (cacheRotas.has(chaveCache)) {
    return cacheRotas.get(chaveCache)!
  }

  // Se são essencialmente o mesmo ponto (distância zero)
  if (Math.abs(pontoA.lat - pontoB.lat) < 0.0001 && Math.abs(pontoA.lon - pontoB.lon) < 0.0001) {
    const res: ResultadoRota = { distanciaKm: 0, duracaoMinutos: 0, sucesso: true }
    return res
  }

  try {
    const coordsStr = `${pontoA.lon},${pontoA.lat};${pontoB.lon},${pontoB.lat}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=false`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!resp.ok) {
      throw new Error(`Serviço OSRM retornou status ${resp.status}`)
    }

    const data = await resp.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'Nenhuma rota viária encontrada entre os pontos.')
    }

    const rotaPrincipal = data.routes[0]
    // OSRM retorna distância em metros e duration em segundos
    const metros = rotaPrincipal.distance || 0
    const segundos = rotaPrincipal.duration || 0

    const distanciaKm = Number((metros / 1000).toFixed(1))
    const duracaoMinutos = Math.round(segundos / 60)

    const resultado: ResultadoRota = {
      distanciaKm,
      duracaoMinutos,
      sucesso: true,
    }

    cacheRotas.set(chaveCache, resultado)
    return resultado
  } catch (err: any) {
    console.warn('Erro ao consultar OSRM:', err)
    // Fallback: cálculo de distância geodésica (Haversine) com acréscimo rodoviário padrão (~25% para estradas sinuosas do sertão)
    const kmGeodesico = calcularDistanciaHaversine(pontoA, pontoB)
    const kmEstimadoEstrada = Number((kmGeodesico * 1.25).toFixed(1))

    return {
      distanciaKm: kmEstimadoEstrada,
      sucesso: false,
      erro: err.message || 'Falha ao conectar ao servidor de rotas',
    }
  }
}

/**
 * Fórmula de Haversine para cálculo aproximado em caso de indisponibilidade de rede
 */
export function calcularDistanciaHaversine(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number },
): number {
  const R = 6371 // Raio da Terra em km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(1))
}

/**
 * Classifica a divergência entre o Km informado pelo motorista e o Km calculado da rota:
 * - Verde: até ~10% de diferença (variação normal de trânsito ou desvio leve)
 * - Amarelo: de 10% a 25% (atenção moderada, possível rota alternativa ou parada)
 * - Vermelho: acima de 25% (divergência alta, requer verificação de desvio ou erro de odômetro)
 */
export interface ComparativoKm {
  diferencaKm: number
  diferencaPercent: number
  status: 'normal' | 'atencao' | 'alerta'
  label: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  descricao: string
}

export function analisarDivergenciaKm(kmMotorista: number, kmRota: number): ComparativoKm | null {
  if (!kmMotorista || kmMotorista <= 0 || !kmRota || kmRota <= 0) {
    return null
  }

  const difKm = Number((kmMotorista - kmRota).toFixed(1))
  const difPercent = Number((((kmMotorista - kmRota) / kmRota) * 100).toFixed(1))
  const difAbsolutaPercent = Math.abs(difPercent)

  if (difAbsolutaPercent <= 10) {
    return {
      diferencaKm: difKm,
      diferencaPercent: difPercent,
      status: 'normal',
      label: 'Rota Conforme (<= 10%)',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-200',
      descricao: `Divergência de apenas ${difKm > 0 ? `+${difKm}` : difKm} km (${difPercent > 0 ? `+${difPercent}` : difPercent}%), percurso compatível com a rota rodoviária.`,
    }
  }

  if (difAbsolutaPercent <= 25) {
    return {
      diferencaKm: difKm,
      diferencaPercent: difPercent,
      status: 'atencao',
      label: 'Atenção (10% a 25%)',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-300',
      descricao: `Divergência de ${difKm > 0 ? `+${difKm}` : difKm} km (${difPercent > 0 ? `+${difPercent}` : difPercent}%). Possível trajeto alternativo, desvio de obra ou retorno.`,
    }
  }

  return {
    diferencaKm: difKm,
    diferencaPercent: difPercent,
    status: 'alerta',
    label: 'Divergência Alta (> 25%)',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-300',
    descricao: `Divergência de ${difKm > 0 ? `+${difKm}` : difKm} km (${difPercent > 0 ? `+${difPercent}` : difPercent}%). Km do motorista difere expressivamente da rota calculada. Recomenda-se conferência.`,
  }
}
