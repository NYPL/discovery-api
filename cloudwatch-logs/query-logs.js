const { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } = require("@aws-sdk/client-cloudwatch-logs")
const { writeFileSync } = require('fs')

const client = new CloudWatchLogsClient({ accessKeyId: 'AKIA5YTHPEF4S7ZQNPX7', secretAccessKey: '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', region: 'us-east-1' });

const start = new Date();
start.setMonth(start.getMonth() - 3)
const end = Date.now()

const inputs = []
for (let i = 0; i < 20; i++) {
  start.setDate(start.getDate() + 2)
  inputs.push({
    "endTime": end,
    "logGroupName": "/aws/elasticbeanstalk/discovery-api-production/var/log/nginx/access.log",
    "queryString": "fields @message | sort @timestamp desc | filter @message like \"/resources?\" | filter @message not like \"filters\" | limit 10000 | filter @message not like \"oclc\"",
    "startTime": Date.parse(start)
  })
}

const delay = async (time) => new Promise((resolve) => setTimeout(resolve, time))

const checkResultStatusAndDownload = async (queryIds, completedQueries = {}, numberOfChecks = 1) => {
  while (queryIds.length !== Object.keys(completedQueries).length) {
    console.log('starting check ' + numberOfChecks)
    await Promise.all(queryIds.map(async (queryId, i) => {
      // Ensure there are less than 5 requests per second to avoid throttling
      await delay(220)
      if (!completedQueries[queryId]) {
        const queryResultsCommand = new GetQueryResultsCommand({ queryId })
        try {
          const { status, results } = await client.send(queryResultsCommand)
          if (status === 'Complete') {
            console.log(`query at index ${i} complete`)
            const queryResults = results.map(result => {
              const value = result[0].value.split(' ')
              return `${value[3]}]  ${value[6]}`
            }).join('\t')
            writeFileSync(`./logs-out/log-${queryId.split('-')[0]}.txt`, queryResults)
            completedQueries[queryId] = true
          }
        } catch (e) {
          if (e.__type === "ThrottlingException") console.log('throttle exception')
          else if (e.__type === 'LimitExceededException') console.log('query limit reached')
          else console.log(e)
        }
      }
    }))
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

