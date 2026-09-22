routerAdd('GET', '/backend/v1/debug-xlsx', (e) => {
  const url =
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/6a39350a-1d77-4616-a8c8-3b6721f3698f/pedreira-2026-1-f6b0c.xlsx'
  const res = $http.send({ url: url, method: 'GET', timeout: 60 })
  return e.json(200, {
    status: res.statusCode,
    headers: res.headers,
    bodyType: typeof res.body,
    bodyLength: res.body ? res.body.length : 0,
    rawLength: res.raw ? res.raw.length : 0,
  })
})
