/* global describe it */

var request = require('request')
var assert = require('assert')
var base_url = (process.env.API_ADDRESS ? process.env.API_ADDRESS : 'http://localhost:3000')

describe('Test Agents responses', function () {
  var sampleAgents = [{uri: 13777690, type: 'foaf:Person'}, {uri: 11981434, type: 'foaf:Person'}]

  describe('GET sample agents', function () {
    sampleAgents.forEach(function (spec) {
      it(`Agent ${spec.uri} returns status code 200`, function (done) {
        request.get(`${base_url}/api/v1/agents/${spec.uri}`, function (err, response, body) {
          if (err) throw err
          assert.equal(200, response.statusCode)
          done()
        })
      })

      it(`Agent ${spec.uri} has correct type ${spec.type}`, function (done) {
        request.get(`${base_url}/api/v1/agents/${spec.uri}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert.equal(true, doc['@type'] === spec.type || doc['@type'].indexOf(spec.type) >= 0) // ['rdf:type'][0]['objectUri'])
          done()
        })
      })
    })
  })

  describe('GET agents random', function () {
    var randomUrl = `${base_url}/api/v1/agents?action=random`
    it('Agents random has requested page size', function (done) {
      request.get(`${randomUrl}&per_page=13`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(13, doc.itemListElement.length)
        done()
      })
    })
  })

  describe('GET agents search', function () {
    var searchAllUrl = `${base_url}/api/v1/agents?action=search`

    it('Agent search all returns status code 200', function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        assert.equal(200, response.statusCode)
        done()
      })
    })

    var expectMillions = 4 // million
    it(`Agent search all (${searchAllUrl}) returns > ${expectMillions}mil results`, function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert(doc.totalResults > expectMillions * 1000000)
        done()
      })
    })

    it('Agent search all page 1 has default page size', function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(50, doc.itemListElement.length)
        done()
      })
    })

    it('Agent search all page 1 has requested page size', function (done) {
      request.get(`${searchAllUrl}&per_page=42`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(42, doc.itemListElement.length)
        done()
      })
    })

    it('Agent search pagination is consistent', function (done) {
      request.get(`${searchAllUrl}&page=101&per_page=1`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        var item101 = doc.itemListElement[0].result

        // Now fetch same item in different way:
        request.get(`${searchAllUrl}&page=2&per_page=100`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert.equal(doc.itemListElement[0].result.uri, item101.uri)
          done()
        })
      })
    })

    it('Agent search date range', function (done) {
      var dates = [1400, 1410]

      // First just filter on the first date (objects whose start/end date range include 1984)
      request.get(`${searchAllUrl}&filters[date]=${dates[0]}`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)

        // Agent dob is year queried:
        assert.equal(doc.itemListElement[0].result.birthYear, dates[0])

        // At writing, this returns 538 agents
        assert(doc.totalResults < 600)

        var prevTotal = doc.totalResults

        // Now filter on both dates (adding agents born btw 1400-1410)
        var yearFilter = dates.map((a) => `filters[date][]=${a}`).join('&')
        request.get(`${searchAllUrl}&${yearFilter}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert(doc.totalResults > prevTotal)

          done()
        })
      })
    })
  })
})
