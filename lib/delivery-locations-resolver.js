const { arrayIntersection, itemHasRecapHoldingLocation, barcodeFromItem } = require('./util')
const SCSBRestClient = require('@nypl/scsb-rest-client')
const recapCustomerCodes = require('@nypl/nypl-core-objects')('by-recap-customer-code')
const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const logger = require('./logger')
const onsiteEddCriteria = require('../data/onsite-edd-criteria.json')
const { requestableBasedOnHoldingLocation } = require('./requestability_determination')
const { isItemNyplOwned } = require('./ownership_determination')

class DeliveryLocationsResolver {
  // Fetch delivery locations by Sierra holding location:
  static deliveryLocationsByHoldingLocation (holdingLocation, customerCode) {
    // If holdingLocation given, strip code from @id for lookup:
    let holdingLocationCode = holdingLocation && holdingLocation.id ? holdingLocation.id.replace(/^loc:/, '') : null

    // Is Sierra location code mapped?
    const sierraLocationsDataForLocationCode = sierraLocations[holdingLocationCode]

    // If not, return empty array
    if (!sierraLocationsDataForLocationCode) return null
    const deliverableToResolution = sierraLocationsDataForLocationCode.deliverableToResolution
    let locations = []
    // If there is a deliverableToResolution, use that to query nypl-core-objects
    if (deliverableToResolution === 'recap-customer-code') {
      locations = this.deliveryLocationsByRecapCustomerCode(customerCode)
    } else if (deliverableToResolution === 'm2-customer-codes') {
      locations = this.deliveryLocationsByM2CustomerCode(customerCode)
      // If deliverableToResolution is undefined, default to sierra locations data
    } else if (!sierraLocationsDataForLocationCode.deliverableTo) {
      locations = sierraLocationsDataForLocationCode
        .deliverableTo
    }
    if (!locations) return null
    return locations.map((deliveryLocation) => {
      return {
        code: 'loc:' + deliveryLocation.code,
        label: sierraLocationsDataForLocationCode.label
      }
    })
  }

  // Fetch Sierra delivery locations by recap code
  static deliveryLocationsByRecapCustomerCode (customerCode) {
    const recapInfo = recapCustomerCodes[customerCode]
    if (recapInfo && recapInfo.sierraDeliveryLocations && recapInfo.sierraDeliveryLocations.length) {
      return recapInfo.sierraDeliveryLocations
    } else return null
  }

  // Fetch Sierra delivery locations by m2 customer code. Returns undefined if the m2 customer code is not requestable:
  static deliveryLocationsByM2CustomerCode (customerCode) {
    let m2CustomerCodes
    try {
      m2CustomerCodes = require('@nypl/nypl-core-objects')('by-m2-customer-code')
    } catch (e) {
      logger.error('Error accessing nypl-core-objects by M2 customer code')
    }
    if (m2CustomerCodes && m2CustomerCodes[customerCode] && m2CustomerCodes[customerCode].sierraDeliveryLocations) {
      const { sierraDeliveryLocations, requestable } = m2CustomerCodes[customerCode]
      if (requestable) {
        return sierraDeliveryLocations
      } else return null
    }
  }

