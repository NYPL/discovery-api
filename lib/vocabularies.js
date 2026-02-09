const nyplCore = require('./load_nypl_core')
const buildingLocations = require('../data/buildingLocations.json')

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
    return ({ formats, collections, languages: languages.values, buildingLocations })
  }

  app.vocabulary_labels = {}

  app.populate_vocabulary_labels = async function () {
    const vocabularies = await app.vocabularies({}, '')
      .catch((e) => {
        app.logger.error(`Failed to populate vocabularies: ${e}`)
        return {}
      })

    app.vocabulary_labels = Object.entries(vocabularies).reduce((acc, [key, list]) => {
      // flatten vocabularies into a simple { value: label } lookup for each type
      acc[key] = list.reduce((map, item) => {
        map[item.value] = item.label
        return map
      }, {})

      return acc
    }, {})
  }
}
