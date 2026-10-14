const { expect } = require('chai')
const { getId, search } = require('./helpers')

// These tests verify that the oclc index finds records by their OCLC number.
// Test data comes from the Acceptance Criteria tab of the linking fields
// requirements doc ("OCLC Numbers" section).

// Runs an oclc search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL oclc tests', function () {
  this.timeout(30000)

  it('oclc = 15163786 finds b11797404', async () => {
    await expectBib('oclc = 15163786', 'b11797404')
  })

  // This OCLC number also matches a Harvard partner record.
  it('oclc = 21563524 finds b11049433', async () => {
    await expectBib('oclc = 21563524', 'b11049433')
  })

  it('oclc = 642629844 finds b20432027', async () => {
    await expectBib('oclc = 642629844', 'b20432027')
  })

  it('oclc = 1089258717 finds b21967733', async () => {
    await expectBib('oclc = 1089258717', 'b21967733')
  })

  it('oclc = 879158969 finds b21118388', async () => {
    await expectBib('oclc = 879158969', 'b21118388')
  })

  // b15031304 has two OCLC numbers: 47826622 and 52197942.
  // Each way of searching for them should find it.
  it('oclc = 47826622 finds b15031304', async () => {
    await expectBib('oclc = 47826622', 'b15031304')
  })

  it('oclc = 52197942 finds b15031304', async () => {
    await expectBib('oclc = 52197942', 'b15031304')
  })

  it('oclc = 47826622 or oclc = 52197942 finds b15031304', async () => {
    await expectBib('oclc = 47826622 or oclc = 52197942', 'b15031304')
  })

  it('oclc any "47826622 52197942" finds b15031304', async () => {
    await expectBib('oclc any "47826622 52197942"', 'b15031304')
  })

  it('oclc all "47826622 52197942" finds b15031304', async () => {
    await expectBib('oclc all "47826622 52197942"', 'b15031304')
  })

  // Some OCLC numbers have letters in them. These must work too.
  it('oclc = vendorOCM58728734 finds b16308362', async () => {
    await expectBib('oclc = vendorOCM58728734', 'b16308362')
  })
})
