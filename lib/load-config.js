const dotenv = require('dotenv')
const logger = require('./logger')
const { decrypt, setCredentials: setKmsCredentials } = require('./kms-helper')

/**
* Conditionally load AWS creds from local profile
*/
const loadAwsCreds = () => {
  if (process.env.LOCAL !== 'true') return

  logger.info('Loading AWS creds from profile')

  // This is a dev dependency, so only load when local:
  const { fromIni } = require('@aws-sdk/credential-providers')

  // Use creds from local profile when running locally:
  const creds = fromIni({ profile: 'nypl-digital-dev' })
  // Pass creds to any module that needs them here:
  setKmsCredentials(creds)
}

module.exports.loadConfig = async () => {
  loadAwsCreds()

  // ECS task definition is using NODE_ENV, so we'll support that too for now
  const envTag = (process.env.ENV || process.env.NODE_ENV)
  let env = envTag &&
    ['local', 'qa', 'qa2', 'production'].includes(envTag)
    ? envTag
    : 'production'
  // ECS task definition for qa2 has NODE_ENV=qa2, so translate that to qa:
  env = env === 'qa2' ? 'qa' : envTag
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
