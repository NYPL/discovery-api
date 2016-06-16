/* global describe it */

var request = require('request')
var assert = require('assert')
var base_url = (process.env.API_ADDRESS ? process.env.API_ADDRESS : 'http://localhost:3000')

describe('Test Resources responses', function () {
  var sampleResources = [{uri: 101164830, type: 'nypl:Component'}, {uri: 100037340, type: 'nypl:Item'}]
  // var sampleResources = [{uri: 101164830, type: 'resourcetypes:col'}, {uri: 100037340, type: 'resourcetypes:txt'}]

  this.timeout(10000)

  describe('GET sample resources', function () {
    sampleResources.forEach(function (spec) {
      it(`Resource ${spec.uri} returns status code 200`, function (done) {
        request.get(`${base_url}/api/v1/resources/${spec.uri}`, function (err, response, body) {
          if (err) throw err
          assert.equal(200, response.statusCode)
          done()
        })
      })

      it(`Resource ${spec.uri} has correct type ${spec.type}`, function (done) {
        request.get(`${base_url}/api/v1/resources/${spec.uri}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert(doc['@type'].indexOf(spec.type) >= 0)
          done()
        })
      })
    })
  })

  describe('GET resources random', function () {
    var randomUrl = `${base_url}/api/v1/resources?action=random`
    it('Resource random has requested page size', function (done) {
      request.get(`${randomUrl}&per_page=13`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(13, doc.itemListElement.length)
        done()
      })
    })
  })

  describe('GET resources fields', function () {
    it('Resource data for 136050732 are what we expect', function (done) {
      request.get(`${base_url}/api/v1/resources/136050732`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert.equal(doc.idLccCoarse[0], 'PN6157-6222')
        assert.equal(doc.language[0].prefLabel, 'English')
        assert.equal(doc.type[0].prefLabel, 'Audio')
        assert.equal(doc.type[0]['@id'], 'resourcetypes:aud')

        // Comic Relief (Fund raising enterprise) is a contrib:
        assert(doc.contributor.length > 10)
        assert.equal(doc.contributor.filter((contrib) => contrib['@id'] === 'agents:10473263').length, 1)

        // George Carlin is a contrib:
        assert.equal(doc.contributor.filter((contrib) => contrib['@id'] === 'agents:11230376').length, 1)

        // Billy Crystal is a perf:
        assert(doc['roles:prf'].length > 10)
        assert.equal(doc['roles:prf'].filter((perf) => perf.prefLabel.indexOf('Crystal, Billy') >= 0).length, 1)

        assert(doc.subject.length >= 2)
        assert.equal(doc.subject.filter((subj) => subj.prefLabel.indexOf('Wit and humor') >= 0).length, 1)

        done()
      })
    })
  })

  describe('GET resources search', function () {
    var searchAllUrl = `${base_url}/api/v1/resources?action=search`

    it('Resource search all returns status code 200', function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        assert.equal(200, response.statusCode)
        done()
      })
    })

    it(`Resource search all (${searchAllUrl}) returns > 10mil results`, function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert(doc.totalResults > 10000000)
        done()
      })
    })

    it('Resource search all page 1 has default page size', function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(50, doc.itemListElement.length)
        done()
      })
    })

    it('Resource search all page 1 has requested page size', function (done) {
      request.get(`${searchAllUrl}&per_page=42`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        assert.equal(42, doc.itemListElement.length)
        done()
      })
    })

    it('Resource search pagination is consistent', function (done) {
      request.get(`${searchAllUrl}&page=101&per_page=1`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        var item101 = doc.itemListElement[0].result

        // Now fetch same item in different way:
        request.get(`${searchAllUrl}&page=2&per_page=100`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert.equal(doc.itemListElement[0].result['@id'], item101['@id'])
          done()
        })
      })
    })

    it('Resource search filter on agents', function (done) {
      // Filter on these agents:
      var agents = ['agents:10955903', 'agents:10334529']

      // First just filter on the first agent
      request.get(`${searchAllUrl}&filters[contributor]=${agents[0]}]`, function (err, response, body) {
        if (err) throw err
        var doc = JSON.parse(body)
        // At writing, this returns 14 items
        assert(doc.totalResults < 100)

        var prevTotal = doc.totalResults

        // Now filter on both agents (matching either)
        var agentsFilter = agents.map((a) => `filters[contributor][]=${a}`).join('&')
        request.get(`${searchAllUrl}&${agentsFilter}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert(doc.totalResults > prevTotal)

          done()
        })
      })
    })

    var dates = [1984, 1985]
    var initialUrl = `${searchAllUrl}&filters[date]=${dates[0]}`
    // First just filter on the first date (objects whose start/end date range include 1984)
    request.get(initialUrl, function (err, response, body) {
      if (err) throw err
      var doc = JSON.parse(body)

      it(`Resource search date: first item in range ( ${initialUrl} )`, function (done) {
        // Obj date range encompases queried date:
        assert(doc.itemListElement[0].result.dateStartYear <= dates[0])
        assert(doc.itemListElement[0].result.dateEndYear >= dates[0])
        done()
      })

      var prevTotal
      it(`Resource search date: count < 50K ( ${initialUrl} )`, function (done) {
        // At writing, this returns 42,209 docs
        assert(doc.totalResults < 50000)
        done()
      })

      it(`Resource search date: Adding end-date increases results ( ${initialUrl} )`, function (done) {
        prevTotal = doc.totalResults

        // Now filter on both dates (adding objects whose date range includes 1985)
        var yearFilter = dates.map((a) => `filters[date][]=${a}`).join('&')
        request.get(`${searchAllUrl}&${yearFilter}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)
          assert(doc.totalResults > prevTotal)

          done()
        })
      })
    })

    var parents = [101669044]
    parents.forEach((parentId) => {
      var url = `${searchAllUrl}&filters[parent]=${parentId}`
      it('Resources by parent (' + url + ')', function (done) {
        // First just filter on the first date (objects whose start/end date range include 1984)
        request.get(url, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)

          var firstItem = doc.itemListElement[0].result
          if (firstItem.memberOf) {
            var rootParent = firstItem.memberOf[firstItem.memberOf.length - 1]
            assert.equal(rootParent['@id'], `res:${parentId}`)
          }

          done()
        })
      })
    })

    /*
    var map = {
      'romeo & juliet': 10012622
    }
    Object.keys(map).forEach((q) => {
      it(`Agent search relevance: ${q} => agents:${map[q]}`, function (done) {
        request.get(`${searchAllUrl}&q=${q}`, function (err, response, body) {
          if (err) throw err
          var doc = JSON.parse(body)

          var expectedAgentUri = `agents:${map[q]}`
          assert(doc.itemListElement[0].result['@id'] === expectedAgentUri)

          done()
        })
      })
    })
    */
  })
})
