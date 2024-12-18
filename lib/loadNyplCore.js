let _data
const nyplCoreObjects = require('@nypl/nypl-core-objects')

const loadNyplCoreData = async () => {
  const vocabularies = {
    sierraLocations: 'by-sierra-location',
    recordTypes: 'by-record-types',
    recapCustomerCodes: 'by-recap-customer-code',
    m2CustomerCodes: 'by-m2-customer-code',
    patronTypes: 'by-patron-type'
  }
  await Promise.all(Object.keys(vocabularies).map(async (vocab) => {
    const nyplCoreValues = await nyplCoreObjects(vocabularies[vocab])
    _data[vocab] = nyplCoreValues
  }))
}

const nyplCoreData = () => _data

module.exports = { loadNyplCoreData, nyplCoreData }
