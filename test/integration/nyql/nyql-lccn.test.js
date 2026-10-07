const { expect } = require('chai')
const { getId, search } = require('./helpers')

// These tests verify that the lccn index finds records by their LCCN number.
// Test data comes from the Acceptance Criteria tab of the linking fields
// requirements doc ("LCCN Numbers" section).

// Runs an lccn search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL lccn tests - type: dashes optional', function () {
  this.timeout(30000)
  it('lccn = 93656168 finds b15986028', async () => {
    await expectBib('lccn = 93656168', 'b15986028')
    await expectBib('lccn = 93-656168', 'b15986028')
  })
  it('lccn = 2001233910 finds b15888643', async () => {
    await expectBib('lccn = 2001233910', 'b15888643')
    await expectBib('lccn = 2001-233910', 'b15888643')
  })
})
describe('Discovery API - NYQL lccn tests - type: extra leading/trailing spaces are ignored', function () {
  this.timeout(30000)
  it('lccn = 93656168 finds b15986028 with extra spaces', async () => {
    await expectBib('lccn =  93656168 ', 'b15986028')
  })
  it('lccn = 92641021 finds b21457839 with extra spaces', async () => {
    await expectBib('lccn =  92641021 ', 'b21457839')
  })
})
describe('Discovery API - NYQL lccn tests - type: zero padding doesnt matter', function () {
  this.timeout(30000)
  it('lccn = 67062762 finds b14262371', async () => {
    await expectBib('lccn = 67062762', 'b14262371')
    await expectBib('lccn = 67-062762', 'b14262371')
    await expectBib('lccn = 67-62762', 'b14262371')
    await expectBib('lccn = 92641021', 'b21457839')
    await expectBib('lccn =  92641021 ', 'b21457839')
  })
})
describe('Discovery API - NYQL lccn tests - type: suffix handling', function () {
  this.timeout(30000)
  it('lccn = 58031783 finds b12564169 with suffix', async () => {
    await expectBib('lccn = 58031783', 'b12564169')
    await expectBib('lccn = "58031783 //r934"', 'b12564169')
  })
})
describe('Discovery API - NYQL lccn tests - type: prefix handling)', function () {
  this.timeout(30000)
  it('lccn = "sn 85066219" finds b15245673', async () => {
    await expectBib('lccn = "sn 85066219"', 'b15245673')
    await expectBib('lccn = sn85066219', 'b15245673')
  })
  it('lccn = "a 40002886" finds b15411483', async () => {
    await expectBib('lccn = "a 40002886"', 'b15411483')
    await expectBib('lccn = "a  40002886"', 'b15411483')
    await expectBib('lccn = a40002886', 'b15411483')
  })
})
describe('Discovery API - NYQL lccn tests - everything combined', function () {
  this.timeout(30000)
  // Values containing spaces must be quoted, or the CQL parser returns a 422.
  it('lccn = "a  50004463 //r623" finds b12030939 with everything combined', async () => {
    await expectBib('lccn = "a  50004463 //r623"', 'b12030939')
    await expectBib('lccn = a50004463', 'b12030939')
    await expectBib('lccn = "a 50004463"', 'b12030939')
    await expectBib('lccn = "a 50004463//r623"', 'b12030939')
    await expectBib('lccn = "a 50-004463 //r623"', 'b12030939')
    await expectBib('lccn = "a 50-4463"', 'b12030939')
  })
})
