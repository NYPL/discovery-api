const config = require('config')
const log = require('loglevel')

log.setLevel(process.env.LOGLEVEL || config.get('loglevel') || 'error')

const swaggerDocs = require('./swagger.v0.1.1.json')
const pjson = require('./package.json')

require('dotenv').config()

var express = require('express')
var elasticsearch = require('elasticsearch')

var app = express()

app.thesaurus = config.thesaurus

require('./lib/agents')(app)
require('./lib/resources')(app)

// routes
require('./routes/agents')(app)
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

// Only start the Express server locally:
if (process.env.LOCAL) {
  const port = process.env.PORT || config['port']

  require('./lib/globals')(app).then((app) => {
    app.listen(port, function () {
      console.log('Server started on port ' + port)
    })
  })
}

module.exports = app
