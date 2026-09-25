migrate(
  (app) => {
    // 1. Adicionar campo 'tipo_entrega' na collection 'vendas'
    // Valores: 'frota_propria' | 'terceiro'
    try {
      const vendasCol = app.findCollectionByNameOrId('vendas')
      let changedVendas = false

      if (!vendasCol.fields.getByName('tipo_entrega')) {
        vendasCol.fields.add(
          new SelectField({
            name: 'tipo_entrega',
            required: false,
            values: ['frota_propria', 'terceiro'],
            maxSelect: 1,
          }),
        )
        changedVendas = true
      }

      if (changedVendas) {
        app.save(vendasCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar tipo_entrega em vendas:', e)
    }

    // 2. Atualizar status da collection 'entregas' para suportar 'pendente' caso ainda não tenha
    try {
      const entregasCol = app.findCollectionByNameOrId('entregas')
      const statusField = entregasCol.fields.getByName('status')
      if (statusField && statusField instanceof SelectField) {
        const currentVals = statusField.values || []
        if (!currentVals.includes('pendente')) {
          statusField.values = ['pendente', 'em_transito', 'concluida', 'cancelada']
          app.save(entregasCol)
        }
      }

      // Garantir que veiculo_id não seja estritamente obrigatório caso a venda seja gerada antes de alocar veículo
      const veiculoField = entregasCol.fields.getByName('veiculo_id')
      if (veiculoField && veiculoField.required) {
        veiculoField.required = false
        app.save(entregasCol)
      }
      const kmRodadoField = entregasCol.fields.getByName('km_rodado')
      if (kmRodadoField && kmRodadoField.required) {
        kmRodadoField.required = false
        app.save(entregasCol)
      }
      const custoEstimadoField = entregasCol.fields.getByName('custo_estimado')
      if (custoEstimadoField && custoEstimadoField.required) {
        custoEstimadoField.required = false
        app.save(entregasCol)
      }
    } catch (e) {
      console.log('Erro ao ajustar collection entregas:', e)
    }
  },
  (app) => {
    try {
      const vendasCol = app.findCollectionByNameOrId('vendas')
      const f = vendasCol.fields.getByName('tipo_entrega')
      if (f) {
        vendasCol.fields.remove(f)
        app.save(vendasCol)
      }
    } catch (_) {}
  },
)
