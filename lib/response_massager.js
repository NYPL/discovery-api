const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options = {}) {
    // Rename parallel fields:
    const updatedWithParallelFields = parallelFieldsExtractor(this.elasticSearchResponse)

    // Update ES response with updated availability from SCSB:
    const updatedWithAvailability = (new AvailabilityResolver(updatedWithParallelFields))
      .responseWithUpdatedAvailability(request, options)

    // Update ES response with NYPL-Core labels:
    return updatedWithAvailability
      .then((resp) => {
        return (new LocationLabelUpdater(resp))
          .responseWithUpdatedLabels()
      })
  }
}

module.exports = ResponseMassager
