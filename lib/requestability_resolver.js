const DeliveryLocationsResolver = require('./delivery-locations-resolver')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        hit._source.items = hit._source.items.map(function (item) {
          if (item.electronicLocator) return item
          if (item.recapCustomerCode && item.recapCustomerCode[0]) {
            item = DeliveryLocationsResolver.attachRecapDeliveryInfo(item, item.recapCustomerCode[0])
          } else {
            item = DeliveryLocationsResolver.attachOnsiteDeliveryInfo(item, item.recapCustomerCode)
          }
          item.deliveryLocation = DeliveryLocationsResolver.formatLocations(item.deliveryLocation)

          item.eddRequestable = !!item.eddRequestable
          item.physRequestable = !!item.deliveryLocation.length
          item.specRequestable = false
          item.specRequestable = !!item.aeonUrl
          item.requestable = [false]
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }
}

module.exports = RequestabilityResolver
