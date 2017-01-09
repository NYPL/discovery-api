var ResourceResultsSerializer = require('./jsonld_serializers.js').ResourceResultsSerializer
var ResourceSerializer = require('./jsonld_serializers.js').ResourceSerializer
var AggregationsSerializer = require('./jsonld_serializers.js').AggregationsSerializer
var AggregationSerializer = require('./jsonld_serializers.js').AggregationSerializer

var util = require('../lib/util')
var config = require('config')

const log = require('loglevel')

const RESOURCES_INDEX = config.get('elasticsearch').indexes.resources

// Configures aggregations:
const AGGREGATIONS_SPEC = {
  owner: { terms: { field: 'owner_packed' } },
  subject: { terms: { field: 'subjectLiteral' } },
  location: { terms: { field: 'locationBuilding_packed' } },
  language: { terms: { field: 'language_packed' } },
  materialType: { terms: { field: 'materialType_packed' } },
  mediaType: { terms: { field: 'mediaType_packed' } },
  // carrierType: { terms: { field: 'carrierType_packed' } },
  publisher: { terms: { field: 'publisher' } },
  // contributor: { terms: { field: 'contributor' } },
  issuance: { terms: { field: 'issuance_packed' } },
  date: {
    histogram: {
      field: 'dateStartYear',
      interval: 10,
      min_doc_count: 1
    }
  }
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
  contributor: {
    initialDirection: 'desc',
    field: 'contributor_sort'
  }
}

// Configure controller-wide parameter parsing:
var parseSearchParams = function (params) {
  return util.parseParams(params, {
    q: { type: 'string' },
    page: { type: 'int', default: 1 },
    per_page: { type: 'int', default: 50, range: [1, 100] },
    field: { type: 'string', range: Object.keys(AGGREGATIONS_SPEC) },
    sort: { type: 'string', range: Object.keys(SORT_FIELDS) },
    sort_direction: { type: 'string', range: ['asc', 'desc'] }
  })
}

// These are the handlers made available to the router:
module.exports = function (app) {
  app.resources = {}

  // Get a single resource:
  app.resources.findByUri = function (params, cb) {
    var body = {
      size: 1,
      query: {
        term: {
          uris: params.uri
        }
      }
    }

    log.debug('Resources#search', body)
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => ResourceSerializer.serialize(resp.hits.hits[0]._source, { root: true }))
  }

  // Conduct a search across resources:
  app.resources.search = function (params) {
    params = parseSearchParams(params)
    var body = buildElasticBody(params)

    log.error('Resources#search', RESOURCES_INDEX, JSON.stringify(body, null, 2))
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => ResourceResultsSerializer.serialize(resp))
  }

  // Get all aggregations:
  app.resources.aggregations = function (params) {
    params = parseSearchParams(params)
    var body = buildElasticBody(params)

    body.aggregations = AGGREGATIONS_SPEC
    body.size = 0

    var serializationOpts = {
      packed_fields: ['subject', 'contributor', 'collection', 'location', 'materialType', 'locationBuilding', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner']
    }

    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => AggregationsSerializer.serialize(resp, serializationOpts))
  }

  // Get a single aggregation:
  app.resources.aggregation = (params) => {
    params = parseSearchParams(params)

    if (Object.keys(AGGREGATIONS_SPEC).indexOf(params.field) < 0) return Promise.reject('Invalid aggregation field')

    var body = buildElasticBody(params)

    body.size = 0
    body.aggregations = {}
    body.aggregations[params.field] = AGGREGATIONS_SPEC[params.field]

    var serializationOpts = {
      packed_fields: ['subject', 'contributor', 'collection', 'location', 'materialType', 'locationBuilding', 'language', 'carrierType', 'mediaType', 'issuance', 'status', 'owner']
    }

    log.debug('Resources#aggregation:', JSON.stringify(body, null, 2))
    return app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      resp = resp.aggregations[params.field]
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

  /*
  app.resources.findByOwi = function (params, cb) {
    searchResourcesByFilters({ filters: { identifier: 'urn:owi:' + params.value } }, cb)
  }

  app.resources.randomResources = function (params, cb) {
    params = util.parseParams(params, { per_page: { type: 'int', default: 3, range: [1, 20] } })

    app.esClient.search({
      index: RESOURCES_INDEX,
      body: {
        'size': params.per_page,
        'query': {
          'function_score': {
            'functions': [
              {
                'random_score': {
                  'seed': Math.floor(Math.random() * (4000000 - 1 + 1)) + 1
                }
              }
            ],
            'query': {
            },
            'score_mode': 'sum'
          }
        }
      }
    }).then((resp) => cb(ResourceResultsSerializer.serialize(resp)), function (err) {
      if (err) throw err
      // console.trace(err.message)
      cb(false)
    })
  }

  app.resources.findByOldId = function (id, cb) {
    app.db.returnCollectionTripleStore('resources', function (err, resources) {
      if (err) throw err
      var searchStrategies = []

      if (id.length === 36) {
        // mms
        searchStrategies.push({'dcterms:identifier': {'$elemMatch': {'objectUri': 'urn:uuid:' + id}}})
      } else if (id.search(/b[0-9]{8,}/) > -1) {
        // catalog
        id = id.replace(/b/gi, '')
        id = id.substr(0, 8)
        searchStrategies.push({'dcterms:identifier': {'$elemMatch': {'objectUri': 'urn:bnum:b' + id}}})
        searchStrategies.push({'dcterms:identifier': {'$elemMatch': {'objectUri': 'urn:bnum:' + id}}})
      } else {
        // all other numeric identifiers
        searchStrategies.push({'dcterms:identifier': {'$elemMatch': {'objectUri': 'urn:msscoll:' + id}}})
        searchStrategies.push({'dcterms:identifier': {'$elemMatch': {'objectUri': 'urn:barcode:' + id}}})
      }

      var allResults = []

      async.each(searchStrategies, function (searchStrategie, callback) {
        resources.find(searchStrategie).toArray(function (err, results) {
          if (err) throw err
          allResults.push(results[0])
          callback()
        })
      }, function (err) {
        if (err) throw err
        cb({ allResults: allResults })
      })
    })
  }

  var getResourceById = function (params) {
    var id = params.id ? params.id : params.value
    return app.esClient.get({
      index: RESOURCES_INDEX,
      type: 'resource',
      id: id
    }).then((resp) => {
      return Promise.resolve(ResourceSerializer.serialize(resp._source, {root: true, expandContext: params.expandContext === 'true'}))
    }).catch((e) => {
      return Promise.reject('Problem serializing record: ' + e.message)
    })
  }

  var searchResourcesByFilters = function (params, cb) {
    var query = buildElasticQuery(params)

    var body = {
      query: {
        function_score: {
          query: query,
          field_value_factor: {
            field: 'holdings',
            missing: 1
          }
        }
      },
      min_score: 0.65,
      from: (params.per_page * (params.page - 1)),
      size: params.per_page
    }
    // console.log('QUERY body: ', JSON.stringify(body))

    app.esClient.search({
      index: RESOURCES_INDEX,
      body: body
    }).then((resp) => {
      cb(ResourceResultsSerializer.serialize(resp))
    }, function (err) {
      console.trace(err.message)
      cb(false)
    })
  }
  */
}

