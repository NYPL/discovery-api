const generateNyqlQuery = (uri, linkedEntryObject) => {
  console.log(uri)
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
      if (id) {
        id = id.split(')')[1] || id
        return `${field} ${operator} ${id}`}
      else return null
    })
  }).flat().filter(Boolean).join(' or ')
  const authorOrId = [authorTitleClause, identfiersClause].map((clause) => clause ? `(${clause})` : null).filter(Boolean).join(' or ')
  const bibClause = `bibnumber = ${uri}`

  return `(${authorOrId}) and not (${bibClause})`
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

module.exports = {
  generateNyqlQuery,
  findMatchingLinkedEntry,
}
