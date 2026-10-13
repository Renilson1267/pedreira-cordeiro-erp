migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const fechamentosCol = new Collection({
      name: 'fechamentos_mensais',
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
          name: 'filial_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'competencia',
          type: 'text',
          required: true, // formato YYYY-MM, ex: '2026-09'
        },
        {
          name: 'mes',
          type: 'number',
          required: false,
        },
        {
          name: 'ano',
          type: 'number',
          required: false,
        },
        // 1. Resumo
        {
          name: 'faturamento',
          type: 'number',
          required: false,
        },
        {
          name: 'producao_m3',
          type: 'number',
          required: false,
        },
        {
          name: 'valor_medio_m3',
          type: 'number',
          required: false,
        },
        // 2. Despesas por item com percentuais
        {
          name: 'despesas_itens',
          type: 'json',
          required: false, // Array<{ id: string, nome: string, valor: number, percentual?: number, ordem: number, observacao?: string }>
        },
        {
          name: 'total_despesas',
          type: 'number',
          required: false,
        },
        // 3. Consumo de Insumos
        {
          name: 'consumo_cimento_kg',
          type: 'number',
          required: false,
        },
        {
          name: 'consumo_brita_kg',
          type: 'number',
          required: false,
        },
        {
          name: 'consumo_areia_m3',
          type: 'number',
          required: false,
        },
        {
          name: 'consumo_po_pedra',
          type: 'number',
          required: false, // kg ou m³ conforme operação
        },
        {
          name: 'consumo_aditivo',
          type: 'number',
          required: false, // kg ou litros
        },
        {
          name: 'consumo_combustivel_litros',
          type: 'number',
          required: false,
        },
        {
          name: 'consumo_insumos_detalhes',
          type: 'json',
          required: false, // itens adicionais flexíveis de insumo se houver
        },
        // 4. Investimento
        {
          name: 'investimento',
          type: 'number',
          required: false,
        },
        {
          name: 'investimento_descricao',
          type: 'text',
          required: false,
        },
        // 5. Saldo após investimento
        {
          name: 'saldo_apos_investimento',
          type: 'number',
          required: false,
        },
        // Metadados / Observações gerais
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'fechado', 'entregue_diretoria'],
          maxSelect: 1,
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'responsavel_nome',
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
        'CREATE INDEX idx_fechamentos_empresa ON fechamentos_mensais (empresa_id)',
        'CREATE INDEX idx_fechamentos_competencia ON fechamentos_mensais (competencia)',
        'CREATE UNIQUE INDEX idx_fechamentos_empresa_competencia ON fechamentos_mensais (empresa_id, competencia)',
      ],
    })

    app.save(fechamentosCol)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('fechamentos_mensais')
    if (col) {
      app.delete(col)
    }
  },
)
