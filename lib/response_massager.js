const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')
const util = require('../lib/util')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options) {
    let updatedWithNumItemsMatched = this.elasticSearchResponse
    if (util.checkForNestedHitsAndSource(updatedWithNumItemsMatched)) {
      updatedWithNumItemsMatched.hits.hits[0]._source.numItemsMatched = [this.elasticSearchResponse.hits.hits[0].inner_hits.items.hits.total]
    }
    const updatedWithParallelFields = parallelFieldsExtractor(updatedWithNumItemsMatched)
    const availabilityResolver = new AvailabilityResolver(updatedWithParallelFields)
    const updatedWithAvailability = availabilityResolver.responseWithUpdatedAvailability(request, options)
    const updatedWithNewestLabels = updatedWithAvailability.then((resp) => {
      const locationLabelUpdater = new LocationLabelUpdater(resp)
      return locationLabelUpdater.responseWithUpdatedLabels()
    })
    return updatedWithNewestLabels
  }
}

module.exports = ResponseMassager
