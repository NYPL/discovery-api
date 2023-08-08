const DeliveryLocationsResolver = require('./delivery-locations-resolver')
class RequestabilityResolver {
  static fixItemRequestability (elasticSearchResponse) {
    elasticSearchResponse.hits.hits
      .map((hit) => {
        let bnum = hit._source.uri
        hit._source.items = hit._source.items.map((item) => {
          if (item.electronicLocator) return item
          let deliveryInfo
          if (item.recapCustomerCode && item.recapCustomerCode[0]) {
            deliveryInfo = DeliveryLocationsResolver.getRecapDeliveryInfo(item)
          } else {
            deliveryInfo = DeliveryLocationsResolver.getOnsiteDeliveryInfo(item)
          }
          item.eddRequestable = !!deliveryInfo.eddRequestable
          item.physRequestable = !!(deliveryInfo.deliveryLocation &&
            deliveryInfo.deliveryLocation.length &&
            this.requestableByBatchingLimit(item, bnum))
          item.specRequestable = !!item.aeonUrl
          item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
          return item
        })
      })
    return elasticSearchResponse
  }

  static requestableByBatchingLimit (item, bnum) {
    const holdingLocationCode = item.holdingLocation && item.holdingLocation[0].id
    // this check only applies to a specific set of onsite nypl owned bibs
    if ((item.m2CustomerCode && item.m2CustomerCode[0]) ||
      (item.recapCustomerCode && item.recapCustomerCode[0])) {
      return true
    }
    const isMal82 = holdingLocationCode.includes('mal82')
    const bnumExceedsLimit = bnum > process.env.MAX_MAL82_BNUM
    return !(isMal82 && bnumExceedsLimit)
  }
}

module.exports = RequestabilityResolver
