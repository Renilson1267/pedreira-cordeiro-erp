export interface HelpTopic {
  title: string
  subtitle: string
  description: string
  sections: {
    heading: string
    items: string[]
  }[]
  tips: string[]
  shortcuts?: string[]
}

export const ROUTE_HELP_MAP: Record<string, HelpTopic> = {
  '/': {
    title: 'Dashboard Executivo',
    subtitle: 'Visão geral em tempo real da pedreira e da frota',
    description:
      'Painel central de monitoramento executivo da Pedreira Cordeiro. Reúne indicadores financeiros vitais (saldo atual, a receber, a pagar e faturamento), gráficos de fluxo e status operacional da frota.',
    sections: [
      {
        heading: 'Principais recursos desta tela',
        items: [
          'Cards de KPIs rápidos com comparativo de fluxo de caixa da empresa ativa selecionada.',
          'Gráficos de Entradas vs. Saídas e faturamento por categoria de produto (Brita 12, Brita 19, etc.).',
          'Painel de frota com status de entregas do dia, caçambas em operação e alertas de manutenção próxima.',
          'Alertas automáticos de vencimento de exames periódicos de colaboradores (ASO).',
        ],
      },
    ],
    tips: [
      'Alterne a empresa ativa no seletor do topo da barra lateral para inspecionar os indicadores consolidados de cada filial ou matriz.',
      'Clique nos cartões de KPI para ser direcionado rapidamente para os módulos detalhados de Contas a Pagar, Contas a Receber ou Vendas.',
    ],
  },
  '/manual': {
    title: 'Manual do Sistema',
    subtitle: 'Guia operacional completo e treinamento',
    description:
      'Manual operacional do ERP Pedreira Cordeiro com índice navegável, instruções passo a passo para cada rotina e formatação pronta para impressão A4 de apostilas de treinamento.',
    sections: [
      {
        heading: 'Como utilizar o manual',
        items: [
          'Use a caixa de pesquisa no topo para buscar rapidamente termos como "estorno", "baixa parcial" ou "romaneio".',
          'Navegue pelos módulos usando o sumário lateral esquerdo.',
          'Utilize o botão "Imprimir Manual Completo (A4)" para gerar cópias físicas ou PDF formatado para a equipe de campo.',
        ],
      },
    ],
    tips: [
      'O manual traz instruções para todos os perfis (Administrador, Financeiro e Leitura) e explica inclusive a instalação do PWA no celular Android ou iPhone.',
    ],
  },
  '/financeiro/vendas': {
    title: 'Vendas da Pedreira',
    subtitle: 'Faturamento de agregados, geração de títulos e romaneios',
    description:
      'Módulo comercial focado nos 5 agregados oficiais da pedreira (Brita 12, Brita 19, Pedra rachão, Pó de pedra e Cascalhinho). Permite cadastrar vendas com cálculo volumétrico automático e gerar títulos no Contas a Receber.',
    sections: [
      {
        heading: 'Funcionalidades centrais',
        items: [
          'Cadastro ágil com busca digitável de clientes pelo Combobox pesquisável.',
          'Seleção de logística: Frota Própria (vinculando caminhão caçamba e motorista) ou Transporte Terceirizado.',
          'Conversão automática de unidades (m³ para toneladas e vice-versa) conforme a densidade oficial do material.',
          'Geração automática de título a receber no Financeiro com vencimento e parcelamento configurável.',
          'Impressão de Romaneio A4 para assinatura do motorista e recebimento no canteiro de obras.',
        ],
      },
    ],
    tips: [
      'O número da venda (ex: #V001) é compartilhado com o módulo de Frotas e impresso no Romaneio.',
      'Ao escolher Frota Própria, a venda cria automaticamente a entrega vinculada com acompanhamento de km.',
    ],
  },
  '/financeiro/entrega': {
    title: 'Entregas (Financeiro)',
    subtitle: 'Expedição de cargas, faturamento e romaneios A4',
    description:
      'Visão de entregas sob a ótica financeira e de expedição: vinculação com notas e vendas, controle de destinatário, cálculo de frete e emissão de romaneios de entrega.',
    sections: [
      {
        heading: 'Operações disponíveis',
        items: [
          'Vincular uma entrega diretamente a uma venda cadastrada para preenchimento automático de cliente, produto e quantidade.',
          'Cadastrar entregas avulsas, testes de pátio ou transferências entre unidades.',
          'Emissão e impressão do Romaneio A4 com cabeçalho da Pedreira Cordeiro e canhoto para assinatura.',
        ],
      },
    ],
    tips: [
      'Ao vincular à venda, o sistema importa os dados do cliente e calcula os km da rota entre a pedreira e a cidade de destino.',
    ],
  },
  '/financeiro/pagar': {
    title: 'Contas a Pagar',
    subtitle: 'Gestão de fornecedores, parcelamentos, baixas e estornos',
    description:
      'Controle rigoroso dos compromissos financeiros e despesas operacionais da pedreira (diesel, peças de britador, serviços mecânicos e despesas administrativas).',
    sections: [
      {
        heading: 'Recursos operacionais',
        items: [
          'Filtros temporais por período com escolha da base de data (Vencimento, Emissão ou Pagamento).',
          'Filtro pesquisável de Centro de Custo no cabeçalho para isolar despesas de britagem, transporte ou administrativo.',
          'Parcelamento rápido (7/14/21/28 dias, 15/30/45 dias ou personalizado) com divisão automática de valores.',
          'Baixa total ou baixa PARCIAL informando valor pago, mantendo o saldo remanescente em aberto.',
          'Estorno seguro de pagamentos com reversão automática no caixa e histórico de auditoria preservado.',
          'Importação em massa de planilhas XLSX e ferramenta de conferência prévia (comparar sem gravar).',
          'Relatório de impressão formatado em folha A4 respeitando exatamente os filtros ativos em tela.',
        ],
      },
    ],
    tips: [
      'Utilize o filtro pesquisável de Centro de Custo no cabeçalho para isolar custos específicos (ex: britador primário ou frota de entrega).',
      'Ao clicar em "Imprimir Relatório", o sistema gera a impressão filtrada respeitando exatamente a seleção e o período ativo em tela.',
      'Títulos pagos por engano podem ser revertidos pelo botão "Estornar", que devolve o saldo ao caixa automaticamente.',
    ],
  },
  '/financeiro/receber': {
    title: 'Contas a Receber',
    subtitle: 'Controle de recebimentos, cobrança e reconciliação mensal',
    description:
      'Acompanhamento de créditos a receber de clientes, faturamentos da pedreira, baixas totais ou parciais, emissão de recibos A4 e importação inteligente de planilhas mensais.',
    sections: [
      {
        heading: 'Recursos disponíveis',
        items: [
          'Busca rápida de cliente via Combobox pesquisável com razão social ou CPF/CNPJ.',
          'Campo "Cliente Depositante" para rastrear sócios ou empresas parceiras que efetuaram a transferência.',
          'Baixa parcial com manutenção do saldo residual e emissão de comprovante oficial de quitação.',
          'Estorno seguro com registro no histórico de auditoria e ajuste de saldo.',
          'Importador inteligente de planilhas XLSX com filtro de competência por mês (Janeiro a Dezembro) e prevenção de duplicidade.',
          'Modo "Conferir Planilha (Comparar)" para validar as abas do Excel antes de gravar qualquer registro no banco.',
        ],
      },
    ],
    tips: [
      'No importador de planilhas, utilize os botões "Marcar Todos" e "Desmarcar Todos" que respeitam o mês filtrado para importar apenas o mês desejado.',
      'Valores de planilhas são lidos exclusivamente da coluna "VALOR DA COMPRA", garantindo segurança contra números de cheques ou notas.',
    ],
  },
  '/financeiro/conciliacao': {
    title: 'Conciliação Bancária',
    subtitle: 'Confronto entre registros do ERP e extratos bancários',
    description:
      'Ferramenta de auditoria contábil para conferir as entradas e saídas registradas no sistema contra os lançamentos reais das contas correntes da pedreira.',
    sections: [
      {
        heading: 'Passo a passo recomendado',
        items: [
          'Selecione a conta corrente bancária da empresa ativa.',
          'Filtre pelo mês ou intervalo de datas do extrato.',
          'Confira os lançamentos conciliados e identifique eventuais divergências ou tarifas não lançadas.',
        ],
      },
    ],
    tips: [
      'Mantenha as contas cadastradas com os dados bancários corretos para evitar inconsistências no fluxo de caixa.',
    ],
  },
  '/financeiro/dre': {
    title: 'DRE Gerencial',
    subtitle: 'Demonstração do Resultado do Exercício por competência',
    description:
      'Visão estruturada da saúde financeira da pedreira: Receita Bruta, Deduções, Custo dos Produtos Vendidos (CPV - britagem e diesel), Despesas Operacionais e Lucro Líquido apurado.',
    sections: [
      {
        heading: 'Como analisar o DRE',
        items: [
          'Alterne entre visualização mensal ou anual acumulada.',
          'Analise a margem de contribuição dos agregados e a incidência dos custos de manutenção e combustíveis da frota.',
          'Exporte os resultados ou imprima o demonstrativo formatado para reuniões de diretoria.',
        ],
      },
    ],
    tips: [
      'Lançamentos com plano de contas e centro de custos preenchidos alimentam as linhas exatas do DRE automaticamente.',
    ],
  },
  '/frotas/veiculos': {
    title: 'Veículos & Máquinas da Frota',
    subtitle: 'Controle de caçambas, britadores, escavadeiras e extrato por placa',
    description:
      'Cadastro e acompanhamento de todos os veículos e maquinários da Pedreira Cordeiro, organizados por setores de atuação (Entrega, Central Britagem, Central Concreto, Lokotrack e Engenharia).',
    sections: [
      {
        heading: 'Funcionalidades principais',
        items: [
          'Cadastro por número de frota, placa, modelo, tipo de tração e horímetro/odômetro atual.',
          'Classificação rigorosa por setor operacional da pedreira.',
          'Extrato completo de despesas do veículo: peças, abastecimentos, manutenções e abatimentos aplicados.',
          'Controle de status: Operacional, Em Manutenção ou Desativado.',
        ],
      },
    ],
    tips: [
      'No modal "Despesas do Veículo", você confere o custo líquido exato de cada caminhão ou carregadeira deduzindo eventuais créditos e descontos.',
    ],
  },
  '/frotas/abastecimentos': {
    title: 'Abastecimentos da Frota',
    subtitle: 'Controle de Diesel S10, S500, Gasolina e Arla 32',
    description:
      'Registro de todo o combustível consumido pela frota e equipamentos móveis. Calcula automaticamente a média de consumo (km/l para veículos de rodagem e l/h para máquinas pesadas).',
    sections: [
      {
        heading: 'Como registrar abastecimentos',
        items: [
          'Selecione o veículo da frota no combobox pesquisável por placa ou número interno.',
          'Informe o tipo de combustível, quantidade de litros e valor unitário.',
          'Lance o odômetro ou horímetro exato no momento do abastecimento.',
          'Selecione o motorista ou operador responsável.',
        ],
      },
    ],
    tips: [
      'Informe sempre a quilometragem ou horímetro correto para evitar distorções no cálculo automático de consumo médio.',
    ],
  },
  '/frotas/manutencoes': {
    title: 'Manutenções da Frota',
    subtitle: 'Preventivas, corretivas e controle de revisões periódicas',
    description:
      'Histórico de reparos mecânicos, trocas de óleo, filtros, correias, soldas e intervenções em britadores e caçambas.',
    sections: [
      {
        heading: 'Recursos disponíveis',
        items: [
          'Agendamento de manutenções preventivas com alerta por km ou horas de uso.',
          'Registro de peças trocadas, serviços terceirizados de oficina e notas fiscais de peças.',
          'Vinculação opcional com o Contas a Pagar para alimentar o financeiro automaticamente.',
        ],
      },
    ],
    tips: [
      'Ao lançar uma manutenção com fornecedor e valor, você pode gerar a despesa vinculada no Contas a Pagar com 1 clique.',
    ],
  },
  '/frotas/entregas': {
    title: 'Entregas & Logística da Frota',
    subtitle: 'Rotas, satélite OSRM, comparativo de km e controle de frete',
    description:
      'Acompanhamento das viagens de transporte de agregados aos clientes. Compara a rota calculada por satélite (OSRM) com o odômetro informado pelo motorista, destacando divergências de km.',
    sections: [
      {
        heading: 'Recursos logísticos',
        items: [
          'Cálculo de rota automática entre a pedreira e a cidade de entrega via serviço OpenStreetMap/OSRM.',
          'Badge comparativo de km (satélite vs. informado pelo motorista) para auditoria de consumo e rota.',
          'Vinculação opcional com a venda comercial para rateio de margem de frete.',
          'Impressão de Romaneio A4 para expedição da carga.',
        ],
      },
    ],
    tips: [
      'Cidades mais frequentes da região de Sertânia/PE contam com autocompletar rápido e coordenadas já calibradas.',
    ],
  },
  '/rh/funcionarios': {
    title: 'Funcionários & Equipe',
    subtitle: 'Cadastro de operadores, motoristas, encarregados e mecânicos',
    description:
      'Gestão cadastral completa da equipe de colaboradores da pedreira com validação de CPF, dados bancários/Pix, função, setor e salário-base.',
    sections: [
      {
        heading: 'Ações cadastrais',
        items: [
          'Cadastro com validação automática de CPF e busca de endereço por CEP via BrasilAPI.',
          'Definição de setor (Britagem, Concreto, Entrega, Manutenção ou Administrativo).',
          'Importador de equipe em lote via planilha com mapeamento inteligente de cargos.',
        ],
      },
    ],
    tips: [
      'Mantenha a chave Pix atualizada no cadastro do colaborador para facilitar o pagamento de adiantamentos e horas extras.',
    ],
  },
  '/rh/horas-extras': {
    title: 'Folha de Horas Extras',
    subtitle: 'Cálculo de adicionais 50% e 100%, gratificações e espelho A4',
    description:
      'Apuração mensal de horas extraordinárias conforme a CLT. Permite lançar horas com adicional de 50% (dias úteis) e 100% (domingos e feriados), gratificações e adiantamentos com cálculo rigoroso de centavos.',
    sections: [
      {
        heading: 'Funcionalidades da folha',
        items: [
          'Seleção da competência mensal (mês/ano de referência).',
          'Lançamento individual de horas extras com cálculo aritmético exato com 2 casas decimais (toFixed(2)), evitando arredondamentos indevidos.',
          'Lançamento de gratificações de produtividade e desconto de vales/adiantamentos.',
          'Impressão da Folha de Horas Extras em A4 Paisagem para assinatura dos colaboradores.',
          'Emissão de recibo individual de horas extras para entrega ao funcionário.',
        ],
      },
    ],
    tips: [
      'O sistema calcula o valor líquido com rigor matemático de 2 casas decimais (toFixed(2)), garantindo que a soma dos recibos bata centavo por centavo com a folha consolidada.',
    ],
  },
  '/rh/exames-periodicos': {
    title: 'Exames Periódicos (PCMSO)',
    subtitle: 'Controle de ASO, Acuidade Visual, Audiometria, Toxicológico e validades',
    description:
      'Gestão e controle de saúde ocupacional dos colaboradores da pedreira. Acompanha o vencimento do ASO (Atestado de Saúde Ocupacional) e exames complementares específicos para cada risco funcional.',
    sections: [
      {
        heading: 'Estrutura de exames monitorados',
        items: [
          'Exames cobertos: ASO Clínico, Acuidade Visual, Audiometria, Avaliação Clínica, Toxicológico, Raio-X e Eletrocardiograma (ECG).',
          'Controle de periodicidade e data de validade individual por exame.',
          'Painel de alerta para colaboradores com exames vencidos ou prestes a vencer em 30/60 dias.',
          'Geração de relatório para clínicas de medicina do trabalho.',
        ],
      },
    ],
    tips: [
      'A data de validade calculada considera a periodicidade recomendada para a função do trabalhador na pedreira.',
    ],
  },
  '/cadastros/clientes': {
    title: 'Cadastro de Clientes',
    subtitle: 'Gestão comercial, limite de crédito e busca por CNPJ',
    description:
      'Registro de clientes e construtoras compradoras de agregados. Permite consulta instantânea de dados cadastrais na Receita Federal.',
    sections: [
      {
        heading: 'Recursos disponíveis',
        items: [
          'Preenchimento automático de Razão Social, Nome Fantasia e Endereço ao digitar o CNPJ (via BrasilAPI).',
          'Controle de status de crédito (Liberado, Bloqueado ou Sob Consulta).',
          'Histórico de compras e títulos em aberto do cliente.',
        ],
      },
    ],
    tips: [
      'Ao digitar um CNPJ válido, o sistema busca e completa os dados em menos de 2 segundos.',
    ],
  },
  '/cadastros/fornecedores': {
    title: 'Cadastro de Fornecedores',
    subtitle: 'Postos de diesel, oficinas, fornecedores de peças e serviços',
    description:
      'Cadastro de parceiros comerciais e prestadores de serviço com busca por CNPJ, dados de contato e dados bancários para pagamentos.',
    sections: [
      {
        heading: 'Recursos cadastrais',
        items: [
          'Consulta automática por CNPJ na Receita Federal.',
          'Definição da categoria de despesa padrão associada ao fornecedor.',
          'Vínculo facilitado na emissão de contas a pagar e manutenções de frota.',
        ],
      },
    ],
    tips: [
      'Cadastrar o banco e a chave Pix do fornecedor agiliza as baixas diárias no Contas a Pagar.',
    ],
  },
  '/cadastros/produtos': {
    title: 'Produtos & Serviços',
    subtitle: 'Catálogo de agregados da pedreira, preços e densidades',
    description:
      'Gerenciamento dos materiais produzidos pela pedreira (Brita 12, Brita 19, Pedra rachão, Pó de pedra e Cascalhinho) e serviços de frete.',
    sections: [
      {
        heading: 'Configurações de cada produto',
        items: [
          'Unidade padrão de comercialização: Metro Cúbico (m³) ou Tonelada (ton).',
          'Densidade de referência (ex: Brita 19 ~ 1,45 t/m³): essencial para a conversão exata nas entregas da frota.',
          'Preço unitário de tabela para sugestão automática nas vendas.',
        ],
      },
    ],
    tips: [
      'A densidade cadastrada é utilizada diretamente pelo módulo de Vendas e pelo Romaneio para converter m³ em toneladas.',
    ],
  },
  '/cadastros/plano-de-contas': {
    title: 'Plano de Contas',
    subtitle: 'Estrutura de receitas, custos operacionais e despesas',
    description:
      'Classificação contábil estruturada do ERP. Organiza as categorias financeiras para apuração correta do DRE e dos relatórios de controladoria.',
    sections: [
      {
        heading: 'Grupos principais',
        items: [
          'Receitas Operacionais: Venda de brita, rachão, serviços de frete.',
          'Custos da Britagem (CPV): Combustível diesel, peças de britador, explosivos, manutenção pesada.',
          'Despesas Administrativas: Folha administrativa, softwares, taxas e impostos.',
        ],
      },
    ],
    tips: [
      'Utilize os códigos hierárquicos para facilitar a localização das contas nas telas de lançamento.',
    ],
  },
  '/cadastros/centros-de-custo': {
    title: 'Centros de Custo',
    subtitle: 'Setorização dos gastos da pedreira e da frota',
    description:
      'Mapeamento dos setores que geram custos e receitas (ex: CC-01 Central Britagem, CC-02 Transporte/Frota, CC-03 Administrativo). Permite isolar os gastos de cada equipamento ou frente de trabalho.',
    sections: [
      {
        heading: 'Como utilizar centros de custo',
        items: [
          'Associe cada conta a pagar ou despesa de veículo ao centro correspondente.',
          'Filtre relatórios e a tela de Contas a Pagar por centro de custo para identificar onde estão os maiores desembolsos.',
        ],
      },
    ],
    tips: [
      'Centros de custo bem definidos tornam o DRE muito mais preciso para a tomada de decisões da gerência.',
    ],
  },
  '/cadastros/formas-recebimento': {
    title: 'Formas de Recebimento',
    subtitle: 'Pix, Transferência Bancária, Boletos, Dinheiro e Cheques',
    description:
      'Configuração das modalidades aceitas para liquidação de vendas e recebimentos, com prazos de compensação e contas bancárias padrão.',
    sections: [
      {
        heading: 'Opções suportadas',
        items: [
          'Pix, TED/DOC, Boleto Bancário, Cartão de Crédito/Débito e Cheques Pré-datados.',
          'Definição da conta corrente bancária de liquidação padrão.',
        ],
      },
    ],
    tips: [
      'Formas de pagamento configuradas aparecem nos seletores de baixa rápida do Contas a Receber.',
    ],
  },
  '/cadastros/operadores': {
    title: 'Cadastro de Operadores (Usuários)',
    subtitle: 'Gestão de acessos, permissões e empresa padrão',
    description:
      'Controle dos usuários colaboradores que acessam o ERP. Permite ao Administrador criar contas, definir permissões (Admin, Financeiro, Leitura), alterar empresas padrão e gerar senhas temporárias de recuperação.',
    sections: [
      {
        heading: 'Recursos administrativos',
        items: [
          'Criação de novos operadores com e-mail corporativo, nome e senha inicial (mínimo 8 caracteres).',
          'Atribuição de papéis: Administrador (acesso total), Financeiro (lançamentos) ou Leitura (somente consulta).',
          'Definição da "Empresa Padrão" do usuário: ao fazer login, o operador é direcionado automaticamente para a filial/matriz vinculada.',
          'Ativar ou desativar operadores com confirmação de segurança (sem apagar histórico).',
          'Redefinição de senha com geração de senha temporária segura e botão de cópia rápida.',
        ],
      },
    ],
    tips: [
      'A "Empresa Padrão" configurada define em qual empresa o operador iniciará suas atividades logo após o login.',
      'Por segurança, o administrador logado não pode desativar seu próprio usuário nem rebaixar seu papel.',
    ],
  },
  '/cadastros/video-institucional': {
    title: 'Vídeo Institucional do Sistema',
    subtitle: 'Upload de MP4 oficial e publicação na Home pública',
    description:
      'Gestão do vídeo institucional da Pedreira Cordeiro e GC Mix. Permite fazer o upload de arquivo .mp4 pelo próprio sistema para exibição na página inicial pública, sem depender de sites externos nem causar bloqueios de reprodução.',
    sections: [
      {
        heading: 'Recursos de gerenciamento',
        items: [
          'Upload direto de arquivo MP4 ou WebM (até 200 MB) com metadados e duração.',
          'Player de preview embutido para testar o vídeo antes ou depois de publicar.',
          'Substituição com 1 clique: envia uma nova versão e limpa o arquivo antigo do storage automaticamente.',
          'Ativar ou desativar o vídeo da Home pública com total segurança (a seção na Home se oculta caso não haja vídeo ativo).',
          'Upload opcional de imagem de capa (poster) personalizada para exibição antes do play.',
        ],
      },
    ],
    tips: [
      'Gere o vídeo em formato MP4 com codec H.264 para compatibilidade com todos os navegadores móveis e computadores.',
      'Se o vídeo for desativado ou nenhum arquivo for enviado, a Home oculta a seção de vídeo para evitar players vazios.',
    ],
  },
  '/cadastros/backups': {
    title: 'Backups do Sistema & Restauração',
    subtitle: 'Segurança dos dados, cópia JSON e restauração local',
    description:
      'Gestão de segurança e cópias completas de todos os registros do ERP (financeiro, frota, RH, cadastros). O sistema adota a estratégia de backup e restauração local direta no computador, garantindo soberania total dos dados sem depender de nuvens externas.',
    sections: [
      {
        heading: 'Operações de segurança',
        items: [
          'Executar backup manual a qualquer instante clicando em "Gerar Backup Agora".',
          'Download local do arquivo JSON completo para armazenamento seguro no computador ou pendrive.',
          'Restauração direta pelo botão "Restaurar este backup" na lista histórica com validação prévia de integridade.',
          'Restauração de arquivo JSON externo com validação lote a lote e confirmação com digitação de segurança.',
          'Cron semanal automático de segurança executado nas madrugadas.',
        ],
      },
    ],
    tips: [
      'O ERP utiliza backup e restauração local no notebook (arquivos JSON baixados direto no seu computador). Para restaurar uma cópia do histórico, basta clicar no botão "Restaurar este backup" no cartão correspondente.',
      'A restauração realiza validação completa prévia de todas as coleções sem risco de corrupção do banco.',
    ],
  },
  '/relatorios': {
    title: 'Relatórios Estratégicos',
    subtitle: 'Extratos consolidados, vendas por produto e custos de frota',
    description:
      'Central executiva de relatórios consolidados para a diretoria da Pedreira Cordeiro. Gera impressões em formato A4 prontas para despacho contábil.',
    sections: [
      {
        heading: 'Relatórios disponíveis',
        items: [
          'Relatório Financeiro Geral: Entradas, saídas e índice de inadimplência.',
          'Relatório de Vendas por Produto: Volume em m³ e toneladas de Brita 12, Brita 19, Rachão, Pó e Cascalhinho.',
          'Relatório de Despesas da Frota por Setor: Consumo consolidado de combustíveis e manutenções mecânicas.',
        ],
      },
    ],
    tips: [
      'Utilize os filtros de período do topo para delimitar o intervalo contábil exato que deseja emitir.',
    ],
  },
  '/perfil': {
    title: 'Meu Perfil & Segurança',
    subtitle: 'Dados do operador conectado e troca de senha',
    description:
      'Gerenciamento dos seus dados pessoais no ERP, verificação do e-mail cadastrado, papel de permissão atual e alteração de senha de acesso.',
    sections: [
      {
        heading: 'Recursos',
        items: [
          'Atualizar nome de exibição do operador.',
          'Trocar a senha de acesso informando a senha atual e a nova senha forte.',
          'Conferir a empresa e unidade em que está operando.',
        ],
      },
    ],
    tips: [
      'Mantenha sua senha segura e altere-a periodicamente para garantir a confidencialidade das operações da pedreira.',
    ],
  },
}

