const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')
const scsbClient = require('./scsb-client')

const ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
const ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
const AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
const AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
const ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const LocationLabelUpdater = require('./location_label_updater')
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')

const ResponseMassager = require('./response_massager.js')
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const AvailableDeliveryLocationTypes = require('./available_delivery_location_types')

const { parseParams, backslashes, deepValue } = require('../lib/util')

const errors = require('./errors')

const RESOURCES_INDEX = process.env.RESOURCES_INDEX

const ITEM_FILTER_AGGREGATIONS = {
  item_location: { nested: { path: 'items' }, aggs: { '_nested': { terms: { size: 100, field: 'items.holdingLocation_packed' } } } },
  item_status: { nested: { path: 'items' }, aggs: { '_nested': { terms: { size: 100, field: 'items.status_packed' } } } },
  item_format: { nested: { path: 'items' }, aggs: { '_nested': { terms: { size: 100, field: 'items.formatLiteral' } } } }
}

// Configures aggregations:
const AGGREGATIONS_SPEC = {
  owner: { nested: { path: 'items' }, aggs: { '_nested': { terms: { field: 'items.owner_packed' } } } },
  subjectLiteral: { terms: { field: 'subjectLiteral.raw' } },
  language: { terms: { field: 'language_packed' } },
  materialType: { terms: { field: 'materialType_packed' } },
  mediaType: { terms: { field: 'mediaType_packed' } },
  publisher: { terms: { field: 'publisherLiteral.raw' } },
  contributorLiteral: { terms: { field: 'contributorLiteral.raw' } },
  creatorLiteral: { terms: { field: 'creatorLiteral.raw' } },
  issuance: { terms: { field: 'issuance_packed' } }
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

// Configure search scopes:
const SEARCH_SCOPES = {
  all: {
    fields: [
      'title^5',
      'title.folded^2',
      'description.folded',
      'subjectLiteral^2',
      'subjectLiteral.folded',
      'creatorLiteral^2',
      'creatorLiteral.folded',
      'contributorLiteral.folded',
      'note.label.folded',
      'publisherLiteral.folded',
      'seriesStatement.folded',
      'titleAlt.folded',
      'titleDisplay.folded',
      'contentsTitle.folded',
      'donor.folded',
      'parallelTitle.folded^5',
      'parallelTitleDisplay.folded',
      'parallelTitleAlt.folded',
      'parallelSeriesStatement.folded',
      'parallelCreatorLiteral.folded',
      'parallelPublisher'
    ]
  },
  title: {
    fields: [
      'title^5',
      'title.folded^2',
      'titleAlt.folded',
      'uniformTitle.folded',
      'titleDisplay.folded',
      'seriesStatement.folded',
      'contentsTitle.folded',
      'donor.folded',
      'parallelTitle.folded^5',
      'parallelTitleDisplay.folded',
      'parallelSeriesStatement.folded',
      'parallelTitleAlt.folded',
      'parallelCreatorLiteral.folded',
      'parallelUniformTitle'
    ]
  },
  contributor: {
    fields: ['creatorLiteral^4', 'creatorLiteral.folded^2', 'contributorLiteral.folded', 'parallelCreatorLiteral.folded', 'parallelContributorLiteral.folded']
  },
  subject: {
    fields: ['subjectLiteral^2', 'subjectLiteral.folded', 'parallelSubjectLiteral.folded']
  },
  series: {
    fields: ['seriesStatement.folded']
  },
  callnumber: {
    fields: ['shelfMark', 'items.shelfMark']
  },
  standard_number: {
    fields: ['shelfMark', 'identifierV2.value', 'uri', 'identifier', 'items.shelfMark', { field: 'items.idBarcode', on: (q) => /\d{6,}/.test(q) }, 'idIsbn_clean']
  }
}

const FILTER_CONFIG = {
  owner: { operator: 'match', field: 'items.owner_packed', repeatable: true, path: 'items' },
  subjectLiteral: { operator: 'match', field: 'subjectLiteral_exploded', repeatable: true },
  holdingLocation: { operator: 'match', field: 'items.holdingLocation_packed', repeatable: true, path: 'items' },
  language: { operator: 'match', field: 'language_packed', repeatable: true },
  materialType: { operator: 'match', field: 'materialType_packed', repeatable: true },
  mediaType: { operator: 'match', field: 'mediaType_packed', repeatable: true },
  carrierType: { operator: 'match', field: 'carrierType_packed', repeatable: true },
  publisher: { operator: 'match', field: 'publisherLiteral.raw', repeatable: true },
  contributorLiteral: { operator: 'match', field: 'contributorLiteral.raw', repeatable: true },
  creatorLiteral: { operator: 'match', field: 'creatorLiteral.raw', repeatable: true },
  issuance: { operator: 'match', field: 'issuance_packed', repeatable: true },
  createdYear: { operator: 'match', field: 'createdYear', repeatable: true },
  dateAfter: {
    operator: 'custom',
    type: 'int'
  },
  dateBefore: {
    operator: 'custom',
    type: 'int'
  }
}

const QUERY_STRING_QUERY_FIELDS = {
  date: { field: 'dateStartYear' },
  subject: { field: 'subjectLiteral' },
  creator: { field: 'creatorLiteral' },
  publisher: { field: 'publisherLiteral' },
  title: { field: 'title' }
}

// The following fields can be excluded from ES responses because we don't pass them to client:
const EXCLUDE_FIELDS = ['uris', '*_packed', '*_sort', 'items.*_packed', 'contentsTitle']

// The following maps search scopes can occur as parameters in the advanced search
const ADVANCED_SEARCH_PARAMS = ['title', 'subject', 'contributor']

const IDENTIFIER_NUMBER_PARAMS = ['isbn', 'issn', 'lccn', 'oclc']

// Configure controller-wide parameter parsing:
var parseSearchParams = function (params) {
  return parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [0, 100] },
    field: { type: 'string', range: Object.keys(AGGREGATIONS_SPEC) },
    sort: { type: 'string', range: Object.keys(SORT_FIELDS) },
    sort_direction: { type: 'string', range: ['asc', 'desc'] },
    search_scope: { type: 'string', range: Object.keys(SEARCH_SCOPES), default: 'all' },
    filters: { type: 'hash', fields: FILTER_CONFIG },
    items_size: { type: 'int', default: 100, range: [0, 200] },
    items_from: { type: 'int', default: 0 },
    contributor: { type: 'string' },
    title: { type: 'string' },
    subject: { type: 'string' },
    isbn: { type: 'string' },
    issn: { type: 'string' },
    lccn: { type: 'string' },
    oclc: { type: 'string' },
    merge_checkin_card_items: { type: 'boolean', default: true },
    include_item_aggregations: { type: 'boolean', default: true }
  })
}

