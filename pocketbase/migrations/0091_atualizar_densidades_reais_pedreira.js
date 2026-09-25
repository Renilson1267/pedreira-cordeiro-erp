migrate(
  (app) => {
    // Atualização das densidades reais dos produtos da pedreira fornecidas pelo usuário:
    // Brita 12 = 1,45 t/m³
    // Brita 19 = 1,47 t/m³
    // Pó de pedra = 1,56 t/m³
    // Pedra rachão e Cascalhinho mantêm os valores atuais.

    // 1. Atualizar por código de produto (se houver correspondência padrão)
    const atualizacoesCodigo = [
      { codigo: 'PRD-BRITA12', densidade: 1.45 },
      { codigo: 'PRD-BRITA19', densidade: 1.47 },
      { codigo: 'PRD-PO-PEDRA', densidade: 1.56 },
    ]

    for (const item of atualizacoesCodigo) {
      try {
        const records = app.findRecordsByFilter('produtos', `codigo = '${item.codigo}'`, '', 100, 0)
        for (const rec of records) {
          rec.set('densidade', item.densidade)
          app.save(rec)
        }
      } catch (err) {
        console.log('Erro ao atualizar produto por código:', item.codigo, err)
      }
    }

    // 2. Atualizar por correspondência de nome em todas as empresas (inclusive Treinamento e variações de código como 'b12')
    try {
      const allProdutos = app.findRecordsByFilter('produtos', '', '', 500, 0)
      for (const rec of allProdutos) {
        const nome = (rec.getString('nome') || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()

        if (nome.includes('brita 12')) {
          rec.set('densidade', 1.45)
          app.save(rec)
        } else if (nome.includes('brita 19')) {
          rec.set('densidade', 1.47)
          app.save(rec)
        } else if (nome.includes('po de pedra') || nome.includes('po de brita')) {
          rec.set('densidade', 1.56)
          app.save(rec)
        }
      }
    } catch (err) {
      console.log('Erro ao varrer produtos por nome:', err)
    }
  },
  (app) => {
    // Reversão opcional para os valores anteriores típicos (1.50)
    try {
      const allProdutos = app.findRecordsByFilter('produtos', '', '', 500, 0)
      for (const rec of allProdutos) {
        const nome = (rec.getString('nome') || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()

        if (
          nome.includes('brita 12') ||
          nome.includes('brita 19') ||
          nome.includes('po de pedra')
        ) {
          rec.set('densidade', 1.5)
          app.save(rec)
        }
      }
    } catch (_) {}
  },
)
