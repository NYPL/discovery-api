const sinon = require('sinon')
const fs = require('fs')
const qs = require('qs')
const md5 = require('md5')

/**
 * Given an ES query, builds a local path unique to the query
 */
function fixturePath (properties) {
  // Use qs.stringify to get a query-string representation of the es query
  // Then use md5 on that to get a short, (mostly) unique string suitable as
  // a filename. (Md5 on different plain objects returns same string hash)
  return `./test/fixtures/${md5(qs.stringify(properties.body))}.json`
}

/**
 * Emulates app.esClient.search function via local fixtures
 */
function esClientSearchViaFixtures (properties) {
  let path = fixturePath(properties)
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
  let path = fixturePath(properties)
  return new Promise((resolve, reject) => {
    // Check that fixture exists:
    fs.access(path, (err, fd) => {
      const exists = !err
      const overwriteExisting = process.env.UPDATE_FIXTURES === 'all'

      if (!exists || overwriteExisting) {
        console.log(`Writing ${path} because ${exists ? 'we\'re updating everything' : 'it doesn\'t exist'}`)
        fs.writeFile(path, JSON.stringify(resp, null, 2), (err, res) => {
          if (err) return reject(err)

          console.log('Writing updated fixture to', path)
          return resolve()
        })
      } else {
        resolve()
      }
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
function enableFixtures () {
  const app = require('../app')

  // If tests are run with `UPDATE_FIXTURES=[all|if-missing] npm test`, rebuild fixtures:
  if (process.env.UPDATE_FIXTURES) {
    // Create a reference to the original search function:
    const originalEsSearch = app.esClient.search.bind(app.esClient)

    sinon.stub(app.esClient, 'search').callsFake(function (properties) {
      return originalEsSearch(properties)
        // Now write the response to local fixture:
        .then((resp) => writeEsResponseToFixture(properties, resp))
        // And for good measure, let's immediately rely on the local fixture:
        .then(() => esClientSearchViaFixtures(properties))
    })
  } else {
    // Any internal call to app.esClient.search should load a local fixture:
    sinon.stub(app.esClient, 'search').callsFake(esClientSearchViaFixtures)
  }
}

/**
 * Use in `after/afterEach` to restore (de-mock) app.esClient.search
 */
function disableFixtures () {
  const app = require('../app')

  app.esClient.search.restore()
}

module.exports = { enableFixtures, disableFixtures }
