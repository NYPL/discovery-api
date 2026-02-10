const lpa = 'performing'
const schomburg = 'schomburg'
const sasb = 'schwarzman'
const scholar = 'scholar'
const ptypes = {
  scholar: '5427701',
  general: '67427431'
}
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

module.exports = {
  expectations,
  ptypes
}
