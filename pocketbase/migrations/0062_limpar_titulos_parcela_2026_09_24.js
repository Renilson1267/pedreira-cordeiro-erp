/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0062: Limpeza de registros em contas_receber criados em 2026-09-24 cujo valor é número de parcela
    // (ex.: valor = 1.1, ou padrão X.Y com exatamente uma casa decimal não-inteira entre 0 e 13).
    //
    // Requisitos:
    // 1. Apagar movimentos financeiros vinculados (referencia_id = titulo.id).
    // 2. Desvincular vendas (conta_receber_id = '' onde conta_receber_id = titulo.id).
    // 3. Apagar os títulos de contas_receber corrompidos com valor de parcela.
    // 4. NÃO apagar os registros legítimos.

    var idsAlvoConhecidos = ['hpo8r4zgmlflo06', '5by3lkyu15meedx']
    var idsProcessados = {}
    var registrosParaApagar = []

    try {
      if (app.hasTable('contas_receber')) {
        // Buscar registros criados em 2026-09-24 com valor baixo (< 13) e status Aberta
        var candidatos = app.findRecordsByFilter(
          'contas_receber',
          'created >= "2026-09-24 00:00:00" && valor > 0 && valor < 13 && status = "Aberta" && valor_recebido = 0',
          'created',
          500,
          0,
        )

        for (var i = 0; i < candidatos.length; i++) {
          var rec = candidatos[i]
          var val = rec.getFloat('valor')

          // Se for número inteiro, pula (não é padrão 1.1, 2.2 etc.)
          var isInt = Math.floor(val) === val
          if (isInt) {
            continue
          }

          // Restringir a exatamente 1 casa decimal (ex: 1.1, 2.2 etc.)
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
      }
    } catch (errBusca) {
      console.warn('Aviso ao buscar candidatos de parcela em contas_receber:', errBusca)
    }

    // Garantir que os IDs alvo identificados sejam processados se existirem
    for (var k = 0; k < idsAlvoConhecidos.length; k++) {
      var idAlvo = idsAlvoConhecidos[k]
      if (!idsProcessados[idAlvo]) {
        try {
          var recAuditado = app.findRecordById('contas_receber', idAlvo)
          if (recAuditado) {
            idsProcessados[idAlvo] = true
            registrosParaApagar.push(recAuditado)
          }
        } catch (_) {}
      }
    }

    var apagadosCount = 0

    for (var j = 0; j < registrosParaApagar.length; j++) {
      var titulo = registrosParaApagar[j]
      var tituloId = titulo.id

      // 1. Apagar movimentos financeiros vinculados
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

      // 2. Desvincular vendas
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
          'Título corrompido de parcela apagado: ID=' +
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

    console.log('Migração 0062 concluída. Total de títulos de parcela apagados: ' + apagadosCount)
  },
  (_app) => {
    // Operação irreversível de saneamento de dados corrompidos
  },
)
