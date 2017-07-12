let logger = require('./logger')
class AvailableDeliveryLocationTypes {

  static getByPatronId (patronID) {
    // If patronID is falsy (i.e. patron is not logged in) they're just a Rearcher:
    if (!patronID) return Promise.resolve(['Research'])

    const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')
    return this._getPatronTypeOf(patronID).then((patronType) => {
      return patronTypeMapping[patronType]['accessibleDeliveryLocationTypes']
    })
  }

  static _getPatronTypeOf (patronID) {
    let __start = new Date()

    let apiURL = `patrons/${patronID}`
    return client.get(apiURL).then((response) => {
      logger.debug(`response from patron service ${apiURL}: ${JSON.stringify()}`)
      let patronType = response.fixedFields['47']['value']

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

let NyplClient = require('@nypl/nypl-data-api-client')

let client = new NyplClient({
  base_url: process.env.NYPL_API_BASE_URL,
  oauth_key: process.env.NYPL_OAUTH_ID,
  oauth_secret: process.env.NYPL_OAUTH_SECRET,
  oauth_url: process.env.NYPL_OAUTH_URL
})

let patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')

AvailableDeliveryLocationTypes.client = client
AvailableDeliveryLocationTypes.patronTypeMapping = patronTypeMapping

module.exports = AvailableDeliveryLocationTypes
