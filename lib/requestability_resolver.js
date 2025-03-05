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
          const itemIsInRecap = isInRecap(item)
          const deliveryInfo = itemIsInRecap
            ? DeliveryLocationsResolver.getRecapDeliveryInfo(item)
            : DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)

          item.specRequestable = this.buildSpecRequestable(item, parentBibHasFindingAid)
          item.physRequestable = this.buildPhysRequestable(item, deliveryInfo)
          item.eddRequestable = !!deliveryInfo.eddRequestable && !item.specRequestable
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }

  static buildPhysRequestable (item, deliveryInfo) {
    let physRequestableCriteria
    let physRequestable
    const hasRecapCustomerCode = item.recapCustomerCode?.[0]
    const itemIsInRecapMissingRecapCustomerCode = isInRecap(item) && !hasRecapCustomerCode
    // recap items missing codes should default to true for phys and edd
    // requestable, unless it has a non-requestable holding location
    if (itemIsInRecapMissingRecapCustomerCode) physRequestableCriteria = 'Missing customer code'
    if (deliveryInfo.deliveryLocation?.length > 0) physRequestableCriteria = `${(deliveryInfo.deliveryLocation?.length) || 0} delivery locations.`
    physRequestable = itemIsInRecapMissingRecapCustomerCode || !!deliveryInfo.deliveryLocation?.length
    // items without barcodes should not be requestable
    const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))
    if (isItemNyplOwned(item) && !hasBarcode) {
      physRequestableCriteria = 'NYPL item missing barcode'
      physRequestable = false
    }
    logger.debug(`item ${item.uri}: `, { physRequestable: item.physRequestable, physRequestableCriteria })

    return physRequestable
  }

  static buildSpecRequestable (item, parentBibHasFindingAid) {
    const holdingLocation = DeliveryLocationsResolver.extractLocationCode(item)
    const nyplCoreLocation = DeliveryLocationsResolver.nyplCoreLocation(holdingLocation)
    const isSpecialCollectionsOnlyAccessType = !!(nyplCoreLocation?.collectionAccessType === 'special')
    return !!item.aeonUrl || parentBibHasFindingAid || isSpecialCollectionsOnlyAccessType
  }
}

module.exports = RequestabilityResolver
