/**
* Assess relevancy performance of discovery-api by running several sample
* searches and reporting on how many of the named bibs appear among the top
* results.
*
* This script loads "query targets" from a CSV, representing scoped keyword queries with 1 or more "good hits"
*
* Query targets CSV should be placed in /data/query-targets.csv, downloaded from
* https://docs.google.com/spreadsheets/d/1cLYqK8MqJ8XtR4cVCCdYRc3hMPZNwoxirko93q8CAts/edit#gid=0
*
* For each query target, the script runs the query against the app, reporting on
* the successes and failures. Success is determined by how many of the named
* bibs appear close to the top of teh results.
*
* Usage:
*   ENV=qa node scripts/assess-query-targets.js [--rows 2,3] [--offset O] [--limit L]
*
*/

const fs = require('fs')
const { parse: csvParse } = require('csv-parse/sync')
const request = require('supertest')
const tableFormat = require('table')
const chalk = require('chalk')
const { setCredentials: setKmsCredentials } = require('../lib/kms-helper')
const { fromIni } = require('@aws-sdk/credential-providers')

const app = require('../app')

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    offset: 0,
    limit: Infinity,
    rows: null,
    profile: 'nypl-digital-dev'
  },
  string: ['rows']
})

// Use creds from local profile:
setKmsCredentials(fromIni({ profile: argv.profile }))

const PORT = 3333

// Define ratio threshold for passing each query
const OVERALL_PASS_RATIO = {
  // If 100% pass, mark test as "pass"
  pass: 1,
  // If 50+% pass, mark test as "mixed"
  mixed: 0.5,
  // Otherwise ( < 50% pass), mark test as "fail"
  fail: 0
}

/**
* Start the app server
*/
const startApp = async () => {
  process.env.PORT = PORT

  await app.init()
  process.env.LOG_LEVEL = 'error'
  await app.start()
}

/*
* Console log, colorized
*/
const reportOn = (what, level) => {
  const color = {
    success: chalk.green,
    failure: chalk.red,
    mixed: chalk.hex('#FFA500')
  }[level]
  if (!color) console.error(`Invalid reporting level: ${level}`)
  console.log(color(what))
}

const reportError = (what) => {
  reportOn(what, 'failure')
}

/**
* Given a query, builds the relevant query-string and submits it to the running
* server instance, returning the results
*/
const runQuery = async (query) => {
  const scope = {
    journal_title: 'title',
    author: 'contributor'
  }[query['search-scope']] || query['search-scope']
  const filters = query['search-scope'] === 'journal_title' ? '&filters[issuance]=urn:biblevel:s' : ''
  const queryString = `?q=${query.q}&search_scope=${scope}${filters}`

  if (argv.verbose) {
    console.log(`  (Using query: ${queryString})`)
  }

  const response = await request(app)
    .get(`/api/v0.1/discovery/resources${queryString}`)

  return response.body.itemListElement
}

/**
* Given an array of DiscoveryAPI results and an array of "good hits"
* returns two arrays of objects representing passes and fails
*/
const analyzeResults = (results, goodHits) => {
  return goodHits
    .map((goodHit) => analyzeResultsForTargetBibId(results, goodHit, goodHits.length))
    .reduce((h, analysis) => {
      h[analysis.pass ? 'pass' : 'fail'].push(analysis)
      return h
    }, { pass: [], fail: [] })
}

/**
* Given an array of search results and a "good hit" (bibid and rank), returns
* an object representing the pass/fail for the expected bib
*/
const analyzeResultsForTargetBibId = (results, goodHit, numberOfTargetHits) => {
  // Where does the target bib occur in the results?
  const actualIndex = results.findIndex((result) => result.result.uri === goodHit.bibid)

  // Assess whether and how well the expected hit appeared in the results
  let pass = false
  if (actualIndex >= 0) {
    const distanceFromExpected = actualIndex >= 0 && Math.abs(actualIndex - goodHit.rank)

    // Consider it a pass if found within 5 of expected index (adjusting for
    // number of good hits)
    pass = distanceFromExpected <= (5 + numberOfTargetHits)
  }

  // Store document in report, if found:
  const document = actualIndex >= 0 ? results[actualIndex].result : null

  const report = {
    bibid: goodHit.bibid,
    expectedIndex: goodHit.rank,
    actualIndex,
    document,
    pass
  }

  return report
}

