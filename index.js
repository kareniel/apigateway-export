// implements 'Signing AWS Requests with Signature Version 4'
// @ http://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
const https = require('https')
const strftime = require('strftime')
const crypto = require('crypto')

module.exports = function (config, callback) {
  const options = getRequestOptions(config)

  https.get(options, res => {
    let str = ''

    res.on('data', data => {
      if (res.statusCode === 403) return callback(JSON.parse(data.toString()))
      str += data.toString()
    })

    res.on('end', () => {
      callback(null, str)
    })
  }).on('error', err => callback(err))
}

function getRequestOptions (config) {
  const hash = msg => crypto.createHash('sha256').update(msg).digest('hex')

  function sign (secret, msg, hex) {
    const hash = crypto.createHmac('sha256', secret).update(msg)
    return hex
      ? hash.digest('hex')
      : hash.digest()
  }

  const host = `apigateway.${config.region}.amazonaws.com`
  const service = 'apigateway'
  const algorithm = 'AWS4-HMAC-SHA256'
  const now = new Date()
  const date = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const dateISO = strftime('%Y%m%dT%H%M%SZ', date)
  const dateISONoTime = strftime('%Y%m%d', date)

  // Task 1: Create canonical request
  const signed_headers = 'host;x-amz-date'
  const canonicalRequest = 'GET' + '\n' +
    '/restapis/' + config.restApiId + '/stages/' + config.stage + '/exports/swagger' + '\n' +
    '\n' +
    'host:' + host + '\n' +
    'x-amz-date:' + dateISO + '\n' +
    '\n' +
    signed_headers + '\n' +
    hash('')

  // Task 2: Create string to sign
  const credential_scope = `${dateISONoTime}/${config.region}/${service}/aws4_request`
  const stringToSign = algorithm + '\n' +
    dateISO + '\n' +
    credential_scope + '\n' +
    hash(canonicalRequest)

  // Task 3: Calculate the signature
  const kSecret = config.aws_secret_access_key
  const kDate = sign('AWS4' + kSecret, dateISONoTime)
  const kRegion = sign(kDate, config.region)
  const kService = sign(kRegion, service)
  const kSigning = sign(kService, 'aws4_request')
  const signature = sign(kSigning, stringToSign, true)

  // Task 4: Add signing info to request options
  const authorization_header = `${algorithm} Credential=${config.aws_access_key_id}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`
  const headers = {
    'host': host,
    'x-amz-date': dateISO,
    'Accept': 'application/json',
    'Authorization': authorization_header
  }

  const options = {
    method: 'get',
    path: `/restapis/${config.restApiId}/stages/${config.stage}/exports/swagger`,
    host: host,
    headers: headers
  }

  return options
}