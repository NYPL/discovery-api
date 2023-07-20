const sinon = require('sinon')

const RequestabilityResolver = require('../lib/requestability_resolver')
const DeliveryLocationsResolver = require('../lib/delivery-locations-resolver.js')
const requestabilityDetermination = require('../lib/requestability_determination')

const elasticSearchResponse = require('./fixtures/elastic_search_response.js')
const specRequestableElasticSearchResponse = require('./fixtures/specRequestable-es-response')
const eddElasticSearchResponse = require('./fixtures/edd_elastic_search_response')

describe('RequestabilityResolver', () => {
  it('will set requestable to false for an item not found in ReCAP', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    let indexedButNotAvailableInSCSBURI = 'i22566485'

    const modifiedResponse = requestabilityResolver.fixItemRequestability()
    // Find the modified item in the response:
    let theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => item.uri === indexedButNotAvailableInSCSBURI)
    // Our fakeRESTClient said its barcode doesn't exist, so it should appear with `requestable` false
    expect(theItem.requestable[0]).to.equal(false)
  })
  it('marks ReCAP items that are in requestable locations and have delivery locations as physRequestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    var availableItem = items.find((item) => {
      return item.uri === 'i10283664'
    })
    expect(availableItem.physRequestable).to.equal(true)
    expect(availableItem.eddRequestable).to.equal(true)
  })

  it('marks ReCAP items that are in unrequestable locations as not eddRequestable nor physRequestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    var availableItem = items.find((item) => {
      return item.uri === 'i102836649-unrequestable'
    })
    expect(availableItem.physRequestable).to.equal(false)
    expect(availableItem.eddRequestable).to.equal(false)
  })

  it('marks SCSB Available items (that are indexed as Not Available) as requestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    // A ReCAP item with Discovery status 'Not Available', but SCSB
    // status 'Available' should be made requestable:
    var availableItem = items.find((item) => {
      return item.uri === 'i10283664'
    })
    expect(availableItem.requestable[0]).to.equal(true)
  })

  it('marks SCSB Not-Available items as requestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    // A ReCAP item with SCSB status 'Not Available' should be made not
    // requestable:
    var notAvailableItem = items.find((item) => item.uri === 'i102836649')
    expect(notAvailableItem.requestable[0]).to.equal(true)
  })

  it('marks on-site (loc:scff2) Available items as requestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    var availableItem = items.find((item) => item.uri === 'i10283665')
    expect(availableItem.requestable[0]).to.equal(true)
  })

  it('marks on-site (loc:scff2) Not-Available items as not requestable', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    var notAvailableItem = items.find((item) => item.uri === 'i10283665777')
    expect(notAvailableItem.requestable[0]).to.equal(false)
  })

  it('marks on-site (loc:scff2) Available items as not requestable if "no-on-site-edd" feature flag is set', function () {
    let requestabilityResolver = new RequestabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    process.env.FEATURES = 'no-on-site-edd'
    const response = requestabilityResolver.fixItemRequestability()
    var items = response.hits.hits[0]._source.items

    var availableItem = items.find((item) => item.uri === 'i10283665')
    expect(availableItem.eddRequestable).to.equal(false)
  })

  describe('_fixPhysRequestablility', () => {
    let deliveryResolverStub
    let holdingLocationStub
    beforeEach(() => {
      deliveryResolverStub = sinon.stub(DeliveryLocationsResolver, 'deliveryLocationsByM2CustomerCode')
      holdingLocationStub = sinon.stub(requestabilityDetermination, 'requestableBasedOnHoldingLocation')
    })
    afterEach(() => {
      holdingLocationStub.restore()
      deliveryResolverStub.restore()
      process.env.ROMCOM_MAX_XA_BNUM = null
    })

    it('returns true for item with requestable m2 customer code', () => {
      const item = { m2CustomerCode: ['vk'] }
      deliveryResolverStub.returns(['loc:ma82, loc:456'])
      holdingLocationStub.returns(true)
      expect(RequestabilityResolver.prototype._fixPhysRequestability(item, false)).to.equal(true)
    })
    it('returns false for item with no m2 customer code', () => {
      const item = { notM2: ['ab'] }
      holdingLocationStub.returns(false)
      expect(RequestabilityResolver.prototype._fixPhysRequestability(item, false)).to.equal(false)
      expect(deliveryResolverStub.called).to.equal(false)
    })
    it('returns false for item with m2 customer code that has no delivery locations returned', () => {
      const item = { m2CustomerCode: ['vk'] }
      deliveryResolverStub.returns([])
      holdingLocationStub.returns(true)
      expect(RequestabilityResolver.prototype._fixPhysRequestability(item, false)).to.equal(false)
    })
    it('overrides physRequestability for XA bnumbers when env variable is set', () => {
      process.env.ROMCOM_MAX_XA_BNUM = 'b000000'
      const item = { m2CustomerCode: ['XA'] }
      deliveryResolverStub.returns(['loc:ma82, loc:456'])
      holdingLocationStub.returns(true)
      expect(RequestabilityResolver.prototype._fixPhysRequestability(item, false, 'b000001')).to.equal(false)
    })
    it('does not override physRequestability for XA bnumbers when env variable is not set', () => {
      const item = { m2CustomerCode: ['XA'] }
      deliveryResolverStub.returns(['loc:ma82, loc:456'])
      holdingLocationStub.returns(true)
      expect(RequestabilityResolver.prototype._fixPhysRequestability(item, false, 'b000001')).to.equal(true)
    })
  })

  describe('Special collections items', function () {
    const requestability_resolver = new RequestabilityResolver(specRequestableElasticSearchResponse())
    it('marks items as specRequestable when there is an aeonURL present', function () {
      const response = requestability_resolver.fixItemRequestability()
      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i22566485')
      expect(specRequestableItem.specRequestable).to.equal(true)
    })
    it('marks items as not specRequestable when there is no aeonURL present', function () {
      const response = requestability_resolver.fixItemRequestability()
      const items = response.hits.hits[0]._source.items
      const specRequestableItem = items.find((item) => item.uri === 'i10283665')
      expect(specRequestableItem.specRequestable).to.equal(false)
    })
  })
  describe('eddRequestable items', function () {
    const requestability_resolver = new RequestabilityResolver(eddElasticSearchResponse())
    it('marks items eddRequestable:true when its reCAP code is listed as such in nypl-core', () => {
      const response = requestability_resolver.fixItemRequestability()
      var items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NA (eddRequestable = true)
      var eddItem = items.find((item) => {
        return item.uri === 'i102836649'
      })
      expect(eddItem.eddRequestable).to.equal(true)
    })
    it('marks items eddRequestable:false when its reCAP code is listed as such in nypl-core', () => {
      const response = requestability_resolver.fixItemRequestability()
      var items = response.hits.hits[0]._source.items

      // A ReCAP item with customer code NC (eddRequestable = false)
      var nonEddItem = items.find((item) => {
        return item.uri === 'i10283664'
      })
      expect(nonEddItem.eddRequestable).to.equal(false)
    })
  })
})
