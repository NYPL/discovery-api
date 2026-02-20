const { parseWithRightCql } = require('./cql_grammar')
const { indexMapping } = require('./cql/index-mapping')
const ElasticQueryBuilder = require('./elastic-query-builder')

function buildEsQuery (cqlQuery, request = null) {
  const filterQuery = buildFilterQuery(request)
  return {
    bool: {
      should: [
        buildEsQueryFromTree(
          parseWithRightCql(cqlQuery.trim())
        )
      ]
    },
    ...filterQuery
  }
}

function buildFilterQuery (request) {
  if (!request) return {}
  const queryJson = ElasticQueryBuilder.forApiRequest(request).query.toJson()
  if (queryJson.bool && queryJson.bool.filter) {
    return { filter: queryJson.bool.filter }
  }
  return {}
}

/**
 this is mostly there but needs to handle exact strings
 */

function buildEsQueryFromTree (tree) {
  switch (tree.type) {
    case 'query': {
      const queries = tree.children.filter(child => child.type.includes('query'))
      const connectives = tree.children.filter(child => child.type === 'connective')
      if (connectives.length) {
        return buildBoolean(connectives[0].text, queries)
      }
      return buildEsQueryFromTree(queries[0])
    }
    case 'sub_query': {
      const query = tree.children.filter(child => child.type.includes('query'))[0]
      return buildEsQueryFromTree(query)
    }
    case 'atomic_query': {
      return buildAtomic(atomicQueryParams(tree))
    }
    default:
      break
  }
}

function buildBoolean (operator, queries) {
  if (['NOT', 'AND NOT'].includes(operator)) return buildNegation(queries)
  const esOperator = operator === 'AND' ? 'must' : 'should'
  return {
    bool: {
      [esOperator]: queries.map(query => buildEsQueryFromTree(query))
    }
  }
}

function buildNegation (queries) {
  return {
    bool: {
      must: [buildEsQueryFromTree(queries[0])],
      must_not: [buildEsQueryFromTree(queries[1])]
    }
  }
}

/**
  A convienience method that collect the scope, relation, the full query (i.e term), and
  all the separate words in the query (i.e. the terms)
 */
function atomicQueryParams (atomicQuery) {
  return {
    scope: atomicQuery.children.find(child => child.type === 'scope').text.trim(),
    relation: atomicQuery.children.find(child => child.type === 'relation').text.trim(),
    term: findTopPhrase(atomicQuery),
    terms: findTopWords(atomicQuery)
  }
}

/**
  Find the highest (i.e. most inclusive) phrase node and return its text
  Ex: if the query was keyword="Hamlet Shakespeare", there will be phrase nodes
  for Hamlet Shakespeare, Hamlet, and Shakespeare, and this will return Hamlet Shakespeare
 */
function findTopPhrase (tree) {
  if (tree.type === 'phrase') return tree.text
  const topPhrases = tree.children.map(child => findTopPhrase(child)).filter(x => x)
  return topPhrases.length ? topPhrases[0] : null
}

/**
  Return a list of all the words that aren't fragments of larger words
  E.g. Hamlet Shakespeare => [Hamlet, Shakespeare], and doesn't include the text
  of word nodes for H, Ha, Ham, etc...
 */
function findTopWords (tree) {
  if (tree.type === 'word') return [tree.text]
  return tree.children.map(child => findTopWords(child)).flat()
}

/**
  For an object where the keys are arrays, apply the given filter and map
  to each of the arrays
 */
function nestedMapAndFilter (obj, filter, map) {
  return Object.assign({},
    ...(Object.entries(obj)
      .map(([k, v]) => ({ [k]: v.filter(filter).map(map) }))
    )
  )
}
/**
  build atomic:
  - identify the scope fields that match the term
  - separate out into main, items, holdings
  - boolean(main, items, holdings)
  - items/holds = nested(items/holdings, main)
  - main:
    - if operator is any/all, take all query terms not starting with ^ and put in multi-match with all regular fields
    - if operator is any/all, take all query terms starting with ^ and put in prefix with all regular fields
    - if operator is =/adj, and query term doesn't start with ^, take all query terms and put in phrase match with all regular fields
    - if operator is =/adj and query term starts with ^, strip it out and use phrase_prefix
    - put all terms in prefix match with prefix fields
    - put all terms in term matches with term fields
 */

