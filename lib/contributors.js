const { parseBrowseParams } = require('./elasticsearch/browse-utils')

const ApiRequest = require('./api-request')
const ElasticQueryBrowseBuilder = require('./elasticsearch/elastic-query-browse-builder')

const BROWSE_INDEX = process.env.BROWSE_INDEX

const parseNameAndRole = (delimitedString) => {
  if (!delimitedString.includes('|')) {
    return { name: delimitedString, role: null }
  }
  const [name, role] = delimitedString.split('|')
  return { name, role }
}

module.exports = function (app, _private = null) {
  app.contributors = {}

  app.contributors.browse = function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseBrowseParams(params)

    app.logger.debug('Parsed params: ', params)

    const body = buildElasticContributorsBody(params)

    app.logger.debug('Contrbutors#browse', BROWSE_INDEX, body)

    return app.esClient.search(body, process.env.BROWSE_INDEX)
      .then((resp) => {
        return {
          '@type': 'contributorList',
          page: params.page,
          per_page: params.per_page,
          totalResults: resp.hits?.total?.value,
          contributors: resp.hits?.hits?.reduce((workingResponse, hit) => {
            if (hit.matched_queries?.[0] === 'preferredTerm' || hit.matched_queries?.[0] === 'preferredTermPrefix') { // if match is on preferredTerm, use that regardless of variant matches
              const { name, role } = parseNameAndRole(hit._source.preferredTerm)

              let contributorData = workingResponse.find(item => item.termLabel === name)

              if (!contributorData) {
                contributorData = {
                  '@type': 'preferredTerm',
                  termLabel: name
                }
                workingResponse.push(contributorData)
              }

              if (role) {
                // just add the role count to the top level response
                const roleCount = { role, count: hit._source.count }
                if (!contributorData.roleCounts) {
                  contributorData.roleCounts = []
                }
                contributorData.roleCounts.push(roleCount)
              } else {
                // top-level contributor object
                contributorData.count = hit._source.count
                contributorData.broaderTerms = hit._source.broaderTerms?.map((term) => ({ termLabel: term }))
                contributorData.narrowerTerms = hit._source.narrowerTerms?.map((term) => ({ termLabel: term }))
                contributorData.seeAlso = hit._source.seeAlso?.map((term) => ({ termLabel: term }))
                contributorData.uri = hit._source.uri
              }
            } else {
              // Match was on a variant- use that in the response
              const matchedVariantTerm = hit.inner_hits.variants.hits.hits[0]._source.variant

              const variantData = {
                '@type': 'variant',
                termLabel: matchedVariantTerm,
                preferredTerms: [
                  {
                    termLabel: hit._source.preferredTerm,
                    count: hit._source.count
                  }
                ]
              }

              workingResponse.push(variantData)
            }

            return workingResponse
          }, [])
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
  const builder = ElasticQueryBrowseBuilder.forApiRequest(request)

  body.query = builder.query.toJson()

  // match only termType 'contributor'
  body.query.bool.must.push({ term: { termType: { value: 'contributor' } } })

  // Exclude items that have count == 0
  body.query.bool.must.push({ range: { count: { gt: 0 } } })

  return body
}
