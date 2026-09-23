migrate(
  (app) => {
    // Função auxiliar para extração inline no ambiente Goja do PocketBase
    function parseCidadeENota(descricao) {
      if (!descricao || typeof descricao !== 'string') {
        return { cidade: '', nota: '' }
      }
      var desc = descricao.trim()
      if (!desc) return { cidade: '', nota: '' }

      var nota = ''
      var cidade = ''

      // 1. Extração da Nota
      var bracketDocMatch = desc.match(
        /\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*([^\]]+)\]/i,
      )
      if (bracketDocMatch && bracketDocMatch[1].trim()) {
        nota = bracketDocMatch[1].trim()
      } else {
        var inlineDocMatch = desc.match(
          /\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+([A-Z0-9\/\s\-–]+)$/i,
        )
        if (inlineDocMatch && inlineDocMatch[1].trim()) {
          nota = inlineDocMatch[1].trim().replace(/\s+$/, '')
        } else {
          var endDigitsMatch = desc.match(
            /(?:Doc|NF|\s[-–])\s*(\d{3,8}(?:\s*[\/\-A]\s*\d{3,8})*)$/i,
          )
          if (endDigitsMatch && endDigitsMatch[1].trim()) {
            nota = endDigitsMatch[1].trim()
          }
        }
      }

      // 2. Extração da Cidade
      var textWithoutDoc = desc
        .replace(/\[(?:Doc|NF|NF-e|NFe|Nota|Duplicata|Fatura)[\s:]*[^\]]+\]/gi, '')
        .replace(/\b(?:Doc|NF|NF-e|NFe|Nota|Duplicata)[\s.:#-]+.*$/i, '')
        .trim()

      if (textWithoutDoc.indexOf('-') !== -1 || textWithoutDoc.indexOf('–') !== -1) {
        var parts = textWithoutDoc
          .replace(/[-–]/g, ' - ')
          .split(/\s+-\s+/)
          .map(function (p) {
            return p.trim()
          })
          .filter(Boolean)

        if (parts.length >= 2) {
          var bancosOuFormas =
            /^(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|NUBANK|INTER|PIX|BOLETO|TED|DOC|CHEQUE)$/i
          var candidateParts = parts.slice(1)
          if (
            candidateParts.length > 1 &&
            bancosOuFormas.test(candidateParts[candidateParts.length - 1])
          ) {
            candidateParts.pop()
          }

          if (candidateParts.length > 0) {
            var cand = candidateParts[candidateParts.length - 1]
            cand = cand
              .replace(
                /\b(?:SANTANDER|SANTADER|BRADESCO|BANCO|ITAU|BB|BRASIL|CAIXA|SICOOB|SICREDI|PIX|BOLETO)\b/gi,
                '',
              )
              .trim()
            if (cand && cand.length >= 2 && !/^\d+$/.test(cand)) {
              cidade = cand
            }
          }
        }
      }

      if (nota) {
        nota = nota.replace(/^(?:Doc|NF|NF-e|NFe|Nota)[\s.:#-]+/i, '').trim()
      }

      return { cidade: cidade, nota: nota }
    }

    // Varre todas as contas_receber existentes e popula cidade (endereco) e nota
    var records = app.findRecordsByFilter('contas_receber', 'id != ""', 'created', 5000, 0)
    for (var i = 0; i < records.length; i++) {
      var r = records[i]
      var desc = r.getString('descricao') || ''
      var currentEnd = r.getString('endereco') || ''
      var currentNota = r.getString('nota') || ''

      var extraido = parseCidadeENota(desc)
      var mudou = false

      if (!currentEnd && extraido.cidade) {
        r.set('endereco', extraido.cidade)
        mudou = true
      }
      if (!currentNota && extraido.nota) {
        r.set('nota', extraido.nota)
        mudou = true
      }

      if (mudou) {
        app.save(r)
      }
    }
  },
  (app) => {
    // Reversão opcional (não altera descrição/valores)
  },
)
