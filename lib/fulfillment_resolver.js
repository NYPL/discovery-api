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
        const physFulfillment = this._determinePhysFulfillment(item, _isInRecap)
        const eddFulfillment = this._determineEddFulfillment(item, _isInRecap)
        item.physFulfillment = physFulfillment && {'@id': physFulfillment}
        item.eddFulfillment = eddFulfillment && {'@id': eddFulfillment}
        return item
      })
    }
    return this.elasticSearchResponse
  }

  _onsiteLocation (locationCode) {
    if (!locationCode) return
    if (locationCode.startsWith('sc')) return 'sc'
    else if (locationCode.startsWith('ma')) return 'sasb'
    else if (locationCode.startsWith('my')) return 'lpa'
  }

  _recapLocation (recapDepository) {
    if (recapDepository !== 'hd') return 'recap'
    else return 'hd'
  }

  _fulfillmentPrefix (item, _isInRecap) {
    const locationCode = item.holdingLocation && item.holdingLocation[0] && item.holdingLocation[0].id.split(':')[1]
    return _isInRecap
      ? this._recapLocation(item.recapDepository)
      : this._onsiteLocation(locationCode)
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
