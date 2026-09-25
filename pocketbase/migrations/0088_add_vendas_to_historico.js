migrate(
  (app) => {
    try {
      const histCol = app.findCollectionByNameOrId('historico_alteracoes')
      const campo = histCol.fields.getByName('colecao_origem')
      if (campo && campo instanceof SelectField) {
        const valores = campo.values || []
        if (!valores.includes('vendas')) {
          valores.push('vendas')
          campo.values = valores
          app.save(histCol)
        }
      }
    } catch (e) {
      console.log('Erro ao atualizar colecao_origem em historico_alteracoes:', e)
    }
  },
  (app) => {},
)
