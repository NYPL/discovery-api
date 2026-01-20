/**
* Simple model representing the kinds of Elasticsearch queries we perform.
* Emphasis on queries that include:
*  - musts: a set of scored, required clauses
*  - shoulds: set of optional boosted clauses
*  - filters: a set of un-scored required clauses added by the user or inferred from the query
**/

class ElasticQuery {
  constructor (options = {}) {
    this.musts = []
    this.shoulds = []
    this.filters = []
    this.options = options
  }

  addMust (clause) {
    this.musts.push(clause)
  }

  addMusts (clauses) {
    this.musts = this.musts.concat(clauses)
  }

  addShould (clause) {
    this.shoulds.push(clause)
  }

  addShoulds (clauses) {
    this.shoulds = this.shoulds.concat(clauses)
  }

  addFilter (clause) {
    this.filters.push(clause)
  }

  addFilters (clauses) {
    this.filters = this.filters.concat(clauses)
  }

  /**
  * Return a object representation of this ES query suitable for use as the
  * "query" param in a ES call
  */
  toJson () {
    if (!this.musts.length && !this.shoulds.length && !this.filters.length && !this.options.items) {
      return {
        match_all: {}
      }
    }

    const result = { bool: {} }

    if (this.musts.length) {
      result.bool.must = this.musts
    }
    if (this.shoulds.length) {
      result.bool.should = this.shoulds
    }
    if (this.filters.length || this.options.items) {
      result.bool.filter = this.filters
    }

    return result
  }
}

module.exports = ElasticQuery
