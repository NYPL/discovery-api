const config = require('config')
const swaggerDocs = require('./swagger.v0.1.1.json')
const pjson = require('./package.json')
const logger = require('./lib/logger')

require('dotenv').config()
require('./lib/preflight_check')

var express = require('express')
var elasticsearch = require('elasticsearch')

var app = express()

app.logger = logger
app.thesaurus = config.thesaurus

require('./lib/resources')(app)

// routes
require('./routes/resources')(app)
require('./routes/misc')(app)

app.esClient = new elasticsearch.Client({
  host: process.env.ELASTICSEARCH_HOST || config['elasticsearch'].host
})

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
