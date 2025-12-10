const DeliveryLocationsResolver = require('../delivery-locations-resolver')
const { isInRecap } = require('../util')
const { isItemNyplOwned } = require('../ownership_determination')
const logger = require('../logger')

class Item {
  constructor (innerHitItem) {
    this.item = innerHitItem
    this.itemIsInRecap = isInRecap(this.item)
    this.deliveryInfo = this.itemIsInRecap
      ? DeliveryLocationsResolver.getRecapDeliveryInfo(this.item)
      : DeliveryLocationsResolver.getOnsiteDeliveryInfo(this.item)
    this.isNypl = isItemNyplOwned(this.item)
    this.requestable = [this.eddRequestable || this.physRequestable || this.specRequestable]
  }

  logPhysRequestableInfo (physRequestable, criteria) {
    logger.debug(`item ${this.item.uri}: physRequestable ${physRequestable}. Criteria: ${criteria}`)
  }

  get physRequestable () {
    if (this.item.electronicLocator) return false

    let physRequestable
    let physRequestableCriteria
    const hasRecapCustomerCode = this.item.recapCustomerCode?.[0]
    const itemIsInRecapMissingRecapCustomerCode = this.itemIsInRecap && !hasRecapCustomerCode
    // items without barcodes should not be requestable
    const hasBarcode = (this.item.identifier || []).some((identifier) => /^(urn|bf):[bB]arcode:\w+/.test(identifier))
    const numDeliveryLocations = this.deliveryInfo.deliveryLocation?.length
    if (this.isNypl && this.specRequestable) {
      physRequestable = false
      physRequestableCriteria = 'NYPL owned special collections item'
    } else if (this.isNypl && !hasBarcode) {
      physRequestable = false
      physRequestableCriteria = 'NYPL item missing barcode'
    } else if (this.isNypl && !DeliveryLocationsResolver.requestableBasedOnHoldingLocation(this.item)) {
      physRequestableCriteria = 'Unrequestable holding location'
      physRequestable = false
    } else if (itemIsInRecapMissingRecapCustomerCode) {
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
    const holdingLocation = DeliveryLocationsResolver.extractLocationCode(this.item)
    const nyplCoreLocation = DeliveryLocationsResolver.nyplCoreLocation(holdingLocation)
    const isSpecialCollectionsOnlyAccessType = !!(nyplCoreLocation?.collectionAccessType === 'special')
    return !!this.item.aeonUrl || isSpecialCollectionsOnlyAccessType
  }

  get eddRequestable () {
    if (this.item.electronicLocator) return false
    const deliveryInfo = this.itemIsInRecap
      ? DeliveryLocationsResolver.getRecapDeliveryInfo(this.item)
      : DeliveryLocationsResolver.getOnsiteDeliveryInfo(this.item)
    return !!deliveryInfo.eddRequestable && !this.specRequestable
  }
}

module.exports = Item
