const { expect } = require('chai')
const { getId, search } = require('./helpers')

// These tests verify that the issn index finds records by their ISSN number.
// Test data comes from the Acceptance Criteria tab of the linking fields
// requirements doc ("ISSN Numbers" section).

// Runs an issn search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL issn tests', function () {
  this.timeout(30000)
  //confirm ISSN search works with and without the dash.
  it('issn = 0042-1014 finds b10585778', async () => {
    await expectBib('issn = 0042-1014', 'b10585778')
    await expectBib('issn = 00421014', 'b10585778')
  })
  it('issn = 0303-9846 finds b11767354', async () => {
    await expectBib('issn = 0303-9846', 'b11767354')
    await expectBib('issn = 03039846', 'b11767354')
  })
  it('issn = 1313-1451 finds b22718174', async () => {
    await expectBib('issn = 1313-1451', 'b22718174')
    await expectBib('issn = 13131451', 'b22718174')
  })
})