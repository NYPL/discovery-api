const scsbClient = require('./scsb-client')
const logger = require('./logger')
const ResourceSerializer = require('./jsonld_serializers').ResourceSerializer
const NyplSourceMapper = require('research-catalog-indexer/lib/utils/nypl-source-mapper')
const { nonRecapItemStatusAggregation } = require('./elasticsearch/client')
const { deepValue, isInRecap } = require('./util')

const ITEM_STATUSES = {
  available: {
    id: 'status:a',
    label: 'Available'
  },
  notAvailable: {
    id: 'status:na',
    label: 'Not available'
  }
}

class AvailabilityResolver {
  constructor (responseReceived) {
    this.elasticSearchResponse = responseReceived
    this.barcodes = this._parseBarCodesFromESResponse()
  }

  /**
  * Given a map relating status strings to arrays of barcodes,
  * returns a map relating each barcode to a status string.
  */
  static invertBarcodeByStatusMapping (barcodesByStatus) {
    if (!barcodesByStatus || typeof barcodesByStatus !== 'object') {
      return {}
    }
    return Object.keys(barcodesByStatus)
      .reduce((h, status) => {
        const barcodeToStatusPairs = barcodesByStatus[status]
          .map((barcode) => ({ [barcode]: status }))
        return Object.assign(h, ...barcodeToStatusPairs)
      }, {})
  }

  // returns an updated elasticSearchResponse with the newest availability info from SCSB
  responseWithUpdatedAvailability (options = {}) {
    // If this serialization is a result of a hold request initializing, we want
    // to double check the recap customer code in SCSB
    const updateRecapCustomerCodes = (options && options.queryRecapCustomerCode)
      ? () => this._checkScsbForRecapCustomerCode()
      : () => Promise.resolve()

    // When options.recapBarcodesByStatus is set, we can use it in place of
    // re-querying status by barcode:
    const barcodeToStatusMap = async () => {
      if (options.recapBarcodesByStatus) {
        // Invert mapping to map barcodes to statuses:
        return AvailabilityResolver.invertBarcodeByStatusMapping(options.recapBarcodesByStatus)
      } else {
        return this._createSCSBBarcodeAvailbilityMapping(this.barcodes)
      }
    }

    // Get 1) barcode-availability mapping and 2) customer code query in
    // parallel because they don't depend on each other:
    return Promise.all([
      barcodeToStatusMap(),
      updateRecapCustomerCodes()
    ])
      .then((barcodeMappingAndCustomerCodeResult) => {
        // We only care about the result of the barcode lookup because
        // _checkScsbForRecapCustomerCode updates this.elasticSearchResponse:
        const [barcodesAndAvailability] = barcodeMappingAndCustomerCodeResult
        this._fixItemAvailability(barcodesAndAvailability)
        return this._fixItemStatusAggregation(options)
          .then(() => this._fixItemStatusAggregationLabels())
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
  async _fixItemStatusAggregation (options) {
    const resp = this.elasticSearchResponse

    // Return early if there are no item aggregations to fix:
    if (!deepValue(resp, 'aggregations.item_location._nested.buckets')) return Promise.resolve()

    // Return early if we don't have scsb statuses (i.e. api issue)
    if (!options.recapBarcodesByStatus ||
      Object.keys(options.recapBarcodesByStatus).length === 0) {
      logger.debug('_fixItemStatusAggregation: Skipping because no SCSB statuses provided')
      return Promise.resolve()
    }
    const bnum = resp.hits.hits[0]?._id
    if (!bnum) return Promise.resolve()

    const nyplSourceMapper = await NyplSourceMapper.instance()
    const { nyplSource } = nyplSourceMapper.splitIdentifier(bnum)

    // Get total number of items:
    const numItems = (resp.hits.hits[0]._source.numItemsTotal || resp.hits.hits[0]._source.numItems)[0]

    // For partner bibs, all items are ReCAP items:
    const numRecapItems = nyplSource !== 'sierra-nypl'
      ? numItems
      // For NYPL bibs, count number of ReCAP items by summing the counts for
      // rc* locations:
      : resp.aggregations.item_location._nested.buckets
        .filter((bucket) => /^loc:rc/.test(bucket.key))
        .reduce((sum, entry) => entry.doc_count + sum, 0)

    // If no ReCAP items, then response has correct item status aggregation
    if (numRecapItems === 0) return Promise.resolve()

    const recapStatusesAsEsAggregation = this._recapStatusesAsEsAggregations(options.recapBarcodesByStatus)

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
          resp.aggregations.item_status._nested.buckets = this._mergeAggregationBuckets(
            recapStatusesAsEsAggregation,
            nonRecapStatusAggregation
          )
          logger.debug(`_fixItemStatusAggregation: Final aggregation: ${JSON.stringify(resp.aggregations.item_status._nested.buckets)}`)
        }).catch((e) => {
          console.error('Got error: ', e)
          return Promise.resolve()
        })
    }
  }

