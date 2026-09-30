migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'https://melodious-mermaid-4292bc.netlify.app/site-img/galeria-betoneira-1.jpg',
        method: 'GET',
        timeout: 30,
      })
      logText = 'status: ' + res.statusCode + ', rawLen: ' + (res.raw ? res.raw.length : 0)
    } catch (err) {
      logText = 'err: ' + (err.message || String(err))
    }

    // Grava numa coleção ou tabela para lermos via db_query
    app
      .db()
      .newQuery(
        "UPDATE fotos_pedreira_reais SET url_original = {:log} WHERE chave = 'hero-jazida-aerea'",
      )
      .bind({ log: logText })
      .execute()
  },
  (app) => {},
)
