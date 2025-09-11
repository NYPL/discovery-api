const { parseParams } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQuerySubjectsBuilder = require('./elasticsearch/elastic-query-subjects-builder')

const SUBJECTS_INDEX = process.env.SUBJECTS_INDEX

const SEARCH_SCOPES = [
  'has',
  'starts_with'
]

const SORT_FIELDS = [
  'termLabel',
  'count',
  'relevance'
]

// Default sort orders for different search scopes
const SEARCH_SCOPE_SORT_ORDER = {
  has: 'count',
  starts_with: 'termLabel'
}

const parseBrowseParams = function (params) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    sort: { type: 'string', range: SORT_FIELDS, default: SEARCH_SCOPE_SORT_ORDER[params.search_scope] || 'termLabel' },
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
          totalResults: resp.hits?.total?.value,
          subjects: resp.hits?.hits?.map((hit) => {
            if (hit.matched_queries && hit.matched_queries.length !== 0 && hit.matched_queries[0] === 'preferredTerm') {
              // if match is on preferredTerm, use that regardless of variant matches
              return {
                '@type': 'preferredTerm',
                termLabel: hit._source.preferredTerm,
                count: hit._source.count,
                broaderTerms: hit._source.broaderTerms?.map((term) => ({ termLabel: term })),
                narrowerTerms: hit._source.narrowerTerms?.map((term) => ({ termLabel: term })),
                seeAlso: hit._source.seeAlso?.map((term) => ({ termLabel: term })),
                uri: hit._source.uri
              }
            } else {
              // Match was on a variant- use that in the response.
              const matchedVariantTerm = hit.inner_hits.variants.hits.hits[0]._source.variant

              return {
                '@type': 'variant',
                termLabel: matchedVariantTerm,
                preferredTerms: [
                  {
                    termLabel: hit._source.preferredTerm,
                    count: hit._source.count
                  }
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
  if (params.sort === 'termLabel') {
    // When doing startsWith alphabetical sorting, we might get hits inside the "variants" array.
    // The way ES deals with sorting matches in an array is it looks at the lowest/highest lexicographical
    // entry in the array and uses that- *not* the entry that caused the match. So we use simple painless scripts
    // here which peek into the variants array and uses an actual matching term for the sort.
    const order = params.sort_direction || 'asc'
    const painlessScript = `
      String sortValue = null;
      String searchValue = params['prefix_value'].toLowerCase();
      for (Map variant : params._source.getOrDefault('variants', [])) {
          String variantKeyword = variant['variant'].toLowerCase();
          if (variantKeyword.startsWith(searchValue)) {
              if (sortValue == null || variantKeyword.compareTo(sortValue) ${order === 'asc' ? '>' : '<'} 0) {
                sortValue = variantKeyword;
              }
          }
      }
      if (sortValue == null || params._source['preferredTerm'].toLowerCase().startsWith(searchValue)) {
          sortValue = params._source['preferredTerm'].toLowerCase();
      }
      return sortValue;
    `

    body.sort = [
      {
        _script: {
          type: 'string',
          order,
          script: {
            lang: 'painless',
            source: painlessScript,
            params: {
              prefix_value: request.querySansQuotes().toLowerCase()
            }
          }
        }
      }
    ]
  } else {
    const direction = params.sort_direction || 'desc'
    if (params.sort === 'relevance') {
      body.sort = [{ _score: { order: direction } }]
    } else if (params.sort === 'count') {
      body.sort = [{ count: { order: direction } }]
    }
  }

  // Exclude items that have count == 0
  body.query.bool.must.push({ range: { count: { gt: 0 } } })

  return body
}
