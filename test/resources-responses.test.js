const request = require('request-promise')
const assert = require('assert')
const { expect } = require('chai')

const fixtures = require('./fixtures')
const app = require('../app')

describe('Test Resources responses', function () {
  const sampleResources = [{ id: 'b10015541', type: 'nypl:Item' }, { id: 'b10022950', type: 'nypl:Item' }]

  this.timeout(10000)

  before(async () => {
    fixtures.enableEsFixtures()
    fixtures.enableScsbFixtures()

    await app.start()
  })

  after(function () {
    fixtures.disableEsFixtures()
    fixtures.disableScsbFixtures()
  })

  describe('GET all_items', () => {
    it('reverts to filtering on inner_hits when item filters are included in the query', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?all_items=true&item_status=status:i'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.items.length).to.equal(41)
        done()
      })
    })
    it('reverts to filtering on inner_hits when item filters are included in the query and returns default item size', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?all_items=true&item_status=status:a'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.items.length).to.equal(100)
        done()
      })
    })
    it('returns bib with electronic resources filtered from items', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b15109087?all_items=true'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        const electronicLocatorItemsFiltered = doc.items.filter((item) => item.electronicLocator).length === 0
        expect(electronicLocatorItemsFiltered).to.equal(true)
        expect(doc.electronicResources.length).to.equal(368)
        done()
      })
    })
    it('returns bib with items sorted by date', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?all_items=true'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        const firstTenItems = doc.items.slice(0, 10)
        const isCheckinCardItem = (item) => item.uri.includes('i-h')
        // the unspoken setup of the following expectation is that checkin cards
        // are not returned from ES at the beginning of the items array, but
        // should end up sorted there by the response massager.
        expect(firstTenItems.every(isCheckinCardItem))
        expect(doc.items[0].enumerationChronology[0]).to.equal('Vol. 100 No. 44 (Dec. 30, 2024)')
        const lastIndex = doc.items.length - 1
        expect(doc.items[lastIndex].enumerationChronology[0]).to.equal('Aug. 9-Oct. 25 (1930)')
        done()
      })
    })
  })
  describe('GET electronicResources', () => {
    it('returns e resources array and count without aeon links', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14332438'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.electronicResources.length).to.equal(4)
        expect(doc.electronicResources.filter((resource) => resource.url.includes('aeon')).length).to.equal(0)
        expect(doc.items.filter((item) => item.aeonUrl).length).to.equal(1)
        done()
      })
    })
  })
  describe('GET numItemsMatched', () => {
    it('returns numItemsMatched for blank bib query', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.numItemsMatched).to.be.greaterThan(800)
        done()
      })
    })
    it('returns numItemsMatched excluding check in card items for blank bib query with merge_checkin_card_items false', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?merge_checkin_card_items=false'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.numItemsMatched).to.be.greaterThan(704)
        done()
      })
    })
    it('returns numItemsMatched for bib with location query', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?item_location=loc:mal82'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.numItemsMatched).to.be.greaterThan(572)
        done()
      })
    })
    it('returns numItemsMatched for blank bib query merge check in cards', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?merge_checkin_card_items=true'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.numItemsMatched).to.be.greaterThan(800)
        done()
      })
    })
    it('returns numItemsMatched for query merge check in cards and status:na', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10833141?merge_checkin_card_items=true&item_status=status:na'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        // Note: When updating fixtures, the following value may change. The
        // most important thing is that it appears to filter out items from the
        // 800+ item bib:
        expect(doc.numItemsMatched).to.be.lessThan(80)
        done()
      })
    })
    it('does nothing to a search query with no hits', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources?q=fladeedle'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.numItemsMatched).to.equal(undefined)
        done()
      })
    })
    describe('electronic resources changes count', () => {
      it('decrements - e resources, no item filters', (done) => {
        const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14937001'
        request.get(url, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          expect(doc.numItemsMatched).to.equal(4)
          done()
        })
      })
      it('decrements - item_format is same as bib material type', (done) => {
        const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14937001?item_format=Text'
        request.get(url, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          expect(doc.numItemsMatched).to.equal(4)
          done()
        })
      })
      it('item_format is same as bib material type, multiple filters', (done) => {
        const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14937001?item_format=Text&item_location=loc:mal92'
        request.get(url, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          expect(doc.numItemsMatched).to.equal(1)
          done()
        })
      })
      it('item_format is same as bib material type, multiple format filters', (done) => {
        const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14937001?item_format=Text,anotherformat'
        request.get(url, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          expect(doc.numItemsMatched).to.equal(4)
          done()
        })
      })
      it('item_format is same as bib material type, multiple format filters', (done) => {
        const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b14937001?item_format=Text,anotherformat'
        request.get(url, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          expect(doc.numItemsMatched).to.equal(4)
          done()
        })
      })
    })
  })

  describe('GET physRequestable', function () {
    it('sets physRequestable:true for partner recap items without recap codes in ES', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/cb4032259'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.items[0].physRequestable).to.equal(true)
        done()
      })
    })

    it('sets physRequestable:true for nypl recap items', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b10628074'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.items[0].physRequestable).to.equal(true)
        done()
      })
    })

    it('sets requestable:false for items without barcodes', (done) => {
      const url = global.TEST_BASE_URL + '/api/v0.1/discovery/resources/b13966759-i16894049'
      request.get(url, (err, res, body) => {
        if (err) throw err
        const doc = JSON.parse(body)
        expect(doc.items[0].requestable[0]).to.equal(false)
        done()
      })
    })
  })

  describe('GET sample resources', function () {
    sampleResources.forEach(function (spec) {
      it(`Resource ${spec.id} has correct type ${spec.type}`, function (done) {
        request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${spec.id}`, function (err, response, body) {
          if (err) throw err
          assert.equal(200, response.statusCode)
          const doc = JSON.parse(body)
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

        const doc = JSON.parse(body)

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

        assert(doc.itemAggregations)

        assert.deepEqual(doc.format, [{ '@id': 'a', prefLabel: 'Book/Text' }])

        // assert.deepEqual(doc.collection, [])

        done()
      })
    })

    it('Resource data for b21088122-i32086897 are what we expect', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b11984689-i29976055`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        const doc = JSON.parse(body)

        expect(doc.items).to.be.a('array')

        expect(doc.items.length).to.equal(1)
        expect(doc.items[0].uri).to.equal('i29976055')

        expect(doc.hasItemVolumes).to.equal(true)
        expect(doc.hasItemDates).to.equal(true)

        expect(doc.itemAggregations)
        done()
      })
    })

    it('extracts identifiers in ENTITY style if indexed as entity', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10011374`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        const doc = JSON.parse(body)

        // At writing the fixture has both `identifier` and `identifierV2` fields,
        // so it will choose the latter (which are stored as entities)
        // Here we confirm the entities are converted to urn:
        expect(doc.identifier).to.be.a('array')

        // Check bnum:
        const bnum = doc.identifier
          .filter((ent) => ent['@type'] === 'nypl:Bnumber')
          .pop()
        expect(bnum).to.be.a('object')
        expect(bnum['@value']).to.equal('10011374')

        // Check lccn:
        const lccn = doc.identifier
          .filter((ent) => ent['@type'] === 'bf:Lccn')
          .pop()
        expect(lccn).to.be.a('object')
        expect(lccn['@value']).to.equal('35038534')

        // Also check an item's identifiers:
        expect(doc.items).to.be.a('array')

        // Select an item of interest
        const itemOfInterest = doc.items.filter((item) => item.uri === 'i10005487')[0]

        expect(itemOfInterest).to.be.a('object')
        expect(itemOfInterest.identifier).to.be.a('array')

        // Check item callnum:
        const callnum = itemOfInterest.identifier
          .filter((ent) => ent['@type'] === 'bf:ShelfMark')
          .pop()
        expect(callnum).to.be.a('object')
        expect(callnum['@value']).to.equal('JFE 86-498 v. 1')

        // Check item barcode:
        const barcode = itemOfInterest.identifier
          .filter((ent) => ent['@type'] === 'bf:Barcode')
          .pop()
        expect(barcode).to.be.a('object')
        expect(barcode['@value']).to.equal('33433057532081')

        done()
      })
    })

    it('extracts identifiers in urn style if indexed in urn style', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10022950`, function (err, response, body) {
        if (err) throw err

        expect(response.statusCode).to.equal(200)

        const doc = JSON.parse(body)

        expect(doc.identifier).to.be.a('array')

        // Check bnum:
        const bnum = doc.identifier
          .filter((ent) => ent['@type'] === 'nypl:Bnumber')
          .pop()
        expect(bnum).to.be.a('object')
        expect(bnum['@value']).to.equal('10022950')

        // Check item callnum:
        const callnum = doc.items[0].identifier
          .filter((ent) => ent['@type'] === 'bf:ShelfMark')
          .pop()
        expect(callnum).to.be.a('object')
        expect(callnum['@value']).to.equal('*PGZ 81-1452')

        done()
      })
    })
  })

  describe('GET resources fields', function () {
    it('Resource data for b10022734 are what we expect', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10022734`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        const doc = JSON.parse(body)

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

        const doc = JSON.parse(body)

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

        const doc = JSON.parse(body)

        assert(doc.supplementaryContent)
        assert(doc.supplementaryContent.length > 0)
        assert.equal(doc.supplementaryContent[0].label, 'Finding aid')
        assert.equal(doc.supplementaryContent[0]['@type'], 'nypl:SupplementaryContent')
        assert.equal(doc.supplementaryContent[0].url, 'http://archives.nypl.org/scm/20936')

        done()
      })
    })

    // skipping this test for now since we don't have have the option to include electronic resources in items
    it.skip('returns item.electronicLocator', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10011374?items_size=5`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        const doc = JSON.parse(body)

        const eItem = doc.items.find((item) => item.electronicLocator)
        assert(eItem.electronicLocator.length > 0)
        assert.equal(eItem.electronicLocator[0]['@type'], 'nypl:ElectronicLocation')
        assert.equal(eItem.electronicLocator[0].url, 'http://hdl.handle.net/2027/nyp.33433057532081')
        assert.equal(eItem.electronicLocator[0].label, 'Full text available via HathiTrust--v. 1')

        done()
      })
    })

    it('should have electronicResources property', function (done) {
      request.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b10011374?items_size=5`, function (err, response, body) {
        if (err) throw err

        assert.equal(200, response.statusCode)

        const doc = JSON.parse(body)

        const eItem = doc.electronicResources
        expect(eItem).to.deep.equal([
          {
            url: 'http://hdl.handle.net/2027/nyp.33433057532081',
            prefLabel: 'Full text available via HathiTrust--v. 1'
          },
          {
            prefLabel: 'Full text available via HathiTrust--v. 2',
            url: 'http://hdl.handle.net/2027/nyp.33433057532339'
          },
          {
            prefLabel: 'Full text available via HathiTrust--v. 1',
            url: 'http://hdl.handle.net/2027/nyp.33433067332548'
          },
          {
            prefLabel: 'Full text available via HathiTrust--v. 2',
            url: 'http://hdl.handle.net/2027/nyp.33433067332555'
          }
        ])

        done()
      })
    })
  })

  describe('GET resources search', function () {
    let searchAllUrl = null

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

    it(`Resource search all (${searchAllUrl}) returns lots o' results (10K max)`, function (done) {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err

        const doc = JSON.parse(body)

        assert(doc.totalResults === 10000)
        assert.equal(50, doc.itemListElement.length)

        done()
      })
    })

    it('Resource search all page 1 has requested page size', function (done) {
      request.get(`${searchAllUrl}&per_page=42`, function (err, response, body) {
        if (err) throw err
        const doc = JSON.parse(body)

        assert.equal(42, doc.itemListElement.length)

        done()
      })
    })

    it('Resource search pagination is consistent', function (done) {
      request.get(`${searchAllUrl}&page=101&per_page=1`, function (err, response, body) {
        if (err) throw err
        const doc = JSON.parse(body)
        const item101 = doc.itemListElement[0].result

        // Now fetch same item in different way:
        request.get(`${searchAllUrl}&page=2&per_page=100`, function (err, response, body) {
          if (err) throw err
          const doc = JSON.parse(body)
          assert.equal(doc.itemListElement[0].result['@id'], item101['@id'])
          done()
        })
      })
    })

    describe('Filter by format', function () {
      it('returns only items with format a', (done) => {
        const format = 'a'
        request.get(`${searchAllUrl}&filters[format]=${format}`, (err, res, body) => {
          if (err) throw err
          const doc = JSON.parse(body)
          // Ensure we received results
          expect(doc.totalResults).to.be.above(1)
          // Ensure each result...
          const allItemsHaveformat = doc.itemListElement.every((element) => {
            // .. has some items that ...
            return element.format?.[0]['@id'] === 'format:' + format
          })
          // For the result to match, only one item needs to match:
          expect(allItemsHaveformat)
        })
        done()
      })
    })

    describe('Filter by holdingLocation', function () {
      ;['loc:rc2ma', 'loc:mal92'].forEach((holdingLocationId) => {
        it('returns only bibs with items in holdingLocation ' + holdingLocationId, function (done) {
          // Fetch all results:
          request.get(`${searchAllUrl}&filters[holdingLocation]=${holdingLocationId}`, function (err, response, body) {
            if (err) throw err

            const doc = JSON.parse(body)
            // Ensure we received results
            expect(doc.totalResults).to.be.above(1)

            // Ensure each result...
            doc.itemListElement.forEach((element) => {
              // .. has some items that ...
              const itemsWithHoldingLocation = element.result.items.filter((item) => {
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

    it('Ensure filters[dateBefore] produces only those items whose dates precede/overlap given date', function () {
      const datesBefore = [1800, 1900, 2000]

      return Promise.all(
        datesBefore.map((dateBefore) => {
          const nextUrl = `${searchAllUrl}&filters[dateBefore]=${dateBefore}`

          return new Promise((resolve, reject) => {
            request.get(nextUrl, function (err, response, body) {
              if (err) throw err

              const doc = JSON.parse(body)

              // Ensure bib dates fall below dateBefore for each result
              doc.itemListElement.forEach((item) => {
                const itemDates = [item.result.dateStartYear, item.result.dateEndYear]
                  .filter((d) => typeof d === 'number')
                  // Ensure dates are ascending (some cataloging reverses them):
                  .sort((a, b) => a - b)
                // The bib's start date should be <= dateBefore
                expect(itemDates[0]).to.be.at.most(dateBefore)
              })

              return resolve()
            })
          })
        })
      )
    })

    it('Ensure filters[dateAfter] produces only those items whose dates follow/overlap given date', function () {
      const datesAfter = [1800, 1900, 2000]

      return Promise.all(
        datesAfter.map((dateAfter) => {
          const nextUrl = `${searchAllUrl}&filters[dateAfter]=${dateAfter}`

          return new Promise((resolve, reject) => {
            request.get(nextUrl, function (err, response, body) {
              if (err) throw err

              const doc = JSON.parse(body)

              // Ensure bib dates follow dateAfter for each result
              doc.itemListElement.forEach((item) => {
                const itemDates = [item.result.dateStartYear, item.result.dateEndYear]
                  .filter((d) => typeof d === 'number')
                  // Ensure dates are ascending (some cataloging reverses them):
                  .sort((a, b) => a - b)
                // The bib's end date (or start date if it doesn't have an end date)
                // should be >= dateAfter
                expect(itemDates[itemDates.length - 1]).to.be.at.least(dateAfter)
              })

              return resolve()
            })
          })
        })
      )
    })

    it('Ensure a chain of added filters reduces resultset correctly', function (done) {
      const dates = [1984, 1985]

      let nextUrl = searchAllUrl + 'toast'

      // Fetch all results:
      request.get(nextUrl, function (err, response, body) {
        if (err) throw err

        const doc = JSON.parse(body)
        // Establish ALL count:
        let prevTotal = doc.totalResults

        // Next, add filter on the first date (objects whose start/end date range include 1984)
        nextUrl = `${nextUrl}&filters[dateAfter]=${dates[0]}`
        return request.get(nextUrl, function (err, response, body) {
          if (err) throw err

          const doc = JSON.parse(body)

          // Ensure count decreased:
          expect(doc.totalResults).to.be.below(prevTotal)

          // Ensure bib dates overlap dateAfter for each result
          doc.itemListElement.forEach((item) => {
            const itemDates = [item.result.dateStartYear, item.result.dateEndYear]
              .filter((d) => typeof d === 'number')
              // Ensure dates are ascending (some cataloging reverses them):
              .sort((a, b) => a - b)
            // The bib's end date (or start date if it doesn't have an end date)
            // should be >= the start of the queried date range:
            expect(itemDates[itemDates.length - 1]).to.be.at.least(dates[0])
          })

          prevTotal = doc.totalResults

          // Now filter on both dates (adding objects whose date range includes 1985)
          nextUrl += `&filters[dateBefore]=${dates[1]}`
          return request.get(nextUrl, function (err, response, body) {
            if (err) throw err
            const doc = JSON.parse(body)
            // Ensure count decreased:
            expect(doc.totalResults).to.be.below(prevTotal)

            // Ensure bib dates overlap date range
            doc.itemListElement.forEach((item) => {
              const itemDates = [item.result.dateStartYear, item.result.dateEndYear]
                .filter((d) => typeof d === 'number')
                // Ensure dates are ascending (some cataloging reverses them):
                .sort((a, b) => a - b)
              // The bib's end date (or start date if it doesn't have an end date)
              // should be >= the start of the queried date range:
              expect(itemDates[itemDates.length - 1]).to.be.at.least(dates[0])
              // The bib's start date should be <= the end of the queried date range:
              expect(itemDates[0]).to.be.at.most(dates[1])
            })

            prevTotal = doc.totalResults

            // Now add language filter:
            nextUrl += '&filters[language]=lang:kan'
            return request.get(nextUrl, function (err, response, body) {
              if (err) throw err

              const doc = JSON.parse(body)

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

  describe('search_scope=standard_number', function () {
    let searchAllUrl = null

    before(() => {
      searchAllUrl = `${global.TEST_BASE_URL}/api/v0.1/discovery/resources?search_scope=standard_number&q=`
    })

    it('empty search returns status code 200', function () {
      request.get(searchAllUrl, function (err, response, body) {
        if (err) throw err

        return assert.equal(200, response.statusCode)
      })
    })

    let standardNumbers = [
      'b22144813',
      '9790001138673', // Should match `identifierV2[@type=bf:Lccn].value`
      '"ISBN -- 020"',
      '44455533322211'
    ]
    standardNumbers.forEach((num) => {
      it(`should match b22144813 by "Standard Numbers": "${num}"`, function (done) {
        request.get(searchAllUrl + num, function (err, response, body) {
          if (err) throw err

          assert.equal(200, response.statusCode)

          const results = JSON.parse(body)
          expect(results.totalResults).to.be.at.least(1)
          expect(results.itemListElement).to.be.a('array')
          expect(results.itemListElement[0]).to.be.a('object')
          expect(results.itemListElement[0].result).to.be.a('object')
          expect(results.itemListElement[0].result['@type']).to.include('nypl:Item')
          expect(results.itemListElement.map((item) => item.result['@id'])).to.include('res:b22144813')

          done()
        })
      })
    })
    standardNumbers = [
      'b22144813',
      '"Q-TAG (852 8b q tag.  Staff call in bib.)"', // Should match `identifierV2[@type=bf:ShelfMark].value`
      '"ISSN -- 022"', // Should match `identifierV2[@type=bf:Issn].value`
      '"LCCN -- 010"', // Should match `identifierV2[@type=bf:Lccn].value`
      '"ISBN -- 020 $z"',
      // Following should match untyped identifiers in `identifier`
      '"GPO Item number. -- 074"',
      '"Sudoc no.  -- 086"',
      '"Standard number (old RLIN, etc.) -- 035"',
      '"Publisher no. -- 028 02  "',
      '"Report number. -- 027"'
    ]
    standardNumbers.forEach((num) => {
      it(`should match b12082323 by "Standard Numbers": "${num}"`, function (done) {
        request.get(searchAllUrl + num, function (err, response, body) {
          if (err) throw err

          assert.equal(200, response.statusCode)

          const results = JSON.parse(body)
          expect(results.totalResults).to.be.at.least(1)
          expect(results.itemListElement).to.be.a('array')
          expect(results.itemListElement[0]).to.be.a('object')
          expect(results.itemListElement[0].result).to.be.a('object')
          expect(results.itemListElement[0].result['@type']).to.include('nypl:Item')
          expect(results.itemListElement.map((el) => el.result['@id'])).to.include('res:b22144813')

          done()
        })
      })
    })

    // Some bnumbers and the item callnumbers that should produce them:
    const bnumStandardNumberMapping = {
      b11826883: 'JQL 08-18',
      b13627363: 'VPS (Rice, E. Cats, cats, & cats)',
      b12423567: 'AN (Campanella) (Cyprian, E. S. Vita Th. Campanellae)',
      // TODO: Temporarily disable until shelfmark.keywordLowercased is in production index:
      // pb1717: 'SF445.5 .C378',
      b13565153: 'VQG (Loudon, J. W. Gardening for ladies. 1854)',
      b12709113: 'IWD (Washington co.) (Shrader, F. B. History of Washington county, Nebraska)'
    }

    Object.keys(bnumStandardNumberMapping).forEach((bnum) => {
      const q = bnumStandardNumberMapping[bnum]

      it(`should match ${bnum} by "Standard Numbers": "${q}"`, function (done) {
        request.get(searchAllUrl + q, function (err, response, body) {
          if (err) throw err

          assert.equal(200, response.statusCode)

          const results = JSON.parse(body)
          expect(results.totalResults).to.be.at.least(1)
          expect(results.itemListElement).to.be.a('array')
          expect(results.itemListElement[0]).to.be.a('object')
          expect(results.itemListElement[0].result).to.be.a('object')
          expect(results.itemListElement[0].result['@type']).to.include('nypl:Item')
          expect(results.itemListElement.some((el) => el.result['@id'] === `res:${bnum}`))

          done()
        })
      })
    })
  })
})
