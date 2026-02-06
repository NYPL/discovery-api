require('dotenv').config('config/qa.env')
const axios = require('axios')
const { expectations, ptypes } = require('./delivery-locations-constants')
const assert = require('assert')

const barcodeQueryParams = Object.values(expectations).map(expectation => `barcodes[]=${expectation.barcode}`).join('&')

const checkLocationsForPtype = async (ptype = 'scholar') => {
  const { data: { itemListElement: deliveryLocationsPerRecord } } = await axios.get(`http://localhost:8082/api/v0.1/request/deliveryLocationsByBarcode?${barcodeQueryParams}&patronId=${ptypes[ptype]}`)
  const problems = []
  const match = []
  Object.values(expectations).forEach((expectation, i) => {
    // per record
    const deliveryLocationIdsFromApi = deliveryLocationsPerRecord
      // find delivery location data by barcode match - api does not return in consistent order
      .find((deliveryData) => {
        return deliveryData.identifier.some((id) => {
          return id.includes(expectation.barcode)
        })
      })
      .deliveryLocation.map(loc => loc.prefLabel.toLowerCase())
    let totalMatch = true
    const matchObject = { barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToInclude: expectation[ptype].includes, expectedToExclude: expectation[ptype].excludes }
    for (const expectedIncludedValue of expectation[ptype].includes) {
      const includedValueIncluded = deliveryLocationIdsFromApi.some((label) => label.includes(expectedIncludedValue))
      if (!includedValueIncluded || i === 2) {
        totalMatch = false
        problems.push({ barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToInclude: expectedIncludedValue })
      }
    }
    for (const expectedExcludedValue of expectation[ptype].excludes) {
      const excludedValueExcluded = !deliveryLocationIdsFromApi.some((label) => label.includes(expectedExcludedValue))
      if (!excludedValueExcluded) {
        totalMatch = false
        problems.push({ barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToExclude: expectedExcludedValue })
      }
    }
    if (totalMatch) match.push(matchObject)
  })
  return { match, problems }
}

const theThing = async () => {
  const results = await Promise.all(Object.keys(ptypes).map((checkLocationsForPtype)))
  Object.keys(ptypes).forEach((ptype, i) => {
    const resultsForPtype = results[i]
    if (resultsForPtype.problems.length) {
      console.error(`Error with ${ptype} ptype delivery results, `, resultsForPtype.problems)
    }
  })
}

theThing()
