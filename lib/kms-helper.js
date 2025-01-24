const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms')
const logger = require('./logger')

let awsCredentials

/**
*  Save AWS credentials value
*/
const setCredentials = (credentials) => {
  awsCredentials = credentials
}

async function decrypt (encrypted) {
  const config = {
    region: process.env.AWS_REGION || 'us-east-1'
  }
  // Use credentials if given (local invocations). Otherwise rely on
  // environment (deployed code):
  if (awsCredentials) {
    logger.debug('KMS decrypt using local AWS credentials')
    config.credentials = awsCredentials
  }
  const client = new KMSClient(config)
  const input = {
    CiphertextBlob: Buffer.from(encrypted, 'base64')
  }
  const command = new DecryptCommand(input)
  const response = await client.send(command)

  const decrypted = new TextDecoder('utf-8').decode(response.Plaintext)
  return decrypted
}

module.exports = { decrypt, setCredentials }
