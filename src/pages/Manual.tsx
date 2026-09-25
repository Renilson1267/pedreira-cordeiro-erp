import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  Printer,
  Search,
  AlertTriangle,
  Lightbulb,
  Building,
  KeyRound,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  LineChart,
  Users,
  Construction,
  FileBarChart2,
  ShieldCheck,
  History,
  Smartphone,
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
      'Lançamentos com Data de Emissão, filtros de período inteligentes, parcelamentos (7/15/21/28 dias), baixas parciais, estornos e confirmação de segurança.',
    icon: ArrowDownLeft,
    tag: 'Financeiro',
    steps: [
      {
        title: 'Filtros de Período e Base de Data Inteligente',
        description:
          'A tela conta com barra de filtros temporais no topo que recalcula instantaneamente os 4 cartões de totais (Total em Aberto, Vencidas, Pagas no Período e Valor Total):',
        substeps: [
          'Botões de atalho rápido: "Todo o período", "Este mês", "Mês passado" e "Este ano".',
          'Intervalo personalizado: selecione o botão "Personalizado" e preencha as caixas de data "De" e "Até".',
          'Seletor "Filtrar por data": escolha a referência temporal desejada — "Data de Vencimento" (padrão operacional), "Data de Emissão" (competência do documento fiscal) ou "Data do Pagamento" (fluxo financeiro realizado).',
          'Os cartões e a tabela são sincronizados imediatamente após a escolha do filtro.',
        ],
      },
      {
        title: 'Lançar Nova Conta a Pagar com Campo "Data de Emissão"',
        description:
          'Clique no botão "+ Nova Conta a Pagar" no canto superior direito para abrir o formulário:',
        substeps: [
          'Combobox pesquisável de Fornecedor: comece a digitar o nome fantasia, razão social ou CNPJ para filtrar a lista instantaneamente.',
          'Descrição da despesa (ex: Óleo Diesel S10, Peças Britador Metso, Locação Caminhão Pipa).',
          'Comboboxes de Plano de Contas (categoria) e Centro de Custo: busca digitável facilitada para encontrar a rubrica contábil exata.',
          'Valor Total e Data de Vencimento (campo obrigatório que define se o título está no prazo ou vencido).',
          'Campo opcional "Data de Emissão": informe a data em que a nota fiscal ou boleto foi faturado pelo fornecedor. Essa data aparece na listagem, no modal de edição e no painel lateral de detalhes.',
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
        title: 'Estorno de Pagamento com Reversão Automática de Caixa',
        description:
          'Quando um pagamento for lançado por engano ou cancelado pelo banco, utilize o recurso de Estorno:',
        substeps: [
          'Disponível para qualquer título com status "Paga" ou "Parcial" (tanto na tabela quanto no painel de detalhes).',
          'Clique no botão "Estornar" (ícone de seta circular / rotação).',
          'O que o sistema faz: retorna o título para o status "Aberta", zera o valor pago e a data de pagamento.',
          'Segurança financeira: gera automaticamente um movimento de caixa inverso de Entrada/Estorno de mesmo valor, garantindo que o saldo bancário e o DRE não fiquem descompassados.',
          'Histórico preservado: nada é apagado — a operação fica gravada no histórico de auditoria com data, autor e valor estornado.',
        ],
      },
      {
        title: 'Confirmação Obrigatória em Toda Modificação',
        description:
          'Toda ação que altera ou grava dados (criação de conta, edição, exclusão, baixa de pagamento e estorno) abre um diálogo modal de confirmação:',
        substeps: [
          'O modal exibe um resumo claro do que está prestes a ser gravado (fornecedor, valor, datas e ação).',
          'Evita cliques acidentais e erros operacionais em rotinas críticas.',
          'Somente após o clique em "Confirmar" a gravação no banco de dados e a auditoria são efetivadas.',
        ],
      },
      {
        title: 'Importar Planilha XLSX e Conferir / Comparar',
        description: 'Ferramenta avançada para conciliação em massa de contas da pedreira:',
        substeps: [
          'Clique em "Importar Planilha XLSX" para carregar planilhas de controle externo.',
          'O sistema reconhece abas de competência (Jan a Dez) e mapeia colunas de fornecedor, valor, emissão, vencimento e status.',
          'Utilize a opção "Conferir Planilha (Comparar)" para validar as abas sem gravar dados no banco, identificando previamente títulos novos e possíveis divergências.',
        ],
      },
    ],
    tips: [
      '💡 O status da conta muda automaticamente para "Vencida" se a data de vencimento passar do dia atual sem confirmação de pagamento integral.',
      '💡 Os comboboxes pesquisáveis aceitam digitação em maiúsculas ou minúsculas e filtram mesmo com nomes incompletos.',
    ],
    warnings: [
      '⚠️ O Estorno reverte o saldo do caixa imediatamente gerando movimento de estorno. Utilize-o exclusivamente quando houver lançamento indevido ou devolução real de pagamento.',
      '⚠️ Ao excluir uma conta vinculada a despesas de veículos ou manutenção de frota, certifique-se de validar se o serviço na oficina também foi cancelado.',
    ],
  },
  {
    id: 'financeiro-receber',
    title: '5. Financeiro — Contas a Receber',
    subtitle:
      'Controle de cobranças, filtros por vencimento/emissão/recebimento, estorno com reversão de caixa, importador mensal inteligente de XLSX e conferência prévia.',
    icon: ArrowUpRight,
    tag: 'Financeiro',
    steps: [
      {
        title: 'Filtros de Período e Base de Data Inteligente',
        description:
          'Controle de fluxo de recebimentos por período com recálculo automático dos cards de totais (Total em Aberto, Vencidas, Recebidas no Período e Valor Total):',
        substeps: [
          'Botões rápidos: "Todo o período", "Este mês", "Mês passado" e "Este ano", além do seletor "Personalizado (De/Até)".',
          'Escolha a base de data: "Data de Vencimento" (previsão de entrada), "Data de Emissão" (faturamento da nota/venda) ou "Data do Recebimento" (entradas efetivas no extrato bancário).',
          'Todos os indicadores e a listagem de clientes atualizam em tempo real conforme o recorte escolhido.',
        ],
      },
      {
        title: 'Lançamento Manual ou Automático com Campo "Data de Emissão"',
        description:
          'Títulos podem nascer automaticamente a partir de uma Venda (recomendado) ou serem cadastrados manualmente para receitas avulsas:',
        substeps: [
          'Combobox pesquisável de Cliente: digite o nome do cliente ou razão social para localização imediata.',
          'Campo "Data de Emissão": registre a data em que o faturamento ocorreu (opcional, além da data de vencimento). Exibido na tabela, na edição e na aba de detalhes.',
          'Comboboxes de Plano de Contas e Centro de Custo para classificação contábil correta da receita.',
          'Campo "Cliente Depositante": essencial quando o pagamento é transferido por terceiros ou sócios do cliente, permitindo rastrear quem depositou sem perder o vínculo da venda original.',
        ],
      },
      {
        title: 'Baixa Parcial e Emissão de Comprovante A4',
        description: 'Quitação integral ou parcial de recebimentos com geração de recibo oficial:',
        substeps: [
          'Na quitação total, informe a data, conta bancária de destino e a forma (Pix, Boleto, Ted, Dinheiro).',
          'Na baixa parcial, registre o valor recebido e o saldo remanescente continua em aberto automaticamente com status "Parcial".',
          'Clique em "Imprimir Comprovante" para gerar o recibo timbrado em formato A4 com identificação do cliente e discriminação do pagamento.',
        ],
      },
      {
        title: 'Estorno de Recebimento com Reversão Automática de Caixa',
        description:
          'Procedimento seguro para anular recebimentos lançados por engano ou cheques devolvidos:',
        substeps: [
          'Localize o título com status "Recebida" ou "Parcial" e clique no botão "Estornar" (ícone circular de rotação).',
          'O sistema retorna o título para a situação "Aberta", zera o valor recebido e a data de recebimento.',
          'Gera um movimento financeiro inverso de Saída/Estorno no caixa da empresa de igual valor, mantendo a integridade da conciliação bancária.',
          'A operação fica permanentemente registrada no Histórico de Alterações para auditoria.',
        ],
      },
      {
        title: 'Confirmação em Toda Modificação',
        description:
          'Todas as operações que gravam dados em Contas a Receber (novo título, edição de valores/datas, exclusão, baixa de recebimento e estorno) acionam um diálogo modal de confirmação:',
        substeps: [
          'Apresenta o resumo detalhado do cliente, valor e ação pretendida.',
          'Evita baixas em clientes homônimos ou exclusões acidentais.',
        ],
      },
      {
        title: 'Importação de Planilha XLSX por Mês (Reconciliação Inteligente)',
        description:
          'Mecanismo de alta performance para importação e conciliação de recebimentos a partir de planilhas Excel da empresa:',
        substeps: [
          'Clique em "Importar Planilha XLSX": selecione o arquivo com as abas dos meses (ex: JANEIRO_26, FEVEREIRO_26 até DEZEMBRO_26).',
          'Seletor de Competência por Mês: filtre a lista de abas pelo mês desejado (Janeiro a Dezembro) ou selecione a opção "Todos os meses (automático)".',
          'Botões "Marcar Todos" e "Desmarcar Todos": respeitam o mês filtrado na tela, permitindo importar apenas a competência desejada com um clique.',
          'Reconciliação e Não Duplicação: o importador casa as linhas da planilha com os títulos já existentes no sistema — classificando os registros em "Novos", "Atualizados" e detectando "Duplicadas da própria planilha", sem inflar o faturamento.',
          'Respeito à Situação da Planilha: linhas anotadas na planilha como "Já paga" entram como Recebida/Quitada, enquanto linhas com "Conta vencida" entram como Aberta.',
          'Regras Rigorosas de Segurança: o valor é lido EXCLUSIVAMENTE da coluna "VALOR DA COMPRA" (o importador ignora colunas de número de cheque ou número de nota fiscal). Datas exigem valor explícito no arquivo (o sistema nunca inventa datas).',
          'Tratamento de Divergências Cadastrais: linhas com problemas (sem data legível, sem valor ou com texto no lugar de números) NÃO são gravadas no banco de dados e aparecem nominalmente como "divergências cadastrais" no resumo final com indicação da linha e aba para conferência.',
        ],
      },
      {
        title: 'Conferir Planilha (Comparar) Sem Gravar Dados',
        description:
          'Ao lado do botão de importar, o recurso "Conferir Planilha" permite auditoria prévia do arquivo Excel:',
        substeps: [
          'Carregue a planilha e navegue aba por aba.',
          'O sistema compara em memória com o banco de dados e aponta previamente quais títulos já constam, quais são novos e se existem inconsistências cadastrais.',
          'Modo 100% seguro de consulta: nenhuma linha é gravada ou alterada no banco durante a conferência.',
        ],
      },
    ],
    tips: [
      '💡 Ao importar grandes planilhas de recebimentos anuais, faça antes a conferência no botão "Conferir Planilha" para ter certeza das competências mapeadas.',
      '💡 O campo "Cliente Depositante" aceita busca pelo Combobox pesquisável, agilizando depósitos feitos por construtoras parceiras.',
    ],
    warnings: [
      '⚠️ Nunca utilize a coluna de número de cheque como valor do recebimento. O importador do ERP protege contra isso automaticamente, exigindo a coluna "VALOR DA COMPRA".',
    ],
  },
  {
    id: 'historico-auditoria',
    title: '6. Histórico de Alterações e Auditoria',
    subtitle:
      'Rastreabilidade completa de todas as modificações no Financeiro: quem fez, quando, diff campo a campo e movimentações de caixa.',
    icon: History,
    tag: 'Auditoria & Segurança',
    steps: [
      {
        title: 'Registro Automático e Transparente',
        description:
          'Toda modificação realizada nas telas de Contas a Pagar e Contas a Receber é auditada automaticamente em tempo real sem demandar ação manual do operador:',
        substeps: [
          'Identificação do autor: grava o nome e o ID do usuário atualmente conectado no sistema.',
          'Registro temporal: data e hora exata da modificação segundo o servidor.',
          'Tipo de Ação: identificado por badges visuais coloridos — Criação, Edição, Baixa/Pagamento, Estorno e Exclusão.',
        ],
      },
      {
        title: 'Diff Inteligente Campo a Campo nas Edições',
        description:
          'Quando qualquer usuário edita um título existente, o sistema compara os dados anteriores com os novos e grava o detalhamento exato do que mudou:',
        substeps: [
          'Formato legível em português: exibe o nome do campo com seta de transição, por exemplo: "Valor Total: R$ 1.000,00 → R$ 1.200,00" ou "Vencimento: 10/03/2026 → 25/03/2026".',
          'Campos monitorados: valor total, valor pago/recebido, data de vencimento, data de emissão, data de pagamento/recebimento, fornecedor/cliente, forma de pagamento, categoria e centro de custo.',
          'Garante conformidade para prestação de contas com a diretoria e controladoria.',
        ],
      },
      {
        title: 'Visualização no Painel de Detalhes de Cada Título',
        description:
          'Ao clicar no botão "Ver Detalhes" de qualquer conta a pagar ou receber, o painel lateral exibe a seção dedicada "Histórico":',
        substeps: [
          'Lista cronológica completa das ocorrências daquele título específico.',
          'Exibe o badge de cada ação, quem operou e o diff de valores/datas.',
          'Se o título passou por estorno, exibe também os dados do movimento financeiro reverso criado.',
        ],
      },
      {
        title: 'Modal de "Histórico Geral" com Visão Consolidada',
        description:
          'No topo das páginas de Contas a Pagar e Contas a Receber, clique no botão "Histórico Geral" (ícone de histórico) para abrir a visão ampla de auditoria:',
        substeps: [
          'Lista paginada com as alterações recentes de todas as movimentações da empresa ativa.',
          'Filtros por módulo (Contas a Pagar / Contas a Receber) e por tipo de ação (Criação, Edição, Baixa, Estorno, Exclusão).',
          'Permite à gerência financeira inspecionar rapidamente as movimentações do dia e detectar incongruências.',
        ],
      },
    ],
    tips: [
      '💡 O Histórico de Alterações funciona em conjunto com os perfis de usuário do sistema: colaboradores com perfil de Leitura podem consultar a auditoria para conferência, mas não têm permissão de realizar alterações.',
    ],
    warnings: [
      '⚠️ Importante: O Histórico de Alterações passa a registrar as modificações a partir da entrada em vigor desta funcionalidade de auditoria. Alterações realizadas em versões anteriores à sua implantação não possuem registros retroativos.',
    ],
  },
  {
    id: 'financeiro-conciliacao-dre',
    title: '7. Conciliação Bancária & DRE Gerencial',
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
    title: '8. Módulo de Vendas da Pedreira',
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
        title: 'Cadastrar uma Nova Venda e Definir Logística (Frota Própria vs. Terceiro)',
        description: 'No menu Financeiro > Vendas, clique em "Nova Venda":',
        substeps: [
          'Selecione o Cliente cadastrado (ou digite no combobox pesquisável).',
          'Escolha o Tipo de Entrega / Transporte: "Frota Própria" ou "Terceiro".',
          'Se Frota Própria: selecione o Veículo/Equipamento no combobox pesquisável da frota (busca por código interno, placa e modelo). O veículo e a placa são gravados na venda e alimentam automaticamente a entrega vinculada e o romaneio A4. Em seguida, selecione o Motorista cadastrado ou digite livremente.',
          'Se Terceiro: informe o Transportador/Terceiro (nome ou empresa) no campo de texto livre e lance o Motorista do terceiro.',
          'Escolha o Produto da pedreira.',
          'Informe a Unidade (m³, ton ou viagem) e a Quantidade. Caso haja conversão (ex: Toneladas para m³), o sistema exibe o card comparativo com a densidade oficial.',
          'O sistema sugere o preço de tabela do produto; informe ou ajuste o Preço Unitário e o ERP calcula o Valor Total e descontos instantaneamente.',
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
    title: '9. Controle de Entregas & Vínculo com a Frota',
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
          'Selecione o Veículo / Caçamba da frota e o Motorista responsável nos comboboxes pesquisáveis.',
          'A rota sugerida puxa a Pedreira como origem e a cidade do cliente como destino com cálculo automático de km.',
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
    title: '10. Cadastros Gerais & Seleções Pesquisáveis',
    subtitle:
      'Clientes, Fornecedores, Produtos, Centros de Custo e Plano de Contas com busca instantânea.',
    icon: Users,
    tag: 'Cadastros',
    steps: [
      {
        title: 'Comboboxes Pesquisáveis em Todos os Módulos',
        description:
          'Para agilizar a operação diária e evitar rolagem em listas extensas, todos os campos de seleção contam com busca instantânea digitável (ComboboxPesquisavel):',
        substeps: [
          'Clientes e Fornecedores: busque por razão social, nome fantasia ou documento.',
          'Produtos da Pedreira: digite qualquer trecho do nome (ex: "brita", "rachão").',
          'Plano de Contas e Centros de Custo: localize contas contábeis e setores digitando o código ou nome.',
          'Veículos e Motoristas: encontre caminhões por placa, modelo ou setor da pedreira.',
        ],
      },
      {
        title: 'Clientes e Fornecedores com Busca Automática por CNPJ',
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
    title: '11. Recursos Humanos (RH) e Horas Extras',
    subtitle: 'Gestão da equipe de colaboradores, folha mensal e horas extras CLT.',
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
    title: '12. Gestão de Frotas & Equipamentos Pesados',
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
    title: '13. Relatórios Estratégicos',
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
  {
    id: 'pwa-celular',
    title: '14. Instalar no Celular (Aplicativo PWA)',
    subtitle:
      'Como adicionar o ERP Pedreira Cordeiro (NovaGest) na tela inicial do Android ou iPhone e utilizá-lo como aplicativo sem precisar de loja.',
    icon: Smartphone,
    tag: 'App Mobile',
    steps: [
      {
        title: 'O que é o App PWA (Progressive Web App)?',
        description:
          'O ERP Pedreira Cordeiro funciona como um aplicativo direto no seu celular: abre em tela cheia (sem barra de endereço do navegador), carrega instantaneamente com cache inteligente do sistema e fica com ícone oficial "NovaGest" na sua tela de início.',
        substeps: [
          'Não precisa baixar nada da Google Play Store nem da Apple App Store.',
          'Atualizações automáticas: sempre que o sistema recebe novidades, o app atualiza sozinho em segundo plano.',
          'Acesso rápido: basta tocar no ícone na tela inicial para entrar direto no sistema de frotas e financeiro.',
        ],
      },
      {
        title: 'Como Instalar no Celular Android (Google Chrome)',
        description:
          'Siga o passo a passo abaixo utilizando o navegador Google Chrome no seu aparelho Android:',
        substeps: [
          '1. Abra o navegador Google Chrome no celular e acesse o endereço do ERP Pedreira Cordeiro.',
          '2. Toque no botão de menu do Chrome (ícone de três pontinhos verticais ⋮ no canto superior direito).',
          '3. No menu que abrir, toque na opção "Adicionar à tela inicial" ou "Instalar aplicativo".',
          '4. Uma janela de confirmação surgirá com o nome "NovaGest - Pedreira Cordeiro ERP". Toque em "Instalar" ou "Adicionar".',
          '5. Pronto! O ícone do NovaGest aparecerá automaticamente junto aos outros aplicativos do seu celular.',
        ],
      },
      {
        title: 'Como Instalar no iPhone ou iPad (Safari)',
        description:
          'Nos dispositivos Apple iOS, a instalação é realizada de forma simples pelo navegador Safari:',
        substeps: [
          '1. Abra o navegador Safari (navegador padrão da Apple) e acesse o endereço do ERP Pedreira Cordeiro.',
          '2. Na barra inferior do Safari, toque no botão de Compartilhar (o ícone de um quadrado com uma seta apontando para cima ⎋).',
          '3. Role as opções para cima e toque em "Adicionar à Tela de Início" (ícone com um sinal de mais +).',
          '4. O sistema sugerirá o nome "NovaGest". Toque no botão "Adicionar" no canto superior direito.',
          '5. Concluído! O aplicativo já estará pronto na sua tela de início do iPhone com tela cheia.',
        ],
      },
      {
        title: 'Dicas de Uso Diário no Celular',
        description:
          'Recomendações para operadores de pátio, motoristas e encarregados que utilizam o ERP em campo:',
        substeps: [
          'Mantenha sua conexão 4G/5G ou Wi-Fi ativa para registrar baixas, abastecimentos e manutenções.',
          'O app salva as telas principais na memória do aparelho, permitindo navegação rápida mesmo em áreas com sinal oscilante da pedreira.',
          'Ao fazer login pela primeira vez, você pode optar por salvar a senha no gerenciador do seu celular para agilizar acessos futuros.',
        ],
      },
    ],
    tips: [
      '💡 O app no celular possui exatamente os mesmos módulos, permissões e segurança da versão para computador. Ao cadastrar um abastecimento ou entrega no celular, os dados aparecem instantaneamente para a diretoria.',
      '💡 Para desinstalar caso troque de aparelho, basta segurar o dedo sobre o ícone do NovaGest na tela inicial e selecionar "Remover da Tela de Início" ou "Desinstalar".',
    ],
    warnings: [
      '⚠️ No iPhone, a instalação DEVE ser feita pelo navegador Safari. Outros navegadores no iOS (como Chrome para iPhone) não possuem a permissão do sistema operacional para fixar apps na tela inicial.',
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
            Documento de Treinamento v0.0.97
          </div>
        </div>
      </div>
    </div>
  )
}
