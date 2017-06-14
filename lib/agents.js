// var md5 = require('md5')
var config = require('config')
var util = require('../lib/util')
// var inspect = require('util').inspect

var serializers = require('./jsonld_serializers.js')

module.exports = function (app) {
  app.agents = {}

  // Get by id:

  app.agents.findById = function (params, cb) {
    getAgentById(params, cb)
  }

  var getAgentById = function (params, cb) {
    var id = params.id ? params.id : params.value
    app.esClient.get({
      index: 'agents',
      type: 'agent',
      id: id
    }).then((resp) => {
      cb(serializers.AgentSerializer.serialize(resp._source, {root: true, expandContext: params.expandContext === 'true'}))
    }, function (err) {
      app.logger.error(err.message)
      cb(false)
    })
  }

  app.agents.imagesOf = function (params, cb) {
    var id = params.value
    app.db.returnCollectionTripleStore('resources', function (err, resources) {
      if (err) throw err
      resources.find({ allAgents: parseInt(id) }, { 'dcterms:type': 1, 'dcterms:identifier': 1, 'uri': 1, 'dcterms:subject': 1, 'pcdm:hasMember': 1 }).toArray(function (err, results) {
        if (err) throw err
        if (results.length === 0) {
          cb(false)
        } else {
          var check = []
          var captureUris = []
          results.forEach(function (r) {
            if (r['dcterms:identifier']) {
              r['dcterms:identifier'].forEach(function (ident) {
                if (ident.objectUri.search('urn:uuid') > -1) {
                  check.push(r)
                }
              })
            }
          })
          check.forEach(function (r) {
            if (r['dcterms:subject']) {
              r['dcterms:subject'].forEach(function (s) {
                if (s.objectUri === 'agents:' + id) {
                  if (r['pcdm:hasMember']) {
                    r['pcdm:hasMember'].forEach(function (c) {
                      captureUris.push(parseInt(c.objectUri.replace('res:', '')))
                    })
                  }
                }
              })
            }
          })

          var imageIds = []

          resources.find({ uri: {$in: captureUris} }).toArray(function (err, resultsCaptures) {
            if (err) throw err
            resultsCaptures.forEach(function (cap) {
              if (cap['rdf:type'][0].objectUri === 'nypl:Capture') {
                var uuid = false

                if (cap['nypl:dcflag']) {
                  if (cap['nypl:dcflag'][0]) {
                    if (cap['nypl:dcflag'][0].objectLiteral) {
                      cap['dcterms:identifier'].forEach(function (id) {
                        if (id.objectUri.search('urn:uuid:') > -1) {
                          uuid = id.objectUri.replace('urn:uuid:', '')
                        }
                      })
                      imageIds.push({
                        imageId: cap['nypl:filename'].map(function (i) { return i.objectLiteral }),
                        uuid: uuid,
                        uri: cap.uri

                      })
                    }
                  }
                }
              }
            })

            cb(convertAgentImagesToJsonLd(imageIds))
          })
        }
      })
    })
  }

  app.agents.resources = function (params, cb) {
    var id = params.value
    app.db.returnCollectionTripleStore('resources', function (err, resources) {
      if (err) throw err
      var searchObj = { allAgents: parseInt(id) }

      var contributed = []
      var about = []

      resources.find(searchObj).limit(5000).toArray(function (err, results) {
        if (err) throw err
        if (results.length === 0) {
          cb(false)
        } else {
          results.forEach((r) => {
            var resource = util.flatenTriples(r)

            var tor = ['Unspecified']

            if (resource.objectUri['dcterms:type']) {
              tor = []
              resource.objectUri['dcterms:type'].forEach((t) => {
                tor.push(config['thesaurus']['typeOfResource'][t])
              })
            }

            tor = tor.join(' / ')

            var isContributor = false

            // see if this resource is by the agent or it is about the subject
            for (var x in resource.objectUri) {
              if (config['predicateCreators'].indexOf(x) > -1) {
                if (resource.objectUri[x].indexOf('agents:' + id) > -1) {
                  isContributor = true
                }
              }
            }
            var item = { title: '[Title]', uri: r.uri, dateStart: null, tor: tor }
            if (resource.objectLiteral['dcterms:title']) if (resource.objectLiteral['dcterms:title'][0]) item.title = resource.objectLiteral['dcterms:title'][0]
            if (resource.objectLiteral['db:dateStart']) if (resource.objectLiteral['db:dateStart'][0]) item.dateStart = resource.objectLiteral['db:dateStart'][0]

            if (resource.objectUri['dcterms:identifier']) {
              resource.objectUri['dcterms:identifier'].forEach((t) => {
                if (t.search('bnum') > -1) {
                  item.idBnum = t.split(':')[2]
                }
              })
            }

            if (isContributor) {
              if (!contributed) contributed = []
              contributed.push(item)
            } else {
              if (!about) about = []
              about.push(item)
            }
          })

          cb(convertAgentResourcesToJsonLd({ contributed: contributed, about: about }))
        }
      })
    })
  }

  app.agents.overview = function (params, cb) {
    var id = params.value
    app.agents.findById(id, function (findByIdResults) {
      if (!findByIdResults) {
        cb(false)
        return
      }

      var wikidataID = false

      if (findByIdResults.uriWikidata[0]) {
        wikidataID = findByIdResults.uriWikidata[0].split('wikidata:')[1]
      }

      if (findByIdResults.depiction[0]) {
        var filename = findByIdResults.depiction[0].substr(findByIdResults.depiction[0].length - 4, 4).toLowerCase()
        if (filename === 'jpeg') filename = '.jpg'
        if (filename === 'tiff') filename = '.tif'
        if (filename === '.svg') filename = '.png'
        if (filename === '.tif') filename = '.jpg'
        if (filename.search(/\./) === -1) filename = '.' + filename
        findByIdResults.depiction[0] = 'https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/' + wikidataID + filename
      }

      cb(findByIdResults)
    })
  }

  // Make sure to tweak "min_score" if things are indexed differntly.
  var searchAgentByName = function (text, fuzziness, max_expansions, page, cb) {
    var results = []
    app.esClient.search({
      index: 'agents',
      type: 'agent',
      body: {
        'query': {
          'function_score': {
            'query': {
              'bool': {
                'should': [
                  {
                    'match': {
                      'label.folded': {
                        'query': text,
                        'operator': 'and',
                        'fuzziness': fuzziness,
                        'max_expansions': max_expansions
                      }
                    }
                  },
                  {
                    'range': {
                      'useCount': {
                        'gt': 100,
                        'boost': 10
                      }
                    }
                  },
                  {
                    'term': {
                      'type': 'Person'
                    }
                  }
                ]
              }
            }
          }
        },
        'min_score': 0.65,
        'size': 50,
        'from': page * 50
      }
    }).then(function (resp) {
      var hits = resp.hits.hits
      hits.forEach(function (h) {
        if (h._source.depiction) {
          h._source.depiction = 'https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/' + h._source.depiction
        }
        h._source.score = h._score
        results.push(h._source)
      })

      // var resultsLd = convertAgentSearchToJsonLd(results, resp.hits.total)
      /* resultsLd.currentPage = page + 1
      resultsLd.morePages = true

      console.log('processing', resp)
      if (page === 20) resultsLd.morePages = false
      if (((page + 1) * 50) >= resp.hits.total) resultsLd.morePages = false
      */

      cb(serializers.AgentResultsSerializer.serialize(resp))
      // cb(resultsLd)
    }, function (err) {
      if (err) throw err
      // console.trace(err.message)
      cb(false)
    })
  }

  app.agents.search = function (params, cb) {
    params = parseSearchParams(params)

    searchAgentsByFilters(params, function (results) {
      cb(results)
    })
  }

  var searchAgentsByFilters = function (params, cb) {
    var query = buildElasticQuery(params)

    app.esClient.search({
      index: 'agents',
      body: {
        query: {
          function_score: {
            query: query,
            field_value_factor: {
              field: 'useCount'
            }
          }
        },
        min_score: 0.65,
        from: (params.per_page * (params.page - 1)),
        size: params.per_page
      }
    }).then((resp) => cb(serializers.AgentResultsSerializer.serialize(resp)), function (err) {
      app.logger.error(err.message)
      cb(false)
    })
  }

  var buildElasticQuery = function (params) {
    // Fill these with our top-level clauses:
    var shoulds = []
    var musts = []

    // If keyword supplied, match against selected, boosted fields:
    if (params.value) {
      shoulds.push({
        'multi_match': {
          'query': params.value,
          'fields': ['label^10', 'description^5']
        }
      })
    }

    // Specially handle date to match against range:
    if (params.filters && params.filters.date) {
      // If range of dates (i.e. array of two dates), ensure ranges overlap
      if (params.filters.date.length === 2) {
        musts.push({'range': {dobYear: {lte: params.filters.date[1]}}})
        musts.push({'range': {dobYear: {gte: params.filters.date[0]}}})

      // Otherwise, match on single date (ensure single date falls within object date range)
      } else if (params.filters.date) {
        var date = params.filters.date
        if ((typeof date) === 'object') date = date[0]

        musts.push({'range': {dobYear: { 'lte': date }}})
        musts.push({'range': {dobYear: { 'gte': date }}})
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
        case 'role':
          field = 'topFiveRoles' // TODO these two topFive* may be temporary mappings until these are indexed as _packed fields
          break
        case 'term':
          field = 'topFiveTerms'
          break
      }

      return { term: { [field]: value } }
    }

    // These can be matched singularly or in combination:
    if (params.filters) {
      ;['role', 'term', 'type'].forEach(function (param) {
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

  var parseSearchParams = function (params) {
    return util.parseParams(params, {
      value: { type: 'string' },
      filters: {
        type: 'string',
        keys: {
          date: { type: 'date' },
          identifier: { type: 'string' }
        }
      },
      page: { type: 'int', default: 1 },
      per_page: { type: 'int', default: 50, range: [1, 100] }
    })
  }

  app.agents.searchAggregations = function (params, cb) {
    params = parseSearchParams(params)
    aggregationsByFilters(params, function (results) {
      cb(results)
    })
  }

  var aggregationsByFilters = function (params, cb) {
    var query = buildElasticQuery(params)

    var aggs = {
      type: { terms: { field: 'type' } },
      role: { terms: { field: 'topFiveRoles' } },
      term: { terms: { field: 'topFiveTerms' } },
      dates: {
        histogram: {
          field: 'dobYear',
          interval: 10,
          min_doc_count: 1
        }
      }
    }

    var serializationOpts = {
      packed_fields: ['subject', 'contributor', 'collection']
    }
    app.esClient.search({
      index: 'agents',
      body: {
        query: {
          function_score: {
            'query': query
          }
        },
        min_score: 0.65,
        from: (params.per_page * (params.page - 1)),
        size: 0,
        aggregations: aggs
      }
    }).then((resp) => {
      cb(serializers.AggregationsSerializer.serialize(resp, serializationOpts))
    }, function (err) {
      app.logger.error(err.message)
      cb(false)
    })
  }

  // we try an increasingly fuzzy search for agent names if we get back zero hits.
  app.agents.searchByName = function (text, page, cb) {
    if (!page) page = 0
    page = page - 1
    if (page > 20) page = 20
    if (page < 0) page = 0

    searchAgentByName(text, 0, 1, page, function (results) {
      if (results.length === 0) {
        searchAgentByName(text, 5, 10, page, function (results) {
          if (results.length === 0) {
            searchAgentByName(text, 10, 20, page, function (results) {
              cb(results)
            })
          } else {
            cb(results)
          }
        })
      } else {
        cb(results)
      }
    })
  }

  app.agents.randomAgents = function (params, cb) {
    params = util.parseParams(params, { per_page: { type: 'int', default: 3, range: [1, 20] } })

    var results = []
    app.esClient.search({
      index: 'agents',
      type: 'agent',
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
              'filtered': {
                'filter': {
                  'bool': {
                    'must': {},
                    'should': {},
                    'must_not': {
                      'missing': {
                        'field': 'depiction',
                        'existence': true,
                        'null_value': true
                      }
                    }
                  }
                }
              }
            },
            'score_mode': 'sum'
          }
        }
      }
    }).then(function (resp) {
      var hits = resp.hits.hits
      hits.forEach(function (h) {
        // console.log(h)
        if (h._source.depiction) {
          h._source.depiction = 'https://s3.amazonaws.com/data.nypl.org/wikimedia_cache/' + h._source.depiction
        }
        results.push(h._source)
      })

      cb(convertAgentSearchToJsonLd(results))
    }, function (err) {
      if (err) throw err
      // console.trace(err.message)
      cb(false)
    })
  }

  var convertAgentSearchToJsonLd = function (hits, hitscount) {
    var base = {
      '@context': util.contextAll,
      '@type': 'itemList',
      'itemListElement': [],
      'totalResults': hitscount
    }

    hits.forEach((h) => {
      var foafType = 'foaf:Person'
      if (h.type === 'Meeting') foafType = 'foaf:Group'
      if (h.type === 'Coporation') foafType = 'foaf:Organization'
      if (h.type === 'Organization') foafType = 'foaf:Organization'

      var hitBase = {
        '@type': 'searchResult',
        'result': {
          '@type': ['nypl:Agent', foafType],
          '@id': 'agents:' + h.uri
        }
      }

      var addHere = hitBase['result']

      addHere['topFiveTermsString'] = []
      addHere['topFiveRolesString'] = []

      if (h.dobString) addHere['birthDate'] = h.dobString
      if (h.dobYear) addHere['birthYear'] = h.dobYear
      if (h.dobDecade) addHere['birthDecade'] = h.dobDecade
      if (h.dodString) addHere['deathDate'] = h.dodString
      if (h.dodYear) addHere['deathYear'] = h.dodYear
      if (h.dodDecade) addHere['deathDecade'] = h.dodDecade

      if (h.description) addHere['description'] = h.description
      if (h.viaf) addHere['uriViaf'] = 'viaf:' + h.viaf
      if (h.wikidata) addHere['uriWikidata'] = 'wikidata:' + h.wikidata
      if (h.lc) addHere['uriLc'] = 'lc:' + h.lc
      if (h.dbpedia) addHere['uriDbpedia'] = 'dbpedia:' + h.dbpedia
      if (h.depiction) addHere['depiction'] = h.depiction
      if (h.wikipedia) addHere['wikipedia'] = 'https://wikipedia.org/wiki/' + h.wikipedia
      if (h.label) addHere['prefLabel'] = h.label
      if (h.useCount) addHere['useCount'] = h.useCount
      if (h.score) addHere['searchResultScore'] = h.score

      h.topFiveTerms.forEach((tFT) => {
        addHere['topFiveTermsString'].push(tFT)
      })
      h.topFiveRoles.forEach((tFR) => {
        addHere['topFiveRolesString'].push(tFR)
      })
      base['itemListElement'].push(hitBase)
    })

    return base
  }

  var convertAgentImagesToJsonLd = function (images) {
    var base = {
      '@context': util.contextAll,
      '@type': 'itemList',
      'itemListElement': []
    }

    images.forEach((i) => {
      base['itemListElement'].push({
        '@type': 'searchResult',
        'result': {
          '@type': ['nypl:Capture'],
          '@id': 'resources:' + i.uri,
          'uuid': 'urn:x-nypl:uuid:' + i.uuid,
          filename: i.imageId.map((img) => img) // FIXME: <- map needed here?
        }
      })
    })
    return base
  }

  var convertAgentResourcesToJsonLd = function (resources) {
    var base = {
      '@context': util.contextAll,
      '@type': 'itemList',
      'itemListElement': []
    }

    resources.about.forEach((i) => {
      base['itemListElement'].push({
        '@type': 'searchResult',
        'prefLabel': i.tor,
        'isSubject': true,
        'result': {
          '@type': ['nypl:Resource'],
          '@id': 'resources:' + i.uri,
          'startYear': i.dateStart,
          'title': i.title,
          'idBnum': i.idBnum

        }
      })
    })

    resources.contributed.forEach((i) => {
      base['itemListElement'].push({
        '@type': 'searchResult',
        'prefLabel': i.tor,
        'isContributor': true,
        'result': {
          '@type': ['nypl:Resource'],
          '@id': 'resources:' + i.uri,
          'startYear': i.dateStart,
          'title': i.title,
          'idBnum': i.idBnum

        }
      })
    })

    return base
  }
}
