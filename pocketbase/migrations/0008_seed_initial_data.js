migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresaMembrosCol = app.findCollectionByNameOrId('empresa_membros')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const planoCol = app.findCollectionByNameOrId('plano_contas')
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    const bancosCol = app.findCollectionByNameOrId('bancos_contas')
    const movimentosCol = app.findCollectionByNameOrId('movimentos_financeiros')

    // 1. Seed or get Admin User
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'gcmixsje@gmail.com')
    } catch (_) {
      adminUser = new Record(usersCol)
      adminUser.setEmail('gcmixsje@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Administrador NovaGest')
      app.save(adminUser)
    }

    // 2. Seed or get Default Company
    let defaultEmpresa
    try {
      defaultEmpresa = app.findFirstRecordByData('empresas', 'cnpj', '00.000.000/0001-00')
    } catch (_) {
      defaultEmpresa = new Record(empresasCol)
      defaultEmpresa.set('nome_fantasia', 'NovaGest Principal')
      defaultEmpresa.set('razao_social', 'NovaGest Soluções Empresariais Ltda')
      defaultEmpresa.set('cnpj', '00.000.000/0001-00')
      defaultEmpresa.set('inscricao_estadual', '123.456.789.000')
      defaultEmpresa.set('cor', '#0F766E')
      app.save(defaultEmpresa)
    }

    // 3. Seed Membership
    try {
      const existingMembros = app.findRecordsByFilter(
        'empresa_membros',
        `empresa_id = '${defaultEmpresa.id}' && usuario_id = '${adminUser.id}'`,
        '',
        1,
        0,
      )
      if (existingMembros.length === 0) {
        const membro = new Record(empresaMembrosCol)
        membro.set('empresa_id', defaultEmpresa.id)
        membro.set('usuario_id', adminUser.id)
        membro.set('role', 'admin')
        app.save(membro)
      }
    } catch (_) {}

    // 4. Seed Bank Account
    let contaPrincipal
    try {
      contaPrincipal = app.findFirstRecordByData('bancos_contas', 'empresa_id', defaultEmpresa.id)
    } catch (_) {
      contaPrincipal = new Record(bancosCol)
      contaPrincipal.set('empresa_id', defaultEmpresa.id)
      contaPrincipal.set('nome', 'Itaú Empresas - Principal')
      contaPrincipal.set('banco', '341 - Itaú Unibanco')
      contaPrincipal.set('agencia', '1234')
      contaPrincipal.set('conta', '98765-4')
      contaPrincipal.set('saldo_inicial', 25000.0)
      app.save(contaPrincipal)
    }

    // 5. Seed Plano de Contas
    const contasPlanoData = [
      { codigo: '1.1', nome: 'Receita de Vendas e Serviços', tipo: 'Receita', natureza: 'Credito' },
      { codigo: '1.2', nome: 'Outras Receitas Operacionais', tipo: 'Receita', natureza: 'Credito' },
      { codigo: '2.1', nome: 'Custo de Mercadorias e Serviços', tipo: 'Custo', natureza: 'Debito' },
      {
        codigo: '3.1',
        nome: 'Despesas com Salários e Encargos',
        tipo: 'Despesa',
        natureza: 'Debito',
      },
      {
        codigo: '3.2',
        nome: 'Despesas com Aluguel e Condomínio',
        tipo: 'Despesa',
        natureza: 'Debito',
      },
      {
        codigo: '3.3',
        nome: 'Despesas com Internet e Telefonia',
        tipo: 'Despesa',
        natureza: 'Debito',
      },
      {
        codigo: '3.4',
        nome: 'Despesas Financeiras e Tarifas',
        tipo: 'Despesa',
        natureza: 'Debito',
      },
      {
        codigo: '4.1',
        nome: 'Disponibilidades em Caixa e Bancos',
        tipo: 'Ativo',
        natureza: 'Debito',
      },
      { codigo: '5.1', nome: 'Fornecedores a Pagar', tipo: 'Passivo', natureza: 'Credito' },
    ]

    const mapPlano = {}
    for (const c of contasPlanoData) {
      try {
        const records = app.findRecordsByFilter(
          'plano_contas',
          `empresa_id = '${defaultEmpresa.id}' && codigo = '${c.codigo}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          mapPlano[c.codigo] = records[0]
          continue
        }
      } catch (_) {}

      const rec = new Record(planoCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('codigo', c.codigo)
      rec.set('nome', c.nome)
      rec.set('tipo', c.tipo)
      rec.set('natureza', c.natureza)
      rec.set('ativa', true)
      app.save(rec)
      mapPlano[c.codigo] = rec
    }

    // 6. Seed Fornecedores
    const fornecedoresData = [
      {
        nome: 'Imobiliária Horizonte S/A',
        cnpj_cpf: '11.222.333/0001-44',
        email: 'contato@horizonteimoveis.com.br',
        telefone: '(11) 3222-1100',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      {
        nome: 'Telefônica Brasil Telecom',
        cnpj_cpf: '02.558.157/0001-62',
        email: 'empresas@telecomcorp.com.br',
        telefone: '(11) 4004-7788',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      {
        nome: 'Distribuidora Master Tech Ltda',
        cnpj_cpf: '23.456.789/0001-01',
        email: 'vendas@mastertech.com.br',
        telefone: '(19) 3888-9900',
        cidade: 'Campinas',
        uf: 'SP',
      },
      {
        nome: 'Auditoria & Contabilidade Tavares',
        cnpj_cpf: '34.567.890/0001-12',
        email: 'financeiro@tavarescontabil.com.br',
        telefone: '(11) 3555-4321',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    ]

    const mapFornecedores = {}
    for (const f of fornecedoresData) {
      try {
        const records = app.findRecordsByFilter(
          'fornecedores',
          `empresa_id = '${defaultEmpresa.id}' && nome = '${f.nome}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          mapFornecedores[f.nome] = records[0]
          continue
        }
      } catch (_) {}

      const rec = new Record(fornecedoresCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('nome', f.nome)
      rec.set('cnpj_cpf', f.cnpj_cpf)
      rec.set('email', f.email)
      rec.set('telefone', f.telefone)
      rec.set('endereco', 'Av. Paulista, 1000 - Conj 50')
      rec.set('cidade', f.cidade)
      rec.set('uf', f.uf)
      rec.set('cep', '01310-100')
      app.save(rec)
      mapFornecedores[f.nome] = rec
    }

    // 7. Seed Clientes
    const clientesData = [
      {
        nome: 'Alfa Soluções Digitais Ltda',
        cnpj_cpf: '45.678.901/0001-23',
        email: 'financeiro@alfadigital.com.br',
        telefone: '(11) 98765-4321',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      {
        nome: 'Beta Consultoria & Gestão',
        cnpj_cpf: '56.789.012/0001-34',
        email: 'contas@betaconsultoria.com.br',
        telefone: '(21) 99887-7665',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
      },
      {
        nome: 'Gama Logística e Transportes',
        cnpj_cpf: '67.890.123/0001-45',
        email: 'pagamentos@gamalog.com.br',
        telefone: '(31) 3344-5566',
        cidade: 'Belo Horizonte',
        uf: 'MG',
      },
      {
        nome: 'Delta Indústria & Comércio',
        cnpj_cpf: '78.901.234/0001-56',
        email: 'compras@deltaindustria.com.br',
        telefone: '(41) 3012-9876',
        cidade: 'Curitiba',
        uf: 'PR',
      },
    ]

    const mapClientes = {}
    for (const c of clientesData) {
      try {
        const records = app.findRecordsByFilter(
          'clientes',
          `empresa_id = '${defaultEmpresa.id}' && nome = '${c.nome}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          mapClientes[c.nome] = records[0]
          continue
        }
      } catch (_) {}

      const rec = new Record(clientesCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('nome', c.nome)
      rec.set('cnpj_cpf', c.cnpj_cpf)
      rec.set('email', c.email)
      rec.set('telefone', c.telefone)
      rec.set('endereco', 'Rua Comercial, 250')
      rec.set('cidade', c.cidade)
      rec.set('uf', c.uf)
      rec.set('cep', '04567-000')
      app.save(rec)
      mapClientes[c.nome] = rec
    }

    // 8. Seed Produtos
    const produtosData = [
      {
        codigo: 'PRD-001',
        nome: 'Plano Gestão ERP Cloud (Mensal)',
        categoria: 'Serviços',
        unidade: 'serv',
        preco_custo: 45.0,
        preco_venda: 280.0,
        estoque: 999,
        estoque_minimo: 10,
      },
      {
        codigo: 'PRD-002',
        nome: 'Módulo Fiscal & Sped',
        categoria: 'Vendas',
        unidade: 'serv',
        preco_custo: 30.0,
        preco_venda: 150.0,
        estoque: 999,
        estoque_minimo: 5,
      },
      {
        codigo: 'PRD-003',
        nome: 'Leitor de Código de Barras USB',
        categoria: 'Mercadorias',
        unidade: 'un',
        preco_custo: 120.0,
        preco_venda: 249.9,
        estoque: 42,
        estoque_minimo: 15,
      },
      {
        codigo: 'PRD-004',
        nome: 'Bobina Térmica 80mm Caixa c/ 30',
        categoria: 'Operacional',
        unidade: 'cx',
        preco_custo: 65.0,
        preco_venda: 110.0,
        estoque: 18,
        estoque_minimo: 20,
      },
      {
        codigo: 'PRD-005',
        nome: 'Consultoria Implantação (Hora)',
        categoria: 'Serviços',
        unidade: 'serv',
        preco_custo: 80.0,
        preco_venda: 220.0,
        estoque: 150,
        estoque_minimo: 20,
      },
    ]

    for (const p of produtosData) {
      try {
        const records = app.findRecordsByFilter(
          'produtos',
          `empresa_id = '${defaultEmpresa.id}' && codigo = '${p.codigo}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(produtosCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('codigo', p.codigo)
      rec.set('nome', p.nome)
      rec.set('categoria', p.categoria)
      rec.set('unidade', p.unidade)
      rec.set('preco_custo', p.preco_custo)
      rec.set('preco_venda', p.preco_venda)
      rec.set('estoque', p.estoque)
      rec.set('estoque_minimo', p.estoque_minimo)
      app.save(rec)
    }

    // 9. Dates helper for current month
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const d10 = `${currentYear}-${currentMonth}-10 00:00:00.000Z`
    const d15 = `${currentYear}-${currentMonth}-15 00:00:00.000Z`
    const d20 = `${currentYear}-${currentMonth}-20 00:00:00.000Z`
    const d25 = `${currentYear}-${currentMonth}-25 00:00:00.000Z`
    const d28 = `${currentYear}-${currentMonth}-28 00:00:00.000Z`

    // 10. Seed Contas a Pagar
    const pagarData = [
      {
        descricao: 'Aluguel do Escritório Central',
        fornecedor: 'Imobiliária Horizonte S/A',
        categoria: '3.2',
        valor: 4500.0,
        vencimento: d10,
        status: 'Paga',
        data_pagamento: d10,
        forma_pagamento: 'Transferência',
      },
      {
        descricao: 'Internet Fibra Dedicada e Telefonia',
        fornecedor: 'Telefônica Brasil Telecom',
        categoria: '3.3',
        valor: 680.0,
        vencimento: d15,
        status: 'Paga',
        data_pagamento: d15,
        forma_pagamento: 'Boleto',
      },
      {
        descricao: 'Folha de Pagamento da Equipe',
        fornecedor: null,
        categoria: '3.1',
        valor: 14800.0,
        vencimento: d20,
        status: 'Aberta',
        data_pagamento: null,
        forma_pagamento: 'Pix',
      },
      {
        descricao: 'Honorários de Assessoria Contábil',
        fornecedor: 'Auditoria & Contabilidade Tavares',
        categoria: '3.4',
        valor: 1850.0,
        vencimento: d25,
        status: 'Aberta',
        data_pagamento: null,
        forma_pagamento: 'Boleto',
      },
      {
        descricao: 'Compra de Estoque - Leitores e Acessórios',
        fornecedor: 'Distribuidora Master Tech Ltda',
        categoria: '2.1',
        valor: 3200.0,
        vencimento: d28,
        status: 'Aberta',
        data_pagamento: null,
        forma_pagamento: 'Boleto',
      },
    ]

    for (const cp of pagarData) {
      try {
        const records = app.findRecordsByFilter(
          'contas_pagar',
          `empresa_id = '${defaultEmpresa.id}' && descricao = '${cp.descricao}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(contasPagarCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('descricao', cp.descricao)
      if (cp.fornecedor && mapFornecedores[cp.fornecedor]) {
        rec.set('fornecedor_id', mapFornecedores[cp.fornecedor].id)
      }
      if (cp.categoria && mapPlano[cp.categoria]) {
        rec.set('categoria_id', mapPlano[cp.categoria].id)
      }
      rec.set('valor', cp.valor)
      rec.set('vencimento', cp.vencimento)
      rec.set('parcelas', 1)
      rec.set('status', cp.status)
      if (cp.data_pagamento) rec.set('data_pagamento', cp.data_pagamento)
      if (cp.forma_pagamento) rec.set('forma_pagamento', cp.forma_pagamento)
      app.save(rec)

      // If paid, seed corresponding financial movement
      if (cp.status === 'Paga') {
        const mov = new Record(movimentosCol)
        mov.set('empresa_id', defaultEmpresa.id)
        mov.set('tipo', 'Saida')
        mov.set('descricao', `Pagamento: ${cp.descricao}`)
        mov.set('valor', cp.valor)
        mov.set('data', cp.data_pagamento)
        if (cp.categoria && mapPlano[cp.categoria]) {
          mov.set('categoria_id', mapPlano[cp.categoria].id)
        }
        mov.set('origem', 'ContaPagar')
        mov.set('referencia_id', rec.id)
        mov.set('conciliado', true)
        if (contaPrincipal) mov.set('caixa_id', contaPrincipal.id)
        app.save(mov)
      }
    }

    // 11. Seed Contas a Receber
    const receberData = [
      {
        descricao: 'Fatura Mensalidade ERP - Alfa Digital',
        cliente: 'Alfa Soluções Digitais Ltda',
        categoria: '1.1',
        valor: 8900.0,
        vencimento: d10,
        status: 'Recebida',
        data_recebimento: d10,
        forma_recebimento: 'Pix',
      },
      {
        descricao: 'Consultoria de Implantação - Beta Gestão',
        cliente: 'Beta Consultoria & Gestão',
        categoria: '1.1',
        valor: 6400.0,
        vencimento: d15,
        status: 'Recebida',
        data_recebimento: d15,
        forma_recebimento: 'Transferência',
      },
      {
        descricao: 'Licenciamento Anual - Gama Transportes',
        cliente: 'Gama Logística e Transportes',
        categoria: '1.1',
        valor: 12500.0,
        vencimento: d20,
        status: 'Aberta',
        data_recebimento: null,
        forma_recebimento: 'Boleto',
      },
      {
        descricao: 'Fornecimento de Equipamentos - Delta Indústria',
        cliente: 'Delta Indústria & Comércio',
        categoria: '1.2',
        valor: 5800.0,
        vencimento: d25,
        status: 'Aberta',
        data_recebimento: null,
        forma_recebimento: 'Boleto',
      },
    ]

    for (const cr of receberData) {
      try {
        const records = app.findRecordsByFilter(
          'contas_receber',
          `empresa_id = '${defaultEmpresa.id}' && descricao = '${cr.descricao}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(contasReceberCol)
      rec.set('empresa_id', defaultEmpresa.id)
      rec.set('descricao', cr.descricao)
      if (cr.cliente && mapClientes[cr.cliente]) {
        rec.set('cliente_id', mapClientes[cr.cliente].id)
      }
      if (cr.categoria && mapPlano[cr.categoria]) {
        rec.set('categoria_id', mapPlano[cr.categoria].id)
      }
      rec.set('valor', cr.valor)
      rec.set('vencimento', cr.vencimento)
      rec.set('parcelas', 1)
      rec.set('status', cr.status)
      if (cr.data_recebimento) rec.set('data_recebimento', cr.data_recebimento)
      if (cr.forma_recebimento) rec.set('forma_recebimento', cr.forma_recebimento)
      app.save(rec)

      // If received, seed financial movement
      if (cr.status === 'Recebida') {
        const mov = new Record(movimentosCol)
        mov.set('empresa_id', defaultEmpresa.id)
        mov.set('tipo', 'Entrada')
        mov.set('descricao', `Recebimento: ${cr.descricao}`)
        mov.set('valor', cr.valor)
        mov.set('data', cr.data_recebimento)
        if (cr.categoria && mapPlano[cr.categoria]) {
          mov.set('categoria_id', mapPlano[cr.categoria].id)
        }
        mov.set('origem', 'ContaReceber')
        mov.set('referencia_id', rec.id)
        mov.set('conciliado', true)
        if (contaPrincipal) mov.set('caixa_id', contaPrincipal.id)
        app.save(mov)
      }
    }
  },
  (app) => {},
)
