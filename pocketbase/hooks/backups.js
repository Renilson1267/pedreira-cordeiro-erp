// Hook PocketBase para gerenciamento e automação de Backups do ERP Pedreira Cordeiro
// com Integração ao Google Drive via CONTA DE SERVIÇO (Service Account / JWT RS256 puro em JS)
// Endpoints autenticados sob /backend/v1/backups e /backend/v1/google-drive
// Cron job semanal automático via cronAdd: todo domingo às 00:30 (horário do servidor)
// NOTA JSVM DO POCKETBASE: As callbacks rodam em pools isoladas, portanto toda função auxiliar
// deve ser estritamente declarada dentro de cada callback (inline).

// -------------------------------------------------------------
// 1. REGISTRO DO CRON JOB SEMANAL COM ENVIO AUTOMÁTICO AO GOOGLE DRIVE
// Executa todo domingo às 00:30 (horário do servidor PocketBase)
// -------------------------------------------------------------
// Endpoint temporário ou helper interno para disparar o processamento do backup pendente/solicitado
routerAdd('GET', '/backend/v1/backups/processar-solicitados-drive', (e) => {
  const pending = $app.findRecordsByFilter(
    'backups_sistema',
    "drive_status = 'solicitado' || id = 'jpc5w1b0o13nvim'",
    '-created',
    10,
    0,
  )

  let processados = 0
  let resultado = []

  for (let idx = 0; idx < pending.length; idx++) {
    const backupRecord = pending[idx]
    const backupId = backupRecord.id

    // Helper Google Service Account Inline
    function getAccessTokenCron(serviceAccountJson, scope) {
      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger()
            return { n: readInteger(), e: readInteger(), d: readInteger() }
          } else {
            return { n: readInteger(), e: readInteger(), d: readInteger() }
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
        var cur = baseB.slice()
        for (var i = 0; i < expB.length; i++) {
          var chunk = expB[i]
          for (var b = 0; b < BASE_BITS; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            cur = divRem(mul(cur, cur), modB).r
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var nBig = bytesToBig(keyComponents.n)
        var dBig = bytesToBig(keyComponents.d)
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
        var sBig = modPow(emBig, dBig, nBig)
        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowSec = Math.floor(Date.now() / 1000)
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

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: 15,
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

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
      }
    }

    function buildMultipartBodyCron(metaObj, contentStr) {
      var boundary = '-------314159265358979323846'
      var delimiter = '\r\n--' + boundary + '\r\n'
      var closeDelimiter = '\r\n--' + boundary + '--'
      return {
        boundary: boundary,
        body:
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metaObj) +
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          contentStr +
          closeDelimiter,
      }
    }

    function shareFileWithUserCron(fileId, userEmail, token) {
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

    try {
      let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let usuarioEmailDestino = 'renilsonfmello@gmail.com'
      let configRec = null

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
        resultado.push({ id: backupId, erro: 'Sem service account' })
        continue
      }

      const auth = getAccessTokenCron(
        serviceAccountJson,
        'https://www.googleapis.com/auth/drive.file',
      )
      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
            id: backupRecord.id,
            nome_arquivo: backupRecord.getString('nome_arquivo'),
            tipo: backupRecord.getString('tipo'),
            origem: backupRecord.getString('origem') || 'semanal_automatico',
            total_colecoes: backupRecord.getInt('total_colecoes'),
            total_registros: backupRecord.getInt('total_registros'),
            resumo_colecoes: backupRecord.get('resumo_colecoes'),
            created: backupRecord.getString('created'),
            exportado_em: new Date().toISOString(),
            sistema: 'Pedreira Cordeiro ERP (NovaGest)',
          },
          dados: colecoes,
        },
        null,
        2,
      )

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var tentativaSucesso = false

      if (folderId) {
        var mp1 = buildMultipartBodyCron(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
            parents: [folderId],
          },
          dumpJsonStr,
        )
        var res1 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp1.boundary,
          },
          body: mp1.body,
          timeout: 120,
        })

        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          tentativaSucesso = true
        }
      }

      if (!tentativaSucesso) {
        var mp2 = buildMultipartBodyCron(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
          },
          dumpJsonStr,
        )
        var res2 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp2.boundary,
          },
          body: mp2.body,
          timeout: 120,
        })

        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          var shareRes = shareFileWithUserCron(fileId, usuarioEmailDestino, auth.access_token)
          if (shareRes.success) {
            destinoDescricao =
              'Drive da Conta de Serviço (compartilhado com ' + usuarioEmailDestino + ')'
          } else {
            destinoDescricao =
              'Drive da Conta de Serviço (aviso compartilhamento: ' + shareRes.error + ')'
          }
        } else {
          var errDetail =
            'Erro no upload para o Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          resultado.push({ id: backupId, erro: errDetail })
          continue
        }
      }

      if (tentativaSucesso && fileId) {
        var agoraIso = new Date().toISOString()
        backupRecord.set('drive_status', 'enviado')
        backupRecord.set('drive_file_id', fileId)
        backupRecord.set('drive_folder_id', folderId || '')
        backupRecord.set('drive_enviado_em', agoraIso)
        backupRecord.set('drive_erro', destinoDescricao)
        $app.save(backupRecord)

        if (configRec) {
          configRec.set('ultimo_envio', agoraIso)
          configRec.set('ultimo_status', 'conectado')
          $app.save(configRec)
        }
        processados++
        resultado.push({ id: backupId, file_id: fileId, destino: destinoDescricao })
      }
    } catch (errOne) {
      resultado.push({ id: backupId, erro: String(errOne?.message || errOne) })
    }
  }

  return e.json(200, {
    success: true,
    processados: processados,
    detalhes: resultado,
  })
})

