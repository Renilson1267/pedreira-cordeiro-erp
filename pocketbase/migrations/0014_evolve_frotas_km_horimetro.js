migrate(
  (app) => {
    const veiculosCol = app.findCollectionByNameOrId('veiculos')

    // 1. Expand tipo values
    // Existing: caminhao | escavadeira | carregadeira | perfuratriz | trator | outro
    // New needed: betoneira | pipa | bomba | central_concreto | britador | peneira | moto | carro_passeio
    const tipoField = veiculosCol.fields.getByName('tipo')
    if (tipoField) {
      const desiredTipos = [
        'caminhao',
        'escavadeira',
        'carregadeira',
        'perfuratriz',
        'trator',
        'betoneira',
        'pipa',
        'bomba',
        'central_concreto',
        'britador',
        'peneira',
        'moto',
        'carro_passeio',
        'outro',
      ]
      tipoField.values = desiredTipos
      tipoField.maxSelect = 1
    }

    // 2. Allow tipo_medidor to accept 'ambos' or keep 'km' / 'horas' / 'ambos'
    const tipoMedidorField = veiculosCol.fields.getByName('tipo_medidor')
    if (tipoMedidorField) {
      tipoMedidorField.values = ['km', 'horas', 'ambos']
      tipoMedidorField.required = false
    }

    // 3. Make medidor_atual optional (can have separate km_atual and horimetro_atual)
    const medidorAtualField = veiculosCol.fields.getByName('medidor_atual')
    if (medidorAtualField) {
      medidorAtualField.required = false
    }

    // 4. Add new fields to veiculos if not present:
    // - setor: text (ou select: Central Britagem | Entrega de Brita | Central de Concreto | Britagem Lokotrack | Carros/Motos)
    if (!veiculosCol.fields.getByName('setor')) {
      veiculosCol.fields.add(
        new TextField({
          name: 'setor',
          required: false,
        }),
      )
    }

    // - km_atual: number
    if (!veiculosCol.fields.getByName('km_atual')) {
      veiculosCol.fields.add(
        new NumberField({
          name: 'km_atual',
          required: false,
        }),
      )
    }

    // - horimetro_atual: number
    if (!veiculosCol.fields.getByName('horimetro_atual')) {
      veiculosCol.fields.add(
        new NumberField({
          name: 'horimetro_atual',
          required: false,
        }),
      )
    }

    // - valor_estimado: number
    if (!veiculosCol.fields.getByName('valor_estimado')) {
      veiculosCol.fields.add(
        new NumberField({
          name: 'valor_estimado',
          required: false,
        }),
      )
    }

    // - tag_patrimonio: text
    if (!veiculosCol.fields.getByName('tag_patrimonio')) {
      veiculosCol.fields.add(
        new TextField({
          name: 'tag_patrimonio',
          required: false,
        }),
      )
    }

    app.save(veiculosCol)

    // 5. Update abastecimentos collection to support optional km / horimetro
    const abastecimentosCol = app.findCollectionByNameOrId('abastecimentos')
    const abastMedidorField = abastecimentosCol.fields.getByName('medidor')
    if (abastMedidorField) {
      abastMedidorField.required = false
    }
    if (!abastecimentosCol.fields.getByName('km_odometro')) {
      abastecimentosCol.fields.add(
        new NumberField({
          name: 'km_odometro',
          required: false,
        }),
      )
    }
    if (!abastecimentosCol.fields.getByName('horimetro')) {
      abastecimentosCol.fields.add(
        new NumberField({
          name: 'horimetro',
          required: false,
        }),
      )
    }
    if (!abastecimentosCol.fields.getByName('consumo_km_l')) {
      abastecimentosCol.fields.add(
        new NumberField({
          name: 'consumo_km_l',
          required: false,
        }),
      )
    }
    if (!abastecimentosCol.fields.getByName('consumo_l_h')) {
      abastecimentosCol.fields.add(
        new NumberField({
          name: 'consumo_l_h',
          required: false,
        }),
      )
    }
    app.save(abastecimentosCol)

    // 6. Update manutencoes collection to support optional km and horimetro
    const manutencoesCol = app.findCollectionByNameOrId('manutencoes')
    if (!manutencoesCol.fields.getByName('km_no_momento')) {
      manutencoesCol.fields.add(
        new NumberField({
          name: 'km_no_momento',
          required: false,
        }),
      )
    }
    if (!manutencoesCol.fields.getByName('horimetro_no_momento')) {
      manutencoesCol.fields.add(
        new NumberField({
          name: 'horimetro_no_momento',
          required: false,
        }),
      )
    }
    if (!manutencoesCol.fields.getByName('proxima_revisao_km')) {
      manutencoesCol.fields.add(
        new NumberField({
          name: 'proxima_revisao_km',
          required: false,
        }),
      )
    }
    if (!manutencoesCol.fields.getByName('proxima_revisao_horimetro')) {
      manutencoesCol.fields.add(
        new NumberField({
          name: 'proxima_revisao_horimetro',
          required: false,
        }),
      )
    }
    app.save(manutencoesCol)
  },
  (app) => {
    // down logic
  },
)
