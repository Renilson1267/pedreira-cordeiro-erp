// Hook PocketBase para gerenciamento e automação de Backups do ERP Pedreira Cordeiro
// com Integração ao Google Drive via CONTA DE SERVIÇO (Service Account / JWT RS256 puro em JS)
// Endpoints autenticados sob /backend/v1/backups e /backend/v1/google-drive
// Cron job semanal automático via cronAdd: todo domingo às 00:30 (horário do servidor)
// Cron job da fila de envio ao Drive: reprocessamento a cada minuto com fatiamento resumível (256KB por PUT)
// Orçamento por rodada: ~25s para evitar timeout HTTP do gateway (60s)
// NOTA JSVM DO POCKETBASE: As callbacks rodam em pools isoladas, portanto todas as funções auxiliares
// devem ser declaradas dentro de cada callback (inline).

// -------------------------------------------------------------
// 1. ENDPOINT ADMINISTRATIVO / MANUAL: PROCESSAR SOLICITADOS DRIVE
// GET /backend/v1/backups/processar-solicitados-drive
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/backups/processar-solicitados-drive', (e) => {
  function processarBackupIncremental(backupId, logPrefixOrigem) {
    var logPrefix = (logPrefixOrigem || '[INCREMENTAL]') + '[' + backupId + ']'
    console.log(logPrefix + ' Início de processarBackupIncremental')
    var startRoundTime = Date.now()
    var MAX_ROUND_DURATION_MS = 25000 // 25 segundos máximo por rodada

    function getAccessTokenOAuth(clientId, clientSecret, refreshToken, forcarRenovacao) {
      var nowMs = Date.now()
      if (!forcarRenovacao) {
        try {
          var oRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
          if (oRec) {
            var tok = oRec.getString('access_token') || ''
            var rawExp = oRec.get('expiry_ms')
            if (rawExp == null && typeof oRec.getInt === 'function')
              rawExp = oRec.getInt('expiry_ms')
            var expMs = Number(rawExp) || 0
            if (tok && expMs > 0 && nowMs < expMs - 300000) {
              console.log(
                logPrefix +
                  ' [OAUTH TOKEN CACHE] Usando access token OAuth em cache válido até ' +
                  new Date(expMs).toISOString(),
              )
              return {
                access_token: tok,
                client_email: 'gmail_oauth_user',
                auth_type: 'oauth',
                from_cache: true,
              }
            }
          }
        } catch (_) {}
      }

      console.log(logPrefix + ' [OAUTH TOKEN] Renovando access token via refresh token Google...')
      var postBody =
        'client_id=' +
        encodeURIComponent(clientId) +
        '&client_secret=' +
        encodeURIComponent(clientSecret) +
        '&refresh_token=' +
        encodeURIComponent(refreshToken) +
        '&grant_type=refresh_token'

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postBody,
        timeout: 25,
      })

      if (res.statusCode !== 200) {
        throw new Error(
          'Falha ao renovar token OAuth do Google (HTTP ' +
            res.statusCode +
            '): ' +
            (res.raw || '').slice(0, 300),
        )
      }

      var data = res.json || JSON.parse(res.raw || '{}')
      if (!data.access_token) {
        throw new Error('Access token não retornado na renovação OAuth do Google.')
      }

      var newExpiryMs = nowMs + (data.expires_in || 3600) * 1000
      try {
        var cRec = null
        try {
          cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
        } catch (_) {
          var colCache = $app.findCollectionByNameOrId('cache_tokens_drive')
          cRec = new Record(colCache)
          cRec.set('chave', 'google_drive_oauth')
        }
        cRec.set('access_token', data.access_token)
        cRec.set('expiry_ms', newExpiryMs)
        cRec.set('client_email', 'gmail_oauth_user')
        cRec.set('detalhes', {
          cached_token: data.access_token,
          cached_expiry_ms: newExpiryMs,
          cached_created_at: new Date().toISOString(),
          tipo: 'oauth',
        })
        $app.save(cRec)
        console.log(logPrefix + ' [OAUTH TOKEN] Novo token gravado em cache com sucesso.')
      } catch (eSaveO) {
        console.warn(logPrefix + ' [OAUTH TOKEN] Aviso ao salvar cache:', eSaveO)
      }

      return {
        access_token: data.access_token,
        client_email: 'gmail_oauth_user',
        auth_type: 'oauth',
        from_cache: false,
      }
    }

    function getAccessTokenShared(serviceAccountJson, scope, forcarRenovacao) {
      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowMs = Date.now()
      var nowSec = Math.floor(nowMs / 1000)

      // 1. Tenta reaproveitar o token armazenado em cache dedicado (coleção cache_tokens_drive ou config_google_drive)
      if (!forcarRenovacao) {
        var cachedToken = ''
        var cachedExpiryMs = 0

        // Prioridade A: coleção dedicada cache_tokens_drive
        try {
          var dRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
          if (dRec) {
            cachedToken = dRec.getString('access_token') || ''
            var rawExpD = dRec.get('expiry_ms')
            if (rawExpD == null && typeof dRec.getInt === 'function') {
              rawExpD = dRec.getInt('expiry_ms')
            }
            cachedExpiryMs = Number(rawExpD) || 0
          }
        } catch (_) {}

        // Prioridade B: fallback para config_google_drive.detalhes
        if (!cachedToken || cachedExpiryMs <= 0) {
          try {
            var cfgCacheRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
            if (cfgCacheRec) {
              var detalhesCache = null
              try {
                var rawD = cfgCacheRec.get('detalhes')
                if (typeof rawD === 'string') {
                  detalhesCache = JSON.parse(rawD)
                } else if (rawD && typeof rawD === 'object') {
                  detalhesCache = JSON.parse(JSON.stringify(rawD))
                }
              } catch (_) {
                detalhesCache = null
              }
              if (
                detalhesCache &&
                typeof detalhesCache === 'object' &&
                !Array.isArray(detalhesCache)
              ) {
                cachedToken = detalhesCache.cached_token || ''
                cachedExpiryMs = Number(detalhesCache.cached_expiry_ms) || 0
              }
            }
          } catch (eCacheRead) {
            console.warn(
              logPrefix + ' [CACHE TOKEN] Aviso ao ler fallback config_google_drive:',
              eCacheRead,
            )
          }
        }

        if (cachedToken && cachedExpiryMs > 0) {
          // Margem de segurança de 5 minutos (300.000 ms)
          if (nowMs < cachedExpiryMs - 300000) {
            console.log(
              logPrefix +
                ' [CACHE TOKEN] Usando access token em cache válido até ' +
                new Date(cachedExpiryMs).toISOString(),
            )
            return {
              access_token: cachedToken,
              client_email: creds.client_email,
              project_id: creds.project_id || '',
              from_cache: true,
            }
          } else {
            console.log(
              logPrefix + ' [CACHE TOKEN] Token expirado ou próximo de expirar. Renovando...',
            )
          }
        } else {
          console.log(logPrefix + ' [CACHE TOKEN] Nenhum token válido encontrado no cache.')
        }
      }

      console.log(
        logPrefix + ' [RSA] Iniciando cálculo de assinatura JWT RS256 com RSA CRT acelerado...',
      )
      var rsaStartTime = Date.now()

      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var bi = 0; bi < b64chars.length; bi++) b64tab[b64chars.charAt(bi)] = bi

      function base64ToBytes(s) {
        s = s.replace(/[^A-Za-z0-9+/=]/g, '')
        var bytes = []
        var i = 0
        while (i < s.length) {
          var enc1 = b64tab[s.charAt(i++)]
          var enc2 = b64tab[s.charAt(i++)]
          var enc3 = b64tab[s.charAt(i++)]
          var enc4 = b64tab[s.charAt(i++)]
          var chr1 = (enc1 << 2) | (enc2 >> 4)
          var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
          var chr3 = ((enc3 & 3) << 6) | enc4
          bytes.push(chr1)
          if (enc3 !== undefined && s.charAt(i - 2) !== '=') bytes.push(chr2)
          if (enc4 !== undefined && s.charAt(i - 1) !== '=') bytes.push(chr3)
        }
        return bytes
      }

      function bytesToBase64Url(bytes) {
        var str = ''
        for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
        var b64 = ''
        var j = 0
        while (j < str.length) {
          var c1 = str.charCodeAt(j++)
          var c2 = str.charCodeAt(j++)
          var c3 = str.charCodeAt(j++)
          var e1 = c1 >> 2
          var e2 = ((c1 & 3) << 4) | (c2 >> 4)
          var e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6)
          var e4 = isNaN(c2) || isNaN(c3) ? 64 : c3 & 63
          b64 +=
            b64chars.charAt(e1) +
            b64chars.charAt(e2) +
            (e3 === 64 ? '=' : b64chars.charAt(e3)) +
            (e4 === 64 ? '=' : b64chars.charAt(e4))
        }
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      }

      function utf8ToBase64Url(str) {
        var bytes = []
        for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i)
          if (c < 128) {
            bytes.push(c)
          } else if (c < 2048) {
            bytes.push((c >> 6) | 192)
            bytes.push((c & 63) | 128)
          } else {
            bytes.push((c >> 12) | 224)
            bytes.push(((c >> 6) & 63) | 128)
            bytes.push((c & 63) | 128)
          }
        }
        return bytesToBase64Url(bytes)
      }

      function parsePKCS8orPKCS1(privateKeyPem) {
        var clean = privateKeyPem
          .replace(/-----BEGIN[^-]+-----/g, '')
          .replace(/-----END[^-]+-----/g, '')
          .replace(/\s+/g, '')
        var der = base64ToBytes(clean)
        var pos = 0

        function readLength() {
          var b = der[pos++]
          if (b < 128) return b
          var nBytes = b & 0x7f
          var len = 0
          for (var k = 0; k < nBytes; k++) len = (len << 8) | der[pos++]
          return len
        }

        function readTag() {
          return der[pos++]
        }

        function readInteger() {
          var tag = readTag()
          if (tag !== 0x02)
            throw new Error('ASN.1 inválido: esperado INTEGER (0x02), recebido ' + tag)
          var len = readLength()
          var intBytes = der.slice(pos, pos + len)
          pos += len
          while (intBytes.length > 1 && intBytes[0] === 0) intBytes.shift()
          return intBytes
        }

        var tag = readTag()
        if (tag !== 0x30) throw new Error('ASN.1 inválido: esperado SEQUENCE')
        readLength()

        var nextTag = der[pos]
        if (nextTag === 0x02) {
          pos++
          var vLen = readLength()
          var ver = der[pos]
          pos += vLen
          if (ver === 0 && der[pos] === 0x30) {
            // PKCS#8: SEQUENCE { version, AlgorithmIdentifier, OCTET STRING { PKCS#1 RSAPrivateKey } }
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger() // version
            var n = readInteger()
            var e = readInteger()
            var d = readInteger()
            var p = readInteger()
            var q = readInteger()
            var dp = readInteger()
            var dq = readInteger()
            var qinv = readInteger()
            return {
              n: n,
              e: e,
              d: d,
              p: p,
              q: q,
              dp: dp,
              dq: dq,
              qinv: qinv,
              hasCRT: Boolean(p && q && dp && dq && qinv),
            }
          } else {
            // PKCS#1 direto
            var n1 = readInteger()
            var e1 = readInteger()
            var d1 = readInteger()
            var p1 = null,
              q1 = null,
              dp1 = null,
              dq1 = null,
              qinv1 = null
            try {
              p1 = readInteger()
              q1 = readInteger()
              dp1 = readInteger()
              dq1 = readInteger()
              qinv1 = readInteger()
            } catch (_) {}
            return {
              n: n1,
              e: e1,
              d: d1,
              p: p1,
              q: q1,
              dp: dp1,
              dq: dq1,
              qinv: qinv1,
              hasCRT: Boolean(p1 && q1 && dp1 && dq1 && qinv1),
            }
          }
        }
        throw new Error('Formato de chave privada RSA não reconhecido')
      }

      var BASE = 16384
      var BASE_BITS = 14

      function bytesToBig(bytes) {
        var res = [0]
        for (var i = 0; i < bytes.length; i++) {
          var carry = bytes[i]
          for (var j = 0; j < res.length; j++) {
            var v = res[j] * 256 + carry
            res[j] = v % BASE
            carry = Math.floor(v / BASE)
          }
          while (carry > 0) {
            res.push(carry % BASE)
            carry = Math.floor(carry / BASE)
          }
        }
        return trim(res)
      }

      function bigToBytes(a, expectedLen) {
        var bytes = []
        var temp = a.slice()
        while (temp.length > 1 || temp[0] > 0) {
          var rem = 0
          for (var i = temp.length - 1; i >= 0; i--) {
            var cur = rem * BASE + temp[i]
            temp[i] = Math.floor(cur / 256)
            rem = cur % 256
          }
          temp = trim(temp)
          bytes.unshift(rem)
        }
        while (bytes.length < expectedLen) bytes.unshift(0)
        return bytes
      }

      function trim(a) {
        while (a.length > 1 && a[a.length - 1] === 0) a.pop()
        return a
      }

      function compare(a, b) {
        if (a.length !== b.length) return a.length > b.length ? 1 : -1
        for (var i = a.length - 1; i >= 0; i--) {
          if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
        }
        return 0
      }

      function add(a, b) {
        var res = []
        var maxL = Math.max(a.length, b.length)
        var carry = 0
        for (var i = 0; i < maxL || carry > 0; i++) {
          var sum = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0) + carry
          res.push(sum % BASE)
          carry = Math.floor(sum / BASE)
        }
        return trim(res)
      }

      function sub(a, b) {
        // assume a >= b
        var res = []
        var borrow = 0
        for (var i = 0; i < a.length; i++) {
          var diff = a[i] - borrow - (i < b.length ? b[i] : 0)
          if (diff < 0) {
            diff += BASE
            borrow = 1
          } else {
            borrow = 0
          }
          res.push(diff)
        }
        return trim(res)
      }

      function mul(a, b) {
        var res = []
        for (var i = 0; i < a.length + b.length; i++) res.push(0)
        for (var i = 0; i < a.length; i++) {
          var carry = 0
          for (var j = 0; j < b.length || carry > 0; j++) {
            var cur = res[i + j] + a[i] * (j < b.length ? b[j] : 0) + carry
            res[i + j] = cur % BASE
            carry = Math.floor(cur / BASE)
          }
        }
        return trim(res)
      }

      function divRem(u, v) {
        if (v.length === 1 && v[0] === 0) throw new Error('Divisão por zero')
        if (compare(u, v) < 0) return { q: [0], r: u.slice() }
        if (v.length === 1) {
          var q = []
          var r = 0
          var d = v[0]
          for (var i = u.length - 1; i >= 0; i--) {
            var cur = r * BASE + u[i]
            q[i] = Math.floor(cur / d)
            r = cur % d
          }
          return { q: trim(q), r: [r] }
        }

        var shift = Math.floor(BASE / (v[v.length - 1] + 1))
        var uNorm = mul(u, [shift])
        var vNorm = mul(v, [shift])
        if (uNorm.length === u.length) uNorm.push(0)

        var n = vNorm.length
        var m = uNorm.length - n
        var q = []
        for (var i = 0; i < m; i++) q.push(0)

        var vn1 = vNorm[n - 1]
        var vn2 = vNorm[n - 2]

        for (var j = m - 1; j >= 0; j--) {
          var uTop = uNorm[j + n] * BASE + uNorm[j + n - 1]
          var qHat = Math.floor(uTop / vn1)
          var rHat = uTop % vn1

          while (qHat >= BASE || qHat * vn2 > rHat * BASE + uNorm[j + n - 2]) {
            qHat--
            rHat += vn1
            if (rHat >= BASE) break
          }

          var qv = mul(vNorm, [qHat])
          var borrow = 0
          for (var k = 0; k <= n; k++) {
            var uVal = uNorm[j + k]
            var qvVal = k < qv.length ? qv[k] : 0
            var diff = uVal - borrow - qvVal
            if (diff < 0) {
              diff += BASE
              borrow = 1
            } else {
              borrow = 0
            }
            uNorm[j + k] = diff
          }

          if (borrow > 0) {
            qHat--
            var carry = 0
            for (var k = 0; k <= n; k++) {
              var sum = uNorm[j + k] + carry + (k < vNorm.length ? vNorm[k] : 0)
              uNorm[j + k] = sum % BASE
              carry = Math.floor(sum / BASE)
            }
          }
          q[j] = qHat
        }

        var divResult = divRem(uNorm, [shift])
        return { q: trim(q), r: divResult.q }
      }

      function modPow(baseB, expB, modB) {
        var res = [1]
        var cur = divRem(baseB, modB).r
        var maxChunk = 0
        var maxBit = 0
        for (var i = expB.length - 1; i >= 0; i--) {
          if (expB[i] > 0) {
            maxChunk = i
            maxBit = Math.floor(Math.log2 ? Math.log2(expB[i]) : Math.log(expB[i]) / Math.LN2)
            break
          }
        }
        for (var i = 0; i <= maxChunk; i++) {
          var chunk = expB[i]
          var limitBits = i === maxChunk ? maxBit + 1 : BASE_BITS
          for (var b = 0; b < limitBits; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            if (i < maxChunk || b < limitBits - 1) {
              cur = divRem(mul(cur, cur), modB).r
            }
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var kLen = keyComponents.n.length

        var hex = $security.sha256(dataStr)
        var hash = []
        for (var i = 0; i < hex.length; i += 2) hash.push(parseInt(hex.substr(i, 2), 16))

        var t = SHA256_DIGEST_INFO.concat(hash)
        if (kLen < t.length + 11) throw new Error('Chave RSA curta demais para SHA256')

        var psLen = kLen - t.length - 3
        var em = [0x00, 0x01]
        for (var i = 0; i < psLen; i++) em.push(0xff)
        em.push(0x00)
        for (var i = 0; i < t.length; i++) em.push(t[i])

        var emBig = bytesToBig(em)
        var sBig = null

        if (keyComponents.hasCRT) {
          // RSA Chinese Remainder Theorem: 4x a 8x mais rápido
          var pBig = bytesToBig(keyComponents.p)
          var qBig = bytesToBig(keyComponents.q)
          var dpBig = bytesToBig(keyComponents.dp)
          var dqBig = bytesToBig(keyComponents.dq)
          var qinvBig = bytesToBig(keyComponents.qinv)

          var m1 = modPow(emBig, dpBig, pBig)
          var m2 = modPow(emBig, dqBig, qBig)

          // h = (qinv * (m1 - m2)) mod p
          var diff = null
          if (compare(m1, m2) >= 0) {
            diff = sub(m1, m2)
          } else {
            diff = sub(add(m1, pBig), m2)
          }
          var h = divRem(mul(qinvBig, diff), pBig).r
          // s = m2 + h * q
          sBig = add(m2, mul(h, qBig))
        } else {
          var nBig = bytesToBig(keyComponents.n)
          var dBig = bytesToBig(keyComponents.d)
          sBig = modPow(emBig, dBig, nBig)
        }

        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var header = { alg: 'RS256', typ: 'JWT' }
      var claimSet = {
        iss: creds.client_email,
        scope: scope || 'https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSec + 3600,
        iat: nowSec,
      }

      var encHeader = utf8ToBase64Url(JSON.stringify(header))
      var encClaim = utf8ToBase64Url(JSON.stringify(claimSet))
      var signingInput = encHeader + '.' + encClaim

      var keys = parsePKCS8orPKCS1(creds.private_key)
      var signature = rsaSignSha256(signingInput, keys)
      var assertion = signingInput + '.' + signature
      var rsaElapsed = Date.now() - rsaStartTime
      console.log(logPrefix + ' [RSA] Assinatura RS256 concluída em ' + rsaElapsed + 'ms!')

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: 20,
      })

      if (res.statusCode !== 200) {
        throw new Error(
          'Falha no endpoint Google OAuth (HTTP ' + res.statusCode + '): ' + (res.raw || ''),
        )
      }

      var data = res.json || JSON.parse(res.raw || '{}')
      if (!data.access_token) {
        throw new Error('Access token não retornado pelo Google OAuth.')
      }

      // 2. Salva o access token retornado no cache persistente (validade 1h / 3600s)
      var expiryMsCalculado = Date.now() + (data.expires_in || 3600) * 1000

      // Prioridade A: salvar na coleção dedicada cache_tokens_drive
      try {
        var cRec = null
        try {
          cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
        } catch (_) {
          var cacheTokensCol = $app.findCollectionByNameOrId('cache_tokens_drive')
          cRec = new Record(cacheTokensCol)
          cRec.set('chave', 'google_drive_sa')
        }
        cRec.set('access_token', data.access_token)
        cRec.set('expiry_ms', expiryMsCalculado)
        cRec.set('client_email', creds.client_email)
        cRec.set('detalhes', {
          cached_token: data.access_token,
          cached_expiry_ms: expiryMsCalculado,
          cached_created_at: new Date().toISOString(),
        })
        $app.save(cRec)
        console.log(
          logPrefix +
            ' [CACHE TOKEN] Novo token gravado em cache_tokens_drive com sucesso (expira em ' +
            (data.expires_in || 3600) +
            's).',
        )
      } catch (eSaveDed) {
        console.warn(logPrefix + ' [CACHE TOKEN] Aviso ao salvar em cache_tokens_drive:', eSaveDed)
      }

      // Prioridade B: espelho leve em config_google_drive.detalhes sem inflar o JSON
      try {
        var cfgSaveRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (cfgSaveRec) {
          var rawDetSave = cfgSaveRec.get('detalhes')
          var curDetalhes = {}
          try {
            curDetalhes =
              typeof rawDetSave === 'string'
                ? JSON.parse(rawDetSave)
                : JSON.parse(JSON.stringify(rawDetSave || {}))
          } catch (_) {
            curDetalhes = {}
          }
          if (
            typeof curDetalhes !== 'object' ||
            curDetalhes === null ||
            Array.isArray(curDetalhes)
          ) {
            curDetalhes = {}
          }
          curDetalhes.cached_expiry_ms = expiryMsCalculado
          curDetalhes.cached_created_at = new Date().toISOString()
          // Limpar qualquer token residual ou payload gigante no campo detalhes
          delete curDetalhes.cached_token
          cfgSaveRec.set('detalhes', curDetalhes)
          $app.save(cfgSaveRec)
        }
      } catch (eSaveCache) {
        console.warn(logPrefix + ' [CACHE TOKEN] Aviso ao tocar config_google_drive:', eSaveCache)
      }

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
        from_cache: false,
      }
    }

    function shareFileWithUserShared(fileId, userEmail, token) {
      if (!userEmail) return { success: false, error: 'Email de usuário não informado' }
      try {
        var permUrl =
          'https://www.googleapis.com/drive/v3/files/' +
          encodeURIComponent(fileId) +
          '/permissions?supportsAllDrives=true&sendNotificationEmail=false'
        var permRes = $http.send({
          url: permUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'user',
            emailAddress: userEmail,
          }),
          timeout: 20,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          console.log(
            logPrefix + ' [PERMISSIONS] Arquivo compartilhado com ' + userEmail + ' como reader.',
          )
          return { success: true }
        }
        console.warn(
          logPrefix +
            ' [PERMISSIONS] Aviso ao compartilhar: HTTP ' +
            permRes.statusCode +
            ': ' +
            (permRes.raw || ''),
        )
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
        console.warn(logPrefix + ' [PERMISSIONS] Erro de rede ao compartilhar:', eShare)
        return {
          success: false,
          error: String(eShare?.message || eShare),
        }
      }
    }

    var backupRecord = null
    try {
      backupRecord = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
    } catch (eFind) {
      console.error(logPrefix + ' Backup não encontrado: ' + backupId)
      return { status: 'erro', erro: 'Backup não encontrado: ' + backupId }
    }

    var tentativas = backupRecord.getInt('drive_tentativas') || 0
    var curStatus = backupRecord.getString('drive_status') || 'solicitado'
    // Limite de tentativas só se aplica a falhas reais consecutivas, não a rodadas normais de upload incremental (status 'enviando')
    if (curStatus !== 'enviando' && tentativas >= 10) {
      var msgMax = 'Limite de tentativas excedido (10). Tente novamente pela tela do sistema.'
      console.warn(logPrefix + ' ' + msgMax)
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', msgMax)
      $app.save(backupRecord)
      return { status: 'erro', erro: msgMax }
    }

    try {
      var serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      var folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      var usuarioEmailDestino = 'renilsonfmello@gmail.com'
      var configRec = null
      var oauthClientId = ''
      var oauthClientSecret = ''
      var oauthRefreshToken = ''
      var oauthStatus = ''

      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('usuario_email')) {
            usuarioEmailDestino = configRec.getString('usuario_email')
          }
          oauthClientId =
            configRec.getString('oauth_client_id') || configRec.getString('client_id') || ''
          oauthClientSecret =
            configRec.getString('oauth_client_secret') || configRec.getString('client_secret') || ''
          oauthRefreshToken = configRec.getString('oauth_refresh_token') || ''
          oauthStatus = configRec.getString('oauth_status') || ''
        }
      } catch (_) {}

      var temOAuth = Boolean(oauthRefreshToken && oauthClientId && oauthClientSecret)
      var temSA = Boolean(serviceAccountJson)

      if (!temOAuth && !temSA) {
        var msgSemConta =
          'Google Drive não configurado no ERP (nem OAuth nem Conta de Serviço cadastrados).'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        return { status: 'erro', erro: msgSemConta }
      }

      var auth = null
      if (temOAuth) {
        console.log(
          logPrefix + ' Obtendo access token Google via OAuth do usuário (Gmail pessoal)...',
        )
        auth = getAccessTokenOAuth(oauthClientId, oauthClientSecret, oauthRefreshToken, false)
        console.log(logPrefix + ' Token OAuth obtido com sucesso (tipo: ' + auth.auth_type + ')')
      } else {
        console.log(logPrefix + ' Obtendo access token Google via Conta de Serviço (fallback)...')
        auth = getAccessTokenShared(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
          false,
        )
        console.log(
          logPrefix + ' Token Conta de Serviço obtido com sucesso para: ' + auth.client_email,
        )
      }
      var resumoRaw = backupRecord.get('resumo_colecoes') || {}
      var colecoesValidas = [
        'empresas',
        'empresa_membros',
        'users',
        'clientes',
        'fornecedores',
        'produtos',
        'plano_contas',
        'contas_pagar',
        'contas_receber',
        'bancos_contas',
        'movimentos_financeiros',
        'conciliacoes',
        'empresa_convites',
        'veiculos',
        'abastecimentos',
        'manutencoes',
        'centros_custos',
        'creditos_clientes',
        'funcionarios',
        'folha_horas_extras',
        'entregas',
        'vendas',
        'despesas_frota',
        'historico_alteracoes',
        'formas_recebimento',
        'cheques_predatados',
        'contadores_sequenciais',
      ]
      var metaJsonStr = JSON.stringify({
        id: backupRecord.id,
        nome_arquivo: backupRecord.getString('nome_arquivo'),
        tipo: backupRecord.getString('tipo'),
        origem: backupRecord.getString('origem') || 'manual',
        total_colecoes: backupRecord.getInt('total_colecoes'),
        total_registros: backupRecord.getInt('total_registros'),
        resumo_colecoes: backupRecord.get('resumo_colecoes'),
        created: backupRecord.getString('created'),
        exportado_em: new Date().toISOString(),
        sistema: 'Pedreira Cordeiro ERP (NovaGest)',
      })
      var headerPrefix = '{"meta":' + metaJsonStr + ',"dados":{'
      var footerSuffix = '}}\n'

      var totalBytes = backupRecord.getInt('drive_total_bytes') || 0
      var sessionUrl = backupRecord.getString('drive_session_url') || ''

      // Se estamos usando OAuth, descartar qualquer sessão resumível residual
      // criada anteriormente com Conta de Serviço (que falharia com 403 quota)
      if (temOAuth && sessionUrl) {
        var errExistente = backupRecord.getString('drive_erro') || ''
        if (
          errExistente.indexOf('Service Account') !== -1 ||
          errExistente.indexOf('Fallback: gravando no Drive da Conta de Serviço') !== -1 ||
          backupRecord.getInt('drive_offset') === 0
        ) {
          console.log(
            logPrefix +
              ' [OAUTH RESET SESSAO] Descartando drive_session_url residual de Conta de Serviço para criar sessão limpa com OAuth.',
          )
          sessionUrl = ''
          backupRecord.set('drive_session_url', '')
          backupRecord.set('drive_offset', 0)
          $app.save(backupRecord)
        }
      }

      if (!totalBytes || totalBytes === 0) {
        var calcBytes = headerPrefix.length + footerSuffix.length
        for (var ci = 0; ci < colecoesValidas.length; ci++) {
          var cn = colecoesValidas[ci]
          if (ci > 0) calcBytes += 1
          calcBytes += JSON.stringify(cn).length + ':['
          var statsModel = new DynamicModel({ cnt: 0, chars_data: 0 })
          var cntChunks = 0
          var charsData = 0
          try {
            $app
              .db()
              .newQuery(
                'SELECT COALESCE(COUNT(*), 0) as cnt, ' +
                  'COALESCE(SUM(CASE WHEN LENGTH(registros_json) > 2 THEN LENGTH(registros_json) - 2 ELSE 0 END), 0) as chars_data ' +
                  'FROM backups_dados WHERE backup_id = {:bid} AND colecao_nome = {:cn}',
              )
              .bind({ bid: backupId, cn: cn })
              .one(statsModel)

            var rawCnt = statsModel.cnt
            var rawChars = statsModel.chars_data
            if (rawCnt == null && typeof statsModel.get === 'function') {
              try {
                rawCnt = statsModel.get('cnt')
              } catch (_) {}
            }
            if (rawChars == null && typeof statsModel.get === 'function') {
              try {
                rawChars = statsModel.get('chars_data')
              } catch (_) {}
            }
            cntChunks = parseInt(rawCnt, 10) || 0
            charsData = parseInt(rawChars, 10) || 0
          } catch (eStats) {
            console.warn(logPrefix + ' Aviso ao calcular bytes da coleção ' + cn + ':', eStats)
          }

          calcBytes += charsData
          if (cntChunks > 1) {
            calcBytes += cntChunks - 1
          }
          calcBytes += 1
        }

        totalBytes = parseInt(calcBytes, 10) || 0
        console.log(logPrefix + ' totalBytes calculado via SQL: ' + totalBytes)
        backupRecord.set('drive_total_bytes', totalBytes)
        backupRecord.set('drive_offset', 0)
        $app.save(backupRecord)
      }

      if (!sessionUrl) {
        var initUrl =
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true'
        var fileMetadata = {
          name: backupRecord.getString('nome_arquivo'),
          mimeType: 'application/json',
        }
        if (folderId) {
          fileMetadata.parents = [folderId]
        }

        var initRes = $http.send({
          url: initUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/json',
            'X-Upload-Content-Length': String(totalBytes),
          },
          body: JSON.stringify(fileMetadata),
          timeout: 20,
        })

        var isInitQuotaError =
          initRes.statusCode === 403 &&
          ((initRes.raw || '').toLowerCase().indexOf('storage quota') !== -1 ||
            (initRes.raw || '').toLowerCase().indexOf('storagequota') !== -1)

        if ((initRes.statusCode !== 200 || isInitQuotaError) && fileMetadata.parents) {
          console.log(
            logPrefix +
              ' [FALLBACK INIT] Falha na criação com pasta (HTTP ' +
              initRes.statusCode +
              '). Criando sessão resumível no Drive próprio da Conta de Serviço (sem parents)...',
          )
          delete fileMetadata.parents
          initRes = $http.send({
            url: initUrl,
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + auth.access_token,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Type': 'application/json',
              'X-Upload-Content-Length': String(totalBytes),
            },
            body: JSON.stringify(fileMetadata),
            timeout: 20,
          })
        }

        if (initRes.statusCode !== 200) {
          var errInit =
            'Falha ao iniciar sessão resumível Google Drive (HTTP ' +
            initRes.statusCode +
            '): ' +
            (initRes.raw || '')
          console.error(logPrefix + ' ' + errInit)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errInit)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errInit }
        }

        var headersMap = initRes.headers || {}
        var loc = headersMap['Location'] || headersMap['location']
        if (Array.isArray(loc) && loc.length > 0) loc = loc[0]
        if (!loc && typeof loc !== 'string') {
          var errLoc = 'Google Drive não retornou Location para upload resumível.'
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errLoc)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errLoc }
        }

        sessionUrl = String(loc)
        backupRecord.set('drive_session_url', sessionUrl)
        backupRecord.set('drive_status', 'enviando')
        backupRecord.set('drive_offset', 0)
        if (!fileMetadata.parents && folderId) {
          backupRecord.set('drive_erro', 'Fallback: gravando no Drive da Conta de Serviço')
        } else {
          backupRecord.set('drive_erro', '')
        }
        $app.save(backupRecord)
      }

      var currentOffset = parseInt(backupRecord.getInt('drive_offset'), 10) || 0
      totalBytes = parseInt(totalBytes, 10) || 0

      // Só checa o offset no Google se currentOffset > 0 (sessão retomada no meio)
      if (currentOffset > 0) {
        try {
          var checkRangeHeader = 'bytes */' + totalBytes
          console.log(logPrefix + ' [CHECK_OFFSET] PUT ' + checkRangeHeader)
          var checkRes = $http.send({
            url: sessionUrl,
            method: 'PUT',
            headers: {
              'Content-Length': '0',
              'Content-Range': checkRangeHeader,
            },
            timeout: 15,
          })

          if (checkRes.statusCode === 308) {
            var rangeHeader = checkRes.headers?.['Range'] || checkRes.headers?.['range']
            if (Array.isArray(rangeHeader)) rangeHeader = rangeHeader[0]
            if (rangeHeader && typeof rangeHeader === 'string') {
              var matchRange = rangeHeader.match(/bytes=0-(\d+)/)
              if (matchRange && matchRange[1]) {
                currentOffset = parseInt(matchRange[1], 10) + 1
                backupRecord.set('drive_offset', currentOffset)
              }
            }
          } else if (checkRes.statusCode === 200 || checkRes.statusCode === 201) {
            var dataConcluido = checkRes.json || JSON.parse(checkRes.raw || '{}')
            var fileIdPronto = dataConcluido.id || ''
            shareFileWithUserShared(fileIdPronto, usuarioEmailDestino, auth.access_token)
            var agoraIso = new Date().toISOString()
            backupRecord.set('drive_status', 'enviado')
            backupRecord.set('drive_file_id', fileIdPronto)
            backupRecord.set('drive_enviado_em', agoraIso)
            backupRecord.set('drive_offset', totalBytes)
            backupRecord.set(
              'drive_erro',
              'Concluído com sucesso (compartilhado com ' + usuarioEmailDestino + ')',
            )
            $app.save(backupRecord)
            console.log(
              logPrefix +
                ' [FINAL] Arquivo concluído no Drive (HTTP 200/201). Compartilhado com ' +
                usuarioEmailDestino,
            )
            return { status: 'concluido', file_id: fileIdPronto }
          }
        } catch (eCheck) {
          console.warn(logPrefix + ' Aviso na consulta de offset:', eCheck)
        }
      }

      var CHUNK_BYTES = 256 * 1024
      var chunksEnviadosNestaRodada = 0
      var totalChunksEstimado = Math.ceil(totalBytes / CHUNK_BYTES)

      while (currentOffset < totalBytes) {
        if (Date.now() - startRoundTime >= MAX_ROUND_DURATION_MS) {
          break
        }

        var numCurrentOffset = parseInt(currentOffset, 10) || 0
        var numTotalBytes = parseInt(totalBytes, 10) || 0
        var targetSliceEnd = Math.min(numCurrentOffset + CHUNK_BYTES, numTotalBytes)
        var targetSliceLen = targetSliceEnd - numCurrentOffset
        if (targetSliceEnd < numTotalBytes && targetSliceLen % CHUNK_BYTES !== 0) {
          targetSliceLen = Math.floor(targetSliceLen / CHUNK_BYTES) * CHUNK_BYTES
          targetSliceEnd = numCurrentOffset + targetSliceLen
        }

        var sliceBuf = ''
        var curPos = 0

        var hEnd = curPos + headerPrefix.length
        if (numCurrentOffset < hEnd && targetSliceEnd > curPos) {
          var sStart = Math.max(0, numCurrentOffset - curPos)
          var sEnd = Math.min(headerPrefix.length, targetSliceEnd - curPos)
          sliceBuf += headerPrefix.substring(sStart, sEnd)
        }
        curPos = hEnd

        for (var colIdx = 0; colIdx < colecoesValidas.length; colIdx++) {
          if (curPos >= targetSliceEnd) break
          var nomeColecao = colecoesValidas[colIdx]

          var cPrefix = (colIdx > 0 ? ',' : '') + JSON.stringify(nomeColecao) + ':['
          var cpEnd = curPos + cPrefix.length
          if (numCurrentOffset < cpEnd && targetSliceEnd > curPos) {
            var s1 = Math.max(0, numCurrentOffset - curPos)
            var s2 = Math.min(cPrefix.length, targetSliceEnd - curPos)
            sliceBuf += cPrefix.substring(s1, s2)
          }
          curPos = cpEnd

          var chunkIndexDb = 0
          while (true) {
            if (curPos >= targetSliceEnd) break
            var dbRecs = $app.findRecordsByFilter(
              'backups_dados',
              'backup_id = {:bid} && colecao_nome = {:cn} && chunk_index = {:ci}',
              '',
              1,
              0,
              { bid: backupId, cn: nomeColecao, ci: chunkIndexDb },
            )

            if (!dbRecs || dbRecs.length === 0) break

            var rJsonRaw = dbRecs[0].get('registros_json') || ''
            var insideData = ''
            if (
              rJsonRaw.length >= 2 &&
              rJsonRaw[0] === '[' &&
              rJsonRaw[rJsonRaw.length - 1] === ']'
            ) {
              insideData = rJsonRaw.slice(1, -1)
            } else {
              var strObj = JSON.stringify(rJsonRaw)
              if (strObj.length >= 2) insideData = strObj.slice(1, -1)
            }

            if (chunkIndexDb > 0) {
              var commaPos = curPos
              var commaEnd = curPos + 1
              if (numCurrentOffset < commaEnd && targetSliceEnd > commaPos) {
                sliceBuf += ','
              }
              curPos += 1
            }

            var dEnd = curPos + insideData.length
            if (numCurrentOffset < dEnd && targetSliceEnd > curPos) {
              var ds1 = Math.max(0, numCurrentOffset - curPos)
              var ds2 = Math.min(insideData.length, targetSliceEnd - curPos)
              sliceBuf += insideData.substring(ds1, ds2)
            }
            curPos = dEnd
            chunkIndexDb++
          }

          var sufEnd = curPos + 1
          if (numCurrentOffset < sufEnd && targetSliceEnd > curPos) {
            sliceBuf += ']'
          }
          curPos = sufEnd
        }

        var footEnd = curPos + footerSuffix.length
        if (numCurrentOffset < footEnd && targetSliceEnd > curPos) {
          var fs1 = Math.max(0, numCurrentOffset - curPos)
          var fs2 = Math.min(footerSuffix.length, targetSliceEnd - curPos)
          sliceBuf += footerSuffix.substring(fs1, fs2)
        }
        curPos = footEnd

        var actualChunkLen = sliceBuf.length
        if (actualChunkLen === 0) {
          console.warn(
            logPrefix + ' Fatia vazia gerada no offset ' + numCurrentOffset + '. Interrompendo.',
          )
          break
        }

        var numActualChunkLen = parseInt(actualChunkLen, 10) || 0
        if (isNaN(numCurrentOffset) || isNaN(numActualChunkLen) || isNaN(numTotalBytes)) {
          var errNan =
            'Valores numéricos inválidos para chunk: offset=' +
            numCurrentOffset +
            ' len=' +
            numActualChunkLen +
            ' total=' +
            numTotalBytes
          console.error(logPrefix + ' ' + errNan)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errNan)
          $app.save(backupRecord)
          return { status: 'erro', erro: errNan }
        }

        var putEnd = numCurrentOffset + numActualChunkLen - 1
        var putRangeHeader = 'bytes ' + numCurrentOffset + '-' + putEnd + '/' + numTotalBytes

        console.log(
          logPrefix +
            ' [CHUNK] PUT ' +
            putRangeHeader +
            ' (Content-Length: ' +
            numActualChunkLen +
            ')',
        )

        var putRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': String(numActualChunkLen),
            'Content-Range': putRangeHeader,
          },
          body: sliceBuf,
          timeout: 20,
        })

        // Se der HTTP 403 de storage quota no PUT (acontece quando a sessão foi criada com pasta de Drive pessoal comum)
        var putRawLower = (putRes.raw || '').toLowerCase()
        if (
          putRes.statusCode === 403 &&
          (putRawLower.indexOf('storage quota') !== -1 ||
            putRawLower.indexOf('storagequota') !== -1)
        ) {
          console.warn(
            logPrefix +
              ' [PUT 403 QUOTA] Conta de Serviço sem cota na pasta do usuário. Recriando sessão no Drive próprio (sem parents)...',
          )
          var backupNomeArquivo = backupRecord.getString('nome_arquivo') || 'backup_erp.json'
          var fbMeta = {
            name: backupNomeArquivo,
            mimeType: 'application/json',
            description: 'Backup automático ERP Pedreira Cordeiro (resumível - Drive próprio)',
          }
          var fbInitRes = $http.send({
            url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + auth.access_token,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Type': 'application/json',
              'X-Upload-Content-Length': String(totalBytes),
            },
            body: JSON.stringify(fbMeta),
            timeout: 20,
          })

          var fbHeadersMap = fbInitRes.headers || {}
          var fbLoc = fbHeadersMap['Location'] || fbHeadersMap['location']
          if (Array.isArray(fbLoc) && fbLoc.length > 0) fbLoc = fbLoc[0]

          if (fbInitRes.statusCode === 200 && fbLoc) {
            sessionUrl = String(fbLoc)
            currentOffset = 0
            backupRecord.set('drive_session_url', sessionUrl)
            backupRecord.set('drive_status', 'enviando')
            backupRecord.set('drive_offset', 0)
            backupRecord.set('drive_erro', 'Fallback: gravando no Drive da Conta de Serviço')
            $app.save(backupRecord)

            // Refaz o PUT do primeiro chunk na nova sessão imediatamente
            var fbSliceEnd = Math.min(CHUNK_BYTES, totalBytes)
            var fbSliceBuf = sliceBuf.substring(0, fbSliceEnd)
            var fbPutRangeHeader = 'bytes 0-' + (fbSliceBuf.length - 1) + '/' + totalBytes
            console.log(
              logPrefix + ' [FALLBACK CHUNK] PUT ' + fbPutRangeHeader + ' na nova sessão sem pasta',
            )

            putRes = $http.send({
              url: sessionUrl,
              method: 'PUT',
              headers: {
                'Content-Length': String(fbSliceBuf.length),
                'Content-Range': fbPutRangeHeader,
              },
              body: fbSliceBuf,
              timeout: 20,
            })
            numActualChunkLen = fbSliceBuf.length
            numCurrentOffset = 0
            putEnd = fbSliceBuf.length - 1
          } else {
            console.error(
              logPrefix +
                ' [FALLBACK INIT ERRO] Falha ao criar sessão sem pasta: HTTP ' +
                fbInitRes.statusCode +
                ': ' +
                (fbInitRes.raw || ''),
            )
          }
        }

        // Se retornar 401 Unauthorized (token expirado ou revogado no meio do processo), limpa o cache
        if (putRes.statusCode === 401) {
          try {
            var c401SA = $app.findFirstRecordByData(
              'cache_tokens_drive',
              'chave',
              'google_drive_sa',
            )
            if (c401SA) {
              c401SA.set('access_token', '')
              c401SA.set('expiry_ms', 0)
              c401SA.set('detalhes', {})
              $app.save(c401SA)
            }
          } catch (_) {}
          try {
            var c401OAuth = $app.findFirstRecordByData(
              'cache_tokens_drive',
              'chave',
              'google_drive_oauth',
            )
            if (c401OAuth) {
              c401OAuth.set('access_token', '')
              c401OAuth.set('expiry_ms', 0)
              c401OAuth.set('detalhes', {})
              $app.save(c401OAuth)
            }
          } catch (_) {}
          try {
            var cfg401 = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
            if (cfg401) {
              var rawDet401 = cfg401.get('detalhes')
              var det401 = {}
              try {
                det401 =
                  typeof rawDet401 === 'string'
                    ? JSON.parse(rawDet401)
                    : JSON.parse(JSON.stringify(rawDet401 || {}))
              } catch (_) {
                det401 = {}
              }
              if (typeof det401 !== 'object' || det401 === null || Array.isArray(det401)) {
                det401 = {}
              }
              delete det401.cached_token
              delete det401.cached_expiry_ms
              cfg401.set('detalhes', det401)
              $app.save(cfg401)
            }
          } catch (_) {}
          console.warn(
            logPrefix +
              ' [CACHE TOKEN] Google retornou 401; cache dos tokens (SA e OAuth) invalidado.',
          )
        }

        if (putRes.statusCode === 308) {
          var nextOffset = putEnd + 1
          var rangeRsp = putRes.headers?.['Range'] || putRes.headers?.['range']
          if (Array.isArray(rangeRsp)) rangeRsp = rangeRsp[0]
          if (rangeRsp && typeof rangeRsp === 'string') {
            var mO = rangeRsp.match(/bytes=0-(\d+)/)
            if (mO && mO[1]) nextOffset = parseInt(mO[1], 10) + 1
          }

          currentOffset = nextOffset
          backupRecord.set('drive_status', 'enviando')
          backupRecord.set('drive_offset', currentOffset)
          backupRecord.set('drive_erro', '')
          $app.save(backupRecord)

          chunksEnviadosNestaRodada++
          var chunkIndexAtual = Math.round(currentOffset / CHUNK_BYTES)
          console.log(
            logPrefix +
              ' chunk ' +
              chunkIndexAtual +
              '/' +
              totalChunksEstimado +
              ', offset ' +
              currentOffset +
              '/' +
              totalBytes +
              ' (' +
              Math.round((currentOffset / totalBytes) * 100) +
              '%)',
          )
        } else if (putRes.statusCode === 200 || putRes.statusCode === 201) {
          var resFinal = putRes.json || JSON.parse(putRes.raw || '{}')
          var fileIdSalvo = resFinal.id || ''
          shareFileWithUserShared(fileIdSalvo, usuarioEmailDestino, auth.access_token)

          var agoraFinal = new Date().toISOString()
          backupRecord.set('drive_status', 'enviado')
          backupRecord.set('drive_file_id', fileIdSalvo)
          backupRecord.set('drive_enviado_em', agoraFinal)
          backupRecord.set('drive_offset', totalBytes)
          backupRecord.set(
            'drive_erro',
            'Enviado ao Google Drive e compartilhado com ' + usuarioEmailDestino,
          )
          $app.save(backupRecord)

          if (configRec) {
            configRec.set('ultimo_envio', agoraFinal)
            configRec.set('ultimo_status', 'conectado')
            $app.save(configRec)
          }

          console.log(
            logPrefix +
              ' [SUCESSO] Upload 100% concluído! File ID: ' +
              fileIdSalvo +
              ' compartilhado com ' +
              usuarioEmailDestino,
          )
          return {
            status: 'enviado',
            file_id: fileIdSalvo,
            offset: totalBytes,
          }
        } else {
          var errPut =
            'Falha HTTP PUT chunk (HTTP ' +
            putRes.statusCode +
            '): ' +
            (putRes.raw || '').slice(0, 200)
          console.error(logPrefix + ' ' + errPut)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errPut)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errPut }
        }
      }

      return {
        status: currentOffset >= totalBytes ? 'enviado' : 'enviando',
        offset: currentOffset,
        total: totalBytes,
        porcentagem: Math.round((currentOffset / totalBytes) * 100),
        chunks_enviados_rodada: chunksEnviadosNestaRodada,
      }
    } catch (errExec) {
      var rawErr = String(errExec?.message || errExec)
      var msgErr = 'Exceção no envio incremental Drive: ' + rawErr
      if (rawErr.indexOf('account not found') !== -1) {
        msgErr =
          'Erro Google OAuth (400 account not found): a Conta de Serviço informada foi desativada ou excluída no Google Cloud Console. Por favor, reconfigure a chave na tela de Backups.'
      } else if (rawErr.indexOf('invalid_grant') !== -1) {
        msgErr =
          'Erro Google OAuth (invalid_grant): credenciais da Conta de Serviço inválidas ou expiradas.'
      }
      console.error(logPrefix + ' ' + msgErr)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgErr)
        $app.save(backupRecord)
      } catch (_) {}
      return { status: 'erro', erro: msgErr }
    }
  }

  var pending = []
  try {
    pending = $app.findRecordsByFilter(
      'backups_sistema',
      "drive_status = 'solicitado' || drive_status = 'enviando'",
      '-created',
      2,
      0,
    )
  } catch (eFind) {
    return e.json(500, { error: 'Erro ao buscar pendentes: ' + (eFind?.message || eFind) })
  }

  var processados = 0
  var resultado = []

  for (var idx = 0; idx < pending.length; idx++) {
    var backupRecord = pending[idx]
    var backupId = backupRecord.id
    var resFila = processarBackupIncremental(backupId, '[ENDPOINT_FILA]')
    processados++
    resultado.push({ id: backupId, resultado: resFila })
  }

  return e.json(200, {
    success: true,
    total_encontrados: pending.length,
    processados: processados,
    detalhes: resultado,
  })
})

