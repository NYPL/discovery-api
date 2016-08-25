var gatherParams = require('../lib/util').gatherParams
var UserError = require('../lib/errors').user

module.exports = function (app) {
  var standardParams = ['page', 'per_page', 'value', 'q', 'expandContext']

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
    'random': { handler: (v, cb) => app.resources.randomResources(v, cb) },
    'adjacents': { handler: app.resources.adjacents, params: standardParams.concat(['id']) }
  }

  app.get('/api/v1/resources(/:id)?', function (req, res) {
    try {
      var action = null

      if (req.params.id) {
        action = 'lookup'
      } else {
        if (!req.query.action) throw new UserError('No action specified')
        action = req.query.action.toLowerCase()
      }

      // Error if action invalid:
      if (Object.keys(actionHandlers).indexOf(action) < 0) throw new UserError('Invalid action')

      var handlerConfig = actionHandlers[action]
      var params = gatherParams(req, handlerConfig.params)

      handlerConfig.handler(params)
        .then(function (_resp) {
          res.type(handlerConfig.contentType ? handlerConfig.contentType : 'application/ld+json')
          res.status(200).send(JSON.stringify(_resp, null, 2))
          return true
        })
        .catch(function (error) {
          res.type(handlerConfig.contentType ? handlerConfig.contentType : 'application/ld+json')
          var payload = { error: error.message ? error.message : error }
          res.status((error instanceof UserError) ? 400 : 500).send(JSON.stringify(payload, null, 2))
          return true
        })

    // Catch action param errors:
    } catch (e) {
      res.type('application/ld+json')

      var payload = { error: e.message }
      res.status((e instanceof UserError) ? 400 : 500).send(JSON.stringify(payload, null, 2))
    }
  })
}
