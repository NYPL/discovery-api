const ElasticQuery = require('./elastic-query')
const { prefixMatch, termMatch } = require('./utils')

class ElasticQuerySubjectsBuilder {
  constructor (apiRequest) {
    this.request = apiRequest
    this.query = new ElasticQuery()

    switch (this.request.params.search_scope) {
      case 'has':
        // TODO: partial matching.
        this.requireTermMatch()
        break
      case 'starts_with':
        this.requirePrefixMatch()
        break
      default:
        this.requireTermMatch()
    }
  }

  /**
  * Match on the start of a preferred term or variant
  */
  requirePrefixMatch () {
    this.query.addMust({
      bool: {
        should: [
          prefixMatch('preferredTerm.keyword', this.request.querySansQuotes()),
          prefixMatch('variants.keyword', this.request.querySansQuotes())
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
          termMatch('preferredTerm.keyword', this.request.querySansQuotes()),
          termMatch('variants.keyword', this.request.querySansQuotes())
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
