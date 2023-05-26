const expect = require('chai').expect

const FulfillmentResolver = require('../lib/fulfillment_resolver')

describe('FulfillmentResolver', () => {
  describe('_onsiteLocation', () => {
    it('returns sc', () => {
      expect(FulfillmentResolver.prototype._onsiteLocation('sc')).to.equal('sc')
    })
    it('returns sasb', () => {
      expect(FulfillmentResolver.prototype._onsiteLocation('ma')).to.equal('sasb')
    })
    it('returns lpa', () => {
      expect(FulfillmentResolver.prototype._onsiteLocation('my')).to.equal('lpa')
    })
    it('returns undefined', () => {
      expect(FulfillmentResolver.prototype._onsiteLocation('llol')).to.equal(undefined)
    })
  })
  describe('_recapLocation', () => {
    it('returns hd', () => {
      expect(FulfillmentResolver.prototype._recapLocation('hd')).to.equal('hd')
    })
    it('returns recap', () => {
      expect(FulfillmentResolver.prototype._recapLocation('not hd')).to.equal('recap')
    })
  })
  describe('_determinePhysFulfillment', () => {
    it('returns undefined when item is not physRequestable', () => {
      expect(FulfillmentResolver.prototype._determinePhysFulfillment({}))
        .to.equal(undefined)
    })
    it('returns correctly for hd item', () => {
      const item = {physRequestable: true, recapDepository: 'hd'}
      expect(FulfillmentResolver.prototype._determinePhysFulfillment(item, true))
        .to.equal('fulfillment:hd-offsite')
    })
    it('returns correctly for onsite item', () => {
      const item = {physRequestable: true, holdingLocation: [{id: 'loc:my'}]}
      expect(FulfillmentResolver.prototype._determinePhysFulfillment(item, false))
        .to.equal('fulfillment:lpa-onsite')
    })
    it('returns undefined when fulfillmentPrefix is undefined', () => {
      const item = {physRequestable: true, holdingLocation: [{id: 'loc:xyz'}]}
      expect(FulfillmentResolver.prototype._determinePhysFulfillment(item, false))
        .to.equal(undefined)
    })
  })
  describe('_determineEddFulfillment', () => {
    it('returns undefined when item is not eddRequestable', () => {
      expect(FulfillmentResolver.prototype._determineEddFulfillment({}))
        .to.equal(undefined)
    })
    it('returns correctly for recap item', () => {
      const item = {eddRequestable: true, recapDepository: 'recap'}
      expect(FulfillmentResolver.prototype._determineEddFulfillment(item, true))
        .to.equal('fulfillment:recap-edd')
    })
    it('returns correctly for onsite item', () => {
      const item = {eddRequestable: true, holdingLocation: [{id: 'loc:sc'}]}
      expect(FulfillmentResolver.prototype._determineEddFulfillment(item, false))
        .to.equal('fulfillment:sc-edd')
    })
    it('returns undefined when fulfillmentPrefix is undefined', () => {
      const item = {eddRequestable: true, holdingLocation: [{id: 'loc:xyz'}]}
      expect(FulfillmentResolver.prototype._determineEddFulfillment(item, false))
        .to.equal(undefined)
    })
  })
})
