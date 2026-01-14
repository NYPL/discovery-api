const _data = {}
const nyplCoreObjects = require('@nypl/nypl-core-objects')
const loadNyplCoreData = () => {
  console.log('Loading nypl core data from ', process.env.NYPL_CORE_VERSION || 'master')
  const vocabularies = {
    collections: 'by-collection',
    sierraLocations: 'by-sierra-location',
    recapCustomerCodes: 'by-recap-customer-code',
    m2CustomerCodes: 'by-m2-customer-code',
    patronTypes: 'by-patron-type',
    formats: 'by-formats'
  }
  return Promise.all(Object.keys(vocabularies).map(async (vocab) => {
    const nyplCoreValues = await nyplCoreObjects(vocabularies[vocab])
    _data[vocab] = nyplCoreValues
  }))
}

module.exports = {
  loadNyplCoreData,
  collections: () => _data.collections || {},
  formats: () => _data.formats || {},
  patronTypes: () => _data.patronTypes || {},
  sierraLocations: () => _data.sierraLocations || {},
  recapCustomerCodes: () => _data.recapCustomerCodes || {},
  m2CustomerCodes: () => _data.m2CustomerCodes || {}
}
