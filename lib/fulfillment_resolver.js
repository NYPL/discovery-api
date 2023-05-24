const { isInRecap } = require('./util')

class FulfillmentResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }
  responseWithFulfillmentEntities () {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        if (item.electronicLocator) return item
        const _isInRecap = isInRecap(item)
        item.physFulfillment = this._determinePhysFulfillment(item, _isInRecap)
        item.eddFulfillment = this._determineEddFulfillment(item, _isInRecap)
        return item
      })
    }
  }

  _onsiteLocation (onsiteLocationId) {
    if (onsiteLocationId === 'sc') return 'sc'
    else if (onsiteLocationId === 'ma') return 'sasb'
    else if (onsiteLocationId === 'my') return 'lpa'
  }

  _recapLocation (recapDepository) {
    if (recapDepository !== 'hd') return 'recap'
    else return 'hd'
  }

  _determinePhysFulfillment (item, _isInRecap) {
    let fulfillmentInfo
    if (item.physRequestable) {
      if (_isInRecap) {
        fulfillmentInfo = this._recapLocation(item.recapDepository) + '-offsite'
      } else {
        const onsiteLocation = this._onsiteLocation(item.holdingLocation.id)
        if (onsiteLocation) fulfillmentInfo = onsiteLocation + '-onsite'
      }
    }
    if (fulfillmentInfo) return 'fulfillment:' + fulfillmentInfo
  }

  _determineEddFulfillment (item, _isInRecap) {
    let fulfillmentInfo
    if (item.eddRequestable) {
      if (_isInRecap) {
        fulfillmentInfo = this._recapLocation(item.recapDepository)
      } else {
        const onsiteLocation = this._onsiteLocation(item.holdingLocation.id)
        if (onsiteLocation) fulfillmentInfo = onsiteLocation
      }
    }
    if (fulfillmentInfo) return 'fulfillment:' + fulfillmentInfo + '-edd'
  }

}

module.exports = FulfillmentResolver
