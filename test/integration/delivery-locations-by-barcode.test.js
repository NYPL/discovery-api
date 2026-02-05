require('dotenv').config('config/qa.env')
const axios = require('axios')

const lpa = 'performing'
const schomburg = 'schomburg'
const sasb = 'schwarzman'
const scholar = 'scholar'
const expectations = {
  princeton: {
    barcode: '32101067443802',
    scholar: { includes: [lpa, schomburg, sasb, scholar], excludes: [] },
    general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  },
  harvard: {
    barcode: '32044135801371',
    scholar: { includes: [lpa, schomburg, sasb, scholar], excludes: [] },
    general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  },
  // // recap customer code MR only to LPA
  columbia: {
    barcode: 'MR75708230',
    scholar: { includes: [lpa], excludes: [scholar] },
    general: { includes: [lpa], excludes: [scholar] }
  },
  nyplOffsite: {
    barcode: '33433073236758',
    scholar: { includes: [lpa, schomburg, sasb, scholar], excludes: [] },
    general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  },
  lpa: {
    barcode: '33433085319774',
    scholar: { includes: [lpa], excludes: [scholar, schomburg, sasb] },
    general: { includes: [lpa], excludes: [scholar, schomburg, sasb] }
  },
  schomburg: {
    barcode: '33433119354979',
    scholar: { includes: [schomburg], excludes: [scholar, sasb, lpa] },
    general: { includes: [schomburg], excludes: [scholar, sasb, lpa] }
  },
  // nyplM1: {
  //   barcode: null,
  //   scholar: { includes: [sasb], excludes: [scholar, lpa, schomburg] },
  //   general: { includes: [sasb], excludes: [scholar, lpa, schomburg] }
  // },
  nyplM2: {
    barcode: '33333069027734',
    scholar: { includes: [sasb, scholar], excludes: [lpa, schomburg] },
    general: { includes: [sasb], excludes: [scholar, lpa, schomburg] }
  }
}

const ptypes = {
  scholar: '5427701',
  general: '67427431'
}

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
      if (!includedValueIncluded) {
        totalMatch = false
        problems.push({ barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToInclude: expectedIncludedValue })
      }
    }
    for (const expectedExcludedValue of expectation[ptype].excludes) {
      const excludedValueExcluded = !deliveryLocationIdsFromApi.some((label) => label.includes(expectedExcludedValue))
      if (!excludedValueExcluded) {
        // throw Error(`${expectedExcludedValue} ${deliveryLocationIdsFromApi}`)
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
    } else console.log(`Delivery locations successfully returned for ${ptype} ptype`, resultsForPtype.match)
  })
}

theThing()
