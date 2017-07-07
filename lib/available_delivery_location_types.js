class AvailableDeliveryLocationTypes {

  static getByPatronId (patronID) {
    const patronType = this._getPatronTypeOf(patronID)
    const patronTypeMapping = require('@nypl/nypl-core-objects')('by-patron-type')
    return patronTypeMapping[patronType]['accessibleDeliveryLocationTypes']
  }

  // TODO: Implement this
  static _getPatronTypeOf (patronID) {
    let response = NyplClient.someMethod(patronID)
    let patronType = response.surgery()
    return patronType
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
