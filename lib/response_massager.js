const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options) {
    const availabilityResolver = new AvailabilityResolver(this.elasticSearchResponse)
    const updatedWithAvailability = availabilityResolver.responseWithUpdatedAvailability(request, options)
    const updatedWithNewestLabels = updatedWithAvailability.then((resp) => {
      const locationLabelUpdater = new LocationLabelUpdater(resp)
      return locationLabelUpdater.responseWithUpdatedLabels()
    }).then((resp) => {
      return parallelFieldsExtractor(resp)
    })
    return updatedWithNewestLabels
  }
}

module.exports = ResponseMassager
