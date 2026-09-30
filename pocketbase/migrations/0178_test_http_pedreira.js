migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'http://pedreiracordeiro.com.br/site-img/galeria-betoneira-1.jpg',
        method: 'GET',
        timeout: 30,
      })
      logText =
        'status: ' +
        res.statusCode +
        ', rawLen: ' +
        (res.raw ? res.raw.length : 0) +
        ', hdr: ' +
        JSON.stringify(res.headers)
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
