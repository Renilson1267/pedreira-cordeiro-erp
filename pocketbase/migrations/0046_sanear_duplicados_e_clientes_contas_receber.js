/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração de saneamento:
    // 1. Apagar duplicatas exatas em contas_receber (mesma empresa + nota + valor + vencimento ou mesma empresa + descricao + valor + vencimento)
    //    mantendo o registro mais antigo (primeiro criado).
    // 2. Para registros com cliente_id vazio ou nulo, extrair o nome do cliente a partir da descrição e:
    //    - vincular a um cliente existente (busca case-insensitive);
    //    - ou criar um novo cliente na empresa caso não exista.

    function extrairNomeClienteDaDescricao(desc) {
      if (!desc || typeof desc !== 'string') return ''
      let texto = desc.trim()
      // Remove prefixos como "Recebimento " ou "RECEBIMENTO "
      texto = texto.replace(/^Recebimento\s+/i, '').trim()
      // Remove sufixos como " [Doc: ...]" ou " [NF: ...]"
      texto = texto.replace(/\s*\[(?:Doc|NF|Nota)[\s:][^\]]+\]/gi, '').trim()
      // Remove notas no final ex: " - 102941" ou " Doc: 102941"
      texto = texto.replace(/\s*[-–]\s*(?:Doc|NF|\d+).*$/i, '').trim()
      // Se houver cidade separada por hífen ex: "VITOR -ASSUNÇÃO" ou "EDIVALDO - SANTANA DOS GARROTES"
      // ou "FRANCENILDO - TAVARES", pegar a parte antes do hífen
      if (texto.includes('-') || texto.includes('–')) {
        const partes = texto.replace(/[-–]/g, ' - ').split(/\s+-\s+/)
        if (partes.length > 0 && partes[0].trim()) {
          texto = partes[0].trim()
        }
      }
      return texto.trim()
    }

    try {
      // ----------------------------------------------------
      // PARTE 1: Deduplicação de títulos idênticos
      // ----------------------------------------------------
      const todasContas = app.findRecordsByFilter('contas_receber', 'id != ""', 'created', 10000, 0)

      const vistos = new Map()
      const duplicadosParaRemover = []

      for (let i = 0; i < todasContas.length; i++) {
        const c = todasContas[i]
        const empresaId = c.getString('empresa_id') || ''
        const valor = Number(c.get('valor') || 0).toFixed(2)
        const venc = (c.getString('vencimento') || '').slice(0, 10)
        const nota = (c.getString('nota') || '').trim().toLowerCase()
        const desc = (c.getString('descricao') || '').trim().toLowerCase().slice(0, 35)

        // Chave de deduplicação primária: mesma empresa, valor, vencimento e nota (quando nota existe)
        // Ou mesma empresa, valor, vencimento e descrição normalizada
        let dedupKey = ''
        if (nota) {
          dedupKey = `${empresaId}__${venc}__${valor}__nota_${nota}`
        } else {
          dedupKey = `${empresaId}__${venc}__${valor}__desc_${desc}`
        }

        if (vistos.has(dedupKey)) {
          duplicadosParaRemover.push(c)
        } else {
          vistos.set(dedupKey, c.id)
        }
      }

      console.log('Duplicados encontrados em contas_receber:', duplicadosParaRemover.length)
      for (let i = 0; i < duplicadosParaRemover.length; i++) {
        const dup = duplicadosParaRemover[i]
        // Se houver movimentos financeiros vinculados a este id duplicado, remover antes
        try {
          const movs = app.findRecordsByFilter(
            'movimentos_financeiros',
            `referencia_id = '${dup.id}'`,
            'created',
            50,
            0,
          )
          for (let m of movs) {
            app.delete(m)
          }
        } catch (_) {}

        app.delete(dup)
      }

      // ----------------------------------------------------
      // PARTE 2: Sanear cliente_id vazio em contas_receber
      // ----------------------------------------------------
      const contasSemCliente = app.findRecordsByFilter(
        'contas_receber',
        "cliente_id = '' || cliente_id = null",
        'created',
        2000,
        0,
      )

      console.log('Contas a receber sem cliente:', contasSemCliente.length)

      // Carregar mapa de clientes existentes indexados por nome minúsculo
      const todosClientes = app.findRecordsByFilter('clientes', 'id != ""', 'created', 5000, 0)

      const clientesMap = new Map() // key: empresa_id + "___" + nome.toLowerCase()
      for (let cli of todosClientes) {
        const empId = cli.getString('empresa_id') || ''
        const n = (cli.getString('nome') || '').trim().toLowerCase()
        if (n) {
          clientesMap.set(`${empId}___${n}`, cli.id)
        }
      }

      const clientesCollection = app.findCollectionByNameOrId('clientes')

      for (let i = 0; i < contasSemCliente.length; i++) {
        const c = contasSemCliente[i]
        const empresaId = c.getString('empresa_id') || ''
        const desc = c.getString('descricao') || ''
        const nomeCliente = extrairNomeClienteDaDescricao(desc)

        if (!nomeCliente) continue

        const mapKey = `${empresaId}___${nomeCliente.toLowerCase()}`
        let resolvedClienteId = clientesMap.get(mapKey)

        if (!resolvedClienteId) {
          // Criar novo cliente
          try {
            const novoCli = new Record(clientesCollection)
            novoCli.set('empresa_id', empresaId)
            novoCli.set('nome', nomeCliente)
            novoCli.set('observacoes', 'Criado no saneamento de Contas a Receber (v0.0.55)')
            app.save(novoCli)

            resolvedClienteId = novoCli.id
            clientesMap.set(mapKey, resolvedClienteId)
            console.log('Novo cliente criado no saneamento:', nomeCliente, resolvedClienteId)
          } catch (e) {
            console.log('Erro ao criar cliente no saneamento:', nomeCliente, e)
          }
        }

        if (resolvedClienteId) {
          c.set('cliente_id', resolvedClienteId)
          app.save(c)
        }
      }
    } catch (err) {
      console.log('Erro na migracao 0046_sanear_duplicados_e_clientes_contas_receber:', err)
      throw err
    }
  },
  (app) => {
    // down migration
  },
)
