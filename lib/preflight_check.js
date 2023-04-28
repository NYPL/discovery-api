let logger = require('./logger')

const requiredEnvVars = [
  'SCSB_URL',
  'SCSB_API_KEY',
  'ELASTICSEARCH_URI',
  'RESOURCES_INDEX',
  'NYPL_API_BASE_URL',
  'NYPL_OAUTH_URL',
  'NYPL_OAUTH_ID',
  'NYPL_OAUTH_SECRET',
]

const undefinedVars = requiredEnvVars.reduce((undefinedVars, varName) => {
  if (!process.env[varName]) {
    undefinedVars.push(varName)
  }
  return undefinedVars
}, [])

if (undefinedVars.length > 0) {
  let message = `The following ENV_VAR(S) must be defined: ${undefinedVars.join(', ')}.`
  console.log(message)
  logger.error(message)
  throw new Error(message)
}
