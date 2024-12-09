const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const qs = require('qs')
const md5 = require('md5')
const url = require('url')

const { makeNyplDataApiClient } = require('../lib/data-api-client')

/**
 * Given an ES query, builds a local path unique to the query
 */
function esFixturePath (properties) {
  // Use qs.stringify to get a query-string representation of the es query
  // Then use md5 on that to get a short, (mostly) unique string suitable as
  // a filename. (Md5 on different plain objects returns same string hash)
  return `./test/fixtures/query-${md5(qs.stringify(properties))}.json`
}

let missingFixturePaths = 0

/**
 * Emulates app.esClient.search function via local fixtures
 */
function esClientSearchViaFixtures (properties) {
  const path = esFixturePath(properties)
  usedFixturePaths[path] = true

  if (process.env.DEBUG_FIXTURES) console.log(`Using ES fixture ${path} for `, JSON.stringify(properties, null, 2))
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, content) => {
      if (err) {
        console.error(`Missing fixture (${path}) for `, JSON.stringify(properties, null, 2))
        missingFixturePaths += 1
        return reject(err)
      }
      if (process.env.DEBUG_FIXTURES) {
        console.log('Using fixture size ' + content.length + 'b')
      }
      return resolve(JSON.parse(content))
    })
  })
}

/**
 * Given a es query hash, this function:
 *  - determines the fixture path and
 *  - writes the given ES response to a local fixture
 *
 * By default will overwrite any existing fixture. To skip overwriting existent
 * fixtures (i.e. to avoid trivial changes), set:
 *   process.env.UPDATE_FIXTURES = 'if-missing'
 */
function writeEsResponseToFixture (properties, resp) {
  // Get rid fo useless extras:
  delete resp.headers
  delete resp.meta

  const path = esFixturePath(properties)
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(resp, null, 2), (err, res) => {
      if (err) return reject(err)

      return resolve()
    })
  })
}

/**
 * Determine if the fixture for the given query exists on disk, async.
 *
 * @returns {Promise} A promise that resolves a boolean: true if fixture exists, false otherwise.
 */
function esFixtureExists (properties) {
  const path = esFixturePath(properties)
  return new Promise((resolve, reject) => {
    fs.access(path, (err, fd) => {
      const exists = !err
      return resolve(exists)
    })
  })
}

/**
 * May be used inside a `before/beforeEach` to redirect all `app.esClient.seach`
 * calls to local fixtures.
 *
 * Optionally enable process.env.UPDATE_FIXTURES=[all|if-missing] to attempt to update
 * fixtures via whatever ES is configured
 */
function enableEsFixtures () {
  const app = require('../app')

  // If tests are run with `UPDATE_FIXTURES=[all|if-missing] npm test`, rebuild fixtures:
  if (process.env.UPDATE_FIXTURES) {
    process.env.LOCAL = 'true'

    // Create a reference to the original search function:
    const originalEsSearch = app.esClient.search.bind(app.esClient)

    sinon.stub(app.esClient, 'search').callsFake(function (properties) {
      return esFixtureExists(properties).then((exists) => {
        // If it doesn't exist, or we're updating everything, update it:
        if (process.env.UPDATE_FIXTURES === 'all' || !exists) {
          console.log(`Writing ${esFixturePath(properties)} because ${process.env.UPDATE_FIXTURES === 'all' ? 'we\'re updating everything' : 'it doesn\'t exist'}`)
          return originalEsSearch(properties)
            // Now write the response to local fixture:
            .then((resp) => writeEsResponseToFixture(properties, resp))
            // And for good measure, let's immediately rely on the local fixture:
            .then(() => esClientSearchViaFixtures(properties))
        } else {
          return esClientSearchViaFixtures(properties)
        }
      })
    })
  } else {
    // Any internal call to app.esClient.search should load a local fixture:
    sinon.stub(app.esClient, 'search').callsFake(esClientSearchViaFixtures)
  }
}

