const fixItemRequestability = require('../lib/requestability_resolver')
const elasticSearchResponse = require('./fixtures/elastic_search_response.js')
const specRequestableElasticSearchResponse = require('./fixtures/specRequestable/specRequestable-es-response.js')
const eddElasticSearchResponse = require('./fixtures/edd_elastic_search_response')
const noBarcodeResponse = require('./fixtures/no_barcode_es_response')
const noRecapResponse = require('./fixtures/no_recap_response')

describe('RequestabilityResolver', () => {
  describe('fixItemRequestability', function () {
    let NyplResponse
    before(() => {
      NyplResponse = elasticSearchResponse.fakeElasticSearchResponseNyplItem()
    })
    it('sets physRequestable false for items with no barcodes', () => {
      const noBarcode = noBarcodeResponse()
      const resp = fixItemRequestability(noBarcode)
      expect(resp.hits.hits[0]._source.items.every((item) => item.physRequestable === false)).to.equal(true)
    })

    it('will set requestable to false for an item not found in ReCAP', function () {
      const indexedButNotAvailableInSCSBURI = 'i22566485'

      const response = fixItemRequestability(NyplResponse)

      // Find the modified item in the response:
      const theItem = response.hits.hits[0]._source.items.find((item) => item.uri === indexedButNotAvailableInSCSBURI)
      // Our fakeRESTClient said its barcode doesn't exist, so it should appear with `requestable` false
      expect(theItem.requestable[0]).to.equal(false)
    })

    it('marks ReCAP items that are in requestable locations and have delivery locations as physRequestable', function () {
      const response = fixItemRequestability(NyplResponse)

      const items = response.hits.hits[0]._source.items

      const availableItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(availableItem.physRequestable).to.equal(true)
      expect(availableItem.eddRequestable).to.equal(true)
    })

    it('marks ReCAP items that are in unrequestable locations as not eddRequestable nor physRequestable', function () {
      const response = fixItemRequestability(NyplResponse)

      const items = response.hits.hits[0]._source.items

      const availableItem = items.find((item) => {
        return item.uri === 'i102836649-unrequestable'
      })
      expect(availableItem.physRequestable).to.equal(false)
      expect(availableItem.eddRequestable).to.equal(false)
    })

    it('marks SCSB Available items (that are indexed as Not Available) as requestable', function () {
      const response = fixItemRequestability(NyplResponse)

      const items = response.hits.hits[0]._source.items

      // A ReCAP item with Discovery status 'Not Available', but SCSB
      // status 'Available' should be made requestable:
      const availableItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(availableItem.requestable[0]).to.equal(true)
    })

    it('marks SCSB Not-Available items as requestable', function () {
      const response = fixItemRequestability(NyplResponse)

      const items = response.hits.hits[0]._source.items

      // A ReCAP item with SCSB status 'Not Available' should be made not
      // requestable:
      const notAvailableItem = items.find((item) => item.uri === 'i102836649')
      expect(notAvailableItem.requestable[0]).to.equal(true)
    })

    it('marks on-site (loc:scff2) Available items as requestable', function () {
      const response = fixItemRequestability(NyplResponse)
      const items = response.hits.hits[0]._source.items

      const availableItem = items.find((item) => item.uri === 'i10283665')
      expect(availableItem.requestable[0]).to.equal(true)
    })

    it('marks on-site location with physRequestable false and eddRequestable', function () {
      const response = fixItemRequestability(NyplResponse)
      const items = response.hits.hits[0]._source.items

      const notAvailableItem = items.find((item) => item.uri === 'i10283665777')
      expect(notAvailableItem.requestable[0]).to.equal(true)
    })

    describe('On-site edd requestability', function () {
      let esResponse
      beforeEach(() => {
        const item = {
          uri: 'i10283665',
          accessMessage: [{ id: 'accessMessage:1' }],
          catalogItemType: [{ id: 'catalogItemType:2' }],
          status: [{ id: 'status:a' }],
          holdingLocation: [{ id: 'loc:scff2' }],
          identifier: ['urn:barcode:33433058338470']
        }
        esResponse = { hits: { hits: [{ _source: { items: [item] } }] } }
      })

      it('an item that meets all on-site edd criteria is edd-requestable', function () {
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)
      })
      it('an item with access message "-" still eddRequestable:', () => {
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:-' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)
      })

      it('Item with access message "1" still eddRequestable', () => {
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:1' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)
      })
      it('Item with status "na" still eddRequestable', () => {
        esResponse.hits.hits[0]._source.items[0].status = [
          { id: 'status:na' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(true)
      })

      it('an item that with an invalid accessMessage is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].accessMessage = [
          { id: 'accessMessage:b' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })

      it('an item that with an invalid catalogItemType is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].catalogItemType = [
          { id: 'catalogItemType:13' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })

      it('an item that with an invalid status is no longer edd-requestable', function () {
        esResponse.hits.hits[0]._source.items[0].status = [
          { id: 'status:o' }
        ]
        const updatedItem = fixItemRequestability(esResponse)
          .hits.hits[0]._source.items[0]
        expect(updatedItem.eddRequestable).to.equal(false)
      })
    })
  })

  describe('Special collections items', function () {
    it('marks items as specRequestable when there is an aeonURL present', function () {
      const response = fixItemRequestability(specRequestableElasticSearchResponse())

      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i22566485')
      expect(specRequestableItem.specRequestable).to.equal(true)
    })

    it('marks items as specRequestable when there is a special collectionAccessType designation', function () {
      const response = fixItemRequestability(specRequestableElasticSearchResponse())

      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i10283665777')
      expect(specRequestableItem.specRequestable).to.equal(true)
    })

    it('leaves item as specRequestable false when there is no finding aid, aeon url, or special holding location', () => {
      const response = fixItemRequestability(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
      const items = response.hits.hits[0]._source.items

      const specRequestableItem = items.find((item) => item.uri === 'i10283665')
      expect(specRequestableItem.specRequestable).to.equal(false)
    })
  })

  describe('eddRequestable items', function () {
    const eddResponse = eddElasticSearchResponse()
    it('marks items eddRequestable:true when its reCAP code is listed as such in nypl-core', () => {
      const response = fixItemRequestability(eddResponse)
      const items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NA (eddRequestable = true)
      const eddItem = items.find((item) => {
        return item.uri === 'i102836649'
      })
      expect(eddItem.eddRequestable).to.equal(true)
    })

    it('marks items eddRequestable:false when its reCAP code is listed as such in nypl-core', () => {
      const response = fixItemRequestability(eddResponse)
      const items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NC (eddRequestable = false)
      const nonEddItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(nonEddItem.eddRequestable).to.equal(false)
    })
  })

  describe('Missing recapCustomerCode', function () {
    let response
    let resolved
    let items
    beforeEach(() => {
      response = noRecapResponse.fakeElasticSearchResponseNyplItem()
      resolved = fixItemRequestability(response)
      items = resolved.hits.hits[0]._source.items
    })

    it('marks edd and physical requestability true for requestableLocationNoRecapCode', function () {
      const requestableLocationNoRecapCode = items.find((item) => {
        return item.uri === 'i102836649'
      })

      expect(requestableLocationNoRecapCode.physRequestable).to.equal(true)
      expect(requestableLocationNoRecapCode.eddRequestable).to.equal(true)
    })
    it('marks edd and physical requestability false for nonrequestableLocationNoRecapCode', function () {
      const nonRequestableLocationNoRecapCode = items.find((item) => {
        return item.uri === 'i102836659'
      })
      expect(nonRequestableLocationNoRecapCode.physRequestable).to.equal(false)
      expect(nonRequestableLocationNoRecapCode.eddRequestable).to.equal(false)
    })
  })
})
