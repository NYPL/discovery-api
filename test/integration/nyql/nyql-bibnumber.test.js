const { expect } = require('chai')
const { getId, search } = require('./helpers')

// Objective: confirm bib number search works in all 4 common formats. Target: b11947770.
// Runs a bib number search and checks that the expected bib comes back.

// Runs a bib number search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL bib number tests', function () {
  this.timeout(30000)
  it('bib number = b11947770 (8-digit, with prefix) finds b11947770', async () => {
    await expectBib('bib number = b11947770', 'b11947770')
  })
  it('bib number = b119477701 (9-digit w/ check digit, with prefix) finds b11947770', async () => {
    await expectBib('bib number = b119477701', 'b11947770')
  })
  it('bib number = 11947770 (8-digit, no prefix) finds b11947770', async () => {
    await expectBib('bib number = 11947770', 'b11947770')
  })
  it('bib number = 119477701 (9-digit, no prefix) finds b11947770', async () => {
    await expectBib('bib number = 119477701', 'b11947770')
  })
  // Capitalization of the prefix shouldn't matter. Added at Vera's suggestion.
  it('bib number = B11947770 (uppercase prefix) finds b11947770', async () => {
    await expectBib('bib number = B11947770', 'b11947770')
  })
  it('bib number = B119477701 (uppercase prefix, with check digit) finds b11947770', async () => {
    await expectBib('bib number = B119477701', 'b11947770')
  })
})

// Partner records (Princeton pb, Columbia cb, Harvard hb) should be findable
// with their prefix, without it, and regardless of prefix capitalization.  Added at Vera's suggestion.
describe('Discovery API - NYQL bib number tests - partner prefixes', function () {
  this.timeout(30000)
  it('bib number = pb10986524 finds pb10986524', async () => {
    await expectBib('bib number = pb10986524', 'pb10986524')
    await expectBib('bib number = PB10986524', 'pb10986524')
    await expectBib('bib number = 10986524', 'pb10986524')
  })
  it('bib number = cb11363726 finds cb11363726', async () => {
    await expectBib('bib number = cb11363726', 'cb11363726')
    await expectBib('bib number = CB11363726', 'cb11363726')
    await expectBib('bib number = Cb11363726', 'cb11363726')
    await expectBib('bib number = 11363726', 'cb11363726')
  })
  it('bib number = hb990065213700203941 finds hb990065213700203941', async () => {
    await expectBib('bib number = hb990065213700203941', 'hb990065213700203941')
    await expectBib('bib number = HB990065213700203941', 'hb990065213700203941')
    await expectBib('bib number = 990065213700203941', 'hb990065213700203941')
  })
})
