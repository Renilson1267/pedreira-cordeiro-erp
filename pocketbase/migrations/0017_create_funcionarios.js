migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const funcionariosCol = new Collection({
      name: 'funcionarios',
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
          name: 'nome',
          type: 'text',
          required: true,
        },
        {
          name: 'cpf',
          type: 'text',
          required: false,
        },
        {
          name: 'cargo',
          type: 'text',
          required: true,
        },
        {
          name: 'setor',
          type: 'select',
          required: true,
          values: ['Britagem', 'Concreto', 'Lokotrack', 'Frota', 'Administrativo', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'data_admissao',
          type: 'date',
          required: false,
        },
        {
          name: 'salario',
          type: 'number',
          required: false,
        },
        {
          name: 'telefone',
          type: 'text',
          required: false,
        },
        {
          name: 'email',
          type: 'email',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'ferias', 'afastado', 'demitido'],
          maxSelect: 1,
        },
        {
          name: 'chave_pix',
          type: 'text',
          required: false,
        },
        {
          name: 'banco_conta',
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
        'CREATE INDEX idx_func_empresa ON funcionarios (empresa_id)',
        'CREATE INDEX idx_func_status ON funcionarios (status)',
        'CREATE INDEX idx_func_setor ON funcionarios (setor)',
        'CREATE INDEX idx_func_nome ON funcionarios (nome)',
      ],
    })

    app.save(funcionariosCol)

    // Seed sample initial team members
    const empresas = app.findRecordsByFilter('empresas', '', '+created', 1, 0)
    if (empresas.length > 0) {
      const empresaId = empresas[0].id
      const initialTeam = [
        {
          nome: 'Sebastião Antunes (Tião)',
          cpf: '123.456.789-01',
          cargo: 'Motorista de Caminhão Traçado',
          setor: 'Frota',
          data_admissao: '2021-03-15 00:00:00.000Z',
          salario: 3200,
          telefone: '(83) 98899-1122',
          email: 'tiao.motorista@gcpedreira.com.br',
          status: 'ativo',
          chave_pix: '123.456.789-01',
          observacoes: 'CNH E, especialista em caçamba basculante em terreno de lavra.',
        },
        {
          nome: 'Marcos Vinícius Silva',
          cpf: '234.567.890-12',
          cargo: 'Operador de Escavadeira Hidráulica',
          setor: 'Britagem',
          data_admissao: '2020-08-10 00:00:00.000Z',
          salario: 4100,
          telefone: '(83) 98899-2233',
          email: 'marcos.escavadeira@gcpedreira.com.br',
          status: 'ativo',
          chave_pix: 'marcos.escavadeira@gcpedreira.com.br',
          observacoes: 'Operador sênior CAT 336 e XCMG.',
        },
        {
          nome: 'Carlos Alberto Nóbrega',
          cpf: '345.678.901-23',
          cargo: 'Encarregado de Usina de Concreto',
          setor: 'Concreto',
          data_admissao: '2019-02-01 00:00:00.000Z',
          salario: 5200,
          telefone: '(83) 98899-3344',
          email: 'carlos.concreto@gcpedreira.com.br',
          status: 'ativo',
          chave_pix: '(83) 98899-3344',
          observacoes: 'Responsável pelo traço de concreto e frota de betoneiras.',
        },
        {
          nome: 'Raimundo Nonato de Souza',
          cpf: '456.789.012-34',
          cargo: 'Operador de Britador Lokotrack',
          setor: 'Lokotrack',
          data_admissao: '2022-01-17 00:00:00.000Z',
          salario: 3800,
          telefone: '(83) 98899-4455',
          email: 'raimundo.lokotrack@gcpedreira.com.br',
          status: 'ativo',
          chave_pix: '456.789.012-34',
          observacoes: 'Operação e manutenção autônoma de mandíbulas LT 106.',
        },
        {
          nome: 'Ana Beatriz Fernandes',
          cpf: '567.890.123-45',
          cargo: 'Analista Administrativa e Financeira',
          setor: 'Administrativo',
          data_admissao: '2022-06-01 00:00:00.000Z',
          salario: 3500,
          telefone: '(83) 98899-5566',
          email: 'ana.beatriz@gcpedreira.com.br',
          status: 'ativo',
          chave_pix: 'ana.beatriz@gcpedreira.com.br',
          observacoes: 'Controle de notas fiscais, pesagem de balança rodoviária e folha.',
        },
      ]

      for (const emp of initialTeam) {
        const rec = new Record(funcionariosCol)
        rec.set('empresa_id', empresaId)
        rec.set('nome', emp.nome)
        rec.set('cpf', emp.cpf)
        rec.set('cargo', emp.cargo)
        rec.set('setor', emp.setor)
        rec.set('data_admissao', emp.data_admissao)
        rec.set('salario', emp.salario)
        rec.set('telefone', emp.telefone)
        rec.set('email', emp.email)
        rec.set('status', emp.status)
        rec.set('chave_pix', emp.chave_pix)
        rec.set('observacoes', emp.observacoes)
        app.save(rec)
      }
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('funcionarios')
    app.delete(col)
  },
)