var buildElasticBody = function (params) {
  var body = {
    from: (params.per_page * (params.page - 1)),
    size: params.per_page
  }

  if (params.q) {
    // ES Query String Query ( https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax )
    if (params.q.match(/\w{3,}:[\w"\[<>]/)) {
      params.q = params.q.replace(/date:/g, 'dateStartYear:')
      params.q = params.q.replace(/location:/g, 'locations:')
      params.q = params.q.replace(/subject:/g, 'subjectLiteral:')
      body.query = {
        query_string: {
          default_field: 'title',
          query: params.q,
          default_operator: 'AND'
        }
      }
    } else {
      var query = buildElasticQuery(params)
      body.query = {
        function_score: {
          query: query
        }
      }
      body.min_score = 0.65
    }

    body.sort = ['_score']
    if (params.sort) {
      var direction = params.sort_direction || SORT_FIELDS[params.sort].initialDirection
      var field = SORT_FIELDS[params.sort].field || params.sort
      body.sort = [{ [field]: direction }]
    }
  }

  return body
}

var buildElasticQuery = function (params) {
  // Fill these with our top-level clauses:
  var shoulds = []
  var musts = []

  // If keyword supplied, match against selected, boosted fields:
  if (params.q) {
    shoulds.push({
      'multi_match': {
        'query': params.q,
        'fields': ['title^10', 'description^5', 'termLabels^5', 'contributorLabels^5', 'note']
      }
    })
  }

  // Specially handle date to match against range:
  if (params.filters && params.filters.date) {
    // If range of dates (i.e. array of two dates), ensure ranges overlap
    if (params.filters.date.length === 2) {
      musts.push({'range': {dateStartYear: {lte: params.filters.date[1]}}})
      musts.push({'range': {dateEndYear: {gte: params.filters.date[0]}}})

    // Otherwise, match on single date (ensure single date falls within object date range)
    } else if (params.filters.date) {
      var date = params.filters.date
      if ((typeof date) === 'object') date = date[0]

      musts.push({'range': {dateStartYear: { 'lte': date }}})
      musts.push({'range': {dateEndYear: { 'gte': date }}})
    }
  }

  // Util to build term matching clause from value:
  var buildMatch = function (field, value) {
    switch (field) {
      case 'collection':
        field = 'rootParentUri'
        break
      case 'parent':
        field = 'parentUri'
        break
    }

    return { term: { [field]: value } }
  }

  // These can be matched singularly or in combination:
  if (params.filters) {
    ;['owner', 'subject', 'type', 'contributor', 'identifier', 'collection', 'parent', 'language'].forEach(function (param) {
      if (params.filters[param]) {
        // If array of values, "should" match 1 or more:
        if (typeof (params.filters[param]) === 'object') {
          musts.push({bool: {should: params.filters[param].map((v) => buildMatch(param, v))}})

        // Otherwise match single value:
        } else {
          musts.push(buildMatch(param, params.filters[param]))
        }
      }
    })
  }

  // Build ES query:
  var query = {}
  if (shoulds.length + musts.length > 0) {
    query.bool = {}
  }

  if (shoulds.length > 0) {
    query.bool.should = shoulds
  }
  if (musts.length > 0) {
    query.bool.must = musts
  }

  return query
}
