const nyplCore = require('./load_nypl_core')
const locations = require('../data/locations.json')

module.exports = function (app, _private = null) {
  app.vocabularies = async function (params, { baseUrl }) {
    const languages = await app.resources.aggregation({ field: 'language', per_page: 500 }, { baseUrl: app.baseUrl })
    const formats = Object.values(nyplCore.formats()).map(
      (val) => ({
        value: val.code,
        label: val.label
      })
    )
    const collections = Object.values(nyplCore.collections()).map(
      (val) => ({
        value: val.code,
        label: val.label,
        holdingLocations: val.holdingLocations
      })
    )
    return Promise.resolve({ formats, collections, languages: languages.values, locations: locations.locations })
  }
}