// -------------------------------------------------------------
// 2. CRON JOB DA FILA: REPROCESSADOR DE BACKUPS COM drive_status === 'solicitado' OU 'enviando'
// Executa a cada minuto com fatiamento resumível seguro inline.
// -------------------------------------------------------------
cronAdd('backup_processador_fila_solicitados', '*/1 * * * *', () => {
  console.log('[CRON_FILA] Rodada iniciada: verificando fila...')
  function processarBackupIncremental(backupId, logPrefixOrigem) {
    var logPrefix = (logPrefixOrigem || '[INCREMENTAL]') + '[' + backupId + ']'
    console.log(logPrefix + ' Início de processarBackupIncremental')
    var startRoundTime = Date.now()
    var MAX_ROUND_DURATION_MS = 25000 // 25 segundos máximo por rodada

    function getAccessTokenOAuth(clientId, clientSecret, refreshToken, forcarRenovacao) {
      var nowMs = Date.now()
      if (!forcarRenovacao) {
        try {
          var oRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
          if (oRec) {
            var tok = oRec.getString('access_token') || ''
            var rawExp = oRec.get('expiry_ms')
            if (rawExp == null && typeof oRec.getInt === 'function')
              rawExp = oRec.getInt('expiry_ms')
            var expMs = Number(rawExp) || 0
            if (tok && expMs > 0 && nowMs < expMs - 300000) {
              console.log(
                logPrefix +
                  ' [OAUTH TOKEN CACHE] Usando access token OAuth em cache válido até ' +
                  new Date(expMs).toISOString(),
              )
              return {
                access_token: tok,
                client_email: 'gmail_oauth_user',
                auth_type: 'oauth',
                from_cache: true,
              }
            }
          }
        } catch (_) {}
      }

      console.log(logPrefix + ' [OAUTH TOKEN] Renovando access token via refresh token Google...')
      var postBody =
        'client_id=' +
        encodeURIComponent(clientId) +
        '&client_secret=' +
        encodeURIComponent(clientSecret) +
        '&refresh_token=' +
        encodeURIComponent(refreshToken) +
        '&grant_type=refresh_token'

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postBody,
        timeout: 25,
      })

      if (res.statusCode !== 200) {
        throw new Error(
          'Falha ao renovar token OAuth do Google (HTTP ' +
            res.statusCode +
            '): ' +
            (res.raw || '').slice(0, 300),
        )
      }

      var data = res.json || JSON.parse(res.raw || '{}')
      if (!data.access_token) {
        throw new Error('Access token não retornado na renovação OAuth do Google.')
      }

      var newExpiryMs = nowMs + (data.expires_in || 3600) * 1000
      try {
        var cRec = null
        try {
          cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
        } catch (_) {
          var colCache = $app.findCollectionByNameOrId('cache_tokens_drive')
          cRec = new Record(colCache)
          cRec.set('chave', 'google_drive_oauth')
        }
        cRec.set('access_token', data.access_token)
        cRec.set('expiry_ms', newExpiryMs)
        cRec.set('client_email', 'gmail_oauth_user')
        cRec.set('detalhes', {
          cached_token: data.access_token,
          cached_expiry_ms: newExpiryMs,
          cached_created_at: new Date().toISOString(),
          tipo: 'oauth',
        })
        $app.save(cRec)
        console.log(logPrefix + ' [OAUTH TOKEN] Novo token gravado em cache com sucesso.')
      } catch (eSaveO) {
        console.warn(logPrefix + ' [OAUTH TOKEN] Aviso ao salvar cache:', eSaveO)
      }

      return {
        access_token: data.access_token,
        client_email: 'gmail_oauth_user',
        auth_type: 'oauth',
        from_cache: false,
      }
    }

    function getAccessTokenShared(serviceAccountJson, scope, forcarRenovacao) {
      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowMs = Date.now()
      var nowSec = Math.floor(nowMs / 1000)

      // 1. Tenta reaproveitar o token armazenado em cache dedicado (coleção cache_tokens_drive ou config_google_drive)
      if (!forcarRenovacao) {
        var cachedToken = ''
        var cachedExpiryMs = 0

        // Prioridade A: coleção dedicada cache_tokens_drive
        try {
          var dRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
          if (dRec) {
            cachedToken = dRec.getString('access_token') || ''
            var rawExpD = dRec.get('expiry_ms')
            if (rawExpD == null && typeof dRec.getInt === 'function') {
              rawExpD = dRec.getInt('expiry_ms')
            }
            cachedExpiryMs = Number(rawExpD) || 0
          }
        } catch (_) {}

        // Prioridade B: fallback para config_google_drive.detalhes
        if (!cachedToken || cachedExpiryMs <= 0) {
          try {
            var cfgCacheRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
            if (cfgCacheRec) {
              var detalhesCache = null
              try {
                var rawD = cfgCacheRec.get('detalhes')
                if (typeof rawD === 'string') {
                  detalhesCache = JSON.parse(rawD)
                } else if (rawD && typeof rawD === 'object') {
                  detalhesCache = JSON.parse(JSON.stringify(rawD))
                }
              } catch (_) {
                detalhesCache = null
              }
              if (
                detalhesCache &&
                typeof detalhesCache === 'object' &&
                !Array.isArray(detalhesCache)
              ) {
                cachedToken = detalhesCache.cached_token || ''
                cachedExpiryMs = Number(detalhesCache.cached_expiry_ms) || 0
              }
            }
          } catch (eCacheRead) {
            console.warn(
              logPrefix + ' [CACHE TOKEN] Aviso ao ler fallback config_google_drive:',
              eCacheRead,
            )
          }
        }

        if (cachedToken && cachedExpiryMs > 0) {
          // Margem de segurança de 5 minutos (300.000 ms)
          if (nowMs < cachedExpiryMs - 300000) {
            console.log(
              logPrefix +
                ' [CACHE TOKEN] Usando access token em cache válido até ' +
                new Date(cachedExpiryMs).toISOString(),
            )
            return {
              access_token: cachedToken,
              client_email: creds.client_email,
              project_id: creds.project_id || '',
              from_cache: true,
            }
          } else {
            console.log(
              logPrefix + ' [CACHE TOKEN] Token expirado ou próximo de expirar. Renovando...',
            )
          }
        } else {
          console.log(logPrefix + ' [CACHE TOKEN] Nenhum token válido encontrado no cache.')
        }
      }

      console.log(
        logPrefix + ' [RSA] Iniciando cálculo de assinatura JWT RS256 com RSA CRT acelerado...',
      )
      var rsaStartTime = Date.now()

      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var bi = 0; bi < b64chars.length; bi++) b64tab[b64chars.charAt(bi)] = bi

      function base64ToBytes(s) {
        s = s.replace(/[^A-Za-z0-9+/=]/g, '')
        var bytes = []
        var i = 0
        while (i < s.length) {
          var enc1 = b64tab[s.charAt(i++)]
          var enc2 = b64tab[s.charAt(i++)]
          var enc3 = b64tab[s.charAt(i++)]
          var enc4 = b64tab[s.charAt(i++)]
          var chr1 = (enc1 << 2) | (enc2 >> 4)
          var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
          var chr3 = ((enc3 & 3) << 6) | enc4
          bytes.push(chr1)
          if (enc3 !== undefined && s.charAt(i - 2) !== '=') bytes.push(chr2)
          if (enc4 !== undefined && s.charAt(i - 1) !== '=') bytes.push(chr3)
        }
        return bytes
      }

      function bytesToBase64Url(bytes) {
        var str = ''
        for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
        var b64 = ''
        var j = 0
        while (j < str.length) {
          var c1 = str.charCodeAt(j++)
          var c2 = str.charCodeAt(j++)
          var c3 = str.charCodeAt(j++)
          var e1 = c1 >> 2
          var e2 = ((c1 & 3) << 4) | (c2 >> 4)
          var e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6)
          var e4 = isNaN(c2) || isNaN(c3) ? 64 : c3 & 63
          b64 +=
            b64chars.charAt(e1) +
            b64chars.charAt(e2) +
            (e3 === 64 ? '=' : b64chars.charAt(e3)) +
            (e4 === 64 ? '=' : b64chars.charAt(e4))
        }
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      }

      function utf8ToBase64Url(str) {
        var bytes = []
        for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i)
          if (c < 128) {
            bytes.push(c)
          } else if (c < 2048) {
            bytes.push((c >> 6) | 192)
            bytes.push((c & 63) | 128)
          } else {
            bytes.push((c >> 12) | 224)
            bytes.push(((c >> 6) & 63) | 128)
            bytes.push((c & 63) | 128)
          }
        }
        return bytesToBase64Url(bytes)
      }

      function parsePKCS8orPKCS1(privateKeyPem) {
        var clean = privateKeyPem
          .replace(/-----BEGIN[^-]+-----/g, '')
          .replace(/-----END[^-]+-----/g, '')
          .replace(/\s+/g, '')
        var der = base64ToBytes(clean)
        var pos = 0

        function readLength() {
          var b = der[pos++]
          if (b < 128) return b
          var nBytes = b & 0x7f
          var len = 0
          for (var k = 0; k < nBytes; k++) len = (len << 8) | der[pos++]
          return len
        }

        function readTag() {
          return der[pos++]
        }

        function readInteger() {
          var tag = readTag()
          if (tag !== 0x02)
            throw new Error('ASN.1 inválido: esperado INTEGER (0x02), recebido ' + tag)
          var len = readLength()
          var intBytes = der.slice(pos, pos + len)
          pos += len
          while (intBytes.length > 1 && intBytes[0] === 0) intBytes.shift()
          return intBytes
        }

        var tag = readTag()
        if (tag !== 0x30) throw new Error('ASN.1 inválido: esperado SEQUENCE')
        readLength()

        var nextTag = der[pos]
        if (nextTag === 0x02) {
          pos++
          var vLen = readLength()
          var ver = der[pos]
          pos += vLen
          if (ver === 0 && der[pos] === 0x30) {
            // PKCS#8: SEQUENCE { version, AlgorithmIdentifier, OCTET STRING { PKCS#1 RSAPrivateKey } }
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger() // version
            var n = readInteger()
            var e = readInteger()
            var d = readInteger()
            var p = readInteger()
            var q = readInteger()
            var dp = readInteger()
            var dq = readInteger()
            var qinv = readInteger()
            return {
              n: n,
              e: e,
              d: d,
              p: p,
              q: q,
              dp: dp,
              dq: dq,
              qinv: qinv,
              hasCRT: Boolean(p && q && dp && dq && qinv),
            }
          } else {
            // PKCS#1 direto
            var n1 = readInteger()
            var e1 = readInteger()
            var d1 = readInteger()
            var p1 = null,
              q1 = null,
              dp1 = null,
              dq1 = null,
              qinv1 = null
            try {
              p1 = readInteger()
              q1 = readInteger()
              dp1 = readInteger()
              dq1 = readInteger()
              qinv1 = readInteger()
            } catch (_) {}
            return {
              n: n1,
              e: e1,
              d: d1,
              p: p1,
              q: q1,
              dp: dp1,
              dq: dq1,
              qinv: qinv1,
              hasCRT: Boolean(p1 && q1 && dp1 && dq1 && qinv1),
            }
          }
        }
        throw new Error('Formato de chave privada RSA não reconhecido')
      }

      var BASE = 16384
      var BASE_BITS = 14

      function bytesToBig(bytes) {
        var res = [0]
        for (var i = 0; i < bytes.length; i++) {
          var carry = bytes[i]
          for (var j = 0; j < res.length; j++) {
            var v = res[j] * 256 + carry
            res[j] = v % BASE
            carry = Math.floor(v / BASE)
          }
          while (carry > 0) {
            res.push(carry % BASE)
            carry = Math.floor(carry / BASE)
          }
        }
        return trim(res)
      }

      function bigToBytes(a, expectedLen) {
        var bytes = []
        var temp = a.slice()
        while (temp.length > 1 || temp[0] > 0) {
          var rem = 0
          for (var i = temp.length - 1; i >= 0; i--) {
            var cur = rem * BASE + temp[i]
            temp[i] = Math.floor(cur / 256)
            rem = cur % 256
          }
          temp = trim(temp)
          bytes.unshift(rem)
        }
        while (bytes.length < expectedLen) bytes.unshift(0)
        return bytes
      }

      function trim(a) {
        while (a.length > 1 && a[a.length - 1] === 0) a.pop()
        return a
      }

      function compare(a, b) {
        if (a.length !== b.length) return a.length > b.length ? 1 : -1
        for (var i = a.length - 1; i >= 0; i--) {
          if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
        }
        return 0
      }

      function add(a, b) {
        var res = []
        var maxL = Math.max(a.length, b.length)
        var carry = 0
        for (var i = 0; i < maxL || carry > 0; i++) {
          var sum = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0) + carry
          res.push(sum % BASE)
          carry = Math.floor(sum / BASE)
        }
        return trim(res)
      }

      function sub(a, b) {
        var res = []
        var borrow = 0
        for (var i = 0; i < a.length; i++) {
          var diff = a[i] - borrow - (i < b.length ? b[i] : 0)
          if (diff < 0) {
            diff += BASE
            borrow = 1
          } else {
            borrow = 0
          }
          res.push(diff)
        }
        return trim(res)
      }

      function mul(a, b) {
        var res = []
        for (var i = 0; i < a.length + b.length; i++) res.push(0)
        for (var i = 0; i < a.length; i++) {
          var carry = 0
          for (var j = 0; j < b.length || carry > 0; j++) {
            var cur = res[i + j] + a[i] * (j < b.length ? b[j] : 0) + carry
            res[i + j] = cur % BASE
            carry = Math.floor(cur / BASE)
          }
        }
        return trim(res)
      }

      function divRem(u, v) {
        if (v.length === 1 && v[0] === 0) throw new Error('Divisão por zero')
        if (compare(u, v) < 0) return { q: [0], r: u.slice() }
        if (v.length === 1) {
          var q = []
          var r = 0
          var d = v[0]
          for (var i = u.length - 1; i >= 0; i--) {
            var cur = r * BASE + u[i]
            q[i] = Math.floor(cur / d)
            r = cur % d
          }
          return { q: trim(q), r: [r] }
        }

        var shift = Math.floor(BASE / (v[v.length - 1] + 1))
        var uNorm = mul(u, [shift])
        var vNorm = mul(v, [shift])
        if (uNorm.length === u.length) uNorm.push(0)

        var n = vNorm.length
        var m = uNorm.length - n
        var q = []
        for (var i = 0; i < m; i++) q.push(0)

        var vn1 = vNorm[n - 1]
        var vn2 = vNorm[n - 2]

        for (var j = m - 1; j >= 0; j--) {
          var uTop = uNorm[j + n] * BASE + uNorm[j + n - 1]
          var qHat = Math.floor(uTop / vn1)
          var rHat = uTop % vn1

          while (qHat >= BASE || qHat * vn2 > rHat * BASE + uNorm[j + n - 2]) {
            qHat--
            rHat += vn1
            if (rHat >= BASE) break
          }

          var qv = mul(vNorm, [qHat])
          var borrow = 0
          for (var k = 0; k <= n; k++) {
            var uVal = uNorm[j + k]
            var qvVal = k < qv.length ? qv[k] : 0
            var diff = uVal - borrow - qvVal
            if (diff < 0) {
              diff += BASE
              borrow = 1
            } else {
              borrow = 0
            }
            uNorm[j + k] = diff
          }

          if (borrow > 0) {
            qHat--
            var carry = 0
            for (var k = 0; k <= n; k++) {
              var sum = uNorm[j + k] + carry + (k < vNorm.length ? vNorm[k] : 0)
              uNorm[j + k] = sum % BASE
              carry = Math.floor(sum / BASE)
            }
          }
          q[j] = qHat
        }

        var divResult = divRem(uNorm, [shift])
        return { q: trim(q), r: divResult.q }
      }

      function modPow(baseB, expB, modB) {
        var res = [1]
        var cur = divRem(baseB, modB).r
        var maxChunk = 0
        var maxBit = 0
        for (var i = expB.length - 1; i >= 0; i--) {
          if (expB[i] > 0) {
            maxChunk = i
            maxBit = Math.floor(Math.log2 ? Math.log2(expB[i]) : Math.log(expB[i]) / Math.LN2)
            break
          }
        }
        for (var i = 0; i <= maxChunk; i++) {
          var chunk = expB[i]
          var limitBits = i === maxChunk ? maxBit + 1 : BASE_BITS
          for (var b = 0; b < limitBits; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            if (i < maxChunk || b < limitBits - 1) {
              cur = divRem(mul(cur, cur), modB).r
            }
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var kLen = keyComponents.n.length

        var hex = $security.sha256(dataStr)
        var hash = []
        for (var i = 0; i < hex.length; i += 2) hash.push(parseInt(hex.substr(i, 2), 16))

        var t = SHA256_DIGEST_INFO.concat(hash)
        if (kLen < t.length + 11) throw new Error('Chave RSA curta demais para SHA256')

        var psLen = kLen - t.length - 3
        var em = [0x00, 0x01]
        for (var i = 0; i < psLen; i++) em.push(0xff)
        em.push(0x00)
        for (var i = 0; i < t.length; i++) em.push(t[i])

        var emBig = bytesToBig(em)
        var sBig = null

        if (keyComponents.hasCRT) {
          // RSA Chinese Remainder Theorem: 4x a 8x mais rápido
          var pBig = bytesToBig(keyComponents.p)
          var qBig = bytesToBig(keyComponents.q)
          var dpBig = bytesToBig(keyComponents.dp)
          var dqBig = bytesToBig(keyComponents.dq)
          var qinvBig = bytesToBig(keyComponents.qinv)

          var m1 = modPow(emBig, dpBig, pBig)
          var m2 = modPow(emBig, dqBig, qBig)

          // h = (qinv * (m1 - m2)) mod p
          var diff = null
          if (compare(m1, m2) >= 0) {
            diff = sub(m1, m2)
          } else {
            diff = sub(add(m1, pBig), m2)
          }
          var h = divRem(mul(qinvBig, diff), pBig).r
          // s = m2 + h * q
          sBig = add(m2, mul(h, qBig))
        } else {
          var nBig = bytesToBig(keyComponents.n)
          var dBig = bytesToBig(keyComponents.d)
          sBig = modPow(emBig, dBig, nBig)
        }

        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var header = { alg: 'RS256', typ: 'JWT' }
      var claimSet = {
        iss: creds.client_email,
        scope: scope || 'https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSec + 3600,
        iat: nowSec,
      }

      var encHeader = utf8ToBase64Url(JSON.stringify(header))
      var encClaim = utf8ToBase64Url(JSON.stringify(claimSet))
      var signingInput = encHeader + '.' + encClaim

      var keys = parsePKCS8orPKCS1(creds.private_key)
      var signature = rsaSignSha256(signingInput, keys)
      var assertion = signingInput + '.' + signature
      var rsaElapsed = Date.now() - rsaStartTime
      console.log(logPrefix + ' [RSA] Assinatura RS256 concluída em ' + rsaElapsed + 'ms!')

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: 20,
      })

      if (res.statusCode !== 200) {
        throw new Error(
          'Falha no endpoint Google OAuth (HTTP ' + res.statusCode + '): ' + (res.raw || ''),
        )
      }

      var data = res.json || JSON.parse(res.raw || '{}')
      if (!data.access_token) {
        throw new Error('Access token não retornado pelo Google OAuth.')
      }

      // 2. Salva o access token retornado no cache persistente (validade 1h / 3600s)
      var expiryMsCalculado = Date.now() + (data.expires_in || 3600) * 1000

      // Prioridade A: salvar na coleção dedicada cache_tokens_drive
      try {
        var cRec = null
        try {
          cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
        } catch (_) {
          var cacheTokensCol = $app.findCollectionByNameOrId('cache_tokens_drive')
          cRec = new Record(cacheTokensCol)
          cRec.set('chave', 'google_drive_sa')
        }
        cRec.set('access_token', data.access_token)
        cRec.set('expiry_ms', expiryMsCalculado)
        cRec.set('client_email', creds.client_email)
        cRec.set('detalhes', {
          cached_token: data.access_token,
          cached_expiry_ms: expiryMsCalculado,
          cached_created_at: new Date().toISOString(),
        })
        $app.save(cRec)
        console.log(
          logPrefix +
            ' [CACHE TOKEN] Novo token gravado em cache_tokens_drive com sucesso (expira em ' +
            (data.expires_in || 3600) +
            's).',
        )
      } catch (eSaveDed) {
        console.warn(logPrefix + ' [CACHE TOKEN] Aviso ao salvar em cache_tokens_drive:', eSaveDed)
      }

      // Prioridade B: espelho leve em config_google_drive.detalhes sem inflar o JSON
      try {
        var cfgSaveRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (cfgSaveRec) {
          var rawDetSave = cfgSaveRec.get('detalhes')
          var curDetalhes = {}
          try {
            curDetalhes =
              typeof rawDetSave === 'string'
                ? JSON.parse(rawDetSave)
                : JSON.parse(JSON.stringify(rawDetSave || {}))
          } catch (_) {
            curDetalhes = {}
          }
          if (
            typeof curDetalhes !== 'object' ||
            curDetalhes === null ||
            Array.isArray(curDetalhes)
          ) {
            curDetalhes = {}
          }
          curDetalhes.cached_expiry_ms = expiryMsCalculado
          curDetalhes.cached_created_at = new Date().toISOString()
          // Limpar qualquer token residual ou payload gigante no campo detalhes
          delete curDetalhes.cached_token
          cfgSaveRec.set('detalhes', curDetalhes)
          $app.save(cfgSaveRec)
        }
      } catch (eSaveCache) {
        console.warn(logPrefix + ' [CACHE TOKEN] Aviso ao tocar config_google_drive:', eSaveCache)
      }

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
        from_cache: false,
      }
    }

    function shareFileWithUserShared(fileId, userEmail, token) {
      if (!userEmail) return { success: false, error: 'Email de usuário não informado' }
      try {
        var permUrl =
          'https://www.googleapis.com/drive/v3/files/' +
          encodeURIComponent(fileId) +
          '/permissions?supportsAllDrives=true&sendNotificationEmail=false'
        var permRes = $http.send({
          url: permUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'user',
            emailAddress: userEmail,
          }),
          timeout: 20,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          console.log(
            logPrefix + ' [PERMISSIONS] Arquivo compartilhado com ' + userEmail + ' como reader.',
          )
          return { success: true }
        }
        console.warn(
          logPrefix +
            ' [PERMISSIONS] Aviso ao compartilhar: HTTP ' +
            permRes.statusCode +
            ': ' +
            (permRes.raw || ''),
        )
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
        console.warn(logPrefix + ' [PERMISSIONS] Erro de rede ao compartilhar:', eShare)
        return {
          success: false,
          error: String(eShare?.message || eShare),
        }
      }
    }

    var backupRecord = null
    try {
      backupRecord = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
    } catch (eFind) {
      console.error(logPrefix + ' Backup não encontrado: ' + backupId)
      return { status: 'erro', erro: 'Backup não encontrado: ' + backupId }
    }

    var tentativas = backupRecord.getInt('drive_tentativas') || 0
    var curStatus = backupRecord.getString('drive_status') || 'solicitado'
    // Limite de tentativas só se aplica a falhas reais consecutivas, não a rodadas normais de upload incremental (status 'enviando')
    if (curStatus !== 'enviando' && tentativas >= 10) {
      var msgMax = 'Limite de tentativas excedido (10). Tente novamente pela tela do sistema.'
      console.warn(logPrefix + ' ' + msgMax)
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', msgMax)
      $app.save(backupRecord)
      return { status: 'erro', erro: msgMax }
    }

    try {
      var serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      var folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      var usuarioEmailDestino = 'renilsonfmello@gmail.com'
      var configRec = null
      var oauthClientId = ''
      var oauthClientSecret = ''
      var oauthRefreshToken = ''
      var oauthStatus = ''

      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('usuario_email')) {
            usuarioEmailDestino = configRec.getString('usuario_email')
          }
          oauthClientId =
            configRec.getString('oauth_client_id') || configRec.getString('client_id') || ''
          oauthClientSecret =
            configRec.getString('oauth_client_secret') || configRec.getString('client_secret') || ''
          oauthRefreshToken = configRec.getString('oauth_refresh_token') || ''
          oauthStatus = configRec.getString('oauth_status') || ''
        }
      } catch (_) {}

      var temOAuth = Boolean(oauthRefreshToken && oauthClientId && oauthClientSecret)
      var temSA = Boolean(serviceAccountJson)

      if (!temOAuth && !temSA) {
        var msgSemConta =
          'Google Drive não configurado no ERP (nem OAuth nem Conta de Serviço cadastrados).'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        return { status: 'erro', erro: msgSemConta }
      }

      var auth = null
      if (temOAuth) {
        console.log(
          logPrefix + ' Obtendo access token Google via OAuth do usuário (Gmail pessoal)...',
        )
        auth = getAccessTokenOAuth(oauthClientId, oauthClientSecret, oauthRefreshToken, false)
        console.log(logPrefix + ' Token OAuth obtido com sucesso (tipo: ' + auth.auth_type + ')')
      } else {
        console.log(logPrefix + ' Obtendo access token Google via Conta de Serviço (fallback)...')
        auth = getAccessTokenShared(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
          false,
        )
        console.log(
          logPrefix + ' Token Conta de Serviço obtido com sucesso para: ' + auth.client_email,
        )
      }
      var resumoRaw = backupRecord.get('resumo_colecoes') || {}
      var colecoesValidas = [
        'empresas',
        'empresa_membros',
        'users',
        'clientes',
        'fornecedores',
        'produtos',
        'plano_contas',
        'contas_pagar',
        'contas_receber',
        'bancos_contas',
        'movimentos_financeiros',
        'conciliacoes',
        'empresa_convites',
        'veiculos',
        'abastecimentos',
        'manutencoes',
        'centros_custos',
        'creditos_clientes',
        'funcionarios',
        'folha_horas_extras',
        'entregas',
        'vendas',
        'despesas_frota',
        'historico_alteracoes',
        'formas_recebimento',
        'cheques_predatados',
        'contadores_sequenciais',
      ]
      var metaJsonStr = JSON.stringify({
        id: backupRecord.id,
        nome_arquivo: backupRecord.getString('nome_arquivo'),
        tipo: backupRecord.getString('tipo'),
        origem: backupRecord.getString('origem') || 'manual',
        total_colecoes: backupRecord.getInt('total_colecoes'),
        total_registros: backupRecord.getInt('total_registros'),
        resumo_colecoes: backupRecord.get('resumo_colecoes'),
        created: backupRecord.getString('created'),
        exportado_em: new Date().toISOString(),
        sistema: 'Pedreira Cordeiro ERP (NovaGest)',
      })
      var headerPrefix = '{"meta":' + metaJsonStr + ',"dados":{'
      var footerSuffix = '}}\n'

      var totalBytes = backupRecord.getInt('drive_total_bytes') || 0
      var sessionUrl = backupRecord.getString('drive_session_url') || ''

      if (!totalBytes || totalBytes === 0) {
        var calcBytes = headerPrefix.length + footerSuffix.length
        for (var ci = 0; ci < colecoesValidas.length; ci++) {
          var cn = colecoesValidas[ci]
          if (ci > 0) calcBytes += 1
          calcBytes += JSON.stringify(cn).length + ':['
          var statsModel = new DynamicModel({ cnt: 0, chars_data: 0 })
          var cntChunks = 0
          var charsData = 0
          try {
            $app
              .db()
              .newQuery(
                'SELECT COALESCE(COUNT(*), 0) as cnt, ' +
                  'COALESCE(SUM(CASE WHEN LENGTH(registros_json) > 2 THEN LENGTH(registros_json) - 2 ELSE 0 END), 0) as chars_data ' +
                  'FROM backups_dados WHERE backup_id = {:bid} AND colecao_nome = {:cn}',
              )
              .bind({ bid: backupId, cn: cn })
              .one(statsModel)

            var rawCnt = statsModel.cnt
            var rawChars = statsModel.chars_data
            if (rawCnt == null && typeof statsModel.get === 'function') {
              try {
                rawCnt = statsModel.get('cnt')
              } catch (_) {}
            }
            if (rawChars == null && typeof statsModel.get === 'function') {
              try {
                rawChars = statsModel.get('chars_data')
              } catch (_) {}
            }
            cntChunks = parseInt(rawCnt, 10) || 0
            charsData = parseInt(rawChars, 10) || 0
          } catch (eStats) {
            console.warn(logPrefix + ' Aviso ao calcular bytes da coleção ' + cn + ':', eStats)
          }

          calcBytes += charsData
          if (cntChunks > 1) {
            calcBytes += cntChunks - 1
          }
          calcBytes += 1
        }

        totalBytes = parseInt(calcBytes, 10) || 0
        console.log(logPrefix + ' totalBytes calculado via SQL: ' + totalBytes)
        backupRecord.set('drive_total_bytes', totalBytes)
        backupRecord.set('drive_offset', 0)
        $app.save(backupRecord)
      }

      if (!sessionUrl) {
        var initUrl =
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true'
        var fileMetadata = {
          name: backupRecord.getString('nome_arquivo'),
          mimeType: 'application/json',
        }
        if (folderId) {
          fileMetadata.parents = [folderId]
        }

        var initRes = $http.send({
          url: initUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/json',
            'X-Upload-Content-Length': String(totalBytes),
          },
          body: JSON.stringify(fileMetadata),
          timeout: 20,
        })

        var isInitQuotaError =
          initRes.statusCode === 403 &&
          ((initRes.raw || '').toLowerCase().indexOf('storage quota') !== -1 ||
            (initRes.raw || '').toLowerCase().indexOf('storagequota') !== -1)

        if ((initRes.statusCode !== 200 || isInitQuotaError) && fileMetadata.parents) {
          console.log(
            logPrefix +
              ' [FALLBACK INIT] Falha na criação com pasta (HTTP ' +
              initRes.statusCode +
              '). Criando sessão resumível no Drive próprio da Conta de Serviço (sem parents)...',
          )
          delete fileMetadata.parents
          initRes = $http.send({
            url: initUrl,
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + auth.access_token,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Type': 'application/json',
              'X-Upload-Content-Length': String(totalBytes),
            },
            body: JSON.stringify(fileMetadata),
            timeout: 20,
          })
        }

        if (initRes.statusCode !== 200) {
          var errInit =
            'Falha ao iniciar sessão resumível Google Drive (HTTP ' +
            initRes.statusCode +
            '): ' +
            (initRes.raw || '')
          console.error(logPrefix + ' ' + errInit)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errInit)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errInit }
        }

        var headersMap = initRes.headers || {}
        var loc = headersMap['Location'] || headersMap['location']
        if (Array.isArray(loc) && loc.length > 0) loc = loc[0]
        if (!loc && typeof loc !== 'string') {
          var errLoc = 'Google Drive não retornou Location para upload resumível.'
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errLoc)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errLoc }
        }

        sessionUrl = String(loc)
        backupRecord.set('drive_session_url', sessionUrl)
        backupRecord.set('drive_status', 'enviando')
        backupRecord.set('drive_offset', 0)
        if (!fileMetadata.parents && folderId) {
          backupRecord.set('drive_erro', 'Fallback: gravando no Drive da Conta de Serviço')
        } else {
          backupRecord.set('drive_erro', '')
        }
        $app.save(backupRecord)
      }

      var currentOffset = parseInt(backupRecord.getInt('drive_offset'), 10) || 0
      totalBytes = parseInt(totalBytes, 10) || 0

      // Só checa o offset no Google se currentOffset > 0 (sessão retomada no meio)
      if (currentOffset > 0) {
        try {
          var checkRangeHeader = 'bytes */' + totalBytes
          console.log(logPrefix + ' [CHECK_OFFSET] PUT ' + checkRangeHeader)
          var checkRes = $http.send({
            url: sessionUrl,
            method: 'PUT',
            headers: {
              'Content-Length': '0',
              'Content-Range': checkRangeHeader,
            },
            timeout: 15,
          })

          if (checkRes.statusCode === 308) {
            var rangeHeader = checkRes.headers?.['Range'] || checkRes.headers?.['range']
            if (Array.isArray(rangeHeader)) rangeHeader = rangeHeader[0]
            if (rangeHeader && typeof rangeHeader === 'string') {
              var matchRange = rangeHeader.match(/bytes=0-(\d+)/)
              if (matchRange && matchRange[1]) {
                currentOffset = parseInt(matchRange[1], 10) + 1
                backupRecord.set('drive_offset', currentOffset)
              }
            }
          } else if (checkRes.statusCode === 200 || checkRes.statusCode === 201) {
            var dataConcluido = checkRes.json || JSON.parse(checkRes.raw || '{}')
            var fileIdPronto = dataConcluido.id || ''
            shareFileWithUserShared(fileIdPronto, usuarioEmailDestino, auth.access_token)
            var agoraIso = new Date().toISOString()
            backupRecord.set('drive_status', 'enviado')
            backupRecord.set('drive_file_id', fileIdPronto)
            backupRecord.set('drive_enviado_em', agoraIso)
            backupRecord.set('drive_offset', totalBytes)
            backupRecord.set(
              'drive_erro',
              'Concluído com sucesso (compartilhado com ' + usuarioEmailDestino + ')',
            )
            $app.save(backupRecord)
            console.log(
              logPrefix +
                ' [FINAL] Arquivo concluído no Drive (HTTP 200/201). Compartilhado com ' +
                usuarioEmailDestino,
            )
            return { status: 'concluido', file_id: fileIdPronto }
          }
        } catch (eCheck) {
          console.warn(logPrefix + ' Aviso na consulta de offset:', eCheck)
        }
      }

      var CHUNK_BYTES = 256 * 1024
      var chunksEnviadosNestaRodada = 0
      var totalChunksEstimado = Math.ceil(totalBytes / CHUNK_BYTES)

      while (currentOffset < totalBytes) {
        if (Date.now() - startRoundTime >= MAX_ROUND_DURATION_MS) {
          break
        }

        var numCurrentOffset = parseInt(currentOffset, 10) || 0
        var numTotalBytes = parseInt(totalBytes, 10) || 0
        var targetSliceEnd = Math.min(numCurrentOffset + CHUNK_BYTES, numTotalBytes)
        var targetSliceLen = targetSliceEnd - numCurrentOffset
        if (targetSliceEnd < numTotalBytes && targetSliceLen % CHUNK_BYTES !== 0) {
          targetSliceLen = Math.floor(targetSliceLen / CHUNK_BYTES) * CHUNK_BYTES
          targetSliceEnd = numCurrentOffset + targetSliceLen
        }

        var sliceBuf = ''
        var curPos = 0

        var hEnd = curPos + headerPrefix.length
        if (numCurrentOffset < hEnd && targetSliceEnd > curPos) {
          var sStart = Math.max(0, numCurrentOffset - curPos)
          var sEnd = Math.min(headerPrefix.length, targetSliceEnd - curPos)
          sliceBuf += headerPrefix.substring(sStart, sEnd)
        }
        curPos = hEnd

        for (var colIdx = 0; colIdx < colecoesValidas.length; colIdx++) {
          if (curPos >= targetSliceEnd) break
          var nomeColecao = colecoesValidas[colIdx]

          var cPrefix = (colIdx > 0 ? ',' : '') + JSON.stringify(nomeColecao) + ':['
          var cpEnd = curPos + cPrefix.length
          if (numCurrentOffset < cpEnd && targetSliceEnd > curPos) {
            var s1 = Math.max(0, numCurrentOffset - curPos)
            var s2 = Math.min(cPrefix.length, targetSliceEnd - curPos)
            sliceBuf += cPrefix.substring(s1, s2)
          }
          curPos = cpEnd

          var chunkIndexDb = 0
          while (true) {
            if (curPos >= targetSliceEnd) break
            var dbRecs = $app.findRecordsByFilter(
              'backups_dados',
              'backup_id = {:bid} && colecao_nome = {:cn} && chunk_index = {:ci}',
              '',
              1,
              0,
              { bid: backupId, cn: nomeColecao, ci: chunkIndexDb },
            )

            if (!dbRecs || dbRecs.length === 0) break

            var rJsonRaw = dbRecs[0].get('registros_json') || ''
            var insideData = ''
            if (
              rJsonRaw.length >= 2 &&
              rJsonRaw[0] === '[' &&
              rJsonRaw[rJsonRaw.length - 1] === ']'
            ) {
              insideData = rJsonRaw.slice(1, -1)
            } else {
              var strObj = JSON.stringify(rJsonRaw)
              if (strObj.length >= 2) insideData = strObj.slice(1, -1)
            }

            if (chunkIndexDb > 0) {
              var commaPos = curPos
              var commaEnd = curPos + 1
              if (numCurrentOffset < commaEnd && targetSliceEnd > commaPos) {
                sliceBuf += ','
              }
              curPos += 1
            }

            var dEnd = curPos + insideData.length
            if (numCurrentOffset < dEnd && targetSliceEnd > curPos) {
              var ds1 = Math.max(0, numCurrentOffset - curPos)
              var ds2 = Math.min(insideData.length, targetSliceEnd - curPos)
              sliceBuf += insideData.substring(ds1, ds2)
            }
            curPos = dEnd
            chunkIndexDb++
          }

          var sufEnd = curPos + 1
          if (numCurrentOffset < sufEnd && targetSliceEnd > curPos) {
            sliceBuf += ']'
          }
          curPos = sufEnd
        }

        var footEnd = curPos + footerSuffix.length
        if (numCurrentOffset < footEnd && targetSliceEnd > curPos) {
          var fs1 = Math.max(0, numCurrentOffset - curPos)
          var fs2 = Math.min(footerSuffix.length, targetSliceEnd - curPos)
          sliceBuf += footerSuffix.substring(fs1, fs2)
        }
        curPos = footEnd

        var actualChunkLen = sliceBuf.length
        if (actualChunkLen === 0) {
          console.warn(
            logPrefix + ' Fatia vazia gerada no offset ' + numCurrentOffset + '. Interrompendo.',
          )
          break
        }

        var numActualChunkLen = parseInt(actualChunkLen, 10) || 0
        if (isNaN(numCurrentOffset) || isNaN(numActualChunkLen) || isNaN(numTotalBytes)) {
          var errNan =
            'Valores numéricos inválidos para chunk: offset=' +
            numCurrentOffset +
            ' len=' +
            numActualChunkLen +
            ' total=' +
            numTotalBytes
          console.error(logPrefix + ' ' + errNan)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errNan)
          $app.save(backupRecord)
          return { status: 'erro', erro: errNan }
        }

        var putEnd = numCurrentOffset + numActualChunkLen - 1
        var putRangeHeader = 'bytes ' + numCurrentOffset + '-' + putEnd + '/' + numTotalBytes

        console.log(
          logPrefix +
            ' [CHUNK] PUT ' +
            putRangeHeader +
            ' (Content-Length: ' +
            numActualChunkLen +
            ')',
        )

        var putRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': String(numActualChunkLen),
            'Content-Range': putRangeHeader,
          },
          body: sliceBuf,
          timeout: 20,
        })

        // Se der HTTP 403 de storage quota no PUT (acontece quando a sessão foi criada com pasta de Drive pessoal comum)
        var putRawLowerCron = (putRes.raw || '').toLowerCase()
        if (
          putRes.statusCode === 403 &&
          (putRawLowerCron.indexOf('storage quota') !== -1 ||
            putRawLowerCron.indexOf('storagequota') !== -1)
        ) {
          console.warn(
            logPrefix +
              ' [PUT 403 QUOTA] Conta de Serviço sem cota na pasta do usuário. Recriando sessão no Drive próprio (sem parents)...',
          )
          var backupNomeArquivoCron = backupRecord.getString('nome_arquivo') || 'backup_erp.json'
          var fbMetaCron = {
            name: backupNomeArquivoCron,
            mimeType: 'application/json',
            description: 'Backup automático ERP Pedreira Cordeiro (resumível - Drive próprio)',
          }
          var fbInitResCron = $http.send({
            url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + auth.access_token,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Type': 'application/json',
              'X-Upload-Content-Length': String(totalBytes),
            },
            body: JSON.stringify(fbMetaCron),
            timeout: 20,
          })

          var fbHeadersMapCron = fbInitResCron.headers || {}
          var fbLocCron = fbHeadersMapCron['Location'] || fbHeadersMapCron['location']
          if (Array.isArray(fbLocCron) && fbLocCron.length > 0) fbLocCron = fbLocCron[0]

          if (fbInitResCron.statusCode === 200 && fbLocCron) {
            sessionUrl = String(fbLocCron)
            currentOffset = 0
            backupRecord.set('drive_session_url', sessionUrl)
            backupRecord.set('drive_status', 'enviando')
            backupRecord.set('drive_offset', 0)
            backupRecord.set('drive_erro', 'Fallback: gravando no Drive da Conta de Serviço')
            $app.save(backupRecord)

            // Refaz o PUT do primeiro chunk na nova sessão imediatamente
            var fbSliceEndCron = Math.min(CHUNK_BYTES, totalBytes)
            var fbSliceBufCron = sliceBuf.substring(0, fbSliceEndCron)
            var fbPutRangeHeaderCron = 'bytes 0-' + (fbSliceBufCron.length - 1) + '/' + totalBytes
            console.log(
              logPrefix +
                ' [FALLBACK CHUNK] PUT ' +
                fbPutRangeHeaderCron +
                ' na nova sessão sem pasta',
            )

            putRes = $http.send({
              url: sessionUrl,
              method: 'PUT',
              headers: {
                'Content-Length': String(fbSliceBufCron.length),
                'Content-Range': fbPutRangeHeaderCron,
              },
              body: fbSliceBufCron,
              timeout: 20,
            })
            numActualChunkLen = fbSliceBufCron.length
            numCurrentOffset = 0
            putEnd = fbSliceBufCron.length - 1
          } else {
            console.error(
              logPrefix +
                ' [FALLBACK INIT ERRO] Falha ao criar sessão sem pasta: HTTP ' +
                fbInitResCron.statusCode +
                ': ' +
                (fbInitResCron.raw || ''),
            )
          }
        }

        // Se retornar 401 Unauthorized (token expirado ou revogado no meio do processo), limpa o cache
        if (putRes.statusCode === 401) {
          try {
            var c401CronSA = $app.findFirstRecordByData(
              'cache_tokens_drive',
              'chave',
              'google_drive_sa',
            )
            if (c401CronSA) {
              c401CronSA.set('access_token', '')
              c401CronSA.set('expiry_ms', 0)
              c401CronSA.set('detalhes', {})
              $app.save(c401CronSA)
            }
          } catch (_) {}
          try {
            var c401CronOAuth = $app.findFirstRecordByData(
              'cache_tokens_drive',
              'chave',
              'google_drive_oauth',
            )
            if (c401CronOAuth) {
              c401CronOAuth.set('access_token', '')
              c401CronOAuth.set('expiry_ms', 0)
              c401CronOAuth.set('detalhes', {})
              $app.save(c401CronOAuth)
            }
          } catch (_) {}
          try {
            var cfg401Cron = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
            if (cfg401Cron) {
              var rawDet401Cron = cfg401Cron.get('detalhes')
              var det401Cron = {}
              try {
                det401Cron =
                  typeof rawDet401Cron === 'string'
                    ? JSON.parse(rawDet401Cron)
                    : JSON.parse(JSON.stringify(rawDet401Cron || {}))
              } catch (_) {
                det401Cron = {}
              }
              if (
                typeof det401Cron !== 'object' ||
                det401Cron === null ||
                Array.isArray(det401Cron)
              ) {
                det401Cron = {}
              }
              delete det401Cron.cached_token
              delete det401Cron.cached_expiry_ms
              cfg401Cron.set('detalhes', det401Cron)
              $app.save(cfg401Cron)
            }
          } catch (_) {}
          console.warn(
            logPrefix +
              ' [CACHE TOKEN] Google retornou 401; cache dos tokens (SA e OAuth) invalidado.',
          )
        }

        if (putRes.statusCode === 308) {
          var nextOffset = putEnd + 1
          var rangeRsp = putRes.headers?.['Range'] || putRes.headers?.['range']
          if (Array.isArray(rangeRsp)) rangeRsp = rangeRsp[0]
          if (rangeRsp && typeof rangeRsp === 'string') {
            var mO = rangeRsp.match(/bytes=0-(\d+)/)
            if (mO && mO[1]) nextOffset = parseInt(mO[1], 10) + 1
          }

          currentOffset = nextOffset
          backupRecord.set('drive_status', 'enviando')
          backupRecord.set('drive_offset', currentOffset)
          backupRecord.set('drive_erro', '')
          $app.save(backupRecord)

          chunksEnviadosNestaRodada++
          var chunkIndexAtual = Math.round(currentOffset / CHUNK_BYTES)
          console.log(
            logPrefix +
              ' chunk ' +
              chunkIndexAtual +
              '/' +
              totalChunksEstimado +
              ', offset ' +
              currentOffset +
              '/' +
              totalBytes +
              ' (' +
              Math.round((currentOffset / totalBytes) * 100) +
              '%)',
          )
        } else if (putRes.statusCode === 200 || putRes.statusCode === 201) {
          var resFinal = putRes.json || JSON.parse(putRes.raw || '{}')
          var fileIdSalvo = resFinal.id || ''
          shareFileWithUserShared(fileIdSalvo, usuarioEmailDestino, auth.access_token)

          var agoraFinal = new Date().toISOString()
          backupRecord.set('drive_status', 'enviado')
          backupRecord.set('drive_file_id', fileIdSalvo)
          backupRecord.set('drive_enviado_em', agoraFinal)
          backupRecord.set('drive_offset', totalBytes)
          backupRecord.set(
            'drive_erro',
            'Enviado ao Google Drive e compartilhado com ' + usuarioEmailDestino,
          )
          $app.save(backupRecord)

          if (configRec) {
            configRec.set('ultimo_envio', agoraFinal)
            configRec.set('ultimo_status', 'conectado')
            $app.save(configRec)
          }

          console.log(
            logPrefix +
              ' [SUCESSO] Upload 100% concluído! File ID: ' +
              fileIdSalvo +
              ' compartilhado com ' +
              usuarioEmailDestino,
          )
          return {
            status: 'enviado',
            file_id: fileIdSalvo,
            offset: totalBytes,
          }
        } else {
          var errPut =
            'Falha HTTP PUT chunk (HTTP ' +
            putRes.statusCode +
            '): ' +
            (putRes.raw || '').slice(0, 200)
          console.error(logPrefix + ' ' + errPut)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errPut)
          backupRecord.set('drive_tentativas', tentativas + 1)
          $app.save(backupRecord)
          return { status: 'erro', erro: errPut }
        }
      }

      return {
        status: currentOffset >= totalBytes ? 'enviado' : 'enviando',
        offset: currentOffset,
        total: totalBytes,
        porcentagem: Math.round((currentOffset / totalBytes) * 100),
        chunks_enviados_rodada: chunksEnviadosNestaRodada,
      }
    } catch (errExec) {
      var rawErr = String(errExec?.message || errExec)
      var msgErr = 'Exceção no envio incremental Drive: ' + rawErr
      if (rawErr.indexOf('account not found') !== -1) {
        msgErr =
          'Erro Google OAuth (400 account not found): a Conta de Serviço informada foi desativada ou excluída no Google Cloud Console. Por favor, reconfigure a chave na tela de Backups.'
      } else if (rawErr.indexOf('invalid_grant') !== -1) {
        msgErr =
          'Erro Google OAuth (invalid_grant): credenciais da Conta de Serviço inválidas ou expiradas.'
      }
      console.error(logPrefix + ' ' + msgErr)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgErr)
        $app.save(backupRecord)
      } catch (_) {}
      return { status: 'erro', erro: msgErr }
    }
  }

  var pending = []
  try {
    pending = $app.findRecordsByFilter(
      'backups_sistema',
      "drive_status = 'solicitado' || drive_status = 'enviando'",
      '-created',
      2,
      0,
    )
  } catch (eFind) {
    console.error('[CRON FILA DRIVE] Erro ao buscar registros na fila:', eFind)
    return
  }

  console.log(
    '[CRON FILA DRIVE] Registros pendentes encontrados: ' + (pending ? pending.length : 0),
  )

  if (!pending || pending.length === 0) {
    return
  }

  for (var idx = 0; idx < pending.length; idx++) {
    var backupRecord = pending[idx]
    var backupId = backupRecord.id
    try {
      console.log('[CRON_FILA][' + backupId + '] Chamando processarBackupIncremental...')
      var resInc = processarBackupIncremental(backupId, '[CRON_FILA]')
      console.log('[CRON_FILA][' + backupId + '] Resultado da rodada:', JSON.stringify(resInc))
    } catch (eCronLoop) {
      console.error('[CRON_FILA][' + backupId + '] Erro não capturado:', eCronLoop)
    }
  }
})

