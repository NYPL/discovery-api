const ElasticQuery = require('./elastic-query')
const { prefixMatch, termMatch, wildcardMatch } = require('./utils')

class ElasticQuerySubjectsBuilder {
  constructor (apiRequest) {
    this.request = apiRequest
    this.query = new ElasticQuery()

    switch (this.request.params.search_scope) {
      case 'has':
        this.requireWildcardMatch()
        break
      case 'starts_with':
        this.requirePrefixMatch()
        break
      default:
        this.requireTermMatch()
    }
  }

  /**
  * Match on the start of a preferred term
  */
  requirePrefixMatch () {
    this.query.addMust({
      bool: {
        should: [
          prefixMatch('preferredTerm.keyword', this.request.querySansQuotes(), 1, true)
        ]
      }
    })
  }

  /**
  * Require exact term match on preferred term or variants
  */
  requireTermMatch () {
    this.query.addMust({
      bool: {
        should: [
          termMatch('preferredTerm.keyword', this.request.querySansQuotes(), 10, true),
          termMatch('variants.keyword', this.request.querySansQuotes(), 1, true)
        ]
      }
    })
  }

  /**
  * Require wildcard term match on preferred term or variants
  */
  requireWildcardMatch () {
    this.query.addMust({
      bool: {
        should: [
          wildcardMatch('preferredTerm.keyword', this.request.querySansQuotes(), 10, true),
          wildcardMatch('variants.keyword', this.request.querySansQuotes(), 1, true)
        ]
      }
    })
  }

  /**
  * Create a ElasticQueryBuilder for given ApiRequest instance
  */
  static forApiRequest (request) {
    return new ElasticQuerySubjectsBuilder(request)
  }
}

module.exports = ElasticQuerySubjectsBuilder
