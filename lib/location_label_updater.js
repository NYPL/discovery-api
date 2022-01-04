const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')

class LocationLabelUpdater {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  // returns an updated elasticSearchResponse with the most recent labels for locations
  responseWithUpdatedLabels () {
    let resp = this.elasticSearchResponse
    let updatedHits = resp.hits.hits.map((bib) => {
      // Update locations for items:
      ; (bib._source.items || []).map((item) => {
        if (item.holdingLocation && item.holdingLocation.length > 0) {
          let holdingLocation = item.holdingLocation[0]
          holdingLocation.label = sierraLocations[holdingLocation.id.replace(/^loc:/, '')].label
          item.holdingLocation = [holdingLocation]
        }
        return item
      })
      // Update locations for holdings:
      ; (bib._source.holdings || []).map((holding) => {
        if (holding.location && holding.location.length > 0) {
          let location = holding.location[0]
          location.label = sierraLocations[location.code.replace(/^loc:/, '')].label
          holding.location = [location]
        }
        return holding
      })
      return bib
    })
    resp.hits.hits = updatedHits
    return resp
  }

}

module.exports = LocationLabelUpdater
