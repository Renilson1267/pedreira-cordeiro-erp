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

export interface ContaPagar {
  id: string
  empresa_id: string
  fornecedor_id?: string
  descricao: string
  categoria_id?: string
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
  }
}

export interface ContaReceber {
  id: string
  empresa_id: string
  cliente_id?: string
  descricao: string
  categoria_id?: string
  valor: number
  vencimento: string
  parcelas?: number
  status: 'Aberta' | 'Recebida' | 'Vencida'
  data_recebimento?: string
  forma_recebimento?: 'Dinheiro' | 'Pix' | 'Cartão' | 'Boleto' | 'Transferência'
  observacoes?: string
  created: string
  updated: string
  expand?: {
    cliente_id?: Cliente
    categoria_id?: PlanoConta
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
  origem: 'ContaPagar' | 'ContaReceber' | 'Manual' | 'Conciliacao'
  referencia_id?: string
  conciliado: boolean
  caixa_id?: string
  created: string
  updated: string
  expand?: {
    categoria_id?: PlanoConta
    caixa_id?: BancoConta
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
