migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('exames_periodicos')

    // 1. Atualizar valores permitidos do tipo_exame para cobrir NR-7 e Ministério do Trabalho
    const tipoExameField = col.fields.getByName('tipo_exame')
    if (tipoExameField) {
      tipoExameField.values = [
        'periodico',
        'admissional',
        'demissional',
        'retorno_trabalho',
        'mudanca_funcao',
        'mudanca_risco',
      ]
    }

    // 2. Campo explícito de data de validade do exame (como na planilha do usuário)
    if (!col.fields.getByName('data_validade')) {
      col.fields.add(
        new DateField({
          name: 'data_validade',
          required: false,
        }),
      )
    }

    // 3. Status Geral (apto, inapto, pendente, etc.)
    if (!col.fields.getByName('status_geral')) {
      col.fields.add(
        new SelectField({
          name: 'status_geral',
          required: false,
          values: ['pendente', 'apto', 'apto_com_restricao', 'inapto', 'em_andamento'],
          maxSelect: 1,
        }),
      )
    }

    // 4. Estrutura JSON flexível para os exames complementares
    // Cada exame (aso, acuidade_visual, audiometria, avaliacao_clinica, toxicologico, rx, ecg)
    // armazena: { realizado: boolean, data_realizacao?: string, data_validade?: string, resultado?: string, observacao?: string }
    if (!col.fields.getByName('exames_complementares')) {
      col.fields.add(
        new JSONField({
          name: 'exames_complementares',
          required: false,
        }),
      )
    }

    app.save(col)

    // Adiciona índice para data_validade
    col.addIndex('idx_exames_validade', false, 'data_validade', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('exames_periodicos')
    col.removeIndex('idx_exames_validade')

    const fldValidade = col.fields.getByName('data_validade')
    if (fldValidade) col.fields.remove(fldValidade)

    const fldStatusGeral = col.fields.getByName('status_geral')
    if (fldStatusGeral) col.fields.remove(fldStatusGeral)

    const fldComplementares = col.fields.getByName('exames_complementares')
    if (fldComplementares) col.fields.remove(fldComplementares)

    app.save(col)
  },
)
