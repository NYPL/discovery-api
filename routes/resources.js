const VER = '0.1'

module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    app.baseUrl = `http${req.secure ? 's' : ''}://${req.get('host')}/api/v${VER}/discovery`
    next()
  })

  const respond = (res, _resp, params) => {
    let contentType = 'application/ld+json'
    if (params.ext === 'ntriples') contentType = 'text/plain'

    let resp = _resp
    if (contentType !== 'text/plain') resp = JSON.stringify(_resp, null, 2)

    res.type(contentType)
    res.status(200).send(resp)
    return true
  }

  const handleError = (res, error, params) => {
    let statusCode = 500
    switch (error.name) {
      case 'InvalidParameterError':
        statusCode = 422
        break
      case 'NotFoundError':
        statusCode = 404
        app.logger.info(error.message)
        break
      default:
        statusCode = 500
        app.logger.error('Resources#handleError:', error)
    }
    res.status(statusCode).send({ status: statusCode, name: error.name, error: error.message ? error.message : error })
    return false
  }

  app.get(`/api/v${VER}/discovery/resources$`, function (req, res) {
    const params = req.query

    return app.resources.search(params, { baseUrl: app.baseUrl }, req)
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/discovery/resources/aggregations`, function (req, res) {
    const params = req.query

    return app.resources.aggregations(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/discovery/resources/aggregation/:field`, function (req, res) {
    const params = req.query

    return app.resources.aggregation(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  /*
   * Return items with `deliveryLocation`s matching the supplied barcodes
   *
   * For example, to fetch Delivery Locations for item barcodes 12345, 45678, and 78910:
   *   /api/v${VER}/request/deliveryLocationsByBarcode?barcodes[]=12345&barcodes[]=45678&barcodes=[]=78910
   */
  app.get(`/api/v${VER}/request/deliveryLocationsByBarcode`, function (req, res) {
    const params = req.query

    const handler = app.resources.deliveryLocationsByBarcode

    return handler(req.query.params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  /**
   *  Item route
   *  Responds with the bib and only the single requested item
   *
   *  e.g. discovery/resources/b1234-i9876
   */
  app.get(`/api/v${VER}/discovery/resources/:uri-:itemUri([a-z]?i[0-9]+)`, function (req, res) {
    const params = { uri: req.params.uri, itemUri: req.params.itemUri }

    return app.resources.findByUri(params, { baseUrl: app.baseUrl }, req)
      .then((responseBody) => respond(res, responseBody, params))
      .catch((error) => handleError(res, error, params))
  })

  /**
   * Bib route
   * Responds with the identified bib
   *
   * e.g. discovery/resources/b1234
   */
  app.get(`/api/v${VER}/discovery/resources/:uri.:ext?`, function (req, res) {
    const gatheredParams = req.query
    const params = Object.assign({}, req.query, { uri: req.params.uri })

    if (Number.isInteger(parseInt(gatheredParams.items_size))) params.items_size = gatheredParams.items_size
    if (Number.isInteger(parseInt(gatheredParams.items_from))) params.items_from = gatheredParams.items_from

    let handler = app.resources.findByUri

    if (req.params.ext === 'annotated-marc') {
      handler = app.resources.annotatedMarc
    }

    return handler(params, { baseUrl: app.baseUrl }, req)
      .then((responseBody) => respond(res, responseBody, params))
      .catch((error) => handleError(res, error, params))
  })
}
