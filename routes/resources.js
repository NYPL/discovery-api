var gatherParams = require('../lib/util').gatherParams

const config = require('config')

const VER = config.get('major_version')

module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    app.baseUrl = `http${req.secure ? 's' : ''}://${req.headers.host}/api/v${VER}/discovery`
    next()
  })

  var standardParams = ['page', 'per_page', 'q', 'filters', 'expandContext', 'ext', 'field', 'sort', 'sort_direction', 'search_scope']

  const respond = (res, _resp, params) => {
    var contentType = 'application/ld+json'
    if (params.ext === 'ntriples') contentType = 'text/plain'

    var resp = _resp
    if (contentType !== 'text/plain') resp = JSON.stringify(_resp, null, 2)

    res.type(contentType)
    res.status(200).send(resp)
    return true
  }

  const handleError = (res, error, params) => {
    app.logger.error('Resources#handleError:', error)

    var statusCode = 500
    switch (error.name) {
      case 'InvalidParameterError':
        statusCode = 422
        break
      case 'NotFoundError':
        statusCode = 404
        break
      default:
        statusCode = 500
    }
    res.status(statusCode).send({ status: statusCode, name: error.name, error: error.message ? error.message : error })
    return false
  }

  app.get(`/api/v${VER}/discovery/resources$`, function (req, res) {
    var params = gatherParams(req, standardParams)

    return app.resources.search(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/discovery/resources/aggregations`, function (req, res) {
    var params = gatherParams(req, standardParams)

    return app.resources.aggregations(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/discovery/resources/aggregation/:field`, function (req, res) {
    var params = Object.assign({}, gatherParams(req, standardParams), req.params)

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
    var params = gatherParams(req, ['barcodes', 'patronId'])

    var handler = app.resources.deliveryLocationsByBarcode

    return handler(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/discovery/resources/:uri\.:ext?`, function (req, res) {
    var params = { uri: req.params.uri }

    var handler = app.resources.findByUri

    if (req.params.ext === 'ntriples') {
      handler = app.resources.overviewNtriples
    }

    return handler(params, { baseUrl: app.baseUrl })
      .then((responseBody) => respond(res, responseBody, params))
      .catch((error) => handleError(res, error, params))
  })
}
