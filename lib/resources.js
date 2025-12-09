const NyplSourceMapper = require('research-catalog-indexer/lib/utils/nypl-source-mapper')
const scsbClient = require('./scsb-client')

const ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
const ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
const AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
const AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
const ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const LocationLabelUpdater = require('./location_label_updater')
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')
const { IndexSearchError, IndexConnectionError } = require('./errors')

const ResponseMassager = require('./response_massager.js')
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const AvailableDeliveryLocationTypes = require('./available_delivery_location_types')

const { parseParams } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQueryBuilder = require('./elasticsearch/elastic-query-builder')
const { AGGREGATIONS_SPEC, EXCLUDE_FIELDS, SORT_FIELDS } = require('./elasticsearch/config')

const errors = require('./errors')
const { esRangeValue, parseSearchParams, nyplSourceAndId } = require('./utils/resource-helpers')
const { bodyForFindByUri, addInnerHits, itemsFilterContext, itemsQueryContext } = require('./elasticsearch/elastic-body-builder')

const RESOURCES_INDEX = process.env.RESOURCES_INDEX

// These are the handlers made available to the router:
module.exports = function (app, _private = null) {
  app.resources = {}

  // Get a single resource:
  app.resources.findByUri = async function (params, opts = {}, request) {
    // Parse all params we support:
    params = parseParams(params, {
      all_items: { type: 'boolean', default: false },
      uri: { type: 'string' },
      itemUri: { type: 'string' },
      items_size: { type: 'int', default: 100, range: [0, 200] },
      items_from: { type: 'int', default: 0 },
      merge_checkin_card_items: { type: 'boolean', default: true },
      item_volume: { type: 'int-range' },
      item_date: { type: 'int-range' },
      item_format: { type: 'string-list' },
      item_location: { type: 'string-list' },
      item_status: { type: 'string-list' },
      include_item_aggregations: { type: 'boolean', default: true }
    })

    // Validate uri:
    await nyplSourceAndId(params)

    // If we need to return itemAggregations or filter on item_status,
    // then we need to pre-retrieve SCSB item statuses to incorporate them into
    // aggregations and filters.

    // We only need to retrieve scsb statuses if building item aggs or
    // filtering on status:
    const retrieveScsbStatuses = params.include_item_aggregations || params.item_status
    const scsbStatusLookup = retrieveScsbStatuses
      ? scsbClient.getBarcodesByStatusForBnum(params.uri)
        .catch((e) => {
          app.logger.error(`Error connecting to SCSB; Unable to lookup barcodes for bib ${params.uri}`, e)
          return {}
        })
      : Promise.resolve({})

    return scsbStatusLookup
      .then(async (recapBarcodesByStatus) => {
        const body = await bodyForFindByUri(recapBarcodesByStatus, params)
        app.logger.debug('Resources#findByUri', body)
        return app.esClient.search(body)
          .then((resp) => {
            // Mindfully throw errors for known issues:
            if (!resp || !resp.hits) {
              throw new Error('Error connecting to index')
            } else if (resp?.hits?.total?.value === 0) {
              throw new errors.NotFoundError(`Record not found: ${params.uri}`)
            } else {
              const massagedResponse = new ResponseMassager(resp)
              return massagedResponse.massagedResponse(request, { queryRecapCustomerCode: !!params.itemUri, recapBarcodesByStatus })
                .catch((e) => {
                  // If error hitting HTC, just return response un-modified:
                  return resp
                })
            }
          }).then((resp) => {
            const hitsAndItemAggregations = resp.hits.hits[0]._source
            hitsAndItemAggregations.itemAggregations = resp.aggregations
            return ResourceSerializer.serialize(hitsAndItemAggregations, Object.assign(opts, { root: true }))
          })
      })
  }

  // Get a single raw annotated-marc resource:
  app.resources.annotatedMarc = async function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:
    const nyplSourceMapper = await NyplSourceMapper.instance()
    const { id, nyplSource } = nyplSourceMapper.splitIdentifier(params.uri) ?? {}

    if (!id || !nyplSource) {
      throw new errors.InvalidParameterError(`Invalid bnum: ${params.uri}`)
    }

    app.logger.debug('Resources#annotatedMarc', { id, nyplSource })

    return makeNyplDataApiClient().get(`bibs/${nyplSource}/${id}`)
      .then((resp) => {
        // need to check that the query actually found an entry
        if (!resp.data) {
          throw new errors.NotFoundError(`Record not found: bibs/${nyplSource}/${id}`)
        } else {
          return resp.data
        }
      })
      .then(AnnotatedMarcSerializer.serialize)
  }

  function itemsByFilter (filter, opts) {
    opts = Object.assign({
      _source: null
    }, opts)

    // Build ES query body:
    const body = {
      query: {
        nested: {
          path: 'items',
          score_mode: 'avg',
          query: {
            constant_score: {
              filter
            }
          }
        }
      }
    }
    if (opts._source) body._source = opts._source

    app.logger.debug('Resources#itemsByFilter', body)
    return app.esClient.search(body)
      .then((resp) => {
        if (!resp || !resp.hits || resp.hits.total === 0) return Promise.reject(new Error('No matching items'))
        resp = new LocationLabelUpdater(resp).responseWithUpdatedLabels()
        // Convert this ES bibs response into an array of flattened items:
        return resp.hits.hits
          .map((doc) => doc._source)
          // Reduce to a flat array of items
          .reduce((a, bib) => {
            return a.concat(bib.items)
              // Let's affix that bnum into the item's identifiers so we know where it came from:
              .map((i) => {
                return Object.assign(i, { identifier: [`urn:bnum:${bib.uri}`].concat(i.identifier) })
              })
          }, [])
      })
  }

  // Get deliveryLocations for given resource(s)
  app.resources.deliveryLocationsByBarcode = function (params, opts) {
    params = parseParams(params, {
      barcodes: { type: 'string', repeatable: true },
      patronId: { type: 'string' }
    })
    const barcodes = Array.isArray(params.barcodes) ? params.barcodes : [params.barcodes]

    const identifierValues = barcodes.map((barcode) => `urn:barcode:${barcode}`)

    // Create promise to resolve deliveryLocationTypes by patron type:
    const lookupPatronType = AvailableDeliveryLocationTypes.getScholarRoomByPatronId(params.patronId)
      .catch((e) => {
        throw new errors.InvalidParameterError('Invalid patronId')
      })

    // Create promise to resolve items:
    const fetchItems = itemsByFilter(
      { terms: { 'items.identifier': identifierValues } },
      { _source: ['uri', 'type', 'items.uri', 'items.type', 'items.identifier', 'items.holdingLocation', 'items.status', 'items.catalogItemType', 'items.accessMessage', 'items.m2CustomerCode'] }

      // Filter out any items (multi item bib) that don't match one of the queriered barcodes:
    ).then((items) => {
      return items.filter((item) => {
        return item.identifier.filter((i) => identifierValues.indexOf(i) >= 0).length > 0
      })
    })

    // Run both item fetch and patron fetch in parallel:
    return Promise.all([fetchItems, lookupPatronType])
      .then((resp) => {
        // The resolved values of Promise.all are strictly ordered based on original array of promises
        const items = resp[0]
        const scholarRoom = resp[1]

        // Use HTC API and nypl-core mappings to ammend ES response with deliveryLocations:
        return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability(items, scholarRoom)
          .catch((e) => {
            // An error here is likely an HTC API outage
            // Let's return items unmodified:
            //
            app.logger.info({ message: 'Caught (and ignoring) error mapping barcodes to recap customer codes', htcError: e.message })
            return items
          })
      })
      .then((items) => ItemResultsSerializer.serialize(items, opts))
  }

  // Conduct a search across resources:
  app.resources.search = function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseSearchParams(params)

    app.logger.debug('Parsed params: ', params)

    let body = buildElasticBody(params)

    // Strip unnecessary _source fields
    body._source = {
      excludes: EXCLUDE_FIELDS.concat(['items'])
    }

    body = addInnerHits(body, { merge_checkin_card_items: params.merge_checkin_card_items })

    app.logger.debug('Resources#search', RESOURCES_INDEX, body)

    return app.esClient.search(body)
      .then((resp) => {
        const massagedResponse = new ResponseMassager(resp)
        return massagedResponse.massagedResponse(request)
          .catch((e) => {
            // If error hitting HTC, just return response un-modified:
            return resp
          })
          .then((updatedResponse) => ResourceResultsSerializer.serialize(updatedResponse, opts))
          .then((resp) => {
            // Build relevance report (for debugging):
            const relevanceReport = resp.itemListElement
              .map((r, ind) => {
                const out = []
                out.push(`${ind + 1}: ${r.searchResultScore} score > ${r.result.uri}:`)
                if (params.search_scope === 'contributor') out.push(`(${r.result.creatorLiteral || r.result.contributorLiteral})`)
                if (['standard_number', 'callnumber'].includes(params.search_scope)) out.push(`(${r.result.items && r.result.items[0]?.shelfMark})`)
                out.push(`${r.result.title} (displayed as "${r.result.titleDisplay}")`)
                if (r.matchedQueries) out.push(`\n  ${r.matchedQueries.join(', ')}`)
                return out.join(' ')
              })
            app.logger.debug(`Relevances:\n ${relevanceReport.join('\n')}`)

            resp.debug = {
              relevanceReport,
              query: body
            }
            return resp
          })
      })
      .catch((e) => {
        // Wrap ES client errors or any downstream error
        if (e instanceof IndexSearchError || e instanceof IndexConnectionError) {
          throw e // already a custom error
        }
        throw new IndexSearchError(`Error processing search: ${e.message || e}`)
      })
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

    const body = buildElasticBody(params)
    body.size = 0
    body.aggregations = aggregations

    return body
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

  /**
  * Given an array of ES aggregations responses (such as that returned from msearch)
  **/
  const mergeAggregationsResponses = (responses) => {
    // Filter out errored responses:
    responses = responses.filter((resp) => resp.aggregations)
    if (responses.length === 0) {
      return {}
    }
    return {
      // Use `hits` of last element, somewhat arbitrarily:
      hits: responses[responses.length - 1].hits,
      aggregations: responses
        .reduce((allAggs, resp) => {
          const respAggs = Object.entries(resp.aggregations)
            // Build hash of response aggs, squashing _nested aggs:
            .reduce((a, [field, _a]) => {
              // If it's nested, it will be in our special '_nested' prop:
              a[field] = _a._nested || _a
              return a
            }, {})
          // Add response aggs to combined aggs:
          return Object.assign(allAggs, respAggs)
        }, {})
    }
  }

  // Get all aggregations:
  app.resources.aggregations = async (params, opts) => {
    params = parseSearchParams(params)

    // Get all 1+ aggregation queries for this search:
    const aggregationQueries = aggregationQueriesForParams(params)

    const serializationOpts = Object.assign(opts, {
      packed_fields: ['location', 'materialType', 'locationBuilding', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner']
    })

    // Run all aggregations through msearch:
    const response = await app.esClient.msearch(aggregationQueries)
    // Combine aggregation responses into a single pseudo response:
    const combinedResp = mergeAggregationsResponses(response.responses)

    // Serialize the aggregation response to the client:
    return AggregationsSerializer.serialize(combinedResp, serializationOpts)
  }

  // Get a single aggregation:
  app.resources.aggregation = (params, opts) => {
    params = parseSearchParams(params, {
      per_page: { type: 'int', default: 50, range: [0, 1000] }
    })
    if (Object.keys(AGGREGATIONS_SPEC).indexOf(params.field) < 0) {
      return Promise.reject(new Error('Invalid aggregation field'))
    }

    const body = buildElasticBody(params)

    // We're fetching aggs, so specify 0 resource results:
    body.size = 0

    body.aggregations = {}
    body.aggregations[params.field] = AGGREGATIONS_SPEC[params.field]

    // If it's a terms agg, we can apply per_page:
    if (body.aggregations[params.field].terms) {
      body.aggregations[params.field].terms.size = params.per_page
    }

    const serializationOpts = Object.assign(opts, {
      // This tells the serializer what fields are "packed" fields, which should be split apart
      packed_fields: ['materialType', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner'],
      root: true
    })

    app.logger.debug('Resources#aggregation:', body)
    return app.esClient.search(body)
      .then((resp) => {
        // If it's nested, it will be in our special '_nested' prop:
        resp = resp.aggregations[params.field]._nested || resp.aggregations[params.field]
        resp.id = params.field
        return AggregationSerializer.serialize(resp, serializationOpts)
      })
  }

  // For unit testing, export private methods if second arg given:
  if (_private && typeof _private === 'object') {
    _private.buildElasticBody = buildElasticBody
    _private.buildElasticQuery = buildElasticQuery
    _private.parseSearchParams = parseSearchParams
    _private.esRangeValue = esRangeValue
    _private.itemsFilterContext = itemsFilterContext
    _private.itemsQueryContext = itemsQueryContext
    _private.addInnerHits = addInnerHits
    _private.aggregationQueriesForParams = aggregationQueriesForParams
    _private.mergeAggregationsResponses = mergeAggregationsResponses
  }
}

/**
 *  Given GET params, returns a plainobject with `from`, `size`, `query`,
 *  `sort`, and any other params necessary to perform the ES query based
 *  on the GET params.
 *
 *  @return {object} An object that can be posted directly to ES
 */
const buildElasticBody = function (params) {
  const body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  body.query = buildElasticQuery(params)

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
  body.sort = [{ [field]: direction }, { uri: 'asc' }]

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
const buildElasticQuery = function (params) {
  const request = ApiRequest.fromParams(params)

  const builder = ElasticQueryBuilder.forApiRequest(request)
  return builder.query.toJson()
}
