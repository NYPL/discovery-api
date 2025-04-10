/**
* This script runs a series of rank-eval calls against the configured index to
* produce a bunch of numbers from 0 to 1 that represent relevancy performance
# across a number of metics. We collect these numbers in a spreadsheet to track
* relevancy performance over time.
*
* Usage:
*   To build and view a report using the currently checked out code:
*     node scripts/run-ranking-evaluation.js --open
*
*   To register the current commit as an official commit for later reports:
*     node scripts/run-ranking-evaluation.js --add
*
*   To re-run all registered commits against the current target queries (i.e. when target queries change):
*     node scripts/run-ranking-evaluation.js --rebuildAll
*/
const fs = require('fs')
const YAML = require('yaml')
const { fromIni } = require('@aws-sdk/credential-providers')
const dotenv = require('dotenv')
const { parse: csvParse } = require('csv-parse/sync')
const { execSync } = require('child_process')

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
    verbose: false,
    rebuildAll: false,
    description: '[Current commit]'
  },
  string: ['rows'],
  boolean: ['outputHeader', 'verbose', 'rebuildAll']
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
  const query = buildEsQueryFn({ q: target.search, search_scope: searchScope })
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
* Record run in manifest for future reports:
**/
const recordRun = (run) => {
  const manifestPath = './data/rank-evaluation-run-manifest.json'
  const runManifestRaw = fs.existsSync(manifestPath)
    ? fs.readFileSync(manifestPath)
    : '[]'
  const runManifest = JSON.parse(runManifestRaw)

  const exists = runManifest
    .find((run) => run.commit === currentCommit())
  if (!exists) {
    runManifest.push(run)

    // Save run in updated manifest:
    fs.writeFileSync(manifestPath, JSON.stringify(runManifest, null, 2))

    // Register this commit:
    fs.eppendFileSync('./data/rank-evaluation-run-commits.csv', `${run.commit},"${run.description}"`)
  } else {
    console.log(`Manifest already exists for ${run.commit}`)
  }
}

const _priv = {}
let buildEsQueryFn = null
require('../lib/resources')({}, _priv)
buildEsQueryFn = _priv.buildElasticQuery

const runTargetsOnCommits = async (targets, commits, index = 0) => {
  const commit = commits[index]

  const baseDir = '/tmp/discovery-api'

  let cmds = []
  if (!fs.existsSync(baseDir)) {
    cmds.push(`git clone git@github.com:NYPL/discovery-api.git ${baseDir}`)
  }
  console.log(`Checking out ${commit.commit}`)
  cmds = cmds.concat([
    `cd ${baseDir}; git checkout ${commit.commit}`,
    `cd ${baseDir}; npm i`
  ])
  cmds.forEach((cmd) => {
    console.log(`Calling: ${cmd}`)
    execSync(cmd)
  })

  // Clear require cache:
  Object.keys(require.cache).forEach((key) => { delete require.cache[key] })

  dotenv.config({ path: `${baseDir}/config/qa.env`, override: true })
  // Override oldest qa config:
  if (index === 0) {
    process.env.RESOURCES_INDEX = 'resources-2018-04-09'
  }

  const _priv = {}
  require(`${baseDir}/lib/resources`)({}, _priv)
  buildEsQueryFn = _priv.buildElasticQuery

  console.log('Running targets...')
  // execSync('node ./scripts/run-ranking-evaluation-copy-2.js')
  const responses = await runTargets(targets)
  console.log('Got responses: ', responses.map((r) => r.response.metric_score))
  recordRun({
    date: new Date().toISOString(),
    commit: commit.commit,
    description: commit.description,
    responses
  })

  if (commits.length > index + 1) {
    return runTargetsOnCommits(targets, commits, index + 1)
  }
}

