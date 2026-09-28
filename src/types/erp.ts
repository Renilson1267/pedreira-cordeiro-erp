export type UserRole = 'admin' | 'financeiro' | 'leitura'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  verified?: boolean
}

export interface Empresa {
  id: string
  nome_fantasia: string
  razao_social?: string
  cnpj: string
  inscricao_estadual?: string
  empresa_pai_id?: string
  cor?: string
  created: string
  updated: string
}

export interface EmpresaMembro {
  id: string
  empresa_id: string
  usuario_id: string
  role: UserRole
  expand?: {
    empresa_id?: Empresa
    usuario_id?: User
  }
}

export interface Cliente {
  id: string
  empresa_id: string
  nome: string
  cnpj_cpf?: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
  observacoes?: string
  created: string
  updated: string
}

export interface Fornecedor {
  id: string
  empresa_id: string
  nome: string
  cnpj_cpf?: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
  observacoes?: string
  created: string
  updated: string
}

export interface Produto {
  id: string
  empresa_id: string
  codigo: string
  nome: string
  categoria: 'Gestão' | 'Operacional' | 'Vendas' | 'Serviços' | 'Mercadorias' | 'Outros'
  unidade: 'un' | 'kg' | 'cx' | 'l' | 'm²' | 'serv' | 'm³' | 'ton'
  preco_custo: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  densidade?: number
  created: string
  updated: string
}

export interface PlanoConta {
  id: string
  empresa_id: string
  codigo: string
  nome: string
  tipo: 'Receita' | 'Despesa' | 'Custo' | 'Ativo' | 'Passivo'
  conta_pai_id?: string
  natureza: 'Debito' | 'Credito'
  ativa: boolean
  created: string
  updated: string
}

export interface CentroCusto {
  id: string
  empresa_id: string
  codigo: string
  nome: string
  descricao?: string
  cor?: string
  ativo: boolean
  created: string
  updated: string
}

export type StatusCredito = 'disponivel' | 'parcial' | 'utilizado'

export interface CreditoCliente {
  id: string
  empresa_id: string
  cliente_id: string
  valor: number
  saldo_restante: number
  origem: string
  descricao?: string
  data: string
  status: StatusCredito
  referencia_conta_id?: string
  created: string
  updated: string
  expand?: {
    cliente_id?: Cliente
  }
}

export type StatusContaPagar = 'Aberta' | 'Paga' | 'Vencida' | 'Parcial'

export interface ContaPagar {
  id: string
  empresa_id: string
  fornecedor_id?: string
  descricao: string
  categoria_id?: string
  centro_custo_id?: string
  valor: number
  valor_pago?: number
  vencimento: string
  data_emissao?: string
  parcelas?: number
  status: StatusContaPagar
  data_pagamento?: string
  forma_pagamento?: string
  observacoes?: string
  origem_frota?: string
  veiculo_id?: string
  created: string
  updated: string
  expand?: {
    fornecedor_id?: Fornecedor
    categoria_id?: PlanoConta
    centro_custo_id?: CentroCusto
    veiculo_id?: Veiculo
  }
}

export type StatusContaReceber =
  | 'Aberta'
  | 'Recebida'
  | 'Vencida'
  | 'Recebimento Antecipado'
  | 'Parcial'

export type TipoDesconto = 'percentual' | 'valor'

export interface FormaRecebimento {
  id: string
  empresa_id: string
  nome: string
  ativo: boolean
  ordem?: number
  created: string
  updated: string
}

export type StatusChequePredatado = 'pendente' | 'compensado'

export interface ChequePredatado {
  id: string
  empresa_id: string
  titulo_id?: string
  titulo_pagar_id?: string
  data: string
  valor: number
  numero?: string
  banco?: string
  status: StatusChequePredatado
  data_compensacao?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    titulo_id?: ContaReceber
    titulo_pagar_id?: ContaPagar
    empresa_id?: Empresa
  }
}

