const { getLinkedEntryForUri } = require('./elasticsearch/client')
const logger = require('./logger')
const { NotFoundError } = require('./errors')

const doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  const response = { message: 'nyql query' }
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}

const generateNyqlQuery = (uri, linkedEntryObject) => {
  console.log(`nyql query for ${uri}`)
}

exports.theThing = async (params) => {
  const linkedEntries = await getLinkedEntryForUri(params.uri)
  const returnWholeOrPartialMatch = (linkedEntry) => {
    const hashMatches = params.hash === linkedEntry.hash
    const marcTagMatches = params.marcTag === linkedEntry.marcTag
    const indexMatches = params.marcTagIndex === linkedEntry.marcTagIndex
    const wholeMatch = hashMatches && marcTagMatches && indexMatches
    const partialMatch = hashMatches && marcTagMatches && !indexMatches
    if (!(wholeMatch || partialMatch)){ 
      return false
    }
    return { wholeMatch, partialMatch }
  }
  const match = linkedEntries.filter(returnWholeOrPartialMatch)[0]
  if (!match) throw new NotFoundError('Linking entry link is incorrect/out of date.')
  return match
  }
