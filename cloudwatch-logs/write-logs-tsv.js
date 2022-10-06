const { readFileSync, writeFileSync, readdirSync } = require('fs')

/**
 * A script to generate a TSV file that organizes discovery API search queries. 
 * To rerun script without downloading more logs, run without arguments
 * Depends on local installation of awslogs:
 *    brew install awslogs 
 * or 
 *    pip install awslogs
 * 
 * Usage:
 * 
 * node logs --start START --end END
 * 
 * Start and end can be any number of days, weeks, or hours back, or a date
 * 1h
 * 3d
 * 2w
 * 10/4/2022
 * 
 */

// const argv = require('minimist')(process.argv.slice(2))

// const { start, end } = argv

const convertToTSV = (arr) => {
  const array = [Object.keys(arr[0])].concat(arr)
  return array.map((log) => {
    return Object.values(log).join('\t')
  }).join('\n')
}

function returnMatch (log, match) {
  if (log.match(match)) {
    return log.match(match)[1]
  } else return null
}

const regExpressions = {
  timestamp: /\[(.*?)\]/,
  searchScope: /&search_scope=(.*?)$/,
  query: /q=+(.*?)(&|$)/,
  contributor: /contributor=(.*?)(&|$)/,
  title: /title=(.*?)(&|$)/,
  subject: /subject=(.*?)(&|$)/
}

const parseLogs = (logs) => {
  // loop through array of logs
  return logs.map((log) => {
    let request = decodeURIComponent(log)
    return Object.keys(regExpressions).reduce((obj, param) => {
      const extractedValue = returnMatch(request, regExpressions[param])
      return {
        ...obj, [param]: extractedValue
      }
    }, {})
  })
    .filter(request => request)
}

const writeLogs = () => {
  const logs = readdirSync('cloudwatch-logs/logs-out')
  const parsedLogs = logs.map((logFilePath) => {
    const logFile = readFileSync('cloudwatch-logs/logs-out/' + logFilePath, 'utf-8')
    return parseLogs(logFile.split('\t'))
  })
  writeFileSync('./logsOut.tsv', convertToTSV(parsedLogs.flat()))
}

writeLogs()


// code for getting filters information

// filterField: {
//   match: /filters\[(.*?)\]=/,
//   get: returnMatch
// },
// filterOptions: {
//   match: /filters\[.*?\]=(.*?)&(?:per_|page)/,
//   get (log) {
//     if (log.match(this.match)) {
//       return log.match(this.match)[1]
//         // we are replacing on a value that looks like this:
//         // 'Muslim+scholars+--+Nigeria+--+Biography
//         // remove commas for readability
//         .replace(/,/g, '')
//         // put commas in between options to split into array on comma
//         .replace(/\+--\+/g, ',')
//         .split(',')
//     }
//   },
// },