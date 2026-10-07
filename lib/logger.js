const winston = require('winston')

// In deployed code, let's do JSON logging to enable CW JSON queries
const format = process.env.LOG_STYLE === 'json'
  ? winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
  // Locally, let's do colorized plaintext logging:
  : winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format })
  ]
})

logger.setLevel = (level) => {
  logger.level = level
}

// Structured types for alarmable errors.
// Errors without a type fall through to the generic error alarm (DiscoveryApiGenericLogError).
logger.LOG_TYPES = {
  SCSB_OUTAGE: 'scsb_outage',
  ES_REJECTED_EXECUTION: 'es_rejected_execution',
  ES_TIMEOUT: 'es_timeout',
  UNHANDLED_TYPE_ERROR: 'unhandled_type_error'
}

module.exports = logger
