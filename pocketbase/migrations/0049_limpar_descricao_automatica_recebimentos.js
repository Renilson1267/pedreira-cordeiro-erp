/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Limpar o campo descricao em contas_receber cujos títulos contenham texto automático gerado pelo importador.
    // Padrão do importador: começa com "Recebimento " e contém " - " ou "[Doc"
    // Preservar descrições manuais (ex: "PAGO AO POSTO...", "DEPOSITO BRADESCO...", "PAGO 09/05/25" etc.)
    try {
      const resContas = app
        .db()
        .newQuery(`
          UPDATE contas_receber
          SET descricao = ''
          WHERE descricao LIKE 'Recebimento %'
            AND (descricao LIKE '% - %' OR descricao LIKE '%[Doc%')
        `)
        .execute()
      console.log('Migração 0049: contas_receber com descrição automática limpa:', resContas)
    } catch (err) {
      console.log('Erro ao limpar descricao automatica em contas_receber:', err)
    }

    // 2. Atualizar movimentos_financeiros gerados a partir de contas a receber que continham a descrição gerada.
    // O importador gerava descrições no padrão:
    // "Recebimento: Recebimento [cliente] - [cidade] [Doc: NNN] [cliente]" ou "Recebimento: Recebimento ..."
    // Para esses movimentos com o texto automático duplicado, limpar para algo limpo/conciso:
    // Se tiver nome do cliente em [Nome], deixar "Recebimento: [Nome]" ou "Recebimento"
    try {
      // Ajustar movimentos com prefixo "Recebimento: Recebimento "
      // No SQLite podemos atualizar para "Recebimento" ou substituir o prefixo
      const resMovs = app
        .db()
        .newQuery(`
          UPDATE movimentos_financeiros
          SET descricao = 'Recebimento' || SUBSTR(descricao, 25)
          WHERE origem = 'ContaReceber'
            AND descricao LIKE 'Recebimento: Recebimento %'
        `)
        .execute()
      console.log(
        'Migração 0049: movimentos_financeiros com descricao automatica encurtada:',
        resMovs,
      )
    } catch (err) {
      console.log('Erro ao ajustar descricao em movimentos_financeiros:', err)
    }
  },
  (app) => {
    // Reversão não é necessária para limpeza de texto automático redundante
  },
)
