let logger = require('./logger')
const { makeNyplDataApiClient } = require('./data-api-client')

class AvailableDeliveryLocationTypes {
  static getByPatronId (patronID) {
    // If patronID is falsy (i.e. patron is not logged in) they're just a Rearcher:
    if (!patronID) return Promise.resolve(['Research'])

    const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')
    return this._getPatronTypeOf(patronID).then((patronType) => {
      const accessibleDeliveryLocationTypes = (patronTypeMapping[patronType])
        ? patronTypeMapping[patronType]['accessibleDeliveryLocationTypes'] : ['Research']

      return accessibleDeliveryLocationTypes
    })
  }

  static _getPatronTypeOf (patronID) {
    let __start = new Date()

    let apiURL = `patrons/${patronID}`
    return makeNyplDataApiClient().get(apiURL).then((response) => {
      logger.debug(`AvailableDeliveryLocationTypes: response from patron service ${apiURL}: ${JSON.stringify(response, null, 2)}`)
      let patronType = response.data.fixedFields['47']['value']

      // Log response time for science:
      let ellapsed = ((new Date()) - __start)
      logger.debug({ message: `Patron Service patron fetch took ${ellapsed}ms`, metric: 'available_delivery_location_types-_getPatronTypeOf', timeMs: ellapsed })

      return patronType
    }).catch((e) => {
      // We can get more specific based on error type
      let errorMessage = `Error hitting patron service: ${e}`
      logger.error(errorMessage)
      throw new Error(errorMessage)
    })
  }

}

// Why line 42 repeats line 10
let patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')

AvailableDeliveryLocationTypes.patronTypeMapping = patronTypeMapping

module.exports = AvailableDeliveryLocationTypes
