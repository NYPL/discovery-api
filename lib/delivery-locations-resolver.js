const { itemHasRecapHoldingLocation, barcodeFromItem } = require('./util')
const nyplCore = require('./load_nypl_core')

const logger = require('./logger')
const onsiteEddCriteria = require('../data/onsite-edd-criteria.json')
const { isItemNyplOwned } = require('./ownership_determination')

class DeliveryLocationsResolver {
  static nyplCoreLocation (locationCode) {
    return nyplCore.sierraLocations()[locationCode]
  }

  // Determine eddRequestable by on-site EDD requestability criteria (presumed on-site):
  static eddRequestableByOnSiteCriteria (item) {
    // Closured function to return the 'id' value of the named property:
    const idValue = (property) => {
      if (
        item[property] && Array.isArray(item[property]) &&
        item[property][0].id &&
        item[property][0].id.split(':').length === 2
      ) {
        return item[property][0].id.split(':')[1]
      }
    }
    const eddCriteriaChecks = [
      // Check the following properties for agreement with required values
      // rm status because we have separated availability and requestability - VK 7/27/2023
      // Add status because status 'o' actually makes holds impossible - PB 3/21/2024
      'status',
      'catalogItemType',
      'holdingLocation',
      'accessMessage'
    ].reduce((hash, property) => {
      // Property meets criteria if the array of required values for the
      // given property includes the item's value
      const propertyResult = onsiteEddCriteria[property].indexOf(idValue(property)) >= 0
      // Retain the actual queried value for debugging:
      hash[property] = { value: idValue(property), result: propertyResult }
      return hash
    }, {})
    // One extra check: Due to (obvious) limitations with
    // deliveryLocationsByBarcode service, we can not currently offer items
    // with no barcode, so until we offer an alternative means for determining
    // delivery locations, let's consider these items as not requestable
    const hasBarcode = (item.identifier || [])
      .some((identifier) => /^urn:barcode:\d+/.test(identifier))
    eddCriteriaChecks.hasBarcode = {
      result: hasBarcode
    }
    // All criteria must pass:
    const finalResult = Object.keys(eddCriteriaChecks)
      .reduce((result, property) => result && eddCriteriaChecks[property].result, true)

    logger.debug({ message: `EDD criteria check for ${item.uri}`, finalResult, eddCriteriaChecks })
    return finalResult
  }

  static extractLocationCode (item) {
    if (!Array.isArray(item.holdingLocation)) {
      // Log warning if it's our item and lacks a holdingLocation:
      if (/^i/.test(item.uri)) {
        logger.warn(`DeliveryLocationsResolver#extractLocationCode: Item missing holdingLocation: ${item.uri}`)
      }
      return false
    }

    return item.holdingLocation[0]?.id?.split(':').pop()
  }

  static sortPosition (location) {
    if (location.deliveryLocationTypes.includes('Scholar')) return 0
    if (location.code === 'mal') return 1
    if (location.code.startsWith('ma')) return 2
    if (location.code.startsWith('pa') || location.code.startsWith('my') || location.code.startsWith('lp')) return 3
    if (location.code.startsWith('sc')) return 4
    return 5
  }

  static formatLocations (locations, deliveryLocationTypes) {
    if (!locations) return []
    return (
      // Format locations in the manner api consumers expect
      locations.map((location) => {
        return {
          id: `loc:${location.code}`,
          label: location.label,
          sortPosition: DeliveryLocationsResolver.sortPosition(location)
        }
      })
        // Either way, sort deliveryLocation entries by name:
        .sort((l1, l2) => {
          if (l1.sortPosition < l2.sortPosition) return -1
          if (l1.sortPosition > l2.sortPosition) return 1
          if (l1.label < l2.label) return -1
          return 1
        })
    )
  }

  static extractRecapBarcodes (items) {
    return items
      .filter((item) => {
        // It's in ReCAP if 1) it has a RC location
        return itemHasRecapHoldingLocation(item) ||
          // .. or 2) it's a partner item:
          !isItemNyplOwned(item)
      })
      .map(barcodeFromItem)
  }

  // Given an array of locations and scholar room code (eg 'mal17'), filters out
  // irrelevant scholar rooms, or filters out all scholar rooms if no code is
  // provided
  static filterLocations (locations, scholarRoom) {
    if (!locations || !locations.length) return []
    // remove scholar locations that are not the scholar room, if a specific
    // scholar room exists.
    // Filter out anything not matching the specified deliveryLocationType
    return locations.filter((location) => {
      const locationIsNotScholarRoom = !location.deliveryLocationTypes.includes('Scholar')
      return locationIsNotScholarRoom || (location.code === scholarRoom)
    })
  }
}

module.exports = DeliveryLocationsResolver