cronAdd('backup_processador_fila_solicitados', '*/1 * * * *', () => {
  const pending = $app.findRecordsByFilter(
    'backups_sistema',
    "drive_status = 'solicitado'",
    '-created',
    5,
    0,
  )

  for (let idx = 0; idx < pending.length; idx++) {
    const backupRecord = pending[idx]
    const backupId = backupRecord.id
    console.log(`[CRON FILA DRIVE] Processando backup solicitado: ${backupId}`)

    // Helpers Google Service Account Inline
    function getAccessTokenCron(serviceAccountJson, scope) {
      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger()
            return { n: readInteger(), e: readInteger(), d: readInteger() }
          } else {
            return { n: readInteger(), e: readInteger(), d: readInteger() }
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
        var cur = baseB.slice()
        for (var i = 0; i < expB.length; i++) {
          var chunk = expB[i]
          for (var b = 0; b < BASE_BITS; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            cur = divRem(mul(cur, cur), modB).r
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var nBig = bytesToBig(keyComponents.n)
        var dBig = bytesToBig(keyComponents.d)
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
        var sBig = modPow(emBig, dBig, nBig)
        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowSec = Math.floor(Date.now() / 1000)
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

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: 15,
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

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
      }
    }

    function buildMultipartBodyCron(metaObj, contentStr) {
      var boundary = '-------314159265358979323846'
      var delimiter = '\r\n--' + boundary + '\r\n'
      var closeDelimiter = '\r\n--' + boundary + '--'
      return {
        boundary: boundary,
        body:
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metaObj) +
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          contentStr +
          closeDelimiter,
      }
    }

    function shareFileWithUserCron(fileId, userEmail, token) {
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

    try {
      let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let usuarioEmailDestino = 'renilsonfmello@gmail.com'
      let configRec = null

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
        console.warn(`[CRON FILA DRIVE] Backup ${backupId}: Conta de Serviço não configurada`)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', 'Conta de Serviço Google Drive não configurada no ERP.')
        $app.save(backupRecord)
        continue
      }

      let auth
      try {
        auth = getAccessTokenCron(serviceAccountJson, 'https://www.googleapis.com/auth/drive.file')
      } catch (authErr) {
        const msg = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
        console.error(`[CRON FILA DRIVE] ${msg}`)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msg)
        $app.save(backupRecord)
        continue
      }

      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
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
          },
          dados: colecoes,
        },
        null,
        2,
      )

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var tentativaSucesso = false

      if (folderId) {
        var mp1 = buildMultipartBodyCron(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
            parents: [folderId],
          },
          dumpJsonStr,
        )
        var res1 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp1.boundary,
          },
          body: mp1.body,
          timeout: 120,
        })

        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          tentativaSucesso = true
        }
      }

      if (!tentativaSucesso) {
        var mp2 = buildMultipartBodyCron(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
          },
          dumpJsonStr,
        )
        var res2 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp2.boundary,
          },
          body: mp2.body,
          timeout: 120,
        })

        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          var shareRes = shareFileWithUserCron(fileId, usuarioEmailDestino, auth.access_token)
          if (shareRes.success) {
            destinoDescricao =
              'Drive da Conta de Serviço (compartilhado com ' + usuarioEmailDestino + ')'
          } else {
            destinoDescricao =
              'Drive da Conta de Serviço (aviso compartilhamento: ' + shareRes.error + ')'
          }
        } else {
          var errDetail =
            'Erro no upload para o Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          continue
        }
      }

      if (tentativaSucesso && fileId) {
        var agoraIso = new Date().toISOString()
        console.log(`[CRON FILA DRIVE] Backup ${backupId} enviado com sucesso! File ID: ${fileId}`)
        backupRecord.set('drive_status', 'enviado')
        backupRecord.set('drive_file_id', fileId)
        backupRecord.set('drive_folder_id', folderId || '')
        backupRecord.set('drive_enviado_em', agoraIso)
        backupRecord.set('drive_erro', destinoDescricao)
        $app.save(backupRecord)

        if (configRec) {
          configRec.set('ultimo_envio', agoraIso)
          configRec.set('ultimo_status', 'conectado')
          $app.save(configRec)
        }
      }
    } catch (errOne) {
      console.error(`[CRON FILA DRIVE] Erro ao processar backup ${backupId}:`, errOne)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', String(errOne?.message || errOne))
        $app.save(backupRecord)
      } catch (_) {}
    }
  }
})

