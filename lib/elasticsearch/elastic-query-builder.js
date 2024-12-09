const ElasticQuery = require('./elastic-query')
const ApiRequest = require('../api-request')
const { escapeQuery, namedQuery, prefixMatch, termMatch, phraseMatch } = require('./utils')
const { regexEscape } = require('../util')

const { FILTER_CONFIG, SEARCH_SCOPES } = require('./config')

const POPULARITY_BOOSTS = [
  { gte: 10, boost: 50 },
  { gte: 20, boost: 200 }
]

class ElasticQueryBuilder {
  constructor (apiRequest) {
    this.request = apiRequest
    this.query = new ElasticQuery()

    // Break on search_scope:
    switch (this.request.params.search_scope) {
      case 'contributor':
        this.buildContributorQuery()
        break
      case 'title':
        this.buildTitleQuery()
        break
      case 'journal_title':
        this.buildTitleQuery()
        this.requireIssuance('urn:biblevel:s')
        break
      case 'subject':
        this.buildSubjectQuery()
        break
      case 'standard_number':
        this.buildStandardNumberQuery()
        break
      case 'callnumber':
        this.buildCallnumberQuery()
        break
      case 'all':
      default:
        this.buildAllQuery()
    }

    // Add user filters:
    this.applyFilters()

    // Apply global clauses:
    // Hide specific nypl-sources when configured to do so:
    this.applyHiddenNyplSources()
  }

  /**
  * Build ES query for 'all'/default search-scope
  *
  * Note that this includes Adv Search, searches with just filters, and
  * identifier searches like those coming from Worldcat
  */
  buildAllQuery () {
    // Require a basic multi-match when keyword used:
    if (this.request.params.q) {
      this.requireMultiMatch(SEARCH_SCOPES.all.fields)
    }

    if (this.request.hasSearch()) {
      // Apply common boosting:
      this.boostNyplOwned()
      this.boostOnSite()
      this.boostPopular()
    }

    // When keyword given, boost strong matches against select fields:
    if (this.request.params.q) {
      this.boostTitleMatches()
      this.boostOnItemShelfmarkExact()
      this.boostCreatorNormalized()

      // When query is fully quoted, emphasize an exact match on select fields:
      if (this.request.queryIsFullyQuoted()) {
        this.requirePhraseMatch(['titleDisplay.folded', 'contributorLiteral.folded', 'creatorLiteral.folded'])
      }
    }

    // Look for query params coming from Adv Search:
    this.applyAdvancedSearchParams()

    // Lastly, if any identifier-number params are present (lccn=, isbn=, etc),
    // add those clauses:
    if (this.request.hasIdentifierNumberParam()) {
      this.requireSpecificIdentifierMatch()
    }
  }

  /**
  * Build ES query for 'contributor' (aka Author/Contributor) search:
  */
  buildContributorQuery () {
    if (!this.request.hasSearch()) return

    // Require a basic multi-match on contributor fields:
    this.requireMultiMatch(SEARCH_SCOPES.contributor.fields)

    // Apply common boosts:
    this.boostNyplOwned()
    this.boostOnSite()
    this.boostPopular()

    // Specially boost strong matches:
    this.boostCreatorNormalized()
    this.boostContributorMatches()

    // When query is fully quoted, emphasize an exact match on select fields:
    if (this.request.queryIsFullyQuoted()) {
      this.requirePhraseMatch(['contributorLiteral.folded', 'creatorLiteral.folded'])
    }
  }

  /**
  * Build ES query for 'title' searches
  */
  buildTitleQuery () {
    if (!this.request.hasSearch()) return

    // Require a basic multi-match on title fields:
    this.requireMultiMatch(SEARCH_SCOPES.title.fields)

    // Apply common boosts:
    this.boostNyplOwned()
    this.boostOnSite()
    this.boostPopular()

    // Specially boost strong matches on title fields:
    this.boostTitleMatches()

    // When query is fully quoted, emphasize an exact match on select fields:
    if (this.request.queryIsFullyQuoted()) {
      this.requirePhraseMatch(['titleDisplay.folded'])
    }
  }

