/**
* Assess query targets performance of the discovery-api
*
* This script loads "query targets" from a CSV, representing scoped keyword queries with 1 or more "good hits"
*
* Query targets CSV should be placed in /data/query-targets.csv, downloaded from
* https://docs.google.com/spreadsheets/d/1cLYqK8MqJ8XtR4cVCCdYRc3hMPZNwoxirko93q8CAts/edit#gid=0
*
* For each query target, the script runs the query against the app, reporting on the successes and failures.
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

const app = require('../app')

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    offset: 0,
    limit: Infinity,
    rows: null
  },
  string: ['rows']
})

const PORT = 3333

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
  return Object.keys(goodHits)
    .reduce((h, expectedIndex) => {
      const bibid = goodHits[expectedIndex].bibid
      if (!bibid) {
        console.warn('No "good hits" defined?')
        return h
      }
      const actualIndex = results.findIndex((result) => result.result.uri === bibid)
      // Consider it a pass if within 5 of expected index (adjusting for number of good hits)
      const pass = actualIndex >= 0 && Math.abs(actualIndex - expectedIndex) <= (5 + goodHits.length)

      const document = actualIndex >= 0 ? results[actualIndex].result : null
      const report = {
        bibid,
        expectedIndex,
        actualIndex,
        document
      }
      h[pass ? 'pass' : 'fail'].push(report)
      return h
    }, { pass: [], fail: [] })
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
  reportOn(`${pass.length} out of ${query.orderedHits.length} PASS`, ratioPass === 1 ? 'success' : (ratioPass < 0.5 ? 'failure' : 'mixed'))

  // More queries to run?
  if (queries[index + 1]) {
    await delay(1000)
    return testNextQuery(queries, index + 1)
  } else {
    console.log('All done')
    return Promise.resolve()
  }
}

// Await-able setTimeout:
const delay = async (time) => new Promise((resolve) => setTimeout(resolve, time))

/**
* Parse a single CSV row
*/
const parseTargetQueryRow = (row, index) => {
  row.orderedHits = row['good hits']
    .split('\n')
    .map((hit) => {
      return {
        url: hit,
        bibid: hit.split('/').pop()
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