cronAdd('backup_semanal_pedreira_cordeiro', '30 0 * * 0', () => {
  console.log('[CRON] Iniciando execução do backup semanal automático da Pedreira Cordeiro...')

  // Helper Google Service Account Inline
  function getAccessTokenFromServiceAccount(serviceAccountJson, scope) {
    var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    var b64tab = {}
    for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
          pos++
          var algLen = readLength()
          pos += algLen
          var octTag = readTag()
          if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
          readLength()
          var pkcs1Tag = readTag()
          if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
          readLength()
          readInteger()
          return { n: readInteger(), e: readInteger(), d: readInteger() }
        } else {
          return { n: readInteger(), e: readInteger(), d: readInteger() }
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
      var cur = baseB.slice()
      for (var i = 0; i < expB.length; i++) {
        var chunk = expB[i]
        for (var b = 0; b < BASE_BITS; b++) {
          if ((chunk & (1 << b)) !== 0) {
            res = divRem(mul(res, cur), modB).r
          }
          cur = divRem(mul(cur, cur), modB).r
        }
      }
      return res
    }

    var SHA256_DIGEST_INFO = [
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
      0x05, 0x00, 0x04, 0x20,
    ]

    function rsaSignSha256(dataStr, keyComponents) {
      var nBig = bytesToBig(keyComponents.n)
      var dBig = bytesToBig(keyComponents.d)
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
      var sBig = modPow(emBig, dBig, nBig)
      var sigBytes = bigToBytes(sBig, kLen)
      return bytesToBase64Url(sigBytes)
    }

    var creds =
      typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

    if (!creds.client_email || !creds.private_key) {
      throw new Error(
        'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
      )
    }

    var nowSec = Math.floor(Date.now() / 1000)
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

    var res = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=' +
        encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
        '&assertion=' +
        encodeURIComponent(assertion),
      timeout: 15,
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

    return {
      access_token: data.access_token,
      client_email: creds.client_email,
      project_id: creds.project_id || '',
    }
  }

  const colecoesParaDump = [
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

  const inicio = Date.now()
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const nomeArquivo = 'backup_semanal_auto_' + timestampStr + '.json'

  try {
    const backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    const dadosCol = $app.findCollectionByNameOrId('backups_dados')

    let nativoStatus = 'tentado'
    let nativoArquivo = ''
    let nativoErro = ''
    const zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
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

    const resumo = {}
    let totalRegistrosGeral = 0
    let colecoesComErro = 0

    const backupRecord = new Record(backupsCol)
    backupRecord.set('nome_arquivo', nomeArquivo)
    backupRecord.set('tipo', 'completo')
    backupRecord.set('origem', 'semanal_automatico')
    backupRecord.set('status', 'sucesso')
    backupRecord.set('drive_status', 'pendente')
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

    for (let i = 0; i < colecoesParaDump.length; i++) {
      const colName = colecoesParaDump[i]
      try {
        const records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        const count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          const serialized = []
          for (let j = 0; j < count; j++) {
            const r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                const obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                const c = r.collection()
                if (c && c.fields) {
                  const fields = c.fields.all()
                  for (let f = 0; f < fields.length; f++) {
                    const fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          const CHUNK_SIZE = 200
          const totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (let ch = 0; ch < totalChunks; ch++) {
            const chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            const dadoRec = new Record(dadosCol)
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
        console.warn(`[CRON] Aviso ao extrair ${colName}:`, errCol)
      }
    }

    let backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        const cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    const statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

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
      `Backup semanal automático programado concluído com status "${statusFinal}". Total de ${totalRegistrosGeral} registros e ${Object.keys(resumo).length} coleções salvos.`,
    )
    $app.save(backupRecord)

    // Envio ao Google Drive via Service Account
    try {
      console.log('[CRON Drive] Verificando credenciais de Conta de Serviço para envio ao Drive...')

      let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let usuarioEmailDestino = 'renilsonfmello@gmail.com'
      let configRec = null

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
        console.log('[CRON Drive] Conta de serviço Google não configurada. Pulando upload.')
        backupRecord.set('drive_status', 'nao_configurado')
        backupRecord.set(
          'drive_erro',
          'Conta de serviço Google não configurada no ERP (cole o JSON da chave na tela de Backups).',
        )
        $app.save(backupRecord)
        return
      }

      const auth = getAccessTokenFromServiceAccount(
        serviceAccountJson,
        'https://www.googleapis.com/auth/drive.file',
      )

      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupRecord.id}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
            id: backupRecord.id,
            nome_arquivo: backupRecord.getString('nome_arquivo'),
            tipo: backupRecord.getString('tipo'),
            origem: backupRecord.getString('origem') || 'semanal_automatico',
            total_colecoes: backupRecord.getInt('total_colecoes'),
            total_registros: backupRecord.getInt('total_registros'),
            resumo_colecoes: backupRecord.get('resumo_colecoes'),
            created: backupRecord.getString('created'),
            exportado_em: new Date().toISOString(),
            sistema: 'Pedreira Cordeiro ERP (NovaGest)',
          },
          dados: colecoes,
        },
        null,
        2,
      )

      function buildMultipartBody(metaObj, contentStr) {
        var boundary = '-------314159265358979323846'
        var delimiter = '\r\n--' + boundary + '\r\n'
        var closeDelimiter = '\r\n--' + boundary + '--'
        return {
          boundary: boundary,
          body:
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metaObj) +
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            contentStr +
            closeDelimiter,
        }
      }

      function shareFileWithUser(fileId, userEmail, token) {
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

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var tentativaSucesso = false
      var erroInicial = ''

      // Tentativa 1: se houver folderId, tentar upload na pasta configurada
      if (folderId) {
        var mp1 = buildMultipartBody(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
            parents: [folderId],
          },
          dumpJsonStr,
        )
        var res1 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp1.boundary,
          },
          body: mp1.body,
          timeout: 120,
        })

        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          tentativaSucesso = true
        } else {
          erroInicial =
            'Upload na pasta configurada falhou (HTTP ' + res1.statusCode + '): ' + (res1.raw || '')
          console.warn('[CRON Drive] ' + erroInicial + ' — aplicando fallback...')
        }
      }

      // Tentativa 2 / Fallback: upload no Drive próprio da conta de serviço + compartilhamento com email do usuário
      if (!tentativaSucesso) {
        var mp2 = buildMultipartBody(
          {
            name: backupRecord.getString('nome_arquivo'),
            mimeType: 'application/json',
          },
          dumpJsonStr,
        )
        var res2 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp2.boundary,
          },
          body: mp2.body,
          timeout: 120,
        })

        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          // Compartilhar arquivo criado com o email do usuário
          var shareRes = shareFileWithUser(fileId, usuarioEmailDestino, auth.access_token)
          if (shareRes.success) {
            destinoDescricao =
              'Drive da Conta de Serviço (compartilhado com ' + usuarioEmailDestino + ')'
          } else {
            destinoDescricao =
              'Drive da Conta de Serviço (aviso compartilhamento: ' + shareRes.error + ')'
          }
        } else {
          var errDetail =
            'Erro no upload para o Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          console.error('[CRON Drive] ' + errDetail)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          return
        }
      }

      if (tentativaSucesso && fileId) {
        console.log(
          `[CRON Drive] Sucesso! Backup enviado via Service Account: ${fileId} (${destinoDescricao})`,
        )
        var agoraIso = new Date().toISOString()
        backupRecord.set('drive_status', 'enviado')
        backupRecord.set('drive_file_id', fileId)
        backupRecord.set('drive_folder_id', folderId || '')
        backupRecord.set('drive_enviado_em', agoraIso)
        backupRecord.set('drive_erro', destinoDescricao)
        $app.save(backupRecord)

        if (configRec) {
          configRec.set('ultimo_envio', agoraIso)
          configRec.set('ultimo_status', 'conectado')
          $app.save(configRec)
        }
      }
    } catch (errDrive) {
      console.error('[CRON Drive] Exceção durante envio ao Drive:', errDrive)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', String(errDrive?.message || errDrive))
        $app.save(backupRecord)
      } catch (_) {}
    }
  } catch (errCron) {
    console.error('[CRON] Erro crítico no backup semanal automático:', errCron)
  }
})

