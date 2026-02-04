require('dotenv').config('config/qa.env')
const axios = require('axios')

const lpa = 'performing'
const schomburg = 'schomburg'
const sasb = 'schwarzman'
const scholar = 'scholar'
const expectations = {
  // princeton: {
  //   barcode: '32101067443802',
  //   scholar: { includes: [lpa, schomburg, sasb, scholar] },
  //   general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  // },
  // harvard: {
  //   barcode: '32044135801371',
  //   scholar: { includes: [lpa, schomburg, sasb, scholar] },
  //   general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  // }
  columbia: {
    barcode: 'MR75708230',
    scholar: { includes: [lpa, schomburg, sasb, scholar] },
    general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  }
  // nyplOffsite: {
  //   barcode: '33433073236758',
  //   scholar: { includes: [lpa, schomburg, sasb, scholar] },
  //   general: { includes: [lpa, schomburg, sasb], excludes: [scholar] }
  // },
  // lpa: {
  //   barcode: '33433085319774',
  //   scholar: { includes: [lpa], excludes: [scholar, schomburg, sasb] },
  //   general: { includes: [lpa], excludes: [scholar, schomburg, sasb] }
  // },
  // schomburg: {
  //   barcode: '33433119354979',
  //   scholar: { includes: [schomburg], excludes: [scholar, sasb, lpa] },
  //   general: { includes: [schomburg], excludes: [scholar, sasb, lpa] }
  // },
  // // nyplM1: {
  // //   barcode: null,
  // //   scholar: { includes: [sasb], excludes: [scholar, lpa, schomburg] },
  // //   general: { includes: [sasb], excludes: [scholar, lpa, schomburg] }
  // // },
  // nyplM2: {
  //   barcode: '33333069027734',
  //   scholar: { includes: [sasb], excludes: [scholar, lpa, schomburg] },
  //   general: { includes: [sasb], excludes: [scholar, lpa, schomburg] }
  // }
}
const barcodeQueryParams = Object.values(expectations).map(expectation => `barcodes[]=${expectation.barcode}`).join('&')
const scholarId = '5427701'

const theThing = async (ptype = 'scholar') => {
  const { data: { itemListElement: deliveryLocationsPerRecord } } = await axios.get(`http://localhost:8082/api/v0.1/request/deliveryLocationsByBarcode?${barcodeQueryParams}&patronId=${scholarId}`)
  const problems = []
  const match = []
  Object.values(expectations).forEach((expectation, i) => {
    // per record
    const deliveryLocationIdsFromApi = deliveryLocationsPerRecord[i].deliveryLocation.map(loc => loc.prefLabel.toLowerCase())
    for (const expectedIncludedValue of expectation.scholar.includes) {
      const includedValueIncluded = deliveryLocationIdsFromApi.some((label) => label.includes(expectedIncludedValue))
      if (!includedValueIncluded) {
        problems.push({ barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToInclude: expectedIncludedValue })
      } else {
        match.push({ barcode: expectation.barcode, deliveryLocationIdsFromApi, expectedToInclude: expectation[ptype].includes })
      }
    }
  })
  console.log(match.length)
  console.log(problems)
}

theThing()
