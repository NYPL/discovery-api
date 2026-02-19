const NyplSourceMapper = require('research-catalog-indexer/lib/utils/nypl-source-mapper')
const scsbClient = require('./scsb-client')

const ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
const ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
const AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
const AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
const ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const LocationLabelUpdater = require('./location_label_updater')
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const MarcSerializer = require('./marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')
const { IndexSearchError, IndexConnectionError } = require('./errors')

const ResponseMassager = require('./response_massager.js')
const AvailableDeliveryLocationTypes = require('./available_delivery_location_types')

const { parseParams, deepValue } = require('../lib/util')

const ApiRequest = require('./api-request')
const ElasticQueryBuilder = require('./elasticsearch/elastic-query-builder')
const cqlQueryBuilder = require('./elasticsearch/cql_query_builder')
const { FILTER_CONFIG, SEARCH_SCOPES, AGGREGATIONS_SPEC } = require('./elasticsearch/config')

const errors = require('./errors')
const Item = require('./models/Item.js')

const RESOURCES_INDEX = process.env.RESOURCES_INDEX

const ITEM_FILTER_AGGREGATIONS = {
  item_location: { nested: { path: 'items' }, aggs: { _nested: { terms: { size: 100, field: 'items.holdingLocation_packed' } } } },
  item_status: { nested: { path: 'items' }, aggs: { _nested: { terms: { size: 100, field: 'items.status_packed' } } } },
  item_format: { nested: { path: 'items' }, aggs: { _nested: { terms: { size: 100, field: 'items.formatLiteral' } } } }
}

// Configure sort fields:
const SORT_FIELDS = {
  title: {
    initialDirection: 'asc',
    field: 'title_sort'
  },
  date: {
    initialDirection: 'desc',
    field: 'dateStartYear'
  },
  creator: {
    initialDirection: 'asc',
    field: 'creator_sort'
  },
  relevance: {}
}

// The following fields can be excluded from ES responses because we don't pass them to client:
const EXCLUDE_FIELDS = [
  'uris',
  '*_packed',
  '*_sort',
  'items.*_packed',
  'contentsTitle',
  'suppressed',
  // Hide contributor and creator transformed fields:
  '*WithoutDates',
  '*Normalized'
]

