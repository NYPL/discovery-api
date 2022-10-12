const { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } = require("@aws-sdk/client-cloudwatch-logs")
const { writeFileSync } = require('fs')
const aws = require('aws-sdk')

const awsInit = (profile) => {
  // Set aws creds:
  aws.config.credentials = new aws.SharedIniFileCredentials({
    profile: profile || 'nypl-digital-dev'
  })

  // Set aws region:
  const awsSecurity = { region: 'us-east-1' }
  aws.config.update(awsSecurity)
}

awsInit()

const client = new CloudWatchLogsClient();

const start = new Date();
start.setMonth(start.getMonth() - 3)

const inputs = []
for (let i = 0; i < 7; i++) {
  inputs.push({
    "startTime": Date.parse(start),
    "endTime": start.setDate(start.getDate() + 2),
    "logGroupName": "/aws/elasticbeanstalk/discovery-api-production/var/log/nginx/access.log",
    "queryString": "fields @message | sort @timestamp desc | filter @message like \"/resources?\" | filter @message not like \"filters\" | limit 10000 | filter @message not like \"oclc\"",
  })
}

const delay = async (time) => new Promise((resolve) => setTimeout(resolve, time))

const hitAws = async (queryResultsCommand, queryId, completedQueries, i) => {
  try {
    const { status, results } = await client.send(queryResultsCommand)
    if (status === 'Complete') {
      console.log(`query at index ${i} complete`)
      const queryResults = results.map(result => {
        const value = result[0].value.split(' ')
        // extract the timestamp and the get request
        return `${value[3]}]  ${value[6]}`
      }).join('\t')
      completedQueries[queryId] = true
      return queryResults
    }
  } catch (e) {
    if (e.__type === "ThrottlingException") {
      throw 'throttle exception. too many requests at once'
    }
    else if (e.__type === 'LimitExceededException') {
      throw 'query limit reached (20 concurrent queries)'
    } else console.log(e)
  }
}

const checkResultStatusAndDownload = async (queryIds, completedQueries = {}, numberOfChecks = 1) => {
  await Promise.all(queryIds.map(async (queryId, i) => {
    if (completedQueries[queryId]) return Promise.resolve()
    const queryResultsCommand = new GetQueryResultsCommand({ queryId })
    const queryResults = await hitAws(queryResultsCommand, queryId, completedQueries, i)
    if (queryResults) writeFileSync(`./logs-out/log-${queryId.split('-')[0]}.txt`, queryResults)
  }))
  if (queryIds.length !== Object.keys(completedQueries).length) {
    console.log('starting check ' + numberOfChecks)
    await delay(10000)
    return await checkResultStatusAndDownload(queryIds, completedQueries, ++numberOfChecks)
  }
  return true
}

const queryAndWriteDiscoveryApiLogs = async () => {
  const queryIds = await Promise.all(inputs.map(async (input) => {
    const startQueryCommand = new StartQueryCommand(input)
    let queryId
    try {
      ({ queryId } = await client.send(startQueryCommand))
    } catch (e) {
      console.log(e)
    }
    return queryId
  }))

  await checkResultStatusAndDownload(queryIds)
}

queryAndWriteDiscoveryApiLogs()

