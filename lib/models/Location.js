const nyplCore = require('../load_nypl_core')

class Location {
  constructor ({ holdingLocation, recapCustomerCode, m2CustomerCode }) {
    console.log('location model constructor holdinglocation', holdingLocation)
    this.nyplCoreLocation = nyplCore.sierraLocations()[holdingLocation]
    console.log('location model constructor nyplcore location data', this.nyplCoreLocation)
    console.log(Object.keys(nyplCore.sierraLocations()))
    this.m2CustomerCode = m2CustomerCode
    this.recapCustomerCode = recapCustomerCode
    this.requestable = this.nyplCoreLocation?.requestable
  }

  get deliverableToResolution () {
    if (this.nyplCoreLocation) {
      return this.nyplCoreLocation.deliverableToResolution
    } else if (this.recapCustomerCode) return 'recap-customer-code'
  }

  get deliveryLocation () {
    // requestable is false (not undefined) only if we know a sierra holding
    // location is not requestable.
    if (this.requestable === false) return
    switch (this.deliverableToResolution) {
      case 'recap-customer-code':
        return this.deliveryLocationsByRecapCustomerCode
      case 'm2-customer-code':
        return this.deliveryLocationsByM2CustomerCode
      default:
        return this.deliveryLocationByHoldingLocation
    }
  }

  get deliveryLocationByHoldingLocation () {
    if (this.nyplCoreLocation?.sierraDeliveryLocations?.length) {
      // It's mapped, but the sierraDeliveryLocation entities only have `code` and `label`
      // Do a second lookup to populate `deliveryLocationTypes`
      console.log(this.nyplCoreLocation.sierraDeliveryLocations)
      return this.nyplCoreLocation.sierraDeliveryLocations.map((deliveryLocation) => {
        // deliveryLocation.deliveryLocationTypes = this.nyplCoreLocation.deliveryLocationTypes
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
