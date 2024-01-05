const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const { isItemNyplOwned } = require('./ownership_determination')
const { isInRecap, isInSchomburg, getSchomburgDeliveryInfo } = require('./util')
const logger = require('./logger')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          let deliveryInfo
          const itemIsInRecap = isInRecap(item)
          let physRequestableCriteria
          const hasRecapCustomerCode = item.recapCustomerCode && item.recapCustomerCode[0]
          if (itemIsInRecap && !hasRecapCustomerCode) {
            // recap items missing codes should default to true for phys and edd
            // requestable.
            physRequestableCriteria = 'Missing customer code'
            deliveryInfo = { eddRequestable: true, deliveryLocation: [''] }
          } else if (itemIsInRecap && hasRecapCustomerCode) {
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
            physRequestableCriteria = `${deliveryInfo.deliveryLocation &&
              deliveryInfo.deliveryLocation.length || 0} delivery locations.`
          } else if (!itemIsInRecap) {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
            physRequestableCriteria = `${deliveryInfo.deliveryLocation &&
              deliveryInfo.deliveryLocation.length || 0} delivery locations.`
          }
          if (isInSchomburg(item)) {
            deliveryInfo = getSchomburgDeliveryInfo(item, deliveryInfo)
          }
          item.eddRequestable = !!deliveryInfo.eddRequestable
          item.physRequestable = !!(deliveryInfo.deliveryLocation &&
            deliveryInfo.deliveryLocation.length)
          item.specRequestable = !!item.aeonUrl
          // items without barcodes should not be requestable
          const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))
          if (isItemNyplOwned(item) && !hasBarcode) {
            physRequestableCriteria = 'NYPL item missing barcode'
            item.physRequestable = false
          }
          logger.debug(`item ${item.uri}: `, { physRequestable: item.physRequestable, physRequestableCriteria })
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
