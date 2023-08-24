const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

<<<<<<< HEAD
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
<<<<<<< HEAD
      .then((response) => new FulfillmentResolver(response).responseWithFulfillment())
<<<<<<< HEAD
=======
      .then((response) => RequestabilityResolver.fixItemRequestability(response)
        .fixItemRequestability(response, request))
>>>>>>> parent of 3cdf370... minor refactor
=======
>>>>>>> parent of 256ef27... Merge pull request #324 from NYPL/main
=======
  massagedResponse (request, options) {
    const updatedWithParallelFields = parallelFieldsExtractor(this.elasticSearchResponse)
    const availabilityResolver = new AvailabilityResolver(updatedWithParallelFields)
    const updatedWithAvailability = availabilityResolver.responseWithUpdatedAvailability(request, options)
    const updatedWithNewestLabels = updatedWithAvailability.then((resp) => {
      const locationLabelUpdater = new LocationLabelUpdater(resp)
      return locationLabelUpdater.responseWithUpdatedLabels()
    })
    return updatedWithNewestLabels
>>>>>>> parent of 9227c23... Merge pull request #303 from NYPL/main
  }
}

module.exports = ResponseMassager
