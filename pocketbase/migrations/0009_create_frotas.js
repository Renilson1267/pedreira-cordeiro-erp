migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
    const contasPagarCol = app.findCollectionByNameOrId('contas_pagar')

    // 1. Veiculos / Equipamentos
    const veiculos = new Collection({
      name: 'veiculos',
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
        { name: 'codigo_interno', type: 'text', required: true },
        { name: 'placa', type: 'text' },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['caminhao', 'escavadeira', 'carregadeira', 'perfuratriz', 'trator', 'outro'],
          maxSelect: 1,
        },
        { name: 'marca', type: 'text' },
        { name: 'modelo', type: 'text', required: true },
        { name: 'ano', type: 'number' },
        {
          name: 'tipo_medidor',
          type: 'select',
          required: true,
          values: ['km', 'horas'],
          maxSelect: 1,
        },
        { name: 'medidor_atual', type: 'number', required: true },
        {
          name: 'combustivel_padrao',
          type: 'select',
          values: ['Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol', 'Arla 32', 'Eletrico'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'manutencao', 'inativo'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_veiculos_empresa ON veiculos (empresa_id)',
        'CREATE INDEX idx_veiculos_codigo ON veiculos (codigo_interno)',
        'CREATE INDEX idx_veiculos_status ON veiculos (status)',
        'CREATE INDEX idx_veiculos_tipo ON veiculos (tipo)',
      ],
    })
    app.save(veiculos)

    const veiculosCol = app.findCollectionByNameOrId('veiculos')

    // 2. Abastecimentos
    const abastecimentos = new Collection({
      name: 'abastecimentos',
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
          name: 'veiculo_id',
          type: 'relation',
          required: true,
          collectionId: veiculosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'combustivel',
          type: 'select',
          required: true,
          values: ['Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol', 'Arla 32'],
          maxSelect: 1,
        },
        { name: 'litros', type: 'number', required: true },
        { name: 'preco_litro', type: 'number', required: true },
        { name: 'valor_total', type: 'number', required: true },
        { name: 'medidor', type: 'number', required: true },
        { name: 'medidor_anterior', type: 'number' },
        { name: 'distancia_percorrida', type: 'number' },
        { name: 'consumo_medio', type: 'number' }, // km/l ou l/h
        { name: 'custo_por_unidade', type: 'number' }, // R$/km ou R$/h
        {
          name: 'fornecedor_id',
          type: 'relation',
          collectionId: fornecedoresCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'conta_pagar_id',
          type: 'relation',
          collectionId: contasPagarCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'motorista_operador', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_abast_empresa ON abastecimentos (empresa_id)',
        'CREATE INDEX idx_abast_veiculo ON abastecimentos (veiculo_id)',
        'CREATE INDEX idx_abast_data ON abastecimentos (data)',
      ],
    })
    app.save(abastecimentos)

    // 3. Manutenções
    const manutencoes = new Collection({
      name: 'manutencoes',
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
          name: 'veiculo_id',
          type: 'relation',
          required: true,
          collectionId: veiculosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['preventiva', 'corretiva'],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'fornecedor_id',
          type: 'relation',
          collectionId: fornecedoresCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'oficina_nome', type: 'text' },
        { name: 'data', type: 'date', required: true },
        { name: 'medidor_no_momento', type: 'number' },
        { name: 'custo', type: 'number', required: true },
        { name: 'proxima_revisao_data', type: 'date' },
        { name: 'proxima_revisao_medidor', type: 'number' },
        {
          name: 'conta_pagar_id',
          type: 'relation',
          collectionId: contasPagarCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['agendada', 'em_andamento', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_manut_empresa ON manutencoes (empresa_id)',
        'CREATE INDEX idx_manut_veiculo ON manutencoes (veiculo_id)',
        'CREATE INDEX idx_manut_data ON manutencoes (data)',
        'CREATE INDEX idx_manut_status ON manutencoes (status)',
      ],
    })
    app.save(manutencoes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('manutencoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('abastecimentos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('veiculos'))
    } catch (_) {}
  },
)
