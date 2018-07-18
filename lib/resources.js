const checkEligibility = require('./check-eligibility').checkEligibility

var ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
var ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
var AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
var AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer
var ItemResultsSerializer = require('./jsonld_serializers.js').ItemResultsSerializer
const LocationLabelUpdater = require('./location_label_updater')
const AnnotatedMarcSerializer = require('./annotated-marc-serializer')

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
    fields: ['title^5', 'title.folded^2', 'description.folded', 'subjectLiteral^2', 'subjectLiteral.folded', 'creatorLiteral^2', 'creatorLiteral.folded', 'contributorLiteral.folded', 'note.label.folded', 'publisherLiteral.folded', 'seriesStatement.folded', 'titleAlt.folded', 'titleDisplay.folded', 'contentsTitle.folded']
  },
  title: {
    fields: ['title^5', 'title.folded^2', 'titleAlt.folded', 'uniformTitle.folded', 'titleDisplay.folded', 'seriesStatement.folded', 'contentsTitle.folded']
  },
  contributor: {
    fields: ['creatorLiteral^4', 'creatorLiteral.folded^2', 'contributorLiteral.folded']
  },
  subject: {
    fields: ['subjectLiteral^2', 'subjectLiteral.folded']
  },
  series: {
    fields: ['seriesStatement.folded']
  },
  callnumber: {
    fields: ['shelfMark']
  }
}

const FILTER_CONFIG = {
  owner: { operator: 'match', field: 'items.owner_packed', repeatable: true, path: 'items' },
  subjectLiteral: { operator: 'match', field: 'subjectLiteral.raw', repeatable: true },
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
    operator: 'gte',
    field: 'dateEndYear',
    type: 'int'
  },
  dateBefore: {
    operator: 'lte',
    field: 'dateStartYear',
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
    filters: { type: 'hash', fields: FILTER_CONFIG }
  })
}

let nyplDataApiClient = null

function makeNyplDataApiClient () {
  if (!nyplDataApiClient) {
    const NyplClient = require('@nypl/nypl-data-api-client')

    nyplDataApiClient = new NyplClient({
      base_url: process.env.NYPL_API_BASE_URL,
      oauth_key: process.env.NYPL_OAUTH_ID,
      oauth_secret: process.env.NYPL_OAUTH_SECRET,
      oauth_url: process.env.NYPL_OAUTH_URL
    })
  }
  return nyplDataApiClient
}

