const arrayIntersection = require('./util').arrayIntersection
const SCSBRestClient = require('@nypl/scsb-rest-client')
const recapCustomerCodes = require('@nypl/nypl-core-objects')('by-recap-customer-code')
const sierraLocations = require('@nypl/nypl-core-objects')('by-sierra-location')
const logger = require('./logger')

class DeliveryLocationsResolver {
  // Fetch Sierra delivery locations by Sierra holding location:
  static __deliveryLocationsByHoldingLocation (holdingLocation) {
    // If holdingLocation given, strip code from @id for lookup:
    let locationCode = holdingLocation && holdingLocation.id ? holdingLocation.id.replace(/^loc:/, '') : null

    // Is Sierra location code mapped?
    if (sierraLocations[locationCode] && sierraLocations[locationCode].sierraDeliveryLocations) {
      // It's mapped, but the sierraDeliveryLocation entities only have `code` and `label`
      // Do a second lookup to populate `deliveryLocationTypes`
      return sierraLocations[locationCode].sierraDeliveryLocations.map((deliveryLocation) => {
        deliveryLocation.deliveryLocationTypes = sierraLocations[deliveryLocation.code].deliveryLocationTypes
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

  // Fetch Sierra delivery locations by recap customer code:
  static __deliveryLocationsByCustomerCode (customerCode) {
    if (recapCustomerCodes[customerCode] && recapCustomerCodes[customerCode].sierraDeliveryLocations) {
      return recapCustomerCodes[customerCode].sierraDeliveryLocations
    }
  }

  // Determine eddRequestable by by recap customer code:
  static __eddRequestableByCustomerCode (customerCode) {
    if (recapCustomerCodes[customerCode]) return Boolean(recapCustomerCodes[customerCode].eddRequestable)
  }

  static __recapCustomerCodesByBarcodes (barcodes) {
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

            if (response && response.searchResultRows) {
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

  static resolveDeliveryLocations (items, deliveryLocationTypes) {
    // Assert sensible default for location types:
    if (!deliveryLocationTypes || !Array.isArray(deliveryLocationTypes)) deliveryLocationTypes = ['Research']

    // Extract barcodes from items:
    var barcodes = items.map((i) => i.identifier.filter((i) => /^urn:barcode:/.test(i))[0].split(':')[2])

    // Get a map from barcodes to ReCAP customercodes:
    return this.__recapCustomerCodesByBarcodes(barcodes)
      .then((barcodeToCustomerCode) => {
        // Now map over items to affix deliveryLocations:
        return items.map((item) => {
          // Get this item's barcode:
          var barcode = item.identifier.filter((i) => /^urn:barcode:/.test(i))[0].split(':')[2]

          // Establish default for Electronic Document Delivery flag:
          item.eddRequestable = false

          let sierraLocations = []
          // If recap has a customer code for this barcode, map it by recap cust code:
          if (barcodeToCustomerCode[barcode]) {
            sierraLocations = this.__deliveryLocationsByCustomerCode(barcodeToCustomerCode[barcode])
            item.eddRequestable = this.__eddRequestableByCustomerCode(barcodeToCustomerCode[barcode])

          // Otherwise, it's not in recap:
          } else {
            // The holdingLocation implies the deliveryLocations:
            if (item.holdingLocation && item.holdingLocation[0]) sierraLocations = this.__deliveryLocationsByHoldingLocation(item.holdingLocation[0])

            // If we don't have a holdingLocation, send it as null to force it to mock some:
            else sierraLocations = this.__deliveryLocationsByHoldingLocation(null)
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
