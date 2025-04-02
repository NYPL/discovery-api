const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const { isItemNyplOwned } = require('./ownership_determination')
const { isInRecap } = require('./util')
const logger = require('./logger')

class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .forEach((hit) => {
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          const itemIsInRecap = isInRecap(item)
          const deliveryInfo = itemIsInRecap
            ? DeliveryLocationsResolver.getRecapDeliveryInfo(item)
            : DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
          const numDeliveryLocations = deliveryInfo.deliveryLocation?.length
          item.specRequestable = this.buildSpecRequestable(item)
          item.physRequestable = this.buildPhysRequestable(item, numDeliveryLocations)
          item.eddRequestable = !!deliveryInfo.eddRequestable && !item.specRequestable
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }

  static buildPhysRequestable (item, numDeliveryLocations) {
    function logPhysRequestableInfo (physRequestable, criteria) {
      logger.debug(`item ${item.uri}: physRequestable ${physRequestable}. Criteria: ${criteria}`)
    }
    let physRequestableCriteria
    let physRequestable
    const hasRecapCustomerCode = item.recapCustomerCode?.[0]
    const itemIsInRecapMissingRecapCustomerCode = isInRecap(item) && !hasRecapCustomerCode
    // items without barcodes should not be requestable
    const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))

    if (isItemNyplOwned(item) && !hasBarcode) {
      physRequestable = false
      physRequestableCriteria = 'NYPL item missing barcode'
      logPhysRequestableInfo(physRequestable, physRequestableCriteria)
      return physRequestable
    }
    if (isItemNyplOwned(item) && !DeliveryLocationsResolver.requestableBasedOnHoldingLocation(item)) {
      physRequestableCriteria = 'Unrequestable holding location'
      physRequestable = false
      logPhysRequestableInfo(physRequestable, physRequestableCriteria)
      return physRequestable
    }
    if (itemIsInRecapMissingRecapCustomerCode) {
      // recap items missing codes should default to true for phys and edd
      // requestable, if it has a requestable holding location.
      physRequestable = true
      physRequestableCriteria = 'Missing customer code'
      logPhysRequestableInfo(physRequestable, physRequestableCriteria)
      return physRequestable
    }
    if (numDeliveryLocations === 0) {
      physRequestableCriteria = 'No delivery locations.'
      physRequestable = false
      logPhysRequestableInfo(physRequestable, physRequestableCriteria)
      return physRequestable
    }
    if (numDeliveryLocations > 0) {
      physRequestableCriteria = `${numDeliveryLocations} delivery locations.`
      physRequestable = true
      logPhysRequestableInfo(physRequestable, physRequestableCriteria)

      return physRequestable
    }
  }

  static buildSpecRequestable (item) {
    const holdingLocation = DeliveryLocationsResolver.extractLocationCode(item)
    const nyplCoreLocation = DeliveryLocationsResolver.nyplCoreLocation(holdingLocation)
    const isSpecialCollectionsOnlyAccessType = !!(nyplCoreLocation?.collectionAccessType === 'special')
    return !!item.aeonUrl || isSpecialCollectionsOnlyAccessType
  }
}

module.exports = RequestabilityResolver
