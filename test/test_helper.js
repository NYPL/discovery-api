// Set some env variables:
process.env.SEARCH_ITEMS_SIZE = 100
// This can be any port, but let's choose something reasonably high to
// avoid conflict:
process.env.PORT = 5678

// Establish base url for local queries:
global.TEST_BASE_URL = 'http://localhost:' + process.env.PORT

// By virtue of including app.js, we start listening on above port:
require('../app.js')

// Nullify SCSB creds just in case they've been brought in by app.js by a
// local .env (but only if we're not updating fixtures, for which we'll need
// that auth..):
if (!process.env.UPDATE_FIXTURES) {
  process.env.SCSB_URL = 'https://example.com'
  process.env.SCSB_API_KEY = 'fake-scsb-api-key'
}

// TODO: Setting a hard NYPL-Core version is temporary (although largely
// future safe) and may be removed once the following is merged to
// `master`:
// https://github.com/NYPL/nypl-core/commit/e7548eaedd93c7dcbe17c82f61e299dfca1a9e13
process.env.NYPL_CORE_VERSION = 'v1.37a'

require('../lib/globals')
global.expect = require('chai').expect
