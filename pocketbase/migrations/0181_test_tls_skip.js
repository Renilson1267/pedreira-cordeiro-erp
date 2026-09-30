migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'https://pedreiracordeiro.com.br/site-img/galeria-betoneira-1.jpg',
        method: 'GET',
        timeout: 30,
        tlsSkipVerify: true,
      })
      logText =
        'tlsSkipVerify status: ' + res.statusCode + ', len: ' + (res.raw ? res.raw.length : 0)
    } catch (err) {
      logText = 'tlsSkipVerify err: ' + (err.message || String(err))
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
