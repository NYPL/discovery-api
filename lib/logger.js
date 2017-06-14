const winston = require('winston')
winston.emitErrs = false

const logLevel = (process.env.NODE_ENV === 'production') ? 'info' : 'debug'

const logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: logLevel,
      filename: './log/discovery-api.log',
      handleExceptions: true,
      json: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false
    }),
    new winston.transports.Console({
      level: logLevel,
      handleExceptions: true,
      json: true,
      stringify: true,
      colorize: true
    })
  ],
  exitOnError: false
})

module.exports = logger