  /**
  * Build ES query for 'subject' searches
  *
  * Note: This is not currently used in RC
  */
  buildSubjectQuery () {
    if (!this.request.hasSearch()) return

    // Require a basic multi-match on title fields:
    this.requireMultiMatch(SEARCH_SCOPES.subject.fields)

    // Apply common boosts:
    this.boostNyplOwned()
    this.boostOnSite()
    this.boostPopular()

    // TODO: Boost on subjectLiteral prefix and term matching
  }

  /**
  * Build ES query for standard_number searches
  */
  buildStandardNumberQuery () {
    if (!this.request.hasSearch()) return

    // Require a basic match on identifier fields:
    this.requireIdentifierMatch()

    // Boost strong identifier matches:
    this.boostOnIdentifiers()
    this.boostOnItemShelfmarkExact()
  }

  /**
  * Build ES query for callnumber searches
  */
  buildCallnumberQuery () {
    if (!this.request.hasSearch()) return

    // Require a basic match on callnumber
    this.requireCallnumberMatch()

    // Favor strong item callnumber matches:
    this.boostOnItemShelfmarkExact()
    this.boostOnItemShelfmarkPrefix()
  }

  /**
  * Require a specific issuance (e.g. require 'urn:biblevel:s' for journal-
  * title searches)
  */
  requireIssuance (issuance) {
    this.query.addFilter({
      term: {
        'issuance.id': issuance
      }
    })
  }

  /**
  * Require exact phrase-match on named fields
  */
  requirePhraseMatch (fields) {
    this.query.addMust({
      bool: {
        should: fields.map((field) => {
          return phraseMatch(field, this.request.querySansQuotes())
        })
      }
    })
  }

  /**
  * Require match on common identifier fields
  */
  requireIdentifierMatch () {
    const q = this.request.querySansQuotes()

    // Require full/prefix match on known identifiers:
    this.query.addMust({
      bool: {
        should: [
          prefixMatch('identifierV2.value', q),
          termMatch('uri', q),
          termMatch('items.idBarcode', q),
          termMatch('idIsbn.clean', q),
          termMatch('idIssn.clean', q),
          prefixMatch('items.shelfMark.keywordLowercased', q)
        ]
      }
    })
  }

  /**
   * If lccn, issn, isbn, or oclc set in params, add matcher
   */
  requireSpecificIdentifierMatch () {
    if (this.request.params.lccn) {
      this.query.addMust({
        regexp: {
          idLccn: {
            value: `[^\\d]*${regexEscape(this.request.params.lccn)}[^\\d]*`
          }
        }
      })
    } else if (this.request.params.issn) {
      this.query.addMust({ term: { 'idIssn.clean': this.request.params.issn } })
    } else if (this.request.params.isbn) {
      this.query.addMust({ term: { 'idIsbn.clean': this.request.params.isbn } })
    } else if (this.request.params.oclc) {
      this.query.addMust({ term: { idOclc: this.request.params.oclc } })
    }
  }

  /**
  * Require strong match on queried callnumber
  **/
  requireCallnumberMatch () {
    const q = this.request.querySansQuotes()

    this.query.addMust({
      bool: {
        should: [
          prefixMatch('shelfMark.keywordLowercased', q),
          prefixMatch('items.shelfMark.keywordLowercased', q)
        ]
      }
    })
  }

  /**
  * Boost NYPL records
  **/
  boostNyplOwned (boost = 10) {
    this.query.addShould(termMatch('nyplSource', 'sierra-nypl', boost))
  }

  /**
  * Boost EN works.
  * Note: Disabled pending review.
  **/
  boostEn (boost = 1) {
    this.query.addShould(termMatch('language.id', 'lang:eng', boost))
  }

  /**
  * Boost TXT material types
  * Note: Disabled pending review.
  **/
  boostText (boost = 1) {
    this.query.addShould(termMatch('materialType.id', 'resourcetypes:txt', boost))
  }

