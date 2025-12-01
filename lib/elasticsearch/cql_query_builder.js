const { cqlParser } = require('./cql_grammar')
const ElasticQueryBuilder = require('./elastic-query-builder')
const ApiRequest = require('../api-request')

function buildEsQuery (cqlQuery) {
  const tree = cqlParser.getAST(cqlQuery)
  console.log('tree: ', tree)
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
      break
    case 'sub_query':
      return buildEsQueryFromTree(tree.children.length > 1 ? tree.children[1] : tree.children[0])
      break
    case 'atomic_query':
      let scope
      let relation
      let term
      if (tree.children.length > 1) {
        scope = tree.children[0].text
        relation = tree.children[1].text
        term = tree.children[2].text
      } else {
        scope = "all"
        relation = "any"
        term = tree.children[0].text
      }
      return buildAtomic(scope, relation, term)
      break
    default:
      break
  }
}

function buildBoolean (queryOne, operator, queryTwo) {
  console.log('building boolean ', queryOne, operator, queryTwo)
  const esOperator = operator === 'and' ? 'must' : 'should'
  return {
    "bool": {
      [esOperator]: [
        queryOne,
        queryTwo
      ]
    }
  }
}

function buildAtomic (scope, relation, term) {
  console.log('building atomic: ', scope, relation, term)
  const request = ApiRequest.fromParams({
    q: term,
    search_scope: scope
  })
  const builder = ElasticQueryBuilder.forApiRequest(request)
  // return {
  //   query: builder.query.toJson()
  // }
  return builder.query.toJson()
  // return {
  //   "query": {
  //     "multi_match" : {
  //       "query":    term,
  //       "fields": [ "subject", "message" ]
  //     }
  //   }
  // }
}

module.exports = {
  buildEsQuery,
  buildEsQueryFromTree,
  buildBoolean,
  buildAtomic
}
