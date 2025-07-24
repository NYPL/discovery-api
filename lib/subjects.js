const { parseParams } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQuerySubjectsBuilder = require('./elasticsearch/elastic-query-subjects-builder')

const SUBJECTS_INDEX = process.env.SUBJECTS_INDEX

const SEARCH_SCOPES = [
  'has',
  'starts_with'
]

const SORT_FIELDS = [
  'preferredTerm',
  'count',
  'relevance'
]

// Default sort orders for different search scopes
const SEARCH_SCOPE_SORT_ORDER = {
  has: 'count',
  starts_with: 'preferredTerm'
}

// Define painless scripts that will let us respect order for results in a variant list
const PAINLESS_ALPHA_PREFIX_SORT_ASC = `
  String sortValue = null;
  String searchValue = params['prefix_value'].toLowerCase();
  if (params._source.containsKey('variants')) {
      for (String variant : params._source['variants']) {
          if (variant.toLowerCase().startsWith(searchValue)) {
              if (sortValue == null || variant.compareTo(sortValue) < 0) {
                sortValue = variant;
              }
          }
      }
  }
  if (sortValue == null || params._source['preferredTerm'].toLowerCase().startsWith(searchValue)) {
      sortValue = params._source['preferredTerm'];
  }
  return sortValue;
`

const PAINLESS_ALPHA_PREFIX_SORT_DESC = `
  String sortValue = null;
  String searchValue = params['prefix_value'].toLowerCase();
  if (params._source.containsKey('variants')) {
      for (String variant : params._source['variants']) {
          if (variant.toLowerCase().startsWith(searchValue)) {
              if (sortValue == null || variant.compareTo(sortValue) > 0) {
                sortValue = variant;
              }
          }
      }
  }
  if (sortValue == null || params._source['preferredTerm'].toLowerCase().startsWith(searchValue)) {
      sortValue = params._source['preferredTerm'];
  }
  return sortValue;
`

const parseBrowseParams = function (params) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    sort: { type: 'string', range: SORT_FIELDS, default: SEARCH_SCOPE_SORT_ORDER[params.search_scope] || 'preferredTerm' },
    sort_direction: { type: 'string', range: ['asc', 'desc'] },
    search_scope: { type: 'string', range: SEARCH_SCOPES, default: '' }
  })
}

module.exports = function (app, _private = null) {
  app.subjects = {}

  app.subjects.browse = function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseBrowseParams(params)

    app.logger.debug('Parsed params: ', params)

    const body = buildElasticSubjectsBody(params)

    app.logger.debug('Subjects#browse', SUBJECTS_INDEX, body)

    return app.esClient.search(body, process.env.SUBJECTS_INDEX)
      .then((resp) => {
        return {
          '@type': 'subjectList',
          page: params.page,
          per_page: params.per_page,
          subjects: resp.hits?.hits?.map((hit) => {
            if ('preferredTerm.keyword' in hit.highlight) {
              // if match is on preferredTerm, use that regardless of variant matches
              return {
                preferredTerm: hit._source.preferredTerm,
                count: hit._source.count,
                broaderTerms: hit._source.broaderTerms,
                narrowerTerms: hit._source.narrowerTerms,
                seeAlso: hit._source.seeAlso,
                uri: hit._source.uri
              }
            } else {
              // Match was only on a variant- use that in the response.
              return {
                variantTerm: hit.highlight['variants.keyword'][0],
                preferredTerms: [
                  { [hit._source.preferredTerm]: hit._source.count }
                ]
              }
            }
          })
        }
      })
  }

  // For unit testing
  if (_private && typeof _private === 'object') {
    _private.buildElasticSubjectsBody = buildElasticSubjectsBody
    _private.parseBrowseParams = parseBrowseParams
  }
}

/**
 *  Given GET params, returns a plainobject with `from`, `size`, `query`,
 *  `sort`, and any other params necessary to perform the ES query based
 *  on the GET params.
 *
 *  @return {object} An object that can be posted directly to ES
 */
const buildElasticSubjectsBody = function (params) {
  const body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  const request = ApiRequest.fromParams(params)
  const builder = ElasticQuerySubjectsBuilder.forApiRequest(request)

  body.query = builder.query.toJson()

  // sort is done different for different search scopes due to how we manage variants
  if (params.search_scope === 'starts_with') {
    // When doing startsWith alphabetical sorting, we might get hits inside the "variants" array.
    // The way ES deals with sorting matches in an array is it looks at the lowest/highest lexicographical
    // entry in the array and uses that- *not* the entry that caused the match. So we use simple painless scripts
    // here which peek into the variants array and uses an actual matching term for the sort.
    const order = params.sort_direction || 'asc'
    const painlessScript = order === 'asc' ? PAINLESS_ALPHA_PREFIX_SORT_ASC : PAINLESS_ALPHA_PREFIX_SORT_DESC
    body.sort = [
      {
        _script: {
          type: 'string',
          order,
          script: {
            lang: 'painless',
            source: painlessScript,
            params: {
              prefix_value: request.querySansQuotes()
            }
          }
        }
      }
    ]
  } else {
    if (params.sort === 'relevance') {
      body.sort = [{ _score: { order: 'desc' } }]
    } else if (params.sort === 'count') {
      const fieldName = 'count'
      const direction = params.sort_direction || 'desc'
      body.sort = [{ [fieldName]: { order: direction } }]
    }
  }

  // Exclude items that have count == 0
  body.query.bool.must.push({ range: { count: { gt: 0 } } })

  // Use highlights to extract the matched variant if it exists
  const highlightDef = { pre_tags: '', post_tags: '' }
  body.highlight = { fields: { 'variants.keyword': highlightDef, 'preferredTerm.keyword': highlightDef } }

  return body
}
