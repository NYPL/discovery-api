class ApiRequest {
  // The following maps search scopes can occur as parameters in the advanced search
  static ADVANCED_SEARCH_PARAMS = ['title', 'subject', 'contributor']

  constructor (params) {
    this.params = params

    // Make some substitutions for folks querying with "date:1997", etc
    if (this.params.q) {
      this.params.q = this.params.q
        .replace(/date:/g, 'dateStartYear:')
        .replace(/location:/g, 'locations:')
        .replace(/subject:/g, 'subjectLiteral:')
    }
  }

  advancedSearchParams () {
    return ApiRequest.ADVANCED_SEARCH_PARAMS
      .filter((key) => this.params[key])
  }

  hasKeyword () {
    return !!this.params.q
  }

  hasScope (scopes) {
    return scopes.includes(this.params.search_scope)
  }

  queryIsFullyQuoted () {
    return /^"[^"]+"$/.test(this.params.q)
  }

  querySansQuotes () {
    return this.queryIsFullyQuoted()
      ? this.params.q.substring(1, this.params.q.length - 1)
      : this.params.q
  }

  static fromParams (params) {
    return new ApiRequest(params)
  }
}

module.exports = ApiRequest
