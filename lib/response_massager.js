const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')
const addNumItemsMatched = require('./addNumItemsMatched')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options) {
    let updatedWithNumItemsMatched = addNumItemsMatched(this.elasticSearchResponse, request)
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
