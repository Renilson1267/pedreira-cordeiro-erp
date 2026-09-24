migrate(
  (app) => {
    // Migração 0059: Correção dos títulos de recebimento da aba JANEIRO_26 gravados com dados divergentes
    // 1. Correção dos valores que capturaram o Nº DO CHEQUE (850246, 850268, 850948, 850088, 851849, 850248, 850250, 850278)
    // 2. Correção dos títulos onde 200126, 80126, 131125, 41225 etc. foram gravados sem o valor real da compra/recebimento
    // 3. Limpeza do campo `nota` quando contém texto livre como "PAGAMENTO DE BRITA", "ADIANTAMENTO", "VENDA DO BRITADOR" etc.
    // 4. Limpeza do campo `endereco` quando capturou nome de cliente/empresa entre parênteses ou parênteses quebrados

    var empresaId = '6nt8u83eiyzf6xr'

    // 1. Correções pontuais e mapeadas dos registros conhecidos de cheques com valor substituído
    var correcoesValores = [
      // 850246 -> R$ 875.00 (AGUINALDO CUNHA TERTO - CACIMBAS DE DESTERRO, nota 90569, venc 2026-01-02)
      { id: 'm6ok4bgo1tfpdwl', valor: 875.0, nota: '90569', endereco: 'CACIMBAS DE DESTERRO' },
      // 850268 -> R$ 2,135.00 (ANDRE GIRAFAS - PATOS, nota 86716 A 91585, venc 2026-01-06)
      { id: 'r0vj6qv2iyer9a5', valor: 2135.0, nota: '86716 A 91585', endereco: 'PATOS' },
      // 850948 -> R$ 1,000.00 (ou R$ 16,000.00 compra / R$ 1,000.00 recebido; na planilha: valor R$ 1,000.00, nota livre "PAGAMENTO DE BRITA", venc 2026-01-08)
      { id: '3tnos7djdmamw05', valor: 1000.0, nota: '', endereco: '' },
      // 850088 -> R$ 1,500.00 (HENRIQUE - TEIXEIRA, nota 87212 A 91603, venc 2026-01-15)
      { id: 'qklqr24xlj72v80', valor: 1500.0, nota: '87212 A 91603', endereco: 'TEIXEIRA' },
      // 851849 -> R$ 3,000.00 (ROBERTO - PATOS, nota 90825 A 93013, venc 2026-01-15)
      { id: 'jx83obk51olyd74', valor: 3000.0, nota: '90825 A 93013', endereco: 'PATOS' },
      // 850248 -> R$ 880.00 (AGUINALDO CUNHA TERTO - PATOS, nota 93483, venc 2026-01-21)
      { id: 'g04rjwarirwlatg', valor: 880.0, nota: '93483', endereco: 'PATOS' },
      // 850250 -> R$ 880.00 (AGUINALDO CUNHA TERTO - PATOS, nota 93497, venc 2026-01-24)
      { id: 'hgbjbesem62c0f2', valor: 880.0, nota: '93497', endereco: 'PATOS' },
      // 850278 -> R$ 2,050.00 (SERGIO/FRANCISCO SERGIO GREGORIO - COREMAS, nota 90732 A 92703, venc 2026-01-25)
      { id: '9vm5csq5s0x7m2h', valor: 2050.0, nota: '90732 A 92703', endereco: 'COREMAS' },

      // Títulos de cheques de outras datas onde o valor foi puxado do destino/data de compensação:
      // 80126 (venc 2026-01-03, CIPRIANO - ITAPORANGA, cheque BRAD - 000360, nota 90946 -> valor real: R$ 1,000.00)
      { id: 'x6f5hu47gues4yj', valor: 1000.0, nota: '90946', endereco: 'ITAPORANGA' },
      // 41225 (venc 2026-01-05, NENE DAS CAÇAMBAS - PATOS, cheque CEF - 000080, nota ADIANTAMENTO -> valor real: R$ 27,000.00)
      { id: 'itkwqeu35lbptkx', valor: 27000.0, nota: '', endereco: 'PATOS' },
      // 80126 (venc 2026-01-08, USINA CAICO, cheque SICR - 000048, nota PAGAMENTO DE BRITA -> valor real: R$ 3,800.00)
      { id: 's2ybsximvuhwki4', valor: 3800.0, nota: '', endereco: '' },
      // 200126 (venc 2026-01-09, GARCIA - PATOS (JOSE VIEIRA DE SOUSA), cheque -, nota 92015 A 92319 -> valor real: R$ 10,000.00)
      { id: 'l3k1qh16j1fir32', valor: 10000.0, nota: '92015 A 92319', endereco: 'PATOS' },
      // 80126 (venc 2026-01-10, CIPRIANO - ITAPORANGA, cheque BRAD - 000362, nota 87205/91484 -> valor real: R$ 1,800.00)
      { id: '3mi3btqcno73wde', valor: 1800.0, nota: '87205/91484', endereco: 'ITAPORANGA' },
      // 131125 (venc 2026-01-11, DR SIDNEY - PATOS (SUNCITY EMPREENDIMENTOS LTDA), cheque SANT - 000062 -> valor real: R$ 3,000.00)
      { id: '8up6e7fr8snm80d', valor: 3000.0, nota: '87396 A 91581', endereco: 'PATOS' },
      // 80126 (venc 2026-01-13, CIPRIANO - ITAPORANGA (MM COMERCIO), cheque BRAD - 000363 -> valor real: R$ 2,000.00)
      { id: '6h3998s8asrg0xe', valor: 2000.0, nota: '87205/87278/92623', endereco: 'ITAPORANGA' },
      // 80126 (venc 2026-01-13, CIPRIANO - ITAPORANGA (DAMIÃO PINTO DE SOUSA), cheque BRAD - 000364 -> valor real: R$ 1,800.00)
      {
        id: 'rhmjwu2sfe9yrbo',
        valor: 1800.0,
        nota: '92648/87278/91093/91121',
        endereco: 'ITAPORANGA',
      },
      // 200126 (venc 2026-01-14, ANDRE GIRAFAS - PATOS (C PINHEIROS & CIA LTDA), cheque BRAD - 000109 -> valor real: R$ 5,000.00)
      { id: 'gfp1zk3qbmj9qqn', valor: 5000.0, nota: '90351 A 92966', endereco: 'PATOS' },
      // 80126 (venc 2026-01-18, CIPRIANO - ITAPORANGA (CONSTRUTORA BRAÇO FORTE), cheque BRAD - 000366 -> valor real: R$ 1,000.00)
      { id: 'uxwnkop38jn5nks', valor: 1000.0, nota: '92702/91121/91257', endereco: 'ITAPORANGA' },
      // 200126 (venc 2026-01-20, ANDRE GIRAFAS - OLHO D'AGUA (CONCRETA CONSTRUÇÃO), cheque BRAD - 000110 -> valor real: R$ 5,000.00)
      { id: '4s4tjkpya10z94p', valor: 5000.0, nota: '92761 A 92939', endereco: "OLHO D'AGUA" },
      // 80126 (venc 2026-01-21, CIPRIANO - ITAPORANGA (BIDO PRODUTOS CERAMICOS), cheque BRAD - 000367 -> valor real: R$ 1,000.00)
      { id: '01cz0a811exg34u', valor: 1000.0, nota: '90559 a 93000', endereco: 'ITAPORANGA' },
      // 80126 (venc 2026-01-22, CIPRIANO - PATOS (DARIO TIBURTINO COSTA ME), cheque BRAD - 000368 -> valor real: R$ 1,000.00)
      { id: '1obr1iz5sk81j2t', valor: 1000.0, nota: '90825 A 93013', endereco: 'PATOS' },
    ]

    var corrigidosCount = 0

    for (var i = 0; i < correcoesValores.length; i++) {
      var c = correcoesValores[i]
      try {
        var rec = app.findRecordById('contas_receber', c.id)
        if (rec) {
          rec.set('valor', c.valor)
          if (c.nota !== undefined) {
            rec.set('nota', c.nota)
          }
          if (c.endereco !== undefined) {
            rec.set('endereco', c.endereco)
          }
          app.save(rec)
          corrigidosCount++
        }
      } catch (err) {
        console.warn('Erro ao atualizar registro específico ID ' + c.id + ':', err)
      }
    }

    // 2. Limpeza geral de texto livre no campo `nota` em todos os registros de contas_receber da empresa
    // Textos livres que não representam documento fiscal ou número de nota
    var registrosTextoNota = app.findRecordsByFilter(
      'contas_receber',
      'empresa_id = "' +
        empresaId +
        '" && (nota ~ "PAGAMENTO" || nota ~ "BRITA" || nota ~ "ADIANTAMENTO" || nota ~ "VENDA" || nota ~ "SERVIÇO" || nota ~ "VIGILÂNCIA" || nota ~ "BRITADOR")',
      'created',
      500,
      0,
    )

    for (var j = 0; j < registrosTextoNota.length; j++) {
      var rNota = registrosTextoNota[j]
      var notaAtual = rNota.getString('nota') || ''
      var obsAtual = rNota.getString('observacoes') || ''

      // Mover texto livre da nota para observações se ainda não constar
      var novaObs = obsAtual
      if (notaAtual && novaObs.indexOf(notaAtual) === -1) {
        novaObs = novaObs ? novaObs + ' | ' + notaAtual : notaAtual
      }
      rNota.set('nota', '')
      rNota.set('observacoes', novaObs)
      try {
        app.save(rNota)
        corrigidosCount++
      } catch (errSave) {
        console.warn('Erro ao limpar nota do registro ' + rNota.id + ':', errSave)
      }
    }

    // 3. Limpeza geral do campo `endereco` quando contiver parênteses com nome do cliente ou parênteses soltos
    // Ex: "ITAPORANGA (CONSTRUTORA BRAÇO FORTE S L EIRELI)", "TEIXEIRA JOSE HENRIUE AMORIM DE SOUZA)", "PATOS (ESCOLA LITERATO LTDA)"
    var registrosEnderecoSujo = app.findRecordsByFilter(
      'contas_receber',
      'empresa_id = "' + empresaId + '" && (endereco ~ "(" || endereco ~ ")")',
      'created',
      500,
      0,
    )

    for (var k = 0; k < registrosEnderecoSujo.length; k++) {
      var rEnd = registrosEnderecoSujo[k]
      var endStr = rEnd.getString('endereco') || ''

      // Se tiver parênteses, remover o conteúdo entre parênteses e caracteres de parênteses soltos
      var limpo = endStr
        .replace(/\(.*?\)/g, '')
        .replace(/[()]/g, '')
        .trim()

      // Se contiver nomes de clientes comuns colados após a cidade, limpar
      // Ex: "TEIXEIRA JOSE HENRIUE AMORIM DE SOUZA" -> "TEIXEIRA"
      var cidadesConhecidas = [
        'CACIMBAS DE DESTERRO',
        'SÃO JOSE DO BONFIM',
        'SÃO JOSE DE ESPINHARAS',
        'SÃO JOSE CAIANA',
        'SÃO SEBASTIÃO CAÇIMBAS',
        'SANTA TEREZINHA',
        'SANTANA DOS GARROTES',
        'VISTA SERRANA',
        "OLHO D'AGUA",
        'NOVA OLINDA',
        'PATOS',
        'TEIXEIRA',
        'COREMAS',
        'ITAPORANGA',
        'PIANCO',
        'DESTERRO',
        'LAGOINHA',
        'MALTA',
        'PASSAGEM',
        'IMACULADA',
        'IGARACY',
        'AGUIAR',
        'EMAS',
        'SJE',
      ]

      var cidadeIdentificada = ''
      var limpoUpper = limpo.toUpperCase()
      for (var cIdx = 0; cIdx < cidadesConhecidas.length; cIdx++) {
        var cid = cidadesConhecidas[cIdx]
        if (limpoUpper === cid || limpoUpper.indexOf(cid) === 0) {
          cidadeIdentificada = cid
          break
        }
      }

      var enderecoFinal = cidadeIdentificada || limpo
      if (enderecoFinal !== endStr) {
        rEnd.set('endereco', enderecoFinal)
        try {
          app.save(rEnd)
          corrigidosCount++
        } catch (errEnd) {
          console.warn('Erro ao salvar endereço corrigido ' + rEnd.id + ':', errEnd)
        }
      }
    }

    console.log(
      'Migração 0059 concluída. Total de operações de correção realizadas: ' + corrigidosCount,
    )
  },
  (app) => {
    // Rollback opcional
  },
)