export interface ContaReceber {
  id: string
  empresa_id: string
  cliente_id?: string
  descricao: string
  categoria_id?: string
  centro_custo_id?: string
  valor: number
  valor_recebido?: number
  vencimento: string
  data_emissao?: string
  parcelas?: number
  status: StatusContaReceber
  data_recebimento?: string
  forma_recebimento?: string
  endereco?: string
  nota?: string
  cliente_depositante?: string
  observacoes?: string
  venda_id?: string
  tipo_desconto?: TipoDesconto
  valor_desconto?: number
  desconto_percentual?: number
  valor_bruto?: number
  created: string
  updated: string
  expand?: {
    cliente_id?: Cliente
    categoria_id?: PlanoConta
    centro_custo_id?: CentroCusto
    venda_id?: Venda
  }
}

export interface MovimentoFinanceiro {
  id: string
  empresa_id: string
  tipo: 'Entrada' | 'Saida'
  descricao: string
  valor: number
  data: string
  categoria_id?: string
  centro_custo_id?: string
  origem: 'ContaPagar' | 'ContaReceber' | 'Manual' | 'Conciliacao'
  referencia_id?: string
  conciliado: boolean
  caixa_id?: string
  created: string
  updated: string
  expand?: {
    categoria_id?: PlanoConta
    caixa_id?: BancoConta
    centro_custo_id?: CentroCusto
  }
}

export interface BancoConta {
  id: string
  empresa_id: string
  nome: string
  banco?: string
  agencia?: string
  conta?: string
  saldo_inicial: number
  created: string
  updated: string
}

export interface Conciliacao {
  id: string
  empresa_id: string
  banco_conta_id: string
  mes: string
  arquivo?: string
  status: 'EmAndamento' | 'Concluida'
  created: string
  updated: string
  expand?: {
    banco_conta_id?: BancoConta
  }
}

export interface EmpresaConvite {
  id: string
  empresa_id: string
  email: string
  role: UserRole
  token: string
  status: 'Pendente' | 'Aceito' | 'Expirado'
  created: string
  updated: string
}

export type TipoVeiculo =
  | 'caminhao'
  | 'escavadeira'
  | 'carregadeira'
  | 'perfuratriz'
  | 'trator'
  | 'betoneira'
  | 'pipa'
  | 'bomba'
  | 'central_concreto'
  | 'britador'
  | 'peneira'
  | 'moto'
  | 'carro_passeio'
  | 'outro'

export type TipoMedidor = 'km' | 'horas' | 'ambos'
export type StatusVeiculo = 'ativo' | 'manutencao' | 'inativo'

export interface Veiculo {
  id: string
  empresa_id: string
  codigo_interno: string
  placa?: string
  tipo: TipoVeiculo
  marca?: string
  modelo: string
  ano?: number
  tipo_medidor?: TipoMedidor
  medidor_atual?: number
  km_atual?: number
  horimetro_atual?: number
  combustivel_padrao?: string
  status: StatusVeiculo
  setor?: string
  valor_estimado?: number
  tag_patrimonio?: string
  observacoes?: string
  created: string
  updated: string
}

export interface Abastecimento {
  id: string
  empresa_id: string
  veiculo_id: string
  data: string
  combustivel: 'Diesel S10' | 'Diesel S500' | 'Gasolina' | 'Etanol' | 'Arla 32'
  litros: number
  preco_litro: number
  valor_total: number
  medidor?: number
  km_odometro?: number
  horimetro?: number
  medidor_anterior?: number
  distancia_percorrida?: number
  consumo_medio?: number
  consumo_km_l?: number
  consumo_l_h?: number
  custo_por_unidade?: number
  fornecedor_id?: string
  conta_pagar_id?: string
  motorista_operador?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    veiculo_id?: Veiculo
    fornecedor_id?: Fornecedor
    conta_pagar_id?: ContaPagar
  }
}

