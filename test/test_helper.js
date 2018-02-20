// This can be any port, but let's choose something reasonably high to
// avoid conflict:
process.env.PORT = 5678

// Establish base url for local queries:
global.TEST_BASE_URL = 'http://localhost:' + process.env.PORT

// By virtue of including app.js, we start listening on above port:
require('../app.js')

require('../lib/globals')
global.expect = require('chai').expect
