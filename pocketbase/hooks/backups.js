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

      // Prioridade B: salvar também em config_google_drive.detalhes para redundância
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
          curDetalhes.cached_token = data.access_token
          curDetalhes.cached_expiry_ms = expiryMsCalculado
          curDetalhes.cached_created_at = new Date().toISOString()
          cfgSaveRec.set('detalhes', curDetalhes)
          $app.save(cfgSaveRec)
          console.log(
            logPrefix + ' [CACHE TOKEN] Token espelhado em config_google_drive com sucesso.',
          )
        }
      } catch (eSaveCache) {
        console.warn(
          logPrefix + ' [CACHE TOKEN] Aviso ao salvar token em config_google_drive:',
          eSaveCache,
        )
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
            role: 'writer',
            type: 'user',
            emailAddress: userEmail,
          }),
          timeout: 20,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          return { success: true }
        }
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
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

      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('usuario_email')) {
            usuarioEmailDestino = configRec.getString('usuario_email')
          }
        }
      } catch (_) {}

      if (!serviceAccountJson) {
        var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        return { status: 'erro', erro: msgSemConta }
      }

      console.log(logPrefix + ' Obtendo access token Google OAuth...')
      var auth = getAccessTokenShared(
        serviceAccountJson,
        'https://www.googleapis.com/auth/drive.file',
      )
      console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
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

        if (initRes.statusCode !== 200 && folderId) {
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
        backupRecord.set('drive_erro', '')
        $app.save(backupRecord)
      }

      var currentOffset = backupRecord.getInt('drive_offset') || 0
      try {
        var checkRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': '0',
            'Content-Range': 'bytes */' + totalBytes,
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

      var CHUNK_BYTES = 256 * 1024
      var chunksEnviadosNestaRodada = 0
      var totalChunksEstimado = Math.ceil(totalBytes / CHUNK_BYTES)

      while (currentOffset < totalBytes) {
        if (Date.now() - startRoundTime >= MAX_ROUND_DURATION_MS) {
          break
        }

        var targetSliceEnd = Math.min(currentOffset + CHUNK_BYTES, totalBytes)
        var targetSliceLen = targetSliceEnd - currentOffset
        if (targetSliceEnd < totalBytes && targetSliceLen % CHUNK_BYTES !== 0) {
          targetSliceLen = Math.floor(targetSliceLen / CHUNK_BYTES) * CHUNK_BYTES
          targetSliceEnd = currentOffset + targetSliceLen
        }

        var sliceBuf = ''
        var curPos = 0

        var hEnd = curPos + headerPrefix.length
        if (currentOffset < hEnd && targetSliceEnd > curPos) {
          var sStart = Math.max(0, currentOffset - curPos)
          var sEnd = Math.min(headerPrefix.length, targetSliceEnd - curPos)
          sliceBuf += headerPrefix.substring(sStart, sEnd)
        }
        curPos = hEnd

        for (var colIdx = 0; colIdx < colecoesValidas.length; colIdx++) {
          if (curPos >= targetSliceEnd) break
          var nomeColecao = colecoesValidas[colIdx]

          var cPrefix = (colIdx > 0 ? ',' : '') + JSON.stringify(nomeColecao) + ':['
          var cpEnd = curPos + cPrefix.length
          if (currentOffset < cpEnd && targetSliceEnd > curPos) {
            var s1 = Math.max(0, currentOffset - curPos)
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
              if (currentOffset < commaEnd && targetSliceEnd > commaPos) {
                sliceBuf += ','
              }
              curPos += 1
            }

            var dEnd = curPos + insideData.length
            if (currentOffset < dEnd && targetSliceEnd > curPos) {
              var ds1 = Math.max(0, currentOffset - curPos)
              var ds2 = Math.min(insideData.length, targetSliceEnd - curPos)
              sliceBuf += insideData.substring(ds1, ds2)
            }
            curPos = dEnd
            chunkIndexDb++
          }

          var sufEnd = curPos + 1
          if (currentOffset < sufEnd && targetSliceEnd > curPos) {
            sliceBuf += ']'
          }
          curPos = sufEnd
        }

        var footEnd = curPos + footerSuffix.length
        if (currentOffset < footEnd && targetSliceEnd > curPos) {
          var fs1 = Math.max(0, currentOffset - curPos)
          var fs2 = Math.min(footerSuffix.length, targetSliceEnd - curPos)
          sliceBuf += footerSuffix.substring(fs1, fs2)
        }
        curPos = footEnd

        var actualChunkLen = sliceBuf.length
        if (actualChunkLen === 0) {
          console.warn(
            logPrefix + ' Fatia vazia gerada no offset ' + currentOffset + '. Interrompendo.',
          )
          break
        }

        var putEnd = currentOffset + actualChunkLen - 1
        var putRangeHeader = 'bytes ' + currentOffset + '-' + putEnd + '/' + totalBytes

        var putRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': String(actualChunkLen),
            'Content-Range': putRangeHeader,
          },
          body: sliceBuf,
          timeout: 20,
        })

        // Se retornar 401 Unauthorized (token expirado ou revogado no meio do processo), limpa o cache
        if (putRes.statusCode === 401) {
          try {
            var c401 = $app.findFirstRecordByData('cache_tokens_drive', 'chave', 'google_drive_sa')
            if (c401) {
              c401.set('access_token', '')
              c401.set('expiry_ms', 0)
              c401.set('detalhes', {})
              $app.save(c401)
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
              delete det401.cached_token
              delete det401.cached_expiry_ms
              cfg401.set('detalhes', det401)
              $app.save(cfg401)
            }
          } catch (_) {}
          console.warn(logPrefix + ' [CACHE TOKEN] Google retornou 401; cache do token invalidado.')
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

      // Prioridade B: salvar também em config_google_drive.detalhes para redundância
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
          curDetalhes.cached_token = data.access_token
          curDetalhes.cached_expiry_ms = expiryMsCalculado
          curDetalhes.cached_created_at = new Date().toISOString()
          cfgSaveRec.set('detalhes', curDetalhes)
          $app.save(cfgSaveRec)
          console.log(
            logPrefix + ' [CACHE TOKEN] Token espelhado em config_google_drive com sucesso.',
          )
        }
      } catch (eSaveCache) {
        console.warn(
          logPrefix + ' [CACHE TOKEN] Aviso ao salvar token em config_google_drive:',
          eSaveCache,
        )
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
            role: 'writer',
            type: 'user',
            emailAddress: userEmail,
          }),
          timeout: 20,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          return { success: true }
        }
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
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

      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('usuario_email')) {
            usuarioEmailDestino = configRec.getString('usuario_email')
          }
        }
      } catch (_) {}

      if (!serviceAccountJson) {
        var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        return { status: 'erro', erro: msgSemConta }
      }

      console.log(logPrefix + ' Obtendo access token Google OAuth...')
      var auth = getAccessTokenShared(
        serviceAccountJson,
        'https://www.googleapis.com/auth/drive.file',
      )
      console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
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

        if (initRes.statusCode !== 200 && folderId) {
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
        backupRecord.set('drive_erro', '')
        $app.save(backupRecord)
      }

      var currentOffset = backupRecord.getInt('drive_offset') || 0
      try {
        var checkRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': '0',
            'Content-Range': 'bytes */' + totalBytes,
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

      var CHUNK_BYTES = 256 * 1024
      var chunksEnviadosNestaRodada = 0
      var totalChunksEstimado = Math.ceil(totalBytes / CHUNK_BYTES)

      while (currentOffset < totalBytes) {
        if (Date.now() - startRoundTime >= MAX_ROUND_DURATION_MS) {
          break
        }

        var targetSliceEnd = Math.min(currentOffset + CHUNK_BYTES, totalBytes)
        var targetSliceLen = targetSliceEnd - currentOffset
        if (targetSliceEnd < totalBytes && targetSliceLen % CHUNK_BYTES !== 0) {
          targetSliceLen = Math.floor(targetSliceLen / CHUNK_BYTES) * CHUNK_BYTES
          targetSliceEnd = currentOffset + targetSliceLen
        }

        var sliceBuf = ''
        var curPos = 0

        var hEnd = curPos + headerPrefix.length
        if (currentOffset < hEnd && targetSliceEnd > curPos) {
          var sStart = Math.max(0, currentOffset - curPos)
          var sEnd = Math.min(headerPrefix.length, targetSliceEnd - curPos)
          sliceBuf += headerPrefix.substring(sStart, sEnd)
        }
        curPos = hEnd

        for (var colIdx = 0; colIdx < colecoesValidas.length; colIdx++) {
          if (curPos >= targetSliceEnd) break
          var nomeColecao = colecoesValidas[colIdx]

          var cPrefix = (colIdx > 0 ? ',' : '') + JSON.stringify(nomeColecao) + ':['
          var cpEnd = curPos + cPrefix.length
          if (currentOffset < cpEnd && targetSliceEnd > curPos) {
            var s1 = Math.max(0, currentOffset - curPos)
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
              if (currentOffset < commaEnd && targetSliceEnd > commaPos) {
                sliceBuf += ','
              }
              curPos += 1
            }

            var dEnd = curPos + insideData.length
            if (currentOffset < dEnd && targetSliceEnd > curPos) {
              var ds1 = Math.max(0, currentOffset - curPos)
              var ds2 = Math.min(insideData.length, targetSliceEnd - curPos)
              sliceBuf += insideData.substring(ds1, ds2)
            }
            curPos = dEnd
            chunkIndexDb++
          }

          var sufEnd = curPos + 1
          if (currentOffset < sufEnd && targetSliceEnd > curPos) {
            sliceBuf += ']'
          }
          curPos = sufEnd
        }

        var footEnd = curPos + footerSuffix.length
        if (currentOffset < footEnd && targetSliceEnd > curPos) {
          var fs1 = Math.max(0, currentOffset - curPos)
          var fs2 = Math.min(footerSuffix.length, targetSliceEnd - curPos)
          sliceBuf += footerSuffix.substring(fs1, fs2)
        }
        curPos = footEnd

        var actualChunkLen = sliceBuf.length
        if (actualChunkLen === 0) {
          console.warn(
            logPrefix + ' Fatia vazia gerada no offset ' + currentOffset + '. Interrompendo.',
          )
          break
        }

        var putEnd = currentOffset + actualChunkLen - 1
        var putRangeHeader = 'bytes ' + currentOffset + '-' + putEnd + '/' + totalBytes

        var putRes = $http.send({
          url: sessionUrl,
          method: 'PUT',
          headers: {
            'Content-Length': String(actualChunkLen),
            'Content-Range': putRangeHeader,
          },
          body: sliceBuf,
          timeout: 20,
        })

        // Se retornar 401 Unauthorized (token expirado ou revogado no meio do processo), limpa o cache
        if (putRes.statusCode === 401) {
          try {
            var c401Cron = $app.findFirstRecordByData(
              'cache_tokens_drive',
              'chave',
              'google_drive_sa',
            )
            if (c401Cron) {
              c401Cron.set('access_token', '')
              c401Cron.set('expiry_ms', 0)
              c401Cron.set('detalhes', {})
              $app.save(c401Cron)
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
              delete det401Cron.cached_token
              delete det401Cron.cached_expiry_ms
              cfg401Cron.set('detalhes', det401Cron)
              $app.save(cfg401Cron)
            }
          } catch (_) {}
          console.warn(logPrefix + ' [CACHE TOKEN] Google retornou 401; cache do token invalidado.')
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

      var isConfigured = Boolean(
        serviceAccountJson && (clientEmail || serviceAccountJson.length > 50),
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
          tipo_autenticacao: 'service_account',
          configurado: isConfigured,
          conectado: isConfigured,
          chave_configurada: isConfigured,
          client_email: clientEmail,
          client_email_mascarado: emailMascarado,
          project_id: projectId,
          pasta_nome: folderName,
          pasta_id: folderId,
          usuario_email: usuarioEmail,
          ultimo_envio: ultimoEnvio,
          status_conexao: isConfigured ? 'conectado' : 'desconectado',
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
/* FIM HOOKS BACKUP */
