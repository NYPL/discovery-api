const { expect } = require('chai')
const { getId, search } = require('./helpers')

// Runs a bib number search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL bib number tests', function () {
  this.timeout(30000)
  it('bibnumber = b11947770 (8-digit, with prefix) finds b11947770', async () => {
    await expectBib('bibnumber = b11947770', 'b11947770')
  })
  it('bibnumber = b119477701 (9-digit w/ check digit, with prefix) finds b11947770', async () => {
    await expectBib('bibnumber = b119477701', 'b11947770')
  })
  it('bibnumber = 11947770 (8-digit, no prefix) finds b11947770', async () => {
    await expectBib('bibnumber = 11947770', 'b11947770')
  })
  it('bibnumber = 119477701 (9-digit, no prefix) finds b11947770', async () => {
    await expectBib('bibnumber = 119477701', 'b11947770')
  })
  it('bibnumber = B11947770 (uppercase prefix) finds b11947770', async () => {
    await expectBib('bibnumber = B11947770', 'b11947770')
  })
  it('bibnumber = B119477701 (uppercase prefix, with check digit) finds b11947770', async () => {
    await expectBib('bibnumber = B119477701', 'b11947770')
  })
})

// Partner records (Princeton pb, Columbia cb, Harvard hb) should be findable
// with their prefix, without it, and regardless of prefix capitalization
describe('Discovery API - NYQL bib number tests - partner prefixes', function () {
  this.timeout(30000)
  it('bibnumber = pb994262093506421 finds pb994262093506421', async () => {
    await expectBib('bibnumber = pb994262093506421', 'pb994262093506421')
    await expectBib('bibnumber = PB994262093506421', 'pb994262093506421')
    await expectBib('bibnumber = 994262093506421', 'pb994262093506421')
  })
  it('bibnumber = cb11363726 finds cb11363726', async () => {
    await expectBib('bibnumber = cb11363726', 'cb11363726')
    await expectBib('bibnumber = CB11363726', 'cb11363726')
    await expectBib('bibnumber = Cb11363726', 'cb11363726')
    await expectBib('bibnumber = 11363726', 'cb11363726')
  })
  it('bibnumber = hb990065213700203941 finds hb990065213700203941', async () => {
    await expectBib('bibnumber = hb990065213700203941', 'hb990065213700203941')
    await expectBib('bibnumber = HB990065213700203941', 'hb990065213700203941')
    await expectBib('bibnumber = 990065213700203941', 'hb990065213700203941')
  })
})
