migrate(
  (app) => {
    let logText = ''
    try {
      const res = $http.send({
        url: 'https://melodious-mermaid-4292bc.netlify.app',
        method: 'GET',
        timeout: 30,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      logText =
        'status: ' +
        res.statusCode +
        ', len: ' +
        (res.raw ? res.raw.length : 0) +
        ', snippet: ' +
        (res.raw ? res.raw.slice(0, 150) : '')
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
