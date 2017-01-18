// implements 'Signing AWS Requests with Signature Version 4'
// @ http://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html

const strftime = require('strftime')
const crypto = require('crypto')
  
module.exports = function (config, callback) {
  https.get(getRequestOptions(config), res => {
    let str = ''
    res.on('error', err => callback(err))
    res.on('data', data => str += data)
    res.on('end', () => callback(null, JSON.parse(str)))
  })
}

function getRequestOptions (config) {
  const hash = msg => crypto.createHash('sha256').update(msg).digest('hex')
  const sign = (secret, msg, hex) => {
    const hash = crypto.createHmac('sha256', secret).update(msg)
    return hex
      ? hash.digest('hex')
      : hash.digest().toString()
  }

  const host = `apigateway.${config.region}.amazonaws.com`
  const service = 'apigateway'
  const algorithm = 'AWS4-HMAC-SHA256'
  const date = new Date()

  // Task 1: Create canonical request
  const signed_headers = 'host;x-amz-date'
  const canonicalRequest = `GET
  /restapis/${config.restApiId}/stages/${config.stage}/exports/swagger

  host:${host}
  x-amz-date: ${strftime('%Y%m%dT%H%M%SZ', date)}
  ${signed_headers}
  ${hash('')}
  `

  // Task 2: Create string to sign

  const credential_scope = `${strftime('%Y%m%d', date)}/${config.region}/${service}/aws4_request`
  const stringToSign = `${algorithm}
  ${strftime('%Y%m%dT%H%M%SZ', date)}
  ${credential_scope}
  ${hash(canonicalRequest)}
  `

  // Task 3: Calculate the signature

  const kSecret = config.aws_secret_access_key
  const kDate = sign(`AWS4${kSecret}`, strftime('%Y%m%d', date))
  const kRegion = sign(kDate, config.region)
  const kService = sign(kRegion, service)
  const kSigning = sign(kService, 'aws4_request')
  const signature = sign(kSigning, stringToSign, true)

  // Task 4: Add signing info to request options

  const authorization_header = `${algorithm} Credential=${config.aws_access_key_id}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`

  const headers = {
    'host': host,
    'x-amz-date': strftime('%Y%m%dT%H%M%SZ', date),
    'Authorization': authorization_header
  }

  const options = {
    protocol: 'https',
    method: 'get',
    path: `/restapis/${config.restApiId}/stages/${stage}/exports/swagger`,
    host: host,
    headers: headers
  }

  return options
}
