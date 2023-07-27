const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')
const { isAeonUrl } = require('../lib/util')
const FulfillmentResolver = require('./fulfillment_resolver')
const RequestabilityResolver = require('./requestability_resolver')
// const addNumItemsMatched = require('./item-match-numerator')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  /**
   *  Given a ES response,
   *  if it contains hits that have "items" or "electronicResources" inner_hits,
   *  reassigns those hits to ".items" and ".electronicResources" so that later
   *  code can access them as if that's where they were indexed that way.
   *
   *  Also copies ".total" properties into convenient places for serialization.
   */
  processInnerHitsProperties (response) {
    response.hits.hits.forEach((hit) => {
      // Process "items" inner_hits
      if (hit.inner_hits && hit.inner_hits.items) {
        // Reassign items inner_hits to .items
        hit._source.items = hit.inner_hits.items.hits.hits.map((itemHit) => itemHit._source)

        // Grab the "items" inner_hits total as numItemsMatched:
        hit._source.numItemsMatched = [hit.inner_hits.items.hits.total]

        // If response includes an "allItems" inner_hits query, use the total
        // from that to get numItemsTotal. If "allItems inner_hits query
        // doesn't exist (because no item filters are in play) just use "items"
        // inner_hits query:
        const unfilteredItems = (hit.inner_hits.allItems || hit.inner_hits.items)
        hit._source.numItemsTotal = [unfilteredItems.hits.total]
      }
      // Process "electronicResources" inner_hits
      if (hit.inner_hits && hit.inner_hits.electronicResources) {
        // If record doesn't have indexed electronicResources...
        if (!hit._source.electronicResources || hit._source.electronicResource.length === 0) {
          // Gather up all records in the electronicResources inner_hit,
          // collect all of the electronicLocator values
          // and save the resulting array to .electronicResources:
          hit._source.electronicResources = hit.inner_hits.electronicResources.hits.hits
            .map((resource) => resource._source.electronicLocator)
            .reduce((acc, el) => acc.concat(el), [])
            .filter((resource) => !isAeonUrl(resource.url))
          hit._source.numElectronicResources = [hit._source.electronicResources.length]
        }
      }
      delete hit['inner_hits']
    })

    return response
  }

  massagedResponse (request, options = {}) {
    let response = this.elasticSearchResponse

    // Inspect response inner_hits queries and move properties around to ease
    // serialization:
    response = this.processInnerHitsProperties(response)

    // Rename parallel fields:
    response = parallelFieldsExtractor(response)

    // Update ES response with updated availability from SCSB:
    const updatedWithAvailability = (new AvailabilityResolver(response))
      .responseWithUpdatedAvailability(options)

    // Update ES response with NYPL-Core labels:
    return updatedWithAvailability
      .then((response) => {
        return (new LocationLabelUpdater(response))
          .responseWithUpdatedLabels()
      })
      .then((response) => new FulfillmentResolver(response).responseWithFulfillment())
      .then((response) => RequestabilityResolver.fixItemRequestability(response)
        .fixItemRequestability(response, request))
  }
}

module.exports = ResponseMassager
