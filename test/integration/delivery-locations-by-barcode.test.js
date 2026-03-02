require('dotenv').config('config/qa.env')
const axios = require('axios')
const { expectations, ptypes } = require('./delivery-locations-constants')

const checkLocationsForPtype = async (ptype) => {
  const problems = []
  const match = []
  await Promise.all(Object.values(expectations).map(async (expectation) => {
    const deliveryLocationsFromApi = await getDeliveryLocations(expectation.barcode, ptypes[ptype])
    let totalMatch = true
    const registerProblem = (problem) => {
      problems.push({ barcode: expectation.barcode, deliveryLocationsFromApi, ...problem })
      totalMatch = false
    }
    const checkForValue = (expectedValue, action) => {
      const includedValueIncluded = deliveryLocationsFromApi.some((label) => label.includes(expectedValue))
      const match = action === 'include' ? includedValueIncluded : !includedValueIncluded
      if (!match) {
        registerProblem({ [`expectedTo${action}`]: expectedValue })
      }
    }
    expectation[ptype].includes.forEach((expectedValue) => checkForValue(expectedValue, 'include'))
    expectation[ptype].excludes.forEach((expectedValue) => checkForValue(expectedValue, 'exclude'))
    if (totalMatch) match.push({ barcode: expectation.barcode, deliveryLocationsFromApi, expectedToInclude: expectation[ptype].includes, expectedToExclude: expectation[ptype].excludes })
  }))
  return { match, problems }
}

const getDeliveryLocations = async (barcode, patronId) => {
  const { data: { itemListElement: deliveryLocationsPerRecord } } = await axios.get(`http://localhost:8082/api/v0.1/request/deliveryLocationsByBarcode?barcodes[]=${barcode}&patronId=${patronId}`)
  // per record
  return deliveryLocationsPerRecord[0]
    .deliveryLocation.map(loc => loc.prefLabel.toLowerCase())
}

const theThing = async () => {
  const results = await Promise.all(Object.keys(ptypes).map((checkLocationsForPtype)))
  Object.keys(ptypes).forEach((ptype, i) => {
    const resultsForPtype = results[i]
    if (resultsForPtype.problems.length) {
      console.error(`Error with ${ptype} ptype delivery results, `, resultsForPtype.problems)
    } else console.log(`All delivery location checks for ${ptype} patron type successful`)
  })
}

theThing()
