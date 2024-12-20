const _data = {}
const nyplCoreObjects = require('@nypl/nypl-core-objects')

const loadNyplCoreData = () => {
  const vocabularies = {
    sierraLocations: 'by-sierra-location',
    recordTypes: 'by-record-types',
    recapCustomerCodes: 'by-recap-customer-code',
    m2CustomerCodes: 'by-m2-customer-code',
    patronTypes: 'by-patron-type'
  }
  return Promise.all(Object.keys(vocabularies).map(async (vocab) => {
    const nyplCoreValues = await nyplCoreObjects(vocabularies[vocab])
    _data[vocab] = nyplCoreValues
  }))
}

module.exports = {
  loadNyplCoreData,
  patronTypes: () => _data.patronTypes || {},
  sierraLocations: () => _data.sierraLocations || {},
  recapCustomerCodes: () => _data.recapCustomerCodes || {},
  recordTypes: () => _data.recordTypes || {},
  m2CustomerCodes: () => _data.m2CustomerCodes || {}
}
