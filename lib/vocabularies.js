const nyplCore = require('./load_nypl_core')
// const ApiRequest = require('./api-request')

module.exports = function (app, _private = null) {
  app.vocabularies = function (params, { baseUrl }) {
    return Promise.resolve({ formats: nyplCore.formats(), collections: nyplCore.collections() })
  }
}
