const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms')

async function decrypt (encrypted) {
  const client = new KMSClient({ region: 'us-east-1' })
  const input = {
    CiphertextBlob: Buffer.from(encrypted, 'base64')
  }
  const command = new DecryptCommand(input)
  const response = await client.send(command)

  const decrypted = new TextDecoder('utf-8').decode(response.Plaintext)
  return decrypted
}

module.exports = { decrypt }
