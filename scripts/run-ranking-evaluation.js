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
*   To register the current commit in the versioned manifest file, indicating
*   it's a significant checkpoint and should appear in future reports:
*     node scripts/run-ranking-evaluation.js --add
*
*   To re-run all registered commits against the current target queries (i.e. when target queries change):
*     node scripts/run-ranking-evaluation.js --rebuildAll
*
*   To just rebuild the report from existing manifest (and open it):
*     node scripts/run-ranking-evaluation.js --skipRun --show
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
    rows: null,
    outputHeader: false,
    input: './data/ES-ranking-targets.yaml',
    profile: 'nypl-digital-dev',
    envfile: './config/qa.env',
    outfile: 'out.csv',
    verbose: false,
    rebuildAll: false
  },
  string: ['rows'],
  boolean: ['outputHeader', 'verbose', 'rebuildAll', 'skipRun']
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
  const start = new Date()
  const response = await client.rankEval(payload)
  const elapsed = (new Date()) - start

  responses.push({
    response,
    target,
    query,
    elapsed
  })
  return runTargets(targets, index + 1, responses)
}

/**
* Record run in manifest for future reports:
**/
const recordRun = (run, addToCommitsFile = false) => {
  console.log(`Saving ${run.commit} (${run.description}) to manifest`)

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
    if (addToCommitsFile) {
      fs.appendFileSync('./data/rank-evaluation-run-commits.csv', `${run.commit},"${run.description}"`)
    }
  } else {
    console.info(`Manifest already exists for ${run.commit}`)
  }
}

let buildEsQueryFn = null

const reloadbuildEsQueryFunction = (path) => {
  console.info(`Updating ES query building function from ${path}`)
  const _priv = {}
  require(path)({}, _priv)
  buildEsQueryFn = _priv.buildElasticQuery
}

