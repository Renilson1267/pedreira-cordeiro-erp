migrate(
  (app) => {
    // Migração de limpeza cirúrgica de dados de exemplo/demonstração criados em 2026-09-21
    // Preserva integralmente:
    // - Empresas e usuários/membros/convites
    // - Funcionários reais (importados GC MIX)
    // - Veículos e frotas reais da pedreira
    // - Centros de custos e Plano de contas estrutural
    // - Contas a receber e movimentos reais (ex: importações de 2026-09-22)
    // - Produtos reais da pedreira (Brita 12, Brita 19, Pedra rachão, Pó de pedra, Cascalhinho)

    // 1. Movimentos financeiros criados em 2026-09-21 (seeds de demonstração)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM movimentos_financeiros
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar movimentos_financeiros de exemplo:', e)
    }

    // 2. Contas a pagar criadas em 2026-09-21 (exemplos de demonstração e frotas simuladas)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM contas_pagar
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar contas_pagar de exemplo:', e)
    }

    // 3. Contas a receber de exemplo criadas em 2026-09-21 (preservando as importadas em 2026-09-22)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM contas_receber
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar contas_receber de exemplo:', e)
    }

    // 4. Créditos de clientes (limpeza defensiva se houver algum registro ligado aos exemplos)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM creditos_clientes
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar creditos_clientes de exemplo:', e)
    }

    // 5. Conciliações de exemplo se existirem
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM conciliacoes
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar conciliacoes de exemplo:', e)
    }

    // 6. Abastecimentos e manutenções criados em 2026-09-21 (caso reste algum órfão das seeds)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM abastecimentos
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar abastecimentos de exemplo:', e)
    }
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM manutencoes
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar manutencoes de exemplo:', e)
    }

    // 7. Clientes de exemplo semeados em 2026-09-21 (Alfa, Beta, Gama, Delta)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM clientes
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar clientes de exemplo:', e)
    }

    // 8. Fornecedores de exemplo criados em 2026-09-21 (Imobiliária Horizonte, Telefônica, Master Tech, Tavares, Rota 040, TratorPeças)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM fornecedores
        WHERE created < '2026-09-22 00:00:00'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar fornecedores de exemplo:', e)
    }

    // 9. Produtos genéricos PRD-001 a PRD-005 (preservando PRD-BRITA12, PRD-BRITA19, PRD-RACHAO, PRD-PO-PEDRA, PRD-CASCALHINHO)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM produtos
        WHERE codigo IN ('PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005')
           OR (created < '2026-09-22 00:00:00' AND codigo NOT LIKE 'PRD-BRITA%' AND codigo NOT IN ('PRD-RACHAO', 'PRD-PO-PEDRA', 'PRD-CASCALHINHO'))
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar produtos de exemplo:', e)
    }

    // 10. Bancos/Contas de exemplo (ex: Itaú Empresas - Principal, agência 1234, saldo 25000)
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM bancos_contas
        WHERE created < '2026-09-22 00:00:00'
           OR nome = 'Itaú Empresas - Principal'
      `)
        .execute()
    } catch (e) {
      console.log('Erro ao limpar bancos_contas de exemplo:', e)
    }
  },
  (_app) => {
    // Migração de exclusão de dados de teste (sem reversão automática para dados de teste)
  },
)
