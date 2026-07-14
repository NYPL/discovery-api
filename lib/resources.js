const scsbClient = require('./scsb-client')

const ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
const ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
const AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
const AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
const ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const MarcSerializer = require('./marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')
const { IndexSearchError, IndexConnectionError } = require('./errors')

const ResponseMassager = require('./response_massager.js')

const { parseParams } = require('../lib/util')

const { AGGREGATIONS_SPEC } = require('./elasticsearch/config')

const errors = require('./errors')
const Item = require('./models/Item.js')
const {
  esRangeValue,
  parseSearchParams,
  nyplSourceAndId,
  itemsByFilter,
  mergeAggregationsResponses,
  lookupPatronType,
  makeRelevanceReport
} = require('./utils/resource-helpers')

const {
  bodyForFindByUri,
  bodyForSearch,
  aggregationQueriesForParams,
  bodyForAggregation
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
    await nyplSourceAndId(params.uri)

    // If we need to return itemAggregations or filter on item_status,
    // then we need to pre-retrieve SCSB item statuses to incorporate them into
    // aggregations and filters.

    // We only need to retrieve scsb statuses if building item aggs or
    // filtering on status:
    const retrieveScsbStatuses = params.include_item_aggregations || params.item_status
    let recapBarcodesByStatus = {}
    if (retrieveScsbStatuses) {
      try {
        recapBarcodesByStatus = await scsbClient.getBarcodesByStatusForBnum(params.uri)
      } catch (e) {
        app.logger.error(`Error connecting to SCSB; Unable to lookup barcodes for bib ${params.uri}`, e)
      }
    }

    const body = bodyForFindByUri(recapBarcodesByStatus, params)
    app.logger.debug('Resources#findByUri', body)
    let resp = await app.esClient.search(body)
    // Mindfully throw errors for known issues:
    if (!resp || !resp.hits) {
      throw new Error('Error connecting to index')
    } else if (resp?.hits?.total?.value === 0) {
      throw new errors.NotFoundError(`Record not found: ${params.uri}`)
    } else {
      const massagedResponse = new ResponseMassager(resp)
      try {
        resp = await massagedResponse.massagedResponse(request, { queryRecapCustomerCode: !!params.itemUri, recapBarcodesByStatus })
      } catch (e) {
        // If error hitting HTC, just return response un-modified:
      }
      const hitsAndItemAggregations = resp.hits.hits[0]._source
      hitsAndItemAggregations.itemAggregations = resp.aggregations
      return ResourceSerializer.serialize(hitsAndItemAggregations, Object.assign(opts, { root: true }))
    }
  }

  // Get a single raw annotated-marc resource:
  app.resources.annotatedMarc = async function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:

    const { id, nyplSource } = await nyplSourceAndId(params.uri)

    app.logger.debug('Resources#annotatedMarc', { id, nyplSource })

    const resp = await makeNyplDataApiClient().get(`bibs/${nyplSource}/${id}`)
    // need to check that the query actually found an entry
    if (!resp.data) {
      throw new errors.NotFoundError(`Record not found: bibs/${nyplSource}/${id}`)
    }

    return AnnotatedMarcSerializer.serialize(resp.data)
  }

  // Get a single raw marc:
  app.resources.marc = async function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:
    const { id, nyplSource } = await nyplSourceAndId(params.uri)

    app.logger.debug('Resources#annotatedMarc', { id, nyplSource })

    const resp = await makeNyplDataApiClient().get(`bibs/${nyplSource}/${id}`)
    // need to check that the query actually found an entry
    if (!resp.data) {
      throw new errors.NotFoundError(`Record not found: bibs/${nyplSource}/${id}`)
    }

    return MarcSerializer.serialize(resp.data)
  }

  // Get deliveryLocations for given resource(s)
  app.resources.deliveryLocationsByBarcode = async function (params, opts) {
    params = parseParams(params, {
      barcodes: { type: 'string', repeatable: true },
      patronId: { type: 'string' }
    })
    const barcodes = Array.isArray(params.barcodes) ? params.barcodes : [params.barcodes]

    const identifierValues = barcodes.map((barcode) => `urn:barcode:${barcode}`)

    // Create promise to resolve items:
    const fetchItems = itemsByFilter(identifierValues, app)

    // Run both item fetch and patron fetch in parallel:
    const [resp] = Promise.all([fetchItems, lookupPatronType])
    // The resolved values of Promise.all are strictly ordered based on original array of promises
    let items = resp[0]
    const scholarRoom = resp[1]

    // Use HTC API and nypl-core mappings to ammend ES response with deliveryLocations:
    try {
      items = await items.map(async (item) => Item.withDeliveryLocationsByBarcode(item, scholarRoom))
    } catch (e) {
      // An error here is likely an HTC API outage
      // Let's return items unmodified:
      //
      app.logger.info({ message: 'Caught (and ignoring) error mapping barcodes to recap customer codes', htcError: e.message })
      return items
    }
    items = await ItemResultsSerializer.serialize(items, opts)
    return items
  }

  // Conduct a search across resources:
  app.resources.search = async function (params, opts, request) {
    app.logger.debug('Unparsed params: ', params)
    params = parseSearchParams(params)

    app.logger.debug('Parsed params: ', params)

    const body = bodyForSearch(params)

    app.logger.debug('Resources#search', RESOURCES_INDEX, body)

    let resp

    try {
      resp = await app.esClient.search(body)
    } catch (e) {
      // Wrap ES client errors or any downstream error
      if (e instanceof IndexSearchError || e instanceof IndexConnectionError) {
        throw e // already a custom error
      }
      throw new IndexSearchError(`Error processing search: ${e.message || e}`)
    }

    try {
      const massagedResponse = new ResponseMassager(resp)
      resp = await massagedResponse.massagedResponse(request)
    } catch (e) {

    }

    resp = await ResourceResultsSerializer.serialize(resp, opts)

    const relevanceReport = resp.itemListElement
      .map(makeRelevanceReport(params))
    app.logger.debug(`Relevances:\n ${relevanceReport.join('\n')}`)

    resp.debug = {
      relevanceReport,
      query: body
    }
    return resp
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
  app.resources.aggregation = async (params, opts) => {
    params = parseSearchParams(params, {
      per_page: { type: 'int', default: 50, range: [0, 1000] }
    })
    if (Object.keys(AGGREGATIONS_SPEC).indexOf(params.field) < 0) {
      return Promise.reject(new Error('Invalid aggregation field'))
    }

    const serializationOpts = Object.assign(opts, {
      // This tells the serializer what fields are "packed" fields, which should be split apart
      packed_fields: ['materialType', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner'],
      root: true
    })

    const body = bodyForAggregation(params)

    app.logger.debug('Resources#aggregation:', body)

    let resp = await app.esClient.search(body)
    resp = resp.aggregations[params.field]._nested || resp.aggregations[params.field]
    resp.id = params.field
    return AggregationSerializer.serialize(resp, serializationOpts)
  }

  // For unit testing, export private methods if second arg given:
  if (_private && typeof _private === 'object') {
    _private.parseSearchParams = parseSearchParams
    _private.esRangeValue = esRangeValue
    _private.aggregationQueriesForParams = aggregationQueriesForParams
    _private.mergeAggregationsResponses = mergeAggregationsResponses
  }
}
