module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  app.get('/api/v1/resources/:id', function (req, res) {
    app.resources.findById(req.params, function (_resp) {
      res.type('application/ld+json')
      res.status(200).send(JSON.stringify(_resp, null, 2))
      return true
    })
  })

  app.get('/api/v1/resources', function (req, res) {
    var standardParams = ['page', 'per_page', 'value', 'q']

    var actionHandlers = {
      // Redundant if we use resources/:id path above:
      'lookup': { handler: app.resources.findById },

      'searchbytitle': { handler: app.resources.searchByTitle },
      'search': { handler: app.resources.search, params: standardParams.concat(['filters']) },
      'aggregations': { handler: app.resources.searchAggregations, params: standardParams.concat(['filters', 'fields']) },
      'overview': { handler: app.resources.overview },
      'ntriples': { handler: app.resources.overviewNtriples, contentType: 'text/plain' },
      'jsonld': { handler: app.resources.overviewJsonld },
      'byterm': { handler: app.resources.byTerm },
      'searchold': { handler: app.resources.findByOldId },
      'byowi': { handler: app.resources.findByOwi },
      'random': { handler: (v, cb) => app.resources.randomResources(v, cb) }
    }
    if (req.query.action) {
      var action = req.query.action.toLowerCase()

      // Error if action invalid:
      if (Object.keys(actionHandlers).indexOf(action) < 0) {
        res.type('application/json')
        res.status(500).send(JSON.stringify({error: 'Invalid Action'}, null, 2))
      } else {
        var handlerConfig = null
        if ((handlerConfig = actionHandlers[action])) {
          // If specific params configured, pass those to handler
          // otherwise just pass `value` param (i.e. keyword search)
          var acceptedParams = handlerConfig.params ? handlerConfig.params : standardParams
          var params = {}
          acceptedParams.forEach((k) => {
            params[k] = req.query[k]
          })
          if (req.query.q) params.value = req.query.q
          handlerConfig.handler(params, function (_resp) {
            res.type(handlerConfig.contentType ? handlerConfig.contentType : 'application/ld+json')
            res.status(200).send(JSON.stringify(_resp, null, 2))
            return true
          })
        }
      }

    // Error if no action given:
    } else {
      res.type('application/json')
      res.status(500).send(JSON.stringify({error: 'No Action requested'}, null, 2))
    }
  })
}