export const GENERIC_HELP_TOPIC: HelpTopic = {
  title: 'Ajuda do Sistema',
  subtitle: 'Orientações gerais de navegação no ERP Pedreira Cordeiro',
  description:
    'Você está utilizando o ERP Pedreira Cordeiro, sistema integrado de gestão operacional e financeira para pedreiras e frotas de agregados.',
  sections: [
    {
      heading: 'Dicas de navegação',
      items: [
        'Utilize o menu lateral esquerdo para navegar entre os módulos de Visão Geral, Financeiro, Frotas, RH e Cadastros.',
        'No topo da barra lateral, verifique sempre a empresa ativa selecionada (Matriz ou Filiais).',
        'Pressione ⌘K (ou Ctrl+K) para abrir a busca rápida global em qualquer tela do sistema.',
        'Para consultar o passo a passo completo de qualquer rotina, acesse o "Manual do Sistema" no menu principal.',
      ],
    },
  ],
  tips: [
    'Caso precise de permissões adicionais ou suporte com lançamentos, consulte o administrador do sistema.',
  ],
}

export function getHelpForRoute(pathname: string): HelpTopic {
  // 1. Correspondência exata
  if (ROUTE_HELP_MAP[pathname]) {
    return ROUTE_HELP_MAP[pathname]
  }

  // 2. Prefixo de rota (ex: sub-rotas ou parâmetros)
  const normalized =
    pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  if (ROUTE_HELP_MAP[normalized]) {
    return ROUTE_HELP_MAP[normalized]
  }

  // 3. Procura a rota mais longa que seja prefixo
  const matchedRoute = Object.keys(ROUTE_HELP_MAP)
    .filter((route) => route !== '/' && normalized.startsWith(route))
    .sort((a, b) => b.length - a.length)[0]

  if (matchedRoute) {
    return ROUTE_HELP_MAP[matchedRoute]
  }

  return GENERIC_HELP_TOPIC
}
