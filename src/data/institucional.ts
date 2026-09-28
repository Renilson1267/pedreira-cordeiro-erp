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

  // Fotos reais extraídas do site oficial da empresa (pedreiracordeiro.com.br)
  fotosReais: {
    heroAerea: 'https://pedreiracordeiro.com.br/site-img/galeria-drone-1.jpg',
    pedreiraAerea2: 'https://pedreiracordeiro.com.br/site-img/galeria-drone-2.jpg',
    pedreiraBritador: 'https://pedreiracordeiro.com.br/site-img/galeria-drone-3.jpg',
    pedreiraRegiao: 'https://pedreiracordeiro.com.br/site-img/galeria-drone-4.jpg',
    betoneira1: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-1.jpg',
    betoneira2: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-2.jpg',
    frotaGcMix: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-3.jpg',
    betoneiraRota: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-4.jpg',
    betoneira5: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-5.jpg',
    betoneira7: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-7.jpg',
    silo2: 'https://pedreiracordeiro.com.br/site-img/galeria-silo-2.jpg',
    siloMonteiro: 'https://pedreiracordeiro.com.br/site-img/hero-silo.jpg',
    concretagemPatos: 'https://pedreiracordeiro.com.br/site-img/galeria-concretagem.jpg',
    pisoIndustrial: 'https://pedreiracordeiro.com.br/site-img/galeria-piso-1.jpg',
    pisoAcabamento: 'https://pedreiracordeiro.com.br/site-img/galeria-piso-2.jpg',
    preparacaoObra: 'https://pedreiracordeiro.com.br/site-img/galeria-obra-grad.jpg',
    // NOTA: As fotos cm-lokotrack-1.jpg, cm-lokotrack-2.jpg e cm-lokotrack-3.jpg são do
    // britador fixo da matriz em Patos-PB e estão desatualizadas, NÃO correspondendo ao
    // britador móvel Lokotrack. Foram desvinculadas das seções do Lokotrack móvel.
    // cm-lokotrack-3 é mantido apenas como imagem de contexto do produto cascalhinho:
    britadorFixoCm3: 'https://pedreiracordeiro.com.br/site-img/cm-lokotrack-3.jpg',
    cmPilhas1: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-1.jpg',
    cmPilhas2: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-2.jpg',
    cmPatio: 'https://pedreiracordeiro.com.br/site-img/cm-patio.jpg',
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
    imagem: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-2.jpg',
    imagemSecundaria: 'https://img.usecurling.com/p/600/400?q=crushed%20stone%20gravel&color=slate',
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
    imagem: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-1.jpg',
    imagemSecundaria: 'https://img.usecurling.com/p/600/400?q=coarse%20gravel%20stones&color=stone',
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
    imagem: 'https://pedreiracordeiro.com.br/site-img/galeria-drone-3.jpg',
    imagemSecundaria: 'https://img.usecurling.com/p/600/400?q=quarry%20rocks%20boulders&color=gray',
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
    imagem: 'https://pedreiracordeiro.com.br/site-img/cm-patio.jpg',
    imagemSecundaria: 'https://img.usecurling.com/p/600/400?q=stone%20dust%20quarry&color=zinc',
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
    imagem: 'https://pedreiracordeiro.com.br/site-img/cm-lokotrack-3.jpg',
    imagemSecundaria:
      'https://img.usecurling.com/p/600/400?q=fine%20gravel%20aggregate&color=neutral',
    densidadeMedia: '~1,50 t/m³',
  },
]
