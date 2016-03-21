// var md5 = require('md5')
var config = require('config')
var util = require('../lib/util')

module.exports = function (app) {
  app.agents = {}

  app.agents.findById = function (id, cb) {
    app.db.returnCollectionTripleStore('agents', function (err, agents) {
      if (err) throw err
      agents.find({ uri: parseInt(id) }).toArray(function (err, results) {
        if (err) throw err
        if (results.length === 0) {
          cb(false)
        } else {
          cb(convertAgentLookupToJsonLd(results[0]))
        }
      })
    })
  }

  // to remove?
  // app.agents.reportResourceType = function(id, cb){
  // 	app.db.returnCollectionTripleStore("resources",function(err,resources){
  // 		resources.find( {allAgents: parseInt(id) }, { 'dcterms:type' : 1, 'dcterms:identifier' : 1 } ).toArray(function(err,results){
  // 			if (results.length==0){
  // 				cb(false)
  // 			}else{
  // 				var torMap = {}
  // 				//make a map of the differnt types
  // 				results.forEach(function(r){
  // 					if (r['dcterms:type']){
  // 						r['dcterms:type'].forEach(function(r){
  // 							if (!torMap[r.objectUri]) torMap[r.objectUri] = { label: app.thesaurus.typeOfResource[r.objectUri], count: 0}
  // 							torMap[r.objectUri].count++
  // 						})
  // 					}else{
  // 						if (!torMap['resourcetypes:unk']) torMap['resourcetypes:unk'] = { label: 'Unspecified', count: 0}
  // 						torMap['resourcetypes:unk'].count++
  // 					}
  // 				})
  // 				cb(torMap)
  // 			}
  // 		})
  // 	})
  // }

  app.agents.imagesOf = function (id, cb) {
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

  app.agents.resources = function (id, cb) {
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

  app.agents.overview = function (id, cb) {
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

      var resultsLd = convertAgentSearchToJsonLd(results, resp.hits.total)
      resultsLd.currentPage = page + 1
      resultsLd.morePages = true

      if (page === 20) resultsLd.morePages = false
      if (((page + 1) * 50) >= resp.hits.total) resultsLd.morePages = false

      cb(resultsLd)
    }, function (err) {
      if (err) throw err
      // console.trace(err.message)
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

  app.agents.randomAgents = function (cb) {
    var results = []
    app.esClient.search({
      index: 'agents',
      type: 'agent',
      body: {
        'size': 3,
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

  // PARSING

  /*
  var removeEmptyArrays = function (ary) {
    for (var x in ary) {
      if (Array.isArray(ary[x])) if (ary[x].length === 0) delete ary[x]
    }
    return ary
  }
  */

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

  var convertAgentLookupToJsonLd = function (rawAgentData) {
    var base = {
      '@context': util.contextAll,
      '@type': [],
      'prefLabel': [],
      'description': [],
      'birthDate': [],
      'deathDate': [],
      'depiction': [],
      'wikipedia': [],
      'uriWikidata': [],
      'uriDbpedia': [],
      'uriViaf': [],
      'uriLc': [],
      'topFiveTermsString': [],
      'topFiveRolesString': []
    }

    if (rawAgentData['rdf:type']) {
      rawAgentData['rdf:type'].forEach((type) => {
        base['@type'].push(type.objectUri)
      })
    }

    if (rawAgentData.uri) base['@id'] = 'agents:' + rawAgentData.uri

    if (rawAgentData['skos:exactMatch']) {
      rawAgentData['skos:exactMatch'].forEach((value) => {
        var prefix = value.objectUri.split(':')[0]
        if (prefix === 'viaf') base.uriViaf.push(value.objectUri)
        if (prefix === 'wikidata') base.uriWikidata.push(value.objectUri)
        if (prefix === 'lc') base.uriLc.push(value.objectUri)
        if (prefix === 'dbr') base.uriDbpedia.push(value.objectUri)
      })
    }

    if (rawAgentData['skos:prefLabel']) {
      rawAgentData['skos:prefLabel'].forEach((value) => {
        base.prefLabel.push(value.objectLiteral)
      })
    }
    if (rawAgentData['dbo:birthDate']) {
      rawAgentData['dbo:birthDate'].forEach((value) => {
        base.birthDate.push(value.objectLiteral)
      })
    }
    if (rawAgentData['dbo:deathDate']) {
      rawAgentData['dbo:deathDate'].forEach((value) => {
        if (base.birthDate.indexOf(value.objectLiteral) === -1) {
          base.birthDate.push(value.objectLiteral)
        }
      })
    }
    if (rawAgentData['foaf:isPrimaryTopicOf']) {
      rawAgentData['foaf:isPrimaryTopicOf'].forEach((value) => {
        base.wikipedia.push(value.objectLiteral)
      })
    }
    if (rawAgentData['foaf:depiction']) {
      rawAgentData['foaf:depiction'].forEach((value) => {
        base.depiction.push(value.objectLiteral)
      })
    }
    if (rawAgentData['dcterms:description']) {
      rawAgentData['dcterms:description'].forEach((value) => {
        base.description.push(value.objectLiteral)
      })
    }

    if (rawAgentData['topFiveTerms']) base['topFiveTermsString'] = rawAgentData['topFiveTerms']
    if (rawAgentData['topFiveRoles']) base['topFiveRolesString'] = rawAgentData['topFiveRoles']

    return (base)
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
