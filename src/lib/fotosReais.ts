export function getFotoRealUrl(chaveOuCaminho: string): string {
  // Mapas locais diretos para as fotos salvas no PocketBase ou no app
  const mapa: Record<string, string> = {
    'hero-jazida-aerea':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg',
    'patio-brita': '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg',
    'correia-po-de-pedra':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg',
    'aerea-topo-planta': '/site-img/vista-de-cima-1f04f.jpeg',
    'patio-brita-pilhas': '/site-img/patio-de-brita-0a7f9.jpeg',
    'pilha-po-de-pedra': '/site-img/po-de-pedra-britador-e5885.jpeg',
    '/site-img/vista-de-cima-25461.jpeg':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg',
    '/site-img/patio-de-brita-2aa99.jpeg':
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg',
    '/site-img/po-de-pedra-britador-997e5.jpeg':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg',
    '/site-img/vista-de-cima-1f04f.jpeg': '/site-img/vista-de-cima-1f04f.jpeg',
    '/site-img/patio-de-brita-0a7f9.jpeg': '/site-img/patio-de-brita-0a7f9.jpeg',
    '/site-img/po-de-pedra-britador-e5885.jpeg': '/site-img/po-de-pedra-britador-e5885.jpeg',
  }

  return mapa[chaveOuCaminho] || chaveOuCaminho
}
