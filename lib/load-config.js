const dotenv = require('dotenv')

const { decrypt } = require('./kms-helper')

const loadConfig = async () => {
  // Use `ENV` var to determine what config to load (default production):
  const env = process.env.ENV
    && ['local', 'qa', 'qa-new-domain', 'production'].includes(process.env.ENV)
    ? process.env.ENV
    : 'production'
  const envPath = `config/${env}.env`

  // Load env vars:
  dotenv.config({ path: envPath })

  // Now that we've loaded env vars, which may include LOG_LEVEL, instantiate logger:
  const logger = require('./logger')

  logger.info(`Load-config: Loaded ${envPath} for ENV '${process.env.ENV || ''}'`)

  // Identify env vars that begin with "ENCRYPTED_"
  const encryptedKeys = Object.keys(process.env)
    .filter((key) => /^ENCRYPTED_/.test(key))

  // Decrypt all encrypted env vars, setting a new decrypted env var without
  // the ENCRYPTED_ prefix:
  return Promise.all(
    encryptedKeys
      .map(async (key) => {
        const keyWithoutPrefix = key.replace(/^ENCRYPTED_/, '')
        const decrypted = await decrypt(process.env[key])
        logger.debug(`Load-config: Decrypted ${key}`)
        process.env[keyWithoutPrefix] = decrypted
      })
  )
}

module.exports = {
  loadConfig
}
