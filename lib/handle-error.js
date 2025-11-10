const handleError = (error, req, res, next, logger) => {
  let statusCode = 500
  const urlInfo = req ? `${req.method} ${req.originalUrl}` : 'unknown URL'

  switch (error.name) {
    case 'InvalidParameterError':
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
      if (logger) logger.error(`handleError ${urlInfo}:`, error)
  }

  res.status(statusCode).send({
    status: statusCode,
    name: error.name,
    error: error.message || error
  })
}

module.exports = handleError
