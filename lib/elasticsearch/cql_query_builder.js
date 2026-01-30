const { cqlParser } = require('./cql_grammar')
const ElasticQueryBuilder = require('./elastic-query-builder')
const ApiRequest = require('../api-request')

function buildEsQuery (cqlQuery) {
  const tree = cqlParser.getAST(cqlQuery)
  return buildEsQueryFromTree(tree)
}

/**
 this is mostly there but needs to handle exact strings
 */

function buildEsQueryFromTree (tree) {
  switch (tree.type) {
    case 'query':
      if (tree.children.length > 1) {
        return buildBoolean(
          buildEsQueryFromTree(tree.children[0]),
          tree.children[1].text,
          buildEsQueryFromTree(tree.children[2])
        )
      } else {
        return buildEsQueryFromTree(tree.children[0])
      }
    case 'sub_query':
      return buildEsQueryFromTree(tree.children.length > 1 ? tree.children[1] : tree.children[0])
    case 'atomic_query': {
      let scope
      let relation
      let term
      if (tree.children.length > 1) {
        scope = tree.children[0].text
        relation = tree.children[1].text
      } else {
        scope = 'all'
        relation = 'any'
      }
      term = tree.children.find(child => child.type === 'key').children[0].text

      return buildAtomic(scope, relation, term)
    }
    default:
      break
  }
}

function buildBoolean (queryOne, operator, queryTwo) {
  const esOperator = operator === 'and' ? 'must' : 'should'
  return {
    bool: {
      [esOperator]: [
        queryOne,
        queryTwo
      ]
    }
  }
}

function buildAtomic (scope, relation, term) {
  const request = ApiRequest.fromParams({
    q: term,
    search_scope: scope
  })
  const builder = ElasticQueryBuilder.forApiRequest(request)
  return builder.query.toJson()
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

module.exports = {
  buildEsQuery,
  buildEsQueryFromTree,
  buildBoolean,
  buildAtomic
}