// These are the handlers made available to the router:
module.exports = function (app, _private = null) {
  app.resources = {}

  // Get a single resource:
  app.resources.findByUri = function (params, opts = {}, request) {
    // Parse all params we support:
    params = parseParams(params, {
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
          },
          _source: {
            excludes: EXCLUDE_FIELDS.concat(['items'])
          }
        }

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

        if (params.include_item_aggregations) {
          body.aggregations = ITEM_FILTER_AGGREGATIONS
        }

        app.logger.debug('Resources#findByUri', body)
        return app.esClient.search(body)
          .then((resp) => {
            // Mindfully throw errors for known issues:
            if (!resp || !resp.hits) {
              throw new Error('Error connecting to index')
            } else if (resp && resp.hits && resp.hits.total === 0) {
              throw new errors.NotFoundError(`Record not found: ${params.uri}`)
            } else {
              let massagedResponse = new ResponseMassager(resp)
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
  app.resources.annotatedMarc = function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:
    const { id, nyplSource } = NyplSourceMapper.instance().splitIdentifier(params.uri)

    app.logger.debug('Resources#annotatedMarc', { id, nyplSource })
    return makeNyplDataApiClient().get(`bibs/${nyplSource}/${id}`)
      .then((resp) => {
        // need to check that the query actually found an entry
        if (!resp.data) {
          throw new errors.NotFoundError('Record not found')
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
    var body = {
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
        if (!resp || !resp.hits || resp.hits.total === 0) return Promise.reject('No matching items')
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
    var barcodes = Array.isArray(params.barcodes) ? params.barcodes : [params.barcodes]

    var identifierValues = barcodes.map((barcode) => `urn:barcode:${barcode}`)

    // Create promise to resolve deliveryLocationTypes by patron type:
    let lookupPatronType = AvailableDeliveryLocationTypes.getByPatronId(params.patronId)
      .catch((e) => {
        throw new errors.InvalidParameterError('Invalid patronId')
      })

    // Create promise to resolve items:
    let fetchItems = itemsByFilter(
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
        let items = resp[0]
        let deliveryLocationTypes = resp[1]

        // Use HTC API and nypl-core mappings to ammend ES response with deliveryLocations:
        return DeliveryLocationsResolver.resolveDeliveryLocations(items, deliveryLocationTypes)
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
          {
            nested: {
              path: 'items',
              query: {
                exists: { field: 'items.electronicLocator' }
              },
              inner_hits: { name: 'electronicResources' }
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
              must_not: [ { exists: { field: 'items.electronicLocator' } } ]
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
    let rangeQuery = {
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
            'params.unavailableRecapBarcodes.contains(doc[\'items.idBarcode\'].values[0])',
          lang: 'painless',
          params: { unavailableRecapBarcodes: unavailableRecapBarcodes }
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

    // Always remove electronicResources from items because (if they exist
    // there, the "electronicResources" inner_hits query will extract them)
    excludeClauses.push({ exists: { field: 'items.electronicLocator' } })

    if (!options.merge_checkin_card_items) excludeClauses.push({ term: { 'items.type': 'nypl:CheckinCardItem' } })

    return excludeClauses.length ? { must_not: excludeClauses } : { must: { match_all: {} } }
  }

  // Conduct a search across resources:
  app.resources.search = function (params, opts, request) {
    params = parseSearchParams(params)

    let body = buildElasticBody(params)

    // Strip unnecessary _source fields
    body._source = {
      excludes: EXCLUDE_FIELDS.concat(['items'])
    }

    body = addInnerHits(body, { merge_checkin_card_items: params['merge_checkin_card_items'] })

    app.logger.debug('Resources#search', RESOURCES_INDEX, body)

    return app.esClient.search(body)
    .then((resp) => {
      let massagedResponse = new ResponseMassager(resp)
      return massagedResponse.massagedResponse(request)
        .catch((e) => {
          // If error hitting HTC, just return response un-modified:
          return resp
        })
        .then((updatedResponse) => ResourceResultsSerializer.serialize(updatedResponse, opts))
    })
  }

  // Get all aggregations:
  app.resources.aggregations = function (params, opts) {
    params = parseSearchParams(params)
    var body = buildElasticBody(params)

    // Add an `aggregations` entry to the ES body describing the aggretations
    // we want. Set the `size` property to per_page (default 50) for each.
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-size
    body.aggregations = Object.keys(AGGREGATIONS_SPEC).reduce((aggs, prop) => {
      aggs[prop] = AGGREGATIONS_SPEC[prop]
      // Only set size for terms aggs for now:
      if (aggs[prop].terms) aggs[prop].terms.size = params.per_page
      return aggs
    }, {})

    body.size = 0

    let serializationOpts = Object.assign(opts, {
      packed_fields: ['location', 'materialType', 'locationBuilding', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner']
    })

    app.logger.debug('Resources#aggregations:', body)
    return app.esClient.search(body)
    .then((resp) => {
      // Transform response slightly before serialization:
      resp.aggregations = Object.keys(resp.aggregations)
        .reduce((aggs, field) => {
          let aggregation = resp.aggregations[field]

          // If it's nested, it will be in our special '_nested' prop:
          if (aggregation._nested) aggregation = aggregation._nested

          aggs[field] = aggregation
          return aggs
        }, {})

      return AggregationsSerializer.serialize(resp, serializationOpts)
    })
  }

  // Get a single aggregation:
  app.resources.aggregation = (params, opts) => {
    params = parseSearchParams(params)

    if (Object.keys(AGGREGATIONS_SPEC).indexOf(params.field) < 0) return Promise.reject('Invalid aggregation field')

    var body = buildElasticBody(params)

    // We're fetching aggs, so specify 0 resource results:
    body.size = 0

    body.aggregations = {}
    body.aggregations[params.field] = AGGREGATIONS_SPEC[params.field]

    // If it's a terms agg, we can apply per_page:
    if (body.aggregations[params.field].terms) {
      body.aggregations[params.field].terms.size = params.per_page
    }

    var serializationOpts = Object.assign(opts, {
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

  // This is TK
  app.resources.byTerm = function (id, cb) {
    app.db.returnCollectionTripleStore('resources', function (err, resources) {
      if (err) throw err
      resources.find({ allTerms: parseInt(id) }).limit(100).toArray(function (err, results) {
        if (err) throw err
        if (results.length === 0) {
          cb(false)
        } else {
          cb(results)
        }
      })
    })
  }

  // For unit testing, export private methods if second arg given:
  if (_private && typeof _private === 'object') {
    _private.buildElasticBody = buildElasticBody
    _private.buildElasticQuery = buildElasticQuery
    _private.parseSearchParams = parseSearchParams
    _private.escapeQuery = escapeQuery
    _private.buildElasticQueryForKeywords = buildElasticQueryForKeywords
    _private.esRangeValue = esRangeValue
    _private.itemsFilterContext = itemsFilterContext
    _private.itemsQueryContext = itemsQueryContext
    _private.addInnerHits = addInnerHits
  }
}

const queryHasParams = function (params) {
  return params.q || ADVANCED_SEARCH_PARAMS.some((param) => params[param])
}

/**
 *  Given GET params, returns a plainobject with `from`, `size`, `query`,
 *  `sort`, and any other params necessary to perform the ES query based
 *  on the GET params.
 *
 *  @return {object} An object that can be posted directly to ES
 */
const buildElasticBody = function (params) {
  if (IDENTIFIER_NUMBER_PARAMS.some((param) => params[param])) {
    return queryForIdentifierNumber(params)
  }

  var body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  if (params.filters || queryHasParams(params)) {
    var query = buildElasticQuery(params)

    // contains query: give it a score
    if (queryHasParams(params)) {
      body.query = {
        function_score: {
          query: query
        }
      }
      body.min_score = 0.65
      body.sort = ['_score']

      // just filters: no score
    } else {
      body.query = query
    }
  }

  // If HIDE_NYPL_SOURCE env config set, filter records w/matching nyplSource
  if (process.env.HIDE_NYPL_SOURCE) {
    const hideByNyplSourceClause = {
      bool: {
        must_not: {
          terms: {
            nyplSource: process.env.HIDE_NYPL_SOURCE.split(',')
          }
        }
      }
    }

    // If body already has a function_score query, add this filter to it;
    // Otherwise, add it to the top level
    const placeToPutQuery = body.query && body.query.function_score ? body.query.function_score : body
    placeToPutQuery.query = placeToPutQuery.query || {}
    placeToPutQuery.query.bool = placeToPutQuery.query.bool || {}
    placeToPutQuery.query.bool.filter = placeToPutQuery.query.bool.filter || []
    placeToPutQuery.query.bool.filter.push(hideByNyplSourceClause)
  }

  // Default is relevance. Handle case where it's set to something else:
  if (params.sort && params.sort !== 'relevance') {
    var direction = params.sort_direction || SORT_FIELDS[params.sort].initialDirection
    var field = SORT_FIELDS[params.sort].field || params.sort
    body.sort = [{ [field]: direction }]
  }

  // If no explicit sort given, set a default so that pagination is (mostly) consistent
  if (!body.sort) body.sort = ['uri']

  return body
}

/**
 * Given params which include an identifier number, returns query for that identifier
 *
 * Returns a bool query with a single clause to ease attaching other clauses to it later
 */

const queryForIdentifierNumber = function (params) {
  if (params.lccn) {
    return {
      query: {
        regexp: {
          idLccn: {
            value: `[^\\d]*${regexEscape(params.lccn)}[^\\d]*`
          }
        }
      }
    }
  } else if (params.issn) {
    return { query: { bool: { must: { term: { idIssn: params.issn } } } } }
  } else if (params.isbn) {
    return {
      query: {
        bool: {
          should: [
            { term: { idIsbn: params.isbn } },
            { term: { idIsbn_clean: params.isbn } }
          ],
          minimum_should_match: 1
        }
      }
    }
  } else if (params.oclc) {
    // body.query.function_score.query.bool
    return { query: { bool: { must: { term: { idOclc: params.oclc } } } } }
  }
}

/**
 * Given a string, escapes all regex control characters
 */

const regexEscape = function (str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, (match) => { return '\\' + match })
}

/**
 * Given a string, returns the string with all unsupported ES control
 * characters escaped. In particular, escapes:
 *
 *  - Specials: '&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}', '/', '\', '+', '-', '=', '(', ')'
 *  - Colons, except when used in a supported query string query field (e.g. title:Romeo)
 */
const escapeQuery = function (str) {
  // Escape characters/phrases that should always be escaped:
  const specials = ['&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}', '(', ')', '\\', '+', '-', '=']
  const specialsEscaped = specials.map((phrase) => backslashes(phrase))
  str = str.replace(new RegExp(specialsEscaped.join('|'), 'gi'), (phrase) => backslashes(phrase))

  // Escape forward slashes as a special case
  str = str.replace(/\//g, '\\/')

  // Escape query-string-query fields that we don't recognize:
  //  e.g. We allow "title:..", but we escape the colon in "fladeedle:..."
  const allowedFields = Object.keys(QUERY_STRING_QUERY_FIELDS)
  const unrecognizedFieldQueryRegex = new RegExp(`(^|\\s)(?!(${allowedFields.join('|')}))[^\\s]+(:)`, 'g')
  str = str.replace(unrecognizedFieldQueryRegex, (match) => {
    return match.replace(/:/, '\\:')
  })

  // Escape floating colons
  str = str.replace(/(^|\s):/g, '$1\\:')

  return str
}

/**
 * For a set of parsed request params, returns a plainobject representing the
 * keyword aspects of the ES query.
 *
 * @param {object} params - A hash of request params including `search_scope`, `q`
 *
 * @return {object} An object representing an ES query
 *    (i.e. you could build a POSTable query via { query: buildElasticQueryForKeywords(...) }
 *
 * Because some search_scopes require multiple clauses, the return may include
 * a bool like:
 *   { bool: { should: [ { term: ... }, { nested: ... } ] } }
 * Otherwise it may just resemble:
 *   { query_string: ... }
 */
const buildElasticQueryForKeywords = function (params) {
  // Fill these with our top-level clauses:
  const should = []

  // We have an array of fields to match.
  // Seperate the root-level fields from nested fields by building an object like this:
  //   {
  //     _root: [ 'fieldName1', 'fieldName2' ],
  //     nestedName1: { 'nestedName1.nestedProperty1', 'nestedName1.nestedProperty2' }
  //   }
  const fieldMap = SEARCH_SCOPES[params.search_scope].fields.reduce((map, fieldName) => {
    // Handle query conditional field
    if (typeof fieldName === 'object' && fieldName.on) {
      if (!fieldName.on(params.q)) return map
      fieldName = fieldName.field
    }

    // Most fields will be matched at root level:
    let nestedName = '_root'
    // Any field starting with the following is a nested field:
    if (['items'].indexOf(fieldName.split('.').shift()) >= 0) {
      nestedName = fieldName.split('.').shift()
    }
    if (!map[nestedName]) map[nestedName] = []
    map[nestedName].push(fieldName)
    return map
  }, { _root: [] })

  should.push({
    'query_string': {
      'fields': fieldMap._root,
      'query': escapeQuery(params.q),
      'default_operator': 'AND'
    }
  })

  if (params.search_scope === 'standard_number') {
    should.push({
      'query_string': {
        'fields': fieldMap._root,
        'query': `"${escapeQuery(params.q)}"`,
        'default_operator': 'AND'
      }
    })
  }

  // Add nested queries (if any) to things that *should* match:
  Object.keys(fieldMap)
    .filter((nestedName) => nestedName !== '_root')
    .forEach((nestedName) => {
      should.push({
        nested: {
          path: nestedName,
          query: {
            query_string: {
              fields: fieldMap[nestedName],
              query: escapeQuery(params.q),
              default_operator: 'AND'
            }
          }
        }
      })
    })

  // If multiple clauses were necessary (i.e. one of them was nested)
  // wrap them in a should so that they're evaluated as a boolean OR
  if (should.length > 1) {
    return { bool: { should } }
  } else return should[0]
}

const filterClausesForDateParams = function (filters) {
  const hasDateAfter = typeof filters.dateAfter === 'number'
  const hasDateBefore = typeof filters.dateBefore === 'number'

  if (!hasDateAfter && !hasDateBefore) {
    return []
  }

  // Collect the clauses we'll need to add:
  const clauses = []

  if (hasDateBefore) {
    /**
     * When dateBefore used, we want to match on:
     *     dateStartYear <= filters.dateBefore ||
     *     dateEndYear <= filters.dateBefore
     *
     * Note that when dateBefore is used alone, we only strictly need to match on:
     *   dateStartYear <= filters.dateBefore
    */
    clauses.push({
      bool: {
        should: [
          { range: { dateStartYear: { lte: filters.dateBefore } } },
          { range: { dateEndYear: { lte: filters.dateBefore } } }
        ]
      }
    })
  }

  if (hasDateAfter) {
    /**
     * When dateAfter used, we want to match on:
     *     dateStartYear >= filters.dateAfter ||
     *     dateEndYear >= filters.dateAfter
    */
    clauses.push({
      bool: {
        should: [
          { range: { dateStartYear: { gte: filters.dateAfter } } },
          { range: { dateEndYear: { gte: filters.dateAfter } } }
        ]
      }
    })
  }

  return [{
    // If multiple clauses built, return them as a MUST (boolean AND)
    // If only one clause built, just return that one
    clause: clauses.length > 1 ? { bool: { must: clauses } } : clauses[0]
  }]
}

/**
 * For a set of parsed request params, returns a plainobject representing the
 * filter aspects of the ES query.
 *
 * @param {object} params - A hash of request params including `filters`
 *
 * @return {object} ES query object suitable to be POST'd to ES endpoint
 */
const buildElasticQueryForFilters = function (params) {
  var filterClausesWithPaths = []

  if (params.filters) {
    // Add clauses for dateAfter / dateBefore filters, if used:
    filterClausesWithPaths = filterClausesWithPaths.concat(
      filterClausesForDateParams(params.filters)
    )

    // Collect those filters that use a simple term match
    const simpleMatchFilters = Object.keys(params.filters)
      .filter((k) => FILTER_CONFIG[k].operator === 'match')

    filterClausesWithPaths = filterClausesWithPaths.concat(simpleMatchFilters.map((prop) => {
      var config = FILTER_CONFIG[prop]

      var value = params.filters[prop]

      // This builds a filter cause from the value:
      var buildClause = (value) => {
        // If filtering on a packed field and value isn't a packed value:
        if (config.operator === 'match' && value.indexOf('||') < 0 && config.field.match(/_packed$/)) {
          // Figure out the base property (e.g. 'owner')
          var baseField = config.field.replace(/_packed$/, '')
          // Allow supplied val to match against either id or value:
          return {
            bool: {
              should: [
                { term: { [`${baseField}.id`]: value } },
                { term: { [`${baseField}.label`]: value } }
              ]
            }
          }
        } else if (config.operator === 'match') return { term: { [config.field]: value } }
      }

      // If multiple values given, let's join them with 'should', causing it to operate as a boolean OR
      // Note: using 'must' here makes it a boolean AND
      var booleanOperator = 'should'
      // If only one value given, don't wrap it in a useless bool:
      if (Array.isArray(value) && value.length === 1) value = value.shift()
      var clause = (Array.isArray(value)) ? { bool: { [booleanOperator]: value.map(buildClause) } } : buildClause(value)

      return { path: config.path, clause }
    }))
  }

  // Gather root (not nested) filters:
  let filterClauses = filterClausesWithPaths
    .filter((clauseWithPath) => !clauseWithPath.path)
    .map((clauseWithPath) => clauseWithPath.clause)

  // Add nested filters:
  filterClauses = filterClauses.concat(
    filterClausesWithPaths
      // Nested filters have a `path` property:
      .filter((clauseWithPath) => clauseWithPath.path)
      .map((clauseWithPath) => {
        return {
          nested: {
            path: clauseWithPath.path,
            query: {
              constant_score: {
                filter: clauseWithPath.clause
              }
            }
          }
        }
      })
  )

  const query = {}

  if (filterClauses.length > 0) {
    query.bool = { filter: filterClauses }
  }

  return query
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
  // Build ES query:
  var query = {}

    // clean up params
    ;['q'].forEach(function (param) {
      if (params[param]) {
        params[param] = params[param].replace(/date:/g, 'dateStartYear:')
        params[param] = params[param].replace(/location:/g, 'locations:')
        params[param] = params[param].replace(/subject:/g, 'subjectLiteral:')
      }
    })

  if (params.q) {
    // Merge keyword-specific ES query into the query we're building:
    query.bool = { must: [buildElasticQueryForKeywords(params)] }
  }

  const advancedParamQueries = ADVANCED_SEARCH_PARAMS
    .filter((param) => params[param])
    .map((param) =>
      buildElasticQueryForKeywords({ q: params[param], search_scope: param })
    )

  if (advancedParamQueries.length) {
    query.bool = query.bool || {}
    query.bool.must = (query.bool.must || []).concat(advancedParamQueries)
  }

  if (params.filters) {
    // Merge filter-specific ES query into the query we're building:
    const filterQuery = buildElasticQueryForFilters(params)
    if (filterQuery.bool) {
      if (!query.bool) query.bool = {}
      query.bool.filter = filterQuery.bool.filter
    }
    if (filterQuery.nested) {
      query.nested = filterQuery.nested
    }
  }

  return query
}
