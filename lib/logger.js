const winston = require('winston')

// In deployed code, let's do JSON logging to enable CW JSON queries
const format = process.env.LOG_STYLE === 'json'
  ? winston.format.json()
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

module.exports = logger
