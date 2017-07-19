const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const statusMapping = require('@nypl/nypl-core-objects')('by-statuses')

// This method is not meant to be used in isolation.
// The logic of what makes something requestable is pretty complex.
// As of writing - this method is only meant to be called on recap items owned by NYPL
let requestableBasedOnStatusAndHoldingLocation = (item) => {
  // only consider flipping something if our index says it's requestable.
  // Never turn an unrequestable item to requestable = [true]
  if (item.requestable[0] === true) {
    // is this not requestable because of its holding location
    let holding_location_sierra_code = item.holdingLocation[0].id.split(':').pop()
    let requestableViaHoldingLocation = sierraLocations[holding_location_sierra_code].requestable
    console.log(item.status)
    // is this not requestable because of its serialized status
    let serializedAvailability = item.status[0].id.split(':').pop()
    let requestableViaStatus = statusMapping[serializedAvailability].requestable

    return (requestableViaHoldingLocation && requestableViaStatus)
  } else {
    return item.requestable[0]
  }
}

module.exports = {requestableBasedOnStatusAndHoldingLocation}
