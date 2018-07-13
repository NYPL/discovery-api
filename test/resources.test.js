const request = require('request-promise')
const assert = require('assert')

const fixtures = require('./fixtures')

describe('Resources query', function () {
  let resourcesPrivMethods = {}

  before(function () {
    require('../lib/resources')({}, resourcesPrivMethods)
  })

  describe('parseSearchParams', function () {
    it('parses params, sets defaults', function () {
      const params = resourcesPrivMethods.parseSearchParams({ })
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('all')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal(undefined)
      expect(params.filters).to.equal(undefined)
    })
  })

  describe('escapeQuery', function () {
    it('should escape specials', function () {
      expect(resourcesPrivMethods.escapeQuery('? ^ *')).to.equal('\\\\? \\\\^ \\\\*')
    })

    it('should escape unrecognized field indicators', function () {
      expect(resourcesPrivMethods.escapeQuery('fladeedle:gorf')).to.equal('fladeedle\\:gorf')
    })

    it('should not escape recognized field indicators', function () {
      expect(resourcesPrivMethods.escapeQuery('title:gorf')).to.equal('title:gorf')
    })

    it('should escape a single forward slash', function () {
      expect(resourcesPrivMethods.escapeQuery('/')).to.equal('\\/')
    })

    it('should escape floating colon', function () {
      // Make sure colons floating in whitespace are escaped:
      expect(resourcesPrivMethods.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')
    })

    it('should escape colons in hyphenated phrases', function () {
      expect(resourcesPrivMethods.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ / Avtor-sostavitelʹ: B.A. Konikov.')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ \\/ Avtor-sostavitelʹ\\: B.A. Konikov.')
    })
  })

  describe('buildElasticQuery', function () {
    it('uses "query string query" if subjectLiteral: used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.should).to.be.a('array')
      expect(body.bool.should[0]).to.be.a('object')
      expect(body.bool.should[0].query_string).to.be.a('object')
      expect(body.bool.should[0].query_string.query).to.equal('subjectLiteral:potatoes')
    })

    it('uses "query string query" if subjectLiteral: quoted phrase used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.should).to.be.a('array')
      expect(body.bool.should[0]).to.be.a('object')
      expect(body.bool.should[0].query_string).to.be.a('object')
      expect(body.bool.should[0].query_string.query).to.equal('subjectLiteral:\"hot potatoes\"')
    })

    it('escapes colon if field not recognized', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'fladeedle:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.should).to.be.a('array')
      expect(body.bool.should[0]).to.be.a('object')
      expect(body.bool.should[0].query_string).to.be.a('object')
      expect(body.bool.should[0].query_string.query).to.equal('fladeedle\\:\"hot potatoes\"')
    })

    it('uses "query string query" if plain keyword query used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.should).to.be.a('array')
      expect(body.bool.should[0]).to.be.a('object')
      expect(body.bool.should[0].query_string).to.be.a('object')
      expect(body.bool.should[0].query_string.query).to.equal('potatoes')
    })
  })
})

describe('Test Resources responses', function () {
  var sampleResources = [{id: 'b10015541', type: 'nypl:Item'}, {id: 'b10022950', type: 'nypl:Item'}]

  this.timeout(10000)

  before(function () {
    fixtures.enableFixtures()
  })

  after(function () {
    fixtures.disableFixtures()
  })

  describe('GET sample resources', function () {
    sampleResources.forEach(function (spec) {
      it(`Resource ${spec.id} has correct type ${spec.type}`, function (done) {
        request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${spec.id}`, function (err, response, body) {
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
    it('Resource data for b10022950 are what we expect', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10022950`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert(doc.title)
        assert.equal(doc.title[0], 'Religion--love or hate?')

        assert(doc.creatorLiteral)
        assert.equal(doc.creatorLiteral.length, 1)
        assert.equal(doc.creatorLiteral[0], 'Kirshenbaum, D. (David), 1902-')

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

    it('extracts identifiers in urn style if indexed as entity', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10011374`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        // At writing the fixture has both `identifier` and `identifierV2` fields,
        // so it will choose the latter (which are stored as entities)
        // Here we confirm the entities are converted to urn:
        expect(doc.identifier).to.be.a('array')
        expect(doc.identifier).to.include.members(['urn:bnum:10011374', 'urn:lccn:35038534'])

        // Also check an item's identifiers:
        expect(doc.items).to.be.a('array')
        expect(doc.items[0]).to.be.a('object')
        expect(doc.items[0].identifier).to.be.a('array')

        expect(doc.items[0].identifier).to.include.members(['urn:callnumber:*AY (Hone, W. Table book) v. 1', 'urn:barcode:33433067332548'])

        done()
      })
    })

    it('extracts identifiers in urn style if indexed in urn style', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10022950`, function (err, response, body) {
        if (err) throw err

        expect(response.statusCode).to.equal(200)

        var doc = JSON.parse(body)

        expect(doc.identifier).to.be.a('array')
        expect(doc.identifier).to.include.members(['urn:bnum:10022950', 'urn:callnumber:*PGZ 81-1452'])

        done()
      })
    })
  })

  describe('GET resources fields', function () {
    it('Resource data for b10022734 are what we expect', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10022734`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        var doc = JSON.parse(body)

        assert(doc.title)
        assert.equal(doc.title[0], 'When Harlem was in vogue')

        assert.equal(doc.createdYear, 1981)

        assert(doc.items)
        assert.equal(doc.items.length, 3)
        assert.equal(doc.items.filter((i) => i.shelfMark[0] === 'Sc *700-L (Lewis, D. When Harlem was in vogue)').length, 1)

        done()
      })
    })
  })

  describe('GET resource blanknode note field', function () {
    it('Resource data for b10001936 contains rewitten note field', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10001936`, function (err, response, body) {
        if (err) throw err

        expect(response.statusCode).to.equal(200)

        var doc = JSON.parse(body)

        expect(doc.note).to.be.a('array')
        expect(doc.note).to.have.lengthOf(5)

        expect(doc.note[2]).to.be.a('object')
        expect(doc.note[2]['@type']).to.equal('bf:Note')
        expect(doc.note[2].noteType).to.equal('Additional Formats')
        expect(doc.note[2].prefLabel).to.equal('Also available on microform;')

        done()
      })
    })
  })
  describe('GET resource', function () {
    it('returns supplementaryContent', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b18932917`, function (err, response, body) {
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
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10011374`, function (err, response, body) {
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
    var searchAllUrl = null

    before(() => {
      searchAllUrl = `${global.TEST_BASE_URL}/api/v0.1/discovery/resources?q=`
    })

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

  it('PatronEligibility responds with \'eligible to place holds\' for an eligible patron', function (done) {
    request.get(`${global.TEST_BASE_URL}/api/v0.1/request/patronEligibility/1001006`, function (err, response, body) {
      if (err) console.log(err)
      console.log('console logging response: ', response.body)
      expect(response.body).to.equal('\"eligible to place holds\"') // should look into this, also need to worry about actually making api calls
      done()
    })
  })

  it('PatronEligibility responds with a string representation of an errors object for an ineligible patron', function (done) {
    request.get(`${global.TEST_BASE_URL}/api/v0.1/request/patronEligibility/5459252`, function (err, response, body) {
      if (err) console.log(err)
      console.log('console logging response: ', response.body)
      expect(response.body).to.equal('"{\\"expired\\":false,\\"blocked\\":true,\\"moneyOwed\\":true}"') // should look into this, also need to worry about actually making api calls
      done()
    })
  })
})
