const config = require('config')
const scsbClient = require('./scsb-client')
const logger = require('./logger')
const isItemNyplOwned = require('./ownership_determination').isItemNyplOwned
const requestability = require('./requestability_determination')
const ResourceSerializer = require('./jsonld_serializers').ResourceSerializer
const DeliveryLocationsResolver = require('./delivery-locations-resolver')
const recapCustomerCodes = require('@nypl/nypl-core-objects')('by-recap-customer-code')
const Feature = require('../lib/feature')
const { nonRecapItemStatusAggregation } = require('./es-client')
const { deepValue } = require('./util')

class AvailabilityResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
    this.barcodes = this._parseBarCodesFromESResponse()
  }

  // returns an updated elasticSearchResponse with the newest availability info from SCSB
  responseWithUpdatedAvailability (request, options = {}) {
    // If this serialization is a result of a hold request initializing, we want
    // to double check the recap customer code in SCSB
    const updateRecapCustomerCodes = (options && options.queryRecapCustomerCode)
      ? () => this._checkScsbForRecapCustomerCode()
      : () => Promise.resolve()

    // Get 1) barcode-availability mapping and 2) customer code query in
    // parallel because they don't depend on each other:
    return Promise.all([
      // TODO: When options.recapBarcodesByStatus is set, we should be able to
      // use it in place of re-querying status by barcode:
      this._createSCSBBarcodeAvailbilityMapping(this.barcodes),
      updateRecapCustomerCodes()
    ])
      .then((barcodeMappingAndCustomerCodeResult) => {
        // We only care about the result of the barcode lookup because
        // _checkScsbForRecapCustomerCode updates this.elasticSearchResponse:
        const [barcodesAndAvailability] = barcodeMappingAndCustomerCodeResult
        this._fixItemAvailability(barcodesAndAvailability)
        this._fixItemRequestability(request)
        return this._fixItemStatusAggregation(options)
          .then(() => this.elasticSearchResponse)
      })
      .catch((error) => {
        logger.error('Error occurred while setting availability - ', error)
        return Promise.reject(error)
      })
  }

  /**
   * If response contains an item status aggregation and appears to cover some
   * ReCAP items, updates response to accurately reflect ReCAP statuses
   */
  _fixItemStatusAggregation (options) {
    const resp = this.elasticSearchResponse

    // Return early if there are no item aggregations to fix:
    if (!deepValue(resp, 'aggregations.item_location._nested.buckets')) return Promise.resolve()

    // Return early if we don't have scsb statuses (i.e. api issue)
    if (!options.recapBarcodesByStatus ||
      Object.keys(options.recapBarcodesByStatus).length === 0) {
      logger.debug('_fixItemStatusAggregation: Skipping because no SCSB statuses provided')
      return Promise.resolve()
    }

    // Count number of ReCAP items by summing the counts for rc* locations:
    const numRecapItems = resp.aggregations.item_location._nested.buckets
      .filter((bucket) => /^loc:rc/.test(bucket.key))
      .reduce((sum, entry) => entry.doc_count + sum, 0)

    // If no ReCAP items, then response has correct item status aggregation
    if (numRecapItems === 0) return Promise.resolve()

    const recapStatusesAsEsAggregation = this._recapStatusesAsEsAggregations(options.recapBarcodesByStatus)

    // Get total number of items:
    const numItems = (resp.hits.hits[0]._source.numItemsTotal || resp.hits.hits[0]._source.numItems)[0]
    logger.debug(`_fixItemStatusAggregation: Total items: ${numItems}. ReCAP items: ${numRecapItems}`)
    logger.debug(`_fixItemStatusAggregation: Original status agg: ${JSON.stringify(resp.aggregations.item_status._nested.buckets)}`)
    logger.debug(`_fixItemStatusAggregation: Incorporating ReCAP statuses: ${JSON.stringify(recapStatusesAsEsAggregation)}}`)

    // If all items are ReCAP items, then the status aggregation we've built is complete:
    if (numRecapItems >= numItems) {
      resp.aggregations.item_status._nested.buckets = recapStatusesAsEsAggregation
      return Promise.resolve()
    } else {
      // Otherwise, this bib has a mix of ReCAP and on-site items
      // So we'll need to build a new status aggregation that merges the
      // non-recap statuses with the recap statuses:
      // First, retrieve a new status agg just representing on-site items:
      const bnum = resp.hits.hits[0]._id
      return nonRecapItemStatusAggregation(bnum)
        .then((nonRecapStatusAggregation) => {
          nonRecapStatusAggregation = this._fixItemStatusAggregationLabels(nonRecapStatusAggregation)
          resp.aggregations.item_status._nested.buckets = this._mergeAggregationBuckets(
            recapStatusesAsEsAggregation,
            nonRecapStatusAggregation
          )
          logger.debug(`_fixItemStatusAggregation: Final aggregation: ${JSON.stringify(resp.aggregations.item_status._nested.buckets)}`)
        }).catch((e) => console.error('Got error: ', e))
    }
  }

  /**
   *  Given an array of item status aggregation buckets (i.e. objects with a
   *  `key` and `doc_count`), returns the same array with fixes to statuses
   *  Specifically, corrects capitalization of the status:na label, which is
   *  often mis-indexed
   */
  _fixItemStatusAggregationLabels (buckets) {
    return buckets.map((bucket) => {
      const id = bucket.key.split('||').shift()
      if (id === config.get('itemAvailability.notAvailable.id')) {
        bucket.key = `${id}||${config.get('itemAvailability.notAvailable.label')}`
      }
      return bucket
    })
  }

  /**
   *  Given an object relating ReCAP statuses (e.g. 'Available', 'Not Available')
   *  to item barcodes, returns an array of objects resembling ES aggregation
   *  buckets (i.e. objects with a `key` and `doc_count`)
   */
  _recapStatusesAsEsAggregations (statusToItemsMap = {}) {
    // Build map relating ReCAP item statuses to counts:
    const recapStatusesToCounts = Object.keys(statusToItemsMap)
      .reduce((h, status) => {
        return Object.assign(h, { [status]: statusToItemsMap[status].length })
      }, {})

    // Build status agg response for just ReCAP statuses:
    return Object.keys(recapStatusesToCounts)
      .map((status) => {
        let key = `${config.get('itemAvailability.notAvailable.id')}||${config.get('itemAvailability.notAvailable.label')}`
        if (status === 'Available') {
          key = `${config.get('itemAvailability.available.id')}||${config.get('itemAvailability.available.label')}`
        }
        return { key, doc_count: recapStatusesToCounts[status] }
      })
  }

  /**
   *  Given two ES aggregation bucket arrays (i.e. arrays of objects
   *  containing key and doc_count props), returns a new array of buckets that
   *  merges the original arrays together, combining buckets that share a key
   */
  _mergeAggregationBuckets (buckets1, buckets2) {
    return buckets2.reduce((merged, bucket2) => {
      const existingBucket = merged
        .filter((b) => b.key === bucket2.key)
        .shift()
      if (existingBucket) {
        existingBucket.doc_count += bucket2.doc_count
      } else {
        merged.push(bucket2)
      }
      return merged
    }, buckets1)
  }

  /**
   *  Given an array of barcodes, returns a hash mapping barcode to SCSB availability
   */
  _createSCSBBarcodeAvailbilityMapping (barcodes) {
    if (barcodes.length === 0) {
      return Promise.resolve({})
    }
    return scsbClient.getItemsAvailabilityForBarcodes(this.barcodes)
      .then((itemsStatus) => {
        if (!Array.isArray(itemsStatus)) {
          logger.warn(`Got bad itemAvailabilityStatus response from SCSB for barcodes (${barcodes}): ${JSON.stringify(itemsStatus)}`)
          return {}
        }
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

  _checkScsbForRecapCustomerCode () {
    const item = this.elasticSearchResponse.hits.hits[0]._source.items[0]
    // If it's an electronic item or a non-recap item, skip it
    if (item.electronicLocator || !this._isInRecap(item)) return Promise.resolve()
    const barcode = this._getItemBarcode(item)
    if (!barcode) return Promise.resolve()

    return scsbClient.recapCustomerCodeByBarcode(barcode)
      .then((mostRecentCustomerCode) => {
        if (!item.recapCustomerCode) item.recapCustomerCode = [mostRecentCustomerCode]
        else if (mostRecentCustomerCode !== item.recapCustomerCode[0]) {
          logger.error('Mismatched customer code', { 'barcode': barcode })
          item.recapCustomerCode[0] = mostRecentCustomerCode
        }
      }).catch((error) => {
        logger.error('Error accessing SCSB for recapCustomerCode check', error)
        return Promise.reject(error)
      })
  }

  _fixItemRequestability (request) {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        if (item.electronicLocator) return item
        item.eddRequestable = false
        item.physRequestable = false
        item.specRequestable = false
        item.requestable = [false]
        const isInRecap = this._isInRecap(item)
        item.eddRequestable = this._fixEddRequestability(item, isInRecap, request)
        item.physRequestable = this._fixPhysRequestability(item, isInRecap)
        item.specRequestable = !!item.aeonUrl
        item.requestable = [item.eddRequestable || item.physRequestable || item.specRequestable]
      })
    }
  }

  _fixEddRequestability (item, isInRecap, request) {
    // If it's a recap item, determine edd based on code
    if (isInRecap) {
      // Some of our items are in RC locations that we mark not EDD requestable
      // regardless of what the customer code would otherwise say:
      if (isItemNyplOwned(item) && !requestableBasedOnHoldingLocation(item)) {
        return false
      }
      if (Array.isArray(item.recapCustomerCode) && recapCustomerCodes[item.recapCustomerCode[0]]) {
        return recapCustomerCodes[item.recapCustomerCode[0]].eddRequestable
        // If item has not been indexed with recap code, default to true.
        // Accurate eddRequestable is fetched once user clicks request item.
      } else {
        return true
      }
    }
    if (Feature.enabled('no-on-site-edd', request)) {
      return false
    } else {
      // If it's onsite, use different criteria
      return DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)
    }
  }

  _fixPhysRequestability (item, isInRecap) {
    // this is not the final physRequestable value. True physRequestable is
    // only determined on the front end via the vars closed_locations and
    // open_locations.
    if (isInRecap) {
      // Some of our items are in RC locations that we mark not requestable
      // regardless of what the customer code would otherwise say:
      if (isItemNyplOwned(item) && !requestability.requestableBasedOnHoldingLocation(item)) {
        return false
      }
      // many recap items are not indexed with recap customer codes
      // first, check if there is a customer code and determine
      // requestability based on that.
      if (item.recapCustomerCode && item.recapCustomerCode[0]) {
        const deliveryLocations = DeliveryLocationsResolver.deliveryLocationsByRecapCustomerCode(item.recapCustomerCode)
        return deliveryLocations && deliveryLocations.length > 0
        // If there is no customer code, recap items default to physRequestable: true
      } else {
        return true
      }
    } else {
      let deliveryLocations
      if (item.m2CustomerCode && item.m2CustomerCode[0]) {
        deliveryLocations = DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode(item.m2CustomerCode)
      }
      const requestableByHoldingLocation = requestability.requestableBasedOnHoldingLocation(item)
      return requestableByHoldingLocation && deliveryLocations && deliveryLocations.length > 0
    }
  }

  _fixItemAvailability (barcodesAndAvailability) {
    for (let hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        const isInRecap = this._isInRecap(item)
        if (item.electronicLocator) return item
        // Only need to calculate recap item availability because nypl-owned records
        // status is updated elsewhere.
        if (isInRecap) {
          const barcode = this._getItemBarcode(item)
          let recapAvailabilityStatus = barcodesAndAvailability[barcode]
          if (recapAvailabilityStatus === 'Available') {
            item.status[0].id = config.get('itemAvailability.available.id')
            item.status[0].label = config.get('itemAvailability.available.label')
          } else {
            item.status[0].id = config.get('itemAvailability.notAvailable.id')
            item.status[0].label = config.get('itemAvailability.notAvailable.label')
          }
          // If item has been mis-indexed with wrong status:na label, fix it:
        } else if (item.status && item.status[0] &&
          item.status[0].id === config.get('itemAvailability.notAvailable.id')) {
          item.status[0].label = config.get('itemAvailability.notAvailable.label')
        }
        return item
      })
    }
  }

  _isInRecap (item) {
    const holdingLocation = (item.holdingLocation || [{}])[0].id
    const isRecapHoldingLocation = (holdingLocation && /^loc:rc/.test(holdingLocation))
    return !!item.recapCustomerCode || isRecapHoldingLocation || !isItemNyplOwned(item)
  }

  _getItemBarcode (item) {
    return (item.identifier || []).reduce((_, identifier) => {
      // Rolling forward, some identifiers will be serialized as entities.
      // For now, let's convert them back to urn-style:
      identifier = ResourceSerializer.prototype._ensureIdentifierIsUrnStyle(identifier)
      if (identifier.split(':').length === 3 && identifier.split(':')[1] === 'barcode') {
        return identifier.split(':')[2]
      }
    }, null)
  }
}  // end class

module.exports = AvailabilityResolver
