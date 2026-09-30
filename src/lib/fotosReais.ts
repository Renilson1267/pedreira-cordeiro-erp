export function getFotoRealUrl(chaveOuCaminho: string): string {
  // Mapas locais diretos para as fotos salvas no PocketBase ou no app
  const mapa: Record<string, string> = {
    'hero-jazida-aerea':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    'patio-brita':
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    'correia-po-de-pedra':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    'aerea-topo-planta':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    'patio-brita-pilhas':
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    'pilha-po-de-pedra':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    '/site-img/vista-de-cima-25461.jpeg':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    '/site-img/patio-de-brita-2aa99.jpeg':
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    '/site-img/po-de-pedra-britador-997e5.jpeg':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    '/site-img/vista-de-cima-1f04f.jpeg':
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    '/site-img/patio-de-brita-0a7f9.jpeg':
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    '/site-img/po-de-pedra-britador-e5885.jpeg':
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
  }

  return mapa[chaveOuCaminho] || chaveOuCaminho
}
