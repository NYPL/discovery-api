const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const { isItemNyplOwned } = require('./ownership_determination')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          let deliveryInfo
          if (item.recapCustomerCode && item.recapCustomerCode[0]) {
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
          } else {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
          }
          const hasBarcode = (item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\d+/.test(identifier))
          item.eddRequestable = !!deliveryInfo.eddRequestable
          item.physRequestable = !!(deliveryInfo.deliveryLocation &&
            deliveryInfo.deliveryLocation.length)
          item.specRequestable = !!item.aeonUrl
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          // temporary stopgap until we fix hold request page on the front end
          // to not rely on barcodes for delivery locations:
          if (isItemNyplOwned(item) && !hasBarcode) item.physRequestable = false
          return item
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