// These are the handlers made available to the router:
module.exports = function (app, _private = null) {
  app.resources = {}

  // Get a single resource:
  app.resources.findByUri = function (params, opts) {
    var body = {
      size: 1,
      query: {
        term: {
          uris: params.uri
        }
      },
      _source: {
        excludes: EXCLUDE_FIELDS
      }
    }

    app.logger.debug('Resources#search', body)
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      // Mindfully throw errors for known issues:
      if (!resp || !resp.hits) throw new Error('Error connecting to index')
      else if (resp && resp.hits && resp.hits.total === 0) throw new errors.NotFoundError('Record not found')
      else {
        let massagedResponse = new ResponseMassager(resp)
        return massagedResponse.massagedResponse()
      }
    }).then((resp) => ResourceSerializer.serialize(resp.hits.hits[0]._source, Object.assign(opts, { root: true })))
  }

  app.resources.checkPatronEligibility = function (params, opts) {
    const id = params.id
    app.logger.debug('checkPatronEligibility', id)
    return new Promise((resolve, reject) => {
      checkEligibility(id).then((result) => resolve(result))
    })
  }

  // Get a single raw annotated-marc resource:
  app.resources.annotatedMarc = function (params, opts) {
    // Convert discovery id to nyplSource and un-prefixed id:
    const prefix = params.uri.match(/^[pc]?b/)[0]
    const id = params.uri.replace(prefix, '')
    let nyplSource = ({
      b: 'sierra-nypl',
      pb: 'recap-pul',
      cb: 'recap-cul'
    })[prefix]

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
      { _source: ['uri', 'type', 'items.uri', 'items.type', 'items.identifier', 'items.holdingLocation', 'item.deliveryLocation', 'items.customerCode'] }

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

  // Conduct a search across resources:
  app.resources.search = function (params, opts) {
    params = parseSearchParams(params)

    var body = buildElasticBody(params)

    // Strip unnecessary _source fields
    body._source = {
      excludes: EXCLUDE_FIELDS
    }

    app.logger.debug('Resources#search', RESOURCES_INDEX, body)

    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      let massagedResponse = new ResponseMassager(resp)
      return massagedResponse.massagedResponse().then((updatedResponse) => {
        return ResourceResultsSerializer.serialize(updatedResponse, opts)
      })
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
  var body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  if (params.q || params.filters) {
    var query = buildElasticQuery(params)

    // contains query: give it a score
    if (params.q) {
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
 * Given a string, returns the string with all unsupported ES control
 * characters escaped. In particular, escapes:
 *
 *  - Specials: '&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}', '/'
 *  - Colons, except when used in a supported query string query field (e.g. title:Romeo)
 */
const escapeQuery = function (str) {
  // Escape characters/phrases that should always be escaped:
  const specials = ['&&', '||', '!', '^', '~', '*', '?', '[', ']', '{', '}']
  const specialsEscaped = specials.map((phrase) => util.backslashes(phrase))
  str = str.replace(new RegExp(specialsEscaped.join('|'), 'gi'), (phrase) => util.backslashes(phrase, 2))

  // Escape query-string-query fields that we don't recognize:
  //  e.g. We allow "title:..", but we escape the colon in "fladeedle:..."
  const allowedFields = Object.keys(QUERY_STRING_QUERY_FIELDS)
  const unrecognizedFieldQueryRegex = new RegExp(`(^|\\s)(?!(${allowedFields.join('|')}))[^\\s]+(:)`, 'g')
  str = str.replace(unrecognizedFieldQueryRegex, (match) => {
    return match.replace(/:/, '\\:')
  })

  // Escape floating colons
  str = str.replace(/(^|\s):/g, '$1\\:')
  str = str.replace(/\//g, '\\/')

  return str
}

/**
 *  Given GET params, returns a plainobject suitable for use in a ES query.
 */
const buildElasticQuery = function (params) {
  // Fill these with our top-level clauses:
  var shoulds = []

  // clean up params
  ;['q'].forEach(function (param) {
    if (params[param]) {
      params[param] = params[param].replace(/date:/g, 'dateStartYear:')
      params[param] = params[param].replace(/location:/g, 'locations:')
      params[param] = params[param].replace(/subject:/g, 'subjectLiteral:')
    }
  })

  if (params.q) {
    shoulds.push({
      'query_string': {
        'fields': SEARCH_SCOPES[params.search_scope].fields,
        // default_field: defaultField,
        'query': escapeQuery(params.q),
        'default_operator': 'AND'
      }
    })
  }

  var filterClausesWithPaths = []
  if (params.filters) {
    filterClausesWithPaths = Object.keys(params.filters).map((prop) => {
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
        else if (['gte', 'gt', 'lt', 'lte'].indexOf(config.operator) >= 0) return { range: { [config.field]: { [config.operator]: value } } }
      }

      // If multiple values given, let's join them with 'should', causing it to operate as a boolean OR
      // Note: using 'must' here makes it a boolean AND
      var booleanOperator = 'should'
      var clause = (Array.isArray(value)) ? { bool: { [booleanOperator]: value.map(buildClause) } } : buildClause(value)

      return { path: config.path, clause }
    })
  }

  // Build ES query:
  var query = {}

  // Gather root (not nested) filters:
  let rootFilterClauses = filterClausesWithPaths
    .filter((clauseWithPath) => !clauseWithPath.path)
    .map((clauseWithPath) => clauseWithPath.clause)

  if (shoulds.length + rootFilterClauses.length > 0) {
    query.bool = {}
  }
  if (shoulds.length > 0) {
    query.bool.should = shoulds
  }

  // Add nested filters:
  filterClausesWithPaths.filter((clauseWithPath) => clauseWithPath.path)
    .forEach((clauseWithPath) => {
      if (!query.nested) query.nested = {}

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
    query.bool.filter = rootFilterClauses
  }

  return query
}
