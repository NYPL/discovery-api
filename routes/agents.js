module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  app.get('/api/v1/agents', function (req, res) {
    if (req.query.action) {
      // if no "value" parm given error out except if...
      if (!req.query.value && ['random'].indexOf(req.query.action.toLowerCase()) === -1) {
        res.type('application/ld+json')
        res.status(500).send(JSON.stringify({error: 'No Value supplied'}, null, 2))
        return
      }

      if (req.query.action.toLowerCase() === 'lookup') {
        app.agents.findById(req.query.value, function (agent) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agent, null, 2))
          return true
        })
      }
      if (req.query.action.toLowerCase() === 'searchbyname') {
        if (!req.query.page) req.query.page = 1

        app.agents.searchByName(req.query.value, req.query.page, function (agent) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agent, null, 2))
          return true
        })
      }

      if (req.query.action.toLowerCase() === 'overview') {
        app.agents.overview(req.query.value, function (agent) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agent, null, 2))
          return true
        })
      }

      if (req.query.action.toLowerCase() === 'imagesof') {
        app.agents.imagesOf(req.query.value, function (agent) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agent, null, 2))
          return true
        })
      }
      if (req.query.action.toLowerCase() === 'resources') {
        app.agents.resources(req.query.value, function (agent) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agent, null, 2))
          return true
        })
      }

      if (req.query.action.toLowerCase() === 'random') {
        app.agents.randomAgents(function (agents) {
          res.type('application/ld+json')
          res.status(200).send(JSON.stringify(agents, null, 2))
          return true
        })
      }
    } else {
      res.type('application/ld+json')
      res.status(500).send(JSON.stringify({error: 'No Action requested'}, null, 2))
    }
  })

// other routes..
}
