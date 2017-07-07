const SCSBRestClient = require('@nypl/scsb-rest-client')
const deliveryLocationByRecapCustomerCode = require('@nypl/nypl-core-objects')('by-recap-customer-codes')
const logger = require('./logger')

function deliveryLocationsByHoldingLocation (holdingLocation) {
  // Mocked based on actual mapping for holdingLocation 'loc:scff2'
  return [
    {
      id: 'loc:sc',
      label: 'Schomburg Center'
    }
  ].map((loc) => Object.assign(loc, { label: `${loc.label}${!holdingLocation || holdingLocation.id !== 'loc:scff2' ? ' (mocked)' : ''}` }))
}

function deliveryLocationsByCustomerCode (customerCode) {
  if (deliveryLocationByRecapCustomerCode[customerCode] && deliveryLocationByRecapCustomerCode[customerCode].sierraDeliveryLocations) {
    return deliveryLocationByRecapCustomerCode[customerCode].sierraDeliveryLocations.map((ent) => {
      return {
        id: `loc:${ent.code}`,
        label: ent.label
      }
    })
  } else {
    // Mocked based on actual mapping (first three) for customerCode 'PA'
    return [
      {
        id: 'loc:maf',
        label: 'SASB - Dorot Jewish Division Rm 111'
      },
      {
        id: 'loc:mar',
        label: 'SASB - Rare Book Collection Rm 328'
      },
      {
        id: 'loc:mao',
        label: 'SASB - Manuscripts & Archives Rm 328'
      }
    ].map((loc) => Object.assign(loc, { label: `${loc.label}${customerCode !== 'PA' ? ' (mocked)' : ''}` }))
  }
}

function recapCustomerCodesByBarcodes (barcodes) {
  let scsbClient = new SCSBRestClient({ url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY })

  // Record time to process all:
  var __startAll = new Date()

  return Promise.all(
    barcodes.map((barcode) => {
      // Record start time to process this request
      var __start = new Date()
      return scsbClient.searchByParam({ fieldValue: barcode, fieldName: 'Barcode' })
        .then((response) => {
          let ellapsed = ((new Date()) - __start)
          logger.debug({ message: `HTC searchByParam API took ${ellapsed}ms`, metric: 'searchByParam-barcode', timeMs: ellapsed })

          if (response && response.length > 0 && (typeof response[0]) === 'object') {
            return { [barcode]: response[0].customerCode }
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

function resolveDeliveryLocations (items) {
  // Extract barcodes from items:
  var barcodes = items.map((i) => i.identifier.filter((i) => /^urn:barcode:/.test(i))[0].split(':')[2])

  // Get a map from barcodes to ReCAP customercodes:
  return recapCustomerCodesByBarcodes(barcodes)
    .then((barcodeToCustomerCode) => {
      // Now map over items to affix deliveryLocations:
      return items.map((item) => {
        // Get this item's barcode:
        var barcode = item.identifier.filter((i) => /^urn:barcode:/.test(i))[0].split(':')[2]

        // If recap has a customer code for this barcode, map it by recap cust code:
        if (barcodeToCustomerCode[barcode]) {
          item.deliveryLocation = deliveryLocationsByCustomerCode(barcodeToCustomerCode[barcode])

        // Otherwise, it's not in recap:
        } else {
          // The holdingLocation implies the deliveryLocations:
          if (item.holdingLocation && item.holdingLocation[0]) item.deliveryLocation = deliveryLocationsByHoldingLocation(item.holdingLocation[0])

          // If we don't have a holdingLocation, send it as null to force it to mock some:
          else item.deliveryLocation = deliveryLocationsByHoldingLocation(null)
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

module.exports = { resolveDeliveryLocations }
