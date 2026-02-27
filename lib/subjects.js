const { applySort, parseBrowseParams } = require('./elasticsearch/browse-utils')

const ApiRequest = require('./api-request')
const ElasticQueryBrowseBuilder = require('./elasticsearch/elastic-query-browse-builder')

const BROWSE_INDEX = process.env.BROWSE_INDEX

module.exports = function (app, _private = null) {
  app.subjects = {}

  app.subjects.browse = function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseBrowseParams(params)

    app.logger.debug('Parsed params: ', params)

    const body = buildElasticSubjectsBody(params)

    app.logger.debug('Subjects#browse ' + BROWSE_INDEX)

    return app.esClient.search(body, BROWSE_INDEX)
      .then((resp) => {
        return {
          '@type': 'subjectList',
          page: params.page,
          per_page: params.per_page,
          totalResults: resp.hits?.total?.value,
          subjects: resp.hits?.hits?.map((hit) => {
            if (hit.matched_queries?.[0] === 'preferredTerm' || hit.matched_queries?.[0] === 'preferredTermPrefix') { // if match is on preferredTerm, use that regardless of variant matches
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
              // Match was on a variant- use that in the response
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
  const builder = ElasticQueryBrowseBuilder.forApiRequest(request)

  body.query = builder.query.toJson()

  body.sort = applySort(params, request)

  // match only termType 'subject'
  body.query.bool.must.push({ term: { termType: { value: 'subject' } } })

  // Exclude items that have count == 0
  body.query.bool.must.push({ range: { count: { gt: 0 } } })

  return body
}
