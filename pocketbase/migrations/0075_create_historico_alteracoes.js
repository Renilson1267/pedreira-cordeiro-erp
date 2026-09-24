migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('historico_alteracoes')
      return // Já existe
    } catch (_) {}

    const empresasCol = app.findCollectionByNameOrId('empresas')

    const historicoCol = new Collection({
      name: 'historico_alteracoes',
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
          name: 'colecao_origem',
          type: 'select',
          required: true,
          values: ['contas_pagar', 'contas_receber', 'outros'],
          maxSelect: 1,
        },
        {
          name: 'registro_id',
          type: 'text',
          required: true,
        },
        {
          name: 'acao',
          type: 'select',
          required: true,
          values: ['criar', 'editar', 'excluir', 'baixa', 'estorno'],
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'text',
        },
        {
          name: 'usuario_nome',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao',
          type: 'text',
          required: true,
        },
        {
          name: 'detalhes',
          type: 'json',
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
        'CREATE INDEX idx_hist_empresa ON historico_alteracoes (empresa_id)',
        'CREATE INDEX idx_hist_registro ON historico_alteracoes (registro_id)',
        'CREATE INDEX idx_hist_colecao ON historico_alteracoes (colecao_origem)',
        'CREATE INDEX idx_hist_acao ON historico_alteracoes (acao)',
      ],
    })

    app.save(historicoCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('historico_alteracoes')
      app.delete(col)
    } catch (_) {}
  },
)
