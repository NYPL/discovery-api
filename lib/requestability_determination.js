const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const statusMapping = require('@nypl/nypl-core-objects')('by-statuses')
const logger = require('./logger')
// This method is not meant to be used in isolation.
// The logic of what makes something requestable is pretty complex.
// As of writing - this method is only meant to be called on:
 // * recap items owned by NYPL that are HTC has already told us is available
let requestableBasedOnStatusAndHoldingLocation = (item) => {
  let requestableViaHoldingLocation = false
  let requestableViaStatus = false

  // is this not requestable because of its holding location
  if (item.holdingLocation && item.holdingLocation.length > 0) {
    let holding_location_sierra_code = item.holdingLocation[0].id.split(':').pop()
    requestableViaHoldingLocation = sierraLocations[holding_location_sierra_code].requestable
  } else {
    logger.warn('There is an item in the index with no holdingLocation', item)
  }

  // is this not requestable because of its serialized status
  if (item.status && item.status.length > 0) {
    let serializedAvailability = item.status[0].id.split(':').pop()
    requestableViaStatus = statusMapping[serializedAvailability].requestable
  } else {
    logger.warn('There is an item in the index with no status', item)
  }

  return (requestableViaHoldingLocation && requestableViaStatus)
}

module.exports = {requestableBasedOnStatusAndHoldingLocation}
