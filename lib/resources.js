var R = require('ramda')

var ResourceResultsSerializer = require('../serializers/resource/es').ResourceResultsSerializer
var ResourceSerializer = require('../serializers/resource/es').ResourceSerializer
var AggregationsSerializer = require('../serializers/aggregations').AggregationsSerializer
var DbResourceSerializer = require('../serializers/resource/triples').DbResourceSerializer

var util = require('../lib/util')

module.exports = function (app) {
  app.resources = {}

  app.resources.findById = function (params) {
    return getResourceById(params)
  }

  app.resources.overviewNtriples = function (params) {
    var id = params.value
    return getResourceByIdFromTripleStore(id).then((resource) => {
      if (!resource) {
        return Promise.reject({message: 'Not found'})
      }
      return util.returnNtTriples(resource, 'resource').join('\n')
    })
  }

  app.resources.overviewJsonld = function (params) {
    return app.resources.overview(params).then((resource) => {
      // return the full context when spefically requesting jsonld format
      resource['@context'] = util.context
      for (var x in resource) {
        if (Array.isArray(resource[x])) if (resource[x].length === 0) delete resource[x]
      }
      return resource
    })
  }

  app.resources.overview = function (params) {
    var id = params.value

    // Get full triplestore record:
    return getResourceByIdFromTripleStore(id).then((resource) => {
      // Get Promise query for child resources:
      var getHasMember = () => {
        var uris = resource['pcdm:hasMember'] ? resource['pcdm:hasMember'].map((x) => util.parseUrn(x.objectUri).id) : []
        uris = uris.slice(0, 99)

        if (uris.length === 0) return Promise.resolve([])

        return app.db.returnCollectionTripleStore('resources')
          .then((resources) => resources.find({ uri: {$in: uris} }, {uri: 1, 'dcterms:title': 1, 'rdf:type': 1, 'nypl:dcflag': 1, 'nypl:publicDomain': 1, 'nypl:filename': 1}).toArray())
      }

      // Get Promise query for parent resources:
      var getMemberOf = () => {
        var uris = resource['pcdm:memberOf'] ? resource['pcdm:memberOf'].map((x) => util.parseUrn(x.objectUri).id) : []
        uris = uris.slice(0, 99)

        if (uris.length === 0) return Promise.resolve([])

        return app.db.returnCollectionTripleStore('resources')
          .then((resources) => resources.find({ uri: {$in: uris} }, {uri: 1, 'dcterms:title': 1, 'rdf:type': 1}).toArray())
      }

      // Fetch memberOf and hasMember resource stubs in parallel
      return Promise.all([ getHasMember(), getMemberOf() ]).then((values) => {
        resource = Object.assign(resource, { hasMembers: values[0], memberOf: values[1] })
        return DbResourceSerializer.serialize(resource) // resourceSerializers.triples(resource)
      })
    })
  }

  app.resources.searchByTitle = (params) => searchResourcesByTitle(params, 0, 1)

  app.resources.searchAggregations = function (params) {
    params = parseSearchParams(params)
    return aggregationsByFilters(params)
  }

  app.resources.search = function (params) {
    params = parseSearchParams(params)

    // If it looks dangerous, check it:
    if (params.q && isQueryStringQuery(params.q)) {
      return new Promise((resolve, reject) => {
        app.esClient.indices.validateQuery({ q: params.q }, function (err, res) {
          if (res.valid) resolve(searchResourcesByFilters(params))
          else if (err) reject(err)
          else reject({message: 'Invalid query', query: params.q})
        })
      })
    } else {
      return searchResourcesByFilters(params)
    }
  }

  app.resources.findByOldId = function (params) {
    var id = params.value

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

    searchStrategies = searchStrategies.map((strategy) => {
      return app.db.returnCollectionTripleStore('resources')
        .then((resources) => resources.find(strategy).toArray())
    })
    return Promise.all(searchStrategies).then((values) => {
      var records = R.flatten(values)
      return records.map(DbResourceSerializer.serialize)
    })
  }

  app.resources.byTerm = function (params) {
    // TODO: Don't see what's using this. Can we just do this?
    // return searchResourcesByFilters({ filters: { subject: `terms:${params.value}` } })

    var id = params.value
    return app.db.returnCollectionTripleStore('resources')
      .then((resources) => {
        return new Promise((resolve, reject) => {
          resources.find({allTerms: parseInt(id)}).limit(100).toArray(function (err, results) {
            if (err) reject(err)
            else resolve(results.map(DbResourceSerializer.serialize))
          })
        })
      })
  }

  app.resources.findByOwi = function (params) {
    return searchResourcesByFilters({ filters: { identifier: 'urn:owi:' + params.value } })
  }

  app.resources.randomResources = function (params, cb) {
    params = util.parseParams(params, { per_page: { type: 'int', default: 3, range: [1, 20] } })

    return app.esClient.search({
      index: 'resources',
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
    }).then(ResourceResultsSerializer.serialize)
  }

  // Utils

  var searchResourcesByTitle = function (params, fuzziness, max_expansions) {
    return searchResourcesByFilters(params)
  }

  // Identify a query-string query (i.e. https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax )
  var isQueryStringQuery = (val) => val.match(/(^\w{4,}:| OR | AND )/)

  var buildElasticQuery = function (params) {
    // Fill these with our top-level clauses:
    var shoulds = []
    var musts = []

    if (params.value) {
      // If query-string-query supplied ( https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html ), don't specify fields:
      if (isQueryStringQuery(params.value)) {
        shoulds.push({
          query_string: { query: params.value }
        })
      // If simple keyword supplied, match against selected, boosted fields:
      } else {
        shoulds.push({
          multi_match: {
            query: params.value,
            fields: ['title^10', 'description^5', 'termLabels^5', 'contributorLabels^5', 'note']
          }
        })
      }
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

  var getResourceById = function (params) {
    var id = params.id ? params.id : params.value
    return app.esClient.get({
      index: 'resources',
      type: 'resource',
      id: id
    }).then((resp) => ResourceSerializer.serialize(resp._source, {root: true, expandContext: params.expandContext === 'true'}))
  }

  var esSearchBodyForParams = (params) => {
    var query = buildElasticQuery(params)

    return {
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
  }

  var searchResourcesByFilters = function (params) {
    var body = esSearchBodyForParams(params)

    return new Promise((resolve, reject) => {
      app.esClient.search({
        index: 'resources',
        body
      }).then((resp) => {
        resolve(ResourceResultsSerializer.serialize(resp))
      }, function (err) {
        reject(err.message)
      })
    })
  }

  var aggregationsByFilters = function (params) {
    var body = esSearchBodyForParams(params)

    body.aggregations = {
      type: { terms: { field: 'type' } },
      owner: { terms: { field: 'owner' } },
      subject: { terms: { field: 'subject_packed' } },
      contributor: { terms: { field: 'contributor_packed' } },
      collection: { terms: { field: 'rootParentUri_packed' } },
      language: { terms: { field: 'language' } },
      dates: {
        histogram: {
          field: 'dateStartYear',
          interval: 10,
          min_doc_count: 1
        }
      }
    }
    body.size = 0
    // console.log('fetching aggs: ', query, aggs, cb)

    var serializationOpts = {
      packed_fields: ['subject', 'contributor', 'collection']
    }
    return new Promise((resolve, reject) => {
      app.esClient.search({
        index: 'resources',
        body
      }).then((resp) => resolve(AggregationsSerializer.serialize(resp, serializationOpts)), function (err) {
        // console.trace(err.message)
        reject(err.message)
      })
    })
  }

  var getResourceByIdFromTripleStore = function (id) {
    return app.db.returnCollectionTripleStore('resources')
      .then((resources) => {
        return new Promise((resolve, reject) => {
          resources.find({uri: parseInt(id)}).toArray(function (err, results) {
            if (err) reject(err)
            if (results.length === 0) {
              reject({message: 'not found'})
            } else {
              resolve(results[0])
            }
          })
        })
      })
  }

  var parseSearchParams = function (params) {
    return util.parseParams(params, {
      value: { type: 'string' },
      q: { type: 'elastic-query-string' },
      filters: {
        type: 'string',
        keys: {
          date: { type: 'date' },
          owner: { type: 'string' },
          subject: { type: 'string' },
          contributor: { type: 'string' },
          identifier: { type: 'string' }
        }
      },
      page: { type: 'int', default: 1 },
      per_page: { type: 'int', default: 50, range: [0, 100] }
    })
  }
}
