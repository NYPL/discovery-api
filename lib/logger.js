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

const PATRON_ID_KEY_PATTERN = /^patron_?id$/i
const REDACTED = '*****'

// Redacts any patronIdish key found anywhere in the log
const redactPatronId = (value, seen = new WeakSet()) => {
  if (Array.isArray(value)) return value.map((item) => redactPatronId(item, seen))
  if (value && typeof value === 'object' && !(value instanceof Error) && !(value instanceof Date) && !(value instanceof RegExp) && !Buffer.isBuffer(value)) {
    if (seen.has(value)) return value
    seen.add(value)
    return Object.entries(value).reduce((redacted, [key, val]) => {
      redacted[key] = PATRON_ID_KEY_PATTERN.test(key) ? REDACTED : redactPatronId(val, seen)
      return redacted
    }, {})
  }
  return value
}

const withRedaction = (fn) => (...args) => fn(...args.map((arg) => redactPatronId(arg)))
;['error', 'warn', 'info'].forEach((level) => {
  logger[level] = withRedaction(logger[level].bind(logger))
})

// Structured types for alarmable errors.
// Errors without a type fall through to the generic error alarm (DiscoveryApiGenericLogError).
logger.LOG_TYPES = {
  SCSB_OUTAGE: 'scsb_outage',
  ES_REJECTED_EXECUTION: 'es_rejected_execution',
  ES_TIMEOUT: 'es_timeout',
  UNHANDLED_TYPE_ERROR: 'unhandled_type_error'
}

// for testing
logger.redactPatronId = redactPatronId

module.exports = logger
