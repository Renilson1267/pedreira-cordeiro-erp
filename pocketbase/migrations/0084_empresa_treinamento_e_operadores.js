migrate(
  (app) => {
    // 1. Encontrar ou criar campo "ativo" na tabela de usuários (_pb_users_auth_) se não existir
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(new BoolField({ name: 'ativo' }))
      app.save(usersCol)
    }

    // 2. Expandir colecao_origem em historico_alteracoes para aceitar 'operadores' se ainda não aceitar
    const histCol = app.findCollectionByNameOrId('historico_alteracoes')
    const colecaoField = histCol.fields.getByName('colecao_origem')
    if (colecaoField) {
      const vals = colecaoField.values || []
      if (!vals.includes('operadores')) {
        colecaoField.values = [...vals, 'operadores']
        app.save(histCol)
      }
    }

    // 3. Obter coleções necessárias
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresaMembrosCol = app.findCollectionByNameOrId('empresa_membros')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const veiculosCol = app.findCollectionByNameOrId('veiculos')
    const planoCol = app.findCollectionByNameOrId('plano_contas')
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')
    const contasReceberCol = app.findCollectionByNameOrId('contas_receber')
    const bancosCol = app.findCollectionByNameOrId('bancos_contas')
    const movimentosCol = app.findCollectionByNameOrId('movimentos_financeiros')
    const centrosCol = app.findCollectionByNameOrId('centros_custos')

    // 4. Criar ou localizar Empresa de Treinamento
    let treinoEmpresa
    const cnpjTreino = '99.999.999/0001-99'
    try {
      treinoEmpresa = app.findFirstRecordByData('empresas', 'cnpj', cnpjTreino)
    } catch (_) {
      treinoEmpresa = new Record(empresasCol)
      treinoEmpresa.set('nome_fantasia', 'TREINAMENTO (DADOS FICTÍCIOS)')
      treinoEmpresa.set('razao_social', 'AMBIENTE DE TREINAMENTO E SIMULAÇÃO LTDA')
      treinoEmpresa.set('cnpj', cnpjTreino)
      treinoEmpresa.set('inscricao_estadual', 'ISENTO-TREINO')
      treinoEmpresa.set('cor', '#D97706') // Âmbar 600 em destaque
      app.save(treinoEmpresa)
    }

    // 5. Vincular usuários existentes à empresa de Treinamento
    try {
      const allUsers = app.findRecordsByFilter('_pb_users_auth_', "email != ''", '', 100, 0)
      for (const u of allUsers) {
        // Garantir u.ativo = true se estiver nulo/indefinido
        try {
          if (u.get('ativo') === undefined || u.get('ativo') === null) {
            u.set('ativo', true)
            app.save(u)
          }
        } catch (_) {}

        const existsMembro = app.findRecordsByFilter(
          'empresa_membros',
          `empresa_id = '${treinoEmpresa.id}' && usuario_id = '${u.id}'`,
          '',
          1,
          0,
        )
        if (existsMembro.length === 0) {
          // Descobrir o papel que o usuário tem na matriz
          let roleToAssign = 'admin'
          try {
            const matrizMembro = app.findRecordsByFilter(
              'empresa_membros',
              `usuario_id = '${u.id}'`,
              '-created',
              1,
              0,
            )
            if (matrizMembro.length > 0) {
              roleToAssign = matrizMembro[0].getString('role') || 'admin'
            }
          } catch (_) {}

          const membroTreino = new Record(empresaMembrosCol)
          membroTreino.set('empresa_id', treinoEmpresa.id)
          membroTreino.set('usuario_id', u.id)
          membroTreino.set('role', roleToAssign)
          app.save(membroTreino)
        }
      }
    } catch (err) {
      console.log('Aviso ao vincular usuários no treino:', err)
    }

    // 6. Cadastrar Centro de Custo no Treinamento
    let ccTreino
    try {
      ccTreino = app.findFirstRecordByData('centros_custos', 'empresa_id', treinoEmpresa.id)
    } catch (_) {
      ccTreino = new Record(centrosCol)
      ccTreino.set('empresa_id', treinoEmpresa.id)
      ccTreino.set('codigo', 'CC-TREINO-01')
      ccTreino.set('nome', 'Operacional Pedreira Treinamento')
      ccTreino.set('descricao', 'Centro de custo para simulações e testes')
      ccTreino.set('cor', '#D97706')
      ccTreino.set('ativo', true)
      app.save(ccTreino)
    }

    // 7. Cadastrar Plano de Contas Treinamento
    let planoReceita, planoDespesa
    try {
      planoReceita = app.findFirstRecordByData('plano_contas', 'empresa_id', treinoEmpresa.id)
    } catch (_) {
      planoReceita = new Record(planoCol)
      planoReceita.set('empresa_id', treinoEmpresa.id)
      planoReceita.set('codigo', '1.1')
      planoReceita.set('nome', 'Venda de Brita e Agregados (Treinamento)')
      planoReceita.set('tipo', 'Receita')
      planoReceita.set('natureza', 'Credito')
      planoReceita.set('ativa', true)
      app.save(planoReceita)

      planoDespesa = new Record(planoCol)
      planoDespesa.set('empresa_id', treinoEmpresa.id)
      planoDespesa.set('codigo', '3.1')
      planoDespesa.set('nome', 'Manutenção e Combustível (Treinamento)')
      planoDespesa.set('tipo', 'Despesa')
      planoDespesa.set('natureza', 'Debito')
      planoDespesa.set('ativa', true)
      app.save(planoDespesa)
    }

    // 8. Cadastrar Banco Conta Treinamento
    let bancoTreino
    try {
      bancoTreino = app.findFirstRecordByData('bancos_contas', 'empresa_id', treinoEmpresa.id)
    } catch (_) {
      bancoTreino = new Record(bancosCol)
      bancoTreino.set('empresa_id', treinoEmpresa.id)
      bancoTreino.set('nome', 'Banco Simulado Treinamento')
      bancoTreino.set('banco', '001 - Banco do Brasil (Simulação)')
      bancoTreino.set('agencia', '0001')
      bancoTreino.set('conta', '99999-9')
      bancoTreino.set('saldo_inicial', 15000.0)
      app.save(bancoTreino)
    }

    // 9. Cadastrar Clientes Fictícios de Treinamento
    let clienteFicticio1
    try {
      clienteFicticio1 = app.findFirstRecordByData('clientes', 'empresa_id', treinoEmpresa.id)
    } catch (_) {
      clienteFicticio1 = new Record(clientesCol)
      clienteFicticio1.set('empresa_id', treinoEmpresa.id)
      clienteFicticio1.set('nome', 'Construtora Exemplo Modelo LTDA (Fictício)')
      clienteFicticio1.set('cnpj_cpf', '00.123.456/0001-99')
      clienteFicticio1.set('email', 'contato@construtoraexemplo.teste')
      clienteFicticio1.set('telefone', '(87) 99999-0001')
      clienteFicticio1.set('cidade', 'Sertânia')
      clienteFicticio1.set('uf', 'PE')
      clienteFicticio1.set('observacoes', 'Cliente fictício para treinamento de operadores')
      app.save(clienteFicticio1)

      const clienteFicticio2 = new Record(clientesCol)
      clienteFicticio2.set('empresa_id', treinoEmpresa.id)
      clienteFicticio2.set('nome', 'Pavimentadora Sertaneja Simulação (Fictício)')
      clienteFicticio2.set('cnpj_cpf', '00.987.654/0001-11')
      clienteFicticio2.set('email', 'compras@pavimentadorateste.teste')
      clienteFicticio2.set('telefone', '(87) 99999-0002')
      clienteFicticio2.set('cidade', 'Monteiro')
      clienteFicticio2.set('uf', 'PB')
      clienteFicticio2.set('observacoes', 'Cliente para prática de vendas e contas a receber')
      app.save(clienteFicticio2)
    }

    // 10. Cadastrar Fornecedores Fictícios de Treinamento
    let fornecedorFicticio1
    try {
      fornecedorFicticio1 = app.findFirstRecordByData(
        'fornecedores',
        'empresa_id',
        treinoEmpresa.id,
      )
    } catch (_) {
      fornecedorFicticio1 = new Record(fornecedoresCol)
      fornecedorFicticio1.set('empresa_id', treinoEmpresa.id)
      fornecedorFicticio1.set('nome', 'Posto Combustível Exemplo LTDA (Fictício)')
      fornecedorFicticio1.set('cnpj_cpf', '11.222.333/0001-88')
      fornecedorFicticio1.set('email', 'financeiro@postoexemplo.teste')
      fornecedorFicticio1.set('telefone', '(87) 3841-0000')
      fornecedorFicticio1.set('cidade', 'Sertânia')
      fornecedorFicticio1.set('uf', 'PE')
      fornecedorFicticio1.set('observacoes', 'Fornecedor fictício para treinamento de despesas')
      app.save(fornecedorFicticio1)
    }

    // 11. Cadastrar Veículos Fictícios de Treinamento
    let veiculoFicticio1
    try {
      veiculoFicticio1 = app.findFirstRecordByData('veiculos', 'empresa_id', treinoEmpresa.id)
    } catch (_) {
      veiculoFicticio1 = new Record(veiculosCol)
      veiculoFicticio1.set('empresa_id', treinoEmpresa.id)
      veiculoFicticio1.set('codigo_interno', 'SIM-CAM-01')
      veiculoFicticio1.set('placa', 'SIM-0001')
      veiculoFicticio1.set('tipo', 'caminhao')
      veiculoFicticio1.set('marca', 'Mercedes-Benz')
      veiculoFicticio1.set('modelo', 'Atego 2730 Caçamba (Treinamento)')
      veiculoFicticio1.set('ano', 2022)
      veiculoFicticio1.set('tipo_medidor', 'km')
      veiculoFicticio1.set('medidor_atual', 45000)
      veiculoFicticio1.set('km_atual', 45000)
      veiculoFicticio1.set('combustivel_padrao', 'Diesel S10')
      veiculoFicticio1.set('status', 'ativo')
      veiculoFicticio1.set('setor', 'Central Britagem')
      veiculoFicticio1.set('observacoes', 'Caminhão fictício de teste')
      app.save(veiculoFicticio1)

      const veiculoFicticio2 = new Record(veiculosCol)
      veiculoFicticio2.set('empresa_id', treinoEmpresa.id)
      veiculoFicticio2.set('codigo_interno', 'SIM-PA-02')
      veiculoFicticio2.set('placa', 'SIM-0002')
      veiculoFicticio2.set('tipo', 'carregadeira')
      veiculoFicticio2.set('marca', 'Caterpillar')
      veiculoFicticio2.set('modelo', 'Pá Carregadeira 924K (Treinamento)')
      veiculoFicticio2.set('ano', 2021)
      veiculoFicticio2.set('tipo_medidor', 'horas')
      veiculoFicticio2.set('medidor_atual', 3200)
      veiculoFicticio2.set('horimetro_atual', 3200)
      veiculoFicticio2.set('combustivel_padrao', 'Diesel S10')
      veiculoFicticio2.set('status', 'ativo')
      veiculoFicticio2.set('setor', 'Central Britagem')
      veiculoFicticio2.set('observacoes', 'Máquina fictícia para treinamento de horímetro')
      app.save(veiculoFicticio2)
    }

    // 12. Cadastrar Contas a Pagar Fictícias de Treinamento
    try {
      const existingCp = app.findRecordsByFilter(
        'contas_pagar',
        `empresa_id = '${treinoEmpresa.id}'`,
        '',
        1,
        0,
      )
      if (existingCp.length === 0) {
        const cp1 = new Record(contasPagarCol)
        cp1.set('empresa_id', treinoEmpresa.id)
        if (fornecedorFicticio1) cp1.set('fornecedor_id', fornecedorFicticio1.id)
        if (planoDespesa) cp1.set('categoria_id', planoDespesa.id)
        if (ccTreino) cp1.set('centro_custo_id', ccTreino.id)
        cp1.set('descricao', 'Abastecimento Simulado Diesel S10 (Treinamento)')
        cp1.set('valor', 450.0)
        cp1.set('valor_pago', 0)
        cp1.set('vencimento', '2026-10-15 00:00:00.000Z')
        cp1.set('data_emissao', '2026-10-01 00:00:00.000Z')
        cp1.set('parcelas', 1)
        cp1.set('status', 'Aberta')
        cp1.set('forma_pagamento', 'Boleto')
        cp1.set('observacoes', 'Título fictício para operadores praticarem a baixa de pagamento')
        app.save(cp1)

        const cp2 = new Record(contasPagarCol)
        cp2.set('empresa_id', treinoEmpresa.id)
        if (fornecedorFicticio1) cp2.set('fornecedor_id', fornecedorFicticio1.id)
        if (planoDespesa) cp2.set('categoria_id', planoDespesa.id)
        if (ccTreino) cp2.set('centro_custo_id', ccTreino.id)
        cp2.set('descricao', 'Manutenção Preventiva Filtros (Treinamento Quitado)')
        cp2.set('valor', 320.0)
        cp2.set('valor_pago', 320.0)
        cp2.set('vencimento', '2026-09-20 00:00:00.000Z')
        cp2.set('data_emissao', '2026-09-10 00:00:00.000Z')
        cp2.set('data_pagamento', '2026-09-20 00:00:00.000Z')
        cp2.set('parcelas', 1)
        cp2.set('status', 'Paga')
        cp2.set('forma_pagamento', 'Pix')
        cp2.set('observacoes', 'Exemplo de título pago no treinamento')
        app.save(cp2)
      }
    } catch (_) {}

    // 13. Cadastrar Contas a Receber Fictícias de Treinamento
    try {
      const existingCr = app.findRecordsByFilter(
        'contas_receber',
        `empresa_id = '${treinoEmpresa.id}'`,
        '',
        1,
        0,
      )
      if (existingCr.length === 0) {
        const cr1 = new Record(contasReceberCol)
        cr1.set('empresa_id', treinoEmpresa.id)
        if (clienteFicticio1) cr1.set('cliente_id', clienteFicticio1.id)
        if (planoReceita) cr1.set('categoria_id', planoReceita.id)
        if (ccTreino) cr1.set('centro_custo_id', ccTreino.id)
        cr1.set('descricao', 'Venda Simulada de Brita 19 - 14m³ (Treinamento)')
        cr1.set('valor', 1250.0)
        cr1.set('valor_recebido', 0)
        cr1.set('vencimento', '2026-10-25 00:00:00.000Z')
        cr1.set('data_emissao', '2026-10-05 00:00:00.000Z')
        cr1.set('parcelas', 1)
        cr1.set('status', 'Aberta')
        cr1.set('forma_recebimento', 'Pix')
        cr1.set('observacoes', 'Título para praticar recebimento e conciliação')
        app.save(cr1)
      }
    } catch (_) {}
  },
  (app) => {
    // Reversão limpa se necessário
    try {
      const treinoEmpresa = app.findFirstRecordByData('empresas', 'cnpj', '99.999.999/0001-99')
      if (treinoEmpresa) {
        // As relações e registros vinculados podem ser mantidos ou excluídos via SQL
        app
          .db()
          .newQuery('DELETE FROM empresa_membros WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM contas_pagar WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM contas_receber WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM veiculos WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM clientes WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM fornecedores WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM bancos_contas WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM plano_contas WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM centros_custos WHERE empresa_id = {:id}')
          .bind({ id: treinoEmpresa.id })
          .execute()
        app.delete(treinoEmpresa)
      }
    } catch (_) {}
  },
)
