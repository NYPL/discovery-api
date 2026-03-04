const { applySort, parseBrowseParams } = require('./elasticsearch/browse-utils')
const ApiRequest = require('./api-request')
const ElasticQueryBrowseBuilder = require('./elasticsearch/elastic-query-browse-builder')

const BROWSE_INDEX = process.env.BROWSE_INDEX

const parseNameAndRole = (delimitedString) => {
  if (!delimitedString || !delimitedString.includes('||')) {
    return { name: delimitedString, role: null }
  }
  const [name, role] = delimitedString.split('||')
  return { name, role }
}

module.exports = function (app, _private = null) {
  app.contributors = {}

  app.contributors.browse = function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseBrowseParams(params)
    app.logger.debug('Parsed params: ', params)

    const searchBody = buildElasticContributorsBody(params)
    const countBody = buildElasticContributorsBody(params, true) // true = count only top-level contributors

    app.logger.debug('Contributors#browse', BROWSE_INDEX, searchBody)

    return Promise.all([
      app.esClient.count(countBody, BROWSE_INDEX),
      app.esClient.search(searchBody, BROWSE_INDEX)
    ])
      .then(([countResp, searchResp]) => {
        const totalResults = countResp || 0
        const contributors = (searchResp.hits?.hits || []).reduce((workingResponse, hit) => {
          const matchedQuery = hit.matched_queries?.[0]

          if (matchedQuery === 'preferredTerm' || matchedQuery === 'preferredTermPrefix') {
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
              contributorData.roleCounts = contributorData.roleCounts || []
              contributorData.roleCounts.push({
                role,
                count: hit._source.count
              })
            } else {
              contributorData.count = hit._source.count
              contributorData.broaderTerms = hit._source.broaderTerms?.map(term => ({ termLabel: term }))
              contributorData.narrowerTerms = hit._source.narrowerTerms?.map(term => ({ termLabel: term }))
              contributorData.seeAlso = hit._source.seeAlso?.map(term => ({ termLabel: term }))
              contributorData.earlierHeadings = hit._source.earlierHeadings?.map(term => ({ termLabel: term }))
              contributorData.laterHeadings = hit._source.laterHeadings?.map(term => ({ termLabel: term }))
              contributorData.uri = hit._source.uri
            }
          } else {
            const matchedVariantTerm =
              hit.inner_hits?.variants?.hits?.hits?.[0]?._source?.variant

            if (matchedVariantTerm) {
              workingResponse.push({
                '@type': 'variant',
                termLabel: matchedVariantTerm,
                preferredTerms: [
                  {
                    termLabel: hit._source.preferredTerm,
                    count: hit._source.count
                  }
                ]
              })
            }
          }

          return workingResponse
        }, [])

        return {
          '@type': 'contributorList',
          page: params.page,
          per_page: params.per_page,
          totalResults,
          searchTotalResults: searchResp.hits?.total?.value,
          contributors
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
 * Builds Elasticsearch body for contributors query, or count of top
 * level contributors in query.
 *
 * @param {object} params
 * @param {boolean} topLevelCount
 */
const buildElasticContributorsBody = function (params, topLevelCount = false) {
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
  body.sort = applySort(params, request)

  // Exclude role docs when counting
  if (topLevelCount) {
    body.query.bool.must_not = [{
      wildcard: {
        'preferredTerm.keyword': '*||*'
      }
    }]
    delete body.sort
    delete body.size
    delete body.from
  }
  return body
}
