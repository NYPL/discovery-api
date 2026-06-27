const request = require('supertest')
const { expect } = require('chai')
const { baseUrl } = require('./helpers')

const normalizeCallnumber = (value) =>
  String(value || '')
    .replace(/^[*"]+|[*"]+$/g, '')
    .trim()
    .toLowerCase()

const resultContainsCallnumber = (result, callnumber) => {
  const target = normalizeCallnumber(callnumber)
  const shelfMarks = [
    ...(Array.isArray(result?.shelfMark) ? result.shelfMark : []),
    ...(Array.isArray(result?.items)
      ? result.items.flatMap((item) =>
        Array.isArray(item?.shelfMark) ? item.shelfMark : []
      )
      : [])
  ]
    .filter(Boolean)
    .map(normalizeCallnumber)

  // Check if any shelf mark contains the target as a substring or exact match
  return shelfMarks.some(
    (mark) => mark.includes(target) || target.includes(mark)
  )
}

// These are some tests to verify that certain NYQL queries are returning results with the expected precision, especially for fields like call numbers where we want to ensure that the query is matching the intended values and not over- or under-matching.

describe('Discovery API - NYQL precision tests', function () {
  this.timeout(30000)

  it('should return exactly one result for callnumber = "JFE 86-3252"', async () => {
    const endpoint = '/discovery/resources'
    const callnumber = 'JFE 86-3252'

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `callnumber = "${callnumber}"`,
        search_scope: 'cql',
        per_page: 100
      })
      .timeout(30000)
      .expect(200)

    expect(res.body.itemListElement).to.be.an('array')

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1)

    // Assert the result contains the target call number
    const result = res.body.itemListElement[0].result
    expect(resultContainsCallnumber(result, callnumber)).to.equal(true)
  })

  it('all returned bibs should contain callnumber = "MGZMD"', async () => {
    const endpoint = '/discovery/resources'
    const callnumber = 'MGZMD'

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `callnumber = "${callnumber}"`,
        search_scope: 'cql',
        per_page: 100
      })
      .timeout(30000)
      .expect(200)

    expect(res.body.itemListElement).to.be.an('array')

    // Assert at least one result
    expect(res.body.itemListElement.length).to.be.greaterThan(0)

    // Assert all results contain the target call number
    res.body.itemListElement.forEach((item, idx) => {
      const result = item.result

      expect(resultContainsCallnumber(result, callnumber)).to.equal(true)
    })
  })

  it('should return exactly one result for identifier = "b10670401"', async () => {
    const endpoint = '/discovery/resources'
    const identifier = 'b10670401'

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `identifier = "${identifier}"`,
        search_scope: 'cql',
        per_page: 100
      })
      .timeout(30000)
      .expect(200)

    expect(res.body.itemListElement).to.be.an('array')

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1)

    // Assert the result contains the target identifier
    const result = res.body.itemListElement[0].result
    expect(result['@id']).to.equal(`res:${identifier}`)
  })
})
