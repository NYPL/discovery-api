const dotenv = require('dotenv')
const logger = require('./logger')

const { decrypt } = require('./kms-helper')

module.exports.loadConfig = async () => {
  // Use `ENV` var to determine what config to load (default production):
  // ECS task definition is using NODE_ENV, so we'll support that too for now
  const envTag = (process.env.ENV || process.env.NODE_ENV)
  const env = envTag &&
    ['local', 'qa', 'qa-new-domain', 'production'].includes(envTag)
    ? envTag
    : 'production'
  const envPath = `config/${env}.env`

  // Load env vars
  // Override any env vars that are already set (e.g. by ECS task definition)
  dotenv.config({ path: envPath, override: true })

  // Now that we've loaded env vars, which may include LOG_LEVEL, instantiate logger:
  logger.setLevel(process.env.LOG_LEVEL)

  logger.info(`Load-config: Loaded ${envPath} for ENV '${envTag || ''}'`)

  return await exports.decryptEncryptedConfig()
}

module.exports.decryptEncryptedConfig = () => {
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
          .catch((e) => {
            logger.error(`Load-config: Failed to decrypt ${key}`)
          })
        logger.debug(`Load-config: Decrypted ${key}`)
        process.env[keyWithoutPrefix] = decrypted
      })
  )
}
