const { expect } = require('chai')
const { getId, search } = require('./helpers')

// These tests verify that the isbn index finds records by their ISBN number.
// Test data comes from the Acceptance Criteria tab of the linking fields
// requirements doc ("ISBN Numbers" section).

// Runs an isbn search and checks that the expected bib comes back.
const expectBib = async (q, bnum) => {
  const res = await search({ q })
  const ids = res.body.itemListElement.map(getId).filter(Boolean)

  expect(ids).to.include(`res:${bnum}`)
}

describe('Discovery API - NYQL isbn tests', function () {
  this.timeout(30000)
  //confirm ISBN search works and ignores formatting noise.
  it('isbn = 9780822945833 finds b22021020', async () => {
    await expectBib('isbn = 9780822945833', 'b22021020')
  })
  it('isbn = 9789934601514 finds b22965224 again', async () => {
    await expectBib('isbn = 9789934601514', 'b22965224')
  })
  it('isbn = 8071131172 finds b12040728', async () => {
    await expectBib('isbn = 8071131172', 'b12040728')
  })

  it('isbn = 582430047X finds b14586714', async () => {
    await expectBib('isbn = 582430047X', 'b14586714')
  })
  // dashes shouldn't matter
  it('isbn = 978-0822-9458-33 finds b22021020', async () => {
    await expectBib('isbn = 978-0822-9458-33', 'b22021020')
  })
  // "Dirty" ISBNs (extra text attached) should match the clean version.
  // Must be quoted since unquoted terms can't contain spaces/parens.
  it('isbn = "392161807X (pbk.)" finds b11305617', async () => {
    await expectBib('isbn = "392161807X (pbk.)"', 'b11305617')
  })
  it('isbn = "9780071544115 (alk. paper)" finds b16868578', async () => {
    await expectBib('isbn = "9780071544115 (alk. paper)"', 'b16868578')
  })

})