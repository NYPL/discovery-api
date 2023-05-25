const { isInRecap } = require('./util')

class FulfillmentResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }
  responseWithFulfillment () {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        if (item.electronicLocator) return item
        const _isInRecap = isInRecap(item)
        item.physFulfillment = this._determinePhysFulfillment(item, _isInRecap, false)
        item.eddFulfillment = this._determineEddFulfillment(item, _isInRecap, true)
        return item
      })
    }
    return this.elasticSearchResponse
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

  _fulfillmentPrefix (item, _isInRecap) {
    return _isInRecap
      ? this._recapLocation(item.recapDepository)
      : this._onsiteLocation(item.holdingLocation && item.holdingLocation.id)
  }

  _determinePhysFulfillment (item, _isInRecap) {
    let fulfillmentPrefix = this._fulfillmentPrefix(item, _isInRecap)
    let fulfillmentSuffix
    if (item.physRequestable && _isInRecap) {
      fulfillmentSuffix = '-offsite'
    } else if (item.physRequestable && !_isInRecap) {
      fulfillmentSuffix = '-onsite'
    }
    if (fulfillmentSuffix && fulfillmentPrefix) return 'fulfillment:' + fulfillmentPrefix + fulfillmentSuffix
  }

  _determineEddFulfillment (item, _isInRecap) {
    let fulfillmentPrefix = this._fulfillmentPrefix(item, _isInRecap)
    if (item.eddRequestable && fulfillmentPrefix) {
      return 'fulfillment:' + fulfillmentPrefix + '-edd'
    }
  }
}

module.exports = FulfillmentResolver
