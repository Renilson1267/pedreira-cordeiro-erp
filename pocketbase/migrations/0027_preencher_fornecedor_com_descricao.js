migrate(
  (app) => {
    // 0027: Preenche o campo fornecedor_id nas contas a pagar existentes a partir da descrição.
    // Para cada conta a pagar sem fornecedor_id (ou vazio), cria ou reutiliza o fornecedor
    // correspondente ao nome da descrição da mesma empresa e atualiza a conta a pagar.

    const contasPagar = app.findRecordsByFilter(
      'contas_pagar',
      "fornecedor_id = '' || fornecedor_id = null",
      '-created',
      10000,
      0,
    )

    if (!contasPagar || contasPagar.length === 0) {
      return
    }

    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')

    for (let i = 0; i < contasPagar.length; i++) {
      const conta = contasPagar[i]
      const desc = (conta.getString('descricao') || '').trim()
      const empresaId = conta.getString('empresa_id')

      if (!desc || !empresaId) {
        continue
      }

      // Procurar se já existe fornecedor com esse nome para a mesma empresa
      let fornecedorRecord = null
      try {
        const encontrados = app.findRecordsByFilter(
          'fornecedores',
          `empresa_id = '${empresaId}' && nome = '${desc.replace(/'/g, "\\'")}'`,
          '-created',
          1,
          0,
        )
        if (encontrados && encontrados.length > 0) {
          fornecedorRecord = encontrados[0]
        }
      } catch (_) {}

      // Se não existir fornecedor com esse nome, cria um novo
      if (!fornecedorRecord) {
        try {
          const novoForn = new Record(fornecedoresCol)
          novoForn.set('empresa_id', empresaId)
          novoForn.set('nome', desc)
          novoForn.set('observacoes', 'Cadastrado a partir da descrição da Conta a Pagar')
          app.save(novoForn)
          fornecedorRecord = novoForn
        } catch (errForn) {
          console.log('Erro ao criar fornecedor para:', desc, errForn)
        }
      }

      // Se encontrou ou criou o fornecedor, vincula na conta a pagar
      if (fornecedorRecord) {
        try {
          conta.set('fornecedor_id', fornecedorRecord.id)
          app.save(conta)
        } catch (errConta) {
          console.log('Erro ao atualizar fornecedor_id na conta:', conta.id, errConta)
        }
      }
    }
  },
  (_app) => {
    // Reversão opcional (não destrói dados de fornecedores criados)
  },
)
