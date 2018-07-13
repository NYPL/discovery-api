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
  return `./test/fixtures/query-${md5(qs.stringify(properties.body))}.json`
}

/**
 * Emulates app.esClient.search function via local fixtures
 */
function esClientSearchViaFixtures (properties) {
  let path = esFixturePath(properties)
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, content) => {
      if (err) {
        console.error(`Missing fixture (${path}) for `, JSON.stringify(properties, null, 2))
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
function writeEsResponseToFixture (properties, resp) {
  let path = esFixturePath(properties)
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
  let path = esFixturePath(properties)
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
    const requestPath = url.parse(requestOptions.uri).path.replace('/api/v0.1/', '')
    if (pathToFixtureMap[requestPath]) {
      const content = fs.readFileSync(path.join('./test/fixtures/', pathToFixtureMap[requestPath]), 'utf8')
      return Promise.resolve(JSON.parse(content))
    }

    return Promise.reject()
  })
}

/**
 * Use in `after/afterEach` to reverse the effect of `enableDataApiFixtures`
 */
function disableDataApiFixtures () {
  dataApiClient._doAuthenticatedRequest.restore()
}

module.exports = { enableEsFixtures, disableEsFixtures, enableDataApiFixtures, disableDataApiFixtures }