  /**
  * Boost bibs with some on-site items
  **/
  boostOnSite (boost = 1) {
    // Boost on-site bibs:
    this.query.addShould({
      terms: {
        buildingLocationIds: ['ma', 'pa', 'sc'],
        boost,
        _name: 'on-site'
      }
    })
  }

  /**
  * Boost bibs determined popular
  **/
  boostPopular () {
    POPULARITY_BOOSTS.forEach(({ gte, boost }) => {
      this.query.addShould({ range: { popularity: namedQuery({ gte, boost }, `popularity >= ${gte}`) } })
    })
  }

  /**
  * Boost bibs with strong title matches
  **/
  boostTitleMatches () {
    const q = this.request.querySansQuotes()
    this.query.addShoulds([
      phraseMatch('title.folded', q, 25),
      prefixMatch('title.keywordLowercasedStripped', q, 50),
      phraseMatch('title.shingle', q, 75),
      termMatch('title.keywordLowercasedStripped', q, 105),
      termMatch('title.keywordLowercased', q, 110),
      termMatch('title.keyword', q, 150)
    ])
  }

  /**
  * Boost bibs with strong creator/contributor matches
  */
  boostContributorMatches () {
    const q = this.request.querySansQuotes()
    this.query.addShoulds([
      prefixMatch('contributorLiteralWithoutDates.keywordLowercased', q, 25),
      prefixMatch('creatorLiteralWithoutDates.keywordLowercased', q, 100)
    ])
  }

  /**
  * Boost bibs with strong creator-normalized (i.e. Firstname Lastname) match
  */
  boostCreatorNormalized () {
    this.query.addShould(
      prefixMatch('creatorLiteralNormalized.keywordLowercased', this.request.querySansQuotes(), 100)
    )
  }

  /**
  * Boost bibs with items having exact callnumber match
  **/
  boostOnItemShelfmarkExact (boost = 50) {
    this.query.addShould(termMatch('items.shelfMark.keywordLowercased', this.request.querySansQuotes(), boost))
    // Specially boost case-sensitive match:
    this.query.addShould(termMatch('items.shelfMark.raw', this.request.querySansQuotes(), boost * 2))
  }

  /**
  * Boost bibs with items having prefix callnumber match
  **/
  boostOnItemShelfmarkPrefix (boost = 10) {
    this.query.addShould(prefixMatch('items.shelfMark.keywordLowercased', this.request.querySansQuotes(), boost))
    // Specially boost case-sensitive match:
    this.query.addShould(prefixMatch('items.shelfMark.raw', this.request.querySansQuotes(), boost * 2))
  }

  /**
  * Boost bibs with any strong identifier match
  */
  boostOnIdentifiers () {
    const q = this.request.querySansQuotes()

    this.query.addShoulds([
      prefixMatch('identifierV2.value', q, 5),
      termMatch('uri', q, 5),

      // Tiered matches on isbn:
      prefixMatch('idIsbn.clean', q, 10),
      termMatch('idIsbn.clean', q, 20),
      termMatch('idIsbn', q, 20),

      // Tiered matches on issn:
      prefixMatch('idIssn.clean', q, 10),
      termMatch('idIssn.clean', q, 20),
      termMatch('idIssn', q, 20),

      prefixMatch('idLccn', q, 10),
      prefixMatch('idOclc', q, 10),
      prefixMatch('shelfMark.keywordLowercased', q, 10),
      prefixMatch('items.shelfMark.keywordLowercased', q, 10),

      // I would like this to be a prefix, but doesn't seem to work:
      termMatch('items.identifierV2.value', q)
    ])
  }

