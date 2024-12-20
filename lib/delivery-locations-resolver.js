const { itemHasRecapHoldingLocation, barcodeFromItem } = require('./util')
const scsbClient = require('./scsb-client')
const nyplCore = require('./load_nypl_core')

const logger = require('./logger')
const onsiteEddCriteria = require('../data/onsite-edd-criteria.json')
const { isItemNyplOwned } = require('./ownership_determination')

class DeliveryLocationsResolver {
  static nyplCoreLocation (locationCode) {
    return nyplCore.sierraLocations()[locationCode]
  }

  static requestableBasedOnHoldingLocation (item) {
    const locationCode = this.extractLocationCode(item)

    if (!DeliveryLocationsResolver.nyplCoreLocation(locationCode)) {
      logger.warn(`DeliveryLocationsResolver: Unrecognized holdingLocation for ${item.uri}: ${locationCode}`)
      return false
    }

    // Is this not requestable because of its holding location?
    return DeliveryLocationsResolver.nyplCoreLocation(locationCode).requestable
  }

  // Currently, there is no physical delivery requests for onsite items through Discovery API
  // Fetch Sierra delivery locations by Sierra holding location:
  static __deliveryLocationsByHoldingLocation (holdingLocation) {
    // If holdingLocation given, strip code from @id for lookup:
    const locationCode = holdingLocation && holdingLocation.id ? holdingLocation.id.replace(/^loc:/, '') : null
    // Is Sierra location code mapped?
    if (DeliveryLocationsResolver.nyplCoreLocation(locationCode)?.sierraDeliveryLocations) {
      // It's mapped, but the sierraDeliveryLocation entities only have `code` and `label`
      // Do a second lookup to populate `deliveryLocationTypes`
      return DeliveryLocationsResolver.nyplCoreLocation(locationCode).sierraDeliveryLocations.map((deliveryLocation) => {
        deliveryLocation.deliveryLocationTypes = DeliveryLocationsResolver.nyplCoreLocation(deliveryLocation.code).deliveryLocationTypes
        return deliveryLocation
      })
      // Either holdingLocation is null or code not matched; Fall back on mocked data:
    } else {
      // Mocked based on actual mapping for holdingLocation 'loc:scff2'
      return [
        {
          code: 'loc:sc',
          label: 'Schomburg Center (mocked)'
        }
      ]
    }
  }

  // Fetch Sierra delivery locations by recap code
  static deliveryLocationsByRecapCustomerCode (customerCode) {
    if (nyplCore.recapCustomerCodes()[customerCode] && nyplCore.recapCustomerCodes()[customerCode].sierraDeliveryLocations) {
      return nyplCore.recapCustomerCodes()[customerCode].sierraDeliveryLocations
    }
  }

  // Fetch Sierra delivery locations by m2 customer code. Returns undefined if the m2 customer code is not requestable:
  static deliveryLocationsByM2CustomerCode (customerCode) {
    if (nyplCore.m2CustomerCodes()?.[customerCode]?.sierraDeliveryLocations) {
      const { sierraDeliveryLocations, requestable } = nyplCore.m2CustomerCodes()[customerCode]
      if (requestable) {
        return sierraDeliveryLocations
      } else return undefined
    }
  }

