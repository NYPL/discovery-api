const nyplCore = require('../load_nypl_core')

class Location {
  constructor ({ holdingLocation, recapCustomerCode, m2CustomerCode }) {
    this.nyplCoreLocation = nyplCore.sierraLocations()[holdingLocation]
    this.m2CustomerCode = m2CustomerCode
    this.recapCustomerCode = recapCustomerCode
    this.requestable = this.nyplCoreLocation?.requestable
    this.deliveryLocation = this.deliveryLocationByHoldingLocation || this.deliveryLocationsByRecapCustomerCode || this.deliveryLocationsByM2CustomerCode
  }

  get deliveryLocationByHoldingLocation () {
    if (!this.requestable) return undefined
    if (this.nyplCoreLocation?.sierraDeliveryLocations?.length) {
      // It's mapped, but the sierraDeliveryLocation entities only have `code` and `label`
      // Do a second lookup to populate `deliveryLocationTypes`
      return this.nyplCoreLocation.sierraDeliveryLocations.map((deliveryLocation) => {
        deliveryLocation.deliveryLocationTypes = this.nyplCoreLocation.deliveryLocationTypes
        return deliveryLocation
      })
    }
  }

  get deliveryLocationsByRecapCustomerCode () {
    if (nyplCore.recapCustomerCodes()[this.recapCustomerCode]?.sierraDeliveryLocations) {
      return nyplCore.recapCustomerCodes()[this.recapCustomerCode].sierraDeliveryLocations
    }
  }

  get deliveryLocationsByM2CustomerCode () {
    if (nyplCore.m2CustomerCodes()?.[this.m2CustomerCode]?.sierraDeliveryLocations) {
      const { sierraDeliveryLocations, requestable } = nyplCore.m2CustomerCodes()[this.m2CustomerCode]
      if (requestable) {
        return sierraDeliveryLocations
      } else return undefined
    }
  }
}

module.exports = Location
