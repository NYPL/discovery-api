const DeliveryLocationsResolver = require('./delivery-locations-resolver')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        hit._source.items = hit._source.items.map(function (item) {
          if (item.electronicLocator) return item
          let deliveryInfo
          if (item.recapCustomerCode && item.recapCustomerCode[0]) {
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
          } else {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
          }

          item.eddRequestable = !!deliveryInfo.eddRequestable
          item.physRequestable = !!(deliveryInfo.deliveryLocation &&
            deliveryInfo.deliveryLocation.length)
          item.specRequestable = !!item.aeonUrl
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