function buildAtomic ({ scope, relation, terms, term }) {
  const allFields = nestedMapAndFilter(
    indexMapping[scope],
    field => typeof field === 'string' || field.on(term),
    field => (typeof field === 'string' ? field : field.field)
  )

  const bibFields = nestedMapAndFilter(
    allFields,
    (field) => !['items', 'holdings'].some(prefix => field.startsWith(prefix)),
    field => field
  )

  const itemFields = nestedMapAndFilter(
    allFields,
    (field) => field.startsWith('items'),
    field => field
  )

  const holdingsFields = nestedMapAndFilter(
    allFields,
    (field) => field.startsWith('holdings'),
    field => field
  )

  return {
    bool: {
      should: [
        buildAtomicMain({ fields: bibFields, relation, terms, term }),
        buildAtomicNested('items', { fields: itemFields, relation, terms, term }),
        buildAtomicNested('holdings', { fields: holdingsFields, relation, terms, term })
      ]
    }
  }
}

function buildAtomicNested (name, { fields, relation, terms, term }) {
  return {
    nested: {
      path: name,
      query: buildAtomicMain({ fields, relation, terms, term })
    }
  }
}

/**
 - main:
 - if operator is any/all, take all query terms not starting with ^ and put in multi-match with all regular fields
 - if operator is any/all, take all query terms starting with ^ and put in prefix with all regular fields
 - if operator is =/adj, and query term doesn't start with ^, take all query terms and put in phrase match with all regular fields
 - if operator is =/adj and query term starts with ^, strip it out and use phrase_prefix
 - put all terms in prefix match with prefix fields
 - put all terms in term matches with term fields
 */
function buildAtomicMain ({ fields, relation, terms, term }) {
  return {
    bool: {
      should: [
        ...anyAllQueries({ fields, relation, terms, term }),
        ...adjEqQueries({ fields, relation, terms, term }),
        ...termQueriesForTermFields({ fields, relation, terms, term }),
        ...prefixQueriesForPrefixFields({ fields, relation, terms, term }),
        ...dateQueries({ fields, relation, terms, term })
      ]
    }
  }
}

function anyAllQueries ({ fields, relation, terms, term }) {
  if (!['any', 'all'].includes(relation)) { return [] }
  const fieldsToUse = fields.fields
  return [
    multiMatch(fieldsToUse, relation, terms.filter(term => !term.startsWith('^'))),
    ...(terms.filter(term => term.startsWith('^')).map(term => phrasePrefixQuery(fieldsToUse, term.slice(1))))
  ].filter(q => q)
}

function adjEqQueries ({ fields, relation, terms, term }) {
  if (!['=', 'adj'].includes(relation)) { return [] }
  const fieldsToUse = fields.fields
  return [
    term.startsWith('^')
      ? phrasePrefixQuery(fieldsToUse, term.slice(1))
      : phraseQuery(fieldsToUse, term)
  ].filter(q => q)
}

function dateQueries ({ fields, relation, terms, term }) {
  if (!Object.values(fields).some(fieldType => fieldType.some(field => field.includes('date')))) { return [] }
  let range
  switch (relation) {
    case '<':
      range = { lt: terms[0] }
      break
    case '>':
      range = { gt: terms[0] }
      break
    case '>=':
      range = { gte: terms[0] }
      break
    case '<=':
      range = { lte: terms[0] }
      break
    case 'encloses':
      range = { gt: terms[0], lt: terms[1] }
      break
    case 'within':
      range = { gte: terms[0], lte: terms[1] }
      break
    default:
      break
  }

  return [
    {
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': range
          }
        }
      }
    }
  ]
}

function prefixQueriesForPrefixFields ({ fields, relation, terms, term }) {
  if (!fields.prefix) return []
  return fields.prefix.map(field => prefixQuery(field, term))
}

function termQueriesForTermFields ({ fields, relation, terms, term }) {
  if (!fields.term) return []
  return fields.term.map(field => termQuery(field, term))
}

function termQuery (field, term) {
  return { term: { [field]: term } }
}

function prefixQuery (field, term) {
  return { prefix: { [field]: term } }
}

function multiMatch (fields, relation, terms) {
  if (!fields) return
  return {
    multi_match: {
      query: terms.join(' '),
      fields,
      type: 'cross_fields',
      operator: relation === 'any' ? 'or' : 'and'
    }
  }
}

function phrasePrefixQuery (fields, term) {
  if (!fields) return
  return {
    multi_match: {
      query: term,
      fields,
      type: 'phrase_prefix'
    }
  }
}

function phraseQuery (fields, term) {
  if (!fields) return
  return {
    multi_match: {
      query: term,
      fields,
      type: 'phrase'
    }
  }
}

module.exports = {
  buildEsQuery,
  buildEsQueryFromTree,
  buildBoolean,
  buildAtomic,
  buildAtomicMain,
  nestedMapAndFilter
}
