const ElasticQuery = require('./elastic-query')

class ElasticQueryContributorsBuilder {
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

  }

  /**
  * Require exact term match on preferred term or variants
  */
  requireTermMatch () {

  }

  /**
  * Require general "and" match on provided query
  */
  requireContainingMatch () {

  }

  /**
  * Create a ElasticQueryBuilder for given ApiRequest instance
  */
  static forApiRequest (request) {
    return new ElasticQueryContributorsBuilder(request)
  }
}

module.exports = ElasticQueryContributorsBuilder
