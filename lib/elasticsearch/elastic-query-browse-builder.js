const ElasticQuery = require('./elastic-query')

class ElasticQueryBrowseBuilder {
  constructor (apiRequest) {
    this.request = apiRequest
    this.query = new ElasticQuery()
    this.normalizedQuery = this.request.querySansQuotes().normalize('NFC')

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
          { prefix: { 'preferredTerm.keyword_normalized': { value: this.normalizedQuery, _name: 'preferredTerm' } } },
          { nested: { path: 'variants', query: { prefix: { 'variants.variant.keyword_normalized': this.normalizedQuery } }, inner_hits: {} } }
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
          { term: { 'preferredTerm.keyword': { value: this.normalizedQuery, _name: 'preferredTerm' } } },
          { nested: { path: 'variants', query: { term: { 'variants.variant.keyword': this.normalizedQuery } }, inner_hits: {} } }
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
          { prefix: { 'preferredTerm.keyword_normalized': { value: this.normalizedQuery, _name: 'preferredTermPrefix' } } },
          { match: { preferredTerm: { query: this.normalizedQuery, operator: 'and', _name: 'preferredTerm' } } },
          { nested: { path: 'variants', query: { match: { 'variants.variant': { query: this.normalizedQuery, operator: 'and' } } }, inner_hits: {} } }
        ]
      }
    })
  }

  /**
  * Create a ElasticQueryBuilder for given ApiRequest instance
  */
  static forApiRequest (request) {
    return new ElasticQueryBrowseBuilder(request)
  }
}

module.exports = ElasticQueryBrowseBuilder
