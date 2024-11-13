/**
* Usage:
*   nvm use; ENV=qa node scripts/run-ranking-evaluation.js; pbcopy < out.csv
*
*   .. Then, paste the row into the next position in this spreadsheet:
*   https://docs.google.com/spreadsheets/d/12uDDxi3bInneZwmUQwEiYYkHheNkqW0WT5jxWvix4BE/edit?pli=1&gid=1424571383#gid=1424571383
*
*   After pasting, copy col C from the previous row into the newly pasted row (because the forumla uses relative references).
*
*/
const fs = require('fs')
const YAML = require('yaml')
const { fromIni } = require('@aws-sdk/credential-providers')
const { stringify } = require('csv-stringify/sync')

const { setCredentials: setKmsCredentials } = require('../lib/kms-helper')
const { loadConfig } = require('../lib/load-config')

// If you need to run this on a ES 5.3 index, you'll need to use branch
// `pre-es-work-snapshot` and set the following to false because the ES client
// needs to be v7:
const v8Client = true
let esClient
if (v8Client) {
  esClient = require('../lib/elasticsearch/client').esClient
} else {
  esClient = require('../lib/es-client').esClient
}

// Pass in object so we get a reference to private methods like `buildElasticQuery`
const resourcesPriv = {}
require('../lib/resources')({}, resourcesPriv)

const argv = require('minimist')(process.argv.slice(2), {
  default: {
    offset: 0,
    limit: Infinity,
    rows: null,
    outputHeader: false,
    input: './data/ES-ranking-targets.yaml',
    profile: 'nypl-digital-dev',
    envfile: './config/qa.env',
    outfile: 'out.csv',
    verbose: false
  },
  string: ['rows'],
  boolean: ['outputHeader', 'verbose']
})

require('dotenv').config({ path: argv.envfile || '.env' })

// Use creds from local profile:
setKmsCredentials(fromIni({ profile: argv.profile }))

/**
* Given a rank-eval target (JSONified representation of a row from
* ES-ranking-targets.yaml), returns the ES rank-eval call.
**/
const rankEvaluationCall = (target) => {
  const searchScope = {
    keyword: 'all',
    'journal title': 'title'
  }[target.scope] || target.scope
  const query = resourcesPriv.buildElasticQuery({ q: target.search, search_scope: searchScope })
  if (target.scope === 'journal title') {
    query.bool.filter = [{ term: { 'issuance.id': 'urn:biblevel:s' } }]
  }
  return {
    requests: [
      {
        id: 'report',
        request: {
          query
        },
        ratings: target.relevant
          .map((bnum, ind) => {
            return {
              _index: process.env.RESOURCES_INDEX,
              _id: bnum,
              // Higher "rating" indicates higher importance, but 'precision at
              // k' doesn't care about order, so set them all to 1, the default
              // relevant_rating_threshold:
              rating: 1
            }
          })
      }
    ],
    metric: {
      [target.metric]: {
        k: target.metric_at,
        relevant_rating_threshold: 1
      }
    }
  }
}

/**
* Given an array of rank-eval targets (JSONified representation of a row from
* ES-ranking-targets.yaml), resolves an array of objects that define:
*  - response: The ES response for the rank-eval call
*  - target: The original rank-eval target
*  - query: The ES rank-eval query used
**/
const runTargets = async (targets, index = 0, responses = []) => {
  const target = targets[index]

  if (!target) return responses

  const query = rankEvaluationCall(target)

  const client = await esClient()
  const translatedQuery = v8Client ? query : { body: query }
  const payload = Object.assign({}, translatedQuery, { index: process.env.RESOURCES_INDEX })
  const response = await await client.rankEval(payload)

  responses.push({
    response,
    target,
    query
  })
  return runTargets(targets, index + 1, responses)
}

/**
* Main function. Based on argv options, runs app specified rank-eval queries and reports results.
**/
const run = async () => {
  await loadConfig()

  const content = fs.readFileSync(argv.input, 'utf8')
  let targets = YAML.parseAllDocuments(content)
    .map((t) => t.toJS())
  if (argv.rows) {
    const rows = argv.rows
      .split(',')
      .map((i) => parseInt(i))
    if (argv.verbose) {
      console.info(`Restricting to rows: ${rows}`)
    }
    targets = targets.filter((_, i) => rows.includes(i))
  }

  const responses = await runTargets(targets)

  if (argv.verbose) {
    responses.forEach(({ target, query, response }) => {
      console.info('_________________________________________________________________')

      const result = {
        score: (response.body || response).details.report.metric_score
      }

      console.info(`Result: of ${target.metric}@${target.metric_at} test of "${target.search}" ${target.scope} query: ${result.score}`)
    })
  }

  const asCsv = []

  // Optionally add header:
  if (argv.outputHeader) {
    asCsv.push(
      ['Date', 'Commit', 'Changes'].concat(
        targets.map((target, index) => {
          return `${index}: ${target.metric}@${target.metric_at} test of "${target.search}" ${target.scope}`
        })
      )
    )
  }

  const date = new Date().toISOString()
  const commit = currentCommit()
  asCsv.push(
    [
      date,
      commit,
      // Need to manually copy the formula from another row because the
      // relative references aren't respsected when pasting a whole row in:
      ''
    ].concat(
      responses.map(({ response }) => {
        return (response.body || response).details.report.metric_score
      })
    )
  )

  const rows = stringify(asCsv, { delimiter: '\t' })
  fs.writeFileSync(argv.outfile, rows)

  console.info(rows)

  if (argv.verbose) {
    console.info(`Wrote results to ${argv.outfile}`)
  }
}

/**
* Get current git commit hash
**/
const currentCommit = () => {
  const execSync = require('child_process').execSync
  const output = execSync('git rev-parse HEAD').toString()
    .trim()
  return output
}

run()
