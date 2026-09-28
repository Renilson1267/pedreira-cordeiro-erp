/**
 * Informações institucionais e canais de contato da Pedreira Cordeiro.
 *
 * NOTA: Estes dados são editáveis diretamente aqui caso a empresa altere o número
 * de WhatsApp ou e-mail de atendimento comercial.
 */

export const INSTITUCIONAL_CONFIG = {
  // Nome da Empresa e Marca
  nomeFantasia: 'Grupo Pedreira Cordeiro',
  razaoSocial: 'G C DO AMARAL SERTANIA',
  cnpj: '05.581.899/0001-05',
  inscricaoEstadual: '123.456.789.000',
  site: 'pedreiracordeiro.com.br',
  siteUrl: 'https://pedreiracordeiro.com.br',

  // Atendimento Comercial e Telefone / WhatsApp
  // O número comercial fornecido é "0800 083 1200" (gratuito nacional).
  // Números 0800 no Brasil são telefones fixos gratuitos nacionais sem DDD geográfico.
  // Para ligações diretas via navegador / smartphone, o protocolo tel: usa o formato E.164: +5508000831200.
  // Para wa.me, o formato internacional correspondente com DDI 55 é 5508000831200 (ou 558000831200);
  // mantemos wa.me apontando para o número brasileiro oficial e disponibilizamos também o link tel: para discagem direta.
  telefoneNumero: '08000831200',
  telefoneFormatado: '0800 083 1200',
  telefoneTelLink: 'tel:+5508000831200',

  // Canal WhatsApp Comercial
  whatsappNumero: '558000831200',
  whatsappNumeroFormatado: '0800 083 1200',

  // E-mail Comercial
  emailComercial: 'pedreiracordeiro@gmail.com',

  // Localização e Atendimento
  localizacao: 'Sertânia — PE / Região do Pajeú e Moxotó',
  horarioAtendimento: 'Segunda a Sexta: 07h às 17h | Sábado: 07h às 12h',

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
    lokotrack1: 'https://pedreiracordeiro.com.br/site-img/cm-lokotrack-1.jpg',
    lokotrack2: 'https://pedreiracordeiro.com.br/site-img/cm-lokotrack-2.jpg',
    lokotrack3: 'https://pedreiracordeiro.com.br/site-img/cm-lokotrack-3.jpg',
    cmPilhas1: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-1.jpg',
    cmPilhas2: 'https://pedreiracordeiro.com.br/site-img/cm-pilhas-2.jpg',
    cmPatio: 'https://pedreiracordeiro.com.br/site-img/cm-patio.jpg',
  },
} as const

// Lista oficial dos 5 produtos sob consulta da pedreira
export interface ProdutoPedreiraItem {
  id: string
  nome: string
  codigoRef: string
  granulometria: string
  aplicacao: string
  descricao: string
  imagem: string
  densidadeMedia: string
}

export const PRODUTOS_PEDREIRA: ProdutoPedreiraItem[] = [
  {
    id: 'brita-12',
    nome: 'Brita 1 2',
    codigoRef: 'PRD-BRITA12',
    granulometria: '9,5 mm a 19 mm (Brita 1 / 1/2")',
    aplicacao: 'Concreto usinado, lajes, vigas, pilares e fundações estruturais',
    descricao:
      'Agregado graúdo de excelente adesão e granulometria uniforme, essencial para concreto de alta resistência estrutural e pisos industriais.',
    imagem: 'https://img.usecurling.com/p/600/400?q=crushed%20stone%20gravel&color=slate',
    densidadeMedia: '~1,45 t/m³',
  },
  {
    id: 'brita-19',
    nome: 'Brita 1 9',
    codigoRef: 'PRD-BRITA19',
    granulometria: '19 mm a 25 mm (Brita 2 / 19mm)',
    aplicacao: 'Concreto pesado, drenagens, lastros ferroviários e pavimentação',
    descricao:
      'Ideal para obras de infraestrutura pesada, bases de pavimentação asfáltica, drenagens profundas e concretos estruturais de grande porte.',
    imagem: 'https://img.usecurling.com/p/600/400?q=coarse%20gravel%20stones&color=stone',
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
    imagem: 'https://img.usecurling.com/p/600/400?q=quarry%20rocks%20boulders&color=gray',
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
    imagem: 'https://img.usecurling.com/p/600/400?q=stone%20dust%20quarry&color=zinc',
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
    imagem: 'https://img.usecurling.com/p/600/400?q=fine%20gravel%20aggregate&color=neutral',
    densidadeMedia: '~1,50 t/m³',
  },
]
