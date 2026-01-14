const locationUtils = require('../requestability-utils')
const Location = require('./Location')
const { isInRecap, barcodeFromItem } = require('../util')
const { isItemNyplOwned } = require('../ownership_determination')
const logger = require('../logger')
const { __recapCustomerCodesByBarcodes } = require('../scsb-client')
const nyplCore = require('../load_nypl_core')

class Item {
  constructor (innerHitItem) {
    this.item = innerHitItem
    this.recapCustomerCode = this.item.recapCustomerCode?.[0]
    this.isInRecap = isInRecap({ ...this.item, recapCustomercode: this.item.recapCustomerCode })
    this.m2CustomerCode = this.item.m2CustomerCode?.[0]
    this.isInRecapMissingRecapCustomerCode = this.isInRecap && !this.recapCustomerCode
    this.isNypl = isItemNyplOwned(this.item)
    this.requestable = [this.eddRequestable || this.physRequestable || this.specRequestable]
  }

  get deliveryLocation () {
    return this.location.deliveryLocation
  }

  get location () {
    return new Location({
      recapCustomerCode: this.recapCustomerCode,
      m2CustomerCode: this.m2CustomerCode,
      holdingLocation: this.holdingLocation
    })
  }

  logPhysRequestableInfo (physRequestable, criteria) {
    logger.debug(`item ${this.item.uri}: physRequestable ${physRequestable}. Criteria: ${criteria}`)
  }

  get holdingLocation () {
    if (!Array.isArray(this.item.holdingLocation)) {
      // Log warning if it's our item and lacks a holdingLocation:
      if (/^i/.test(this.item.uri)) {
        logger.warn(`locationUtils#extractLocationCode: Item missing holdingLocation: ${this.item.uri}`)
      } return
    }
    return this.item.holdingLocation[0]?.id?.split(':').pop()
  }

  get physRequestable () {
    if (this.item.electronicLocator) return false

    let physRequestable
    let physRequestableCriteria
    // items without barcodes should not be requestable
    const hasBarcode = (this.item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))
    const numDeliveryLocations = this.deliveryLocation?.length || 0
    if (this.isNypl && this.specRequestable) {
      physRequestable = false
      physRequestableCriteria = 'NYPL owned special collections item'
    } else if (this.isNypl && !hasBarcode) {
      physRequestable = false
      physRequestableCriteria = 'NYPL item missing barcode'
    } else if (this.isNypl && !this.location.requestable) {
      physRequestableCriteria = 'Unrequestable holding location'
      physRequestable = false
    } else if (this.isInRecapMissingRecapCustomerCode) {
      // recap items missing codes should default to true for phys and edd
      // requestable, if it has a requestable holding location.
      physRequestable = true
      physRequestableCriteria = 'Missing customer code'
    } else if (numDeliveryLocations === 0) {
      physRequestableCriteria = 'No delivery locations.'
      physRequestable = false
    } else if (numDeliveryLocations > 0) {
      physRequestableCriteria = `${numDeliveryLocations} delivery locations.`
      physRequestable = true
    }
    this.logPhysRequestableInfo(physRequestable, physRequestableCriteria)
    return physRequestable
  }

  get specRequestable () {
    if (this.item.electronicLocator) return false
    const isSpecialCollectionsOnlyAccessType = !!(this.location.nyplCoreLocation?.collectionAccessType === 'special')
    return !!this.item.aeonUrl || isSpecialCollectionsOnlyAccessType
  }

  get eddRequestable () {
    let eddRequestable
    if (this.item.electronicLocator) return false
    if (!this.isInRecap) {
      eddRequestable = locationUtils.eddRequestableByOnSiteCriteria(this.item)
    } else if (this.isInRecapMissingRecapCustomerCode) {
      const requestableBasedOnHoldingLocation = this.isNypl ? this.location.requestable : true
      eddRequestable = requestableBasedOnHoldingLocation
    } else if (this.recapCustomerCode && (!this.isNypl || this.location.requestable)) {
      eddRequestable = Boolean(nyplCore.recapCustomerCodes()[this.recapCustomerCode].eddRequestable)
    } else {
      eddRequestable = false
    }
    return !!eddRequestable && !this.specRequestable
  }
}

// Given an elastic search inner hits item and a scholar room code, return that
// item with updated edd, phys, and spec requestable values, and valid delivery
// locations
// TODO: Update this method to take a patron instead of a scholar room?
Item.withDeliveryLocationsByBarcode = async function (item, scholarRoom) {
  if (isInRecap(item)) {
    const barcode = barcodeFromItem(item)
    // this customer code fetcher is made to generate a mapping of multiple barcodes,
    // but under the hood it is only fetching one at a time from the API.
    const { [barcode]: recapCustomerCode } = await __recapCustomerCodesByBarcodes([barcode])
    if (recapCustomerCode) item.recapCustomerCode = [recapCustomerCode]
  }
  const model = new Item(item)
  item.eddRequestable = !!model.eddRequestable
  const filteredDeliveryLocationsWithScholarRoom = locationUtils.filterLocations(model.deliveryLocation, scholarRoom)
  item.deliveryLocation = locationUtils.formatLocations(filteredDeliveryLocationsWithScholarRoom)
  return item
}

module.exports = Item
