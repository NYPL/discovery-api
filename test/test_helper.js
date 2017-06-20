process.env.NODE_ENV = 'test'
require('../app.js')
require('../lib/globals')
global.expect = require('chai').expect