// -------------------------------------------------------------
// 3. REGISTRO DO CRON JOB SEMANAL COM ENVIO AUTOMÁTICO AO GOOGLE DRIVE
// Executa todo domingo às 00:30 (horário do servidor PocketBase)
// -------------------------------------------------------------
cronAdd('backup_semanal_pedreira_cordeiro', '30 0 * * 0', () => {
  console.log('[CRON] Iniciando execução do backup semanal automático da Pedreira Cordeiro...')

  var colecoesParaDump = [
    'empresas',
    'empresa_membros',
    'users',
    'clientes',
    'fornecedores',
    'produtos',
    'plano_contas',
    'contas_pagar',
    'contas_receber',
    'bancos_contas',
    'movimentos_financeiros',
    'conciliacoes',
    'empresa_convites',
    'veiculos',
    'abastecimentos',
    'manutencoes',
    'centros_custos',
    'creditos_clientes',
    'funcionarios',
    'folha_horas_extras',
    'entregas',
    'vendas',
    'despesas_frota',
    'historico_alteracoes',
    'formas_recebimento',
    'cheques_predatados',
    'contadores_sequenciais',
  ]

  var timestampStr = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  var nomeArquivo = 'backup_semanal_auto_' + timestampStr + '.json'

  try {
    var backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    var dadosCol = $app.findCollectionByNameOrId('backups_dados')

    var nativoStatus = 'tentado'
    var nativoArquivo = ''
    var nativoErro = ''
    var zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
    try {
      if (typeof $app.createBackup === 'function') {
        try {
          $app.createBackup(zipName)
          nativoStatus = 'sucesso'
          nativoArquivo = zipName
        } catch (e1) {
          nativoStatus = 'falha'
          nativoErro = String(e1?.message || e1)
        }
      } else {
        nativoStatus = 'nao_disponivel_jsvm'
        nativoErro = 'createBackup não exposto na JSVM do PocketBase'
      }
    } catch (eG) {
      nativoStatus = 'erro'
      nativoErro = String(eG?.message || eG)
    }

    var resumo = {}
    var totalRegistrosGeral = 0
    var colecoesComErro = 0

    var backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', nomeArquivo)
    backupRecord.set('tipo', 'completo')
    backupRecord.set('origem', 'semanal_automatico')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('drive_status', 'solicitado')
    backupRecord.set('total_colecoes', colecoesParaDump.length)
    backupRecord.set('total_registros', 0)
    backupRecord.set('resumo_colecoes', {})
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'semanal_automatico',
      solicitado_por: 'Backup Semanal Automático (Cron)',
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      status: 'processando',
    })
    backupRecord.set('backup_duplicatas_incluido', false)
    backupRecord.set('observacoes', 'Backup semanal automático em execução programada...')
    $app.save(backupRecord)

    for (var i = 0; i < colecoesParaDump.length; i++) {
      var colName = colecoesParaDump[i]
      try {
        var records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        var count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          var serialized = []
          for (var j = 0; j < count; j++) {
            var r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                var obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                var c = r.collection()
                if (c && c.fields) {
                  var fields = c.fields.all()
                  for (var f = 0; f < fields.length; f++) {
                    var fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          var CHUNK_SIZE = 200
          var totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (var ch = 0; ch < totalChunks; ch++) {
            var chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            var dadoRec = new Record(dadosCol)
            dadoRec.set('backup_id', backupRecord.id)
            dadoRec.set('colecao_nome', colName)
            dadoRec.set('chunk_index', ch)
            dadoRec.set('total_chunks', totalChunks)
            dadoRec.set('registros_count', chunkData.length)
            dadoRec.set('registros_json', chunkData)
            $app.save(dadoRec)
          }
        }
      } catch (errCol) {
        colecoesComErro++
        resumo[colName] = { erro: String(errCol?.message || errCol) }
        console.warn('[CRON] Aviso ao extrair ' + colName + ':', errCol)
      }
    }

    var backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        var cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    var statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

    backupRecord.set('total_registros', totalRegistrosGeral)
    backupRecord.set('total_colecoes', Object.keys(resumo).length)
    backupRecord.set('resumo_colecoes', resumo)
    backupRecord.set('backup_duplicatas_incluido', backupDuplicatasIncluido)
    backupRecord.set('status', statusFinal)
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'semanal_automatico',
      solicitado_por: 'Backup Semanal Automático (Cron)',
      total_registros_geral: totalRegistrosGeral,
      colecoes_com_erro: colecoesComErro,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      colecoes_processadas: Object.keys(resumo),
    })
    backupRecord.set(
      'observacoes',
      'Backup semanal automático programado concluído com status "' +
        statusFinal +
        '". Total de ' +
        totalRegistrosGeral +
        ' registros e ' +
        Object.keys(resumo).length +
        ' coleções salvos.',
    )
    backupRecord.set('drive_status', 'solicitado')
    $app.save(backupRecord)

    console.log(
      '[CRON Drive] Backup semanal registrado com drive_status = "solicitado". Fila irá enviar.',
    )
  } catch (errCron) {
    console.error('[CRON] Erro crítico no backup semanal automático:', errCron)
  }
})

