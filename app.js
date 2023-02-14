const config = require('config')
const swaggerDocs = require('./swagger.v1.1.x.json')
const pjson = require('./package.json')

require('dotenv').config()
// Load logger after running above to ensure we respect LOG_LEVEL if set
const logger = require('./lib/logger')

require('./lib/preflight_check')

const express = require('express')
const esClient = require('./lib/es-client')

const app = express()

app.logger = logger
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

module.exports = app