  /**
  * Require bibs have strong tokenized match against given list of fields.
  */
  requireMultiMatch (fields, value = this.request.params.q) {
    const should = []

    // We have an array of fields to match.
    // Seperate the root-level fields from nested fields by building an object like this:
    //   {
    //     _root: [ 'fieldName1', 'fieldName2' ],
    //     nestedName1: { 'nestedName1.nestedProperty1', 'nestedName1.nestedProperty2' }
    //   }
    const fieldMap = fields.reduce((map, fieldName) => {
      // Handle query conditional field
      if (typeof fieldName === 'object' && fieldName.on) {
        if (!fieldName.on(value)) return map
        fieldName = fieldName.field
      }

      // Most fields will be matched at root level:
      let nestedName = '_root'
      // Any field starting with the following is a nested field:
      if (['items'].indexOf(fieldName.split('.').shift()) >= 0) {
        nestedName = fieldName.split('.').shift()
      }
      if (!map[nestedName]) map[nestedName] = []
      map[nestedName].push(fieldName)
      return map
    }, { _root: [] })

    should.push({
      multi_match: namedQuery({
        fields: fieldMap._root,
        query: escapeQuery(value),
        type: 'most_fields',
        // For 4+ term queries, require 75% of terms:
        minimum_should_match: '3<75%'
      }, 'bib multi_match')
    })

    // Add nested queries (if any) to things that *should* match:
    Object.keys(fieldMap)
      .filter((nestedName) => nestedName !== '_root')
      .forEach((nestedName) => {
        should.push({
          nested: {
            path: nestedName,
            query: {
              multi_match: {
                fields: fieldMap[nestedName],
                query: escapeQuery(value),
                type: 'phrase'
              }
            }
          }
        })
      })

    this.query.addMust(should.length === 1 ? should[0] : { bool: { should } })
  }

  /**
  * Handle use of subject=, contributor=, title=, & callnumber= Adv Search
  * params.
  * Note that the RC Adv Search page may also apply filters, which are
  * handled by `applyFilters`.
  **/
  applyAdvancedSearchParams () {
    // We're specifically interested in params that match supported search-
    // scopes because we can build a whole ES query just using the existing
    // logic for that search scope:
    if (this.request.advancedSearchParamsThatAreAlsoScopes()) {
      this.request
        .advancedSearchParamsThatAreAlsoScopes()
        .forEach((advSearchParam) => {
          const advSearchValue = this.request.params[advSearchParam]
          // Build a new ApiRequest object for this search-scope:
          const request = ApiRequest.fromParams({
            q: advSearchValue,
            search_scope: advSearchParam
          })

          // Build the ES query for the search-scope and value:
          const builder = ElasticQueryBuilder.forApiRequest(request)
          const subquery = builder.query.toJson()

          // Add the query to the greater ES query's must clauses:
          this.query.addMust(subquery)
        })
    }
  }

  buildPackedFieldClause (value, field) {
    // Figure out the base property (e.g. 'owner')
    const baseField = field.replace(/_packed$/, '')
    // Allow supplied val to match against either id or value:
    return {
      bool: {
        should: [
          { term: { [`${baseField}.id`]: value } },
          { term: { [`${baseField}.label`]: value } }
        ]
      }
    }
  }

  buildMultiFieldClause (value, fields) {
    return {
      bool:
        { should: fields.map(field => ({ term: { [field]: value } })) }
    }
  }

  // This builds a filter cause from the value:
  buildClause (value, field) {
    const filterMatchesOnMoreThanOneField = field.length > 1
    if (filterMatchesOnMoreThanOneField) {
      return this.buildMultiFieldClause(value, field)
    }
    field = field[0]
    const valueIsNotPackedValue = value.indexOf('||') < 0
    const isPackedField = field.match(/_packed$/)
    if (isPackedField && valueIsNotPackedValue) {
      return this.buildPackedFieldClause(value, field)
    } else return { term: { [field]: value } }
  }

  buildSimpleMatchFilters (simpleMatchFilters) {
    return simpleMatchFilters.map((prop) => {
      const config = FILTER_CONFIG[prop]
      let value = this.request.params.filters[prop]

      // If multiple values given, let's join them with 'should', causing it to operate as a boolean OR
      // Note: using 'must' here makes it a boolean AND
      const booleanOperator = 'should'

      if (Array.isArray(value) && value.length === 1) value = value.shift()
      const clause = (Array.isArray(value)) ? { bool: { [booleanOperator]: value.map((value) => this.buildClause(value, config.field)) } } : this.buildClause(value, config.field)

      return { path: config.path, clause }
    })
  }

