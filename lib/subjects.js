const { parseParams } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQuerySubjectsBuilder = require('./elasticsearch/elastic-query-subjects-builder')

const SUBJECTS_INDEX = process.env.SUBJECTS_INDEX

const SEARCH_SCOPES = [
  'has',
  'starts_with'
]

const SORT_FIELDS = {
  preferredTerm: {
    initialDirection: 'asc',
    field: 'preferredTerm.keyword'
  },
  count: {
    initialDirection: 'desc',
    field: 'count'
  },
  relevance: {}
}

// Default sort orders for different search scopes
const SEARCH_SCOPE_SORT_ORDER = {
  has: 'count',
  starts_with: 'preferredTerm'
}

const parseBrowseParams = function (params) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    sort: { type: 'string', range: Object.keys(SORT_FIELDS), default: SEARCH_SCOPE_SORT_ORDER[params.search_scope] || 'preferredTerm' },
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
          subjects: resp.hits?.hits?.map((hit) => {
            return {
              preferredTerm: hit._source.preferredTerm,
              count: hit._source.count,
              broaderTerms: hit._source.broaderTerms,
              narrowerTerms: hit._source.narrowerTerms,
              variants: hit._source.variants,
              uri: hit._source.uri
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

  // Apply sort:
  let direction
  let field

  if (params.sort === 'relevance') {
    field = '_score'
    direction = 'desc'
  } else {
    field = SORT_FIELDS[params.sort].field || params.sort
    direction = params.sort_direction || SORT_FIELDS[params.sort].initialDirection
  }
  body.sort = [{ [field]: direction }]

  return body
}
