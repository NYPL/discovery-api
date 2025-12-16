const { parseParams } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQueryContributorsBuilder = require('./elasticsearch/elastic-query-contributors-builder')

const CONTRIBUTORS_INDEX = process.env.CONTRIBUTORS_INDEX

const SEARCH_SCOPES = [
  'has',
  'starts_with'
]

const SORT_FIELDS = [
  'contributorName',
  'count',
  'relevance'
]

// Default sort orders for different search scopes
const SEARCH_SCOPE_SORT_ORDER = {
  has: 'count',
  starts_with: 'contributorName'
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

    const body = buildElasticContributorsBody(params)

    app.logger.debug('Contrbutors#browse', CONTRIBUTORS_INDEX, body)

    return app.esClient.search(body, process.env.SUBJECTS_INDEX)
      .then((resp) => {
        return {
          '@type': 'contributorList',
          page: params.page,
          per_page: params.per_page,
          totalResults: resp.hits?.total?.value,
          contributors: resp.hits?.hits?.map((hit) => {
            // TODO: parse ES response into frontend-friendly format
            return {}
          })
        }
      })
  }

  // For unit testing
  if (_private && typeof _private === 'object') {
    _private.buildElasticContributorsBody = buildElasticContributorsBody
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
const buildElasticContributorsBody = function (params) {
  const body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  const request = ApiRequest.fromParams(params)
  const builder = ElasticQueryContributorsBuilder.forApiRequest(request)

  body.query = builder.query.toJson()
  return body
}
