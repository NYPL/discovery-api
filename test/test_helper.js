const fs = require('fs')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const dotenv = require('dotenv')
const kmsHelper = require('../lib/kms-helper')

// Load baseline test env vars:
dotenv.config({ path: './config/test.env' })

before(() => {
  // If we're updating fixtures, load real production creds
  if (process.env.UPDATE_FIXTURES) {
    const productionEnv = dotenv.parse(fs.readFileSync('./config/qa.env'))
    return Promise.all(
      [
        // These are the config params that will allow us to build fixtures
        // from real production data:
        'SCSB_URL',
        'SCSB_API_KEY',
        'ELASTICSEARCH_HOST',
        'RESOURCES_INDEX',
        'NYPL_OAUTH_URL',
        'NYPL_OAUTH_ID',
        'NYPL_OAUTH_SECRET',
        'NYPL_API_BASE_URL'
      ].map((key) => {
        const value = productionEnv[key]
        let handleValue = Promise.resolve(value)
        // Decrypt the config that's encrypted:
        if ([ 'SCSB_URL', 'SCSB_API_KEY', 'NYPL_OAUTH_SECRET' ].includes(key)) {
          handleValue = kmsHelper.decrypt(value)
        }
        return handleValue
          .then((value) => {
            process.env[key] = value
          })
      })
    )
  }
})

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