  /**
   *  If the ES response has item_status aggregations, makes sure the
   *  aggregated values have the correct status label.
   *  Specifically, corrects capitalization of the status:na label, which is
   *  often mis-indexed
   */
  _fixItemStatusAggregationLabels () {
    const resp = this.elasticSearchResponse

    if (!deepValue(resp, 'aggregations.item_status._nested.buckets')) return Promise.resolve()

    const buckets = resp.aggregations.item_status._nested.buckets
    resp.aggregations.item_status._nested.buckets = buckets.map((bucket) => {
      const id = bucket.key.split('||').shift()
      if (id === ITEM_STATUSES.notAvailable.id) {
        bucket.key = `${id}||${ITEM_STATUSES.notAvailable.label}`
      }
      return bucket
    })
    return Promise.resolve()
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
        let key = `${ITEM_STATUSES.notAvailable.id}||${ITEM_STATUSES.notAvailable.label}`
        if (status === 'Available') {
          key = `${ITEM_STATUSES.available.id}||${ITEM_STATUSES.available.label}`
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
  async _createSCSBBarcodeAvailbilityMapping (barcodes) {
    if (barcodes.length === 0) {
      return {}
    }
    let itemsStatus
    try {
      itemsStatus = await scsbClient.getItemsAvailabilityForBarcodes(this.barcodes)
    } catch (e) {
      logger.warn(`Error retrieving SCSB statuses for barcodes: ${e}`)
      return {}
    }

    if (!Array.isArray(itemsStatus)) {
      logger.warn(`Got bad itemAvailabilityStatus response from SCSB for barcodes (${barcodes}): ${JSON.stringify(itemsStatus)}`)
      return {}
    }

    // Convert SCSB API response into barcode => status map:
    return itemsStatus
      // Verify the entries have the properties we expect:
      .filter((entry) => entry.itemBarcode && entry.itemAvailabilityStatus)
      .reduce((h, entry) => {
        return Object.assign(h, { [entry.itemBarcode]: entry.itemAvailabilityStatus })
      }, {})
  }

  _parseBarCodesFromESResponse () {
    const barcodes = []
    for (const hit of this.elasticSearchResponse.hits.hits) {
      for (const item of (hit._source.items || [])) {
        // despite its singular name item.identifier is an Array of barcodes
        if (item.identifier) {
          for (let identifier of item.identifier) {
            // Rolling forward, some identifiers will be serialized as entities.
            // For now, let's convert them back to urn-style:
            identifier = ResourceSerializer.prototype._ensureIdentifierIsUrnStyle(identifier)

            const barcodeArray = identifier.split(':')
            if (barcodeArray.length === 3 && barcodeArray[1] === 'barcode') {
              barcodes.push(barcodeArray[barcodeArray.length - 1])
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
    if (item.electronicLocator || !isInRecap(item)) return Promise.resolve()
    const barcode = this._getItemBarcode(item)
    if (!barcode) return Promise.resolve()

    return scsbClient.recapCustomerCodeByBarcode(barcode)
      .then((mostRecentCustomerCode) => {
        if (!mostRecentCustomerCode) {
          logger.debug('Not updating item with most recent customer code because none returned')
          return
        }
        if (!item.recapCustomerCode) item.recapCustomerCode = [mostRecentCustomerCode]
        else if (mostRecentCustomerCode !== item.recapCustomerCode[0]) {
          logger.error('Mismatched customer code', { barcode })
          item.recapCustomerCode[0] = mostRecentCustomerCode
        }
      }).catch((error) => {
        logger.error('Error accessing SCSB for recapCustomerCode check', error)
        return Promise.reject(error)
      })
  }

  _fixItemAvailability (barcodesAndAvailability) {
    for (const hit of this.elasticSearchResponse.hits.hits) {
      (hit._source.items || []).map((item) => {
        const _isInRecap = isInRecap(item)
        if (item.electronicLocator) return item
        // Only need to calculate recap item availability because nypl-owned records
        // status is updated elsewhere.
        if (_isInRecap) {
          const barcode = this._getItemBarcode(item)
          const recapAvailabilityStatus = barcodesAndAvailability[barcode]
          if (recapAvailabilityStatus === 'Available') {
            item.status[0].id = ITEM_STATUSES.available.id
            item.status[0].label = ITEM_STATUSES.available.label
          } else {
            item.status[0].id = ITEM_STATUSES.notAvailable.id
            item.status[0].label = ITEM_STATUSES.notAvailable.label
          }
          // If item has been mis-indexed with wrong status:na label, fix it:
        } else if (item.status && item.status[0] &&
          item.status[0].id === ITEM_STATUSES.notAvailable.id) {
          item.status[0].label = ITEM_STATUSES.notAvailable.label
        }
        return item
      })
    }
  }

  _getItemBarcode (item) {
    // TODO: This is an awkward use of .reduce. Should prob use .find
    return (item.identifier || []).reduce((_, identifier) => {
      // Rolling forward, some identifiers will be serialized as entities.
      // For now, let's convert them back to urn-style:
      identifier = ResourceSerializer.prototype._ensureIdentifierIsUrnStyle(identifier)
      if (identifier.split(':').length === 3 && identifier.split(':')[1] === 'barcode') {
        return identifier.split(':')[2]
      }
      return null
    }, null)
  }
} // end class

module.exports = AvailabilityResolver