// -------------------------------------------------------------
// 2. ENDPOINT: LISTAR BACKUPS
// GET /backend/v1/backups
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      const backups = $app.findRecordsByFilter('backups_sistema', "id != ''", '-created', 100, 0)

      const result = backups.map((b) => ({
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
// 3. ENDPOINT: EXECUTAR BACKUP MANUAL SOB DEMANDA
// POST /backend/v1/backups/executar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/backups/executar',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    // Se é usuário autenticado do sistema com e-mail cadastrado ou administrador
    const isSuperOrUser = authRecord.id || isAdmin
    if (!isSuperOrUser) {
      return e.json(403, { error: 'Apenas usuários autorizados podem executar backups' })
    }

    const colecoesParaDump = [
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

    const backupsCol = $app.findCollectionByNameOrId('backups_sistema')
    const dadosCol = $app.findCollectionByNameOrId('backups_dados')
    const timestampStr = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)

    let nativoStatus = 'tentado'
    let nativoArquivo = ''
    let nativoErro = ''
    const zipName = 'backup_pedreira_cordeiro_' + timestampStr + '.zip'
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

    const resumo = {}
    let totalRegistrosGeral = 0
    let colecoesComErro = 0

    const solicitanteNome =
      authRecord.getString('name') || authRecord.getString('email') || 'Administrador'

    const backupRecord = new Record(backupsCol)
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

    for (let i = 0; i < colecoesParaDump.length; i++) {
      const colName = colecoesParaDump[i]
      try {
        const records = $app.findRecordsByFilter(colName, "id != ''", '-created', 5000, 0)
        const count = records ? records.length : 0
        totalRegistrosGeral += count
        resumo[colName] = count

        if (count > 0) {
          const serialized = []
          for (let j = 0; j < count; j++) {
            const r = records[j]
            try {
              if (typeof r.publicExport === 'function') {
                serialized.push(r.publicExport())
              } else {
                const obj = {
                  id: r.id,
                  created: r.getString('created'),
                  updated: r.getString('updated'),
                }
                const c = r.collection()
                if (c && c.fields) {
                  const fields = c.fields.all()
                  for (let f = 0; f < fields.length; f++) {
                    const fName = fields[f].name
                    obj[fName] = r.get(fName)
                  }
                }
                serialized.push(obj)
              }
            } catch (_) {
              serialized.push({ id: r.id })
            }
          }

          const CHUNK_SIZE = 200
          const totalChunks = Math.ceil(serialized.length / CHUNK_SIZE)
          for (let ch = 0; ch < totalChunks; ch++) {
            const chunkData = serialized.slice(ch * CHUNK_SIZE, (ch + 1) * CHUNK_SIZE)
            const dadoRec = new Record(dadosCol)
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
        console.warn(`[BACKUP] Falha ao extrair ${colName}:`, errCol)
      }
    }

    let backupDuplicatasIncluido = false
    try {
      if ($app.hasTable('_backup_duplicatas_excluidas')) {
        const cnt = $app.countRecords('_backup_duplicatas_excluidas')
        totalRegistrosGeral += cnt
        resumo['_backup_duplicatas_excluidas'] = cnt
        backupDuplicatasIncluido = true
      }
    } catch (_) {}

    const statusFinal = colecoesComErro === 0 ? 'sucesso' : 'parcial'

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
      `Backup real completo gerado sob demanda por ${solicitanteNome}. Todos os dados preservados com status "${statusFinal}".`,
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
// 4. ENDPOINT: STATUS DA CONFIGURAÇÃO DO BACKUP AUTOMÁTICO
// GET /backend/v1/backups/status-agendamento
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/status-agendamento',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let ultimoBackupAutomatico = null
    try {
      const autos = $app.findRecordsByFilter(
        'backups_sistema',
        "origem = 'semanal_automatico'",
        '-created',
        1,
        0,
      )
      if (autos && autos.length > 0) {
        const b = autos[0]
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
// 5. ENDPOINT: EXPORTAR / BAIXAR DADOS CONSOLIDADOS EM JSON
// GET /backend/v1/backups/{id}/download
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/backups/{id}/download',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    try {
      const backupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )

      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) {
          colecoes[col] = []
        }
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const payloadCompleto = {
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
// 6. ENDPOINT: STATUS DA INTEGRAÇÃO COM CONTA DE SERVIÇO GOOGLE DRIVE
// GET /backend/v1/google-drive/status
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/google-drive/status',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let folderName = 'Backups ERP'
      let clientEmail = ''
      let projectId = ''
      let ultimoEnvio = ''
      let dbStatus = ''
      let usuarioEmail = 'renilsonfmello@gmail.com'

      try {
        const configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
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
          const parsed = JSON.parse(serviceAccountJson)
          clientEmail = parsed.client_email || ''
          projectId = parsed.project_id || ''
        } catch (_) {}
      }

      const isConfigured = Boolean(
        serviceAccountJson && (clientEmail || serviceAccountJson.length > 50),
      )

      let emailMascarado = ''
      if (clientEmail) {
        const parts = clientEmail.split('@')
        if (parts.length === 2) {
          const userPart = parts[0]
          const maskedUser =
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
// 7. ENDPOINT: SALVAR CREDENCIAIS DA CONTA DE SERVIÇO (SERVICE ACCOUNT JSON E FOLDER ID)
// POST /backend/v1/google-drive/config
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/config',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem configurar o Google Drive' })
    }

    // Helper Google Service Account Inline para validação online com timeout curto (~10s)
    function testServiceAccountKeyOnline(serviceAccountJson, timeoutSecs) {
      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger()
            return { n: readInteger(), e: readInteger(), d: readInteger() }
          } else {
            return { n: readInteger(), e: readInteger(), d: readInteger() }
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
        var cur = baseB.slice()
        for (var i = 0; i < expB.length; i++) {
          var chunk = expB[i]
          for (var b = 0; b < BASE_BITS; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            cur = divRem(mul(cur, cur), modB).r
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var nBig = bytesToBig(keyComponents.n)
        var dBig = bytesToBig(keyComponents.d)
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
        var sBig = modPow(emBig, dBig, nBig)
        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowSec = Math.floor(Date.now() / 1000)
      var header = { alg: 'RS256', typ: 'JWT' }
      var claimSet = {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/drive.file',
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

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: timeoutSecs || 10,
      })

      if (res.statusCode !== 200) {
        throw new Error(
          'Falha no teste com Google OAuth (HTTP ' + res.statusCode + '): ' + (res.raw || ''),
        )
      }

      var data = res.json || JSON.parse(res.raw || '{}')
      if (!data.access_token) {
        throw new Error('Access token não retornado pelo Google OAuth.')
      }

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
      }
    }

    const body = e.requestInfo().body || {}
    let serviceAccountJsonInput = (body.service_account_json || '').trim()
    let folderId = (body.folder_id || '').trim()
    let folderName = (body.folder_name || 'Backups ERP').trim()
    let usuarioEmailInput = (body.usuario_email || '').trim()

    if (folderId.indexOf('drive.google.com') !== -1) {
      const match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        folderId = match[1]
      }
    }

    try {
      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
      } catch (_) {
        const configCol = $app.findCollectionByNameOrId('config_google_drive')
        configRec = new Record(configCol)
        configRec.set('chave', 'padrao')
      }

      let parsedEmail = ''
      let parsedProjectId = ''
      let parsedPrivateKeyId = ''
      let parsedCreds = null
      let novaChaveEnviada = false

      // 1. Validação estrutural local do JSON (parse imediato sem depender de rede)
      if (serviceAccountJsonInput) {
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
              'O JSON colado é inválido ou incompleto. Certifique-se de baixar o arquivo JSON completo de chave da Conta de Serviço no Google Cloud Console (deve conter "client_email" e "private_key").',
          })
        }

        parsedEmail = parsedCreds.client_email
        parsedProjectId = parsedCreds.project_id || ''
        parsedPrivateKeyId = parsedCreds.private_key_id || ''
        novaChaveEnviada = true

        // Salvar imediatamente os novos campos no registro
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

      // 2. Persistir imediatamente no banco ANTES de qualquer validação online externa
      $app.save(configRec)

      const finalEmail = parsedEmail || configRec.getString('client_email')
      const finalFolderId = folderId !== undefined ? folderId : configRec.getString('folder_id')
      const finalUsuarioEmail = configRec.getString('usuario_email')
      // 3. Validação online contra o Google (apenas se nova chave foi enviada ou se explicitamente solicitada)
      // Executa com timeout curto de 10s. Se demorar ou falhar por rede/timeout, a chave permanece salva!
      let validacaoGoogle = {
        testada: false,
        sucesso: false,
        aviso: '',
      }

      if (novaChaveEnviada && parsedCreds) {
        validacaoGoogle.testada = true
        try {
          testServiceAccountKeyOnline(parsedCreds, 10)
          validacaoGoogle.sucesso = true
        } catch (testErr) {
          const errMsg = String(testErr?.message || testErr)
          const isTimeout =
            errMsg.toLowerCase().indexOf('timeout') !== -1 ||
            errMsg.toLowerCase().indexOf('deadline') !== -1 ||
            errMsg.toLowerCase().indexOf('context') !== -1
          console.warn('[Google Drive Config] Validação online da chave retornou aviso:', errMsg)

          validacaoGoogle.sucesso = false
          if (isTimeout) {
            validacaoGoogle.aviso =
              'Chave salva com sucesso, mas a validação com o Google demorou demais. A validação será refeita automaticamente no próximo envio.'
          } else {
            validacaoGoogle.aviso =
              'Chave salva com sucesso. Aviso da validação online com o Google: ' +
              errMsg +
              '. A conexão será retestada no próximo envio de backup.'
          }
        }
      }

      const mensagemRetorno = validacaoGoogle.aviso
        ? validacaoGoogle.aviso
        : 'Configurações da Conta de Serviço salvas com sucesso!'

      return e.json(200, {
        success: true,
        message: mensagemRetorno,
        client_email: finalEmail,
        folder_id: finalFolderId,
        usuario_email: finalUsuarioEmail,
        validacao_online: validacaoGoogle,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao salvar configurações: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 8. ENDPOINT: REMOVER / DESCONECTAR CONTA DE SERVIÇO
// POST /backend/v1/google-drive/desconectar
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/google-drive/desconectar',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem desconectar o Google Drive' })
    }

    try {
      const configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
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
// 9. ENDPOINT: ENVIAR MANUALMENTE UM BACKUP ESPECÍFICO AO GOOGLE DRIVE VIA CONTA DE SERVIÇO
// OPTIONS /backend/v1/backups/{id}/enviar-drive (preflight CORS)
// POST /backend/v1/backups/{id}/enviar-drive
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
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autorizado' })
    }

    let isAdmin = false
    try {
      const adminMembros = $app.findRecordsByFilter(
        'empresa_membros',
        `usuario_id = '${authRecord.id}' && role = 'admin'`,
        '',
        1,
        0,
      )
      isAdmin = adminMembros && adminMembros.length > 0
    } catch (_) {
      isAdmin = false
    }

    const isSuperOrUser = authRecord.id || isAdmin
    if (!isSuperOrUser) {
      return e.json(403, {
        error: 'Apenas usuários autorizados podem enviar backups ao Google Drive',
      })
    }

    // Helper Google Service Account Inline para upload manual
    function getAccessTokenManual(serviceAccountJson, scope) {
      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var b64tab = {}
      for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
            pos++
            var algLen = readLength()
            pos += algLen
            var octTag = readTag()
            if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
            readLength()
            var pkcs1Tag = readTag()
            if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
            readLength()
            readInteger()
            return { n: readInteger(), e: readInteger(), d: readInteger() }
          } else {
            return { n: readInteger(), e: readInteger(), d: readInteger() }
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
        var cur = baseB.slice()
        for (var i = 0; i < expB.length; i++) {
          var chunk = expB[i]
          for (var b = 0; b < BASE_BITS; b++) {
            if ((chunk & (1 << b)) !== 0) {
              res = divRem(mul(res, cur), modB).r
            }
            cur = divRem(mul(cur, cur), modB).r
          }
        }
        return res
      }

      var SHA256_DIGEST_INFO = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20,
      ]

      function rsaSignSha256(dataStr, keyComponents) {
        var nBig = bytesToBig(keyComponents.n)
        var dBig = bytesToBig(keyComponents.d)
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
        var sBig = modPow(emBig, dBig, nBig)
        var sigBytes = bigToBytes(sBig, kLen)
        return bytesToBase64Url(sigBytes)
      }

      var creds =
        typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

      if (!creds.client_email || !creds.private_key) {
        throw new Error(
          'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
        )
      }

      var nowSec = Math.floor(Date.now() / 1000)
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

      var res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'grant_type=' +
          encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' +
          encodeURIComponent(assertion),
        timeout: 15,
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

      return {
        access_token: data.access_token,
        client_email: creds.client_email,
        project_id: creds.project_id || '',
      }
    }

    const backupId = e.request.pathValue('id')
    if (!backupId) {
      return e.json(400, { error: 'ID do backup não informado' })
    }

    try {
      const backupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)

      let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
      let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
      let folderName = 'Backups ERP'
      let usuarioEmailDestino = 'renilsonfmello@gmail.com'
      let configRec = null

      try {
        configRec = $app.findFirstRecordByData('config_google_drive', 'chave', 'padrao')
        if (configRec) {
          if (!serviceAccountJson) serviceAccountJson = configRec.getString('service_account_json')
          if (!folderId) folderId = configRec.getString('folder_id')
          if (configRec.getString('folder_name')) folderName = configRec.getString('folder_name')
          if (configRec.getString('usuario_email')) {
            usuarioEmailDestino = configRec.getString('usuario_email')
          }
        }
      } catch (_) {}
      if (!serviceAccountJson) {
        return e.json(400, {
          error:
            'Conta de Serviço Google Drive não configurada. Cole o JSON da chave na seção "Integração Google Drive" antes de enviar.',
        })
      }

      let auth
      try {
        auth = getAccessTokenManual(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
        )
      } catch (authErr) {
        const msg = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
        backupRec.set('drive_status', 'erro')
        backupRec.set('drive_erro', msg)
        $app.save(backupRec)
        return e.json(400, { error: msg })
      }

      const chunks = $app.findRecordsByFilter(
        'backups_dados',
        `backup_id = '${backupId}'`,
        'colecao_nome,chunk_index',
        2000,
        0,
      )
      const colecoes = {}
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const col = ch.getString('colecao_nome')
        const items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (let k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      const dumpJsonStr = JSON.stringify(
        {
          meta: {
            id: backupRec.id,
            nome_arquivo: backupRec.getString('nome_arquivo'),
            tipo: backupRec.getString('tipo'),
            origem: backupRec.getString('origem') || 'manual',
            total_colecoes: backupRec.getInt('total_colecoes'),
            total_registros: backupRec.getInt('total_registros'),
            resumo_colecoes: backupRec.get('resumo_colecoes'),
            created: backupRec.getString('created'),
            exportado_em: new Date().toISOString(),
            sistema: 'Pedreira Cordeiro ERP (NovaGest)',
          },
          dados: colecoes,
        },
        null,
        2,
      )

      function buildMultipartBody(metaObj, contentStr) {
        var boundary = '-------314159265358979323846'
        var delimiter = '\r\n--' + boundary + '\r\n'
        var closeDelimiter = '\r\n--' + boundary + '--'
        return {
          boundary: boundary,
          body:
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metaObj) +
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            contentStr +
            closeDelimiter,
        }
      }

      function shareFileWithUser(fileId, userEmail, token) {
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

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var mensagemRetorno = ''
      var tentativaSucesso = false
      var erroInicial = ''

      // Tentativa 1: se houver folderId, tentar upload na pasta configurada
      if (folderId) {
        var mp1 = buildMultipartBody(
          {
            name: backupRec.getString('nome_arquivo'),
            mimeType: 'application/json',
            parents: [folderId],
          },
          dumpJsonStr,
        )
        var res1 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp1.boundary,
          },
          body: mp1.body,
          timeout: 120,
        })

        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          mensagemRetorno = 'Backup enviado com sucesso ao Google Drive na pasta configurada!'
          tentativaSucesso = true
        } else {
          erroInicial =
            'Upload na pasta configurada falhou (HTTP ' + res1.statusCode + '): ' + (res1.raw || '')
          console.warn('[Manual Drive] ' + erroInicial + ' — aplicando fallback...')
        }
      }

      // Tentativa 2 / Fallback: upload no Drive próprio da conta de serviço + compartilhamento com email do usuário
      if (!tentativaSucesso) {
        var mp2 = buildMultipartBody(
          {
            name: backupRec.getString('nome_arquivo'),
            mimeType: 'application/json',
          },
          dumpJsonStr,
        )
        var res2 = $http.send({
          url: uploadUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + auth.access_token,
            'Content-Type': 'multipart/related; boundary=' + mp2.boundary,
          },
          body: mp2.body,
          timeout: 120,
        })

        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          // Compartilhar arquivo criado com o email do usuário
          var shareRes = shareFileWithUser(fileId, usuarioEmailDestino, auth.access_token)
          if (shareRes.success) {
            destinoDescricao =
              'Drive da Conta de Serviço (compartilhado com ' + usuarioEmailDestino + ')'
            mensagemRetorno =
              'Backup enviado com sucesso! Disponível em "Compartilhado comigo" no Google Drive de ' +
              usuarioEmailDestino +
              '.'
          } else {
            destinoDescricao =
              'Drive da Conta de Serviço (aviso compartilhamento: ' + shareRes.error + ')'
            mensagemRetorno =
              'Backup enviado ao Drive, mas houve aviso ao compartilhar com ' +
              usuarioEmailDestino +
              ': ' +
              shareRes.error
          }
        } else {
          var errDetail =
            'Erro no envio ao Google Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          backupRec.set('drive_status', 'erro')
          backupRec.set('drive_erro', errDetail)
          $app.save(backupRec)
          return e.json(500, { error: errDetail })
        }
      }

      var agoraIso = new Date().toISOString()
      backupRec.set('drive_status', 'enviado')
      backupRec.set('drive_file_id', fileId)
      backupRec.set('drive_folder_id', folderId || '')
      backupRec.set('drive_enviado_em', agoraIso)
      backupRec.set('drive_erro', destinoDescricao)
      $app.save(backupRec)

      if (configRec) {
        configRec.set('ultimo_envio', agoraIso)
        configRec.set('ultimo_status', 'conectado')
        $app.save(configRec)
      }

      return e.json(200, {
        success: true,
        message: mensagemRetorno,
        file_id: fileId,
        folder_id: folderId || '',
        destino: destinoDescricao,
        enviado_em: agoraIso,
      })
    } catch (err) {
      console.error('[Manual Drive] Erro:', err)
      return e.json(500, { error: 'Erro ao enviar backup ao Drive: ' + (err?.message || err) })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 10. TRIGGER REATIVO: onRecordAfterUpdateSuccess em backups_sistema
// Dispara o envio ao Google Drive quando drive_status === "solicitado"
// -------------------------------------------------------------
onRecordUpdate((e) => {
  e.next()

  const rec = e.record
  if (!rec) return

  const statusAtual = rec.getString('drive_status')
  if (statusAtual !== 'solicitado') return

  const backupId = rec.id
  console.log(
    `[TRIGGER Drive] Backup ${backupId} marcado como 'solicitado'. Iniciando processamento...`,
  )

  // Helpers Google Service Account Inline
  function getAccessTokenTrigger(serviceAccountJson, scope) {
    var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    var b64tab = {}
    for (var i = 0; i < b64chars.length; i++) b64tab[b64chars.charAt(i)] = i

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
          pos++
          var algLen = readLength()
          pos += algLen
          var octTag = readTag()
          if (octTag !== 0x04) throw new Error('ASN.1 PKCS#8: esperado OCTET STRING')
          readLength()
          var pkcs1Tag = readTag()
          if (pkcs1Tag !== 0x30) throw new Error('PKCS#1 inválido dentro do PKCS#8')
          readLength()
          readInteger()
          return { n: readInteger(), e: readInteger(), d: readInteger() }
        } else {
          return { n: readInteger(), e: readInteger(), d: readInteger() }
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
      var cur = baseB.slice()
      for (var i = 0; i < expB.length; i++) {
        var chunk = expB[i]
        for (var b = 0; b < BASE_BITS; b++) {
          if ((chunk & (1 << b)) !== 0) {
            res = divRem(mul(res, cur), modB).r
          }
          cur = divRem(mul(cur, cur), modB).r
        }
      }
      return res
    }

    var SHA256_DIGEST_INFO = [
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
      0x05, 0x00, 0x04, 0x20,
    ]

    function rsaSignSha256(dataStr, keyComponents) {
      var nBig = bytesToBig(keyComponents.n)
      var dBig = bytesToBig(keyComponents.d)
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
      var sBig = modPow(emBig, dBig, nBig)
      var sigBytes = bigToBytes(sBig, kLen)
      return bytesToBase64Url(sigBytes)
    }

    var creds =
      typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson

    if (!creds.client_email || !creds.private_key) {
      throw new Error(
        'JSON de Conta de Serviço inválido: "client_email" e "private_key" são obrigatórios.',
      )
    }

    var nowSec = Math.floor(Date.now() / 1000)
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

    var res = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=' +
        encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
        '&assertion=' +
        encodeURIComponent(assertion),
      timeout: 15,
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

    return {
      access_token: data.access_token,
      client_email: creds.client_email,
      project_id: creds.project_id || '',
    }
  }

  function buildMultipartBodyTrigger(metaObj, contentStr) {
    var boundary = '-------314159265358979323846'
    var delimiter = '\r\n--' + boundary + '\r\n'
    var closeDelimiter = '\r\n--' + boundary + '--'
    return {
      boundary: boundary,
      body:
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metaObj) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        contentStr +
        closeDelimiter,
    }
  }

  function shareFileWithUserTrigger(fileId, userEmail, token) {
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

  try {
    let serviceAccountJson = $os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON') || ''
    let folderId = $os.getenv('GOOGLE_DRIVE_FOLDER_ID') || ''
    let usuarioEmailDestino = 'renilsonfmello@gmail.com'
    let configRec = null

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
      const errSemConfig = 'Conta de Serviço Google Drive não configurada no ERP.'
      console.warn(`[TRIGGER Drive] ${errSemConfig}`)
      const liveRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      liveRec.set('drive_status', 'erro')
      liveRec.set('drive_erro', errSemConfig)
      $app.save(liveRec)
      return
    }

    let auth
    try {
      auth = getAccessTokenTrigger(serviceAccountJson, 'https://www.googleapis.com/auth/drive.file')
    } catch (authErr) {
      const msg = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
      console.error(`[TRIGGER Drive] ${msg}`)
      const liveRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      liveRec.set('drive_status', 'erro')
      liveRec.set('drive_erro', msg)
      $app.save(liveRec)
      return
    }

    const liveBackupRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
    const chunks = $app.findRecordsByFilter(
      'backups_dados',
      `backup_id = '${backupId}'`,
      'colecao_nome,chunk_index',
      2000,
      0,
    )
    const colecoes = {}
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i]
      const col = ch.getString('colecao_nome')
      const items = ch.get('registros_json') || []
      if (!colecoes[col]) colecoes[col] = []
      if (Array.isArray(items)) {
        for (let k = 0; k < items.length; k++) {
          colecoes[col].push(items[k])
        }
      }
    }

    const dumpJsonStr = JSON.stringify(
      {
        meta: {
          id: liveBackupRec.id,
          nome_arquivo: liveBackupRec.getString('nome_arquivo'),
          tipo: liveBackupRec.getString('tipo'),
          origem: liveBackupRec.getString('origem') || 'manual',
          total_colecoes: liveBackupRec.getInt('total_colecoes'),
          total_registros: liveBackupRec.getInt('total_registros'),
          resumo_colecoes: liveBackupRec.get('resumo_colecoes'),
          created: liveBackupRec.getString('created'),
          exportado_em: new Date().toISOString(),
          sistema: 'Pedreira Cordeiro ERP (NovaGest)',
        },
        dados: colecoes,
      },
      null,
      2,
    )

    var uploadUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
    var uploadedJson = null
    var fileId = ''
    var destinoDescricao = ''
    var tentativaSucesso = false

    // Tentativa 1: se houver folderId, tentar upload na pasta configurada
    if (folderId) {
      var mp1 = buildMultipartBodyTrigger(
        {
          name: liveBackupRec.getString('nome_arquivo'),
          mimeType: 'application/json',
          parents: [folderId],
        },
        dumpJsonStr,
      )
      var res1 = $http.send({
        url: uploadUrl,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + auth.access_token,
          'Content-Type': 'multipart/related; boundary=' + mp1.boundary,
        },
        body: mp1.body,
        timeout: 120,
      })

      if (res1.statusCode === 200 || res1.statusCode === 201) {
        uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
        fileId = uploadedJson.id || ''
        destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
        tentativaSucesso = true
      } else {
        console.warn(
          `[TRIGGER Drive] Upload na pasta configurada falhou (HTTP ${res1.statusCode}): ${res1.raw || ''} — aplicando fallback...`,
        )
      }
    }

    // Tentativa 2 / Fallback: upload no Drive próprio da conta de serviço + compartilhamento com email do usuário
    if (!tentativaSucesso) {
      var mp2 = buildMultipartBodyTrigger(
        {
          name: liveBackupRec.getString('nome_arquivo'),
          mimeType: 'application/json',
        },
        dumpJsonStr,
      )
      var res2 = $http.send({
        url: uploadUrl,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + auth.access_token,
          'Content-Type': 'multipart/related; boundary=' + mp2.boundary,
        },
        body: mp2.body,
        timeout: 120,
      })

      if (res2.statusCode === 200 || res2.statusCode === 201) {
        uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
        fileId = uploadedJson.id || ''
        tentativaSucesso = true

        var shareRes = shareFileWithUserTrigger(fileId, usuarioEmailDestino, auth.access_token)
        if (shareRes.success) {
          destinoDescricao =
            'Drive da Conta de Serviço (compartilhado com ' + usuarioEmailDestino + ')'
        } else {
          destinoDescricao =
            'Drive da Conta de Serviço (aviso compartilhamento: ' + shareRes.error + ')'
        }
      } else {
        var errDetail =
          'Erro no upload para o Google Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
        console.error(`[TRIGGER Drive] ${errDetail}`)
        const recSaveErr = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
        recSaveErr.set('drive_status', 'erro')
        recSaveErr.set('drive_erro', errDetail)
        $app.save(recSaveErr)
        return
      }
    }

    if (tentativaSucesso && fileId) {
      var agoraIso = new Date().toISOString()
      console.log(
        `[TRIGGER Drive] Sucesso! Backup ${backupId} enviado ao Drive: ${fileId} (${destinoDescricao})`,
      )
      const recSaveOk = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      recSaveOk.set('drive_status', 'enviado')
      recSaveOk.set('drive_file_id', fileId)
      recSaveOk.set('drive_folder_id', folderId || '')
      recSaveOk.set('drive_enviado_em', agoraIso)
      recSaveOk.set('drive_erro', destinoDescricao)
      $app.save(recSaveOk)

      if (configRec) {
        configRec.set('ultimo_envio', agoraIso)
        configRec.set('ultimo_status', 'conectado')
        $app.save(configRec)
      }
    }
  } catch (errTrigger) {
    console.error(`[TRIGGER Drive] Erro inesperado ao enviar backup ${backupId}:`, errTrigger)
    try {
      const recSaveExc = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
      recSaveExc.set('drive_status', 'erro')
      recSaveExc.set('drive_erro', String(errTrigger?.message || errTrigger))
      $app.save(recSaveExc)
    } catch (_) {}
  }
}, 'backups_sistema')
