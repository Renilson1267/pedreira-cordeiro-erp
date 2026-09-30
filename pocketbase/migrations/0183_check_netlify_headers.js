migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'https://melodious-mermaid-4292bc.netlify.app/site-img/galeria-betoneira-1.jpg',
        method: 'GET',
        timeout: 10,
      })
      logText = 'netlify status: ' + res.statusCode + ', headers: ' + JSON.stringify(res.headers)
    } catch (err) {
      logText = 'err: ' + (err.message || String(err))
    }

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
