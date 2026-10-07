import fotoVistaDeCima from '@/assets/vista-de-cima-1f04f.jpeg'
import fotoPatioDeBrita from '@/assets/patio-de-brita-0a7f9.jpeg'
import fotoPoDePedra from '@/assets/po-de-pedra-britador-e5885.jpeg'
import fotoLokotrackMovel from '@/assets/whatsapp-image-2026-09-30-at-10.49.19-89367.jpeg'
import fotoMonteiroAerea from '@/assets/whatsapp-image-2026-10-06-at-22.25.42-09c8c.jpeg'
import fotoMonteiroBetoneirasCarregando from '@/assets/whatsapp-image-2026-10-06-at-22.25.41-c4e26.jpeg'
import fotoMonteiroFachadaSilo from '@/assets/whatsapp-image-2026-10-06-at-22.25.08-1-e6cbe.jpeg'
import fotoSaoJoseDoEgitoSiloPatio from '@/assets/whatsapp-image-2026-10-06-at-22.25.08-044d7.jpeg'

export const FOTOS_ESTATICAS_PEDREIRA = {
  vistaDeCima: fotoVistaDeCima,
  patioDeBrita: fotoPatioDeBrita,
  poDePedra: fotoPoDePedra,
  lokotrackMovel: fotoLokotrackMovel,
  monteiroAerea: fotoMonteiroAerea,
  monteiroBetoneirasCarregando: fotoMonteiroBetoneirasCarregando,
  monteiroFachadaSilo: fotoMonteiroFachadaSilo,
  saoJoseDoEgitoSiloPatio: fotoSaoJoseDoEgitoSiloPatio,
  patosDesfileBetoneira: '/site-img/galeria-betoneira-5.jpg',
  'galeria-betoneira-5': '/site-img/galeria-betoneira-5.jpg',
  'galeria-betoneira-5.jpg': '/site-img/galeria-betoneira-5.jpg',
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
    'lokotrack-movel': fotoLokotrackMovel,
    'cm-lokotrack-operacao': fotoLokotrackMovel,
    'monteiro-aerea': fotoMonteiroAerea,
    'monteiro-betoneiras-carregando': fotoMonteiroBetoneirasCarregando,
    'monteiro-fachada-silo': fotoMonteiroFachadaSilo,
    'sao-jose-do-egito-silo-patio': fotoSaoJoseDoEgitoSiloPatio,
    'sje-silo-patio': fotoSaoJoseDoEgitoSiloPatio,
    '/site-img/monteiro-aerea.jpeg': fotoMonteiroAerea,
    '/site-img/monteiro-betoneiras-carregando.jpeg': fotoMonteiroBetoneirasCarregando,
    '/site-img/monteiro-fachada-silo.jpeg': fotoMonteiroFachadaSilo,
    '/site-img/sao-jose-do-egito-silo-patio.jpeg': fotoSaoJoseDoEgitoSiloPatio,
    '/site-img/vista-de-cima-25461.jpeg': fotoVistaDeCima,
    '/site-img/patio-de-brita-2aa99.jpeg': fotoPatioDeBrita,
    '/site-img/po-de-pedra-britador-997e5.jpeg': fotoPoDePedra,
    '/site-img/vista-de-cima-1f04f.jpeg': fotoVistaDeCima,
    '/site-img/patio-de-brita-0a7f9.jpeg': fotoPatioDeBrita,
    '/site-img/po-de-pedra-britador-e5885.jpeg': fotoPoDePedra,
    '/site-img/lokotrack-movel-cm.jpeg': fotoLokotrackMovel,
    '/site-img/galeria-betoneira-5.jpg': '/site-img/galeria-betoneira-5.jpg',
    patosDesfileBetoneira: '/site-img/galeria-betoneira-5.jpg',
    'galeria-betoneira-5': '/site-img/galeria-betoneira-5.jpg',
    'galeria-betoneira-5.jpg': '/site-img/galeria-betoneira-5.jpg',
    '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1':
      fotoVistaDeCima,
    '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1':
      fotoPatioDeBrita,
    '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1':
      fotoPoDePedra,
  }

  return mapa[chaveOuCaminho] || chaveOuCaminho
}
