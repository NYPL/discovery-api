const { FILTER_CONFIG } = require('../lib/elasticsearch/config.js')
exports.verifyFilterFields = (filterFields, filterQueryBody) => {
  const stringedFilters = JSON.stringify(filterQueryBody)
  const esFields = filterFields.map((filter) => FILTER_CONFIG[filter].field).flat()
  esFields.forEach((esField) => {
    expect(stringedFilters.includes(esField)).to.equal(true)
  })
}
