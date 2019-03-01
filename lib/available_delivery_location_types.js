let logger = require('./logger')
const { makeNyplDataApiClient } = require('./data-api-client')
const util = require('../lib/util')
const fs = require('fs')

class AvailableDeliveryLocationTypes {
  static getByPatronId (patronID) {
    // If patronID is falsy (i.e. patron is not logged in) they're just a Rearcher:
    if (!patronID) return Promise.resolve(['Research'])

    const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')

    return this._getPatronTypeOf(patronID)
      .then((patronType) => {
        // Check if patron type is unfamiliar
        return this._isUnfamiliarPatronType(patronTypeMapping, patronType)
          .then((isUnfamiliar) => {
            // Return the result for checking unfamiliar Patron Type list and Patron Type
            return {
              isUnfamiliar,
              patronType
            }
          })
      })
      .then((result) => {
        const accessibleDeliveryLocationTypes = result.isUnfamiliar
          ? ['Research'] : patronTypeMapping[result.patronType]['accessibleDeliveryLocationTypes']

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

  static _isUnfamiliarPatronType (patronTypeMapping, patronType) {
    return util.readJson('data/unfamiliar-patron-type.json')
      .then((result) => {
        let unfamiliarPTypeList = result.unfamiliarPatronType

        if (!patronTypeMapping[patronType]) {
          if (!unfamiliarPTypeList.some((item) => { return item === patronType })) {
            // Set a limited size to the list
            if (unfamiliarPTypeList.length < 100) {
              unfamiliarPTypeList.push(patronType)
              result.unfamiliarPatronType = unfamiliarPTypeList
              // Update unfamiliar Patron Type list
              fs.writeFile(
                'data/unfamiliar-patron-type.json',
                JSON.stringify(result),
                'utf8',
                () => { logger.info('Add new unfamiliar Patron Type to the list') }
              )
            } else {
              logger.debug(`Unfamiliar Patron Type list has more than 100 items. Patron Type ${patronType} is not put on the list`)
            }
          }

          logger.debug(`Patron Type ${patronType} is not recognizable. Here is the list of the unfamiliar Patron Types we have encountered: ${unfamiliarPTypeList}`)

          return true
        } else {
          // Remove the PType from the unfamiliar PType list if it is recognizable now
          unfamiliarPTypeList.forEach((item) => {
            if (item === patronType) {
              unfamiliarPTypeList = unfamiliarPTypeList.filter((item) => item !== patronType)
            }
          })

          if (result.unfamiliarPatronType.length !== unfamiliarPTypeList.length) {
            result.unfamiliarPatronType = unfamiliarPTypeList
            // Update unfamiliar Patron Type list
            fs.writeFile(
              'data/unfamiliar-patron-type.json',
              JSON.stringify(result),
              'utf8',
              () => { logger.info('Remove recognizable Patron Type from the list') }
            )
          }

          return false
        }
      })
      .catch((e) => {
        let errorMessage = `Error checking unfamiliar Patron Type list: ${e}`
        logger.error(errorMessage)
        throw new Error(errorMessage)
      })
  }
}

// Why line 42 repeats line 10
let patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')

AvailableDeliveryLocationTypes.patronTypeMapping = patronTypeMapping

module.exports = AvailableDeliveryLocationTypes
