const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')

class LocationLabelUpdater {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
  }

  // returns an updated elasticSearchResponse with the most recent labels for locations
  responseWithUpdatedLabels () {
    let resp = this.elasticSearchResponse
    let updatedHits = resp.hits.hits.map((bib) => {
      bib._source.items.map((item) => {
        if (item.holdingLocation && item.holdingLocation.length > 0) {
          let holdingLocation = item.holdingLocation[0]
          holdingLocation.label = sierraLocations[holdingLocation.id.replace(/^loc:/, '')].label
          item.holdingLocation = [holdingLocation]
        }
        return item
      })
      return bib
    })
    resp.hits.hits = updatedHits
    return resp
  }

}

module.exports = LocationLabelUpdater
