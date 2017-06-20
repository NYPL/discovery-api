let logger = require('./logger')

const requiredEnvVars = {
  'SCSB_URL': process.env.SCSB_URL,
  'SCSB_API_KEY': process.env.SCSB_API_KEY,
  'ELASTICSEARCH_HOST': process.env.ELASTICSEARCH_HOST,
  'RESOURCES_INDEX': process.env.RESOURCES_INDEX
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
  logger.error(message)
  throw new Error(message)
}
