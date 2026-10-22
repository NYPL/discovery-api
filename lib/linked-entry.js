const { getLinkedEntryForUri } = require('./elasticsearch/client')
const logger = require('./logger')
const { NotFoundError } = require('./errors')

const doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  const response = { message: 'nyql query' }
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}

const generateNyqlQuery = (uri, linkedEntryObject) => {
  console.log(`performing nyql query for ${uri}`)
  return 
}

const findMatchingLinkedEntry = (params, linkedEntries) => {
  const returnWholeOrPartialMatch = (linkedEntry) => {
    const hashMatches = params.hash === linkedEntry.hash
    const marcTagMatches = params.marcTag === linkedEntry.marcTag
    const indexMatches = params.marcTagIndex === linkedEntry.marcTagIndex
    const wholeMatch = hashMatches && marcTagMatches && indexMatches
    const partialMatch = hashMatches && marcTagMatches && !indexMatches
    if (!(wholeMatch || partialMatch)){
      return false
    }
    return { partialMatch, linkedEntry }
  }
  const match = linkedEntries.map(returnWholeOrPartialMatch).filter(Boolean)[0]
  return match
}

exports.theThing = async (params) => {
  const linkedEntries = await getLinkedEntryForUri(params.uri)
  const match = findMatchingLinkedEntry(params, linkedEntries)
  if (!match) throw new NotFoundError(`Linking entry link is incorrect/out of date: ${JSON.stringify([params, linkedEntries])}.`)
  const { partialMatch, linkedEntry } = match
  const nyqlQuery = generateNyqlQuery(params.uri, linkedEntry)
  if(partialMatch){
    console.log('indicate data may be out of date because index is off')
  }
  return doNyqlQuery(nyqlQuery) 
  }
