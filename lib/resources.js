const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')

var ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
var ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
var AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
var AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
var ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const LocationLabelUpdater = require('./location_label_updater')
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')
const { makeNyplDataApiClient } = require('./data-api-client')

const ResponseMassager = require('./response_massager.js')
var DeliveryLocationsResolver = require('./delivery-locations-resolver')
var AvailableDeliveryLocationTypes = require('./available_delivery_location_types')

var util = require('../lib/util')

const errors = require('./errors')

const RESOURCES_INDEX = process.env.RESOURCES_INDEX

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
    fields:
    [
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
    fields:
    [
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
    fields: ['shelfMark', 'identifierV2.value', 'uri', 'identifier', 'items.shelfMark', { field: 'items.idBarcode', on: (q) => /\d{6,}/.test(q) }]
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
  publisher: { operator: 'match', field: 'publisher', repeatable: true },
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
  return util.parseParams(params, {
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
    oclc: { type: 'string' }
  })
}

// These are the handlers made available to the router:
module.exports = function (app, _private = null) {
  app.resources = {}

  // Get a single resource:
  app.resources.findByUri = function (params, opts, request) {
    let body = {
      size: 1,
      query: {
        bool: {
          must: [
            {
              term: {
                uris: params.uri
              }
            }
          ]
        }
      },
      _source: {
        excludes: EXCLUDE_FIELDS.concat('items')
      }
    }

    body = params.itemUri ? addItemQuery(body, params.itemUri) : addInnerHits(body, { size: params.items_size, from: params.items_from })

    app.logger.debug('Resources#findByUri', body)
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      if (resp && resp.hits && resp.hits.hits && resp.hits.hits[0] &&
        resp.hits.hits[0]._source && resp.hits.hits[0].inner_hits &&
        resp.hits.hits[0].inner_hits.items && resp.hits.hits[0].inner_hits.items.hits &&
        resp.hits.hits[0].inner_hits.items.hits.hits
      ) {
        resp.hits.hits[0]._source.items = resp.hits.hits[0].inner_hits.items.hits.hits.map((item) => item._source)
      }
      // Mindfully throw errors for known issues:
      if (!resp || !resp.hits) {
        throw new Error('Error connecting to index')
      } else if (resp && resp.hits && resp.hits.total === 0) {
        throw new errors.NotFoundError(`Record not found: ${params.uri}`)
      } else {
        let massagedResponse = new ResponseMassager(resp)
        return massagedResponse.massagedResponse(request, { queryRecapCustomerCode: !!params.itemUri })
          .catch((e) => {
            // If error hitting HTC, just return response un-modified:
            return resp
          })
      }
    }).then((resp) => ResourceSerializer.serialize(resp.hits.hits[0]._source, Object.assign(opts, { root: true })))
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

    app.logger.debug('Resources#search', body)

    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body

    // In lieu of indexing items as `nested` so that we can do proper nested queries, let's flatten down to items here:
    }).then((resp) => {
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
    params = util.parseParams(params, {
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
      { _source: ['uri', 'type', 'items.uri', 'items.type', 'items.identifier', 'items.holdingLocation', 'items.status', 'items.catalogItemType', 'items.accessMessage'] }

    // Filter out any items (multi item bib) that don't match one of the queriered barcodes:
    ).then((items) => {
      return items.filter((item) => {
        return item.identifier.filter((i) => identifierValues.indexOf(i) >= 0).length > 0
      })
    })

    // Run both item fetch and patron fetch in parallel:
    return Promise.all([ fetchItems, lookupPatronType ])
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
      from: 0
    }, _options)

    // The place to add the filter depends on the query built to this point:
    const placeToAddFilter = (body.query.bool || body.query.function_score.query.bool)
    // Initialize filter object if it doesn't already exist:
    placeToAddFilter.filter = placeToAddFilter.filter || []
    // If filter object already exists, convert it to array:
    if (!Array.isArray(placeToAddFilter.filter)) placeToAddFilter.filter = [placeToAddFilter.filter]

    placeToAddFilter.filter.push({
      bool: {
        // Add a boolean OR matching on either:
        //  - has no items
        //  - has items (match_all), and truncate them to given size
        should: [
          { term: { numItems: 0 } },
          {
            nested: {
              path: 'items',
              query: { match_all: {} },
              inner_hits: {
                sort: [{ 'items.shelfMark_sort': 'asc' }],
                size: options.size,
                from: options.from
              }
            }
          }
        ]
      }
    })
    return body
  }

  const addItemQuery = (body, itemUri) => {
    body.query.bool.must.push({
      nested: {
        path: 'items',
        query: { term: { 'items.uri': itemUri } },
        inner_hits: { name: 'items' }
      }
    })

    return body
  }

  // Conduct a search across resources:
  app.resources.search = function (params, opts, request) {
    params = parseSearchParams(params)

    var body = buildElasticBody(params)

    // Make sure query body has a structure we can attach an inner_hits query to:
    const shouldAddInnerHits = body.query &&
      (
        body.query.bool ||
        (
          body.query.function_score &&
          body.query.function_score.query &&
          body.query.function_score.query.bool
        )
      )
    // Strip unnecessary _source fields
    body._source = {
      excludes: EXCLUDE_FIELDS.concat(shouldAddInnerHits ? ['items'] : [])
    }

    if (shouldAddInnerHits) {
      body = addInnerHits(body)
    }

    app.logger.debug('Resources#search', RESOURCES_INDEX, body)

    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      if (shouldAddInnerHits) {
        resp.hits.hits.forEach((hit) => {
          if (hit.inner_hits) {
            hit._source.items = hit.inner_hits.items.hits.hits.map((itemHit) => itemHit._source)
            delete hit['inner_hits']
          }
        })
      }
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
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
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
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
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
      resources.find({allTerms: parseInt(id)}).limit(100).toArray(function (err, results) {
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
  const specialsEscaped = specials.map((phrase) => util.backslashes(phrase))
  str = str.replace(new RegExp(specialsEscaped.join('|'), 'gi'), (phrase) => util.backslashes(phrase))

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
          return { bool: { should: [
            { term: { [`${baseField}.id`]: value } },
            { term: { [`${baseField}.label`]: value } }
          ] } }
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
  let rootFilterClauses = filterClausesWithPaths
    .filter((clauseWithPath) => !clauseWithPath.path)
    .map((clauseWithPath) => clauseWithPath.clause)

  const query = {}

  // Add nested filters:
  filterClausesWithPaths
    // Nested filters have a `path` property:
    .filter((clauseWithPath) => clauseWithPath.path)
    .forEach((clauseWithPath) => {
      // TODO: Note we seem to lack support for applying multiple nested filters
      query.nested = {
        path: clauseWithPath.path,
        query: {
          constant_score: {
            filter: clauseWithPath.clause
          }
        }
      }
    })

  if (rootFilterClauses.length > 0) {
    query.bool = { filter: rootFilterClauses }
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
    query.bool = { must: [ buildElasticQueryForKeywords(params) ] }
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