/**
 * Use in `after/afterEach` to restore (de-mock) app.esClient.search
 */
function disableEsFixtures () {
  const app = require('../app')

  app.esClient.search.restore()
}

/** **************************************************************************
 *  SCSB fixtures:
 ** **************************************************************************/

/**
 * Given an scsb items-by-barcode query, builds a local path unique to the query
 */
function scsbFixturePath (type, args) {
  // Use qs.stringify to get a query-string representation of the es query
  // Then use md5 on that to get a short, (mostly) unique string suitable as
  // a filename. (Md5 on different plain objects returns same string hash)
  return `./test/fixtures/${type}-${md5(qs.stringify(args))}.json`
}

/**
 * Determine if the fixture for the given query exists on disk, async.
 *
 * @returns {Promise} A promise that resolves a boolean: true if fixture exists, false otherwise.
 */
function scsbFixtureExists (type, barcodes) {
  const path = scsbFixturePath(type, barcodes)
  return new Promise((resolve, reject) => {
    fs.access(path, (err, fd) => {
      const exists = !err
      return resolve(exists)
    })
  })
}

const usedFixturePaths = {}

/**
 * Emulates SCSBClient.getItemAvailabilityForBarcodes via local fixtures
 */
function scsbViaFixtures (type, barcodes) {
  const path = scsbFixturePath(type, barcodes)
  usedFixturePaths[path] = true

  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, content) => {
      if (err) {
        console.error(`Missing fixture (${path}) for `, JSON.stringify(barcodes, null, 2))
        return reject(err)
      }

      return resolve(JSON.parse(content))
    })
  })
}

/**
 * Given a es query hash, this function:
 *  - determines the fixture path and
 *  - writes the given ES response to a local fixture
 *
 * By default will overwrite any existing fixture. To skip overwriting existent
 * fixtures (i.e. to avoid trivial changes), set:
 *   process.env.UPDATE_FIXTURES = 'if-missing'
 */
function writeScsbResponseToFixture (type, properties, resp) {
  const path = scsbFixturePath(type, properties)
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(resp, null, 2), (err, res) => {
      if (err) return reject(err)

      return resolve()
    })
  })
}

/**
 * May be used inside a `before/beforeEach` to redirect all
 * `SCSBRestClient.getItemsAvailabilityForBarcodes` calls to local fixtures.
 *
 * Optionally enable process.env.UPDATE_FIXTURES=[all|if-missing] to attempt to update
 * fixtures via whatever ES is configured
 */
function enableScsbFixtures () {
  const scsbClient = require('../lib/scsb-client')

  // These are the scsbClient functions we'll override, paired with a prefix
  // for their fixture filenames:
  ; [
    {
      method: 'getItemsAvailabilityForBarcodes',
      fixturePrefix: 'scsb-by-barcode'
    },
    {
      method: 'getItemsAvailabilityForBnum',
      fixturePrefix: 'scsb-availability-by-bnum'
    }
  ].forEach(({ method, fixturePrefix }) => {
    // If tests are run with `UPDATE_FIXTURES=[all|if-missing] npm test`, rebuild fixtures:
    if (process.env.UPDATE_FIXTURES) {
      // Create a reference to the original search function:
      const original = scsbClient[method].bind(scsbClient)

      sinon.stub(scsbClient, method).callsFake(function (arg1) {
        return scsbFixtureExists(fixturePrefix, arg1).then((exists) => {
          // If it doesn't exist, or we're updating everything, update it:
          if (process.env.UPDATE_FIXTURES === 'all' || !exists) {
            console.log(`Writing ${scsbFixturePath(fixturePrefix, arg1)} because ${process.env.UPDATE_FIXTURES === 'all' ? 'we\'re updating everything' : 'it doesn\'t exist'}`)
            return original(arg1)
              // Now write the response to local fixture:
              .then((resp) => writeScsbResponseToFixture(fixturePrefix, arg1, resp))
              // And for good measure, let's immediately rely on the local fixture:
              .then(() => scsbViaFixtures(fixturePrefix, arg1))
          } else {
            return scsbViaFixtures(fixturePrefix, arg1)
          }
        })
      })
    } else {
      // Any internal call to SCSBRestClient.getItemsAvailabilityForBarcodes
      // should load a local fixture:
      sinon.stub(scsbClient, method)
        .callsFake((arg1) => scsbViaFixtures(fixturePrefix, arg1))
    }
  })

  // Let's hardcode recapCustomerCode-lookups to return NA, a common location
  sinon.stub(scsbClient, 'recapCustomerCodeByBarcode').callsFake(() => Promise.resolve('NA'))
}

