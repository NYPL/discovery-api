var util = require('../lib/util')

module.exports = function (app) {
  app.get('/api/v1/context_all.jsonld', function (req, res) {
    res.type('application/ld+json')
    res.status(200).send(JSON.stringify({ '@context': util.context }, null, 2))
    return
  })

  app.get('/', function (req, res) {
    res.type('application/ld+json')
    res.status(200).send(JSON.stringify(util.apiEntrypointDoc, null, 2))
    return
    // res.send({ version: pjson.version })
  })

  app.get('/doc/', function (req, res) {
    res.type('application/ld+json')
    res.status(200).send(JSON.stringify(util.apiDoc, null, 2))
    return
  })
// other routes..
}
