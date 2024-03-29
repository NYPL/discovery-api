const RequestabilityResolver = require('../lib/requestability_resolver')
const elasticSearchResponse = require('./fixtures/elastic_search_response.js')
const specRequestableElasticSearchResponse = require('./fixtures/specRequestable-es-response')
const eddElasticSearchResponse = require('./fixtures/edd_elastic_search_response')
const noBarcodeResponse = require('./fixtures/no_barcode_es_response')
// const { scff3Microfiche, invalidTypeScff3, scff2Microfilm, invalidTypeScff2 } = require('./fixtures/schomburg.js')
const { scff3Microfiche, invalidTypeScff3, invalidTypeScff2 } = require('./fixtures/schomburg.js')

describe('RequestabilityResolver', () => {
  describe('Schomburg requestability', () => {
    it('returns physRequestable true for scff3 microfiche', () => {
      const resp = RequestabilityResolver.fixItemRequestability(scff3Microfiche)
      const item = resp.hits.hits[0]._source.items[0]
      expect(item.physRequestable).to.be.true
    })
    it('returns physRequestable false for invalid item type, scff3', () => {
      const resp = RequestabilityResolver.fixItemRequestability(invalidTypeScff3)
      const item = resp.hits.hits[0]._source.items[0]
      expect(item.physRequestable).to.be.false
    })
    // it('returns physRequestable true for scff2 microfilm', () => {
    //   const resp = RequestabilityResolver.fixItemRequestability(scff2Microfilm)
    //   const item = resp.hits.hits[0]._source.items[0]
    //   expect(item.physRequestable).to.be.true
    // })
    it('returns physRequestable false for invalid item type, scff2', () => {
      const resp = RequestabilityResolver.fixItemRequestability(invalidTypeScff2)
      const item = resp.hits.hits[0]._source.items[0]
      expect(item.physRequestable).to.be.false
    })
  })
  describe('fixItemRequestability', function () {
    const NyplResponse = elasticSearchResponse.fakeElasticSearchResponseNyplItem()
    it('sets physRequestable false for items with no barcodes', () => {
      const noBarcode = noBarcodeResponse()
      const resp = RequestabilityResolver.fixItemRequestability(noBarcode)
      expect(resp.hits.hits[0]._source.items.every((item) => item.physRequestable === false)).to.be.true
    })
    it('will set requestable to false for an item not found in ReCAP', function () {
      let indexedButNotAvailableInSCSBURI = 'i22566485'

      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)

      // Find the modified item in the response:
      let theItem = response.hits.hits[0]._source.items.find((item) => item.uri === indexedButNotAvailableInSCSBURI)
      // Our fakeRESTClient said its barcode doesn't exist, so it should appear with `requestable` false
      expect(theItem.requestable[0]).to.equal(false)
    })

    it('marks ReCAP items that are in requestable locations and have delivery locations as physRequestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)

      var items = response.hits.hits[0]._source.items

      var availableItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(availableItem.physRequestable).to.equal(true)
      expect(availableItem.eddRequestable).to.equal(true)
    })

    it('marks ReCAP items that are in unrequestable locations as not eddRequestable nor physRequestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)

      var items = response.hits.hits[0]._source.items

      var availableItem = items.find((item) => {
        return item.uri === 'i102836649-unrequestable'
      })
      expect(availableItem.physRequestable).to.equal(false)
      expect(availableItem.eddRequestable).to.equal(false)
    })

    it('marks SCSB Available items (that are indexed as Not Available) as requestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)

      var items = response.hits.hits[0]._source.items

      // A ReCAP item with Discovery status 'Not Available', but SCSB
      // status 'Available' should be made requestable:
      var availableItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(availableItem.requestable[0]).to.equal(true)
    })

    it('marks SCSB Not-Available items as requestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)

      var items = response.hits.hits[0]._source.items

      // A ReCAP item with SCSB status 'Not Available' should be made not
      // requestable:
      var notAvailableItem = items.find((item) => item.uri === 'i102836649')
      expect(notAvailableItem.requestable[0]).to.equal(true)
    })

    it('marks on-site (loc:scff2) Available items as requestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)
      var items = response.hits.hits[0]._source.items

      var availableItem = items.find((item) => item.uri === 'i10283665')
      expect(availableItem.requestable[0]).to.equal(true)
    })

    it('marks on-site location with physRequestable false and eddRequestable', function () {
      const response = RequestabilityResolver.fixItemRequestability(NyplResponse)
      var items = response.hits.hits[0]._source.items

      var notAvailableItem = items.find((item) => item.uri === 'i10283665777')
      expect(notAvailableItem.requestable[0]).to.equal(true)
    })

    describe('On-site edd requestability', function () {
      let esResponse

      beforeEach(() => {
        const item = {
          uri: 'i10283665',
          accessMessage: [ { id: 'accessMessage:1' } ],
          catalogItemType: [ { id: 'catalogItemType:2' } ],
          status: [ { id: 'status:a' } ],
          holdingLocation: [ { id: 'loc:scff2' } ],
          identifier: [ 'urn:barcode:33433058338470' ]
        }
        esResponse = { hits: { hits: [ { _source: { items: [item] } } ] } }
      })

      it('an item that meets all on-site edd criteria is edd-requestable', function () {
        let updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)

        // Access message '-' still eddRequestable:
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:-' }
        ]
        updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)

        // Access message '1' still eddRequestable:
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:1' }
        ]
        updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)

        // Status 'na' still eddRequestable:
        esResponse.hits.hits[0]._source.items[0].status = [
          { id: 'status:na' }
        ]
        updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)
      })

      it('an item that with an invalid accessMessage is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:b' }
        ]
        const updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })

      it('an item that with an invalid catalogItemType is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].catalogItemType = [
          { id: 'catalogItemType:13' }
        ]
        const updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })

      it('an item that with an invalid status is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].status = [
          { id: 'status:o' }
        ]
        const updatedItem = RequestabilityResolver.fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })
    })
  })

  describe('Special collections items', function () {
    it('marks items as specRequestable when there is an aeonURL present', function () {
      const response = RequestabilityResolver.fixItemRequestability(specRequestableElasticSearchResponse())

      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i22566485')
      expect(specRequestableItem.specRequestable).to.equal(true)
    })

    it('marks items as not specRequestable when there is no aeonURL present', function () {
      const response = RequestabilityResolver.fixItemRequestability(specRequestableElasticSearchResponse())

      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i10283665')
      expect(specRequestableItem.specRequestable).to.equal(false)
    })
  })

  describe('eddRequestable items', function () {
    const eddResponse = eddElasticSearchResponse()
    it('marks items eddRequestable:true when its reCAP code is listed as such in nypl-core', () => {
      const response = RequestabilityResolver.fixItemRequestability(eddResponse)
      var items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NA (eddRequestable = true)
      var eddItem = items.find((item) => {
        return item.uri === 'i102836649'
      })
      expect(eddItem.eddRequestable).to.equal(true)
    })

    it('marks items eddRequestable:false when its reCAP code is listed as such in nypl-core', () => {
      const response = RequestabilityResolver.fixItemRequestability(eddResponse)
      var items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NC (eddRequestable = false)
      var nonEddItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(nonEddItem.eddRequestable).to.equal(false)
    })
  })
})
