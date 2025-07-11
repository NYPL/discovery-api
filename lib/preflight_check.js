const logger = require('./logger')

const requiredEnvVars = [
  'SCSB_URL',
  'SCSB_API_KEY',
  'ELASTICSEARCH_URI',
  'RESOURCES_INDEX',
  'SUBJECTS_INDEX',
  'NYPL_API_BASE_URL',
  'NYPL_OAUTH_URL',
  'NYPL_OAUTH_ID',
  'NYPL_OAUTH_SECRET'
]

const preflightCheck = () => {
  const undefinedVars = requiredEnvVars
    .filter((varName) => !process.env[varName])

  if (undefinedVars.length > 0) {
    const message = `The following ENV_VAR(S) must be defined: ${undefinedVars.join(', ')}.`
    console.log(message)
    logger.error(message)
    throw new Error(message)
  }
}

module.exports = {
  preflightCheck
}