// -------------------------------------------------------------
// 4. ENDPOINT: LISTAR BACKUPS
// GET /backend/v1/backups
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      var backups = $app.findRecordsByFilter('backups_sistema', "id != ''", '-created', 100, 0)

      var result = backups.map((b) => ({
        id: b.id,
        nome_arquivo: b.getString('nome_arquivo'),
        tipo: b.getString('tipo'),
        origem: b.getString('origem') || 'manual',
        status: b.getString('status'),
        total_colecoes: b.getInt('total_colecoes'),
        total_registros: b.getInt('total_registros'),
        resumo_colecoes: b.get('resumo_colecoes'),
        detalhes_execucao: b.get('detalhes_execucao'),
        backup_duplicatas_incluido: b.getBool('backup_duplicatas_incluido'),
        observacoes: b.getString('observacoes'),
        created: b.getString('created'),
        drive_status: b.getString('drive_status') || 'pendente',
        drive_file_id: b.getString('drive_file_id') || '',
        drive_enviado_em: b.getString('drive_enviado_em') || '',
        drive_erro: b.getString('drive_erro') || '',
        drive_folder_id: b.getString('drive_folder_id') || '',
        drive_offset: b.getInt('drive_offset') || 0,
        drive_total_bytes: b.getInt('drive_total_bytes') || 0,
        drive_session_url: b.getString('drive_session_url') || '',
        drive_tentativas: b.getInt('drive_tentativas') || 0,
        drive_progresso_chunk: b.getInt('drive_progresso_chunk') || 0,
      }))

      return e.json(200, {
        success: true,
        backups: result,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao listar backups: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 5. ENDPOINT: EXECUTAR BACKUP MANUAL SOB DEMANDA
// POST /backend/v1/backups/executar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/backups/executar',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var colecoesParaDump = [
      'empresas',
      'empresa_membros',
      'users',
      'clientes',
      'fornecedores',
      'produtos',
      'plano_contas',
      'contas_pagar',
      'contas_receber',
      'bancos_contas',
      'movimentos_financeiros',
      'conciliacoes',
      'empresa_convites',
      'veiculos',
      'abastecimentos',
      'manutencoes',
      'centros_custos',
      'creditos_clientes',
      'funcionarios',
      'folha_horas_extras',
      'entregas',
      'vendas',
      'despesas_frota',
      'historico_alteracoes',
      'formas_recebimento',
      'cheques_predatados',
      'contadores_sequenciais',
    ]

    var backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    var dadosCol = $app.findCollectionByNameOrId('backups_dados')
    var timestampStr = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)

    var nativoStatus = 'tentado'
    var nativoArquivo = ''
    var nativoErro = ''
    var zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
    try {
      if (typeof $app.createBackup === 'function') {
        try {
          $app.createBackup(zipName)
          nativoStatus = 'sucesso'
          nativoArquivo = zipName
        } catch (e1) {
          nativoStatus = 'falha'
          nativoErro = String(e1?.message || e1)
        }
      } else {
        nativoStatus = 'nao_disponivel_jsvm'
        nativoErro = 'createBackup não exposto na JSVM do PocketBase'
      }
    } catch (eG) {
      nativoStatus = 'erro'
      nativoErro = String(eG?.message || eG)
    }

    var resumo = {}
    var totalRegistrosGeral = 0
    var colecoesComErro = 0

    var solicitanteNome =
      authRecord.getString('name') || authRecord.getString('email') || 'Administrador'

    var backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', 'backup_completo_erp_' + timestampStr + '.json')
    backupRecord.set('tipo', 'completo')
    backupRecord.set('origem', 'manual')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('drive_status', 'pendente')
    backupRecord.set('total_colecoes', colecoesParaDump.length)
    backupRecord.set('total_registros', 0)
    backupRecord.set('resumo_colecoes', {})
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      modo: 'dump_json_particionado',
      origem: 'manual',
      solicitado_por: solicitanteNome,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      status: 'processando',
    })
    backupRecord.set('backup_duplicatas_incluido', false)
    backupRecord.set('observacoes', 'Backup real sob demanda em andamento...')
    $app.save(backupRecord)

    for (var i = 0; i < colecoesParaDump.length; i++) {
      var colName = colecoesParaDump[i]
      try {
        var records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        var count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          var serialized = []
          for (var j = 0; j < count; j++) {
            var r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                var obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                var c = r.collection()
                if (c && c.fields) {
                  var fields = c.fields.all()
                  for (var f = 0; f < fields.length; f++) {
                    var fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          var CHUNK_SIZE = 200
          var totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (var ch = 0; ch < totalChunks; ch++) {
            var chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            var dadoRec = new Record(dadosCol)
            dadoRec.set('backup_id', backupRecord.id)
            dadoRec.set('colecao_nome', colName)
            dadoRec.set('chunk_index', ch)
            dadoRec.set('total_chunks', totalChunks)
            dadoRec.set('registros_count', chunkData.length)
            dadoRec.set('registros_json', chunkData)
            $app.save(dadoRec)
          }
        }
      } catch (errCol) {
        colecoesComErro++
        resumo[colName] = { erro: String(errCol?.message || errCol) }
        console.warn('[BACKUP] Falha ao extrair ' + colName + ':', errCol)
      }
    }

    var backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        var cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    var statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

    backupRecord.set('total_registros', totalRegistrosGeral)
    backupRecord.set('total_colecoes', Object.keys(resumo).length)
    backupRecord.set('resumo_colecoes', resumo)
    backupRecord.set('backup_duplicatas_incluido', backupDuplicatasIncluido)
    backupRecord.set('status', statusFinal)
    backupRecord.set('detalhes_execucao', {
      timestamp: new Date().toISOString(),
      versao_pocketbase: 'v0.36',
      origem: 'manual',
      solicitado_por: solicitanteNome,
      total_registros_geral: totalRegistrosGeral,
      colecoes_com_erro: colecoesComErro,
      nativo_zip_status: nativoStatus,
      nativo_zip_arquivo: nativoArquivo,
      nativo_zip_erro: nativoErro,
      colecoes_processadas: Object.keys(resumo),
    })
    backupRecord.set(
      'observacoes',
      'Backup real completo gerado sob demanda por ' +
        solicitanteNome +
        '. Todos os dados preservados com status "' +
        statusFinal +
        '".',
    )
    $app.save(backupRecord)

    return e.json(200, {
      success: true,
      backup: {
        id: backupRecord.id,
        nome_arquivo: backupRecord.getString('nome_arquivo'),
        tipo: backupRecord.getString('tipo'),
        origem: backupRecord.getString('origem') || 'manual',
        status: statusFinal,
        total_registros: totalRegistrosGeral,
        total_colecoes: Object.keys(resumo).length,
        resumo_colecoes: resumo,
        nativo_zip_status: nativoStatus,
        nativo_zip_arquivo: nativoArquivo,
        drive_status: 'pendente',
        created: backupRecord.getString('created'),
      },
    })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 6. ENDPOINT: STATUS DA CONFIGURAÇÃO DO BACKUP AUTOMÁTICO
// GET /backend/v1/backups/status-agendamento
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/status-agendamento',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var ultimoBackupAutomatico = null
    try {
      var autos = $app.findRecordsByFilter(
        'backups_sistema',
        "origem = 'semanal_automatico'",
        '-created',
        1,
        0,
      )
      if (autos && autos.length > 0) {
        var b = autos[0]
        ultimoBackupAutomatico = {
          id: b.id,
          nome_arquivo: b.getString('nome_arquivo'),
          status: b.getString('status'),
          origem: 'semanal_automatico',
          total_registros: b.getInt('total_registros'),
          total_colecoes: b.getInt('total_colecoes'),
          drive_status: b.getString('drive_status') || 'pendente',
          created: b.getString('created'),
        }
      }
    } catch (_) {}

    return e.json(200, {
      success: true,
      agendamento: {
        ativo: true,
        job_id: 'backup_semanal_pedreira_cordeiro',
        cron_expressao: '30 0 * * 0',
        horario_legivel: 'Todo domingo às 00:30 (horário do servidor)',
        frequencia: 'Semanal',
        descricao: 'Backup automático semanal cobrindo todas as 28 coleções do ERP',
        ultimo_backup_automatico: ultimoBackupAutomatico,
      },
    })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 7. ENDPOINT: EXPORTAR / BAIXAR DADOS CONSOLIDADOS EM JSON
// GET /backend/v1/backups/{id}/download
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/{id}/download',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    try {
      var backupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      var chunks = $app.findRecordsByFilter(
        'backups_dados',
        "backup_id = '" + backupId + "'",
        'colecao_nome,chunk_index',
        5000,
        0,
      )

      var colecoes = {}
      for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i]
        var col = ch.getString('colecao_nome')
        var items = ch.get('registros_json') || []
        if (!colecoes[col]) {
          colecoes[col] = []
        }
        if (Array.isArray(items)) {
          for (var k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      var payloadCompleto = {
        meta: {
          id: backupRec.id,
          nome_arquivo: backupRec.getString('nome_arquivo'),
          tipo: backupRec.getString('tipo'),
          origem: backupRec.getString('origem') || 'manual',
          total_colecoes: backupRec.getInt('total_colecoes'),
          total_registros: backupRec.getInt('total_registros'),
          resumo_colecoes: backupRec.get('resumo_colecoes'),
          detalhes_execucao: backupRec.get('detalhes_execucao'),
          drive_status: backupRec.getString('drive_status') || 'pendente',
          drive_file_id: backupRec.getString('drive_file_id') || '',
          drive_enviado_em: backupRec.getString('drive_enviado_em') || '',
          created: backupRec.getString('created'),
          exportado_em: new Date().toISOString(),
          sistema: 'Pedreira Cordeiro ERP (NovaGest)',
        },
        dados: colecoes,
      }

      return e.json(200, payloadCompleto)
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao consolidar download do backup: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 8. ENDPOINT: STATUS DA INTEGRAÇÃO COM CONTA DE SERVIÇO GOOGLE DRIVE
// GET /backend/v1/google-drive/status
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/google-drive/status',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      var serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      var folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      var folderName = 'Backups ERP'
      var clientEmail = ''
      var projectId = ''
      var ultimoEnvio = ''
      var dbStatus = ''
      var usuarioEmail = 'renilsonfmello@gmail.com'

      try {
        var configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
          clientEmail = configRec.getString('client_email')
          projectId = configRec.getString('project_id')
          ultimoEnvio = configRec.getString('ultimo_envio')
          dbStatus = configRec.getString('ultimo_status')
          if (configRec.getString('usuario_email')) {
            usuarioEmail = configRec.getString('usuario_email')
          }
        }
      } catch (_) {}
      if (serviceAccountJson && !clientEmail) {
        try {
          var parsed = JSON.parse(serviceAccountJson)
          clientEmail = parsed.client_email || ''
          projectId = parsed.project_id || ''
        } catch (_) {}
      }

      var oauthClientId = ''
      var oauthRefreshToken = ''
      var oauthStatus = ''
      if (configRec) {
        oauthClientId = configRec.getString('oauth_client_id') || ''
        oauthRefreshToken = configRec.getString('oauth_refresh_token') || ''
        oauthStatus = configRec.getString('oauth_status') || ''
      }

      var isOauthConectado = Boolean(oauthRefreshToken && oauthStatus === 'conectado')

      var isConfigured = Boolean(
        isOauthConectado || (serviceAccountJson && (clientEmail || serviceAccountJson.length > 50)),
      )

      var emailMascarado = ''
      if (clientEmail) {
        var parts = clientEmail.split('@')
        if (parts.length === 2) {
          var userPart = parts[0]
          var maskedUser =
            userPart.length > 6 ? userPart.slice(0, 4) + '...' + userPart.slice(-3) : userPart
          emailMascarado = maskedUser + '@' + parts[1]
        } else {
          emailMascarado = clientEmail
        }
      }

      return e.json(200, {
        success: true,
        drive: {
          tipo_autenticacao: isOauthConectado ? 'oauth' : 'service_account',
          configurado: isConfigured,
          conectado: isOauthConectado || isConfigured,
          chave_configurada: Boolean(serviceAccountJson && clientEmail),
          client_email: clientEmail,
          client_email_mascarado: emailMascarado,
          project_id: projectId,
          pasta_nome: folderName,
          pasta_id: folderId,
          usuario_email: usuarioEmail,
          ultimo_envio: ultimoEnvio,
          status_conexao: isOauthConectado
            ? 'conectado'
            : isConfigured
              ? 'conectado'
              : 'desconectado',
          oauth_status: oauthStatus,
          oauth_client_id: oauthClientId,
          oauth_conectado: isOauthConectado,
        },
      })
    } catch (err) {
      return e.json(500, {
        error:
          'Erro ao consultar status da Conta de Serviço Google Drive: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 9. ENDPOINT: SALVAR CREDENCIAIS DA CONTA DE SERVIÇO
// POST /backend/v1/google-drive/config
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/config',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var body = e.requestInfo().body || {}
    var serviceAccountJsonInput = (body.service_account_json || '').trim()
    var folderId = (body.folder_id || '').trim()
    var folderName = (body.folder_name || 'Backups ERP').trim()
    var usuarioEmailInput = (body.usuario_email || '').trim()

    if (folderId.indexOf('drive.google.com') !== -1) {
      var match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        folderId = match[1]
      }
    }

    try {
      var configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      } catch (_) {
        var configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }

      var parsedEmail = ''
      var parsedProjectId = ''
      var parsedPrivateKeyId = ''

      if (serviceAccountJsonInput) {
        var parsedCreds = null
        try {
          parsedCreds = JSON.parse(serviceAccountJsonInput)
        } catch (jsonErr) {
          return e.json(400, {
            error: 'Conteúdo colado não é um JSON válido: ' + (jsonErr?.message || jsonErr),
          })
        }

        if (!parsedCreds.client_email || !parsedCreds.private_key) {
          return e.json(400, {
            error:
              'O JSON colado é inválido ou incompleto (deve conter "client_email" e "private_key").',
          })
        }

        parsedEmail = parsedCreds.client_email
        parsedProjectId = parsedCreds.project_id || ''
        parsedPrivateKeyId = parsedCreds.private_key_id || ''

        configRec.set('service_account_json', serviceAccountJsonInput)
        configRec.set('client_email', parsedEmail)
        configRec.set('project_id', parsedProjectId)
        configRec.set('private_key_id', parsedPrivateKeyId)
        configRec.set('auth_type', 'service_account')
        configRec.set('ultimo_status', 'conectado')
      }

      if (folderId !== undefined) {
        configRec.set('folder_id', folderId)
      }
      if (folderName) {
        configRec.set('folder_name', folderName)
      }
      if (usuarioEmailInput) {
        configRec.set('usuario_email', usuarioEmailInput)
      } else if (!configRec.getString('usuario_email')) {
        configRec.set('usuario_email', 'renilsonfmello@gmail.com')
      }
      configRec.set('ativo', true)

      $app.save(configRec)

      return e.json(200, {
        success: true,
        message: 'Configurações da Conta de Serviço salvas com sucesso!',
        client_email: parsedEmail || configRec.getString('client_email'),
        folder_id: folderId !== undefined ? folderId : configRec.getString('folder_id'),
        usuario_email: configRec.getString('usuario_email'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao salvar configurações: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 10. ENDPOINT: REMOVER / DESCONECTAR CONTA DE SERVIÇO
// POST /backend/v1/google-drive/desconectar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/desconectar',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      var configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        configRec.set('service_account_json', '')
        configRec.set('client_email', '')
        configRec.set('project_id', '')
        configRec.set('private_key_id', '')
        configRec.set('refresh_token', '')
        configRec.set('account_email', '')
        configRec.set('account_name', '')
        configRec.set('ultimo_status', 'desconectado')
        $app.save(configRec)
      }

      return e.json(200, {
        success: true,
        message: 'Configuração da Conta de Serviço do Google Drive removida com sucesso',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao desconectar: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 10.1. ROTAS OAUTH 2.0 (GMAIL DO USUÁRIO)
// GET  /backend/v1/google-drive/drive-oauth-start (ou /oauth-start)
// GET  /backend/v1/google-drive/oauth-callback
// POST /backend/v1/google-drive/oauth-config
// POST /backend/v1/google-drive/oauth-desconectar
// -------------------------------------------------------------

// Suporta tanto /drive-oauth-start quanto /oauth-start
routerAdd(
  'GET',
  '/backend/v1/google-drive/drive-oauth-start',
  (e) => {
    var allowedOrigins = [
      'https://erp-empresarial-completo-575bb.goskip.app',
      'https://erp-empresarial-completo-575bb--preview.goskip.app',
    ]
    var callbackPath = '/backend/v1/google-drive/oauth-callback'

    function resolverRedirect(candidateUri, fallbackPref) {
      var raw = (candidateUri || '').trim()
      if (raw) {
        for (var i = 0; i < allowedOrigins.length; i++) {
          if (raw === allowedOrigins[i] + callbackPath) return raw
        }
        for (var j = 0; j < allowedOrigins.length; j++) {
          if (raw.replace(/\/+$/, '') === allowedOrigins[j]) return allowedOrigins[j] + callbackPath
        }
      }
      if (fallbackPref) {
        var cleanPref = fallbackPref.replace(/\/+$/, '')
        for (var k = 0; k < allowedOrigins.length; k++) {
          if (cleanPref === allowedOrigins[k]) return cleanPref + callbackPath
        }
      }
      return allowedOrigins[0] + callbackPath
    }

    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var clientId = ''
    var configRec = null
    try {
      configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        clientId = configRec.getString('oauth_client_id') || configRec.getString('client_id') || ''
      }
    } catch (_) {}

    if (!clientId) {
      return e.json(400, {
        error:
          'Client ID do OAuth não configurado. Por favor, cadastre o Client ID e Client Secret antes de conectar.',
      })
    }

    var candidateUri = ''
    try {
      if (e && e.request && e.request.url && e.request.url.query) {
        var q = e.request.url.query()
        candidateUri = q.get('redirect_uri') || q.get('redirect') || ''
      }
    } catch (_) {}

    var refererOrigin = ''
    try {
      if (e && e.request && e.request.header) {
        var ref = e.request.header.get('referer') || e.request.header.get('origin') || ''
        if (ref.indexOf('--preview.goskip.app') !== -1) {
          refererOrigin = 'https://erp-empresarial-completo-575bb--preview.goskip.app'
        } else if (ref.indexOf('.goskip.app') !== -1) {
          refererOrigin = 'https://erp-empresarial-completo-575bb.goskip.app'
        }
      }
    } catch (_) {}

    if (candidateUri) {
      var rawTrim = candidateUri.trim()
      var bateuAllowlist = false
      for (var a = 0; a < allowedOrigins.length; a++) {
        var uExata = allowedOrigins[a] + callbackPath
        if (rawTrim === uExata || rawTrim.replace(/\/+$/, '') === allowedOrigins[a]) {
          bateuAllowlist = true
          break
        }
      }
      if (!bateuAllowlist) {
        return e.json(400, {
          error: 'redirect_uri não permitido. Domínios aceitos: ' + allowedOrigins.join(', '),
        })
      }
    }

    var redirectUri = resolverRedirect(candidateUri, refererOrigin)

    try {
      if (!configRec) {
        var configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }
      var rawDet = configRec.get('detalhes')
      var det = {}
      try {
        det =
          typeof rawDet === 'string' ? JSON.parse(rawDet) : JSON.parse(JSON.stringify(rawDet || {}))
      } catch (_) {
        det = {}
      }
      det.oauth_last_redirect_uri = redirectUri
      det.oauth_last_start_at = new Date().toISOString()
      configRec.set('detalhes', det)
      $app.save(configRec)
    } catch (eSaveRedirect) {
      console.warn('[OAUTH_START] Aviso ao persistir redirect_uri:', eSaveRedirect)
    }

    var scope = 'https://www.googleapis.com/auth/drive.file'

    var consentUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id=' +
      encodeURIComponent(clientId) +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&response_type=code' +
      '&scope=' +
      encodeURIComponent(scope) +
      '&access_type=offline' +
      '&prompt=consent'

    console.log('[OAUTH_START] Consent URL gerada com redirect_uri: ' + redirectUri)

    return e.json(200, {
      success: true,
      url: consentUrl,
      auth_url: consentUrl,
      redirect_uri: redirectUri,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/google-drive/oauth-start',
  (e) => {
    var allowedOrigins = [
      'https://erp-empresarial-completo-575bb.goskip.app',
      'https://erp-empresarial-completo-575bb--preview.goskip.app',
    ]
    var callbackPath = '/backend/v1/google-drive/oauth-callback'

    function resolverRedirect(candidateUri, fallbackPref) {
      var raw = (candidateUri || '').trim()
      if (raw) {
        for (var i = 0; i < allowedOrigins.length; i++) {
          if (raw === allowedOrigins[i] + callbackPath) return raw
        }
        for (var j = 0; j < allowedOrigins.length; j++) {
          if (raw.replace(/\/+$/, '') === allowedOrigins[j]) return allowedOrigins[j] + callbackPath
        }
      }
      if (fallbackPref) {
        var cleanPref = fallbackPref.replace(/\/+$/, '')
        for (var k = 0; k < allowedOrigins.length; k++) {
          if (cleanPref === allowedOrigins[k]) return cleanPref + callbackPath
        }
      }
      return allowedOrigins[0] + callbackPath
    }

    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var clientId = ''
    var configRec = null
    try {
      configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        clientId = configRec.getString('oauth_client_id') || configRec.getString('client_id') || ''
      }
    } catch (_) {}

    if (!clientId) {
      return e.json(400, {
        error:
          'Client ID do OAuth não configurado. Por favor, cadastre o Client ID e Client Secret antes de conectar.',
      })
    }

    var candidateUri = ''
    try {
      if (e && e.request && e.request.url && e.request.url.query) {
        var q = e.request.url.query()
        candidateUri = q.get('redirect_uri') || q.get('redirect') || ''
      }
    } catch (_) {}

    var refererOrigin = ''
    try {
      if (e && e.request && e.request.header) {
        var ref = e.request.header.get('referer') || e.request.header.get('origin') || ''
        if (ref.indexOf('--preview.goskip.app') !== -1) {
          refererOrigin = 'https://erp-empresarial-completo-575bb--preview.goskip.app'
        } else if (ref.indexOf('.goskip.app') !== -1) {
          refererOrigin = 'https://erp-empresarial-completo-575bb.goskip.app'
        }
      }
    } catch (_) {}

    if (candidateUri) {
      var rawTrim = candidateUri.trim()
      var bateuAllowlist = false
      for (var a = 0; a < allowedOrigins.length; a++) {
        var uExata = allowedOrigins[a] + callbackPath
        if (rawTrim === uExata || rawTrim.replace(/\/+$/, '') === allowedOrigins[a]) {
          bateuAllowlist = true
          break
        }
      }
      if (!bateuAllowlist) {
        return e.json(400, {
          error: 'redirect_uri não permitido. Domínios aceitos: ' + allowedOrigins.join(', '),
        })
      }
    }

    var redirectUri = resolverRedirect(candidateUri, refererOrigin)

    try {
      if (!configRec) {
        var configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }
      var rawDet = configRec.get('detalhes')
      var det = {}
      try {
        det =
          typeof rawDet === 'string' ? JSON.parse(rawDet) : JSON.parse(JSON.stringify(rawDet || {}))
      } catch (_) {
        det = {}
      }
      det.oauth_last_redirect_uri = redirectUri
      det.oauth_last_start_at = new Date().toISOString()
      configRec.set('detalhes', det)
      $app.save(configRec)
    } catch (eSaveRedirect) {
      console.warn('[OAUTH_START] Aviso ao persistir redirect_uri:', eSaveRedirect)
    }

    var scope = 'https://www.googleapis.com/auth/drive.file'

    var consentUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id=' +
      encodeURIComponent(clientId) +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&response_type=code' +
      '&scope=' +
      encodeURIComponent(scope) +
      '&access_type=offline' +
      '&prompt=consent'

    console.log('[OAUTH_START] Consent URL gerada com redirect_uri: ' + redirectUri)

    return e.json(200, {
      success: true,
      url: consentUrl,
      auth_url: consentUrl,
      redirect_uri: redirectUri,
    })
  },
  $apis.requireAuth(),
)

// POST /backend/v1/google-drive/oauth-config
routerAdd(
  'POST',
  '/backend/v1/google-drive/oauth-config',
  (e) => {
    var allowedOrigins = [
      'https://erp-empresarial-completo-575bb.goskip.app',
      'https://erp-empresarial-completo-575bb--preview.goskip.app',
    ]
    var callbackPath = '/backend/v1/google-drive/oauth-callback'

    function resolverRedirect(candidateUri, fallbackPref) {
      var raw = (candidateUri || '').trim()
      if (raw) {
        for (var i = 0; i < allowedOrigins.length; i++) {
          if (raw === allowedOrigins[i] + callbackPath) return raw
        }
        for (var j = 0; j < allowedOrigins.length; j++) {
          if (raw.replace(/\/+$/, '') === allowedOrigins[j]) return allowedOrigins[j] + callbackPath
        }
      }
      if (fallbackPref) {
        var cleanPref = fallbackPref.replace(/\/+$/, '')
        for (var k = 0; k < allowedOrigins.length; k++) {
          if (cleanPref === allowedOrigins[k]) return cleanPref + callbackPath
        }
      }
      return allowedOrigins[0] + callbackPath
    }

    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var body = e.requestInfo().body || {}
    var clientId = (body.client_id || body.oauth_client_id || '').trim()
    var clientSecret = (body.client_secret || body.oauth_client_secret || '').trim()
    var candidateRedirect = (body.redirect_uri || '').trim()

    if (!clientId) {
      return e.json(400, { error: 'Client ID é obrigatório' })
    }
    if (!clientSecret) {
      return e.json(400, { error: 'Client Secret é obrigatório' })
    }

    try {
      var configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      } catch (_) {
        var configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }

      var refererOrigin = ''
      try {
        if (e && e.request && e.request.header) {
          var ref = e.request.header.get('referer') || e.request.header.get('origin') || ''
          if (ref.indexOf('--preview.goskip.app') !== -1) {
            refererOrigin = 'https://erp-empresarial-completo-575bb--preview.goskip.app'
          } else if (ref.indexOf('.goskip.app') !== -1) {
            refererOrigin = 'https://erp-empresarial-completo-575bb.goskip.app'
          }
        }
      } catch (_) {}

      var redirectUri = resolverRedirect(candidateRedirect, refererOrigin)

      configRec.set('oauth_client_id', clientId)
      configRec.set('oauth_client_secret', clientSecret)
      configRec.set('client_id', clientId)
      configRec.set('client_secret', clientSecret)
      configRec.set('ativo', true)

      var rawDet = configRec.get('detalhes')
      var det = {}
      try {
        det =
          typeof rawDet === 'string' ? JSON.parse(rawDet) : JSON.parse(JSON.stringify(rawDet || {}))
      } catch (_) {
        det = {}
      }
      det.oauth_last_redirect_uri = redirectUri
      configRec.set('detalhes', det)

      $app.save(configRec)

      return e.json(200, {
        success: true,
        message: 'Credenciais OAuth salvas com sucesso!',
        client_id: clientId,
        redirect_uri: redirectUri,
      })
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao salvar configurações OAuth: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// GET /backend/v1/google-drive/oauth-callback
routerAdd('GET', '/backend/v1/google-drive/oauth-callback', (e) => {
  var allowedOrigins = [
    'https://erp-empresarial-completo-575bb.goskip.app',
    'https://erp-empresarial-completo-575bb--preview.goskip.app',
  ]
  var callbackPath = '/backend/v1/google-drive/oauth-callback'

  function resolverRedirect(candidateUri, fallbackPref) {
    var raw = (candidateUri || '').trim()
    if (raw) {
      for (var i = 0; i < allowedOrigins.length; i++) {
        if (raw === allowedOrigins[i] + callbackPath) return raw
      }
      for (var j = 0; j < allowedOrigins.length; j++) {
        if (raw.replace(/\/+$/, '') === allowedOrigins[j]) return allowedOrigins[j] + callbackPath
      }
    }
    if (fallbackPref) {
      var cleanPref = fallbackPref.replace(/\/+$/, '')
      for (var k = 0; k < allowedOrigins.length; k++) {
        if (cleanPref === allowedOrigins[k]) return cleanPref + callbackPath
      }
    }
    return allowedOrigins[0] + callbackPath
  }

  var code = ''
  try {
    code = e.request.url.query().get('code') || ''
  } catch (_) {}

  var errorQuery = ''
  try {
    errorQuery = e.request.url.query().get('error') || ''
  } catch (_) {}

  function renderHtml(titulo, mensagem, isSucesso, detalhes) {
    var cor = isSucesso ? '#10b981' : '#ef4444'
    var icone = isSucesso ? '✓' : '✗'
    var html =
      '<!DOCTYPE html>' +
      '<html lang="pt-BR">' +
      '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' +
      titulo +
      '</title>' +
      '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }' +
      '.card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }' +
      '.icon { width: 56px; height: 56px; border-radius: 50%; background: ' +
      cor +
      '20; color: ' +
      cor +
      '; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; margin-bottom: 20px; }' +
      'h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px 0; color: #ffffff; }' +
      'p { font-size: 14px; line-height: 1.5; color: #94a3b8; margin: 0 0 24px 0; }' +
      '.detalhe { font-size: 12px; font-family: monospace; background: #0f172a; padding: 10px; border-radius: 6px; color: #fca5a5; word-break: break-all; margin-bottom: 20px; }' +
      '.btn { display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }' +
      '.btn:hover { background: #1d4ed8; }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<div class="card">' +
      '<div class="icon">' +
      icone +
      '</div>' +
      '<h1>' +
      titulo +
      '</h1>' +
      '<p>' +
      mensagem +
      '</p>' +
      (detalhes ? '<div class="detalhe">' + detalhes + '</div>' : '') +
      '<button class="btn" onclick="window.close(); if(!window.closed){ window.location.href=\'/\'; }">Fechar Janela</button>' +
      '<script>' +
      'try { if (window.opener) { window.opener.postMessage({ type: "GOOGLE_DRIVE_OAUTH_SUCCESS" }, "*"); } } catch(e){} ' +
      'setTimeout(function(){ try { window.close(); } catch(e){} }, 4000);' +
      '</script>' +
      '</div>' +
      '</body>' +
      '</html>'
    return e.html(isSucesso ? 200 : 400, html)
  }

  if (errorQuery) {
    return renderHtml(
      'Autorização Cancelada',
      'O Google retornou um erro ou você cancelou o consentimento.',
      false,
      'Erro retornado: ' + errorQuery,
    )
  }

  if (!code) {
    return renderHtml(
      'Código de Autorização Ausente',
      'Nenhum código retornado pelo Google. Tente iniciar a conexão novamente no ERP.',
      false,
      'Parâmetro code vazio.',
    )
  }

  var configRec = null
  try {
    configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
  } catch (_) {}

  var clientId = configRec ? configRec.getString('oauth_client_id') : ''
  var clientSecret = configRec ? configRec.getString('oauth_client_secret') : ''

  if (!clientId || !clientSecret) {
    return renderHtml(
      'Configuração Ausente',
      'Client ID ou Client Secret não foram localizados na configuração do ERP.',
      false,
      'Configure o Client ID e Secret antes de autorizar.',
    )
  }

  // Obter o redirect_uri exato que foi usado no consentimento
  var redirectUri = ''
  if (configRec) {
    var rawDet = configRec.get('detalhes')
    try {
      var det =
        typeof rawDet === 'string' ? JSON.parse(rawDet) : JSON.parse(JSON.stringify(rawDet || {}))
      if (det && det.oauth_last_redirect_uri) {
        redirectUri = resolverRedirect(det.oauth_last_redirect_uri)
      }
    } catch (_) {}
  }

  // Se não estava persistido, tenta identificar a partir do host/headers da requisição validando na allowlist
  if (!redirectUri) {
    var reqHost = ''
    try {
      if (e && e.request) {
        reqHost = e.request.header.get('x-forwarded-host') || e.request.header.get('host') || ''
      }
    } catch (_) {}
    var preferredOrigin = ''
    if (reqHost.indexOf('--preview.goskip.app') !== -1) {
      preferredOrigin = 'https://erp-empresarial-completo-575bb--preview.goskip.app'
    }
    redirectUri = resolverRedirect('', preferredOrigin)
  }

  console.log('[OAUTH_CALLBACK] Trocando code por token usando redirect_uri: ' + redirectUri)

  try {
    var tokenBody =
      'code=' +
      encodeURIComponent(code) +
      '&client_id=' +
      encodeURIComponent(clientId) +
      '&client_secret=' +
      encodeURIComponent(clientSecret) +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&grant_type=authorization_code'

    var tokenRes = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
      timeout: 25,
    })

    if (tokenRes.statusCode !== 200) {
      console.error(
        '[OAUTH_CALLBACK] Falha na troca do code por token: HTTP ' +
          tokenRes.statusCode +
          ': ' +
          (tokenRes.raw || ''),
      )
      return renderHtml(
        'Falha na Troca de Credenciais',
        'O Google recusou a troca do código de autorização.',
        false,
        'HTTP ' + tokenRes.statusCode + ': ' + (tokenRes.raw || '').slice(0, 300),
      )
    }

    var tokenData = tokenRes.json || JSON.parse(tokenRes.raw || '{}')
    var refreshToken = tokenData.refresh_token || ''
    var accessToken = tokenData.access_token || ''
    var expiresIn = tokenData.expires_in || 3600

    if (!refreshToken && configRec.getString('oauth_refresh_token')) {
      // O Google não reenvia refresh_token se o usuário já havia consentido antes
      refreshToken = configRec.getString('oauth_refresh_token')
    }

    if (!refreshToken) {
      return renderHtml(
        'Aviso de Refresh Token',
        'Conta autenticada, mas o Google não devolveu um novo Refresh Token. Vá nas permissões de sua Conta Google, revogue o acesso ao aplicativo e conecte novamente com prompt=consent.',
        false,
        'refresh_token ausente na resposta do Google OAuth',
      )
    }

    configRec.set('oauth_refresh_token', refreshToken)
    configRec.set('oauth_status', 'conectado')
    configRec.set('auth_type', 'oauth')
    configRec.set('ultimo_status', 'conectado')
    try {
      var rawD = configRec.get('detalhes')
      var parsedD = {}
      try {
        parsedD =
          typeof rawD === 'string' ? JSON.parse(rawD) : JSON.parse(JSON.stringify(rawD || {}))
      } catch (_) {
        parsedD = {}
      }
      if (typeof parsedD !== 'object' || parsedD === null || Array.isArray(parsedD)) {
        parsedD = {}
      }
      delete parsedD.cached_token
      delete parsedD.cached_expiry_ms
      configRec.set('detalhes', parsedD)
    } catch (_) {}
    $app.save(configRec)

    // Atualiza cache persistente imediatamente
    if (accessToken) {
      var expiryMsCalculado = Date.now() + expiresIn * 1000
      try {
        var cRec = null
        try {
          cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
        } catch (_) {
          var cacheTokensCol = $app.findCollectionByNameOrId('cache_tokens_drive')
          cRec = new Record(cacheTokensCol)
          cRec.set('chave', 'google_drive_oauth')
        }
        cRec.set('access_token', accessToken)
        cRec.set('expiry_ms', expiryMsCalculado)
        cRec.set('client_email', 'oauth_user')
        cRec.set('detalhes', {
          cached_token: accessToken,
          cached_expiry_ms: expiryMsCalculado,
          cached_created_at: new Date().toISOString(),
          tipo: 'oauth',
        })
        $app.save(cRec)
      } catch (eCache) {
        console.warn('[OAUTH_CALLBACK] Aviso ao gravar cache token:', eCache)
      }
    }

    // Resetar backup jpc5w1b0o13nvim (e qualquer backup recente travado em erro) para a fila pegar de imediato com o novo OAuth
    try {
      $app
        .db()
        .newQuery(
          "UPDATE backups_sistema SET drive_status = 'solicitado', drive_tentativas = 0, drive_offset = 0, drive_session_url = '', drive_erro = '' WHERE id = 'jpc5w1b0o13nvim' OR (drive_status = 'erro' AND drive_erro LIKE '%quota%')",
        )
        .execute()
      console.log(
        '[OAUTH_CALLBACK] Backup jpc5w1b0o13nvim recolocado em solicitado com sucesso após conexão OAuth!',
      )
    } catch (_) {}

    return renderHtml(
      'Conta Google Conectada com Sucesso!',
      'Sua conta Gmail foi vinculada com sucesso ao ERP Pedreira Cordeiro. Os backups automáticos agora serão gravados diretamente no seu Google Drive com cota total.',
      true,
      '',
    )
  } catch (errToken) {
    console.error('[OAUTH_CALLBACK] Exceção na troca de token:', errToken)
    return renderHtml(
      'Erro Inesperado na Conexão',
      'Ocorreu uma exceção ao processar a resposta do Google.',
      false,
      String(errToken?.message || errToken),
    )
  }
})

// POST /backend/v1/google-drive/oauth-desconectar
routerAdd(
  'POST',
  '/backend/v1/google-drive/oauth-desconectar',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      var configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (configRec) {
        configRec.set('oauth_refresh_token', '')
        configRec.set('oauth_status', '')
        if (configRec.getString('auth_type') === 'oauth') {
          configRec.set('auth_type', 'none')
        }
        $app.save(configRec)
      }

      // Limpar cache de token oauth
      try {
        var cRec = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_oauth')
        if (cRec) {
          cRec.set('access_token', '')
          cRec.set('expiry_ms', 0)
          cRec.set('detalhes', {})
          $app.save(cRec)
        }
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Conta Google (OAuth) desconectada com sucesso!',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao desconectar OAuth: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 11. ENDPOINT: ENVIAR MANUALMENTE UM BACKUP ESPECÍFICO AO GOOGLE DRIVE VIA CONTA DE SERVIÇO
// OPTIONS & POST /backend/v1/backups/{id}/enviar-drive
// -------------------------------------------------------------
routerAdd('OPTIONS', '/backend/v1/backups/{id}/enviar-drive', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response.header().set('Access-Control-Allow-Headers', 'Authorization, Content-Type, *')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/backups/{id}/enviar-drive',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'Authorization, Content-Type, *')
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    var backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    var backupRecord = null
    try {
      backupRecord = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
    } catch (eBkp) {
      return e.json(404, { error: 'Backup não encontrado: ' + backupId })
    }

    // Delega com segurança para a fila incremental resumível sem travar a requisição web
    backupRecord.set('drive_status', 'solicitado')
    backupRecord.set('drive_tentativas', 0)
    backupRecord.set(
      'drive_erro',
      'Fila de envio iniciada. O processador em segundo plano enviará chunks de 256KB.',
    )
    $app.save(backupRecord)

    // Se solicitado reenvio manual após erro/401, limpa cache do token para garantir novo handshake limpo
    try {
      var cReset = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
      if (cReset) {
        cReset.set('access_token', '')
        cReset.set('expiry_ms', 0)
        cReset.set('detalhes', {})
        $app.save(cReset)
      }
    } catch (_) {}
    try {
      var cOAuthReset = $app.findFirstRecordByData(
        'cache_tokens_drive',
        'chave',
        'google_drive_oauth',
      )
      if (cOAuthReset) {
        cOAuthReset.set('access_token', '')
        cOAuthReset.set('expiry_ms', 0)
        cOAuthReset.set('detalhes', {})
        $app.save(cOAuthReset)
      }
    } catch (_) {}
    try {
      var cfgReset = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      if (cfgReset) {
        var rawDReset = cfgReset.get('detalhes')
        var dReset = {}
        try {
          dReset =
            typeof rawDReset === 'string'
              ? JSON.parse(rawDReset)
              : JSON.parse(JSON.stringify(rawDReset || {}))
        } catch (_) {
          dReset = {}
        }
        delete dReset.cached_token
        delete dReset.cached_expiry_ms
        cfgReset.set('detalhes', dReset)
        $app.save(cfgReset)
      }
    } catch (_) {}
    return e.json(200, {
      success: true,
      message:
        'Backup colocado na fila de envio incremental ao Google Drive. As fatias resumíveis serão processadas a cada minuto.',
      delegado_fila: true,
      backup_id: backupId,
    })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 12. TRIGGER REATIVO: onRecordUpdate em backups_sistema
// Notifica quando backup é marcado como 'solicitado'
// -------------------------------------------------------------
onRecordUpdate((e) => {
  e.next()

  var rec = e.record
  if (!rec) return

  var statusAtual = rec.getString('drive_status')
  if (statusAtual !== 'solicitado') return

  var backupId = rec.id
  console.log(
    '[TRIGGER_UPDATE][' +
      backupId +
      "] Backup marcado como 'solicitado'. Fila incremental processará no próximo minuto.",
  )
}, 'backups_sistema')

// =============================================================
// 13. RESTAURAÇÃO LOCAL DE BACKUP (VALIDAÇÃO E EXECUÇÃO EM LOTES)
// =============================================================

// 13.1. ENDPOINT: VALIDAR E RESUMIR ARQUIVO DE BACKUP LOCAL
// POST /backend/v1/backups/restaurar/validar
routerAdd(
  'POST',
  '/backend/v1/backups/restaurar/validar',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Checar admin inline
    var isAdmin = false
    try {
      var adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        "usuario_id = '" + authRecord.id + "' && role = 'admin'",
        '',
        1,
        0,
      )
      isAdmin = Boolean(adminMembros && adminMembros.length > 0)
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, {
        error: 'Apenas administradores têm permissão para validar e restaurar backups do sistema.',
      })
    }

    var colecoesProtegidas = [
      'backups_sistema',
      'backups_dados',
      'config_google_drive',
      'cache_tokens_drive',
      '_superusers',
      '_pb_users_auth_',
      '_collections',
      '_params',
    ]

    var body = e.requestInfo().body || {}
    // Suporte a dois modos:
    // 1) Modo Leve (recomendado): { colecoes_resumo: { clientes: 2354, ... }, meta: {...}, amostras: { clientes: [...] } }
    // 2) Modo Legado: { dump: { meta, dados } } ou { dump: { ... } }
    var colecoesContagens = {}
    var amostrasRecebidas = body.amostras || {}
    var meta = body.meta || {}
    var nomeArquivoOrigem = body.nome_arquivo_origem || meta.nome_arquivo || 'backup_importado.json'

    if (body.colecoes_resumo && typeof body.colecoes_resumo === 'object') {
      colecoesContagens = body.colecoes_resumo
    } else {
      var dump = body.dump || body
      var dumpMeta = dump.meta || {}
      if (!meta.criado_em && dumpMeta.created) meta.criado_em = dumpMeta.created
      if (!meta.criado_em && dumpMeta.exportado_em) meta.criado_em = dumpMeta.exportado_em
      if (!meta.sistema_origem && dumpMeta.sistema) meta.sistema_origem = dumpMeta.sistema
      if (dumpMeta.nome_arquivo && !body.nome_arquivo_origem)
        nomeArquivoOrigem = dumpMeta.nome_arquivo

      var dados = dump.dados || dump
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return e.json(400, {
          error:
            'Formato de arquivo inválido. O arquivo JSON deve conter a chave "dados" ou um mapeamento de coleções.',
        })
      }

      var dumpKeys = Object.keys(dados)
      for (var dk = 0; dk < dumpKeys.length; dk++) {
        var kName = dumpKeys[dk]
        if (kName === 'meta' || kName === 'dados') continue
        var items = dados[kName]
        if (Array.isArray(items)) {
          colecoesContagens[kName] = items.length
          if (items.length > 0 && !amostrasRecebidas[kName]) {
            amostrasRecebidas[kName] = items.slice(0, Math.min(items.length, 30))
          }
        }
      }
    }

    var colecoesEncontradas = {}
    var colecoesIgnoradas = []
    var totalRegistros = 0

    // Analisar todas as coleções encontradas
    var chaves = Object.keys(colecoesContagens)
    for (var i = 0; i < chaves.length; i++) {
      var colName = chaves[i]

      if (colName === 'meta' || colName === 'dados') continue

      if (colecoesProtegidas.indexOf(colName) !== -1) {
        colecoesIgnoradas.push(colName)
        continue
      }

      var qtd = Number(colecoesContagens[colName]) || 0
      var colValidaNoBanco = false
      try {
        var colObj = $app.findCollectionByNameOrId(colName)
        if (colObj) colValidaNoBanco = true
      } catch (_) {
        colValidaNoBanco = false
      }

      totalRegistros += qtd

      // Amostragem para verificar quantos IDs já existem no banco (conflitos/sobrescrita)
      var existentesContagem = 0
      var amostraItems = amostrasRecebidas[colName]
      if (colValidaNoBanco && Array.isArray(amostraItems) && amostraItems.length > 0) {
        for (var a = 0; a < amostraItems.length; a++) {
          var itemA = amostraItems[a]
          var idTestar = typeof itemA === 'string' ? itemA : itemA && itemA.id ? itemA.id : ''
          if (idTestar) {
            try {
              var recExistente = $app.findFirstRecordByData(colName, 'id', idTestar)
              if (recExistente) existentesContagem++
            } catch (_) {}
          }
        }
      }

      colecoesEncontradas[colName] = {
        total_registros: qtd,
        existe_no_banco: colValidaNoBanco,
        conflitos_amostra: existentesContagem,
        amostra_tamanho: Array.isArray(amostraItems) ? amostraItems.length : 0,
      }
    }

    var totalColecoes = Object.keys(colecoesEncontradas).length
    if (totalColecoes === 0) {
      return e.json(400, {
        error: 'Nenhuma coleção de dados reconhecida foi encontrada no arquivo JSON enviado.',
      })
    }

    return e.json(200, {
      success: true,
      valido: true,
      meta: {
        nome_arquivo: nomeArquivoOrigem,
        criado_em: meta.criado_em || meta.created || meta.exportado_em || null,
        sistema_origem: meta.sistema_origem || meta.sistema || 'ERP NovaGest',
        origem: meta.origem || 'local',
        total_colecoes_arquivo: totalColecoes,
        total_registros_arquivo: totalRegistros,
      },
      colecoes: colecoesEncontradas,
      colecoes_ignoradas: colecoesIgnoradas,
      aviso_seguranca:
        'A restauração atualizará os registros existentes com os mesmos IDs e criará os que não existirem. Campos de auditoria e relacionamentos são preservados.',
    })
  },
  $apis.requireAuth(),
)

// 13.2. ENDPOINT: EXECUTAR RESTAURAÇÃO DE UM LOTE (CHUNK) DE UMA COLEÇÃO
// POST /backend/v1/backups/restaurar/lote
routerAdd(
  'POST',
  '/backend/v1/backups/restaurar/lote',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Checar admin inline
    var isAdmin = false
    try {
      var adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        "usuario_id = '" + authRecord.id + "' && role = 'admin'",
        '',
        1,
        0,
      )
      isAdmin = Boolean(adminMembros && adminMembros.length > 0)
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, {
        error: 'Apenas administradores têm permissão para restaurar backups do sistema.',
      })
    }

    var colecoesProtegidas = [
      'backups_sistema',
      'backups_dados',
      'config_google_drive',
      'cache_tokens_drive',
      '_superusers',
      '_pb_users_auth_',
      '_collections',
      '_params',
    ]

    var body = e.requestInfo().body || {}
    var colecaoNome = (body.colecao || '').trim()
    var registros = body.registros || []

    if (!colecaoNome) {
      return e.json(400, { error: 'Nome da coleção não informado' })
    }

    if (colecoesProtegidas.indexOf(colecaoNome) !== -1) {
      return e.json(400, {
        error: 'A coleção "' + colecaoNome + '" é protegida e não pode ser restaurada via dump.',
      })
    }

    if (!Array.isArray(registros) || registros.length === 0) {
      return e.json(200, {
        success: true,
        colecao: colecaoNome,
        processados: 0,
        criados: 0,
        atualizados: 0,
        erros: 0,
        detalhes_erros: [],
      })
    }

    // Limite de segurança por lote: max 250 registros por requisição para não estourar JSVM
    if (registros.length > 250) {
      return e.json(400, {
        error: 'Lote muito grande. Envie no máximo 250 registros por requisição.',
      })
    }

    var col = null
    try {
      col = $app.findCollectionByNameOrId(colecaoNome)
    } catch (_) {
      return e.json(404, {
        error: 'A coleção "' + colecaoNome + '" não existe neste banco de dados.',
      })
    }

    // Campos válidos da coleção destino
    var camposValidos = {}
    if (col && col.fields) {
      var allFields = col.fields.all()
      for (var f = 0; f < allFields.length; f++) {
        var fld = allFields[f]
        camposValidos[fld.name] = {
          name: fld.name,
          type: fld.type,
          required: Boolean(fld.required),
        }
      }
    }

    var criados = 0
    var atualizados = 0
    var erros = 0
    var detalhesErros = []

    for (var rIdx = 0; rIdx < registros.length; rIdx++) {
      var item = registros[rIdx]
      if (!item || typeof item !== 'object') {
        erros++
        detalhesErros.push({ indice: rIdx, erro: 'Registro nulo ou formato inválido' })
        continue
      }

      var recordId = item.id || ''

      try {
        var rec = null
        var isNovo = false

        if (recordId) {
          try {
            rec = $app.findFirstRecordByData(colecaoNome, 'id', recordId)
          } catch (_) {
            rec = null
          }
        }

        // Resolução defensiva de conflito por chave única para coleções com índice UNIQUE
        if (!rec) {
          if (colecaoNome === 'empresas' && item.cnpj) {
            try {
              rec = $app.findFirstRecordByData('empresas', 'cnpj', item.cnpj)
            } catch (_) {
              rec = null
            }
          } else if (colecaoNome === 'produtos' && item.codigo && item.empresa_id) {
            try {
              var recsProd = $app.findRecordsByFilter(
                'produtos',
                "empresa_id = '" + item.empresa_id + "' && codigo = '" + item.codigo + "'",
                '',
                1,
                0,
              )
              if (recsProd && recsProd.length > 0) rec = recsProd[0]
            } catch (_) {
              rec = null
            }
          } else if (colecaoNome === 'centros_custos' && item.codigo && item.empresa_id) {
            try {
              var recsCC = $app.findRecordsByFilter(
                'centros_custos',
                "empresa_id = '" + item.empresa_id + "' && codigo = '" + item.codigo + "'",
                '',
                1,
                0,
              )
              if (recsCC && recsCC.length > 0) rec = recsCC[0]
            } catch (_) {
              rec = null
            }
          }
        }

        if (!rec) {
          isNovo = true
          rec = new Record(col)
          if (recordId) {
            rec.setId(recordId)
          }
        }

        // Preencher os campos presentes no item que existem na coleção
        var itemKeys = Object.keys(item)
        for (var k = 0; k < itemKeys.length; k++) {
          var kName = itemKeys[k]

          // Preservar id se já setado
          if (kName === 'id') continue

          // Preservar created e updated quando presentes no dump
          if (kName === 'created' || kName === 'updated') {
            try {
              if (item[kName]) {
                rec.set(kName, item[kName])
              }
            } catch (_) {}
            continue
          }

          // Ignorar campos de sistema internos do PocketBase que não são colunas reais
          if (kName === 'collectionId' || kName === 'collectionName' || kName === 'expand') {
            continue
          }

          // Se o campo existe na coleção, aplicar o valor
          if (camposValidos[kName]) {
            var val = item[kName]
            rec.set(kName, val)
          }
        }

        $app.save(rec)

        if (isNovo) {
          criados++
        } else {
          atualizados++
        }
      } catch (errRec) {
        erros++
        var errMsg = String(errRec?.message || errRec)
        if (detalhesErros.length < 15) {
          detalhesErros.push({
            id: recordId || 'sem_id',
            indice: rIdx,
            erro: errMsg,
          })
        }
        console.warn(
          '[RESTAURAR_LOTE] Erro ao gravar registro na coleção ' +
            colecaoNome +
            ' (id=' +
            recordId +
            '): ' +
            errMsg,
        )
      }
    }

    return e.json(200, {
      success: erros === 0,
      colecao: colecaoNome,
      processados: registros.length,
      criados: criados,
      atualizados: atualizados,
      erros: erros,
      detalhes_erros: detalhesErros,
    })
  },
  $apis.requireAuth(),
)

// 13.3. ENDPOINT: FINALIZAR E REGISTRAR AUDITORIA DA RESTAURAÇÃO
// POST /backend/v1/backups/restaurar/finalizar
routerAdd(
  'POST',
  '/backend/v1/backups/restaurar/finalizar',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    // Checar admin inline
    var isAdmin = false
    try {
      var adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        "usuario_id = '" + authRecord.id + "' && role = 'admin'",
        '',
        1,
        0,
      )
      isAdmin = Boolean(adminMembros && adminMembros.length > 0)
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, {
        error: 'Apenas administradores podem finalizar restaurações.',
      })
    }

    var body = e.requestInfo().body || {}
    var nomeArquivo = body.nome_arquivo || 'backup_restaurado.json'
    var resumoColecoes = body.resumo_colecoes || {}
    var totalCriados = Number(body.total_criados) || 0
    var totalAtualizados = Number(body.total_atualizados) || 0
    var totalErros = Number(body.total_erros) || 0
    var duracaoMs = Number(body.duracao_ms) || 0

    var usuarioNome =
      authRecord.getString('name') || authRecord.getString('email') || 'Administrador'

    // Registrar no historico_alteracoes
    try {
      var histCol = $app.findCollectionByNameOrId('historico_alteracoes')
      var recHist = new Record(histCol)
      recHist.set('empresa_id', '6nt8u83eiyzf6xr')
      recHist.set('colecao_origem', 'outros')
      recHist.set('registro_id', 'restauracao_' + Date.now())
      recHist.set('acao', 'editar')
      recHist.set('usuario_id', authRecord.id)
      recHist.set('usuario_nome', usuarioNome)
      recHist.set(
        'descricao',
        'Restauração local de backup executada a partir do arquivo "' +
          nomeArquivo +
          '". Criados: ' +
          totalCriados +
          ', Atualizados: ' +
          totalAtualizados +
          ', Erros: ' +
          totalErros +
          '.',
      )
      recHist.set('detalhes', {
        nome_arquivo: nomeArquivo,
        total_criados: totalCriados,
        total_atualizados: totalAtualizados,
        total_erros: totalErros,
        duracao_ms: duracaoMs,
        resumo_colecoes: resumoColecoes,
        executado_em: new Date().toISOString(),
      })
      $app.save(recHist)
    } catch (eHist) {
      console.warn('[RESTAURAR_FINALIZAR] Aviso ao gravar historico:', eHist)
    }

    return e.json(200, {
      success: true,
      message: 'Restauração concluída e auditada com sucesso.',
      resumo: {
        nome_arquivo: nomeArquivo,
        total_criados: totalCriados,
        total_atualizados: totalAtualizados,
        total_erros: totalErros,
        duracao_ms: duracaoMs,
      },
    })
  },
  $apis.requireAuth(),
)
/* FIM HOOKS BACKUP */
