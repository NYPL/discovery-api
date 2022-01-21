var SCSBRestClient = require('@nypl/scsb-rest-client')
var logger = require('./logger')
var config = require('config')
let isItemNyplOwned = require('./ownership_determination').isItemNyplOwned
let requestableBasedOnStatusAndHoldingLocation = require('./requestability_determination').requestableBasedOnStatusAndHoldingLocation
const ResourceSerializer = require('./jsonld_serializers').ResourceSerializer
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const Feature = require('./feature')

class AvailabilityResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
    this.barcodes = this._parseBarCodesFromESResponse()
    this.restClient = new SCSBRestClient({url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY})
  }

  // returns an updated elasticSearchResponse with the newest availability info from SCSB
  responseWithUpdatedAvailability (request) {
    return this._createSCSBBarcodeAvailbilityMapping(this.barcodes)
      .then((barcodesAndAvailability) => {
        this._fixItemAvailabilityInResponse(barcodesAndAvailability, request)
        return this.elasticSearchResponse
      })
      .catch((error) => {
        logger.error('Error occurred while setting availability - ', error)
        return Promise.reject(error)
      })
  }

  /**
   *  Given an array of barcodes, returns a hash mapping barcode to SCSB availability
   */
  _createSCSBBarcodeAvailbilityMapping (barcodes) {
    if (barcodes.length === 0) {
      logger.debug('no barcodes found')
      return Promise.resolve({})
    }
    return this.restClient.getItemsAvailabilityForBarcodes(this.barcodes)
      .then((itemsStatus) => {
        var barcodesAndAvailability = {}
        itemsStatus.forEach((statusEntry) => {
          barcodesAndAvailability[statusEntry.itemBarcode] = statusEntry.itemAvailabilityStatus
        })
        return barcodesAndAvailability
      })
  }

  _parseBarCodesFromESResponse () {
    var barcodes = []
    for (let hit of this.elasticSearchResponse.hits.hits) {
      for (let item of (hit._source.items || [])) {
        // despite its singular name item.identifier is an Array of barcodes
        if (item.identifier) {
          for (let identifier of item.identifier) {
            // Rolling forward, some identifiers will be serialized as entities.
            // For now, let's convert them back to urn-style:
            identifier = ResourceSerializer.prototype._ensureIdentifierIsUrnStyle(identifier)

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

  _fixItemAvailabilityInResponse (barcodesAndAvailability, request) {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        // If it's an electronic item, skip it
        if (item.electronicLocator) return item

        // Get item holding location id
        const holdingLocation = (item.holdingLocation || [{}])[0].id
        const isRecapHoldingLocation = (holdingLocation && /^loc:rc/.test(holdingLocation))

        // Get item barcode
        const barcode = (item.identifier || []).reduce((_, identifier) => {
          // Rolling forward, some identifiers will be serialized as entities.
          // For now, let's convert them back to urn-style:
          identifier = ResourceSerializer.prototype._ensureIdentifierIsUrnStyle(identifier)
          if (identifier.split(':').length === 3 && identifier.split(':')[1] === 'barcode') {
            return identifier.split(':')[2]
          }
        }, null)

        // It's in ReCAP if
        //  1. it's an NYPL item with a ReCAP holding location or
        //  2. it's not an NYPL owned item (i.e. it's a partner item)
        const isInRecap = isRecapHoldingLocation || !isItemNyplOwned(item)

        // If it's in ReCAP
        if (isInRecap) {
          let recapAvailabilityStatus = barcodesAndAvailability[barcode]

          // If it's not in ReCAP (but it has a rc location), it's def not requestable
          if (recapAvailabilityStatus === "Item Barcode doesn't exist in SCSB database.") {
            item.requestable = [false]
            item.physRequestable = [false]

          // Otherwise it is in ReCAP:
          } else {
            // Make sure properties exist:
            if (!item.status || item.status.length === 0) item.status = [{}]
            if (!item.reqestable || item.requestable.length === 0) item.requestable = []
            if (!item.physRequestable || item.physRequestable.length === 0) item.physRequestable = []

            // NYPL items require checking 1) recap status, location requestability, and sierra status requestability
            if (isItemNyplOwned(item)) {
              // First check recap status:
              if (recapAvailabilityStatus === 'Available') {
                item.status[0].id = config.get('itemAvailability.available.id')
                item.status[0].label = config.get('itemAvailability.available.label')
                // Now that true availability is set, establish requestability based on it (and holdingLocation)
                item.requestable[0] = requestableBasedOnStatusAndHoldingLocation(item)
                item.physRequestable[0] = requestableBasedOnStatusAndHoldingLocation(item)
              } else {
                // If recap status is Not Available, we need check nothing else
                item.requestable[0] = false
                item.physRequestable[0] = false
                item.status[0].id = config.get('itemAvailability.notAvailable.id')
                item.status[0].label = config.get('itemAvailability.notAvailable.label')
              }

            // It's a partner item in ReCAP:
            } else {
              if (recapAvailabilityStatus === 'Available') {
                item.requestable[0] = true
                item.physRequestable[0] = true
                item.status[0].id = config.get('itemAvailability.available.id')
                item.status[0].label = config.get('itemAvailability.available.label')
              } else {
                item.requestable[0] = false
                item.physRequestable[0] = false
                item.status[0].id = config.get('itemAvailability.notAvailable.id')
                item.status[0].label = config.get('itemAvailability.notAvailable.label')
              }
            }
          }

        // Item has a non-ReCAP holdingLocation, so compute requestability against on-site criteria:
        } else {
          // By default, make non-ReCAP materials not requestable
          item.requestable = [false]
          item.physRequestable = [false]

          if (Feature.enabled('on-site-edd', request)) {
            // In principle, we should tie requestability to the presence of *any*
            // delivery option. For now, the only delivery option we trust for
            // on-site is EDD
            item.requestable = [DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)]
          }
        }
        return item
      })
    }
  }
}  // end class

module.exports = AvailabilityResolver
