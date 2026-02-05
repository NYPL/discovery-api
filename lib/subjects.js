const { parseBrowseParams } = require('./elasticsearch/browse-utils')

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

  // sort is done different for different search scopes due to how we manage variants
  if (params.sort === 'termLabel') {
    // When doing startsWith alphabetical sorting, we might get hits inside the "variants" array.
    // The way ES deals with sorting matches in an array is it looks at the lowest/highest lexicographical
    // entry in the array and uses that- *not* the entry that caused the match. So we use simple painless scripts
    // here which peek into the variants array and uses an actual matching term for the sort.
    const order = params.sort_direction || 'asc'
    const painlessScript = `
      Pattern p = /[^a-zA-Z0-9]+/;
      String sortValue = null;
      String searchValue = params['prefix_value'].toLowerCase().replaceAll(p, match -> '');
      for (Map variant : params._source.getOrDefault('variants', [])) {
          String variantKeyword = variant['variant'].toLowerCase().replaceAll(p, match -> '');
          if (variantKeyword.startsWith(searchValue)) {
              if (sortValue == null || variantKeyword.compareTo(sortValue) ${order === 'asc' ? '>' : '<'} 0) {
                sortValue = variantKeyword;
              }
          }
      }
      String preferredTerm = params._source['preferredTerm'].toLowerCase().replaceAll(p, match -> '');
      if (sortValue == null || preferredTerm.startsWith(searchValue)) {
          sortValue = preferredTerm;
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

  // match only termType 'subject'
  body.query.bool.must.push({ term: { termType: { value: 'subject' } } })

  // Exclude items that have count == 0
  body.query.bool.must.push({ range: { count: { gt: 0 } } })

  return body
}
