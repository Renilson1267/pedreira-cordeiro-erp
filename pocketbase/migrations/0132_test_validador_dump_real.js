/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Teste leve e rápido com dados reais do backup semanal
  var backupRec = app.findFirstRecordByData('backups_sistema', 'id', 'ww06tyccwxb4krr')
  if (!backupRec) return

  // Ler apenas 1 chunk para validar a estrutura sem timeout
  var chunk = app.findFirstRecordByData('backups_dados', 'backup_id', 'ww06tyccwxb4krr')
  if (!chunk) return

  var colName = chunk.getString('colecao_nome')
  var items = chunk.get('registros_json') || []
  if (!colName || !Array.isArray(items)) {
    throw new Error('Chunk inválido')
  }

  // Simular objeto de dump
  var dump = {
    meta: {
      nome_arquivo: backupRec.getString('nome_arquivo'),
      total_colecoes: 1,
      total_registros: items.length,
    },
    dados: {},
  }
  dump.dados[colName] = items

  // Validador deve extrair a coleção e contagem corretamente
  var colecoes = {}
  var candidatas = [dump.dados, dump]
  for (var i = 0; i < candidatas.length; i++) {
    var obj = candidatas[i]
    if (obj && typeof obj === 'object') {
      var keys = Object.keys(obj)
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k]
        if (key === 'meta' || key === 'dados' || key.indexOf('_backup_') === 0) continue
        if (Array.isArray(obj[key]) && !colecoes[key]) {
          colecoes[key] = obj[key].length
        }
      }
    }
  }

  if (!colecoes[colName] || colecoes[colName] !== items.length) {
    throw new Error('Falha ao validar extração de coleção do dump')
  }
})
