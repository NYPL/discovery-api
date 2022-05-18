const KMS = require('aws-sdk/clients/kms')

function decrypt (encrypted) {
  return new Promise((resolve, reject) => {
    const kms = new KMS({ region: 'us-east-1' })
    kms.decrypt({ CiphertextBlob: Buffer.from(encrypted, 'base64') }, (err, data) => {
      if (err) return reject(err)

      const decrypted = data.Plaintext.toString('ascii')
      resolve(decrypted)
    })
  })
}

module.exports = { decrypt }
