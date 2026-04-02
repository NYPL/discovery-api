const { parseWithRightCql, reverseString, parsedASTtoNestedArray } = require('./cql_grammar')
const { indexMapping } = require('./cql/index-mapping')
const ElasticQueryBuilder = require('./elastic-query-builder')

class CqlQuery {
  constructor (queryStr) {
    this.queryStr = (queryStr || '').trim()
    this.parsedAST = null
  }

  parse () {
    if (!this.parsedAST) {
      this.parsedAST = parseWithRightCql(this.queryStr)
    }
    return this.parsedAST
  }

  buildEsQuery (request = null) {
    const filterQuery = buildFilterQuery(request)
    return {
      bool: {
        should: [
          buildEsQueryFromTree(this.parse(), this.queryStr)
        ],
        ...filterQuery
      }
    }
  }

  displayParsed () {
    const parsed = this.parse()
    if (!parsed) return {}
    if (parsed.errors && parsed.errors.length) {
      return {
        error: parsed.errors.map(error =>
          `Parsing error likely near end of "${reverseString(error.token.rest)}"`
        ).join('\n')
      }
    }
    return { parsed: parsedASTtoNestedArray(parsed) }
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
  operator = operator.toUpperCase()
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
  if (tree.type === 'phrase' || tree.type === 'unquoted_word') return tree.text
  const topPhrases = tree.children.map(child => findTopPhrase(child)).filter(x => x)
  return topPhrases.length ? topPhrases[0] : null
}

/**
  Return a list of all the words that aren't fragments of larger words
  E.g. Hamlet Shakespeare => [Hamlet, Shakespeare], and doesn't include the text
  of word nodes for H, Ha, Ham, etc...
 */
function findTopWords (tree) {
  if (tree.type === 'word' || tree.type === 'unquoted_word') return [tree.text]
  return tree.children.map(child => findTopWords(child)).flat()
}

/**
  For an object where the values are arrays, apply the given filter and map
  to each of the arrays.
 */
function nestedFilterAndMap (obj, filter, map) {
  return Object.assign({},
    ...(Object.entries(obj)
      .map(([k, v]) => ({ [k]: v.filter(filter).map(map) }))
    )
  )
}

/**
  Return truthy value if and only if one of the values is a non-empty array
 */
function hasFields (obj) {
  return Object.values(obj).some(arr => arr.length)
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
  scope = scope.toLowerCase()
  relation = relation.toLowerCase()
  const allFields = nestedFilterAndMap(
    indexMapping[scope],
    field => typeof field === 'string' || field.on(term),
    field => (typeof field === 'string' ? field : field.field)
  )

  const bibFields = nestedFilterAndMap(
    allFields,
    (field) => !['items', 'holdings'].some(prefix => field.startsWith(prefix)),
    field => field
  )

  const itemFields = nestedFilterAndMap(
    allFields,
    (field) => field.startsWith('items'),
    field => field
  )

  const holdingsFields = nestedFilterAndMap(
    allFields,
    (field) => field.startsWith('holdings'),
    field => field
  )

  return {
    bool: {
      should: [
        buildAtomicMain({ fields: bibFields, relation, terms, term }),
        (hasFields(itemFields) && buildAtomicNested('items', { fields: itemFields, relation, terms, term })),
        (hasFields(holdingsFields) && buildAtomicNested('holdings', { fields: holdingsFields, relation, terms, term }))
      ].filter(x => x)
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
  switch (relation) {
    case 'any':
    case 'all':
      return anyAllQueries({ fields, relation, terms })
    case '=':
    case '==':
    case 'adj':
      return adjEqQueries({ fields, relation, terms, term })
    case '>':
    case '<':
    case '<=':
    case '>=':
    case 'within':
    case 'encloses':
      return dateQueries({ fields, relation, terms, term })
    default:
      break
  }
}

function anyAllQueries ({ fields, relation, terms }) {
  const operator = (relation === 'any' ? 'should' : 'must')
  return {
    bool: {
      [operator]: terms.map(term => matchTermWithFields(fields, term, 'cross_fields'))
    }
  }
}

function adjEqQueries ({ fields, relation, terms, term }) {
  const type = (relation === '==') ? 'exact' : 'phrase'
  return matchTermWithFields(fields, term, type)
}

// depending on the type of cql query supplied by the user,
// we may need to modify the es query from the type indicated by the index
// mapping.
// e.g. in case the user indicates a prefix query, all `term` queries should be
// mapped to `prefix` queries
// X represents field types that should be excluded e.g. for exact matching,
// exclude regular fields and use matching `exact_fields` instead
const esQueryMappingByCqlQueryType = {
  exact: { term: 'term', prefix: 'prefix', fields: 'X', exact_fields: 'term' },
  prefix: { term: 'prefix', prefix: 'prefix', fields: 'X', exact_fields: 'prefix' },
  basic: { term: 'term', prefix: 'prefix', fields: 'multi_match', exact_fields: 'X' }
}

// used to turn the above table inside out, e.g.
// in case of queryType = `prefix`,
// will gather together, for a given set of fields, all the query tyoes that
// need to be included under `selector`
// so e.g. `term`, 'prefix', and `exact_fields` fields all need to be included
// in the `prefix` matcher, since they are all mapped to `prefix` in this case
const selectFields = (queryType, fields) => (selector) => {
  return Object.entries(fields)
    .filter(([fieldType, fieldNames]) => {
      return esQueryMappingByCqlQueryType[queryType][fieldType] === selector
    })
    .map(([fieldType, fieldNames]) => fieldNames)
    .flat()
}

function matchTermWithFields (fields, term, type) {
  const queryType = term[0] === '^' ? 'prefix' : (type === 'exact' ? 'exact' : 'basic')
  if (term[0] === '^') term = term.slice(1)

  const selector = selectFields(queryType, fields)

  const queries = [
    ...multiMatch(selector('multi_match'), term, type),
    ...(selector('term').map(termField => termQuery(termField, term))),
    ...(selector('prefix').map(prefixField => prefixQuery(prefixField, term)))
  ]

  return {
    bool: {
      should: queries
    }
  }
}

function dateQueries ({ fields, relation, terms, term }) {
  if (!Object.values(fields).some(fieldType => fieldType.some(field => field.includes('date')))) { return null }
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

  return {
    nested: {
      path: 'dates',
      query: {
        range: {
          'dates.range': range
        }
      }
    }
  }
}

function termQuery (field, term) {
  return { term: { [field]: term } }
}

function prefixQuery (field, term) {
  return { prefix: { [field]: term } }
}

function multiMatch (fields, term, type) {
  if (!fields || !fields.length) return []

  return [{
    multi_match: {
      query: term,
      fields,
      type
    }
  }]
}

module.exports = {
  CqlQuery,
  buildEsQueryFromTree,
  buildBoolean,
  buildAtomic,
  buildAtomicMain,
  nestedFilterAndMap,
  selectFields,
  indexMapping
}
