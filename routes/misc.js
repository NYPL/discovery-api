var util = require('../lib/util')

const config = require('config')
const VER = config.get('major_version')

module.exports = function (app) {
  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  app.get(`/api/v${VER}/discovery/context_:which.jsonld`, function (req, res) {
    res.type('application/ld+json')
    util.context(req.params.which).then((c) => res.status(200).send(JSON.stringify({ '@context': c }, null, 2)))
    return
  })
}
