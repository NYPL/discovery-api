// const locationsUtils = require('./delivery-locations-resolver')
// const Item = require('./models/Item')
// /**
//  *  Given an array of item barcodes, returns a hash mapping barcodes to customer codes
//  */

// /**
//    * Given an array of items (ES hits), returns the same items with `eddRequestable` & `deliveryLocations`. We verify all recap customer codes because our indexed data may be stale.
//    *
//    * @return Promise<Array<items>> A Promise that resolves and array of items, modified to include `eddRequestable` & `deliveryLocations`
//    */
// async function attachDeliveryLocationsAndEddRequestability (items, scholarRoom) {
//   return await Promise.all(items.map(async (item) => {
//     const itemModel = await Item.withDeliveryLocationsByBarcode(item)
//     // If recap has a customer code for this barcode, map it by recap cust code:
//     item.eddRequestable = !!itemModel.eddRequestable
//     console.log(itemModel)
//     const filteredDeliveryLocationsWithScholarRoom = locationsUtils.filterLocations(itemModel.deliveryLocation, scholarRoom)
//     item.deliveryLocation = locationsUtils.formatLocations(filteredDeliveryLocationsWithScholarRoom)
//     return item
//   }))
// }

// module.exports = { attachDeliveryLocationsAndEddRequestability }
