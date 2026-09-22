migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcionariosCol = app.findCollectionByNameOrId('funcionarios')

    const folhaHorasExtrasCol = new Collection({
      name: 'folha_horas_extras',
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
          name: 'mes_referencia',
          type: 'text',
          required: true,
        },
        {
          name: 'modo_calculo',
          type: 'select',
          required: true,
          values: ['padrao_50', 'clt_vigente'],
          maxSelect: 1,
        },
        {
          name: 'salario_base',
          type: 'number',
          required: true,
        },
        {
          name: 'valor_hora_normal',
          type: 'number',
          required: true,
        },
        {
          name: 'horas_50',
          type: 'number',
          required: false,
        },
        {
          name: 'valor_horas_50',
          type: 'number',
          required: false,
        },
        {
          name: 'horas_100',
          type: 'number',
          required: false,
        },
        {
          name: 'valor_horas_100',
          type: 'number',
          required: false,
        },
        {
          name: 'total_horas',
          type: 'number',
          required: true,
        },
        {
          name: 'total_valor',
          type: 'number',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['calculado', 'aprovado', 'pago', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'conta_pagar_id',
          type: 'text',
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
        'CREATE INDEX idx_folha_he_empresa ON folha_horas_extras (empresa_id)',
        'CREATE INDEX idx_folha_he_func ON folha_horas_extras (funcionario_id)',
        'CREATE INDEX idx_folha_he_mes ON folha_horas_extras (mes_referencia)',
        'CREATE INDEX idx_folha_he_status ON folha_horas_extras (status)',
      ],
    })

    app.save(folhaHorasExtrasCol)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('folha_horas_extras')
    app.delete(col)
  },
)