/**
 * Use in `after/afterEach` to restore (de-mock) app.esClient.search
 */
function disableScsbFixtures () {
  const scsbClient = require('../lib/scsb-client')

  scsbClient.getItemsAvailabilityForBarcodes.restore()
  scsbClient.getItemsAvailabilityForBnum.restore()
  scsbClient.recapCustomerCodeByBarcode.restore()
}

let dataApiClient = null

/**
 * Use in `before/beforeEach` to associate platform api request paths with local fixtures
 *
 * @param {object} pathToFixtureMap - A hash mapping api request paths to local fixture filenames
 *
 * @example
 * // The following will cause makeDataApiClient().get('path/to/resource') to
 * // resolve the content of './test/fixtures/fixture-path.json':
 * enableApiFixtures({ 'path/to/resource': 'fixture-path.json' })
 */
function enableDataApiFixtures (pathToFixtureMap) {
  dataApiClient = makeNyplDataApiClient()

  // Override app's _doAuthenticatedRequest call to return fixtures for specific paths, otherwise fail:
  sinon.stub(dataApiClient, '_doAuthenticatedRequest').callsFake(function (requestOptions) {
    // Get relative api path: (e.g. 'patrons/1234')
    const requestPath = new url.URL(requestOptions.uri).pathname.replace('/api/v0.1/', '')
    if (pathToFixtureMap[requestPath]) {
      const content = fs.readFileSync(path.join('./test/fixtures/', pathToFixtureMap[requestPath]), 'utf8')
      // The data-api-client uses `fetch`, so emulate a Response object:
      return Promise.resolve({
        json: () => Promise.resolve(JSON.parse(content)),
        body: content
      })
    }

    throw new Error('No fixture for ' + requestPath)
  })
}

/**
 * Use in `after/afterEach` to reverse the effect of `enableDataApiFixtures`
 */
function disableDataApiFixtures () {
  dataApiClient._doAuthenticatedRequest.restore()
}

after(function () {
  const used = Object.keys(usedFixturePaths).map((path) => path.split('/').pop())

  const existingPaths = fs.readdirSync('./test/fixtures/').filter((path) => {
    return /^(scsb-by-barcode-|query-)/.test(path)
  })
  const unused = existingPaths.filter((path) => !used.includes(path))
  if (unused.length > 0) {
    // If there are unused fixtures..
    // If REMOVE_UNUSED_FIXTURES=true is set, delete them:
    if (process.env.REMOVE_UNUSED_FIXTURES === 'true') {
      console.log(`The following fixtures were not used and will be removed:\n${unused.map((path) => `\n  ${path}`)}`)
      unused.forEach((p) => {
        fs.unlinkSync(`./test/fixtures/${p}`)
      })
    // Otherwise, just report on them:
    } else {
      console.log(`${unused.length} fixture(s) were not used`)
    }
  }

  if (missingFixturePaths) {
    console.error(`Missing ${missingFixturePaths} fixture(s). Run the following to build them:\n  UPDATE_FIXTURES=if-missing npm test`)
  }
})

module.exports = { enableEsFixtures, disableEsFixtures, enableDataApiFixtures, disableDataApiFixtures, enableScsbFixtures, disableScsbFixtures }
