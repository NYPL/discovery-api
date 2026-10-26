const { getLinkedEntryForUri } = require('./elasticsearch/client')
const { NotFoundError } = require('./errors')

const doNyqlQueryForLinkedEntry = async (uri, linkedEntryObject, mismatchedIndex = false) => {
  const response = { message: 'nyql query response' }
  if (mismatchedIndex) response.potentiallyStaleData = true
  return response
}

const generateNyqlQuery = (uri, linkedEntryObject) => {
  const authorTitleClauseMap = {
    author: 'adj',
    title: 'adj',
    language: '='
  }
  const authorTitleClause = Object.entries(authorTitleClauseMap).map(([field, operator]) => {
    if (linkedEntryObject[field]) return `${field} ${operator} ${linkedEntryObject[field]}`
    else return null
  }).filter(Boolean).join(' and ')
  const identfiersClause = ['isbn', 'lccn', 'oclc', 'lccn'].map((field) => {
    const operator = '='
    const ids = Array.isArray(linkedEntryObject[field]) ? linkedEntryObject[field] : [linkedEntryObject[field]]
    return ids.map((id) => {
      if (id) return `${field} ${operator} ${id}`
      else return null
    })
  }).flat().filter(Boolean).join(' or ')
  const authorOrId = [authorTitleClause, identfiersClause].map((clause) => clause ? `(${clause})` : null).filter(Boolean).join(' or ')
  const bibClause = `bibnumber = ${uri}`

  return `(${authorOrId}) not ${bibClause}`
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

const theThing = async (params) => {
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

module.exports = {
  theThing,
  generateNyqlQuery
}
