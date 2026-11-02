const { getLinkingEntriesForUri } = require('./elasticsearch/client')
const { NotFoundError } = require('./errors')
const generateNyqlQuery = (uri, linkingEntryObject) => {
  const authorTitleClauseMap = {
    author: 'adj',
    title: 'adj',
    language: '='
  }
  const authorTitleClause = Object.entries(authorTitleClauseMap).map(([field, operator]) => {
    if (linkingEntryObject[field]) return `${field} ${operator} ${linkingEntryObject[field]}`
    else return null
  }).filter(Boolean).join(' and ')
  const identfiersClause = ['isbn', 'lccn', 'oclc', 'lccn'].map((field) => {
    const operator = '='
    const ids = Array.isArray(linkingEntryObject[field]) ? linkingEntryObject[field] : [linkingEntryObject[field]]
    return ids.map((id) => {
      if (id) {
        id = id.split(')')[1] || id
        return `${field} ${operator} ${id}`
      } else return null
    })
  }).flat().filter(Boolean).join(' or ')
  const authorOrId = [authorTitleClause, identfiersClause].map((clause) => clause ? `(${clause})` : null).filter(Boolean).join(' or ')
  const bibClause = `bibnumber = ${uri}`

  return `(${authorOrId}) and not (${bibClause})`
}

const findMatchingLinkingEntry = (params, linkedEntries) => {
  const returnWholeOrPartialMatch = (linkingEntry) => {
    const hashMatches = params.hash === linkingEntry.hash
    const marcTagMatches = params.marcTag === linkingEntry.marcTag
    const indexMatches = params.marcTagIndex === linkingEntry.marcTagIndex
    const wholeMatch = hashMatches && marcTagMatches && indexMatches
    const partialMatch = hashMatches && marcTagMatches && !indexMatches
    if (!(wholeMatch || partialMatch)) {
      return false
    }
    return { partialMatch, linkingEntry }
  }
  const matches = linkedEntries.map(returnWholeOrPartialMatch).filter(Boolean)
  if (!matches.length) return null
  // Prefer an exact (whole) match over a partial one, regardless of which
  // appears first in the array. Contrived case, unclear if this would every actually happen:
  return matches.find((match) => !match.partialMatch) || matches[0]
}

const getNyqlQueryForParams = async (params) => {
  const linkedEntries = await getLinkingEntriesForUri(params.uri)
  const match = findMatchingLinkingEntry(params, linkedEntries)
  if (!match) throw new NotFoundError(`Linking entry link is incorrect/out of date \n\tparams: ${JSON.stringify(params)}\n\t linking entries: ${JSON.stringify(linkedEntries)}.`)
  const { partialMatch, linkingEntry } = match
  const query = generateNyqlQuery(params.uri, linkingEntry)
  if (partialMatch) {
    console.log('indicate data may be out of date because index is off')
  }
  return { query, partialMatch }
}

module.exports = {
  getNyqlQueryForParams,
  generateNyqlQuery,
  findMatchingLinkingEntry
}
