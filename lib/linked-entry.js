const { getLinkingEntriesForUri } = require('./elasticsearch/client')
const { LinkingEntryBadLinkError } = require('./errors')
const generateNyqlQuery = (uri, linkingEntryObject) => {
  const authorTitleClauseMap = {
    author: 'adj',
    title: 'adj',
    language: '='
  }
  const authorTitleClause = Object.entries(authorTitleClauseMap).map(([field, operator]) => {
    if (linkingEntryObject[field]) return `${field} ${operator} "${linkingEntryObject[field]}"`
    else return null
  }).filter(Boolean).join(' and ')
  const identfiersClause = ['isbn', 'oclc', 'lccn'].map((field) => {
    const operator = '='
    const ids = Array.isArray(linkingEntryObject[field]) ? linkingEntryObject[field] : [linkingEntryObject[field]]
    return ids.map((id) => {
      if (id) {
        return `${field} ${operator} "${id}"`
      } else return null
    })
  }).flat().filter(Boolean).join(' or ')
  const authorOrId = [authorTitleClause, identfiersClause].map((clause) => clause ? `(${clause})` : null).filter(Boolean).join(' or ')
  const bibClause = `bibnumber = ${uri}`

  return `(${authorOrId}) not ${bibClause}`
}

const findMatchingLinkingEntry = (params, linkingEntries) => {
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
  const matches = linkingEntries.map(returnWholeOrPartialMatch).filter(Boolean)
  if (!matches.length) return null
  // Prefer an exact (whole) match over a partial one, regardless of which
  // appears first in the array. Contrived case, unclear if this would every actually happen:
  return matches.find((match) => !match.partialMatch) || matches[0]
}

const getNyqlQueryForParams = async (params) => {
  const linkingEntries = await getLinkingEntriesForUri(params.uri)
  const match = findMatchingLinkingEntry(params, linkingEntries)
  if (!match) throw new LinkingEntryBadLinkError(`Request params: ${JSON.stringify(params)}\nLinking entries: ${JSON.stringify(linkingEntries)}`)
  const { partialMatch, linkingEntry } = match
  const query = generateNyqlQuery(params.uri, linkingEntry)
  return { query, partialMatch }
}

module.exports = {
  getNyqlQueryForParams,
  generateNyqlQuery,
  findMatchingLinkingEntry
}