  /**
  * Examine request for user-filters. When found, add them to query.
  */
  applyFilters () {
    if (!this.request.params.filters) return

    let filterClausesWithPaths = []

    // Add clauses for dateAfter / dateBefore filters, if used:
    filterClausesWithPaths = filterClausesWithPaths.concat(
      this.filterClausesForDateParams(this.request.params.filters)
    )

    // Collect those filters that use a simple term match
    const simpleMatchFilters = Object.keys(this.request.params.filters)
      .filter((k) => FILTER_CONFIG[k].operator === 'match')

    filterClausesWithPaths = filterClausesWithPaths.concat(this.buildSimpleMatchFilters(simpleMatchFilters))

    // Gather root (not nested) filters:
    let filterClauses = filterClausesWithPaths
      .filter((clauseWithPath) => !clauseWithPath.path)
      .map((clauseWithPath) => clauseWithPath.clause)

    // Add nested filters:
    filterClauses = filterClauses.concat(
      filterClausesWithPaths
        // Nested filters have a `path` property:
        .filter((clauseWithPath) => clauseWithPath.path)
        .map((clauseWithPath) => {
          return {
            nested: {
              path: clauseWithPath.path,
              query: {
                constant_score: {
                  filter: clauseWithPath.clause
                }
              }
            }
          }
        })
    )

    if (filterClauses) {
      this.query.addFilters(filterClauses)
    }
  }

  /**
  * Example request for known date filter params. When found, return them for
  * incorporation with other filters.
  */
  filterClausesForDateParams (filters) {
    const hasDateAfter = typeof filters.dateAfter === 'number'
    const hasDateBefore = typeof filters.dateBefore === 'number'

    if (!hasDateAfter && !hasDateBefore) {
      return []
    }

    // Collect the clauses we'll need to add:
    const clauses = []

    if (hasDateBefore) {
      /**
       * When dateBefore used, we want to match on:
       *     dateStartYear <= filters.dateBefore ||
       *     dateEndYear <= filters.dateBefore
       *
       * Note that when dateBefore is used alone, we only strictly need to match on:
       *   dateStartYear <= filters.dateBefore
      */
      clauses.push({
        bool: {
          should: [
            { range: { dateStartYear: { lte: filters.dateBefore } } },
            { range: { dateEndYear: { lte: filters.dateBefore } } }
          ]
        }
      })
    }

    if (hasDateAfter) {
      /**
       * When dateAfter used, we want to match on:
       *     dateStartYear >= filters.dateAfter ||
       *     dateEndYear >= filters.dateAfter
      */
      clauses.push({
        bool: {
          should: [
            { range: { dateStartYear: { gte: filters.dateAfter } } },
            { range: { dateEndYear: { gte: filters.dateAfter } } }
          ]
        }
      })
    }

    return [{
      // If multiple clauses built, return them as a MUST (boolean AND)
      // If only one clause built, just return that one
      clause: clauses.length > 1 ? { bool: { must: clauses } } : clauses[0]
    }]
  }

  /**
  * Examine HIDE_NYPL_SOURCE env var. When set, hide results with matching nyplSource.
  **/
  applyHiddenNyplSources () {
    // If HIDE_NYPL_SOURCE env config set, filter records w/matching nyplSource
    if (process.env.HIDE_NYPL_SOURCE) {
      this.query.addFilter({
        bool: {
          must_not: {
            terms: {
              nyplSource: process.env.HIDE_NYPL_SOURCE.split(',')
            }
          }
        }
      })
    }
  }

  /**
  * Create a ElasticQueryBuilder for given ApiRequest instance
  */
  static forApiRequest (request) {
    return new ElasticQueryBuilder(request)
  }
}

module.exports = ElasticQueryBuilder