  // Determine eddRequestable by recap customer code:
  static __eddRequestableByCustomerCode (customerCode) {
    if (recapCustomerCodes[customerCode]) return Boolean(recapCustomerCodes[customerCode].eddRequestable)
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

    let scsbClient = new SCSBRestClient({ url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY })

    // Record time to process all:
    var __startAll = new Date()

    return Promise.all(
      barcodes.map((barcode) => {
        // Record start time to process this request
        var __start = new Date()
        return scsbClient.search({ fieldValue: barcode, fieldName: 'Barcode' })
          .then((response) => {
            let ellapsed = ((new Date()) - __start)
            logger.debug({ message: `HTC searchByParam API took ${ellapsed}ms`, metric: 'searchByParam-barcode', timeMs: ellapsed })

            if (response && response.searchResultRows && response.searchResultRows.length) {
              let results = response.searchResultRows
              let customerCode = null

              if (results && (results.length > 0) && results[0].searchItemResultRows.length > 0) {
                logger.debug(`${barcode} is a serial item`)
                customerCode = results[0].searchItemResultRows[0].customerCode
              } else {
                logger.debug(`${barcode} is a not a serial item`)
                customerCode = results[0].customerCode
              }
              return { [barcode]: customerCode }
            }
          })
          .catch((error) => {
            // This is a common error:
            //  "Error hitting SCSB API 502: <html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body bgcolor=\"white\">\r\n<center><h1>502 Bad Gateway</h1></center>\r\n</body>\r\n</html>\r\n"
            // return Promise.reject(error)
            logger.error({ message: 'HTC API error. Send everything to NH', htcError: error.message })
            return null
          })
      })
    ).then((scsbResponses) => {
      let ellapsed = ((new Date()) - __startAll)
      logger.debug({ message: `HTC searchByParam API across ${barcodes.length} barcodes took ${ellapsed}ms total`, metric: 'searchByParam-barcode-multiple', timeMs: ellapsed })

      // Filter out anything `undefined` and make sure at least one is valid:
      var validPairs = [{}].concat(scsbResponses.filter((r) => r))
      // Merge array of hashes into one big lookup hash:
      return Object.assign.apply(null, validPairs)
    })
  }

  /**
   * Given an array of items (ES hits), returns the same items with `eddRequestable` & `deliveryLocations`
   *
   * @return Promise<Array<items>> A Promise that resolves and array of items, modified to include `eddRequestable` & `deliveryLocations`
   */
  static resolveDeliveryLocations (items, deliveryLocationTypes) {
    // Assert sensible default for location types:
    if (!Array.isArray(deliveryLocationTypes) || deliveryLocationTypes.length === 0) deliveryLocationTypes = ['Research']

    // Extract ReCAP barcodes from items:
    const recapBarcodes = items
      .filter((item) => {
        // It's in ReCAP if 1) it has a RC location
        return itemHasRecapHoldingLocation(item) ||
          // .. or 2) it's a partner item:
          !isItemNyplOwned(item)
      })
      .map(barcodeFromItem)

    // Get a map from barcodes to ReCAP customercodes:
    return this.__recapCustomerCodesByBarcodes(recapBarcodes)
      .then((barcodeToRecapCustomerCode) => {
        // Now map over items to affix deliveryLocations:
        return items.map((item) => {
          // Get this item's barcode:
          const barcode = barcodeFromItem(item)

          // Establish default for Electronic Document Delivery flag:
          item.eddRequestable = false

          let sierraLocations = []
          // If recap has a customer code for this barcode, map it by recap cust code:
          if (barcodeToRecapCustomerCode[barcode]) {
            // Delivery locations are not valid if [NYPL] item's holding
            // location is not requestable:
            if (requestableBasedOnHoldingLocation(item) || !isItemNyplOwned(item)) {
              sierraLocations = this.deliveryLocationsByRecapCustomerCode(barcodeToRecapCustomerCode[barcode])
            }
            item.eddRequestable = this.__eddRequestableByCustomerCode(barcodeToRecapCustomerCode[barcode])

            // Otherwise, it's not in recap..
          } else {
            // But perhaps it's in M2?
            if (Array.isArray(item.m2CustomerCode) && item.m2CustomerCode[0]) {
              sierraLocations = this.deliveryLocationsByM2CustomerCode(item.m2CustomerCode[0])
            }
            item.eddRequestable = this.eddRequestableByOnSiteCriteria(item)
          }

          // Filter out anything not matching the specified deliveryLocationType
          if (sierraLocations) {
            sierraLocations = sierraLocations.filter((location) => {
              return location.deliveryLocationTypes &&
                arrayIntersection(location.deliveryLocationTypes, deliveryLocationTypes).length > 0
            })
          }

          // Format locations in the manner api consumers expect
          if (sierraLocations) {
            item.deliveryLocation = sierraLocations.map((location) => {
              return {
                id: `loc:${location.code}`,
                label: location.label
              }
            })
          }

          // Either way, sort deliveryLocation entries by name:
          if (item.deliveryLocation) {
            item.deliveryLocation = item.deliveryLocation.sort((l1, l2) => {
              if (l1.label < l2.label) return -1
              return 1
            })
          }

          return item
        })
      })
  }
}

module.exports = DeliveryLocationsResolver
