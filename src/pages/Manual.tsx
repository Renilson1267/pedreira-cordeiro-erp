import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Building,
  KeyRound,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  LineChart,
  Users,
  Package,
  Layers,
  PieChart,
  Clock,
  Construction,
  Fuel,
  Wrench,
  FileBarChart2,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'

interface ManualSection {
  id: string
  title: string
  subtitle: string
  icon: any
  tag: string
  steps: {
    title: string
    description: string
    substeps?: string[]
  }[]
  tips?: string[]
  warnings?: string[]
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'acesso-login',
    title: '1. Acesso, Login e Papéis de Usuário',
    subtitle: 'Como entrar no sistema, recuperar acesso e entender permissões de cada perfil.',
    icon: KeyRound,
    tag: 'Acesso',
    steps: [
      {
        title: 'Acessar o ERP Pedreira Cordeiro',
        description:
          'Abra o navegador no endereço do sistema e visualize a tela de login acolhedora.',
        substeps: [
          'Digite seu e-mail corporativo cadastrado.',
          'Digite sua senha de acesso e clique no botão "Entrar no Sistema".',
          'Ao acessar pela primeira vez ou via convite, clique no link de ativação enviado para seu e-mail.',
        ],
      },
      {
        title: 'Recuperação de Senha',
        description:
          'Caso tenha esquecido sua senha, o sistema permite restauração rápida e segura.',
        substeps: [
          'Na tela de login, clique em "Esqueceu sua senha?".',
          'Informe o e-mail cadastrado e clique em "Enviar instruções de redefinição".',
          'Verifique sua caixa de entrada e siga o link para criar uma nova senha forte.',
        ],
      },
      {
        title: 'Papéis de Usuário e Permissões no Sistema',
        description: 'O ERP adota 3 níveis claros de acesso para segurança dos dados:',
        substeps: [
          'Administrador (Admin): Acesso irrestrito a todos os módulos, cadastros, relatórios e gestão de usuários.',
          'Financeiro: Criação e edição de contas a pagar, receber, vendas, romaneios de entrega e conciliações.',
          'Leitura (Somente Leitura): Visualização e consulta de relatórios, dados e dashboards, sem permissão de alteração ou exclusão.',
        ],
      },
    ],
    tips: [
      '💡 O sistema mantém você conectado de forma segura. Ao encerrar suas atividades em computadores compartilhados, clique no seu perfil no canto inferior esquerdo e selecione "Sair".',
    ],
    warnings: [
      '⚠️ Nunca compartilhe sua senha de acesso. Cada colaborador deve possuir seu próprio usuário para rastreabilidade de lançamentos.',
    ],
  },
  {
    id: 'seletor-empresa',
    title: '2. Seletor de Empresa (Matriz e Filiais)',
    subtitle: 'Navegação multi-empresa entre a Matriz da pedreira e unidades operacionais.',
    icon: Building,
    tag: 'Multi-empresa',
    steps: [
      {
        title: 'Identificar a Empresa Ativa',
        description:
          'No topo do menu lateral esquerdo, logo abaixo da logo, é exibida a empresa em que você está operando atualmente (nome fantasia e CNPJ).',
      },
      {
        title: 'Alternar entre Unidades',
        description: 'Para alternar de empresa ou filial:',
        substeps: [
          'Clique sobre o cartão da empresa no menu lateral esquerdo.',
          'O modal "Trocar Empresa / Unidade" será aberto, listando a Matriz e todas as filiais autorizadas para seu usuário.',
          'Clique na unidade desejada para selecioná-la. O sistema atualizará instantaneamente todos os dados do painel para a empresa escolhida.',
        ],
      },
    ],
    tips: [
      '💡 Todas as contas, entregas, veículos e notas respeitam rigorosamente a empresa ativa selecionada no topo.',
    ],
  },
  {
    id: 'dashboard',
    title: '3. Dashboard e Visão Geral',
    subtitle: 'Painel executivo com indicadores vitais em tempo real da pedreira e da frota.',
    icon: LayoutDashboard,
    tag: 'Visão Geral',
    steps: [
      {
        title: 'Acompanhar Indicadores Financeiros Rápidos (KPIs)',
        description:
          'No topo da tela inicial você visualiza Saldo Atual em Contas, Total a Receber no Mês, Total a Pagar no Mês e Faturamento Acumulado.',
      },
      {
        title: 'Gráficos de Fluxo de Caixa e Evolução',
        description:
          'Gráficos intuitivos mostram a comparação entre Entradas vs. Saídas, além da distribuição de receitas por tipo de agregado.',
      },
      {
        title: 'Painel de Frota e Alertas',
        description:
          'Exibe caçambas em operação, entregas realizadas no dia, alertas de manutenção preventiva próxima e abastecimentos pendentes.',
      },
    ],
  },
  {
    id: 'financeiro-pagar',
    title: '4. Financeiro — Contas a Pagar',
    subtitle:
      'Lançamentos, parcelamentos automáticos (7/15/21/28 dias), baixas parciais e conciliação de planilhas.',
    icon: ArrowDownLeft,
    tag: 'Financeiro',
    steps: [
      {
        title: 'Lançar uma Nova Conta a Pagar',
        description: 'Clique no botão "Nova Conta a Pagar" no canto superior direito.',
        substeps: [
          'Selecione o Fornecedor cadastrado.',
          'Preencha a Descrição da despesa (ex: Óleo Diesel S10, Peças Britador).',
          'Informe o Plano de Contas (categoria) e o Centro de Custo apropriado.',
          'Digite o Valor Total e a Data de Vencimento.',
        ],
      },
      {
        title: 'Parcelamento Rápido (7/15/21/28 dias e Prazos Customizados)',
        description: 'O sistema conta com o componente inteligente Seletor de Parcelas:',
        substeps: [
          'Ative a opção "Dividir em Parcelas".',
          'Escolha um atalho de prazo rápido (ex: 7/14/21/28 dias, 15/30/45 dias ou 30/60/90 dias).',
          'O ERP calcula automaticamente as datas e divide o valor igualmente.',
          'Se necessário, você pode editar diretamente o valor e a data de vencimento de qualquer parcela individual antes de salvar.',
        ],
      },
      {
        title: 'Dar Baixa Total ou Baixa PARCIAL',
        description: 'Ao efetuar pagamentos aos fornecedores:',
        substeps: [
          'Localize a conta na tabela e clique no botão de "Dar Baixa" (ícone de check/dinheiro).',
          'Para quitação total: informe a data do pagamento, forma de pagamento (Pix, Transferência, Boleto) e confirme.',
          'Para baixa PARCIAL: digite o valor que foi efetivamente pago (menor que o total). O sistema automaticamente baixa o valor informado, altera o status para "Parcial" e mantém o saldo restante em aberto para pagamento futuro!',
        ],
      },
      {
        title: 'Importar Planilha XLSX e Conferir / Comparar',
        description: 'Ferramenta avançada para conciliação em massa:',
        substeps: [
          'Clique em "Importar Planilha XLSX" para carregar extratos ou controles externos.',
          'O sistema reconhece abas de competência (Jan a Dez) e mapeia colunas de fornecedor, valor, vencimento e status.',
          'Utilize a opção "Conferir Planilha" para comparar registros existentes com a planilha e apontar divergências sem duplicar dados.',
        ],
      },
    ],
    tips: [
      '💡 O status da conta muda automaticamente para "Vencida" se a data passar do dia de hoje sem registro de pagamento.',
    ],
    warnings: [
      '⚠️ Ao excluir uma conta a pagar vinculada a uma entrega de frota ou manutenção, certifique-se de validar se o serviço também precisa de cancelamento.',
    ],
  },
  {
    id: 'financeiro-receber',
    title: '5. Financeiro — Contas a Receber',
    subtitle: 'Controle de recebimentos, clientes depositantes, baixa parcial e comprovante A4.',
    icon: ArrowUpRight,
    tag: 'Financeiro',
    steps: [
      {
        title: 'Lançamento Manual ou Automático via Venda',
        description:
          'Títulos podem nascer automaticamente a partir de uma Venda (recomendado) ou serem lançados manualmente para receitas avulsas.',
      },
      {
        title: 'Cliente Depositante (para Pagamentos por Terceiros ou Antecipações)',
        description:
          'Quando o pagamento for efetuado por pessoa física ou empresa diferente do cliente faturado, utilize o campo "Cliente Depositante" para rastrear a origem real do depósito bancário sem desvincular o faturamento do cliente contratante.',
      },
      {
        title: 'Baixa Parcial e Emissão de Comprovante A4',
        description:
          'Assim como no Contas a Pagar, o Contas a Receber aceita quitações parciais registrando o saldo remanescente. Ao receber, clique em "Imprimir Comprovante" para gerar recibo formal em formato A4.',
      },
    ],
  },
  {
    id: 'financeiro-conciliacao-dre',
    title: '6. Conciliação Bancária & DRE Gerencial',
    subtitle: 'Confronto de extratos bancários e demonstração de resultados da pedreira.',
    icon: LineChart,
    tag: 'Controladoria',
    steps: [
      {
        title: 'Conciliação Bancária',
        description:
          'Cadastre as contas correntes bancárias da pedreira. Na tela de Conciliação, importe o extrato ou movimentações para bater saldo financeiro do sistema com o saldo real do banco.',
      },
      {
        title: 'DRE Gerencial (Demonstração do Resultado)',
        description:
          'Visão estruturada de Receita Bruta, Deduções, Custos Operacionais (CPV da britagem e diesel), Despesas Administrativas e Resultado Líquido por competência mensal.',
      },
    ],
  },
  {
    id: 'vendas',
    title: '7. Módulo de Vendas da Pedreira',
    subtitle: 'Venda dos 5 agregados oficiais, cálculo automático e geração de título a receber.',
    icon: ShoppingCart,
    tag: 'Comercial',
    steps: [
      {
        title: 'Os 5 Produtos Oficiais da Pedreira Cordeiro',
        description: 'O catálogo padrão é focado nos produtos de mineração e britagem:',
        substeps: [
          '1. Brita 12 (Agregado miúdo/médio para concreto e pré-moldados)',
          '2. Brita 19 (Brita 1 — muito utilizada em estruturas e pavimentação)',
          '3. Pedra rachão (Pedra de mão para muros de contenção e bases)',
          '4. Pó de pedra (Subproduto de alta demanda para asfalto e assentamento)',
          '5. Cascalhinho (Agregado para drenagem e aterros técnicos)',
        ],
      },
      {
        title: 'Cadastrar uma Nova Venda',
        description: 'No menu Financeiro > Vendas, clique em "Nova Venda":',
        substeps: [
          'Selecione o Cliente cadastrado (ou digite o nome).',
          'Escolha o Produto da pedreira.',
          'Informe a Unidade (m³, ton ou viagem) e a Quantidade.',
          'O sistema sugere o preço de tabela do produto; informe ou ajuste o Preço Unitário e o ERP calcula o Valor Total instantaneamente.',
          'Escolha a Forma de Pagamento e Data da Venda.',
        ],
      },
      {
        title: 'Gerar Título no Contas a Receber Automaticamente',
        description:
          'Marque a opção "Gerar Conta a Receber automaticamente no Financeiro" ou utilize o botão "Gerar Título" na linha da venda para criar a pendência financeira já vinculada.',
      },
      {
        title: 'Consultar Entregas Vinculadas à Venda',
        description:
          'Ao clicar no botão "Ver Detalhes" de qualquer venda, a janela exibe o bloco "Entregas Vinculadas a esta Venda", mostrando todas as viagens da frota que transportaram a carga daquela venda.',
      },
    ],
    tips: [
      '💡 O número da venda (ex: #V001) é o identificador central compartilhado com o módulo de Frotas e com o Romaneio A4.',
    ],
  },
  {
    id: 'entrega-vinculo',
    title: '8. Controle de Entregas & Vínculo com a Frota',
    subtitle: 'Total integração entre Financeiro e Frotas, cálculo de custos e Romaneio A4.',
    icon: Truck,
    tag: 'Operação Integrada',
    steps: [
      {
        title: 'Entregas do Financeiro × Entregas de Frotas',
        description:
          'O sistema possui duas portas de entrada que compartilham 100% da mesma base de dados:',
        substeps: [
          'Menu Financeiro > Entrega: Focado na expedição da carga, cliente faturado, valor da venda e impressão rápida do Romaneio A4.',
          'Menu Frotas > Entregas: Focado na logística, veículo/caçamba utilizado, km percorrido (satélite OSRM vs. odômetro do motorista), consumo de diesel e margem da viagem.',
        ],
      },
      {
        title: 'Criar Entrega Vinculada a uma Venda',
        description: 'Em qualquer uma das telas de entrega:',
        substeps: [
          'No formulário de cadastro, abra o campo "Venda Vinculada".',
          'Selecione a venda desejada na lista. O ERP preenche automaticamente o cliente, produto, quantidade, unidade e valor de venda.',
          'Selecione o Veículo / Caçamba da frota e o Motorista responsável.',
          'A rota sugerida puxa a Pedreira como origem e a cidade do cliente como destino.',
        ],
      },
      {
        title: 'Emissão e Impressão do Romaneio A4 Oficial',
        description:
          'Clique no botão da impressora (🖨️) para abrir o Romaneio formatado para folha A4. O documento contém o cabeçalho completo da Pedreira Cordeiro, CNPJ, dados da venda vinculada, veículo, placa, motorista, quantidade, discriminação do produto e campo para assinatura do encarregado no recebimento.',
      },
    ],
    tips: [
      '💡 Entregas sem venda (avulsas, transferências entre pátios ou testes) continuam permitidas: basta manter o campo de venda como "Nenhuma".',
    ],
  },
  {
    id: 'cadastros',
    title: '9. Cadastros Gerais',
    subtitle: 'Clientes, Fornecedores, Produtos, Centros de Custo e Plano de Contas.',
    icon: Users,
    tag: 'Cadastros',
    steps: [
      {
        title: 'Clientes e Fornecedores com Busca Automática',
        description:
          'Ao digitar o CNPJ do parceiro, o sistema realiza consulta automática aos dados públicos da Receita Federal (BrasilAPI), preenchendo Razão Social, Nome Fantasia, Logradouro, Bairro, Cidade e UF sem esforço de digitação.',
      },
      {
        title: 'Busca por CEP',
        description: 'Ao informar o CEP, o endereço é completado imediatamente.',
      },
      {
        title: 'Produtos da Pedreira e Densidade',
        description:
          'No cadastro de produtos, além do preço de venda e unidade (m³ ou ton), cada produto possui uma densidade cadastrada (ex: Brita 19 ~ 1,45 t/m³). Essa densidade permite conversão automática volumétrica nas entregas da frota.',
      },
      {
        title: 'Plano de Contas e Centros de Custo',
        description:
          'Estrutura hierárquica contábil de Receitas, Custos Operacionais e Despesas Administrativas, distribuída por centros como CC-01 Britagem, CC-02 Transporte e CC-03 Administrativo.',
      },
    ],
  },
  {
    id: 'rh',
    title: '10. Recursos Humanos (RH) e Horas Extras',
    subtitle: 'Gestão da equipe de 63 colaboradores, folha mensal e horas extras CLT.',
    icon: Users,
    tag: 'RH',
    steps: [
      {
        title: 'Cadastro de Funcionários',
        description:
          'Registro de operadores de britador, motoristas de caçamba, engenheiros, mecânicos e administrativos, com validação de CPF, cargo, setor, salário-base e chave Pix.',
      },
      {
        title: 'Folha de Horas Extras e Gratificações',
        description: 'Na tela de Folha de Horas Extras:',
        substeps: [
          'Selecione o mês de referência.',
          'Lance a quantidade de horas a 50% e horas a 100% de cada colaborador.',
          'Informe adiantamentos concedidos ou gratificações de produtividade.',
          'O sistema calcula o valor líquido e gera o espelho da folha em formato A4 Paisagem para conferência e assinatura da equipe.',
        ],
      },
    ],
  },
  {
    id: 'frotas',
    title: '11. Gestão de Frotas & Equipamentos Pesados',
    subtitle: 'Veículos, abastecimentos, manutenções preventivas/corretivas e extrato por placa.',
    icon: Construction,
    tag: 'Frotas',
    steps: [
      {
        title: 'Classificação por Setores da Pedreira',
        description: 'A frota é organizada conforme as operações de campo:',
        substeps: [
          'Entrega: Caminhões caçamba basculante (toco, truck, bi-trem) dedicados ao frete de agregados.',
          'Britagem: Carregadeiras e escavadeiras de alimentação dos britadores primários/secundários.',
          'Concreto: Caminhões betoneira e bombas de concreto usinado.',
          'Lokotrack: Equipamentos móveis de britagem e peneiramento sob esteiras.',
          'Engenharia: Caminhonetes e motos de suporte técnico e supervisão da jazida.',
        ],
      },
      {
        title: 'Lançamento de Abastecimentos',
        description:
          'Registro de combustível (Diesel S10, S500, Gasolina ou Arla 32), litros, preço por litro, odômetro/horímetro no momento e condutor. O sistema calcula a média de km/l ou l/h do veículo.',
      },
      {
        title: 'Manutenções Preventivas e Corretivas',
        description:
          'Agendamento de trocas de óleo, pneus, filtros e reparos mecânicos com alerta de quilometragem/horas para a próxima revisão.',
      },
      {
        title: 'Extrato de Despesas e Abatimentos por Placa',
        description:
          'Na listagem de veículos, abra o modal de "Despesas do Veículo". O extrato exibe Despesas (+), Abatimentos/Descontos (−) e calcula o Custo Líquido Real de cada equipamento no período selecionado.',
      },
      {
        title: 'Relatório de Custos por Setor com Impressão A4',
        description:
          'Gera relatório consolidado das despesas totais por setor da frota para tomada de decisão sobre consumo de combustível e custos com manutenção de máquinas pesadas.',
      },
    ],
    warnings: [
      '⚠️ Sempre lance o odômetro ou horímetro correto ao abastecer para manter o cálculo de consumo fiel à realidade da máquina.',
    ],
  },
  {
    id: 'relatorios',
    title: '12. Relatórios Estratégicos',
    subtitle: 'Consolidados executivos para tomada de decisão pela diretoria.',
    icon: FileBarChart2,
    tag: 'Estratégico',
    steps: [
      {
        title: 'Relatório Financeiro Geral',
        description: 'Fluxo de entradas e saídas por período, contas liquidadas e inadimplência.',
      },
      {
        title: 'Relatório de Vendas por Produto',
        description:
          'Volume transportado (m³ e toneladas) de Brita 12, 19, Rachão, Pó de pedra e Cascalhinho.',
      },
      {
        title: 'Relatório de Eficiência da Frota',
        description:
          'Km total rodado por caminhão, consumo médio de combustível e custo de frete por tonelada entregue.',
      },
    ],
  },
]

