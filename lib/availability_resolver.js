var SCSBRestClient = require('./scsb_rest_client.js')
var logger = require('./logger')
var config = require('config')

class AvailabilityResolver {

  constructor (elasticSearchResponse) {
    this.elasticSearchResponse = elasticSearchResponse
    this.barcodes = this._parseBarCodesFromESResponse()
  }

  // returns an updated elasticSearchResponse with the newest availability info from SCSB
  responseWithUpdatedAvailability () {
    if (this.barcodes.length === 0) {
      logger.debug('no barcodes found')
      return Promise.resolve(this.elasticSearchResponse)
    }

    let scsbClient = new SCSBRestClient({url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY})
    return scsbClient.getItemsAvailabilityForBarcodes(this.barcodes)
      .then((itemsStatus) => {
        var barcodesAndAvailability = {}
        itemsStatus.forEach((statusEntry) => {
          barcodesAndAvailability[statusEntry.itemBarcode] = statusEntry.itemAvailabilityStatus
        })
        return barcodesAndAvailability
      })
      .then((barcodesAndAvailability) => {
        this._fixItemAvailabilityInResponse(barcodesAndAvailability)
        return this.elasticSearchResponse
      })
      .catch((error) => {
        logger.error('Error occurred while setting availability - ', error)
        return Promise.reject(error)
      })
  }

  _parseBarCodesFromESResponse () {
    var barcodes = []
    for (let hit of this.elasticSearchResponse.hits.hits) {
      for (let item of hit._source.items) {
        // despite its singular name item.identifier is an Array of barcodes
        if (item.identifier) {
          for (let identifier of item.identifier) {
            let barcode_array = identifier.split(':')
            if (barcode_array.length === 3 && barcode_array[1] === 'barcode') {
              barcodes.push(barcode_array[barcode_array.length - 1])
            }
          }
        }
      }
    }
    return barcodes
  }

  _fixItemAvailabilityInResponse (barcodesAndAvailability) {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      hit._source.items.map((item) => {
        if (item.identifier) {
          for (let identifier of item.identifier) {
            let barcode_array = identifier.split(':')
            if (barcode_array.length === 3 && barcode_array[1] === 'barcode') {
              if (barcodesAndAvailability[barcode_array[barcode_array.length - 1]] !== "Item Barcode doesn't exist in SCSB database.") {
                // can an item have multiple status
                if (barcodesAndAvailability[barcode_array[barcode_array.length - 1]] === 'Available') {
                  item.status[0].id = config.get('itemAvailability.available.id')
                  item.status[0].label = config.get('itemAvailability.available.label')
                } else {
                  item.status[0].id = config.get('itemAvailability.temporarilyUnavailable.id')
                  item.status[0].label = config.get('itemAvailability.temporarilyUnavailable.label')
                }
              }
            }
          }
        }
        return item
      })
    }
  }

}  // end class

module.exports = AvailabilityResolver
