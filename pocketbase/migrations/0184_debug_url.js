migrate(
  (app) => {
    try {
      const rec = app.findFirstRecordByFilter('fotos_pedreira_reais', "chave = 'hero-jazida-aerea'")
      console.log(
        '[MIG-0184-DEBUG] hero-jazida-aerea url_original:',
        rec ? rec.get('url_original') : 'null',
      )
    } catch (e) {
      console.log('[MIG-0184-DEBUG] err:', e)
    }
  },
  (app) => {},
)
