// Hook PocketBase para gerenciamento e automação de Backups do ERP Pedreira Cordeiro
// com Integração ao Google Drive via CONTA DE SERVIÇO (Service Account / JWT RS256 puro em JS)
// Endpoints autenticados sob /backend/v1/backups e /backend/v1/google-drive
// Cron job semanal automático via cronAdd: todo domingo às 00:30 (horário do servidor)
// Cron job da fila de envio ao Drive: reprocessamento a cada minuto com antiflood e registro garantido de erro/sucesso
// NOTA JSVM DO POCKETBASE: As callbacks rodam em pools isoladas, portanto toda função auxiliar
// deve ser estritamente declarada dentro de cada callback (inline).

// -------------------------------------------------------------
// FUNÇÃO NÚCLEO COMPARTILHADA: PROCESSAMENTO INCREMENTAL RESUMÍVEL
// Executa 1 rodada de envio (início de sessão ou envio de chunks fracionado)
// para evitar estouro de memória da JSVM (Goja) e permitir retomada automática.
// -------------------------------------------------------------
function processarBackupIncremental(backupId, logPrefixOrigem) {
  var logPrefix = (logPrefixOrigem || '[INCREMENTAL]') + '[' + backupId + ']'

  function getAccessTokenShared(serviceAccountJson, scope) {
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
      timeout: 25,
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

  function shareFileWithUserShared(fileId, userEmail, token) {
    if (!userEmail) return { success: false, error: 'Email de usuário não informado' }
    try {
      console.log(logPrefix + ' Compartilhando arquivo ' + fileId + ' com ' + userEmail + '...')
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
        timeout: 30,
      })
      if (permRes.statusCode === 200 || permRes.statusCode === 201) {
        console.log(logPrefix + ' Arquivo compartilhado com sucesso com ' + userEmail)
        return { success: true }
      }
      console.warn(
        logPrefix +
          ' Falha no compartilhamento (HTTP ' +
          permRes.statusCode +
          '): ' +
          (permRes.raw || ''),
      )
      return {
        success: false,
        error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
      }
    } catch (eShare) {
      console.error(logPrefix + ' Exceção ao compartilhar:', eShare)
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
    console.error(logPrefix + ' Backup não encontrado:', eFind)
    return { status: 'erro', erro: 'Backup não encontrado: ' + backupId }
  }

  var tentativas = backupRecord.getInt('drive_tentativas') || 0
  if (tentativas >= 5) {
    var msgMax = 'Limite de 5 tentativas excedido. Reenvio cancelado. Tente manualmente pela tela.'
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
    } catch (eCfg) {
      console.warn(logPrefix + ' config_google_drive não encontrada:', eCfg)
    }

    if (!serviceAccountJson) {
      var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
      console.warn(logPrefix + ' ' + msgSemConta)
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', msgSemConta)
      $app.save(backupRecord)
      return { status: 'erro', erro: msgSemConta }
    }

    var auth = getAccessTokenShared(
      serviceAccountJson,
      'https://www.googleapis.com/auth/drive.file',
    )

    // PASSO 1: Cálculo do tamanho total (apenas na primeira rodada ou se drive_total_bytes for 0)
    var totalBytes = backupRecord.getInt('drive_total_bytes') || 0
    var sessionUrl = backupRecord.getString('drive_session_url') || ''

    if (!totalBytes || totalBytes === 0) {
      console.log(logPrefix + ' Calculando tamanho total somando metadados e chunks individualmente...')
      var metaObj = {
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
      }
      var metaStr = JSON.stringify(metaObj)
      var headerPrefix = '{"meta":' + JSON.stringify(metaObj.meta) + ',"dados":{'
      var calcBytes = headerPrefix.length + 2 // fecha com '}}\n'

      // Consulta contagem e lista ordenada por created,id
      var allChunksMeta = $app.findRecordsByFilter(
        'backups_dados',
        "backup_id = '" + backupId + "'",
        'created,id',
        5000,
        0,
      )

      var curCol = null
      var curColCount = 0
      for (var cm = 0; cm < allChunksMeta.length; cm++) {
        var recM = allChunksMeta[cm]
        var colName = recM.getString('colecao_nome')
        var chunkJsonStr = JSON.stringify(recM.get('registros_json') || [])
        var itemsLen = 0
        if (chunkJsonStr && chunkJsonStr.length >= 2) {
          itemsLen = chunkJsonStr.length - 2 // remove '[' e ']'
        }

        if (colName !== curCol) {
          if (curCol !== null) calcBytes += 2 // '],'
          curCol = colName
          curColCount = 0
          calcBytes += JSON.stringify(colName).length + ':['
        }

        if (itemsLen > 0) {
          if (curColCount > 0) calcBytes += 1 // ','
          calcBytes += itemsLen
          curColCount++
        }
      }
      if (curCol !== null) calcBytes += 1 // ']'

      totalBytes = calcBytes
      backupRecord.set('drive_total_bytes', totalBytes)
      $app.save(backupRecord)
      console.log(logPrefix + ' Tamanho total calculado: ' + totalBytes + ' bytes (' + Math.round(totalBytes / 1024) + ' KB)')
    }

    // PASSO 2: Iniciar sessão de upload resumível se ainda não tiver sessionUrl
    if (!sessionUrl) {
      console.log(logPrefix + ' Iniciando sessão de upload resumível no Google Drive...')
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
        timeout: 30,
      })

      console.log(logPrefix + ' Resposta início sessão Drive: HTTP ' + initRes.statusCode)

      // Fallback: se pasta configurada der 403 / 404, tenta sem parents (Drive próprio da Conta de Serviço)
      if (initRes.statusCode !== 200 && folderId) {
        console.warn(logPrefix + ' Falha na pasta configurada (HTTP ' + initRes.statusCode + '), tentando sem pasta...')
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
          timeout: 30,
        })
        console.log(logPrefix + ' Resposta início sessão sem pasta: HTTP ' + initRes.statusCode)
      }

      if (initRes.statusCode !== 200) {
        var errInit = 'Falha ao iniciar sessão resumível Google Drive (HTTP ' + initRes.statusCode + '): ' + (initRes.raw || '')
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
        var errLoc = 'Google Drive não retornou header Location na sessão resumível.'
        console.error(logPrefix + ' ' + errLoc)
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
      backupRecord.set('drive_progresso_chunk', 0)
      backupRecord.set('drive_erro', '')
      $app.save(backupRecord)
      console.log(logPrefix + ' Sessão resumível criada com sucesso! URL salva.')
    }

    // PASSO 3: Consultar status de offset na Google Drive API (query resume)
    var currentOffset = backupRecord.getInt('drive_offset') || 0
    try {
      var checkRes = $http.send({
        url: sessionUrl,
        method: 'PUT',
        headers: {
          'Content-Length': '0',
          'Content-Range': 'bytes */' + totalBytes,
        },
        timeout: 25,
      })
      if (checkRes.statusCode === 308) {
        var rangeHeader = checkRes.headers?.['Range'] || checkRes.headers?.['range']
        if (Array.isArray(rangeHeader)) rangeHeader = rangeHeader[0]
        if (rangeHeader && typeof rangeHeader === 'string') {
          var matchRange = rangeHeader.match(/bytes=0-(\d+)/)
          if (matchRange && matchRange[1]) {
            currentOffset = parseInt(matchRange[1], 10) + 1
            backupRecord.set('drive_offset', currentOffset)
            console.log(logPrefix + ' Google Drive confirmou bytes recebidos até: ' + currentOffset)
          }
        }
      } else if (checkRes.statusCode === 200 || checkRes.statusCode === 201) {
        // Já concluído!
        var dataConcluido = checkRes.json || JSON.parse(checkRes.raw || '{}')
        var fileIdPronto = dataConcluido.id || ''
        console.log(logPrefix + ' Arquivo já concluído no Drive! File ID: ' + fileIdPronto)
        shareFileWithUserShared(fileIdPronto, usuarioEmailDestino, auth.access_token)
        var agoraIso = new Date().toISOString()
        backupRecord.set('drive_status', 'enviado')
        backupRecord.set('drive_file_id', fileIdPronto)
        backupRecord.set('drive_enviado_em', agoraIso)
        backupRecord.set('drive_offset', totalBytes)
        backupRecord.set('drive_erro', 'Concluído com sucesso')
        $app.save(backupRecord)
        return { status: 'concluido', file_id: fileIdPronto }
      }
    } catch (eCheck) {
      console.warn(logPrefix + ' Aviso ao consultar status do upload resumível:', eCheck)
    }

    // PASSO 4: Envio de fatia fracionada (máx 15 chunks ou ~1.5MB por rodada)
    var CHUNKS_POR_RODADA = 15
    var chunkIndexStart = backupRecord.getInt('drive_progresso_chunk') || 0

    // Carrega apenas os chunks desta rodada usando paginação no banco
    var chunksRodada = $app.findRecordsByFilter(
      'backups_dados',
      "backup_id = '" + backupId + "'",
      'created,id',
      CHUNKS_POR_RODADA,
      chunkIndexStart,
    )

    console.log(
      logPrefix +
        ' Lendo fatia de chunks: de ' +
        chunkIndexStart +
        ' a ' +
        (chunkIndexStart + chunksRodada.length) +
        ' (offset atual: ' +
        currentOffset +
        '/' +
        totalBytes +
        ')',
    )

    // Se não há mais chunks no banco mas ainda faltam bytes (fechamento do JSON)
    var bufferStr = ''
    var isPrimeiraFatia = chunkIndexStart === 0
    var isUltimaFatia = chunksRodada.length < CHUNKS_POR_RODADA

    if (isPrimeiraFatia) {
      var metaObjInicio = {
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
      }
      bufferStr += '{"meta":' + JSON.stringify(metaObjInicio.meta) + ',"dados":{'
    }

    var colAnterior = null
    for (var cr = 0; cr < chunksRodada.length; cr++) {
      var rChunk = chunksRodada[cr]
      var nomeC = rChunk.getString('colecao_nome')
      var rJson = JSON.stringify(rChunk.get('registros_json') || [])
      var semBrackets = rJson.length >= 2 ? rJson.slice(1, -1) : ''

      if (nomeC !== colAnterior) {
        if (colAnterior !== null) bufferStr += '],'
        else if (!isPrimeiraFatia && cr === 0) bufferStr += '],'
        bufferStr += JSON.stringify(nomeC) + ':['
        colAnterior = nomeC
      } else {
        if (semBrackets.length > 0) bufferStr += ','
      }
      bufferStr += semBrackets
    }

    if (isUltimaFatia) {
      if (colAnterior !== null || !isPrimeiraFatia) bufferStr += ']'
      bufferStr += '}}\n'
    }

    // Se o buffer estiver vazio e ainda não concluiu
    if (bufferStr.length === 0 && !isUltimaFatia) {
      bufferStr = ' '
    }

    var chunkLen = bufferStr.length
    var chunkEnd = currentOffset + chunkLen - 1
    // Ajuste se ultrapassar ou for a fatia final
    if (isUltimaFatia || chunkEnd >= totalBytes - 1) {
      chunkEnd = totalBytes - 1
      chunkLen = chunkEnd - currentOffset + 1
      bufferStr = bufferStr.slice(0, chunkLen)
    }

    var contentRangeHeader = 'bytes ' + currentOffset + '-' + chunkEnd + '/' + totalBytes
    console.log(
      logPrefix +
        ' Enviando fatia HTTP PUT: Content-Range: ' +
        contentRangeHeader +
        ' (' +
        chunkLen +
        ' bytes)...',
    )

    var putRes = $http.send({
      url: sessionUrl,
      method: 'PUT',
      headers: {
        'Content-Length': String(chunkLen),
        'Content-Range': contentRangeHeader,
      },
      body: bufferStr,
      timeout: 120,
    })

    console.log(logPrefix + ' Resposta fatia: HTTP ' + putRes.statusCode)

    if (putRes.statusCode === 308) {
      // Chunk aceito, upload incompleto (comportamento esperado da API)
      var novoOffset = chunkEnd + 1
      var rangeResp = putRes.headers?.['Range'] || putRes.headers?.['range']
      if (Array.isArray(rangeResp)) rangeResp = rangeResp[0]
      if (rangeResp && typeof rangeResp === 'string') {
        var mR = rangeResp.match(/bytes=0-(\d+)/)
        if (mR && mR[1]) novoOffset = parseInt(mR[1], 10) + 1
      }

      backupRecord.set('drive_status', 'enviando')
      backupRecord.set('drive_offset', novoOffset)
      backupRecord.set('drive_progresso_chunk', chunkIndexStart + chunksRodada.length)
      backupRecord.set('drive_erro', '')
      $app.save(backupRecord)

      console.log(
        logPrefix +
          ' Progresso salvo com sucesso! Novo offset: ' +
          novoOffset +
          '/' +
          totalBytes +
          ' (' +
          Math.round((novoOffset / totalBytes) * 100) +
          '%). Próximo cron continuará.',
      )
      return {
        status: 'enviando',
        offset: novoOffset,
        total: totalBytes,
        porcentagem: Math.round((novoOffset / totalBytes) * 100),
      }
    } else if (putRes.statusCode === 200 || putRes.statusCode === 201) {
      // Conclusão com sucesso!
      var jsonFinal = putRes.json || JSON.parse(putRes.raw || '{}')
      var finalFileId = jsonFinal.id || ''
      console.log(logPrefix + ' UPLOAD CONCLUÍDO COM SUCESSO! File ID: ' + finalFileId)

      // Compartilhar com o usuário
      var destinoInfo = 'Drive da Conta de Serviço'
      var shareOk = shareFileWithUserShared(finalFileId, usuarioEmailDestino, auth.access_token)
      if (shareOk.success) {
        destinoInfo += ' (compartilhado com ' + usuarioEmailDestino + ')'
      } else {
        destinoInfo += ' (aviso compartilhamento: ' + shareOk.error + ')'
      }

      var dataFimIso = new Date().toISOString()
      backupRecord.set('drive_status', 'enviado')
      backupRecord.set('drive_file_id', finalFileId)
      backupRecord.set('drive_enviado_em', dataFimIso)
      backupRecord.set('drive_offset', totalBytes)
      backupRecord.set('drive_erro', destinoInfo)
      $app.save(backupRecord)

      if (configRec) {
        configRec.set('ultimo_envio', dataFimIso)
        configRec.set('ultimo_status', 'conectado')
        $app.save(configRec)
      }

      return {
        status: 'enviado',
        file_id: finalFileId,
        destino: destinoInfo,
      }
    } else {
      var errChunk =
        'Falha no envio de fatia ao Google Drive (HTTP ' +
        putRes.statusCode +
        '): ' +
        (putRes.raw || '').slice(0, 300)
      console.error(logPrefix + ' ' + errChunk)
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', errChunk)
      backupRecord.set('drive_tentativas', tentativas + 1)
      $app.save(backupRecord)
      return { status: 'erro', erro: errChunk }
    }
  } catch (errExec) {
    var msgErr = 'Exceção no processamento incremental: ' + String(errExec?.message || errExec)
    console.error(logPrefix + ' ' + msgErr)
    try {
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', msgErr)
      backupRecord.set('drive_tentativas', tentativas + 1)
      $app.save(backupRecord)
    } catch (_) {}
    return { status: 'erro', erro: msgErr }
  }
}

