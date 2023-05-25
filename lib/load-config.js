const { decrypt } = require('./kms-helper')

const loadConfig = async () => {
  require('dotenv').config({ path: '.env-docker' })

  // Identify env vars that begin with "ENCRYPTED_"
  const encryptedKeys = Object.keys(process.env)
    .filter((key) => /^ENCRYPTED_/.test(key))

  const logger = require('./logger')
  // Decrypt all encrypted env vars, setting a new decrypted env var without
  // the ENCRYPTED_ prefix:
  return Promise.all(
    encryptedKeys
      .map(async (key) => {
        const keyWithoutPrefix = key.replace(/^ENCRYPTED_/, '')
        const decrypted = await decrypt(process.env[key])
        logger.debug('Load-config: Decrypted ' + key)
        process.env[keyWithoutPrefix] = decrypted
      })
  )
}

module.exports = {
  loadConfig
}
