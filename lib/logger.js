const winston = require('winston')
winston.emitErrs = false

// Log Level is set by env 'LOG_LEVEL'.
// If that's not set, it defaults to the level appropriate for NODE_ENV.
// Failing that, it's set to 'debug'.
const logLevel = process.env.LOG_LEVEL ||
  {
    production: 'info',
    test: 'error'
  }[process.env.NODE_ENV] || 'debug'

const loggerTransports = [
  new winston.transports.File({
    level: logLevel,
    filename: './log/discovery-api.log',
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
    json: false,
    formatter: (options) => {
      const outputObject = {
        level: options.level.toUpperCase(),
        message: options.message,
        timestamp: new Date().toISOString()
      }

      return JSON.stringify(Object.assign(outputObject, options.meta))
    }
  })
]

loggerTransports.push(new winston.transports.Console({
  level: logLevel,
  handleExceptions: true,
  json: true,
  stringify: true,
  colorize: true
}))

const logger = new winston.Logger({
  transports: loggerTransports,
  exitOnError: false
})

module.exports = logger
