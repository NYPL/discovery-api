const { backslashes } = require('../util')

const QUERY_STRING_QUERY_FIELDS = {
  date: { field: 'dateStartYear' },
  subject: { field: 'subjectLiteral' },
  creator: { field: 'creatorLiteral' },
  publisher: { field: 'publisherLiteral' },
  title: { field: 'title' }
}

/**
 * Given a string, returns the string with all unsupported ES control
 * characters escaped. In particular, escapes:
 *
 *  - Specials: '&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}', '/', '\', '+', '-', '=', '(', ')'
 *  - Colons, except when used in a supported query string query field (e.g. title:Romeo)
 */
const escapeQuery = function (str) {
  // Escape characters/phrases that should always be escaped:
  const specials = ['&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}', '(', ')', '\\', '+', '-', '=']
  const specialsEscaped = specials.map((phrase) => backslashes(phrase))
  str = str.replace(new RegExp(specialsEscaped.join('|'), 'gi'), (phrase) => backslashes(phrase))

  // Escape forward slashes as a special case
  str = str.replace(/\//g, '\\/')

  // Escape query-string-query fields that we don't recognize:
  //  e.g. We allow "title:..", but we escape the colon in "fladeedle:..."
  const allowedFields = Object.keys(QUERY_STRING_QUERY_FIELDS)
  const unrecognizedFieldQueryRegex = new RegExp(`(^|\\s)(?!(${allowedFields.join('|')}))[^\\s]+(:)`, 'g')
  str = str.replace(unrecognizedFieldQueryRegex, (match) => {
    return match.replace(/:/, '\\:')
  })

  // Escape floating colons
  str = str.replace(/(^|\s):/g, '$1\\:')

  return str
}

/**
* Given a ES query clause, adds given name property when `NAME_QUERIES` env is true
*/
const namedQuery = (query, name) => {
  const namedQueriesEnabled = process.env.NAME_QUERIES === 'true'

  if (!namedQueriesEnabled) return query

  return Object.assign(query, { _name: name })
}

/**
* Generic util for building a ES clause given a named matcher (e.g. term, prefix)
*/
const buildEsMatchClause = (matcher, field, value, boost) => {
  let clause = {
    [matcher]: {
      [field]: namedQuery({
        value,
        boost
      }, `${matcher} ${field}`)
    }
  }
  // Nested field?
  if (['items', 'holdings'].includes(field.split('.').shift())) {
    clause = {
      nested: {
        path: field.split('.').shift(),
        query: clause
      }
    }
  }

  return clause
}

/**
* Given a field name and a value, returns a plainobject representing a ES
* `prefix` clause that can be inserted into a ES query
*/
const prefixMatch = (field, value, boost = 1) => {
  return buildEsMatchClause('prefix', field, value, boost)
}

/**
* Given a field name and a value, returns a plainobject representing a ES
* `term` clause that can be inserted into a ES query
*/
const termMatch = (field, value, boost = 1) => {
  return buildEsMatchClause('term', field, value, boost)
}

/**
* Given a field name and a value, returns a plainobject representing a ES
* `match_phrase` clause that can be inserted into a ES query
*/
const phraseMatch = (field, value, boost = 0) => {
  return {
    match_phrase: {
      [field]: namedQuery({
        query: value,
        boost
      }, `match_phrase ${field}`)
    }
  }
}

module.exports = {
  namedQuery,
  escapeQuery,
  prefixMatch,
  termMatch,
  phraseMatch
}
