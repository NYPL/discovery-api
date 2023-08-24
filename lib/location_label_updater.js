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
<<<<<<< HEAD
<<<<<<< HEAD
          let holdingLocation = item.holdingLocation[0]
          holdingLocation.label = sierraLocations[holdingLocation.id.replace(/^loc:/, '')].label
          item.holdingLocation = [holdingLocation]
=======
          item.holdingLocation = item.holdingLocation.map((loc) => {
            const nyplCoreEntry = sierraLocations[loc.id.replace(/^loc:/, '')]
            if (nyplCoreEntry) loc.label = nyplCoreEntry.label
          })
>>>>>>> parent of a9753bd... Fix bug
=======
          let holdingLocation = item.holdingLocation[0]
          holdingLocation.label = sierraLocations[holdingLocation.id.replace(/^loc:/, '')].label
          item.holdingLocation = [holdingLocation]
>>>>>>> parent of a6e20e2... Fix location label update brittleness
        }
        return item
      })
      // Update locations for holdings:
      ; (bib._source.holdings || []).map((holding) => {
        if (holding.location && holding.location.length > 0) {
<<<<<<< HEAD
<<<<<<< HEAD
          let location = holding.location[0]
          location.label = sierraLocations[location.code.replace(/^loc:/, '')].label
          holding.location = [location]
=======
          holding.location = holding.location.map((loc) => {
            const nyplCoreEntry = sierraLocations[loc.id.replace(/^loc:/, '')]
            if (nyplCoreEntry) loc.label = nyplCoreEntry.label
          })
>>>>>>> parent of a9753bd... Fix bug
=======
          let location = holding.location[0]
          location.label = sierraLocations[location.code.replace(/^loc:/, '')].label
          holding.location = [location]
>>>>>>> parent of a6e20e2... Fix location label update brittleness
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