// Configure controller-wide parameter parsing:
const parseSearchParams = function (params, overrideParams = {}) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    field: { type: 'string', range: Object.keys(AGGREGATIONS_SPEC) },
    sort: { type: 'string', range: Object.keys(SORT_FIELDS), default: 'relevance' },
    sort_direction: { type: 'string', range: ['asc', 'desc'] },
    search_scope: { type: 'string', range: Object.keys(SEARCH_SCOPES), default: 'all' },
    filters: { type: 'hash', fields: FILTER_CONFIG },
    items_size: { type: 'int', default: 100, range: [0, 200] },
    items_from: { type: 'int', default: 0 },
    callnumber: { type: 'string' },
    standard_number: { type: 'string' },
    contributor: { type: 'string' },
    title: { type: 'string' },
    subject: { type: 'string' },
    subject_prefix: { type: 'string' },
    isbn: { type: 'string' },
    issn: { type: 'string' },
    lccn: { type: 'string' },
    oclc: { type: 'string' },
    role: { type: 'string' },
    merge_checkin_card_items: { type: 'boolean', default: true },
    include_item_aggregations: { type: 'boolean', default: true },
    ...overrideParams
  })
}

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
    const nyplSourceMapper = await NyplSourceMapper.instance()
    const { id, nyplSource } = nyplSourceMapper.splitIdentifier(params.uri) ?? {}
    if (!id || !nyplSource) {
      throw new errors.InvalidParameterError(`Invalid bnum: ${params.uri}`)
    }

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
      .then((recapBarcodesByStatus) => {
        // Establish base query:
        let body = {
          _source: {
            excludes: EXCLUDE_FIELDS
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
              ]
            }
          }
        }
        const paramsIncludesItemLevelFiltering = Object.keys(params)
          .filter((param) => param.startsWith('item_')).length > 0
        const returnAllItems = params.all_items && !paramsIncludesItemLevelFiltering
        if (returnAllItems) {
          body._source.excludes = EXCLUDE_FIELDS.filter((field) => field !== '*_sort')
        } else {
          // No specific item requested, so add pagination and matching params:
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
          body = addInnerHits(body, itemsOptions)
          body._source = {
            excludes: EXCLUDE_FIELDS.concat(['items'])
          }
        }
        if (params.include_item_aggregations) {
          body.aggregations = ITEM_FILTER_AGGREGATIONS
        }
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

  // Get a single raw marc:
  app.resources.marc = async function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:
    const nyplSourceMapper = await NyplSourceMapper.instance()
    const { id, nyplSource } = nyplSourceMapper.splitIdentifier(params.uri) ?? {}

    if (!id || !nyplSource) {
      throw new errors.InvalidParameterError(`Invalid bnum: ${params.uri}`)
    }

    app.logger.debug('Resources#marc', { id, nyplSource })

    return makeNyplDataApiClient().get(`bibs/${nyplSource}/${id}`)
      .then((resp) => {
        // need to check that the query actually found an entry
        if (!resp.data) {
          throw new errors.NotFoundError(`Record not found: bibs/${nyplSource}/${id}`)
        } else {
          return resp.data
        }
      })
      .then(MarcSerializer.serialize)
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
        return Promise.all(items.map(async (item) => Item.withDeliveryLocationsByBarcode(item, scholarRoom)))
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

  /**
   * Given a ES search body, returns same object modified to include the
   * additional query necessary to limit (and paginate through) items
   *
   * @param {object} body - An ES query object (suitable for POSTing to ES
   * @param {object} options - An object optionally defining `size` and `from`
   *        for limiting and paginating through items
   */
  const addInnerHits = (body, _options = {}) => {
    const options = Object.assign({
      size: process.env.SEARCH_ITEMS_SIZE || 200,
      from: 0,
      merge_checkin_card_items: true
    }, _options)

    // Make sure necessary structure exists:
    if (!deepValue(body, 'query.bool') && !deepValue(body, 'query.function_score.query.bool')) {
      body.query = { bool: {} }
    }

    // The place to add the filter depends on the query built to this point:
    const placeToAddFilter = (body.query.bool || body.query.function_score.query.bool)
    // Initialize filter object if it doesn't already exist:
    placeToAddFilter.filter = placeToAddFilter.filter || []
    // If filter object already exists, convert it to array:
    if (!Array.isArray(placeToAddFilter.filter)) placeToAddFilter.filter = [placeToAddFilter.filter]

    const itemsQuery = {
      bool: Object.assign(
        itemsQueryContext(options),
        itemsFilterContext(options)
      )
    }

    const wrappedItemsQuery = {
      bool: {
        should: [
          {
            nested: {
              path: 'items',
              query: itemsQuery,
              inner_hits: {
                sort: [{ 'items.enumerationChronology_sort': 'desc' }],
                size: options.size,
                from: options.from,
                name: 'items'
              }
            }
          },
          // Add a catch-all to ensure we return the bib document even when
          // numItems=0 or applied item filters exclude all items:
          { match_all: {} }
        ]
      }
    }
    placeToAddFilter.filter.push(wrappedItemsQuery)

    // If there is any item query at all, run an additional inner_hits query
    // to retrieve the total number of items without filtering:
    if (itemsQuery.bool.filter) {
      wrappedItemsQuery.bool.should.push({
        nested: {
          path: 'items',
          query: {
            bool: {
              must_not: [{ exists: { field: 'items.electronicLocator' } }]
            }
          },
          inner_hits: { name: 'allItems' }
        }
      })
    }

    return body
  }

  /**
   * Given a range represented as an array, returns a corresponding ES range object
   *
   * @param {Array.<string>} range - An array consisting of a single date or a pair of dates
   * @returns {object}
   */
  const esRangeValue = (range) => {
    // the greater-than-equal value will always be the first value in the range array.
    // depending on the number of values and their equality, we query using less-than-equal
    // the second value, or just less-than the first value plus one

    // Treat case where range start equals range end same as case of single value:
    if (range[0] === range[1]) range = range.slice(0, 1)
    const rangeQuery = {
      gte: range[0]
    }
    if (range.length === 2) {
      // search on both range values
      rangeQuery.lte = range[range.length - 1]
    } else if (range.length === 1) {
      // if there is just one range, query up until the next year
      rangeQuery.lt = range[0] + 1
    }
    return rangeQuery
  }

  /**
   * Given an object containing filters,
   * returns content of the ES query filter context
   *
   * @param {object} options - An object with keys,value pairs of the form [filter_name]:[filter_value]
   * @returns {object}
   */
  const itemsFilterContext = (options) => {
    if (!options.query) return {}

    const filterHandlers = {
      volume: (volumes) => {
        return {
          range: {
            'items.volumeRange': esRangeValue(volumes)
          }
        }
      },
      date: (dates) => {
        return {
          range: {
            'items.dateRange': esRangeValue(dates)
          }
        }
      },
      format: (formats) => {
        return {
          terms: {
            'items.formatLiteral': formats
          }
        }
      },
      location: (locations) => {
        return {
          terms: {
            'items.holdingLocation.id': locations
          }
        }
      },
      status: (statuses) => {
        // Determine if all possible ReCAP statuses were selected:
        const selectedRecapStatuses = recapStatuses(statuses)

        if (selectedRecapStatuses.length === 1 &&
          Array.isArray(options.unavailable_recap_barcodes) &&
          options.unavailable_recap_barcodes.length > 0) {
          // There are known unavailable ReCAP items, so build a complicated
          // filter clause with appropriate barcode overrides:
          return itemStatusFilterWithUnavailableRecapItems(statuses, options.unavailable_recap_barcodes)
        } else {
          // If there are no known unavailable ReCAP items, just do a straight
          // status match:
          return {
            terms: {
              'items.status.id': statuses
            }
          }
        }
      },
      itemUri: (uri) => {
        return { term: { 'items.uri': uri } }
      }
    }

    const filters = Object.keys(options.query).map((filter) => {
      const value = options.query[filter]
      const handler = filterHandlers[filter]
      return value && handler ? handler(value) : null
    }).filter((x) => x)

    return filters.length
      ? { filter: filters }
      : {}
  }

  /**
   * Given an array of status ids (e.g. "status:a", "status:na") returns the
   * subset of statuses that are relevant in ReCAP
   */
  const recapStatuses = (statuses) => {
    return statuses
      .filter((status) => ['status:a', 'status:na'].includes(status))
  }

  /**
   *  Builds a big complicated ES filter to allow us to filter items by status,
   *  but override the indexed status for ReCAP items with statuses retrieved
   *  from SCSB. This corrects for the fact that ReCAP item statuses tend to be
   *  wrong in the ES index:
   *   - partner items are indexed as Available and remain thus forever
   *   - NYPL item statuses _should_ equal SCSB status, but the mechanism
   *     for keeping them synced isn't perfect and operates on a delay
   *
   *  @param {string[]} statuses - An array of statuses to filter on
   *  @param {string[]} unavailableRecapBarcodes - An array of item barcodes
   *    known to be unavailble
   *
   *  Returns an ES filter that matches the desired statuses, but also uses
   *  the known unavailable items to override indexed item statuses for ReCAP
   *  items (because ReCAP is the authority for status of off-site items).
   *  Essentially, the criteria is for matching an item is:
   *
   *   - if on-site (non-ReCAP):
   *     - has a matching indexed status
   *   - if off-site:
   *     - if filtering on status:na
   *       - item barcode must be in unavailableRecapBarcodes
   *     - if filtering on status:a:
   *       - item barcode must NOT be in unavailableRecapBarcodes
   */
  const itemStatusFilterWithUnavailableRecapItems = (statuses, unavailableRecapBarcodes) => {
    // First, let's set up some common clauses:

    // Item is in ReCAP:
    const itemIsRecapClause = {
      regexp: { 'items.holdingLocation.id': 'loc:rc.*' }
    }
    // Item's indexed status matches one of the filtered statuses:
    const itemHasIndexedStatusClause = {
      terms: { 'items.status.id': statuses }
    }
    // Item is marked Unavailable in SCSB:
    const itemIsUnavailableInRecapClause = {
      script: {
        script: {
          inline: 'doc[\'items.idBarcode\'].value == null || ' +
            'params.unavailableRecapBarcodes.contains(doc[\'items.idBarcode\'][0])',
          lang: 'painless',
          params: { unavailableRecapBarcodes }
        }
      }
    }
    // This function is only called if `statuses` param contains a single
    // ReCAP-relevant status (i.e. status:a or status:na), so determine which
    // ReCAP status to use:
    const selectedRecapStatus = recapStatuses(statuses).shift()
    // Item's ReCAP status agrees with filter:
    const itemRecapStatusAgreesWithFilterClause =
      selectedRecapStatus === 'status:na'
        ? itemIsUnavailableInRecapClause
        : { bool: { must_not: itemIsUnavailableInRecapClause } }

    return {
      bool: {
        should: [
          // Either 1) item is on-site and has correctly indexed status:
          {
            bool: {
              must: [
                // Item is on-site (i.e. not recap):
                { bool: { must_not: itemIsRecapClause } },
                // Item indexed status matches filter:
                itemHasIndexedStatusClause
              ]
            }
          },
          // Or 2) item is off-site and has a scsb status that agrees with the
          // filter (e.g. if filtering on status:na, scsb marks the barcode as
          // 'Not Available')
          {
            bool: {
              must: [
                // Item is off-site:
                JSON.parse(JSON.stringify(itemIsRecapClause)),
                // Item is not marked unavailable
                itemRecapStatusAgreesWithFilterClause
              ]
            }
          }
        ]
      }
    }
  }

  /**
   * Given an object containing query options,
   * returns content of the ES query context
   *
   * @param {object} options - An object with request options. `merge_checkin_card_items` is the only one
   * that matters right now
   * @returns {object}
   */
  const itemsQueryContext = (options) => {
    const excludeClauses = []

    if (!options.merge_checkin_card_items) excludeClauses.push({ term: { 'items.type': 'nypl:CheckinCardItem' } })

    return excludeClauses.length ? { must_not: excludeClauses } : { must: { match_all: {} } }
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

    if (params.search_scope !== 'cql') {
      body = addInnerHits(body, { merge_checkin_card_items: params.merge_checkin_card_items })
    }

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
  if (params.search_scope === 'cql') {
    const query = cqlQueryBuilder.buildEsQuery(params.q)
    return query
  }
  const request = ApiRequest.fromParams(params)

  const builder = ElasticQueryBuilder.forApiRequest(request)
  return builder.query.toJson()
}
