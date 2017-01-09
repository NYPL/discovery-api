var gatherParams = require('../lib/util').gatherParams

const config = require('config')

module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  var standardParams = ['page', 'per_page', 'q', 'expandContext', 'ext', 'field', 'sort', 'sort_direction']

  const VER = config.get('major_version')

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
    console.error('Resources#handleError:', error)
    res.status(500).send({ error: error.message ? error.message : error })
    return false
  }

  app.get(`/api/v${VER}/resources$`, function (req, res) {
    var params = gatherParams(req, standardParams)

    return app.resources.search(params)
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/resources/aggregations`, function (req, res) {
    var params = gatherParams(req, standardParams)

    return app.resources.aggregations(params)
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/resources/aggregation/:field`, function (req, res) {
    var params = req.params

    return app.resources.aggregation(params)
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })

  app.get(`/api/v${VER}/resources/:uri\.:ext?`, function (req, res) {
    var params = { uri: req.params.uri }

    var handler = app.resources.findByUri

    if (req.params.ext === 'ntriples') {
      handler = app.resources.overviewNtriples
    }

    return handler(params)
      .then((resp) => respond(res, resp, params))
      .catch((error) => handleError(res, error, params))
  })
}
