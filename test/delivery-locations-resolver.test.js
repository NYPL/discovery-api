const DeliveryLocationsResolver = require('../lib/delivery-locations-resolver')
const Location = require('../lib/models/Location')
const Item = require('../lib/models/Item')
const sampleItems = require('./fixtures/sample-items')

describe('eddRequestableByOnSiteCriteria', function () {
  let item

  beforeEach(function () {
    item = {
      identifier: [
        'urn:bnum:b11995345',
        'urn:bnum:b11995322',
        'urn:barcode:33433036864449'
      ],
      uri: 'i12227153',
      holdingLocation: [
        {
          id: 'loc:scff2',
          label: 'Schomburg Center - Research & Reference'
        }
      ],
      accessMessage: [
        { label: 'Use in library', id: 'accessMessage:1' }
      ],
      catalogItemType: [
        { label: 'book, limited circ, MaRLI', id: 'catalogItemType:55' }
      ],
      status: [
        { label: 'Available ', id: 'status:a' }
      ]
    }
  })

  it('will return false for ReCAP materials', function () {
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(sampleItems.offsiteNypl)).to.equal(false)
  })

  it('will return true for on-site item meeting all criteria', function () {
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
  })

  it('will return false for on-site item failing location check', function () {
    item.holdingLocation[0].id = 'loc:rc'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
  })

  it('will return true for on-site item failing status check', function () {
    item.status[0].id = 'status:na'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
  })

  it('will return false for on-site item failing catalogItemType check', function () {
    item.catalogItemType[0].id = 'catalogItemType:56'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
  })

  it('will return false for on-site item failing accessMessage check', function () {
    item.accessMessage[0].id = 'accessMessage:2'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
  })

  it('will return true for on-site Schomburg if it\'s not microfilm', function () {
    item.holdingLocation[0].id = 'loc:scff2'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
  })

  it('will return false for microfilm', function () {
    item.catalogItemType[0].id = 'catalogItemType:6'
    item.holdingLocation[0].id = 'loc:mabm2'
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
  })

  it('will return false for on-site item that lacks a barcode', function () {
    // Remove barcode identifier:
    item.identifier = item.identifier.filter((value) => !/^urn:barcode:/.test(value))
    expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
  })
})

describe('deliveryLocationsByM2CustomerCode', () => {
  const unrequestableM2CustomerCode = 'EM'
  it('returns undefined for unrequestable code', () =>
    expect(new Location({ m2CustomerCode: unrequestableM2CustomerCode }).deliveryLocationsByM2CustomerCode).to.equal(undefined)
  )
  it('return delivery location for requestable code', () => {
    expect(new Location({ m2CustomerCode: 'NH' }).deliveryLocationsByM2CustomerCode.length).to.not.equal(0)
  })
})

describe('requestableBasedOnHoldingLocation', function () {
  // These expectations rely on the requestability of these locations being
  // somewhat static, which has been generally true
  it('identifies a non-requestable location', function () {
    expect(
      DeliveryLocationsResolver.requestableBasedOnHoldingLocation({
        holdingLocation: [{ id: 'loc:rccd8' }]
      })
    ).to.equal(false)
  })
  it('identifies a requestable location', function () {
    expect(
      DeliveryLocationsResolver.requestableBasedOnHoldingLocation({
        holdingLocation: [{ id: 'loc:rcpm2' }]
      })
    ).to.equal(true)
  })
})
describe('Recap delivery and edd', function () {
  it('returns empty deliveryLocation and eddRequestable false based on holding location when missing recapCustomerCode', function () {
    const item = new Item({
      holdingLocation: [{ id: 'loc:rccd8' }],
      uri: 'i14747243'
    })
    expect(item.deliveryLocation).to.equal(undefined)
    expect(item.eddRequestable).to.equal(false)
  })

  it('returns empty string delivery location and eddRequestable true based on holding location when missing recapCustomerCode', function () {
    const item = new Item({
      holdingLocation: [{ id: 'loc:rcpm2' }],
      uri: 'i14747243'
    })
    expect(item.deliveryLocation).to.equal(undefined)
    // is there a reason why we wanted to return an empty string here?
    // expect(resolved.deliveryLocation.length).to.equal(1)
    // expect(resolved.deliveryLocation[0]).to.equal('')
    expect(item.eddRequestable).to.equal(true)
  })
})
