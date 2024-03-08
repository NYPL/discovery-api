const config = require('config')
const express = require('express')

const esClient = require('./lib/es-client')
const { loadConfig } = require('./lib/load-config')
const { preflightCheck } = require('./lib/preflight_check')

const swaggerDocs = require('./swagger.v1.1.x.json')
const pjson = require('./package.json')

const app = express()

// Tell express to trust x-forwarded-proto and x-forwarded-host headers when
// origin is local. This means req.hostname and req.protocol will
// return the actual host and proto of the original request when forwarded
// by the trusted proxy (Imperva). This is essential for building a valid login
// redirect_uri
// See https://expressjs.com/en/4x/api.html#trust.proxy.options.table
app.set('trust proxy', 'loopback')

const run = async () => {
  await loadConfig()

  preflightCheck()

  // Load logger after running above to ensure we respect LOG_LEVEL if set
  app.logger = require('./lib/logger')

  app.thesaurus = config.thesaurus

  require('./lib/resources')(app)

  // routes
  require('./routes/resources')(app)
  require('./routes/misc')(app)

  app.esClient = esClient

  app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  app.get('/', function (req, res) {
    res.send(pjson.version)
  })

  // Just testing route
  app.get('/api/v0.1/discovery', function (req, res) {
    res.send(pjson.version)
  })

  app.get('/api/v0.1/discovery/swagger', function (req, res) {
    res.send(swaggerDocs)
  })

  const port = process.env.PORT || config['port']

  require('./lib/globals')(app).then((app) => {
    app.listen(port, function () {
      app.logger.info('Server started on port ' + port)
    })
  })
}

run()

module.exports = app
