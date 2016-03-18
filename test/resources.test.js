var request = require("request"),
    assert = require('assert'),
    base_url = (process.env.API_ADDRESS ? process.env.API_ADDRESS : "http://localhost:3000")

describe("Test Resources responses", function() {

  var sampleResources = [{uri: 101164830, type: 'nypl:Component'}, {uri: 100037340, type: 'nypl:Item'}]

  describe('GET sample resources', function() {
    sampleResources.forEach(function(spec) {

      it(`Resource ${spec.uri} returns status code 200`, function(done) {
        request.get(`${base_url}/api/v1/resources/${spec.uri}`, function(error, response, body) {
          assert.equal(200, response.statusCode)
          done()
        })
      })

      it(`Resource ${spec.uri} has correct type ${spec.type}`, function(done) {
        request.get(`${base_url}/api/v1/resources/${spec.uri}`, function(error, response, body) {
          var doc = JSON.parse(body)
          assert.equal(spec.type, doc['rdf:type'][0]['objectUri'])
          done()
        })
      })

    })
  })

  describe('GET resources random', function() {
    var randomUrl = `${base_url}/api/v1/resources?action=search`
    it('Resource random has requested page size', function(done) {
      request.get(`${randomUrl}&per_page=13`, function(error, response, body) {
        var doc = JSON.parse(body)
        assert.equal(13, doc.itemListElement.length)
        done()
      })
    })
  })

  describe('GET resources search', function() {

    var searchAllUrl = `${base_url}/api/v1/resources?action=search`

    it('Resource search all returns status code 200', function(done) {
      request.get(searchAllUrl, function(error, response, body) {
        assert.equal(200, response.statusCode)
        done()
      })
    })

    it('Resource search all returns > 10mil results', function(done) {
      request.get(searchAllUrl, function(error, response, body) {
        var doc = JSON.parse(body)
        assert(doc.totalResults > 10000000)
        done()
      })
    })

    it('Resource search all page 1 has default page size', function(done) {
      request.get(searchAllUrl, function(error, response, body) {
        var doc = JSON.parse(body)
        assert.equal(50, doc.itemListElement.length)
        done()
      })
    })

    it('Resource search all page 1 has requested page size', function(done) {
      request.get(`${searchAllUrl}&per_page=42`, function(error, response, body) {
        var doc = JSON.parse(body)
        assert.equal(42, doc.itemListElement.length)
        done()
      })
    })

    it('Resource search pagination is consistent', function(done) {
      request.get(`${searchAllUrl}&page=101&per_page=1`, function(error, response, body) {
        var doc = JSON.parse(body)
        var item101 = doc.itemListElement[0].result

        // Now fetch same item in different way:
        request.get(`${searchAllUrl}&page=2&per_page=100`, function(error, response, body) {
          var doc = JSON.parse(body)
          assert.equal(doc.itemListElement[0].result.uri, item101.uri)
          done()
        })
      })
    })

    it('Resource search filter on agents', function(done) {
      // Filter on these agents:
      var agents = ['agents:10955903', 'agents:10334529']

      // First just filter on the first agent
      request.get(`${searchAllUrl}&filters[contributor]=${agents[0]}]`, function(error, response, body) {
        var doc = JSON.parse(body)
        // At writing, this returns 14 items
        assert(doc.totalResults < 100)

        var prevTotal = doc.totalResults

        // Now filter on both agents (matching either)
        var agentsFilter = agents.map( a => `filters[contributor][]=${a}` ).join('&')
        request.get(`${searchAllUrl}&${agentsFilter}`, function(error, response, body) {
          var doc = JSON.parse(body)
          assert(doc.totalResults > prevTotal)

          done()
        })
      })
    })

    it('Resource search date range', function(done) {
      var dates = [1984,1985]

      // First just filter on the first date (objects whose start/end date range include 1984)
      request.get(`${searchAllUrl}&filters[date]=${dates[0]}`, function(error, response, body) {
        var doc = JSON.parse(body)

        // Obj date range encompases queried date:
        assert(doc.itemListElement[0].result.dateStartYear <= dates[0])
        assert(doc.itemListElement[0].result.dateEndYear >= dates[0])

        // At writing, this returns 42,209 docs
        assert(doc.totalResults < 50000)

        var prevTotal = doc.totalResults

        // Now filter on both dates (adding objects whose date range includes 1985)
        var yearFilter = dates.map( a => `filters[date][]=${a}` ).join('&')
        request.get(`${searchAllUrl}&${yearFilter}`, function(error, response, body) {
          var doc = JSON.parse(body)
          assert(doc.totalResults > prevTotal)

          done()
        })
      })
    })

  })


})
