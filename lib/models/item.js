const locationUtils = require('../delivery-locations-resolver')
const Location = require('./Location')
const { isInRecap } = require('../util')
const { isItemNyplOwned } = require('../ownership_determination')
const logger = require('../logger')

class Item {
  constructor (innerHitItem) {
    this.item = innerHitItem
    this.recapCustomerCode = this.item.recapCustomerCode?.[0]
    this.isInRecap = isInRecap({ ...this.item, recapCustomercode: this.recapCustomerCode })
    this.m2CustomerCode = this.item.m2CustomerCode?.[0]
    this.isInRecapMissingRecapCustomerCode = this.isInRecap && !this.recapCustomerCode
    this.location = new Location({
      recapCustomerCode: this.recapCustomerCode,
      m2CustomerCode: this.m2CustomerCode,
      holdingLocation: this.holdingLocation()
    })
    this.isNypl = isItemNyplOwned(this.item)
    this.requestable = [this.eddRequestable || this.physRequestable || this.specRequestable]
    this.propertiesToOverWrite = ['eddRequestable', 'physRequestable', 'specRequestable', 'requestable', 'deliveryLocations']
  }

  get updated () {
    const updated = this.item
    this.propertiesToOverWrite.forEach((property) => {
      updated[property] = this[property]
    })
    return updated
  }

  logPhysRequestableInfo (physRequestable, criteria) {
    logger.debug(`item ${this.item.uri}: physRequestable ${physRequestable}. Criteria: ${criteria}`)
  }

  holdingLocation () {
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
    const numDeliveryLocations = this.location.deliveryLocation.length
    if (this.isNypl && this.specRequestable) {
      physRequestable = false
      physRequestableCriteria = 'NYPL owned special collections item'
    } else if (this.isNypl && !hasBarcode) {
      physRequestable = false
      physRequestableCriteria = 'NYPL item missing barcode'
    } else if (this.isNypl && !this.location.requestable) {
      physRequestableCriteria = 'Unrequestable holding location'
      physRequestable = false
    } else if (this.itemIsInRecapMissingRecapCustomerCode) {
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
    const holdingLocation = locationUtils.extractLocationCode(this.item)
    const nyplCoreLocation = locationUtils.nyplCoreLocation(holdingLocation)
    const isSpecialCollectionsOnlyAccessType = !!(nyplCoreLocation?.collectionAccessType === 'special')
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
      eddRequestable = locationUtils.__eddRequestableByCustomerCode(this.recapCustomerCode)
    } else {
      eddRequestable = false
    }
    return !!eddRequestable && !this.specRequestable
  }
}

Item.updatedWithLocationAndRequestability = (item) => {
  const model = new Item(item)
  return model.updated()
}

module.exports = Item
