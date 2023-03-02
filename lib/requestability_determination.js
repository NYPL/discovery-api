const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const statusMapping = require('@nypl/nypl-core-objects')('by-statuses')
const logger = require('./logger')
// This method is not meant to be used in isolation.
// The logic of what makes something requestable is pretty complex.
// As of writing - this method is only meant to be called on:
 // * recap items owned by NYPL that are HTC has already told us is available
let requestableBasedOnStatusAndHoldingLocation = (item) => {
  const requestableViaHoldingLocation = requestableBasedOnHoldingLocation(item)
  const requestableViaStatus = requestableBasedOnStatus(item)

  return (requestableViaHoldingLocation && requestableViaStatus)
}

const requestableBasedOnStatus = (item) => {
  // is this not requestable because of its serialized status
  try {
    const serializedAvailability = item.status[0].id.split(':').pop()
    return statusMapping[serializedAvailability].requestable
  } catch (e) {
    logger.warn('There is an item in the index with missing or malformed status', item)
    return false
  }
}

const requestableBasedOnHoldingLocation = (item) => {
  // Is this not requestable because of its holding location?
  try {
    const holding_location_sierra_code = item.holdingLocation[0].id.split(':').pop()
    if (item.uri === 'i10283664') console.log(sierraLocations[holding_location_sierra_code])
    return sierraLocations[holding_location_sierra_code].requestable
  } catch (e) {
    logger.warn('There is an item in the index with missing or malformed holdingLocation', item)
    return false
  }
}

module.exports = {
  requestableBasedOnHoldingLocation,
  requestableBasedOnStatus,
  requestableBasedOnStatusAndHoldingLocation
}
