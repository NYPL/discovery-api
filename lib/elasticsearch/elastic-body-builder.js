const { EXCLUDE_FIELDS, ITEM_FILTER_AGGREGATIONS, SORT_FIELDS, AGGREGATIONS_SPEC } = require('./config')
const { innerHits, itemsQueryContext, itemsFilterContext } = require('./elastic-query-filter-builder')
const ApiRequest = require('../api-request')
const ElasticQueryBuilder = require('../elasticsearch/elastic-query-builder')

/**
 * Given a ES search body, returns same object modified to include the
 * additional query necessary to limit (and paginate through) items
 *
 * @param {object} body - An ES query object (suitable for POSTing to ES
 * @param {object} options - An object optionally defining `size` and `from`
 *        for limiting and paginating through items
 */
const addInnerHits = (body, _options = {}) => {
  const wrappedItemsQuery = innerHits(_options)

  const placeToAddFilter = body.query.bool

  placeToAddFilter.filter.push(wrappedItemsQuery)

  return body
}

const bodyForFindByUri = async function (recapBarcodesByStatus, params) {
  const paramsIncludesItemLevelFiltering = Object.keys(params)
    .filter((param) => param.startsWith('item_')).length > 0

  const returnAllItems = params.all_items && !paramsIncludesItemLevelFiltering

  const excludes = returnAllItems ? EXCLUDE_FIELDS.filter((field) => field !== '*_sort') : EXCLUDE_FIELDS.concat(['items'])

  const aggregations = params.include_item_aggregations
    ? { aggregations: ITEM_FILTER_AGGREGATIONS }
    : {}

  const itemsOptions = {
    size: params.items_size,
    from: params.items_from,
    merge_checkin_card_items: params.merge_checkin_card_items,
    query: {
      volume: params.item_volume,
      date: params.item_date,
      format: params.item_format,
      location: params.item_location,
      status: params.item_status,
      itemUri: params.itemUri
    },
    unavailable_recap_barcodes: recapBarcodesByStatus['Not Available']
  }

  const filter = returnAllItems ? {} : { filter: [] }

  const queryFilter = { filter: !returnAllItems ? [innerHits(itemsOptions)] : [] }

  // Establish base query:
  const body = {
    _source: {
      excludes
    },
    size: 1,
    query: {
      bool: {
        must: [
          {
            term: {
              uri: params.uri
            }
          }
        ],
        ...queryFilter
      }
    },
    ...filter,
    ...aggregations
  }

  return body
}

/**
 *  Given GET params, returns a plainobject suitable for use in a ES query.
 *
 * @param {object} params - A hash of request params including `filters`,
 * `search_scope`, `q`
 *
 * @return {object} ES query object suitable to be POST'd to ES endpoint
 */
const buildElasticQuery = function (params, options = {}) {
  const request = ApiRequest.fromParams(params)

  const builder = ElasticQueryBuilder.forApiRequest(request, options)
  return builder.query.toJson()
}

/**
 *  Given GET params, returns a plainobject with `from`, `size`, `query`,
 *  `sort`, and any other params necessary to perform the ES query based
 *  on the GET params.
 *
 *  @return {object} An object that can be posted directly to ES
 */
const buildElasticBody = function (params, options = {}) {
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

  return {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page,
    query: buildElasticQuery(params, options),
    sort: [{ [field]: direction }, { uri: 'asc' }]
  }
}

const bodyForSearch = function (params) {
  const body = buildElasticBody(params, { items: true })

  // Strip unnecessary _source fields
  body._source = {
    excludes: EXCLUDE_FIELDS.concat(['items'])
  }

  return addInnerHits(body, { merge_checkin_card_items: params.merge_checkin_card_items })
}

const buildElasticAggregationsBody = (params, aggregateProps) => {
  // Add an `aggregations` entry to the ES body describing the aggretations
  // we want. Set the `size` property to per_page (default 50) for each.
  // https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-size
  const aggregations = aggregateProps.reduce((aggs, prop) => {
    aggs[prop] = AGGREGATIONS_SPEC[prop]
    // Only set size for terms aggs for now:
    if (aggs[prop].terms) {
      aggs[prop].terms.size = params.per_page
    }
    return aggs
  }, {})

  return Object.assign(
    buildElasticBody(params),
    { size: 0, aggregations }
  )
}

/**
* Given a params hash, returns an array of ES queries for fetching relevant aggregations.
*/
const aggregationQueriesForParams = (params) => {
  // Build the complete set of distinct aggregation queries we need to run
  // depending on active filters. We want:
  // - one agg representing the counts for all properties _not_ used in filter
  // - one agg each for each property that is used in a filter, but counts should exclude that filter

  // Build the standard aggregation:
  const unfilteredAggregationProps = Object.keys(AGGREGATIONS_SPEC)
    // Aggregate on all properties that aren't involved in filters:
    .filter((prop) => !Object.keys(params.filters || {}).includes(prop))
  const queries = [buildElasticAggregationsBody(params, unfilteredAggregationProps)]

  // Now append all property-specific aggregation queries (one for each
  // distinct property used in a filter):
  return queries.concat(
    Object.entries(params.filters || {})
      // Only consider filters that are also aggregations:
      .filter(([prop, values]) => Object.keys(AGGREGATIONS_SPEC).includes(prop))
      .map(([prop, values]) => {
        const aggFilters = structuredClone(params.filters)
        // For this aggregation, don't filter on namesake property:
        delete aggFilters[prop]

        // Build query for single aggregation:
        const modifiedParams = Object.assign({}, params, { filters: aggFilters })
        return buildElasticAggregationsBody(modifiedParams, [prop])
      })
  )
}

const bodyForAggregation = (params) => {
  const aggregations = {}
  aggregations[params.field] = AGGREGATIONS_SPEC[params.field]

  // If it's a terms agg, we can apply per_page:
  if (aggregations[params.field].terms) {
    aggregations[params.field].terms.size = params.per_page
  }

  return Object.assign(
    buildElasticBody(params),
    {
      size: 0,
      aggregations
    }
  )
}

module.exports = {
  bodyForFindByUri,
  addInnerHits,
  itemsFilterContext,
  itemsQueryContext,
  buildElasticQuery,
  buildElasticBody,
  bodyForSearch,
  buildElasticAggregationsBody,
  aggregationQueriesForParams,
  bodyForAggregation
}
