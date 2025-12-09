const scsbClient = require('./scsb-client')

const ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
const ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
const AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
const AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
const ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')
const { IndexSearchError, IndexConnectionError } = require('./errors')

const ResponseMassager = require('./response_massager.js')
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const AvailableDeliveryLocationTypes = require('./available_delivery_location_types')

const { parseParams } = require('../lib/util')

const { AGGREGATIONS_SPEC } = require('./elasticsearch/config')

const errors = require('./errors')
const {
  esRangeValue,
  parseSearchParams,
  nyplSourceAndId,
  itemsByFilter,
  mergeAggregationsResponses
} = require('./utils/resource-helpers')

const {
  bodyForFindByUri,
  addInnerHits,
  itemsFilterContext,
  itemsQueryContext,
  buildElasticQuery,
  buildElasticBody,
  bodyForSearch,
  aggregationQueriesForParams
} = require('./elasticsearch/elastic-body-builder')

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

    const { id, nyplSource } = await nyplSourceAndId(params)

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
    const fetchItems = itemsByFilter(identifierValues, app)

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

    const body = bodyForSearch(params)

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
