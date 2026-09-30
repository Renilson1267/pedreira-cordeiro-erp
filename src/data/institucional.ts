/**
 * Informações institucionais e canais de contato da Pedreira Cordeiro / Grupo GC do Amaral / GC Mix / C M Construções.
 *
 * Conteúdo sincronizado com o site oficial pedreiracordeiro.com.br
 */

export interface UnidadeEmpresa {
  id: string
  cidade: string
  uf: string
  descricao: string
  tipo: string
  destaque?: boolean
}

export interface ServicoItem {
  id: string
  titulo: string
  descricao: string
  icone: 'concreto' | 'betoneira' | 'agregados' | 'dosagem' | 'lokotrack'
  link?: string
  destaque?: boolean
}

export const INSTITUCIONAL_CONFIG = {
  // Nome da Empresa e Marca
  nomeFantasia: 'Grupo GC do Amaral',
  marcaPedreira: 'Pedreira Cordeiro',
  marcaConcreto: 'GC Mix',
  empresaLokotrack: 'C M Construções',
  razaoSocial: 'G C DO AMARAL SERTANIA',
  cnpj: '05.581.899/0001-05',
  inscricaoEstadual: '123.456.789.000',
  site: 'pedreiracordeiro.com.br',
  siteUrl: 'https://pedreiracordeiro.com.br',

  // Atendimento Comercial e Telefone / WhatsApp
  telefoneNumero: '08000831200',
  telefoneFormatado: '0800 083 1200',
  telefoneTelLink: 'tel:08000831200',

  // Canal WhatsApp Comercial Real
  whatsappNumero: '5583988996640',
  whatsappNumeroFormatado: '(83) 98899-6640',
  whatsappUrlConcreto:
    'https://wa.me/5583988996640?text=Ol%C3%A1!%20Quero%20um%20or%C3%A7amento%20de%20concreto.',
  whatsappUrlLokotrack:
    'https://wa.me/5583988996640?text=Ol%C3%A1!%20Quero%20um%20or%C3%A7amento%20de%20loca%C3%A7%C3%A3o%20do%20britador%20Lokotrack.',

  // E-mail Comercial
  emailComercial: 'pedreiracordeiro@gmail.com',

  // Localização e Endereço Oficial
  localizacao: 'Patos — PB / Sertão Paraibano, Pernambucano e Potiguar',
  enderecoMatriz: 'Fazenda Várzea da Jurema, S/N — Zona Rural',
  cidadeUfCepMatriz: 'Patos — PB, CEP 58700-000',
  horarioAtendimento: 'Segunda a sábado — Conforme programação da obra',

  // Hero Stats
  statsHero: [
    { valor: '5', label: 'Unidades GC do Amaral' },
    { valor: '1', label: 'Pedreira própria' },
    { valor: '3', label: 'Estados atendidos' },
    { valor: '0800', label: 'Atendimento gratuito' },
  ],

  // Missão, Visão e Objetivos extraídos diretamente do site oficial (pedreiracordeiro.com.br)
  missao:
    'Fornecer concreto usinado e agregados com qualidade, prazo e preço justo, contribuindo para o crescimento das obras e do desenvolvimento das cidades onde atuamos.',
  visao:
    'Ser referência em concreto usinado e agregados no sertão da Paraíba, Pernambuco e Rio Grande do Norte, reconhecida pela confiabilidade e pela qualidade dos produtos.',
  objetivos: [
    'Entregar sempre no prazo combinado;',
    'Manter o controle de qualidade em cada dosagem;',
    'Atender bem o cliente em todas as unidades;',
    'Crescer com responsabilidade, gerando emprego na região.',
  ],

  // Bullets reais da Pedreira Cordeiro
  pedreiraDestaques: [
    'Brita 1 e Brita 2 para concreto e drenagem',
    'Pó de pedra para contrapiso e alvenaria',
    'Carga à pronta e entrega programada',
    'Abastecimento direto das nossas concreteiras',
  ],

  // Vídeo institucional oficial do site
  videoInstitucionalUrl: 'https://pedreiracordeiro.com.br/video.mp4',

  // Imagens locais do projeto (100% autossuficiente — servidas diretamente pelo PocketBase com integridade comprovada)
  fotosReais: {
    // 1. Aérea da jazida da Pedreira Cordeiro em ângulo e usina solar (chave hero-jazida-aerea)
    heroAerea: '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    // 2. Vista de topo / aérea da jazida com usina solar
    aereaTopoPlanta:
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    // 3. Pátio de brita com caminhão despejando na peneira (chave patio-brita)
    patioBrita:
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    // 4. Pátio de brita ampliado com caminhão basculante e peneira vibratória
    patioBritaPilhas:
      '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    // 5. Correia transportadora com pó de pedra britador (chave correia-po-de-pedra)
    correiaPoDePedra:
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    // 6. Pilha de pó de pedra com correia ao fundo
    pilhaPoDePedra:
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    pedreiraAerea2:
      '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    pedreiraBritador:
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
  },
} as const

// Unidades reais da empresa
export const UNIDADES_GC: UnidadeEmpresa[] = [
  {
    id: 'patos',
    cidade: 'Patos',
    uf: 'PB',
    descricao: 'Matriz • Concreto usinado e Pedreira Cordeiro',
    tipo: 'Concreteira + Pedreira',
    destaque: true,
  },
  {
    id: 'santa-luzia',
    cidade: 'Santa Luzia',
    uf: 'PB',
    descricao: 'Concreto usinado',
    tipo: 'Concreteira GC Mix',
  },
  {
    id: 'sao-jose-do-egito',
    cidade: 'São José do Egito',
    uf: 'PE',
    descricao: 'Concreto usinado',
    tipo: 'Concreteira GC Mix',
  },
  {
    id: 'caico',
    cidade: 'Caicó',
    uf: 'RN',
    descricao: 'Concreto usinado',
    tipo: 'Concreteira GC Mix',
  },
  {
    id: 'monteiro',
    cidade: 'Monteiro',
    uf: 'PB',
    descricao: 'Concreto usinado',
    tipo: 'Concreteira GC Mix',
  },
]

