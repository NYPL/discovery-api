const { parseWithRightCql } = require('./cql_grammar')
const ElasticQueryBuilder = require('./elastic-query-builder')
const ApiRequest = require('../api-request')
const { indexMapping } = require('./cql/index-mapping')

function buildEsQuery (cqlQuery) {
  return buildEsQueryFromTree(
    parseWithRightCql(cqlQuery)
  )
}

/**
 this is mostly there but needs to handle exact strings
 */

function buildEsQueryFromTree (tree) {
  switch (tree.type) {
    case 'query':
      queries = tree.children.filter(child.type.contains('query'))
      connectives = tree.children.filter(child => child.type === 'connective')
      if (connectives.length) {
        return buildBoolean(connectives[0], queries)
      }
      return buildEsQueryFromTree(queries[0])
    case 'sub_query':
      const query = tree.children.filter(child => child.type.contains('query'))[0]
      return buildEsQueryFromTree(query)
    case 'atomic_query': {
      const { scope, relation, term, terms } = atomicQueryParams(query)
      return buildAtomic(scope, relation, term, terms)
    }
    default:
      break
  }
}

function buildBoolean (operator, queries) {
  if (operator === "NOT") return buildNegation(queries)
  const esOperator = operator === 'and' ? 'must' : 'should'
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

function atomicQueryParams (query) {
  return {
    scope: query.find(child => child.type === 'scope'),
    relation: query.find(child => child.type === 'relation'),
    term: findTopPhrase(query),
    terms: findTopWords(query)
  }
}

function findTopPhrase (tree) {
  if (tree.type === 'phrase') return tree.text
  const topPhrases = tree.children.map(child => findTopPhrase(child)).filter(x => x)
  return topPhrases.length ? topPhrases[0] : null
}

function findTopWords (tree) {
  if (tree.type === 'word') return [tree.text]
  return tree.children.map(child => findTopWords(child)).flatten()
}

// function buildAtomic (scope, relation, term) {
//   const request = ApiRequest.fromParams({
//     q: term,
//     search_scope: scope
//   })
//   const builder = ElasticQueryBuilder.forApiRequest(request)
//   return builder.query.toJson()
// }

function nestedMapAndFilter (obj, filter, map) {
  return Object.assign({},
      ...Object.entries(
       obj
     ).filter(filter) // need to modify this to get full query
     .map(map)
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

 function buildAtomic (scope, relation, terms, term) {
    const allFields = nestedMapAndFilter(
      indexMapping[scope],
      (k,v) => typeof v === 'string' || v.on(terms),
      ([k,v]) => ({[k] : typeof v === 'string' ? v : v.field})
    )

    const bibFields = nestedMapAndFilter(
      allFields,
      ([k, v]) => !['items, holdings'].any(prefix => k.startsWith(prefix)),
      ([k, v]) => ({[k]: v})
    )

    const itemFields = nestedMapAndFilter(
      allFields,
      ([k, v]) => k.startsWith('items'),
      ([k, v]) => ({[k]: v})
    )

    const holdingsFields = nestedMapAndFilter(
      allFields,
      ([k, v]) => k.startsWith('holdings'),
      ([k, v]) => ({[k]: v})
    )

    return {
      bool: { // should this start with query?
        should: [
          buildAtomicMain(bibFields, relation, terms, term),
          buildAtomicNested('items', itemFields, relation, terms, term),
          buildAtomicNested('holdings', holdingsFields, relation, terms, term)
        ]
      }
    }
 }

 function buildAtomicNested(name, fields, relation, terms, term) {
   return {
     nested: {
       path: name,
       query: buildAtomicMain(fields, relation, terms, term)
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
 function buildAtomicMain (fields, relation, terms, term) {
   return {
     bool: {
       should: [
         ...anyAllQueries(fields, relation, terms, term),
         ...adjEqQueries(fields, relation, terms, term),
         ...termQueriesForTermFields(fields, relation, terms, term),
         ...prefixQueriesForPrefixFields(fields, relation, terms, term)
       ]
     }
   }
 }

 function anyAllQueries (fields, relation, terms, term) {
   if (!['any', 'all'].contains(relation)) { return [] }
   const fieldsToUse = fields.fields
   return [
     multiMatch(fieldsToUse, relation, terms.filter(term => !term.startsWith('^'))),
     ...(terms.filter(term => term.startsWith('^')).map(term => prefixQuery(fieldsToUse, term.slice(1))))
   ]
 }

 function adjEqQueries (fields, relation, terms, term) {
   if (!['=', 'adj'].contains(relation)) { return [] }
   const fieldsToUse = fields.fields
   return [
     term.startsWith('^') ?
      phrasePrefixQuery(fieldsToUse, term.slice(1)) :
      phraseQuery(fieldsToUse, term)
    ]
 }

 function prefixQueriesForPrefixFields (fields, relation, terms, term) {
   if (!fields.prefix) return []
   return fields.prefix.map(field => prefixQuery(field, term))
 }

 function termQueriesForTermFields (fields, relation, terms, term) {
   if (!fields.term) return []
   return fields.term.map(field => termQuery(field, term))
 }

 function termQuery (field, term) {
   return { "term" : { [field] : term } }
 }

 function prefixQuery (field, term) {
   return { "prefix" : { [field] : term } }
 }

 function multiMatch (fields, relation, terms) {
   return {
     "multi_match": {
       "query" : term,
       "fields": fields,
       "type": "cross_fields",
       "operator": relation === "any" ? "or" : "and"
     }
   }
 }

 function phrasePrefixQuery (fields, term) {
   return {
     "multi_match": {
       "query" : term,
       "fields": fields,
       "type": "phrase_prefix"
     }
   }
 }

 function phraseQuery (fields, term) {
   return {
     "multi_match": {
       "query" : term,
       "fields": fields,
       "type": "phrase"
     }
   }
 }



module.exports = {
  buildEsQuery,
  buildEsQueryFromTree,
  buildBoolean,
  buildAtomic
}
