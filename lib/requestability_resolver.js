const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const { isItemNyplOwned } = require('./ownership_determination')
const { isInRecap } = require('./util')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          let deliveryInfo
          const itemIsInRecap = isInRecap(item)
          if (itemIsInRecap && !item.recapCustomerCode) {
            // recap items missing codes should default to true for phys and edd
            // requestable.
            deliveryInfo = {eddRequestable: true, deliveryLocation: ['']}
          }
          if (itemIsInRecap && item.recapCustomerCode && item.recapCustomerCode[0]) {
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
          }
          if (!itemIsInRecap) {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
          }
          const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\d+/.test(identifier))
          item.eddRequestable = !!deliveryInfo.eddRequestable
          item.physRequestable = !!(deliveryInfo.deliveryLocation &&
            deliveryInfo.deliveryLocation.length)
          item.specRequestable = !!item.aeonUrl
          // items without barcodes should not be requestable
          if (isItemNyplOwned(item) && !hasBarcode) item.physRequestable = false

          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