// Serviços reais
export const SERVICOS_GC: ServicoItem[] = [
  {
    id: 'concreto-usinado',
    titulo: 'Concreto Usinado GC Mix',
    descricao:
      'Concreto dosado em central, com controle rigoroso de resistência e entrega programada para a sua obra.',
    icone: 'concreto',
    destaque: true,
  },
  {
    id: 'entrega-betoneira',
    titulo: 'Entrega com Betoneira',
    descricao:
      'Frota de caminhões betoneira GC Mix para despejo direto na obra, com pontualidade no horário combinado.',
    icone: 'betoneira',
  },
  {
    id: 'britas-agregados',
    titulo: 'Britas e Agregados',
    descricao:
      'Brita 1, brita 2, pedra rachão e pó de pedra da Pedreira Cordeiro — máxima qualidade direto da fonte.',
    icone: 'agregados',
  },
  {
    id: 'dosagem-sob-medida',
    titulo: 'Dosagem sob Medida',
    descricao:
      'Traços desenvolvidos para cada aplicação técnica: fundações, lajes, pisos industriais, muros e concretos especiais.',
    icone: 'dosagem',
  },
  {
    id: 'britador-lokotrack',
    titulo: 'Britador Móvel Lokotrack',
    descricao:
      'Locação de britador de mandíbula móvel pela C M Construções — esmagamento de rocha direto na sua obra ou pedreira.',
    icone: 'lokotrack',
    link: '#cm-lokotrack',
    destaque: true,
  },
]

// Lista oficial dos 5 produtos sob consulta da pedreira
export interface ProdutoPedreiraItem {
  id: string
  nome: string
  codigoRef: string
  granulometria: string
  aplicacao: string
  descricao: string
  imagem: string
  imagemSecundaria?: string
  densidadeMedia: string
}

export const PRODUTOS_PEDREIRA: ProdutoPedreiraItem[] = [
  {
    id: 'brita-12',
    nome: 'Brita 12',
    codigoRef: 'PRD-BRITA12',
    granulometria: '9,5 mm a 19 mm (Brita 1 / 1/2")',
    aplicacao: 'Concreto usinado GC Mix, lajes, vigas, pilares e fundações estruturais',
    descricao:
      'Agregado graúdo de excelente adesão e granulometria uniforme, essencial para concreto de alta resistência estrutural e pisos industriais.',
    imagem: '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    densidadeMedia: '~1,45 t/m³',
  },
  {
    id: 'brita-19',
    nome: 'Brita 19',
    codigoRef: 'PRD-BRITA19',
    granulometria: '19 mm a 25 mm (Brita 2 / 19mm)',
    aplicacao: 'Concreto pesado, drenagens profundas, lastros e pavimentação',
    descricao:
      'Ideal para obras de infraestrutura pesada, bases de pavimentação asfáltica, drenagens profundas e concretos estruturais de grande porte.',
    imagem: '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    densidadeMedia: '~1,47 t/m³',
  },
  {
    id: 'pedra-rachao',
    nome: 'Pedra Rachão',
    codigoRef: 'PRD-RACHAO',
    granulometria: '100 mm a 300 mm (Pedra de mão / Matacão)',
    aplicacao: 'Muros de arrimo, contenções, gabiões, calçamentos e fundações de pedra',
    descricao:
      'Pedra de grande porte selecionada com alta tenacidade, ideal para contenção de encostas, muros de gravidade, enrocamentos e drenagens rústicas.',
    imagem: '/api/files/pbc_3973264007/on2lc9wt1m5d2bm/vista_de_cima_25461_342l6kmtsw.jpeg?v=1',
    densidadeMedia: '~1,50 t/m³',
  },
  {
    id: 'po-de-pedra',
    nome: 'Pó de Pedra',
    codigoRef: 'PRD-PO-PEDRA',
    granulometria: '0 a 4,75 mm (Agregado Miúdo)',
    aplicacao: 'Argamassas, assentamento de paralelepípedos e intertravados, misturas asfálticas',
    descricao:
      'Substitui com alta eficiência a areia em várias etapas construtivas, proporcionando excelente compactação, acabamento homogêneo e economia.',
    imagem:
      '/api/files/pbc_3973264007/sivayu6qjcjq3f9/po_de_pedra_britador_997e5_6dgyj8eh6j.jpeg?v=1',
    densidadeMedia: '~1,56 t/m³',
  },
  {
    id: 'cascalhinho',
    nome: 'Cascalhinho',
    codigoRef: 'PRD-CASCALHINHO',
    granulometria: '4,8 mm a 9,5 mm (Pedrisco limpo)',
    aplicacao: 'Blocos de concreto, pré-moldados, paisagismo, tubos e vigotas',
    descricao:
      'Pedrisco fino e limpo de alta rigidez, amplamente requisitado em fábricas de artefatos de cimento, lajotas e projetos de drenagem superficial.',
    imagem: '/api/files/pbc_3973264007/y4872wsu9e6qmx7/patio_de_brita_2aa99_szpz936snj.jpeg?v=1',
    densidadeMedia: '~1,50 t/m³',
  },
]
