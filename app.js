const express = require('express')
const NyplSourceMapper = require('research-catalog-indexer/lib/utils/nypl-source-mapper')

const esClient = require('./lib/elasticsearch/client')
const loadConfig = require('./lib/load-config')
const { preflightCheck } = require('./lib/preflight_check')
const { loadNyplCoreData } = require('./lib/load_nypl_core')
const handleError = require('./lib/handle-error')
const { NotFoundError } = require('./lib/errors')

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

app.init = async () => {
  await loadConfig.loadConfig()
  await loadNyplCoreData()
  await NyplSourceMapper.loadInstance()
  preflightCheck()

  // Load logger after running above to ensure we respect LOG_LEVEL if set
  app.logger = require('./lib/logger')

  require('./lib/resources')(app)
  require('./lib/subjects')(app)
  require('./lib/contributors')(app)
  require('./lib/vocabularies')(app)

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

  app.use((req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`))
  })

  app.use((err, req, res, next) => {
    handleError(err, req, res, next, app.logger)
  })

  return app
}

app.start = async () => {
  await app.init()

  const port = process.env.PORT || 3000

  return app.listen(port, function () {
    app.logger.info('Server started on port ' + port)
  })
}

module.exports = app
