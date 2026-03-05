const { applySort, parseBrowseParams } = require('./elasticsearch/browse-utils')

const ApiRequest = require('./api-request')
const ElasticQueryBrowseBuilder = require('./elasticsearch/elastic-query-browse-builder')

const BROWSE_INDEX = process.env.BROWSE_INDEX

const parseNameAndRole = (delimitedString) => {
  if (!delimitedString.includes('||')) {
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

    const body = buildElasticContributorsBody(params)

    app.logger.debug('Contrbutors#browse', BROWSE_INDEX, body)

    return app.esClient.search(body, process.env.BROWSE_INDEX)
      .then((resp) => {
        const contributorList = []
        const workingResponse = {
          '@type': 'contributorList',
          page: params.page,
          per_page: params.per_page,
          totalResults: resp.hits?.total?.value,
          contributors: resp.hits?.hits?.map((hit) => {
            if (hit.matched_queries?.[0] === 'preferredTerm' || hit.matched_queries?.[0] === 'preferredTermPrefix') { // if match is on preferredTerm, use that regardless of variant matches
              const name = hit._source.preferredTerm

              contributorList.push(name)

              return {
                '@type': 'preferredTerm',
                termLabel: name,
                count: hit._source.count,
                broaderTerms: hit._source.broaderTerms?.map((term) => ({ termLabel: term })),
                narrowerTerms: hit._source.narrowerTerms?.map((term) => ({ termLabel: term })),
                seeAlso: hit._source.seeAlso?.map((term) => ({ termLabel: term })),
                earlierHeadings: hit._source.earlierHeadings?.map((term) => ({ termLabel: term })),
                laterHeadings: hit._source.laterHeadings?.map((term) => ({ termLabel: term })),
                uri: hit._source.uri,
                roleCounts: []
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

        // Get the counts of roles for each contributor in the response object
        return app.esClient.search(buildElasticRoleCountQuery(contributorList), process.env.RESOURCES_INDEX)
          .then((resp) => {
            const contributorRoleCounts = {}
            resp.aggregations?.contributor_role?.buckets?.forEach((agg) => {
              const { name, role } = parseNameAndRole(agg.key)
              if (!contributorRoleCounts[name]) {
                contributorRoleCounts[name] = []
              }

              contributorRoleCounts[name].push({ role, count: agg.doc_count })
            })

            workingResponse.contributors.forEach((contributor) => {
              contributor.roleCounts = contributorRoleCounts[contributor.termLabel]
            })

            return workingResponse
          })
      })
  }

  // For unit testing
  if (_private && typeof _private === 'object') {
    _private.buildElasticContributorsBody = buildElasticContributorsBody
    _private.parseBrowseParams = parseBrowseParams
  }
}

/**
 * Builds an aggregation query that checks the resource index for counts on the contributorRoleLiteral field for a list of contributors.
 */
const buildElasticRoleCountQuery = function (contributorList) {
  return {
    size: 0,
    query: {
      terms: {
        contributorRoleLiteral: contributorList
      }
    },
    aggs: {
      contributor_role: {
        terms: {
          script: {
            source: 'def results = []; for (val in doc["contributorRoleLiteral"]) { int pos = val.indexOf("||"); if (pos != -1) { String name = val.substring(0, pos); if (params.targets.contains(name)) { results.add(val); } } } return results;',
            params: {
              targets: contributorList
            }
          },
          size: 1000
        }
      }
    }
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

  body.sort = applySort(params, request)

  return body
}
