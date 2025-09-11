const ElasticQuery = require('./elastic-query')

class ElasticQuerySubjectsBuilder {
  constructor (apiRequest) {
    this.request = apiRequest
    this.query = new ElasticQuery()

    switch (this.request.params.search_scope) {
      case 'has':
        this.requireContainingMatch()
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
          { prefix: { 'preferredTerm.keyword': this.request.querySansQuotes() } },
          { prefix: { 'variants.keyword': this.request.querySansQuotes() } }
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
          { term: { 'preferredTerm.keyword': this.request.querySansQuotes() } },
          { term: { 'variants.keyword': this.request.querySansQuotes() } }
        ]
      }
    })
  }

  /**
  * Require general "and" match on provided query
  */
  requireContainingMatch () {
    this.query.addMust({
      bool: {
        should: [
          { match: { preferredTerm: { query: this.request.querySansQuotes(), operator: 'and' } } },
          { match: { variants: { query: this.request.querySansQuotes(), operator: 'and' } } }
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