const runTargetsOnCommits = async (targets, commits, index = 0) => {
  const commit = commits[index]

  console.log('___________________________________________________________________')
  console.log(`${index + 1} of ${commits.length}: ${commit.commit} (${commit.description})`)

  const baseDir = `/tmp/discovery-api-${index}`

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
    execSync(cmd)
  })

  // Clear require cache:
  Object.keys(require.cache).forEach((key) => { delete require.cache[key] })

  dotenv.config({ path: `${baseDir}/config/qa.env`, override: true })
  // Override oldest qa config:
  if (index === 0) {
    process.env.RESOURCES_INDEX = 'resources-2018-04-09'
  }

  reloadbuildEsQueryFunction(`${baseDir}/lib/resources`)

  const responses = await runTargets(targets)
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
  // Take the array of runs and turn it into an array of "tests" (representing a
  // single search target), collecting results over time
  const tests = manifest.reduce((tests, run) => {
    run.responses.forEach(({ target, query, response, elapsed }, ind) => {
      const testId = [target.search, target.scope, target.metric, target.metric_at, ...target.relevant].join('|')
        .replaceAll(/'/g, '-apos-')
        .replaceAll(/"/g, '-quot-')
        .replaceAll(/ /g, '_')
      if (!tests.find((t) => t.id === testId)) {
        tests.push({
          id: testId,
          target,
          query,
          results: []
        })
      }
      const test = tests.find((t) => t.id === testId)
      test.results.push(Object.assign({}, response, { commit: run.commit, description: run.description, elapsed }))
    })
    return tests
  }, [])

  const html = reportHtml(tests)
  fs.writeFileSync('./out.html', html)
}

const reportHtml = (tests) => {
  const colors = {
    red: '#920711',
    blue: '#00838a'
  }
  const mermaidOptions = {
    theme: 'base',
    themeVariables: {
      xyChart: {
        plotColorPalette: Object.values(colors).join(',')
      }
    }
  }
  return [
    '<!doctype html> <html lang="en">',
    '<head><style type="text/css">',
    '  body { font-family: sans-serif; }',
    '  textarea { display:inline-block; height:1px !important; width:1px !important; opacity:0 }',
    '  a.copy-to-clipboard::before { content: "\\01F4CB "; }',
    '  a.copy-to-clipboard:active::before { content: "\\2705 "; }',
    '  span.score, span.elapsed { display: inline-block; color: white; padding: 2px 7px; border-radius: 5px;, font-size: 0.85em; }',
    `  span.score { background-color: ${colors.blue}; }`,
    `  span.elapsed { background-color: ${colors.red}; }`,
    '</style>',
    '<script type="text/javascript">',
    `
    function copyQueryToClipboard (queryId) {
        const textarea = document.getElementById(queryId)
        textarea.select()
        try {
            return document.execCommand("copy");  // Security exception may be thrown by some browsers.
        } catch (ex) {
            console.warn("Copy to clipboard failed.", ex);
            return prompt("Copy to clipboard: Ctrl+C, Enter", text);
        }
    }
    `,
    '</script>',
    '</head>',
    '<body>',
    '<h1>RC Search Targets Over Time</h1>',
    '<h2>0. Overall</h2>',
    '<p>This shows average performance over all queries for each app version.',
    reportHtmlForOverall(tests),
    ...tests.map(reportHtmlForTest),
    '<script type="module">',
    'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"',
    'mermaid.initialize(',
    JSON.stringify(mermaidOptions),
    ')',
    '</script>',
    '</body></html>'
  ]
    .join('\n')
}

const reportHtmlForOverall = (tests) => {
  // Get collect scores for each run:
  const scoresByRun = tests.reduce((all, test) => {
    test.results.forEach((result, resultInd) => {
      if (!all[resultInd]) all[resultInd] = { scores: [], elapsed: [] }
      all[resultInd].description = result.description
      all[resultInd].scores.push(result.metric_score)
      all[resultInd].elapsed.push(result.elapsed)
    })
    return all
  }, {})

  Object.values(scoresByRun).forEach((run) => {
    run.averageScore = run.scores.reduce((sum, score) => sum + score, 0) / run.scores.length
    run.averageEllapsed = run.elapsed.reduce((sum, elapsed) => sum + elapsed, 0) / run.elapsed.length
  })

  const averageScores = Object.values(scoresByRun).map((score) => score.averageScore)

  let averageEllapsed = Object.values(scoresByRun).map((score) => score.averageEllapsed)
  const maxEllapsed = max(averageEllapsed)
  averageEllapsed = averageEllapsed.map((avg) => avg / maxEllapsed)

  const changeUrl = false
  return [
    chartHtmlForData(averageEllapsed, averageScores),
    '<h3>App versions</h3>',
    '<ul>',
    Object.values(scoresByRun).map((scores, ind) => {
      return [
        '<li>',
        changeUrl ? `<a href="${changeUrl}" target="_blank">` : '',
        `V${ind}`,
        changeUrl ? '</a>' : '',
        ` (${scores.description}):`,
        ` | <span class="score">average score ${scores.averageScore.toFixed(2)}</span>`,
        ` | <span class="elapsed">average ${scores.averageEllapsed.toFixed(0)}ms elapsed</span>`
      ].join('')
    }),
    '</ul>'
  ].join('\n')
}

const max = (values) => {
  return values.reduce((max, v) => Math.max(max, v), 0)
}

const reportHtmlForTest = (test, testIndex) => {
  const title = `${test.target.scope} "${test.target.search}": ${test.target.metric}@${test.target.metric_at}`

  const searchScope = {
    keyword: 'all',
    'journal title': 'journal_title'
  }[test.target.scope] || test.target.scope
  const qaUrl = `https://qa-www.nypl.org/research/research-catalog/search?q=${test.target.search}&search_scope=${searchScope}`
  const prodUrl = `https://www.nypl.org/research/research-catalog/search?q=${test.target.search}&search_scope=${searchScope}`

  return [
    `<h2>${testIndex + 1}. ${title}</h2>`,
    test.target.notes ? `<p>${test.target.notes}</p>` : '',
    `Search: <a href="${qaUrl}" target="_blank">QA</a> | <a href="${prodUrl}" target="_blank">Prod</a>`, // | <a href="${gitUrl}">Git diff</a>`,
    '<h3>Target records</h3>',
    '<ul>',
    ...test.target.relevant
      .map((bibid) => `<li><a href="https://www.nypl.org/research/research-catalog/bib/${bibid}">${bibid}</a></li>`),
    '</ul>',
    '<h3>App versions</h3>',
    reportHtmlForTestChart(test),
    '<ul>',
    ...test.results.map((result, ind) => reportHtmlForTestResult(test, result, ind)),
    '</ul>'
  ].join('\n')
}

const reportHtmlForTestChart = (test) => {
  const performanceYs = test.results.map((result) => result.metric_score)

  const maxLatency = test.results.reduce((max, result) => Math.max(max, result.elapsed), 0)
  const latencyYs = test.results.map((result) => result.elapsed / maxLatency)

  return chartHtmlForData(latencyYs, performanceYs)
}

const chartHtmlForData = (dimension1, dimension2) => {
  const xs = Object.keys(dimension1).map((ind) => `V${ind}`)

  return [
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
    `  line [${dimension1.join(', ')}]`,
    `  bar [${dimension2.join(', ')}]`,
    '</pre>'
  ].join('\n')
}

const reportHtmlForTestResult = (test, result, ind) => {
  const detail = result.details.report.metric_details[test.target.metric]
  const desc = `Found ${detail.relevant_docs_retrieved} of ${test.target.relevant.length}` +
    ': ' +
    result.details.report.hits
      .filter((hit) => hit.rating)
      .map((hit) => hit.hit._id)
      .sort((i1, i2) => i1 < i2 ? -1 : 1)
      .map((bibid) => `<a href="https://www.nypl.org/research/research-catalog/bib/${bibid}">${bibid}</a>`)
      .join(', ')
  let changeUrl = false
  if (ind > 0) {
    const previousCommit = test.results[ind - 1].commit
    changeUrl = `https://github.com/NYPL/discovery-api/compare/${previousCommit}...${result.commit}`
  }
  const queryId = `query-${test.id}-${ind}`
  return [
    '<li>',
    `<textarea id="${queryId}">${JSON.stringify(test.query, null, 2)}</textarea>`,
    changeUrl ? `<a href="${changeUrl}" target="_blank">` : '',
    `V${ind}`,
    changeUrl ? '</a>' : '',
    // FIXME: This isn't ready for prime time:
    // ` (<a href="javascript:void(copyQueryToClipboard('${queryId}'))" title="Copy query to clipboard" class="copy-to-clipboard">ES query</a>) `,
    ` (${result.description}):`,
    ` | <span class="score">score ${result.metric_score.toFixed(2)}</span>`,
    ` | <span class="elapsed">${result.elapsed}ms elapsed</span>`,
    `<ul><li>${desc}</li></ul></li>`
  ].join('')
}

/**
* Main function. Based on argv options, runs app specified rank-eval queries and reports results.
**/
const run = async (runCount = 0) => {
  // Use production config, unless otherwise specified:
  process.env.ENV = process.env.ENV || 'production'
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

  let manifest

  // Rebuild all manifests:
  if (argv.rebuildAll) {
    fs.writeFileSync('./data/rank-evaluation-run-manifest.json', '[]')

    const raw = fs.readFileSync('./data/rank-evaluation-run-commits.csv', 'utf8')
    const commits = csvParse(raw, {
      columns: true,
      skip_empty_lines: true
    })

    await runTargetsOnCommits(targets, commits)
    manifest = require('../data/rank-evaluation-run-manifest.json')
  }

  // Run rank eval for current code:
  if (!argv.skipRun) {
    manifest = require('../data/rank-evaluation-run-manifest.json')

    // If we intend to save the current run, require a description:
    if (argv.add && !argv.description) {
      console.log('Specify --description DESC to give the commit a label in the manifest')
      process.exit()
    }

    reloadbuildEsQueryFunction('../lib/resources')

    // Run rank-eval for current code for all target queries:
    const responses = await runTargets(targets)
    const currentRun = {
      date: new Date().toISOString(),
      commit: currentCommit(),
      description: argv.description || '[Current commit]',
      responses
    }
    manifest.push(currentRun)

    // Save run permanently into manifest?
    if (argv.add && !(argv.rebuildTwice && runCount < 1)) {
      recordRun(currentRun, true)
    }
  }

  if (argv.rebuildTwice && runCount < 1) {
    console.log('---------------------------------------------------------------')
    console.log('Re-running everything')
    console.log('---------------------------------------------------------------')
    return run(runCount + 1)
  }

  // Rebuild report (out.html):
  buildFullReport(manifest || require('../data/rank-evaluation-run-manifest.json'))

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
