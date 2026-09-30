migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'https://pedreiracordeiro.com.br/',
        method: 'GET',
        timeout: 30,
        insecureSkipVerify: true,
        tlsSkipVerify: true,
        skipTlsVerify: true,
      })
      logText = 'status: ' + res.statusCode + ', len: ' + (res.raw ? res.raw.length : 0)
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
