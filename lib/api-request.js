/**
* This class wraps request params to ease interpretting the query
**/

class ApiRequest {
  static ADVANCED_SEARCH_PARAMS = ['title', 'subject', 'contributor']
  static IDENTIFIER_NUMBER_PARAMS = ['isbn', 'issn', 'lccn', 'oclc']

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

  /**
  * Get array of params in the query that are also valid search-scopes:
  */
  advancedSearchParamsThatAreAlsoScopes () {
    // Return search params that are also valid search_scope values
    return ApiRequest.ADVANCED_SEARCH_PARAMS
      .filter((key) => this.params[key])
  }

  hasKeyword () {
    return !!this.params.q
  }

  hasSearch () {
    return this.hasKeyword() || this.advancedSearchParamsThatAreAlsoScopes().length > 0
  }

  /**
  * Returns true if search_scope matches one of the named scopes
  **/
  hasScope (scopes) {
    return scopes.includes(this.params.search_scope)
  }

  /**
  * Returns true if query is fully wrapped in quotes
  **/
  queryIsFullyQuoted () {
    return /^"[^"]+"$/.test(this.params.q)
  }

  /**
  * Get keyword query without surrounding quotes (if fully quoted)
  **/
  querySansQuotes () {
    return this.queryIsFullyQuoted()
      ? this.params.q.substring(1, this.params.q.length - 1)
      : this.params.q
  }

  hasIdentifierNumberParam () {
    return Object.keys(this.params)
      .some((userParam) => ApiRequest.IDENTIFIER_NUMBER_PARAMS.includes(userParam))
  }

  static fromParams (params) {
    return new ApiRequest(params)
  }
}

module.exports = ApiRequest
