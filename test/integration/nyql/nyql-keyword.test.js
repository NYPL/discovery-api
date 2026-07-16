const { expect } = require('chai')
const { getId, search } = require('./helpers')

const normalize = (t) => (typeof t === 'object' ? t.value : t)

// These tests verify that keyword operators (=, any, adj, all) work correctly
// in NYQL queries.

describe('Discovery API - NYQL keyword operator tests', function () {
  this.timeout(30000)

  it('keyword = "JFD 75-2521" returns exactly one result', async () => {
    const res = await search({ q: 'keyword = "JFD 75-2521"' })
    expect(res.body.itemListElement).to.have.length(1)
  })

  it('keyword = "33433076754203" returns exactly one result', async () => {
    const res = await search({ q: 'keyword = "33433076754203"' })
    expect(res.body.itemListElement).to.have.length(1)
  })

  it('keyword any "pterosaur pterosaurs" returns at least as many results as either term alone', async () => {
    const [pterosaurRes, pterosaursRes, anyRes] = await Promise.all([
      search({ q: 'keyword = "pterosaur"' }),
      search({ q: 'keyword = "pterosaurs"' }),
      search({ q: 'keyword any "pterosaur pterosaurs"' })
    ])

    const pterosaurTotal = normalize(pterosaurRes.body.totalResults) || 0
    const pterosaursTotal = normalize(pterosaursRes.body.totalResults) || 0
    const anyTotal = normalize(anyRes.body.totalResults) || 0

    expect(anyTotal).to.be.at.least(pterosaurTotal)
    expect(anyTotal).to.be.at.least(pterosaursTotal)

    const pterosaurIds = pterosaurRes.body.itemListElement.map(getId).filter(Boolean)
    const pterosaursIds = pterosaursRes.body.itemListElement.map(getId).filter(Boolean)
    const anyIds = anyRes.body.itemListElement.map(getId).filter(Boolean)

    pterosaurIds.forEach((id) => expect(anyIds).to.include(id))
    pterosaursIds.forEach((id) => expect(anyIds).to.include(id))
  })

  it('keyword all "pterosaur pterosaurs" returns no more results than either term alone', async () => {
    const [pterosaurRes, pterosaursRes, allRes] = await Promise.all([
      search({ q: 'keyword = "pterosaur"' }),
      search({ q: 'keyword = "pterosaurs"' }),
      search({ q: 'keyword all "pterosaur pterosaurs"' })
    ])

    const pterosaurTotal = normalize(pterosaurRes.body.totalResults) || 0
    const pterosaursTotal = normalize(pterosaursRes.body.totalResults) || 0
    const allTotal = normalize(allRes.body.totalResults) || 0

    expect(allTotal).to.be.at.most(pterosaurTotal)
    expect(allTotal).to.be.at.most(pterosaursTotal)

    const pterosaurIds = new Set(pterosaurRes.body.itemListElement.map(getId).filter(Boolean))
    const pterosaursIds = new Set(pterosaursRes.body.itemListElement.map(getId).filter(Boolean))

    allRes.body.itemListElement.map(getId).filter(Boolean).forEach((id) => {
      expect(pterosaurIds).to.include(id)
      expect(pterosaursIds).to.include(id)
    })
  })

  it('keyword adj "jurassic pterosaur" returns only pterosaur results with "jurassic" in the title', async () => {
    const [pterosaurRes, adjRes] = await Promise.all([
      search({ q: 'keyword = "pterosaur"' }),
      search({ q: 'keyword adj "jurassic pterosaur"' })
    ])

    const pterosaurIds = pterosaurRes.body.itemListElement.map(getId).filter(Boolean)
    const adjIds = adjRes.body.itemListElement.map(getId).filter(Boolean)

    // adj results must be a subset of pterosaur results
    adjIds.forEach((id) => expect(pterosaurIds).to.include(id))

    // all adj results should have "jurassic" in the title
    adjRes.body.itemListElement.forEach((item) => {
      const title = (item.result?.titleDisplay?.[0] || item.result?.title?.[0] || '').toLowerCase()
      expect(title).to.include('jurassic')
    })

    // pterosaur results with both "jurassic" and "pterosaur" in the title should appear in adj results
    pterosaurRes.body.itemListElement
      .filter((item) => {
        const title = (item.result?.titleDisplay?.[0] || item.result?.title?.[0] || '').toLowerCase()
        return title.includes('jurassic') && title.includes('pterosaur')
      })
      .forEach((item) => expect(adjIds).to.include(getId(item)))
  })
})
