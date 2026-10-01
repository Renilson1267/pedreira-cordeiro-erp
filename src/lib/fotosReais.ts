import fotoVistaDeCima from '@/assets/vista-de-cima-1f04f.jpeg'
import fotoPatioDeBrita from '@/assets/patio-de-brita-0a7f9.jpeg'
import fotoPoDePedra from '@/assets/po-de-pedra-britador-e5885.jpeg'

export const FOTOS_ESTATICAS_PEDREIRA = {
  vistaDeCima: fotoVistaDeCima,
  patioDeBrita: fotoPatioDeBrita,
  poDePedra: fotoPoDePedra,
} as const

export function getFotoRealUrl(chaveOuCaminho: string): string {
  // Mapas locais diretos para as fotos locais compiladas (100% garantidas e independentes de proxy)
  const mapa: Record<string, string> = {
    'hero-jazida-aerea': fotoVistaDeCima,
    'patio-brita': fotoPatioDeBrita,
    'correia-po-de-pedra': fotoPoDePedra,
    'aerea-topo-planta': fotoVistaDeCima,
    'patio-brita-pilhas': fotoPatioDeBrita,
    'pilha-po-de-pedra': fotoPoDePedra,
    '/site-img/vista-de-cima-25461.jpeg': fotoVistaDeCima,
    '/site-img/patio-de-brita-2aa99.jpeg': fotoPatioDeBrita,
    '/site-img/po-de-pedra-britador-997e5.jpeg': fotoPoDePedra,
    '/site-img/vista-de-cima-1f04f.jpeg': fotoVistaDeCima,
    '/site-img/patio-de-brita-0a7f9.jpeg': fotoPatioDeBrita,
    '/site-img/po-de-pedra-britador-e5885.jpeg': fotoPoDePedra,
    '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1':
      fotoVistaDeCima,
    '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1':
      fotoPatioDeBrita,
    '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1':
      fotoPoDePedra,
  }

  return mapa[chaveOuCaminho] || chaveOuCaminho
}
