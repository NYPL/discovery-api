/**
 * A script to compare keyword searches against two different indexes. Given a
 * keyword query and two index names, this script spins up two apps connected
 * to the named indexes, performs the specified query on each, displays the
 * result count from each, and lists the bnumbers missing from each resultset
 * (among first 50 hits).
 *
 * Usage:
 *
 * node scripts/compare-indexes.js --indexes INDEXES [-q KEYWORDS] [-search_scope SEARCHSCOPE]
 *
 * For example, to compare a search for "dogs" on resources-2017-08-23 vs
 * resources-2018-04-02 (using ELASTICSEARCH_HOST from .env), do this:
 *
 * node scripts/compare-indexes.js --indexes resources-2017-08-23,resources-2018-04-02 -q dogs
 *
 */

const request = require('request-promise')
const argv = require('minimist')(process.argv.slice(2))

const startingPort = 3052

// Create one app for each of the [comma-delimited] indexes:
const apps = argv.indexes.split(',')
  .map((index) => ({ index }))

/**
 * Like Array.map, but with delay inserted between each transform.
 *
 * Given an array of items, a delay, and a callback, returns a Promise that
 * resolves when each item has been been transformed by the callback in turn,
 * with the specified delay inserted between calls. The
 * final resolved value is an array of the transformed values.
 */
function mapDelayed (items, delay, cb, mappedItems = []) {
  if (!Array.isArray(items)) throw new Error('mapDelayed must be called with array. ' + (typeof items) + ' given.')

  // Last iteration? resolve mapped values:
  if (items.length === 0) return Promise.resolve(mappedItems)

  const item = items.shift()
  let mappedItemResolver = cb(item, mappedItems.length)

  // If cb is not async, make it behave as though it is:
  if (!(mappedItemResolver instanceof Promise)) mappedItemResolver = Promise.resolve(mappedItemResolver)

  return mappedItemResolver.then((mappedItem) => {
    mappedItems.push(mappedItem)

    return timeoutPromise(delay)
      .then(() => mapDelayed(items, delay, cb, mappedItems))
  })
}
/**
 * Like setTimeout, but returns a Promise
 */
function timeoutPromise (delay) {
  return new Promise((resolve, reject) => setTimeout(resolve, delay))
}

function resultsInFirstOnly (r1, r2, count = 20) {
  return r1.itemListElement
    .slice(0, count)
    .filter((r1Bib) => {
      const bibIsInSecondList = r2.itemListElement.some((r2Bib) => r2Bib.result['@id'] === r1Bib.result['@id'])
      if (r1Bib.result['@id'] === 'res:b12851035') console.log('In second list? ', bibIsInSecondList)
      return !bibIsInSecondList
    })
}

function summarizeBibs (label, bibs) {
  console.log('___________________________________________')
  console.log(label)
  if (bibs.length === 0) {
    console.log('  None.')
  } else {
    ; bibs.forEach((bib, ind) => {
      const contributorLabel = (bib.result.creatorLabel || []).length > 0 ? ` (${bib.result.creatorLiteral.join('; ')}` : ''
      console.log(` ${ind + 1}: ${bib.result['@id'].split(':').pop()}: ${bib.result.titleDisplay[0]}${contributorLabel}`)
    })
  }
}

mapDelayed(apps, 500, (app, ind) => {
  const port = startingPort + ind
  process.env.PORT = port
  process.env.RESOURCES_INDEX = app.index
  process.env.NODE_ENV = 'test'

  console.log('Starting app on', process.env.PORT, process.env.RESOURCES_INDEX)

  require('../app')

  // Invalidate require cache (to force next invocation to re-evaluate process.env)
  delete require.cache[require.resolve('../app')]
  delete require.cache[require.resolve('../lib/resources')]
  delete require.cache[require.resolve('../lib/logger')]

  return Object.assign({}, app, { port })
})
  .then((apps) => {
    return timeoutPromise(1000)
      .then(() => apps)
  })
  .then((apps) => {
    return mapDelayed(apps, 500, (app, ind) => {
      let queryString = `q=${encodeURI(argv.q)}`
      if (argv.search_scope) queryString += `&search_scope=${argv.search_scope}`

      console.log(`Fetching ${queryString} from ${app.index} (port ${app.port})`)
      return request({ uri: `http://localhost:${app.port}/api/v0.1/discovery/resources?${queryString}`, json: true })
        .then((response) => {
          return Object.assign({}, app, { response })
        })
    })
  })
  .then((apps) => {
    console.log('___________________________________________')
    console.log('Result:')
    ; apps.forEach((app, ind) => {
      console.log(` App ${ind + 1}. ${app.index} (port ${app.port}): ${app.response.totalResults} results`)
    })
    const diff = {
      removed: resultsInFirstOnly(apps[0].response, apps[1].response),
      added: resultsInFirstOnly(apps[1].response, apps[0].response)
    }
    summarizeBibs(`Bibs added (present only in ${apps[1].index})`, diff.added)
    summarizeBibs(`Bibs removed (present only in ${apps[0].index})`, diff.removed)
  })