export interface Manutencao {
  id: string
  empresa_id: string
  veiculo_id: string
  tipo: 'preventiva' | 'corretiva'
  descricao: string
  fornecedor_id?: string
  oficina_nome?: string
  data: string
  medidor_no_momento?: number
  km_no_momento?: number
  horimetro_no_momento?: number
  custo: number
  proxima_revisao_data?: string
  proxima_revisao_medidor?: number
  proxima_revisao_km?: number
  proxima_revisao_horimetro?: number
  conta_pagar_id?: string
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
  observacoes?: string
  created: string
  updated: string
  expand?: {
    veiculo_id?: Veiculo
    fornecedor_id?: Fornecedor
    conta_pagar_id?: ContaPagar
  }
}

export type SetorFuncionario =
  | 'Britagem'
  | 'Concreto'
  | 'Lokotrack'
  | 'Frota'
  | 'Administrativo'
  | 'Outro'

export type StatusFuncionario = 'ativo' | 'ferias' | 'afastado' | 'demitido'

export interface Funcionario {
  id: string
  empresa_id: string
  nome: string
  cpf?: string
  cargo: string
  setor: SetorFuncionario
  data_admissao?: string
  salario?: number
  telefone?: string
  email?: string
  status: StatusFuncionario
  chave_pix?: string
  banco_conta?: string
  observacoes?: string
  created: string
  updated: string
}

export type ModoCalculoHorasExtras = 'padrao_50' | 'clt_vigente'
export type StatusFolhaHorasExtras = 'calculado' | 'aprovado' | 'pago' | 'cancelado'

export interface FolhaHorasExtras {
  id: string
  empresa_id: string
  funcionario_id: string
  mes_referencia: string
  modo_calculo: ModoCalculoHorasExtras
  salario_base: number
  valor_hora_normal: number
  horas_50: number
  valor_horas_50: number
  horas_100: number
  valor_horas_100: number
  total_horas: number
  total_valor: number
  gratificacao?: number
  adiantamento?: number
  valor_liquido?: number
  status: StatusFolhaHorasExtras
  conta_pagar_id?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    empresa_id?: Empresa
    funcionario_id?: Funcionario
  }
}

export type StatusEntrega = 'pendente' | 'em_transito' | 'concluida' | 'cancelada'
export type UnidadeMedidaCarga = 'm³' | 'ton' | 'viagem'

export type TipoEntregaVenda = 'frota_propria' | 'terceiro'
export type StatusVenda = 'Pendente' | 'Faturada' | 'Paga' | 'Cancelada'
export type FormaPagamentoVenda =
  | 'Dinheiro'
  | 'Pix'
  | 'Boleto'
  | 'Cartão'
  | 'Transferência'
  | 'A Prazo'
  | 'Outro'

export interface Venda {
  id: string
  empresa_id: string
  cliente_id?: string
  produto_id?: string
  produto_nome?: string
  quantidade: number
  unidade: 'm³' | 'ton' | 'un' | 'viagem'
  preco_unitario: number
  valor_total: number
  data_venda: string
  forma_pagamento?: FormaPagamentoVenda
  status: StatusVenda
  nota_fiscal?: string
  conta_receber_id?: string
  observacoes?: string
  tipo_desconto?: TipoDesconto
  valor_desconto?: number
  desconto_percentual?: number
  valor_bruto?: number
  tipo_entrega?: TipoEntregaVenda
  sequencial_romaneio?: string
  numero_sequencial?: number
  veiculo_id?: string
  veiculo_identificacao?: string
  placa?: string
  transportador_terceiro?: string
  motorista?: string
  created: string
  updated: string
  expand?: {
    empresa_id?: Empresa
    cliente_id?: Cliente
    produto_id?: Produto
    veiculo_id?: Veiculo
  }
}

