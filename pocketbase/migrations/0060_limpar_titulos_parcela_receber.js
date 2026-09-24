/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0060: Limpeza de títulos corrompidos em contas_receber cujo valor é o Nº de parcela (ex: 1.1, 2.2)
    // Seletivo e não destrutivo:
    // Filtro base: valor > 0.5 && valor < 13 && valor != int(valor) && observacoes ~ 'Importado de planilha' && status = 'Aberta' && valor_recebido = 0
    // Além disso, alvos conhecidos explicitamente identificados na auditoria: m3emholfw7o1rt5, mu9vlmvoz8ts7f7, u6ghljoly5uth79
    // Para cada match:
    // 1. Apagar movimentos_financeiros vinculados (referencia_id = titulo.id)
    // 2. Desvincular vendas (setar conta_receber_id = '' onde conta_receber_id = titulo.id)
    // 3. Apagar o título de contas_receber

    var idsAlvoConhecidos = ['m3emholfw7o1rt5', 'mu9vlmvoz8ts7f7', 'u6ghljoly5uth79']

    var registrosParaApagar = []
    var idsProcessados = {}

    // 1. Buscar candidatos via filtro seletivo
    try {
      var candidatos = app.findRecordsByFilter(
        'contas_receber',
        'valor > 0.5 && valor < 13 && observacoes ~ "Importado de planilha" && status = "Aberta" && valor_recebido = 0',
        'created',
        500,
        0,
      )

      for (var i = 0; i < candidatos.length; i++) {
        var rec = candidatos[i]
        var val = rec.getFloat('valor')

        // Checar se não é inteiro
        var isInt = Math.floor(val) === val
        if (isInt) {
          continue
        }

        // Restringir a exatamente 1 casa decimal (padrão de parcela como 1.1, 2.2, 12.5 etc.)
        // ou pertencer à lista de IDs auditados
        var valStr = val.toString()
        var parts = valStr.split('.')
        var temUmaCasaDecimal = parts.length === 2 && parts[1].length === 1
        var isAlvoAuditado = idsAlvoConhecidos.indexOf(rec.id) !== -1

        if (temUmaCasaDecimal || isAlvoAuditado) {
          if (!idsProcessados[rec.id]) {
            idsProcessados[rec.id] = true
            registrosParaApagar.push(rec)
          }
        }
      }
    } catch (errBusca) {
      console.warn('Aviso na busca por filtro em contas_receber:', errBusca)
    }

    // Garantir que os IDs alvo auditados sejam incluídos caso ainda existam no banco
    for (var k = 0; k < idsAlvoConhecidos.length; k++) {
      var idAlvo = idsAlvoConhecidos[k]
      if (!idsProcessados[idAlvo]) {
        try {
          var recAuditado = app.findRecordById('contas_receber', idAlvo)
          if (recAuditado) {
            idsProcessados[idAlvo] = true
            registrosParaApagar.push(recAuditado)
          }
        } catch (_) {
          // Já não existe ou foi capturado
        }
      }
    }

    var apagadosCount = 0

    for (var j = 0; j < registrosParaApagar.length; j++) {
      var titulo = registrosParaApagar[j]
      var tituloId = titulo.id

      // 1. Apagar movimentos_financeiros vinculados a este título (se existirem)
      try {
        if (app.hasTable('movimentos_financeiros')) {
          app
            .db()
            .newQuery('DELETE FROM movimentos_financeiros WHERE referencia_id = {:id}')
            .bind({ id: tituloId })
            .execute()
        }
      } catch (errMov) {
        console.warn('Aviso ao apagar movimentos_financeiros para título ' + tituloId + ':', errMov)
      }

      // 2. Desvincular vendas que apontam para o título
      try {
        if (app.hasTable('vendas')) {
          app
            .db()
            .newQuery('UPDATE vendas SET conta_receber_id = "" WHERE conta_receber_id = {:id}')
            .bind({ id: tituloId })
            .execute()
        }
      } catch (errVendas) {
        console.warn('Aviso ao desvincular vendas para título ' + tituloId + ':', errVendas)
      }

      // 3. Apagar o título de contas_receber
      try {
        app.delete(titulo)
        apagadosCount++
        console.log(
          'Registro corrompido de parcela removido com sucesso: ID=' +
            tituloId +
            ' | Valor=' +
            titulo.get('valor') +
            ' | Obs=' +
            titulo.get('observacoes'),
        )
      } catch (errDel) {
        console.warn('Erro ao deletar título ' + tituloId + ':', errDel)
      }
    }

    console.log(
      'Migração 0060 concluída. Total de títulos corrompidos de parcela apagados: ' + apagadosCount,
    )
  },
  (_app) => {
    // Sem rollback necessário para deleção de dados corrompidos
  },
)
