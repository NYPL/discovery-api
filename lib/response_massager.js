const LocationLabelUpdater = require('./location_label_updater')
const AvailabilityResolver = require('./availability_resolver.js')
const parallelFieldsExtractor = require('./parallel-fields-extractor')
const util = require('../lib/util')

class ResponseMassager {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  massagedResponse (request, options = {}) {
    let updatedWithNumItemsMatched = this.elasticSearchResponse

    // For findByUri calls, copy numItemsMatched into document so it's included
    // in response:
    if (util.checkForNestedHitsAndSource(updatedWithNumItemsMatched)) {
      updatedWithNumItemsMatched.hits.hits[0]._source.numItemsMatched = [this.elasticSearchResponse.hits.hits[0].inner_hits.items.hits.total]
    }

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
