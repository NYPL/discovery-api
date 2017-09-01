const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse () {
    let availabilityResolver = new AvailabilityResolver(this.elasticSearchResponse)
    let updatedWithAvailability = availabilityResolver.responseWithUpdatedAvailability()
    let updatedWithNewestLabels = updatedWithAvailability.then((resp) => {
      let locationLabelUpdater = new LocationLabelUpdater(resp)
      return locationLabelUpdater.responseWithUpdatedLabels()
    })
    return updatedWithNewestLabels
  }
}

module.exports = ResponseMassager
