const logger = require('./logger')
const { makeNyplDataApiClient } = require('./data-api-client')

class AvailableDeliveryLocationTypes {
  static getScholarRoomByPatronId (patronID) {
    // If patronID is falsy (i.e. patron is not logged in) they're just a Rearcher:
    if (!patronID) return Promise.resolve(['Research'])

    const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')
    return this._getPatronTypeOf(patronID)
      .then((patronType) => {
        if (this._isUnfamiliarPatronType(patronTypeMapping, patronType)) {
          return
        }
        const patronTypeData = patronTypeMapping[patronType]
        return patronTypeData.scholarRoom && patronTypeData.scholarRoom.code
      })
  }

  static _getPatronTypeOf (patronID) {
    const __start = new Date()

    const apiURL = `patrons/${patronID}`
    return makeNyplDataApiClient().get(apiURL).then((response) => {
      logger.debug(`AvailableDeliveryLocationTypes: response from patron service ${apiURL}: ${JSON.stringify(response, null, 2)}`)
      const patronType = response.data.fixedFields['47'].value

      // Log response time for science:
      const ellapsed = ((new Date()) - __start)
      logger.debug({ message: `Patron Service patron fetch took ${ellapsed}ms`, metric: 'available_delivery_location_types-_getPatronTypeOf', timeMs: ellapsed })

      return patronType
    }).catch((e) => {
      // We can get more specific based on error type
      const errorMessage = `Error hitting patron service: ${e}`
      logger.error(errorMessage)
      throw new Error(errorMessage)
    })
  }

  static _isUnfamiliarPatronType (patronTypeMapping, patronType) {
    if (!patronTypeMapping[patronType]) {
      logger.info(`Found the Patron Type: ${patronType} is not recognizable.`)
      return true
    } else {
      return false
    }
  }
}

const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')

AvailableDeliveryLocationTypes.patronTypeMapping = patronTypeMapping

module.exports = AvailableDeliveryLocationTypes
