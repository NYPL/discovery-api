var SCSBRestClient = require('@nypl/scsb-rest-client')
var logger = require('./logger')
var config = require('config')
let isItemNyplOwned = require('./ownership_determination').isItemNyplOwned
let requestableBasedOnStatusAndHoldingLocation = require('./requestability_determination').requestableBasedOnStatusAndHoldingLocation

class AvailabilityResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
    this.barcodes = this._parseBarCodesFromESResponse()
    this.restClient = new SCSBRestClient({url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY})
  }

  // returns an updated elasticSearchResponse with the newest availability info from SCSB
  responseWithUpdatedAvailability () {
    if (this.barcodes.length === 0) {
      logger.debug('no barcodes found')
      return Promise.resolve(this.elasticSearchResponse)
    }
    return this.restClient.getItemsAvailabilityForBarcodes(this.barcodes)
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
              let recapAvailabilityStatus = barcodesAndAvailability[barcode_array[barcode_array.length - 1]]

              // If it's not in ReCAP, it's not requestable:
              if (recapAvailabilityStatus === "Item Barcode doesn't exist in SCSB database.") {
                item.requestable = [false]

              // Otherwise it is in ReCAP:
              } else {
                // Make sure properties exist:
                if (!item.status || item.status.length === 0) item.status = [{}]
                if (!item.reqestable || item.requestable.length === 0) item.requestable = []

                // NYPL items require checking 1) recap status, location requestability, and sierra status requestability
                if (isItemNyplOwned(item)) {
                  // First check recap status:
                  if (recapAvailabilityStatus === 'Available') {
                    // Now check status and location requestability
                    item.requestable[0] = requestableBasedOnStatusAndHoldingLocation(item)
                    item.status[0].id = config.get('itemAvailability.available.id')
                    item.status[0].label = config.get('itemAvailability.available.label')
                  } else {
                    // If recap status is Not Available, we need check nothing else
                    item.requestable[0] = false
                    item.status[0].id = config.get('itemAvailability.notAvailable.id')
                    item.status[0].label = config.get('itemAvailability.notAvailable.label')
                  }

                // It's a partner item in ReCAP:
                } else {
                  if (recapAvailabilityStatus === 'Available') {
                    item.requestable[0] = true
                    item.status[0].id = config.get('itemAvailability.available.id')
                    item.status[0].label = config.get('itemAvailability.available.label')
                  } else {
                    item.requestable[0] = false
                    item.status[0].id = config.get('itemAvailability.notAvailable.id')
                    item.status[0].label = config.get('itemAvailability.notAvailable.label')
                  }
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
