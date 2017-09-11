var request = require('request-promise')
var assert = require('assert')
const config = require('config')

var base_url = ('http://localhost:' + config.get('port'))

describe('Test Resources responses', function () {
  var sampleResources = [{id: 'b10015541', type: 'nypl:Item'}, {id: 'b10022950', type: 'nypl:Item'}]

  this.timeout(10000)

  describe('GET sample resources', function () {
    sampleResources.forEach(function (spec) {
      it(`Resource ${spec.id} has correct type ${spec.type}`, function (done) {
        request.get(`${base_url}/api/v0.1/discovery/resources/${spec.id}`, function (err, response, body) {
          if (err) throw err
          assert.equal(200, response.statusCode)
          var doc = JSON.parse(body)
          assert(doc['@type'].indexOf(spec.type) >= 0)
          done()
        })
      })
    })
  })

  describe('GET resources fields', function () {
    it('Resource data for b10015541 are what we expect', function (done) {
      request.get(`${base_url}/api/v0.1/discovery/resources/b10022950`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert(doc.title)
        assert.equal(doc.title[0], 'Religion--love or hate?')

        assert(doc.contributorLiteral)
        assert.equal(doc.contributorLiteral.length, 1)
        assert.equal(doc.contributorLiteral[0], 'Kirshenbaum, D. (David), 1902-')

        assert(doc.materialType)
        assert.equal(doc.materialType[0]['@id'], 'resourcetypes:txt')
        assert.equal(doc.materialType[0].prefLabel, 'Text')

        assert(doc.issuance)
        assert.equal(doc.issuance[0]['@id'], 'urn:biblevel:m')

        assert(doc.dimensions)
        assert.equal(doc.dimensions[0], '24 cm.')

        assert.equal(doc.createdYear, 1974)

        done()
      })
    })
  })

  describe('GET resources fields', function () {
    it('Resource data for b10022734 are what we expect', function (done) {
      request.get(`${base_url}/api/v0.1/discovery/resources/b10022734`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert(doc.title)
        assert.equal(doc.title[0], 'When Harlem was in vogue')

        assert.equal(doc.createdYear, 1981)

        assert(doc.items)
        assert.equal(doc.items.length, 3)
        assert.equal(doc.items.filter((i) => i.shelfMark[0] === 'Sc E 96-780 ---').length, 1)

        done()
      })
    })
  })

  describe('GET resource', function () {
    it('returns supplementaryContent', function (done) {
      request.get(`${base_url}/api/v0.1/discovery/resources/b18932917`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert(doc.supplementaryContent)
        assert(doc.supplementaryContent.length > 0)
        assert.equal(doc.supplementaryContent[0].label, 'FindingAid')
        assert.equal(doc.supplementaryContent[0]['@type'], 'nypl:SupplementaryContent')
        assert.equal(doc.supplementaryContent[0].url, 'http://archives.nypl.org/uploads/collection/pdf_finding_aid/PSF.pdf')

        done()
      })
    })

    it('returns item.electronicLocator', function (done) {
      request.get(`${base_url}/api/v0.1/discovery/resources/b10011374`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        let eItem = doc.items.find((item) => item.electronicLocator)
        assert(eItem.electronicLocator.length > 0)
        assert.equal(eItem.electronicLocator[0]['@type'], 'nypl:ElectronicLocation')
        assert.equal(eItem.electronicLocator[0].url, 'http://hdl.handle.net/2027/nyp.33433057532081')
        assert.equal(eItem.electronicLocator[0].label, 'Full text available via HathiTrust--v. 1')

        done()
      })
    })
  })

  describe('GET resources search', function () {
    var searchAllUrl = `${base_url}/api/v0.1/discovery/resources?q=`

    it('Resource search all returns status code 200', function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        done()
      })
    })

    it(`Resource search all (${searchAllUrl}) returns lots o\' results`, function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err

        var doc = JSON.parse(body)

        assert(doc.totalResults > 400000)
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

    /*
     *  Deprecating this for now
     *
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
    */

    describe('Filter by holdingLocation', function () {
      ; ['loc:rc2ma', 'loc:mal92'].forEach((holdingLocationId) => {
        it('returns only bibs with items in holdingLocation ' + holdingLocationId, function (done) {
          // Fetch all results:
          request.get(`${searchAllUrl}&filters[holdingLocation]=${holdingLocationId}`, function (err, response, body) {
            if (err) throw err

            let doc = JSON.parse(body)
            // Ensure we received results
            expect(doc.totalResults).to.be.above(1)

            // Ensure each result...
            doc.itemListElement.forEach((element) => {
              // .. has some items that ...
              let itemsWithHoldingLocation = element.result.items.filter((item) => {
                if (!item.holdingLocation) return false
                // .. have holding locations that match the filtered location.
                return item.holdingLocation.filter((loc) => loc['@id'] === holdingLocationId).length > 0
              })
              // For the result to match, only one item needs to match:
              expect(itemsWithHoldingLocation.length).to.be.above(0)
            })
            done()
          })
        })
      })
    })

    it('Ensure a chain of added filters reduces resultset correctly', function (done) {
      var dates = [1984, 1985]

      var nextUrl = searchAllUrl

      // Fetch all results:
      request.get(nextUrl, function (err, response, body) {
        if (err) throw err

        var doc = JSON.parse(body)
        // Establish ALL count:
        var prevTotal = doc.totalResults

        // Next, add filter on the first date (objects whose start/end date range include 1984)
        nextUrl = `${nextUrl}&filters[dateAfter]=${dates[0]}`
        return request.get(nextUrl, function (err, response, body) {
          if (err) throw err

          var doc = JSON.parse(body)

          // Ensure count decreased:
          expect(doc.totalResults).to.be.below(prevTotal)

          // Ensure first bib dateEndYear overlaps date
          expect(doc.itemListElement[0].result.dateEndYear).to.be.above(dates[0] - 1)

          prevTotal = doc.totalResults

          // Now filter on both dates (adding objects whose date range includes 1985)
          nextUrl += `&filters[dateBefore]=${dates[1]}`
          return request.get(nextUrl, function (err, response, body) {
            if (err) throw err

            var doc = JSON.parse(body)

            // Ensure count decreased:
            expect(doc.totalResults).to.be.below(prevTotal)

            // Ensure first bib dateStartYear-dateEndYear overlaps dates
            expect(doc.itemListElement[0].result.dateEndYear).to.be.above(dates[0] - 1)
            expect(doc.itemListElement[0].result.dateStartYear).to.be.below(dates[1] + 1)

            prevTotal = doc.totalResults

            // Now add language filter:
            nextUrl += '&filters[language]=lang:kan'
            return request.get(nextUrl, function (err, response, body) {
              if (err) throw err

              var doc = JSON.parse(body)

              // Ensure count decreased:
              expect(doc.totalResults).to.be.below(prevTotal)

              done()
            })
          })
        })
      })
    })

    /*
     *  Deprecating this for now
     *
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
            assert(rootParent['@id'] === `res:${parentId}`)
          }

          done()
        })
      })
    })
    */
  })
})
