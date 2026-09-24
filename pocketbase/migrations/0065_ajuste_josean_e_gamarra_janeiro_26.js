/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0065: Ajustar Josean (Recebida + Movimento Caixa) e inserir Gamarra (Aberta sem caixa)
    // ERP Grupo Pedreira Cordeiro v0.0.84
    try {
      console.log('--- Iniciando Migração 0065: Ajuste Josean e Inserção Gamarra JANEIRO_26 ---')

      const EMPRESA_ID = '6nt8u83eiyzf6xr'
      const JOSEAN_CONTA_ID = 'i0e726gvl9b3v8n'
      const GAMARRA_CLIENTE_ID = 'ze9g818dqvkezan'

      // ==========================================
      // A. AJUSTE DO TÍTULO DE JOSEAN
      // ==========================================
      try {
        const contaJosean = app.findRecordById('contas_receber', JOSEAN_CONTA_ID)
        if (contaJosean) {
          contaJosean.set('status', 'Recebida')
          contaJosean.set('valor', 12.5)
          contaJosean.set('valor_recebido', 12.5)
          contaJosean.set('forma_recebimento', 'Transferência')
          contaJosean.set('data_recebimento', '2026-01-06 12:00:00.000Z')
          const obsAtual = contaJosean.getString('observacoes') || ''
          if (!obsAtual.includes('Depósito Bradesco')) {
            contaJosean.set(
              'observacoes',
              obsAtual ? `${obsAtual} | Depósito Bradesco` : 'Depósito Bradesco',
            )
          }
          app.save(contaJosean)
          console.log(
            `Conta Josean (${JOSEAN_CONTA_ID}) atualizada para status 'Recebida' com valor 12.50 e forma Transferência (Depósito Bradesco).`,
          )
        } else {
          console.warn(
            `Conta Josean (${JOSEAN_CONTA_ID}) não encontrada pelo ID. Tentando buscar por nota/cliente...`,
          )
          const contasJoseanBusca = app.findRecordsByFilter(
            'contas_receber',
            `empresa_id = "${EMPRESA_ID}" && nota = "93077"`,
            'created',
            5,
            0,
          )
          if (contasJoseanBusca.length > 0) {
            const c = contasJoseanBusca[0]
            c.set('status', 'Recebida')
            c.set('valor', 12.5)
            c.set('valor_recebido', 12.5)
            c.set('forma_recebimento', 'Transferência')
            c.set('data_recebimento', '2026-01-06 12:00:00.000Z')
            const obs = c.getString('observacoes') || ''
            if (!obs.includes('Depósito Bradesco')) {
              c.set('observacoes', obs ? `${obs} | Depósito Bradesco` : 'Depósito Bradesco')
            }
            app.save(c)
            console.log(`Conta Josean encontrada por nota (${c.id}) atualizada para 'Recebida'.`)
          }
        }
      } catch (errJosean) {
        console.error('Erro ao atualizar conta Josean:', errJosean)
        throw errJosean
      }

      // ==========================================
      // B. GARANTIR MOVIMENTO DE CAIXA DE JOSEAN (Entrada 12.50, data 2026-01-06)
      // ==========================================
      try {
        const movsExistentes = app.findRecordsByFilter(
          'movimentos_financeiros',
          `origem = "ContaReceber" && referencia_id = "${JOSEAN_CONTA_ID}"`,
          'created',
          10,
          0,
        )

        if (movsExistentes.length === 0) {
          const colMov = app.findCollectionByNameOrId('movimentos_financeiros')
          const novoMov = new Record(colMov)
          novoMov.set('empresa_id', EMPRESA_ID)
          novoMov.set('tipo', 'Entrada')
          novoMov.set('valor', 12.5)
          novoMov.set('data', '2026-01-06 12:00:00.000Z')
          novoMov.set('descricao', 'Recebimento: JOSEAN DOS SANTOS XAVIER - PATOS')
          novoMov.set('origem', 'ContaReceber')
          novoMov.set('referencia_id', JOSEAN_CONTA_ID)
          novoMov.set('conciliado', false)
          app.save(novoMov)
          console.log(
            `Movimento de caixa Entrada R$ 12,50 criado com sucesso para Josean (ref: ${JOSEAN_CONTA_ID}).`,
          )
        } else {
          console.log(
            `Movimento de caixa para Josean já existe (${movsExistentes[0].id}). Não duplicado.`,
          )
        }
      } catch (errMov) {
        console.error('Erro ao registrar movimento de caixa para Josean:', errMov)
        throw errMov
      }

      // ==========================================
      // C. INSERT DO TÍTULO DA GAMARRA (Aberta, R$ 9.450,00, SEM movimento de caixa)
      // ==========================================
      try {
        // Verificar antes se já existe por valor 9450 e nota contendo 9482 na empresa
        const contasExistentesGamarra = app.findRecordsByFilter(
          'contas_receber',
          `empresa_id = "${EMPRESA_ID}" && valor = 9450 && nota ~ "9482"`,
          'created',
          10,
          0,
        )

        if (contasExistentesGamarra.length === 0) {
          // Resolver cliente GAMARRA
          let clienteIdFinal = GAMARRA_CLIENTE_ID
          try {
            const cliCheck = app.findRecordById('clientes', GAMARRA_CLIENTE_ID)
            if (cliCheck) {
              clienteIdFinal = cliCheck.id
            }
          } catch (_e) {
            // Se não encontrou por ID fixo, busca por nome ~ GAMARRA
            const clientesGamarra = app.findRecordsByFilter(
              'clientes',
              `empresa_id = "${EMPRESA_ID}" && nome ~ "GAMARRA"`,
              'created',
              5,
              0,
            )
            if (clientesGamarra.length > 0) {
              clienteIdFinal = clientesGamarra[0].id
            }
          }

          const colContas = app.findCollectionByNameOrId('contas_receber')
          const novaContaGamarra = new Record(colContas)
          novaContaGamarra.set('empresa_id', EMPRESA_ID)
          novaContaGamarra.set('cliente_id', clienteIdFinal)
          novaContaGamarra.set('valor', 9450)
          novaContaGamarra.set('valor_recebido', 0)
          novaContaGamarra.set('vencimento', '2026-01-28 12:00:00.000Z')
          novaContaGamarra.set('status', 'Aberta')
          novaContaGamarra.set('forma_recebimento', 'Boleto')
          novaContaGamarra.set('nota', 'NF9482/90570 A 92')
          novaContaGamarra.set('endereco', 'PATOS')
          novaContaGamarra.set('descricao', '')
          novaContaGamarra.set(
            'observacoes',
            'Importado de planilha [Aba: JANEIRO_26] | Doc: NF9482/90570 A 92',
          )
          novaContaGamarra.set('parcelas', 1)

          app.save(novaContaGamarra)
          console.log(`Título da Gamarra criado com sucesso (ID: ${novaContaGamarra.id}).`)
        } else {
          console.log(
            `Título da Gamarra já existe no banco (${contasExistentesGamarra[0].id}). Não duplicado.`,
          )
        }
      } catch (errGamarra) {
        console.error('Erro ao criar título da Gamarra:', errGamarra)
        throw errGamarra
      }

      console.log('--- Migração 0065 finalizada com sucesso! ---')
    } catch (errGeral) {
      console.error('Falha geral na migração 0065:', errGeral)
      throw errGeral
    }
  },
  (_app) => {
    // Reversão
  },
)
