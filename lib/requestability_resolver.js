const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const { isItemNyplOwned } = require('./ownership_determination')
const { isInRecap } = require('./util')
const logger = require('./logger')

class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .forEach((hit) => {
        const parentBibHasFindingAid = !!hit._source.supplementaryContent?.find((el) => el.label.toLowerCase() === 'finding aid')
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          let deliveryInfo
          const itemIsInRecap = isInRecap(item)
          let physRequestableCriteria
          const hasRecapCustomerCode = item.recapCustomerCode?.[0]
          if (itemIsInRecap) {
            // recap items missing codes should default to true for phys and edd
            // requestable, unless it has a non-requestable holding location
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
            physRequestableCriteria = hasRecapCustomerCode
              ? `${(deliveryInfo.deliveryLocation?.length) || 0} delivery locations.`
              : 'Missing customer code'
          } else if (!itemIsInRecap) {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
            physRequestableCriteria = `${(deliveryInfo.deliveryLocation?.length) || 0} delivery locations.`
          }
          item.specRequestable = this.buildSpecRequestable(item, parentBibHasFindingAid)
          item.physRequestable = !!deliveryInfo.deliveryLocation?.length
          item.eddRequestable = !!deliveryInfo.eddRequestable && !item.specRequestable
          // items without barcodes should not be requestable
          const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))
          if (isItemNyplOwned(item) && !hasBarcode) {
            physRequestableCriteria = 'NYPL item missing barcode'
            item.physRequestable = false
          }
          if (item.specRequestable && item.physRequestable) {
            item.physRequestable = false
            physRequestableCriteria = 'specRequestable overrides physRequestable location'
          }
          logger.debug(`item ${item.uri}: `, { physRequestable: item.physRequestable, physRequestableCriteria })
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }

  static buildSpecRequestable (item, parentBibHasFindingAid) {
    const holdingLocation = DeliveryLocationsResolver.extractLocationCode(item)
    const nyplCoreLocation = DeliveryLocationsResolver.nyplCoreLocation(holdingLocation)
    const isSpecialCollectionsOnlyAccessType = !!(nyplCoreLocation?.collectionAccessType === 'special')
    return !!item.aeonUrl || parentBibHasFindingAid || isSpecialCollectionsOnlyAccessType
  }
}

module.exports = RequestabilityResolver
