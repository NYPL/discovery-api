let logger = require('./logger')

const requiredEnvVars = {
  'SCSB_URL': process.env.SCSB_URL,
  'SCSB_API_KEY': process.env.SCSB_API_KEY,
  'ELASTICSEARCH_HOST': process.env.ELASTICSEARCH_HOST,
  'RESOURCES_INDEX': process.env.RESOURCES_INDEX,
  'NYPL_API_BASE_URL': process.env.NYPL_API_BASE_URL,
  'NYPL_OAUTH_URL': process.env.NYPL_OAUTH_URL,
  'NYPL_OAUTH_ID': process.env.NYPL_OAUTH_ID,
  'NYPL_OAUTH_SECRET': process.env.NYPL_OAUTH_SECRET
}

let undefinedVars = []

for (let varName in requiredEnvVars) {
  // undefined and emptystring are False-y in JavaScript
  if (!requiredEnvVars[varName]) {
    undefinedVars.push(varName)
  }
}

if (undefinedVars.length > 0) {
  let message = `The following ENV_VAR(S) must be defined: ${undefinedVars.join(', ')}.`
  console.log(message)
  logger.error(message)
  throw new Error(message)
}