export default function ManualPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>(MANUAL_SECTIONS[0].id)
  const [searchQuery, setSearchQuery] = useState('')

  const handlePrint = () => {
    window.print()
  }

  // Filtragem rápida
  const filteredSections = MANUAL_SECTIONS.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const matchTitle = s.title.toLowerCase().includes(q)
    const matchSub = s.subtitle.toLowerCase().includes(q)
    const matchTag = s.tag.toLowerCase().includes(q)
    const matchSteps = s.steps.some(
      (st) =>
        st.title.toLowerCase().includes(q) ||
        st.description.toLowerCase().includes(q) ||
        st.substeps?.some((ss) => ss.toLowerCase().includes(q)),
    )
    return matchTitle || matchSub || matchTag || matchSteps
  })

  return (
    <div className="space-y-6">
      {/* Header Não Imprimível na barra superior da tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Manual de Treinamento Operacional
                </h1>
                <Badge className="bg-teal-100 text-teal-900 border-teal-300">Guia Completo</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Passo a passo detalhado de todos os módulos para formação e consulta de
                colaboradores da Pedreira Cordeiro
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs text-xs h-9 px-4"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir Manual Completo (A4)
          </Button>
        </div>
      </div>

      {/* Busca e Dica de Navegação */}
      <Card className="rounded-2xl border-[#ECEAE4] bg-white p-4 shadow-xs no-print">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar assunto, módulo, botão ou instrução..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] text-xs h-9 rounded-xl"
            />
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Disponível para todos os perfis (Administrador, Financeiro e Leitura)</span>
          </div>
        </div>
      </Card>

      {/* LAYOUT PRINCIPAL: Índice Lateral + Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sumário Navegável (Menu Lateral Interno) */}
        <aside className="lg:col-span-4 space-y-2 no-print sticky top-4">
          <Card className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-3">
            <div className="px-3 py-2 border-b border-[#ECEAE4] mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Índice dos Módulos
              </span>
              <span className="text-[11px] font-mono text-teal-800 font-semibold">
                {MANUAL_SECTIONS.length} seções
              </span>
            </div>

            <nav className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {filteredSections.map((sec) => {
                const Icon = sec.icon
                const isSelected = activeSectionId === sec.id
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-xl text-xs transition-all text-left ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200'
                        : 'text-gray-600 hover:bg-[#FAF9F7] hover:text-gray-900'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isSelected ? 'text-teal-700' : 'text-gray-400'
                      }`}
                    />
                    <div className="flex-1 truncate">
                      <div className="truncate">{sec.title}</div>
                      <span className="text-[10px] text-gray-400 font-normal block truncate">
                        {sec.tag}
                      </span>
                    </div>
                  </a>
                )
              })}
            </nav>
          </Card>
        </aside>

        {/* Conteúdo do Manual Completo */}
        <main className="lg:col-span-8 space-y-6 manual-print-body">
          {filteredSections.map((section) => {
            const Icon = section.icon
            return (
              <Card
                key={section.id}
                id={section.id}
                className="rounded-2xl border-[#ECEAE4] bg-white shadow-xs p-6 print:border-none print:shadow-none print:p-0 print:mb-8 transition-all"
              >
                {/* Cabeçalho da Seção */}
                <div className="flex items-start justify-between pb-4 border-b border-[#ECEAE4] gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-100 print:border print:border-teal-800">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-[#FAF9F7] text-teal-800 border-teal-200 mb-1 uppercase font-semibold"
                      >
                        {section.tag}
                      </Badge>
                      <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                        {section.title}
                      </h2>
                      <p className="text-xs text-gray-600 mt-0.5">{section.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Passos Detalhados */}
                <div className="space-y-4 py-4">
                  {section.steps.map((st, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#ECEAE4] space-y-2 print:bg-transparent print:border-b print:rounded-none print:px-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-xs text-gray-900">{st.title}</h3>
                      </div>
                      <p className="text-xs text-gray-700 pl-7 leading-relaxed">{st.description}</p>
                      {st.substeps && st.substeps.length > 0 && (
                        <ul className="pl-7 space-y-1 mt-1 text-xs text-gray-600 list-disc list-inside">
                          {st.substeps.map((sub, sidx) => (
                            <li key={sidx} className="leading-snug">
                              {sub}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Dicas e Avisos */}
                {(section.tips || section.warnings) && (
                  <div className="space-y-2.5 pt-2 border-t border-[#ECEAE4]">
                    {section.tips?.map((tip, tidx) => (
                      <div
                        key={tidx}
                        className="p-3 bg-teal-50/80 rounded-xl border border-teal-200 text-xs text-teal-950 flex items-start gap-2.5"
                      >
                        <Lightbulb className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{tip}</span>
                      </div>
                    ))}
                    {section.warnings?.map((warn, widx) => (
                      <div
                        key={widx}
                        className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </main>
      </div>

      {/* Layout Especial Oculto/Formatado para Impressão A4 */}
      <div className="hidden print:block print:w-full text-gray-900 font-sans text-xs">
        <div className="border-b-2 border-teal-900 pb-3 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-teal-950">
              Grupo Pedreira Cordeiro — Manual Operacional do ERP
            </h1>
            <p className="text-xs text-gray-600">
              Guia Prático e Treinamento de Colaboradores • Sertânia / PE
            </p>
          </div>
          <div className="text-right text-[11px] font-mono text-gray-500">
            Documento de Treinamento v1.0
          </div>
        </div>
      </div>
    </div>
  )
}
