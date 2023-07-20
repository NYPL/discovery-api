const isItemNyplOwned = require('./ownership_determination').isItemNyplOwned
const requestability = require('./requestability_determination')
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const recapCustomerCodes = require('@nypl/nypl-core-objects')('by-recap-customer-code')
const Feature = require('../lib/feature')
const { isInRecap } = require('./util')

class RequestabilityResolver {
  constructor (responseReceived, request) {
    this.elasticSearchResponse = responseReceived
    this.request = request
  }

  fixItemRequestability () {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        let bibUri = hit._source.uri
        if (item.electronicLocator) return item
        item.eddRequestable = false
        item.physRequestable = false
        item.specRequestable = false
        item.requestable = [false]
        const _isInRecap = isInRecap(item)
        item.eddRequestable = this._fixEddRequestability(item, _isInRecap)
        item.physRequestable = this._fixPhysRequestability(item, _isInRecap, bibUri)
        item.specRequestable = !!item.aeonUrl
        item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
      })
    }
    return this.elasticSearchResponse
  }

  _fixEddRequestability (item, isInRecap) {
    // If it's a recap item, determine edd based on code
    if (isInRecap) {
      // Some of our items are in RC locations that we mark not EDD requestable
      // regardless of what the customer code would otherwise say:
      if (isItemNyplOwned(item) && !requestability.requestableBasedOnHoldingLocation(item)) {
        return false
      }
      if (Array.isArray(item.recapCustomerCode) && recapCustomerCodes[item.recapCustomerCode[0]]) {
        return recapCustomerCodes[item.recapCustomerCode[0]].eddRequestable
        // If item has not been indexed with recap code, default to true.
        // Accurate eddRequestable is fetched once user clicks request item.
      } else {
        return true
      }
    }
    if (Feature.enabled('no-on-site-edd', this.request)) {
      return false
    } else {
      // If it's onsite, use different criteria
      return DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)
    }
  }

  _fixPhysRequestability (item, isInRecap, bibUri) {
    // this is not the final physRequestable value. True physRequestable is
    // only determined on the front end via the vars closed_locations and
    // open_locations.
    if (isInRecap) {
      // Some of our items are in RC locations that we mark not requestable
      // regardless of what the customer code would otherwise say:
      if (isItemNyplOwned(item) && !requestability.requestableBasedOnHoldingLocation(item)) {
        return false
      }
      // many recap items are not indexed with recap customer codes
      // first, check if there is a customer code and determine
      // requestability based on that.
      if (item.recapCustomerCode && item.recapCustomerCode[0]) {
        const deliveryLocations = DeliveryLocationsResolver.deliveryLocationsByRecapCustomerCode(item.recapCustomerCode)
        return deliveryLocations && deliveryLocations.length > 0
        // If there is no customer code, recap items default to physRequestable: true
      } else {
        return true
      }
    } else {
      let deliveryLocations
      let overriddenByXaCriteria
      if (item.m2CustomerCode && item.m2CustomerCode[0]) {
        overriddenByXaCriteria = item.m2CustomerCode[0] === 'XA' &&
          process.env.ROMCOM_MAX_XA_BNUM &&
          bibUri &&
          bibUri > process.env.ROMCOM_MAX_XA_BNUM
        deliveryLocations = DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode(item.m2CustomerCode)
      }
      const requestableByHoldingLocation = requestability.requestableBasedOnHoldingLocation(item)
      return requestableByHoldingLocation && !!deliveryLocations && deliveryLocations.length > 0 && !overriddenByXaCriteria
    }
  }
}  // end class

module.exports = RequestabilityResolver