export type NaturezaDespesaFrota = 'Despesa' | 'Abatimento'
export type TipoDespesaFrota =
  | 'Manutenção'
  | 'Combustível'
  | 'Pneus'
  | 'Peças'
  | 'Seguro'
  | 'IPVA / Taxas'
  | 'Lubrificantes'
  | 'Abatimento / Desconto'
  | 'Outros'

export type AcaoHistorico = 'criar' | 'editar' | 'excluir' | 'baixa' | 'estorno'
export type ColecaoOrigemHistorico =
  | 'contas_pagar'
  | 'contas_receber'
  | 'cheques_predatados'
  | 'formas_recebimento'
  | 'vendas'
  | 'outros'

export interface DetalheAlteracaoCampo {
  campo: string
  campo_label: string
  valor_anterior: any
  valor_novo: any
  valor_anterior_formatado?: string
  valor_novo_formatado?: string
}

export interface HistoricoAlteracao {
  id: string
  empresa_id: string
  colecao_origem: ColecaoOrigemHistorico
  registro_id: string
  acao: AcaoHistorico
  usuario_id?: string
  usuario_nome: string
  descricao: string
  detalhes?: {
    alteracoes?: DetalheAlteracaoCampo[]
    movimento_inverso?: {
      tipo: 'Entrada' | 'Saida'
      valor: number
      movimento_id?: string
    }
    documento?: string
    valor?: number
    extra?: Record<string, any>
  }
  created: string
  updated: string
}

export interface DespesaFrota {
  id: string
  empresa_id: string
  veiculo_id: string
  placa_patrimonio?: string
  setor: string
  natureza: NaturezaDespesaFrota
  tipo: TipoDespesaFrota
  descricao: string
  fornecedor_id?: string
  fornecedor_nome?: string
  data: string
  valor: number
  status: 'Pendente' | 'Pago' | 'Cancelado'
  conta_pagar_id?: string
  referencia_origem?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    veiculo_id?: Veiculo
    fornecedor_id?: Fornecedor
    conta_pagar_id?: ContaPagar
  }
}

export type TipoExameOcupacional =
  | 'periodico'
  | 'admissional'
  | 'demissional'
  | 'retorno_trabalho'
  | 'mudanca_funcao'

export type ResultadoExameOcupacional = 'apto' | 'apto_com_restricao' | 'inapto'

export type StatusCalculadoExame = 'em_dia' | 'vence_em_breve' | 'vencido'

export interface ExamePeriodico {
  id: string
  empresa_id: string
  funcionario_id: string
  tipo_exame: TipoExameOcupacional
  data_exame: string
  resultado: ResultadoExameOcupacional
  clinica_medico?: string
  crm?: string
  periodicidade_meses?: number
  data_proximo_exame?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    empresa_id?: Empresa
    funcionario_id?: Funcionario
  }
}

export interface Entrega {
  id: string
  empresa_id: string
  veiculo_id: string
  venda_id?: string
  cliente_id?: string
  cliente_nome?: string
  data: string
  origem: string
  destino: string
  km_rodado: number
  km_rota?: number
  km_inicial?: number
  km_final?: number
  motorista?: string
  funcionario_id?: string
  produto_id?: string
  produto_nome?: string
  quantidade?: number
  unidade_medida?: UnidadeMedidaCarga
  consumo_estimado_km_l?: number
  preco_combustivel_litro?: number
  litros_estimados?: number
  custo_estimado: number
  custo_por_km?: number
  valor_venda?: number
  preco_unitario_venda?: number
  status: StatusEntrega
  conta_pagar_id?: string
  observacoes?: string
  sequencial_romaneio?: string
  numero_sequencial?: number
  created: string
  updated: string
  expand?: {
    empresa_id?: Empresa
    veiculo_id?: Veiculo
    funcionario_id?: Funcionario
    produto_id?: Produto
    conta_pagar_id?: ContaPagar
    venda_id?: Venda
    cliente_id?: Cliente
  }
}