/**
* Given the data in the rank-evaluation-run-manifest
* builds a HTML report showing evaluations over time.
**/
const buildFullReport = (manifest) => {
  const tests = manifest.reduce((tests, run) => {
    run.responses.forEach(({ target, response }, ind) => {
      const testId = [target.search, target.scope, target.metric, target.metric_at, ...target.relevant].join('|')
      if (!tests.find((t) => t.id === testId)) {
        tests.push({
          id: testId,
          target,
          results: []
        })
      }
      const test = tests.find((t) => t.id === testId)
      test.results.push(Object.assign({}, response, { commit: run.commit, description: run.description }))
    })
    return tests
  }, [])

  const html = [
    '<!doctype html> <html lang="en">',
    '<head><style type="text/css">body { font-family: sans-serif; }</style></head>',
    '<body>',
    '<h1>RC Search Targets Over Time</h1>',
    ...tests.map((test) => {
      const xs = Object.keys(test.results).map((ind) => `V${ind}`)
      const ys = test.results.map((result) => result.metric_score) // Object.values(test.results)
      const title = `${test.target.scope} "${test.target.search}": ${test.target.metric}@${test.target.metric_at}`

      const searchScope = {
        keyword: 'all',
        'journal title': 'journal_title'
      }[test.target.scope] || test.target.scope
      const qaUrl = `https://qa-www.nypl.org/research/research-catalog/search?q=${test.target.search}&search_scope=${searchScope}`
      const prodUrl = `https://www.nypl.org/research/research-catalog/search?q=${test.target.search}&search_scope=${searchScope}`

      return [
        `<h2>${title}</h2>`,
        test.target.notes ? `<p>${test.target.notes}</p>` : '',
        `Search: <a href="${qaUrl}" target="_blank">QA</a> | <a href="${prodUrl}" target="_blank">Prod</a>`, // | <a href="${gitUrl}">Git diff</a>`,
        '<pre class="mermaid"">',
        '---',
        'config:',
        '    xyChart:',
        '        width: 900',
        '        height: 150',
        '        yAxis:',
        '            showLabel: false',
        '---',
        'xychart-beta',
        `  x-axis [${xs.join(', ')}]`,
        '  y-axis "Performance" 0 --> 1',
        `  line [${ys.join(', ')}]`,
        `  bar [${ys.join(', ')}]`,
        '</pre>',
        '<h3>Target records</h3>',
        '<ul>',
        ...test.target.relevant
          .map((bibid) => `<li><a href="https://qa-www.nypl.org/research/research-catalog/bib/${bibid}">${bibid}</a></li>`),
        '</ul>',
        '<h3>Search versions</h3>',
        '<ul>',
        ...test.results.map((result, ind) => {
          const detail = result.details.report.metric_details[test.target.metric]
          const desc = `Found ${detail.relevant_docs_retrieved} of ${test.target.relevant.length}` +
            ': ' +
            result.details.report.hits
              .filter((hit) => hit.rating)
              .map((hit) => hit.hit._id)
              .sort((i1, i2) => i1 < i2 ? -1 : 1)
              .map((bibid) => `<a href="https://qa-www.nypl.org/research/research-catalog/bib/${bibid}">${bibid}</a>`)
              .join(', ')
          return `<li>V${ind} (${result.description}): score ${result.metric_score}<ul><li>${desc}</li></ul></li>`
        }),
        '</ul>'
      ].join('\n')
    }),
    '<script type="module">',
    'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"',
    'mermaid.initialize({',
    "  'theme': 'forest',",
    "  'themeVariables': {",
    '  }',
    '})',
    '</script>',
    '</body></html>'
  ]
    .join('\n')
  fs.writeFileSync('./out.html', html)
}

/**
* Main function. Based on argv options, runs app specified rank-eval queries and reports results.
**/
const run = async () => {
  await loadConfig()

  // Load search targets:
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

  // Rebuild all manifests:
  if (argv.rebuildAll) {
    const raw = fs.readFileSync('./data/rank-evaluation-run-commits.csv', 'utf8')
    const commits = csvParse(raw, {
      columns: true,
      skip_empty_lines: true
    })

    runTargetsOnCommits(targets, commits)

    return
  }

  const manifest = require('../data/rank-evaluation-run-manifest.json')

  // Run rank-eval for current code for all target queries:
  const responses = await runTargets(targets)
  const currentRun = {
    date: new Date().toISOString(),
    commit: currentCommit(),
    description: argv.description,
    responses
  }
  manifest.push(currentRun)

  // Save run permanently into manifest?
  if (argv.add) {
    recordRun(currentRun)
  }

  // Rebuild report (out.html):
  buildFullReport(manifest)

  // If --open flag used, open report:
  if (argv.open) {
    execSync('open out.html')
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