// -------------------------------------------------------------
// 1. ENDPOINT ADMINISTRATIVO / MANUAL: PROCESSAR SOLICITADOS DRIVE
// GET /backend/v1/backups/processar-solicitados-drive
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/backups/processar-solicitados-drive', (e) => {
  var pending = $app.findRecordsByFilter(
    'backups_sistema',
    "drive_status = 'solicitado' || drive_status = 'enviando'",
    '-created',
    3,
    0,
  )

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

REMOVED_DUPLICATE_MONOLITHIC_CODE */
/* REMOVED_DUPLICATE_MONOLITHIC_CODE      var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
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
        timeout: 25,
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
        console.log(logPrefix + ' Compartilhando arquivo ' + fileId + ' com ' + userEmail + '...')
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
          timeout: 30,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          console.log(logPrefix + ' Arquivo compartilhado com sucesso com ' + userEmail)
          return { success: true }
        }
        console.warn(
          logPrefix +
            ' Falha no compartilhamento (HTTP ' +
            permRes.statusCode +
            '): ' +
            (permRes.raw || ''),
        )
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
        console.error(logPrefix + ' Exceção ao compartilhar:', eShare)
        return {
          success: false,
          error: String(eShare?.message || eShare),
        }
      }
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
      } catch (eCfg) {
        console.warn(logPrefix + ' config_google_drive não encontrada:', eCfg)
      }

      if (!serviceAccountJson) {
        var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        resultado.push({ id: backupId, erro: msgSemConta })
        continue
      }

      console.log(logPrefix + ' Autenticando via Conta de Serviço JWT RS256...')
      var auth
      try {
        auth = getAccessTokenHelper(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
        )
        console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
      } catch (authErr) {
        var msgAuth = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
        console.error(logPrefix + ' ' + msgAuth)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgAuth)
        $app.save(backupRecord)
        resultado.push({ id: backupId, erro: msgAuth })
        continue
      }

      console.log(logPrefix + ' Carregando chunks da coleção backups_dados...')
      var chunks = $app.findRecordsByFilter(
        'backups_dados',
        "backup_id = '" + backupId + "'",
        'colecao_nome,chunk_index',
        5000,
        0,
      )
      console.log(logPrefix + ' Total de chunks encontrados: ' + chunks.length)

      var colecoes = {}
      for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i]
        var col = ch.getString('colecao_nome')
        var items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (var k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      var dumpJsonStr = JSON.stringify({
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
      })

      console.log(
        logPrefix +
          ' Dump montado. Tamanho: ' +
          Math.round(dumpJsonStr.length / 1024) +
          ' KB (' +
          backupRecord.getInt('total_registros') +
          ' registros).',
      )

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var tentativaSucesso = false

      if (folderId) {
        console.log(logPrefix + ' Tentativa 1: Upload na pasta configurada (' + folderId + ')...')
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta da pasta configurada: HTTP ' + res1.statusCode)
        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          tentativaSucesso = true
        } else {
          var erro1Corpo = (res1.raw || '').slice(0, 300)
          console.warn(
            logPrefix +
              ' Upload na pasta configurada falhou (HTTP ' +
              res1.statusCode +
              '): ' +
              erro1Corpo +
              ' — aplicando fallback...',
          )
        }
      }

      if (!tentativaSucesso) {
        console.log(
          logPrefix + ' Tentativa 2: Upload no Drive próprio da Conta de Serviço (fallback)...',
        )
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta tentativa 2: HTTP ' + res2.statusCode)
        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          console.log(logPrefix + ' Upload concluído! File ID: ' + fileId)
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
            'Erro no envio ao Google Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          console.error(logPrefix + ' ' + errDetail)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          resultado.push({ id: backupId, erro: errDetail })
          continue
        }
      }

      if (tentativaSucesso && fileId) {
        var agoraIso = new Date().toISOString()
        console.log(logPrefix + ' Sucesso! File ID: ' + fileId + ' (' + destinoDescricao + ')')
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
      console.error(logPrefix + ' Exceção não tratada:', errOne)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', 'Exceção interna: ' + String(errOne?.message || errOne))
        $app.save(backupRecord)
      } catch (_) {}
      resultado.push({ id: backupId, erro: String(errOne?.message || errOne) })
    }
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
// Executa a cada minuto de forma incremental e segura para a memória da JSVM.
// -------------------------------------------------------------
cronAdd('backup_processador_fila_solicitados', '*/1 * * * *', () => {
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

  if (!pending || pending.length === 0) {
    return
  }

  console.log('[CRON FILA DRIVE] Encontrados ' + pending.length + ' backup(s) na fila do Drive.')

  for (var idx = 0; idx < pending.length; idx++) {
    var backupRecord = pending[idx]
    var backupId = backupRecord.id
    console.log('[CRON_FILA][' + backupId + '] Processando rodada incremental...')
    processarBackupIncremental(backupId, '[CRON_FILA]')
  }
})

    function getAccessTokenHelperCron(serviceAccountJson, scope) {
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
        timeout: 25,
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
        console.log(logPrefix + ' Compartilhando arquivo ' + fileId + ' com ' + userEmail + '...')
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
          timeout: 30,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          console.log(logPrefix + ' Arquivo compartilhado com sucesso com ' + userEmail)
          return { success: true }
        }
        console.warn(
          logPrefix +
            ' Falha no compartilhamento (HTTP ' +
            permRes.statusCode +
            '): ' +
            (permRes.raw || ''),
        )
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
        console.error(logPrefix + ' Exceção ao compartilhar:', eShare)
        return {
          success: false,
          error: String(eShare?.message || eShare),
        }
      }
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
      } catch (eCfg) {
        console.warn(logPrefix + ' config_google_drive não encontrada:', eCfg)
      }

      if (!serviceAccountJson) {
        var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
        console.warn(logPrefix + ' ' + msgSemConta)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        continue
      }

      console.log(logPrefix + ' Autenticando via Conta de Serviço JWT RS256...')
      var auth
      try {
        auth = getAccessTokenHelperCron(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
        )
        console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
      } catch (authErr) {
        var msgAuth = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
        console.error(logPrefix + ' ' + msgAuth)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgAuth)
        $app.save(backupRecord)
        continue
      }

      console.log(logPrefix + ' Carregando chunks da coleção backups_dados...')
      var chunks = $app.findRecordsByFilter(
        'backups_dados',
        "backup_id = '" + backupId + "'",
        'colecao_nome,chunk_index',
        5000,
        0,
      )
      console.log(logPrefix + ' Total de chunks encontrados: ' + chunks.length)

      var colecoes = {}
      for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i]
        var col = ch.getString('colecao_nome')
        var items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (var k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      var dumpJsonStr = JSON.stringify({
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
      })

      console.log(
        logPrefix +
          ' Dump montado. Tamanho: ' +
          Math.round(dumpJsonStr.length / 1024) +
          ' KB (' +
          backupRecord.getInt('total_registros') +
          ' registros).',
      )

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var tentativaSucesso = false

      if (folderId) {
        console.log(logPrefix + ' Tentativa 1: Upload na pasta configurada (' + folderId + ')...')
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta da pasta configurada: HTTP ' + res1.statusCode)
        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          tentativaSucesso = true
        } else {
          var erro1Corpo = (res1.raw || '').slice(0, 300)
          console.warn(
            logPrefix +
              ' Upload na pasta configurada falhou (HTTP ' +
              res1.statusCode +
              '): ' +
              erro1Corpo +
              ' — aplicando fallback...',
          )
        }
      }

      if (!tentativaSucesso) {
        console.log(
          logPrefix + ' Tentativa 2: Upload no Drive próprio da Conta de Serviço (fallback)...',
        )
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta tentativa 2: HTTP ' + res2.statusCode)
        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          console.log(logPrefix + ' Upload concluído! File ID: ' + fileId)
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
            'Erro no envio ao Google Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
          console.error(logPrefix + ' ' + errDetail)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          continue
        }
      }

      if (tentativaSucesso && fileId) {
        var agoraIso = new Date().toISOString()
        console.log(logPrefix + ' Sucesso! File ID: ' + fileId + ' (' + destinoDescricao + ')')
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
      console.error(logPrefix + ' Exceção não tratada:', errOne)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', 'Exceção interna: ' + String(errOne?.message || errOne))
        $app.save(backupRecord)
      } catch (_) {}
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
    // Marca drive_status como 'solicitado' para a fila de envio processar de forma segura
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

    var logPrefix = '[API_MANUAL][' + backupId + ']'
    console.log(logPrefix + ' Disparando envio manual para backup: ' + backupId)

    function getAccessTokenHelperManual(serviceAccountJson, scope) {
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
        timeout: 25,
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
        console.log(logPrefix + ' Compartilhando arquivo ' + fileId + ' com ' + userEmail + '...')
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
          timeout: 30,
        })
        if (permRes.statusCode === 200 || permRes.statusCode === 201) {
          console.log(logPrefix + ' Arquivo compartilhado com sucesso com ' + userEmail)
          return { success: true }
        }
        console.warn(
          logPrefix +
            ' Falha no compartilhamento (HTTP ' +
            permRes.statusCode +
            '): ' +
            (permRes.raw || ''),
        )
        return {
          success: false,
          error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
        }
      } catch (eShare) {
        console.error(logPrefix + ' Exceção ao compartilhar:', eShare)
        return {
          success: false,
          error: String(eShare?.message || eShare),
        }
      }
    }

    var backupRecord = null
    try {
      backupRecord = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
    } catch (eBkp) {
      return e.json(404, { error: 'Backup não encontrado: ' + backupId })
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
      } catch (eCfg) {
        console.warn(logPrefix + ' config_google_drive não encontrada:', eCfg)
      }

      if (!serviceAccountJson) {
        var msgSemConta =
          'Conta de Serviço Google Drive não configurada no ERP (cole o JSON da chave na tela de Backups).'
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgSemConta)
        $app.save(backupRecord)
        return e.json(400, { error: msgSemConta })
      }

      console.log(logPrefix + ' Autenticando via Conta de Serviço JWT RS256...')
      var auth
      try {
        auth = getAccessTokenHelperManual(
          serviceAccountJson,
          'https://www.googleapis.com/auth/drive.file',
        )
        console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
      } catch (authErr) {
        var msgAuth = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
        console.error(logPrefix + ' ' + msgAuth)
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', msgAuth)
        $app.save(backupRecord)
        return e.json(400, { error: msgAuth })
      }

      console.log(logPrefix + ' Carregando chunks da coleção backups_dados...')
      var chunks = $app.findRecordsByFilter(
        'backups_dados',
        "backup_id = '" + backupId + "'",
        'colecao_nome,chunk_index',
        5000,
        0,
      )
      console.log(logPrefix + ' Total de chunks encontrados: ' + chunks.length)

      var colecoes = {}
      for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i]
        var col = ch.getString('colecao_nome')
        var items = ch.get('registros_json') || []
        if (!colecoes[col]) colecoes[col] = []
        if (Array.isArray(items)) {
          for (var k = 0; k < items.length; k++) {
            colecoes[col].push(items[k])
          }
        }
      }

      var dumpJsonStr = JSON.stringify({
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
      })

      console.log(
        logPrefix +
          ' Dump montado. Tamanho: ' +
          Math.round(dumpJsonStr.length / 1024) +
          ' KB (' +
          backupRecord.getInt('total_registros') +
          ' registros).',
      )

      var uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
      var uploadedJson = null
      var fileId = ''
      var destinoDescricao = ''
      var mensagemRetorno = ''
      var tentativaSucesso = false

      if (folderId) {
        console.log(logPrefix + ' Tentativa 1: Upload na pasta configurada (' + folderId + ')...')
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta da pasta configurada: HTTP ' + res1.statusCode)
        if (res1.statusCode === 200 || res1.statusCode === 201) {
          uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
          fileId = uploadedJson.id || ''
          destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
          mensagemRetorno = 'Backup enviado com sucesso ao Google Drive na pasta configurada!'
          tentativaSucesso = true
        } else {
          var erro1Corpo = (res1.raw || '').slice(0, 300)
          console.warn(
            logPrefix +
              ' Upload na pasta configurada falhou (HTTP ' +
              res1.statusCode +
              '): ' +
              erro1Corpo +
              ' — aplicando fallback...',
          )
        }
      }

      if (!tentativaSucesso) {
        console.log(
          logPrefix + ' Tentativa 2: Upload no Drive próprio da Conta de Serviço (fallback)...',
        )
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
          timeout: 180,
        })

        console.log(logPrefix + ' Resposta tentativa 2: HTTP ' + res2.statusCode)
        if (res2.statusCode === 200 || res2.statusCode === 201) {
          uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
          fileId = uploadedJson.id || ''
          tentativaSucesso = true

          console.log(logPrefix + ' Upload concluído! File ID: ' + fileId)
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
          console.error(logPrefix + ' ' + errDetail)
          backupRecord.set('drive_status', 'erro')
          backupRecord.set('drive_erro', errDetail)
          $app.save(backupRecord)
          return e.json(500, { error: errDetail })
        }
      }

      if (tentativaSucesso && fileId) {
        var agoraIso = new Date().toISOString()
        console.log(logPrefix + ' Sucesso! File ID: ' + fileId + ' (' + destinoDescricao + ')')
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

        return e.json(200, {
          success: true,
          message: mensagemRetorno,
          file_id: fileId,
          folder_id: folderId || '',
          destino: destinoDescricao,
          enviado_em: agoraIso,
        })
      }

      var msgInesperada =
        'Processamento do Google Drive concluído sem identificador de arquivo retornado.'
      backupRecord.set('drive_status', 'erro')
      backupRecord.set('drive_erro', msgInesperada)
      $app.save(backupRecord)
      return e.json(500, { error: msgInesperada })
    } catch (errGeral) {
      var errMsg = String(errGeral?.message || errGeral)
      console.error(logPrefix + ' Exceção não tratada:', errGeral)
      try {
        backupRecord.set('drive_status', 'erro')
        backupRecord.set('drive_erro', 'Exceção interna ao enviar: ' + errMsg)
        $app.save(backupRecord)
      } catch (_) {}
      return e.json(500, { error: errMsg })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 12. TRIGGER REATIVO: onRecordUpdate em backups_sistema
// Dispara o envio ao Google Drive quando drive_status === "solicitado"
// -------------------------------------------------------------
onRecordUpdate((e) => {
  e.next()

  var rec = e.record
  if (!rec) return

  var statusAtual = rec.getString('drive_status')
  if (statusAtual !== 'solicitado') return

  var backupId = rec.id
  console.log('[TRIGGER_UPDATE][' + backupId + "] Backup marcado como 'solicitado'. Iniciando processamento incremental...")
  processarBackupIncremental(backupId, '[TRIGGER_UPDATE]')
}, 'backups_sistema')
/* FIM HOOKS BACKUP */
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
      timeout: 25,
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
      console.log(logPrefix + ' Compartilhando arquivo ' + fileId + ' com ' + userEmail + '...')
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
        timeout: 30,
      })
      if (permRes.statusCode === 200 || permRes.statusCode === 201) {
        console.log(logPrefix + ' Arquivo compartilhado com sucesso com ' + userEmail)
        return { success: true }
      }
      console.warn(
        logPrefix +
          ' Falha no compartilhamento (HTTP ' +
          permRes.statusCode +
          '): ' +
          (permRes.raw || ''),
      )
      return {
        success: false,
        error: 'HTTP ' + permRes.statusCode + ': ' + (permRes.raw || ''),
      }
    } catch (eShare) {
      console.error(logPrefix + ' Exceção ao compartilhar:', eShare)
      return {
        success: false,
        error: String(eShare?.message || eShare),
      }
    }
  }

  var liveRec = null
  try {
    liveRec = $app.findFirstRecordByData('backups_sistema', 'id', backupId)
  } catch (eBkp) {
    console.error(logPrefix + ' Backup não encontrado na coleção backups_sistema:', eBkp)
    return
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
    } catch (eCfg) {
      console.warn(logPrefix + ' config_google_drive não encontrada:', eCfg)
    }

    if (!serviceAccountJson) {
      var msgSemConta = 'Conta de Serviço Google Drive não configurada no ERP.'
      console.warn(logPrefix + ' ' + msgSemConta)
      liveRec.set('drive_status', 'erro')
      liveRec.set('drive_erro', msgSemConta)
      $app.save(liveRec)
      return
    }

    console.log(logPrefix + ' Autenticando via Conta de Serviço JWT RS256...')
    var auth
    try {
      auth = getAccessTokenHelperTrigger(
        serviceAccountJson,
        'https://www.googleapis.com/auth/drive.file',
      )
      console.log(logPrefix + ' Token obtido com sucesso para: ' + auth.client_email)
    } catch (authErr) {
      var msgAuth = 'Falha na autenticação da Conta de Serviço: ' + (authErr?.message || authErr)
      console.error(logPrefix + ' ' + msgAuth)
      liveRec.set('drive_status', 'erro')
      liveRec.set('drive_erro', msgAuth)
      $app.save(liveRec)
      return
    }

    console.log(logPrefix + ' Carregando chunks da coleção backups_dados...')
    var chunks = $app.findRecordsByFilter(
      'backups_dados',
      "backup_id = '" + backupId + "'",
      'colecao_nome,chunk_index',
      5000,
      0,
    )
    console.log(logPrefix + ' Total de chunks encontrados: ' + chunks.length)

    var colecoes = {}
    for (var i = 0; i < chunks.length; i++) {
      var ch = chunks[i]
      var col = ch.getString('colecao_nome')
      var items = ch.get('registros_json') || []
      if (!colecoes[col]) colecoes[col] = []
      if (Array.isArray(items)) {
        for (var k = 0; k < items.length; k++) {
          colecoes[col].push(items[k])
        }
      }
    }

    var dumpJsonStr = JSON.stringify({
      meta: {
        id: liveRec.id,
        nome_arquivo: liveRec.getString('nome_arquivo'),
        tipo: liveRec.getString('tipo'),
        origem: liveRec.getString('origem') || 'manual',
        total_colecoes: liveRec.getInt('total_colecoes'),
        total_registros: liveRec.getInt('total_registros'),
        resumo_colecoes: liveRec.get('resumo_colecoes'),
        created: liveRec.getString('created'),
        exportado_em: new Date().toISOString(),
        sistema: 'Pedreira Cordeiro ERP (NovaGest)',
      },
      dados: colecoes,
    })

    console.log(
      logPrefix +
        ' Dump montado. Tamanho: ' +
        Math.round(dumpJsonStr.length / 1024) +
        ' KB (' +
        liveRec.getInt('total_registros') +
        ' registros).',
    )

    var uploadUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
    var uploadedJson = null
    var fileId = ''
    var destinoDescricao = ''
    var tentativaSucesso = false

    if (folderId) {
      console.log(logPrefix + ' Tentativa 1: Upload na pasta configurada (' + folderId + ')...')
      var mp1 = buildMultipartBody(
        {
          name: liveRec.getString('nome_arquivo'),
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
        timeout: 180,
      })

      console.log(logPrefix + ' Resposta da pasta configurada: HTTP ' + res1.statusCode)
      if (res1.statusCode === 200 || res1.statusCode === 201) {
        uploadedJson = res1.json || JSON.parse(res1.raw || '{}')
        fileId = uploadedJson.id || ''
        destinoDescricao = 'pasta configurada no Drive (' + folderId + ')'
        tentativaSucesso = true
      } else {
        var erro1Corpo = (res1.raw || '').slice(0, 300)
        console.warn(
          logPrefix +
            ' Upload na pasta configurada falhou (HTTP ' +
            res1.statusCode +
            '): ' +
            erro1Corpo +
            ' — aplicando fallback...',
        )
      }
    }

    if (!tentativaSucesso) {
      console.log(
        logPrefix + ' Tentativa 2: Upload no Drive próprio da Conta de Serviço (fallback)...',
      )
      var mp2 = buildMultipartBody(
        {
          name: liveRec.getString('nome_arquivo'),
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
        timeout: 180,
      })

      console.log(logPrefix + ' Resposta tentativa 2: HTTP ' + res2.statusCode)
      if (res2.statusCode === 200 || res2.statusCode === 201) {
        uploadedJson = res2.json || JSON.parse(res2.raw || '{}')
        fileId = uploadedJson.id || ''
        tentativaSucesso = true

        console.log(logPrefix + ' Upload concluído! File ID: ' + fileId)
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
          'Erro no envio ao Google Drive (HTTP ' + res2.statusCode + '): ' + (res2.raw || '')
        console.error(logPrefix + ' ' + errDetail)
        liveRec.set('drive_status', 'erro')
        liveRec.set('drive_erro', errDetail)
        $app.save(liveRec)
        return
      }
    }

    if (tentativaSucesso && fileId) {
      var agoraIso = new Date().toISOString()
      console.log(logPrefix + ' Sucesso! File ID: ' + fileId + ' (' + destinoDescricao + ')')
      liveRec.set('drive_status', 'enviado')
      liveRec.set('drive_file_id', fileId)
      liveRec.set('drive_folder_id', folderId || '')
      liveRec.set('drive_enviado_em', agoraIso)
      liveRec.set('drive_erro', destinoDescricao)
      $app.save(liveRec)

      if (configRec) {
        configRec.set('ultimo_envio', agoraIso)
        configRec.set('ultimo_status', 'conectado')
        $app.save(configRec)
      }
    }
  } catch (errTrigger) {
    console.error(logPrefix + ' Exceção não tratada:', errTrigger)
    try {

