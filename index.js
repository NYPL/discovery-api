'use strict'

const awsServerlessExpress = require('aws-serverless-express')
const app = require('./app')
const server = awsServerlessExpress.createServer(app)

var log = null
const config = require('config')

exports.handler = (event, context, callback) => {
  
  if (Object.keys(event).length === 0 && event.constructor === Object) {
    return callback('No event was received.')
  }
  return awsServerlessExpress.proxy(server, event, context)
}
