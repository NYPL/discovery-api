class ElasticQuery {
  constructor () {
    this.musts = []
    this.shoulds = []
    this.filters = []
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

  toJson () {
    if (!this.musts.length && !this.shoulds.length && this.filters.length) {
      return {
        match_all: {}
      }
    }

    const result = { bool: {} }

    if (this.musts) {
      result.bool.must = this.musts
    }
    if (this.shoulds) {
      result.bool.should = this.shoulds
    }
    if (this.filters) {
      result.bool.filter = this.filters
    }

    return result
  }
}

module.exports = ElasticQuery
