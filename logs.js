const { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } = require("@aws-sdk/client-cloudwatch-logs"); // CommonJS import

const client = new CloudWatchLogsClient({ accessKeyId: 'AKIA5YTHPEF4S7ZQNPX7', secretAccessKey: '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', region: 'us-east-1' });

const start = new Date();
start.setMonth(start.getMonth() - 3)
const end = Date.now()

const inputs = []
for (let i = 0; i < 3; i++) {
  start.setDate(start.getDate() + 2)
  inputs.push({
    "endTime": end,
    "logGroupName": "/aws/elasticbeanstalk/discovery-api-production/var/log/nginx/access.log",
    "queryString": "fields @message | sort @timestamp desc | filter @message like \"/resources?\" | filter @message not like \"filters\" | limit 10 | filter message not like \"oclc\"",
    "startTime": Date.parse(start)
  })
}

const delay = async (time) => new Promise((resolve) => setTimeout(resolve, time))

const theThing = async () => {
  const queryIds = await Promise.all(inputs.map(async (input) => {
    const startQueryCommand = new StartQueryCommand(input)
    let queryId
    try {
      ({ queryId } = await client.send(startQueryCommand))
    } catch (e) {
      console.log(e)
    }
    await delay(1000)
    return queryId
  }))
  await delay(300000)
  console.log('middle delay')

  const queryResults = await Promise.all(queryIds.map(async (queryId) => {
    const queryResultsCommand = new GetQueryResultsCommand({ queryId })
    let queryResult
    try {
      ({ results } = await client.send(queryResultsCommand))
      queryResult = results
    } catch (e) {
      console.log(e)
    }
    await delay(1000)
    return queryResult
  }))
  console.log(queryResults)
}

theThing()

