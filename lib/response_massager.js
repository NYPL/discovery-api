const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options) {
    const updatedWithParallelFields = parallelFieldsExtractor(this.elasticSearchResponse)
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