  // Determine eddRequestable by recap customer code:
  static __eddRequestableByCustomerCode (customerCode) {
    if (nyplCore.recapCustomerCodes()[customerCode]) return Boolean(nyplCore.recapCustomerCodes()[customerCode].eddRequestable)
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

  /**
   *  Given an array of item barcodes, returns a hash mapping barcodes to customer codes
   */
  static __recapCustomerCodesByBarcodes (barcodes) {
    if (!barcodes || barcodes.length === 0) return Promise.resolve({})

    // Record time to process all:
    const __startAll = new Date()

    return Promise.all(
      barcodes.map(scsbClient.recapCustomerCodeByBarcode)
    ).then((scsbResponses) => {
      const ellapsed = ((new Date()) - __startAll)
      logger.debug({ message: `HTC searchByParam API across ${barcodes.length} barcodes took ${ellapsed}ms total`, metric: 'searchByParam-barcode-multiple', timeMs: ellapsed })

      // Build barcode-customerCode map:
      return barcodes.reduce((h, barcode, ind) => {
        if (scsbResponses[ind]) h[barcode] = scsbResponses[ind]
        return h
      }, {})
    })
  }

  static extractLocationCode (item) {
    if (!Array.isArray(item.holdingLocation)) {
      logger.warn(`DeliveryLocationsResolver#extractLocationCode: Item missing holdingLocation: ${item.uri}`)
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
          sortPosition: this.sortPosition(location)
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

  static attachRecapDeliveryInfo (item) {
    const info = this.getRecapDeliveryInfo(item)
    item.eddRequestable = info.eddRequestable
    item.deliveryLocation = info.deliveryLocation
    return item
  }

  static attachOnsiteDeliveryInfo (item) {
    const info = this.getOnsiteDeliveryInfo(item)
    item.eddRequestable = info.eddRequestable
    item.deliveryLocation = info.deliveryLocation
    return item
  }

  static getRecapDeliveryInfo (item) {
    // Delivery locations are not valid if [NYPL] item's holding
    // location is not requestable:
    let deliveryLocation
    let eddRequestable
    const hasRecapCustomerCode = item.recapCustomerCode && item.recapCustomerCode[0]
    const nyplItem = isItemNyplOwned(item)
    if (!hasRecapCustomerCode) {
      const requestableBasedOnHoldingLocation = nyplItem ? this.requestableBasedOnHoldingLocation(item) : true
      // the length of the list of delivery locations is checked later to determine physical requestability
      // In case of an offsite item with no recap customer code, we want this to be based on holding location
      // so we put a placeholder '' in case it is requestable based on holding location
      deliveryLocation = requestableBasedOnHoldingLocation ? [''] : []
      eddRequestable = requestableBasedOnHoldingLocation
    } else if (!nyplItem || this.requestableBasedOnHoldingLocation(item)) {
      deliveryLocation = this.deliveryLocationsByRecapCustomerCode(item.recapCustomerCode[0])
      eddRequestable = this.__eddRequestableByCustomerCode(item.recapCustomerCode[0])
    } else {
      deliveryLocation = []
      eddRequestable = false
    }
    return { deliveryLocation, eddRequestable }
  }

  static getOnsiteDeliveryInfo (item) {
    const deliveryInfo = {
      eddRequestable: false,
      deliveryLocation: []
    }
    const holdingLocationCode = this.extractLocationCode(item)
    const sierraData = DeliveryLocationsResolver.nyplCoreLocation(holdingLocationCode)
    if (!sierraData) {
      // This case is mainly to satisfy a test which wants eddRequestable = false
      // for a made up location code.
      logger.warn('Malformed or missing holding location code: ', holdingLocationCode)
      return deliveryInfo
    }
    // if nypl core says it's unrequestable, it can still be eddRequestable,
    // but its definitely not phys requestable.
    deliveryInfo.eddRequestable = this.eddRequestableByOnSiteCriteria(item)
    if (!this.requestableBasedOnHoldingLocation(item)) {
      return deliveryInfo
    }
    // if nypl-core reports that a holding location's delivery locations
    // should be found by M2 code, but only if the item has an M2 customer code
    const deliverableToResolution = sierraData.deliverableToResolution
    if (deliverableToResolution === 'm2-customer-code' && item.m2CustomerCode && item.m2CustomerCode[0]) {
      deliveryInfo.deliveryLocation = this.deliveryLocationsByM2CustomerCode(item.m2CustomerCode[0])
    }
    // if no value, default to sierra location lookup
    if (!deliverableToResolution) {
      deliveryInfo.deliveryLocation = sierraData.sierraDeliveryLocations
    }
    return deliveryInfo
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

  /**
   * Given an array of items (ES hits), returns the same items with `eddRequestable` & `deliveryLocations`. We verify all recap customer because our indexed data may be stale. 
   *
   * @return Promise<Array<items>> A Promise that resolves and array of items, modified to include `eddRequestable` & `deliveryLocations`
   */
  static attachDeliveryLocationsAndEddRequestability (items, scholarRoom) {
    // Extract ReCAP barcodes from items:
    const recapBarcodes = this.extractRecapBarcodes(items)
    // Get a map from barcodes to ReCAP customercodes:
    return this.__recapCustomerCodesByBarcodes(recapBarcodes)
      .then((barcodeToRecapCustomerCode) => {
        // Now map over items to affix deliveryLocations:
        return items.map((item) => {
          // Get this item's barcode:
          const barcode = barcodeFromItem(item)
          item.recapCustomerCode = [barcodeToRecapCustomerCode[barcode]]
          // If recap has a customer code for this barcode, map it by recap cust code:
          if (item.recapCustomerCode[0]) {
            item = this.attachRecapDeliveryInfo(item)
            // Otherwise, it's an onsite item
          } else {
            item = this.attachOnsiteDeliveryInfo(item)
          }
          // Establish default for Electronic Document Delivery flag:
          item.eddRequestable = !!item.eddRequestable
          const filteredDeliveryLocationsWithScholarRoom = this.filterLocations(item.deliveryLocation, scholarRoom)
          item.deliveryLocation = this.formatLocations(filteredDeliveryLocationsWithScholarRoom)
          return item
        })
      })
  }
}

module.exports = DeliveryLocationsResolver
