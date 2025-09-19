const nyplCore = require('./load_nypl_core')
const locations = require('../data/locations.json')

module.exports = function (app, _private = null) {
  app.vocabularies = async function (params, { baseUrl }) {
    const languages = await app.resources.aggregation({ field: 'language', per_page: 500 }, { baseUrl: app.baseUrl })
    const aggregationFormats = await app.resources.aggregation({ field: 'format' }, { baseUrl: app.baseUrl })
    const coreFormats = Object.values(nyplCore.formats()).map(
      (val) => ({
        value: val.code,
        label: val.label
      })
    )
    const aggFormatValues = new Set(aggregationFormats.values.map((f) => f.value))
    const formats = coreFormats.filter((f) => aggFormatValues.has(f.value))
    const collections = Object.values(nyplCore.collections()).map(
      (val) => ({
        value: val.code,
        label: val.label,
        holdingLocations: val.holdingLocations
      })
    )
    return ({ formats, collections, languages: languages.values, locations: locations.locations })
  }
}
