migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcionariosCol = app.findCollectionByNameOrId('funcionarios')

    const examesPeriodicosCol = new Collection({
      name: 'exames_periodicos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'funcionario_id',
          type: 'relation',
          required: true,
          collectionId: funcionariosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo_exame',
          type: 'select',
          required: true,
          values: ['periodico', 'admissional', 'demissional', 'retorno_trabalho', 'mudanca_funcao'],
          maxSelect: 1,
        },
        {
          name: 'data_exame',
          type: 'date',
          required: true,
        },
        {
          name: 'resultado',
          type: 'select',
          required: true,
          values: ['apto', 'apto_com_restricao', 'inapto'],
          maxSelect: 1,
        },
        {
          name: 'clinica_medico',
          type: 'text',
          required: false,
        },
        {
          name: 'crm',
          type: 'text',
          required: false,
        },
        {
          name: 'periodicidade_meses',
          type: 'number',
          required: false,
        },
        {
          name: 'data_proximo_exame',
          type: 'date',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_exames_empresa ON exames_periodicos (empresa_id)',
        'CREATE INDEX idx_exames_funcionario ON exames_periodicos (funcionario_id)',
        'CREATE INDEX idx_exames_tipo ON exames_periodicos (tipo_exame)',
        'CREATE INDEX idx_exames_resultado ON exames_periodicos (resultado)',
        'CREATE INDEX idx_exames_data_exame ON exames_periodicos (data_exame)',
        'CREATE INDEX idx_exames_proximo ON exames_periodicos (data_proximo_exame)',
      ],
    })

    app.save(examesPeriodicosCol)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('exames_periodicos')
    app.delete(col)
  },
)
