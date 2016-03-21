'use strict'
/* global describe it */
var assert = require('assert')
require('should')
var util = require('../lib/util.js')

var resourceMoby = { '_id': '569f4c666e1ededb4ab6320a', 'uri': 121544959, 'allAgents': [ 10045014, 10530453 ], 'allTerms': [ 10000202, 10021321 ], 'dcterms:contributor': [ { 'objectUri': 'agents:10045014', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.814Z', 'source': 'data:10000', 'recordIdentifier': 13196949 }, 'label': 'Melville, Herman, 1819-1891' }, { 'objectUri': 'agents:10530453', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.814Z', 'source': 'data:10000', 'recordIdentifier': 13196949 }, 'label': 'Arvin, Newton, 1900-1963' } ], 'dcterms:subject': [ { 'objectUri': 'terms:10000202', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': null }, 'label': 'Fiction' }, { 'objectUri': 'terms:10021321', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': null }, 'label': 'Whales' } ], 'nypl:owner': [ { 'objectUri': 'orgs:1101', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'dcterms:identifier': [ { 'objectUri': 'urn:callnum:NCW(Melville,H.MobyDick.NewYork,1949(Rinehart))', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:bnum:13196949', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:oclc:37277470', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:classmark:ncw', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:lccc:PZ1-4', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:owi:1911622477', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:dcc:813.36', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } }, { 'objectUri': 'urn:lcc:PZ3.M498', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'nypl:suppressed': [ { 'objectUri': null, 'objectLiteral': false, 'objectLiteralType': 'xsd:boolean', 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'rdf:type': [ { 'objectUri': 'nypl:Item', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'dcterms:title': [ { 'objectUri': null, 'objectLiteral': 'Moby Dick; or, The whale', 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'classify:holdings': [ { 'objectUri': null, 'objectLiteral': 548, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'dcterms:type': [ { 'objectUri': 'resourcetypes:txt', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'dcterms:language': [ { 'objectUri': 'language:eng', 'objectLiteral': null, 'objectLiteralType': null, 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'db:dateStart': [ { 'objectUri': null, 'objectLiteral': '1949', 'objectLiteralType': 'xsd:date', 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ], 'dcterms:created': [ { 'objectUri': null, 'objectLiteral': '1949', 'objectLiteralType': 'xsd:date', 'provo': { 'creator': 'RI', 'created': '2016-01-20T08:59:01.817Z', 'source': 'data:10000', 'recordIdentifier': 13196949 } } ] }

describe('util', function () {
  it('test expandObjectUri', function () {
    var r = util.expandObjectUri('agents:123456789')
    r.should.equal('http://data.nypl.org/agents/123456789')
  })

  it('return ntriples returnNtTriples', function () {
    var r = util.returnNtTriples(resourceMoby, 'resource')
    r[0].should.equal('<http://data.nypl.org/resources/121544959> <http://purl.org/dc/terms/contributor> <http://data.nypl.org/agents/10045014>.')
  })

  it('test returnNtJsonLd', function (done) {
    util.returnNtJsonLd(resourceMoby, 'resource', function (err, results) {
      if (err) throw err
      results['@id'].should.equal('res:121544959')
      results['dcterms:created']['@value'].should.equal('1949')
      done()
    })

  // r.should.equal('http://data.nypl.org/agents/123456789')
  })

  it('param parsing', function () {
    var tests = []

    // Test basic string parse:
    tests.push({
      incoming: {value: 'foo'},
      spec: {value: {type: 'string'}},
      outgoing: {value: 'foo'}
    })

    // Test multi- string param:
    tests.push({
      incoming: {value: ['foo', 'bar']},
      spec: {value: {type: 'string'}},
      outgoing: {value: ['foo', 'bar']}
    })

    // Test multi- numeric param:
    tests.push({
      incoming: {num_param: ['1', '1000']},
      spec: {num_param: {type: 'int'}},
      outgoing: {num_param: [1, 1000]}
    })

    // Test default val
    tests.push({
      incoming: {},
      spec: {missing_param: {default: 'default val'}},
      outgoing: {missing_param: 'default val'}
    })

    // Test invalid vals with/without defaults
    tests.push({
      incoming: {
        bad_int_range: ['1', 'pumpkin'],
        bad_int_with_default: 'gourd',
        bad_int_range_with_defaults: ['kabucha', 'turnip']
      },
      spec: {
        bad_int_range: { type: 'int' },
        bad_int_with_default: { type: 'int', default: 13 },
        bad_int_range_with_defaults: { type: 'int', default: 13 }
      },
      outgoing: {
        bad_int_range: [1],
        bad_int_with_default: 13,
        bad_int_range_with_defaults: [13, 13]
      }
    })

    // Test big fat multi-level param set
    tests.push({
      incoming: {
        sub_object: {
          stringParam: 'whatever',
          numericParam: '1234',
          badNumericParam: '1234abc',
          dateRangeParam: ['1984', '1985']
        },
        value: 'keywords...',
        per_page: '5678'
      },
      spec: {
        sub_object: {
          type: 'object',
          keys: {
            stringParam: { type: 'string' },
            numericParam: { type: 'int' },
            badNumericParam: { type: 'int' },
            dateRangeParam: { type: 'date' }
          }
        },
        value: { type: 'string' },
        per_page: { type: 'int' }
      },
      outgoing: {
        sub_object: {
          stringParam: 'whatever',
          numericParam: 1234,
          dateRangeParam: [1984, 1985]
        },
        value: 'keywords...',
        per_page: 5678
      }
    })

    // Run all parse tests:
    tests.forEach(function (params) {
      var parsed = util.parseParams(params.incoming, params.spec)
      assert.deepEqual(parsed, params.outgoing)
    })
  })
})
