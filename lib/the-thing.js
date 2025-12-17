const locationsUtils = require('./delivery-locations-resolver')
const Item = require('./models/Item')
const logger = require('./logger')
const scsbClient = require('./scsb-client')
const { barcodeFromItem } = require('./util')
/**
 *  Given an array of item barcodes, returns a hash mapping barcodes to customer codes
 */
async function __recapCustomerCodesByBarcodes (barcodes) {
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

/**
   * Given an array of items (ES hits), returns the same items with `eddRequestable` & `deliveryLocations`. We verify all recap customer codes because our indexed data may be stale.
   *
   * @return Promise<Array<items>> A Promise that resolves and array of items, modified to include `eddRequestable` & `deliveryLocations`
   */
async function attachDeliveryLocationsAndEddRequestability (items, scholarRoom) {
  // Extract ReCAP barcodes from items:
  const recapBarcodes = locationsUtils.extractRecapBarcodes(items)
  // Get a map from barcodes to ReCAP customercodes:
  return __recapCustomerCodesByBarcodes(recapBarcodes)
    .then((barcodeToRecapCustomerCode) => {
      // Now map over items to affix deliveryLocations:
      return items.map((item) => {
        // Get this item's barcode:
        const barcode = barcodeFromItem(item)
        if (barcodeToRecapCustomerCode[barcode]) item.recapCustomerCode = [barcodeToRecapCustomerCode[barcode]]
        // If recap has a customer code for this barcode, map it by recap cust code:
        const itemModel = new Item(item)
        item.eddRequestable = !!itemModel.eddRequestable
        const filteredDeliveryLocationsWithScholarRoom = locationsUtils.filterLocations(itemModel.location.deliveryLocation, scholarRoom)
        item.deliveryLocation = locationsUtils.formatLocations(filteredDeliveryLocationsWithScholarRoom)
        return item
      })
    })
}

module.exports = { attachDeliveryLocationsAndEddRequestability, __recapCustomerCodesByBarcodes }
