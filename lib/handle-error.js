const handleError = (error, req, res, next, logger) => {
  let statusCode = 500
  const urlInfo = req ? `${req.method} ${req.originalUrl}` : 'unknown URL'

  switch (error.name) {
    case 'InvalidParameterError':
    case 'InvalidQuerySyntaxError':
      statusCode = 422
      if (logger) logger.warn(`${urlInfo}: ${error.message}`)
      break
    case 'NotFoundError':
      statusCode = 404
      if (logger) logger.info(`${urlInfo}: ${error.message}`)
      break
    case 'IndexSearchError':
      statusCode = 400
      if (logger) logger.warn(`${urlInfo}: ${error.message}`)
      break
    default:
      statusCode = 500
      if (logger) {
        const type = error.name === 'TypeError' ? logger.LOG_TYPES.UNHANDLED_TYPE_ERROR : undefined
        logger.error(`handleError ${urlInfo}:`, { type, error })
      }
  }

  res.status(statusCode).send({
    status: statusCode,
    name: error.name,
    error: error.message || error
  })
}

module.exports = handleError
