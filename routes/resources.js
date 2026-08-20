const VER = '0.1'
const logger = require('../lib/logger')

module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    app.baseUrl = `http${req.secure ? 's' : ''}://${req.get('host')}/api/v${VER}/discovery`
    const requestLogObject = { ip: req.ip, path: req.path, body: req.body, query: req.query, method: req.method }
    logger.info(`${req.method} request to ${req.path}:`, requestLogObject)
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

  app.get(`/api/v${VER}/discovery/resources$`, function (req, res, next) {
    const params = req.query

    const hasFilters = params.filters && Object.keys(params.filters).length > 0

    if (params.include_aggregations === 'true' && !hasFilters) {
      return app.resources
        .search(
          params,
          { baseUrl: app.baseUrl, include_aggregations: true },
          req
        )
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    } else if (params.include_aggregations === 'true') {
      return Promise.all([
        app.resources.search(params, { baseUrl: app.baseUrl }, req),
        app.resources.aggregations(params, { baseUrl: app.baseUrl })
      ])
        .then(([searchResp, aggsResp]) => {
          searchResp.aggregations = aggsResp.itemListElement
          return respond(res, searchResp, params)
        })
        .catch((error) => next(error))
    } else {
      return app.resources
        .search(params, { baseUrl: app.baseUrl }, req)
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    }
  })

  app.get(
    `/api/v${VER}/discovery/resources/aggregations`,
    function (req, res, next) {
      const params = req.query

      return app.resources
        .aggregations(params, { baseUrl: app.baseUrl })
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    }
  )

  app.get(
    `/api/v${VER}/discovery/resources/aggregations/:field`,
    function (req, res, next) {
      const params = Object.assign({}, req.query, req.params)

      return app.resources
        .aggregation(params, { baseUrl: app.baseUrl })
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    }
  )

  app.get(`/api/v${VER}/discovery/browse/subjects`, function (req, res, next) {
    const params = req.query

    return app.subjects
      .browse(params, { baseUrl: app.baseUrl }, req)
      .then((resp) => respond(res, resp, params))
      .catch((error) => next(error))
  })

  app.get(
    `/api/v${VER}/discovery/browse/contributors`,
    function (req, res, next) {
      const params = req.query

      return app.contributors
        .browse(params, { baseUrl: app.baseUrl }, req)
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    }
  )

  app.get(`/api/v${VER}/discovery/vocabularies`, function (req, res, next) {
    const params = Object.assign({}, req.query, req.params)

    return app
      .vocabularies(params, { baseUrl: app.baseUrl })
      .then((resp) => respond(res, resp, params))
      .catch((error) => next(error))
  })

  /*
   * Return items with `deliveryLocation`s matching the supplied barcodes
   *
   * For example, to fetch Delivery Locations for item barcodes 12345, 45678, and 78910:
   *   /api/v${VER}/request/deliveryLocationsByBarcode?barcodes[]=12345&barcodes[]=45678&barcodes=[]=78910
   */
  app.get(
    `/api/v${VER}/request/deliveryLocationsByBarcode`,
    function (req, res, next) {
      const params = req.query

      const handler = app.resources.deliveryLocationsByBarcode

      return handler(params, { baseUrl: app.baseUrl })
        .then((resp) => respond(res, resp, params))
        .catch((error) => next(error))
    }
  )

  /**
   *  Item route
   *  Responds with the bib and only the single requested item
   *
   *  e.g. discovery/resources/b1234-i9876
   */
  app.get(
    `/api/v${VER}/discovery/resources/:uri-:itemUri([a-z]?i[a-z0-9]+)`,
    function (req, res, next) {
      const params = { uri: req.params.uri, itemUri: req.params.itemUri }

      return app.resources
        .findByUri(params, { baseUrl: app.baseUrl }, req)
        .then((responseBody) => respond(res, responseBody, params))
        .catch((error) => next(error))
    }
  )

  /**
   * Bib route
   * Responds with the identified bib
   *
   * e.g. discovery/resources/b1234
   */
  app.get(
    `/api/v${VER}/discovery/resources/:uri.:ext?`,
    function (req, res, next) {
      const params = Object.assign({}, req.query, { uri: req.params.uri })

      if (Number.isInteger(parseInt(req.query.items_size))) { params.items_size = req.query.items_size }
      if (Number.isInteger(parseInt(req.query.items_from))) { params.items_from = req.query.items_from }

      let handler = app.resources.findByUri

      if (req.params.ext === 'annotated-marc') {
        handler = app.resources.annotatedMarc
      } else if (req.params.ext === 'marc') {
        handler = app.resources.marc
      }

      return handler(params, { baseUrl: app.baseUrl }, req)
        .then((responseBody) => respond(res, responseBody, params))
        .catch((error) => next(error))
    }
  )
}