/**
* Given an Express instance, an array of queries, and a index, executes the
* next test query against the server, reports on the result, and calls itself
* on the next index
*/
const testNextQuery = async (queries, index = 0) => {
  const query = queries[index]

  console.info('________________________________________________________')
  console.info(`${query.index}: "${query.q}" (${query['search-scope']})`)

  // Run the query:
  const results = await runQuery(query)

  // Print table of results when --verbose enabled:
  if (argv.verbose) {
    const table = results.map((result, ind) => {
      let expectedIndex = query.orderedHits.findIndex((hit) => hit.bibid === result.result.uri)
      expectedIndex = expectedIndex >= 0 ? expectedIndex : ''

      return [ind, result.result.uri, expectedIndex, result.searchResultScore, result.result.title[0]]
    })
    console.info(tableFormat.table(table))
  }

  if (!query.orderedHits) {
    console.warn('No "good hits" defined?')
  }
  // Analyze results:
  const { pass, fail } = analyzeResults(results, query.orderedHits)
  const ratioPass = pass.length / query.orderedHits.length

  // Report on passes:
  if (pass.length) {
    pass.forEach((report) => {
      reportOn(`${report.bibid}: PASS: Expected: ${report.expectedIndex}. Actual: ${report.actualIndex}`, 'success')
    })
  }
  // Report on failures:
  if (fail.length) {
    fail.forEach((report) => {
      reportError(`${report.bibid}: FAIL: Expected: ${report.expectedIndex}. Actual: ${report.actualIndex}`)
      if (report.document) {
        reportError(`  "${report.document.title[0]}" at index ${report.actualIndex}`)
      } else {
        reportError(`  ${report.bibid} not found in results`)
      }
    })
  }

  // Summarize results:
  reportOn(`${pass.length} out of ${query.orderedHits.length} PASS`, overallPassFailLabel(ratioPass))

  // More queries to run?
  if (queries[index + 1]) {
    await delay(1000)
    return testNextQuery(queries, index + 1)
  } else {
    console.log('All done')
    return Promise.resolve()
  }
}

/**
* Given a ratio (between 0-1), returns "pass", "fail", or "mixed"
*
* E.g. overallPassFailLabel(0.3) => 'fail'
*      overallPassFailLabel(0.7) => 'mixed'
*      overallPassFailLabel(1.0) => 'pass'
*/
const overallPassFailLabel = (ratio) => {
  return Object.entries(OVERALL_PASS_RATIO)
    // Sort by thresholds ascending:
    .sort((pair1, pair2) => {
      return pair1[1] - pair2[1]
    })
    // Return highest pass/fail label where `ratio` exceeds configured thresshold
    .reduce((result, [label, thresshold]) => {
      if (ratio >= thresshold) {
        result = label
      }
      return result
    }, '')
}

// Await-able setTimeout:
const delay = async (time) => new Promise((resolve) => setTimeout(resolve, time))

/**
* Parse a single CSV row
*/
const parseTargetQueryRow = (row, index) => {
  row.orderedHits = row['good hits']
    .split('\n')
    .map((hit, index) => {
      return {
        url: hit,
        bibid: hit.split('/').pop(),
        rank: index
      }
    })
  delete row['good hits']
  row.index = index
  return row
}

/**
* Get query targets from CSV:
*/
const queryTargetsData = () => {
  const raw = fs.readFileSync('./data/query-targets.csv')
  const rows = csvParse(raw, {
    columns: true,
    skip_empty_lines: true
  })
    .map(parseTargetQueryRow)
  return Promise.resolve(rows)
}

/**
* Run the query tests
*/
const run = async () => {
  let queries = await queryTargetsData()

  console.info(`Loaded ${queries.length} target queries`)

  // Which rows to test:
  const rows = (argv.rows || '')
    .split(',')
    .map((ind) => parseInt(ind))
    .filter((index) => index >= 0 && index < queries.length)

  // Test specific rows?
  if (rows.length >= 1) {
    console.log(`Processing query at row(s) ${rows}`)
    queries = rows.map((index) => queries[index])
  // Or test a range:
  } else {
    const limit = Math.min(queries.length, argv.limit)
    console.log(`Processing ${limit} queries from row ${argv.offset}`)
    queries = queries.slice(argv.offset, argv.offset + argv.limit)
  }

  await startApp()
  await testNextQuery(queries)

  process.exit()
}

run()
