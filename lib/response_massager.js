const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')
const addNumItemsMatched = require('./item-match-numerator')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options = {}) {
    let response = this.elasticSearchResponse

    // For findByUri calls, copy numItemsMatched into document so it's included
    // in response:
    response = addNumItemsMatched(response, request, options.electronicResourcesAlreadyRemoved)

    // Rename parallel fields:
    response = parallelFieldsExtractor(response)

    // Update ES response with updated availability from SCSB:
    const updatedWithAvailability = (new AvailabilityResolver(response))
      .responseWithUpdatedAvailability(request, options)

    // Update ES response with NYPL-Core labels:
    return updatedWithAvailability
      .then((response) => {
        return (new LocationLabelUpdater(response))
          .responseWithUpdatedLabels()
      })
  }
}

module.exports = ResponseMassager
