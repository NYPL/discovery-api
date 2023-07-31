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
      ; (bib._source.items || []).forEach((item) => {
        if (item.holdingLocation && item.holdingLocation.length > 0) {
          item.holdingLocation = item.holdingLocation.map((loc) => {
            const nyplCoreEntry = sierraLocations[loc.id.replace(/^loc:/, '')]
            if (nyplCoreEntry) loc.label = nyplCoreEntry.label
          })
        }
      })
      // Update locations for holdings:
      ; (bib._source.holdings || []).forEach((holding) => {
        if (holding.location && holding.location.length > 0) {
          holding.location = holding.location.map((loc) => {
            const nyplCoreEntry = sierraLocations[loc.id.replace(/^loc:/, '')]
            if (nyplCoreEntry) loc.label = nyplCoreEntry.label
          })
        }
      })
      return bib
    })
    resp.hits.hits = updatedHits
    return resp
  }

}

module.exports = LocationLabelUpdater
