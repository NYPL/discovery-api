const { expect } = require('chai')
const { search } = require('./helpers')

const { indexMapping } = require('../../../lib/elasticsearch/cql/index-mapping')

// Collects every string value across the title-ish fields on a result,
// lowercased, for substring matching against the query term.
const titleValues = (result) =>
  indexMapping.journaltitle.fields.flatMap((field) => {
    const strippedField = field.split('.')[0]
    const value = result?.[strippedField]
    return Array.isArray(value) ? value : []
  })
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase())

const JOURNAL_ISSUANCE_ID = 'urn:biblevel:s'
const PER_PAGE = 100

// Pages through the full result set for a query (using the max per_page),
// returning every "result" object across all pages.
const fetchAllResults = async (q) => {
  const firstRes = await search({ q, per_page: PER_PAGE, page: 1 })
  const totalResults = Number(
    firstRes.body.totalResults?.value ?? firstRes.body.totalResults
  ) || 0
  const results = firstRes.body.itemListElement.map((item) => item.result)

  const pageCount = Math.ceil(totalResults / PER_PAGE)
  for (let page = 2; page <= pageCount; page++) {
    const res = await search({ q, per_page: PER_PAGE, page })
    results.push(...res.body.itemListElement.map((item) => item.result))
  }

  return { totalResults, results }
}

describe('Discovery API - NYQL journaltitle scope tests', function () {
  this.timeout(120000)
  let totalResults, results
  before(async () => {
    const resp = await fetchAllResults('journaltitle = "nature"')
    totalResults = resp.totalResults
    results = resp.results
  })

  it('journaltitle = "nature" returns results', async () => {
    expect(totalResults).to.be.above(0)
  })

  it('journaltitle = "nature" returns only results with "nature" in some title field, across all pages', async () => {
    results.forEach((result) => {
      const titles = titleValues(result)
      expect(titles.some((title) => title.includes('nature'))).to.equal(true)
    })
  })

  it('journaltitle = "nature" returns only results marked as serials (issuance urn:biblevel:s), across all pages', async () => {
    results.forEach((result) => {
      const issuanceIds = (result?.issuance || []).map((issuance) => issuance['@id'])
      expect(issuanceIds).to.include(JOURNAL_ISSUANCE_ID)
    })
  })
})
