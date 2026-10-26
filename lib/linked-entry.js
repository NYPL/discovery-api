const { getLinkedEntryForUri } = require('./elasticsearch/client')
const { NotFoundError } = require('./errors')

const doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  const response = { message: 'nyql query response' }
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}

const generateNyqlQuery = (uri, linkedEntryObject) => {
  console.log(`performing nyql query for ${uri}`)
}

const findMatchingLinkedEntry = (params, linkedEntries) => {
  const returnWholeOrPartialMatch = (linkedEntry) => {
    const hashMatches = params.hash === linkedEntry.hash
    const marcTagMatches = params.marcTag === linkedEntry.marcTag
    const indexMatches = params.marcTagIndex === linkedEntry.marcTagIndex
    const wholeMatch = hashMatches && marcTagMatches && indexMatches
    const partialMatch = hashMatches && marcTagMatches && !indexMatches
    if (!(wholeMatch || partialMatch)) {
      return false
    }
    return { partialMatch, linkedEntry }
  }
  const matches = linkedEntries.map(returnWholeOrPartialMatch).filter(Boolean)
  // Prefer an exact (whole) match over a partial one, regardless of which
  // appears first in the array. Contrived case, unclear if this would every actually happen:
  return matches.find((match) => !match.partialMatch) || matches[0]
}

exports.theThing = async (params) => {
  const linkedEntries = await getLinkedEntryForUri(params.uri)
  const match = findMatchingLinkedEntry(params, linkedEntries)
  if (!match) throw new NotFoundError(`Linking entry link is incorrect/out of date: ${JSON.stringify([params, linkedEntries])}.`)
  const { partialMatch, linkedEntry } = match
  generateNyqlQuery(params.uri, linkedEntry)
  if (partialMatch) {
    console.log('indicate data may be out of date because index is off')
  }
  return doNyqlQueryForLinkedEntry(params.uri, linkedEntry, partialMatch)
}
