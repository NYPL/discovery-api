const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

// Set some env variables:
require('dotenv').config({ path: './config/test.env' })

// Establish base url for local queries:
global.TEST_BASE_URL = `http://localhost:${process.env.PORT}`

// Nullify SCSB creds just in case they've been brought in by app.js by a
// local .env (but only if we're not updating fixtures, for which we'll need
// that auth..):
if (!process.env.UPDATE_FIXTURES) {
  process.env.SCSB_URL = 'https://example.com'
  process.env.SCSB_API_KEY = 'fake-scsb-api-key'
}

require('../lib/globals')

chai.use(chaiAsPromised)
global.expect = chai.expect
