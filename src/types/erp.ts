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
  unidade: 'un' | 'kg' | 'cx' | 'l' | 'm²' | 'serv'
  preco_custo: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
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

export interface ContaPagar {
  id: string
  empresa_id: string
  fornecedor_id?: string
  descricao: string
  categoria_id?: string
  centro_custo_id?: string
  valor: number
  vencimento: string
  parcelas?: number
  status: 'Aberta' | 'Paga' | 'Vencida'
  data_pagamento?: string
  forma_pagamento?: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  observacoes?: string
  created: string
  updated: string
  expand?: {
    fornecedor_id?: Fornecedor
    categoria_id?: PlanoConta
    centro_custo_id?: CentroCusto
  }
}

export type StatusContaReceber = 'Aberta' | 'Recebida' | 'Vencida' | 'Recebimento Antecipado'

export interface ContaReceber {
  id: string
  empresa_id: string
  cliente_id?: string
  descricao: string
  categoria_id?: string
  centro_custo_id?: string
  valor: number
  vencimento: string
  parcelas?: number
  status: StatusContaReceber
  data_recebimento?: string
  forma_recebimento?: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  observacoes?: string
  created: string
  updated: string
  expand?: {
    cliente_id?: Cliente
    categoria_id?: PlanoConta
    centro_custo_id?: CentroCusto
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
  | 'outro'

export type TipoMedidor = 'km' | 'horas'
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
  tipo_medidor: TipoMedidor
  medidor_atual: number
  combustivel_padrao?: string
  status: StatusVeiculo
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
  medidor: number
  medidor_anterior?: number
  distancia_percorrida?: number
  consumo_medio?: number
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
  custo: number
  proxima_revisao_data?: string
  proxima_revisao_medidor?: number
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
