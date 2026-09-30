migrate(
  (app) => {
    try {
      const res = $http.send({
        url: 'https://melodious-mermaid-4292bc.netlify.app/site-img/galeria-betoneira-1.jpg',
        method: 'GET',
        timeout: 30,
      })
      console.log(
        '[MIG-0175-TEST] status:',
        res.statusCode,
        'raw len:',
        res.raw ? res.raw.length : 0,
      )
    } catch (err) {
      console.log('[MIG-0175-TEST] error:', err.message || err)
    }
  },
  (app) => {},
)
