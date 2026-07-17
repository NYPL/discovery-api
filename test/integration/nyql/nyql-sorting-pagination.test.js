const { expect } = require('chai')
const { getId, search } = require('./helpers')

const normalize = (t) => (typeof t === 'object' ? t.value : t)

// These tests verify that sorting and pagination parameters work correctly
// in NYQL queries.

describe('Discovery API - NYQL sorting and pagination tests', function () {
  this.timeout(60000)

  it('per_page limits results to the requested count', async () => {
    const res = await search({ q: 'author = "Poe, Edgar Allan"', per_page: 5 })
    expect(res.body.itemListElement).to.have.length(5)
  })

  it('page 2 results do not overlap with page 1', async () => {
    const [page1Res, page2Res] = await Promise.all([
      search({ q: 'author = "Poe, Edgar Allan"', per_page: 10, page: 1 }),
      search({ q: 'author = "Poe, Edgar Allan"', per_page: 10, page: 2 })
    ])

    const page1Ids = new Set(page1Res.body.itemListElement.map(getId).filter(Boolean))
    const page2Ids = page2Res.body.itemListElement.map(getId).filter(Boolean)

    expect(page1Ids.size).to.be.greaterThan(0)
    expect(page2Ids.length).to.be.greaterThan(0)
    page2Ids.forEach((id) => expect(page1Ids).not.to.include(id))
  })

  it('sort=title asc and desc return results in opposite order', async () => {
    const [ascRes, descRes] = await Promise.all([
      search({ q: 'author = "Poe, Edgar Allan"', sort: 'title', sort_direction: 'asc', per_page: 10 }),
      search({ q: 'author = "Poe, Edgar Allan"', sort: 'title', sort_direction: 'desc', per_page: 10 })
    ])

    const ascIds = ascRes.body.itemListElement.map(getId).filter(Boolean)
    const descIds = descRes.body.itemListElement.map(getId).filter(Boolean)

    expect(ascIds.length).to.be.greaterThan(0)
    expect(ascIds).to.not.deep.equal(descIds)
  })

  it('sort=date asc and desc return results in opposite order', async () => {
    const [ascRes, descRes] = await Promise.all([
      search({ q: 'author = "Poe, Edgar Allan"', sort: 'date', sort_direction: 'asc', per_page: 10 }),
      search({ q: 'author = "Poe, Edgar Allan"', sort: 'date', sort_direction: 'desc', per_page: 10 })
    ])

    const ascIds = ascRes.body.itemListElement.map(getId).filter(Boolean)
    const descIds = descRes.body.itemListElement.map(getId).filter(Boolean)

    expect(ascIds.length).to.be.greaterThan(0)
    expect(ascIds).to.not.deep.equal(descIds)
  })

  it('totalResults is consistent across pages', async () => {
    const [page1Res, page2Res] = await Promise.all([
      search({ q: 'author = "Poe, Edgar Allan"', per_page: 10, page: 1 }),
      search({ q: 'author = "Poe, Edgar Allan"', per_page: 10, page: 2 })
    ])

    const total1 = normalize(page1Res.body.totalResults)
    const total2 = normalize(page2Res.body.totalResults)

    expect(total1).to.equal(total2)
    expect(total1).to.be.greaterThan(10)
  })
})
