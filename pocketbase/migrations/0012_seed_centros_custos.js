migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const centrosCol = app.findCollectionByNameOrId('centros_custos')

    // Obter todas as empresas cadastradas
    const empresas = app.findRecordsByFilter('empresas', "id != ''", 'created', 100, 0)
    if (!empresas || empresas.length === 0) return

    const padroes = [
      {
        codigo: 'CC-01',
        nome: 'Extração e Britagem',
        descricao: 'Custos e receitas operacionais diretos da pedreira e usina de britagem',
        cor: '#D97706',
      },
      {
        codigo: 'CC-02',
        nome: 'Transporte e Frota',
        descricao: 'Combustível, fretes, logística e operação de caminhões e caçambas',
        cor: '#0284C7',
      },
      {
        codigo: 'CC-03',
        nome: 'Manutenção e Equipamentos',
        descricao: 'Oficina, peças de reposição, desgaste de maquinário e revisões',
        cor: '#DC2626',
      },
      {
        codigo: 'CC-04',
        nome: 'Administrativo e Comercial',
        descricao: 'Escritório central, vendas, administrativo e financeiro',
        cor: '#0F766E',
      },
      {
        codigo: 'CC-05',
        nome: 'Operações Gerais',
        descricao: 'Custos compartilhados e operações gerais de apoio',
        cor: '#64748B',
      },
    ]

    empresas.forEach((emp) => {
      padroes.forEach((p) => {
        try {
          // Idempotente por empresa + codigo
          const exists = app.findRecordsByFilter(
            'centros_custos',
            `empresa_id = '${emp.id}' && codigo = '${p.codigo}'`,
            '',
            1,
            0,
          )
          if (exists && exists.length > 0) return

          const rec = new Record(centrosCol)
          rec.set('empresa_id', emp.id)
          rec.set('codigo', p.codigo)
          rec.set('nome', p.nome)
          rec.set('descricao', p.descricao)
          rec.set('cor', p.cor)
          rec.set('ativo', true)
          app.save(rec)
        } catch (e) {
          console.log('Erro ao criar centro de custo padrao:', e)
        }
      })
    })
  },
  (app) => {
    // Reversão
  },
)
