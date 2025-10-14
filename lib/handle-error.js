const handleError = (error, req, res, next, logger) => {
  let statusCode = 500

  switch (error.name) {
    case 'InvalidParameterError':
      statusCode = 422
      break
    case 'NotFoundError':
      statusCode = 404
      if (logger) logger.info(error.message)
      break
    case 'IndexSearchError':
      statusCode = 400
      if (logger) logger.warn(`Responding with 400: ${error.message}`)
      break
    default:
      statusCode = 500
      if (logger) logger.error('handleError:', error)
  }

  res.status(statusCode).send({
    status: statusCode,
    name: error.name,
    error: error.message || error
  })
}

module.exports = handleError
