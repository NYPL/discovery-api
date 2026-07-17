const { expect } = require('chai')
const { getId, search } = require('./helpers')

const normalize = (t) => (typeof t === 'object' ? t.value : t)
const getDates = (item) => {
  const dates = item.result?.date || []
  return (Array.isArray(dates) ? dates : [dates]).map((d) => parseInt(d, 10)).filter((d) => !isNaN(d))
}

// These tests verify that date/relational operators (>=, >, <=, <, =, within,
// encloses) work correctly in NYQL queries.

describe('Discovery API - NYQL date operator tests', function () {
  this.timeout(60000)

  it('date >= "2011" returns only author results with date >= 2011', async () => {
    const [authorRes, dateRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date >= "2011"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const dateTotal = normalize(dateRes.body.totalResults) || 0
    expect(dateTotal).to.be.at.most(authorTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    dateRes.body.itemListElement.map(getId).filter(Boolean)
      .forEach((id) => expect(authorIds).to.include(id))

    dateRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) expect(dates.some((d) => d >= 2011)).to.equal(true)
    })

    const dateIdSet = new Set(dateRes.body.itemListElement.map(getId).filter(Boolean))
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d < 2011)) {
        expect(dateIdSet).not.to.include(getId(item))
      }
    })
  })

  it('date > "2011" returns only author results with date > 2011', async () => {
    const [authorRes, dateRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date > "2011"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const dateTotal = normalize(dateRes.body.totalResults) || 0
    expect(dateTotal).to.be.at.most(authorTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    dateRes.body.itemListElement.map(getId).filter(Boolean)
      .forEach((id) => expect(authorIds).to.include(id))

    dateRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) expect(dates.some((d) => d > 2011)).to.equal(true)
    })

    const dateIdSet = new Set(dateRes.body.itemListElement.map(getId).filter(Boolean))
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d <= 2011)) {
        expect(dateIdSet).not.to.include(getId(item))
      }
    })
  })

  it('date <= "2011" returns only author results with date <= 2011', async () => {
    const [authorRes, dateRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date <= "2011"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const dateTotal = normalize(dateRes.body.totalResults) || 0
    expect(dateTotal).to.be.at.most(authorTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    dateRes.body.itemListElement.map(getId).filter(Boolean)
      .forEach((id) => expect(authorIds).to.include(id))

    dateRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) expect(dates.some((d) => d <= 2011)).to.equal(true)
    })

    const dateIdSet = new Set(dateRes.body.itemListElement.map(getId).filter(Boolean))
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d > 2011)) {
        expect(dateIdSet).not.to.include(getId(item))
      }
    })
  })

  it('date < "2011" returns only author results with date < 2011', async () => {
    const [authorRes, dateRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date < "2011"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const dateTotal = normalize(dateRes.body.totalResults) || 0
    expect(dateTotal).to.be.at.most(authorTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    dateRes.body.itemListElement.map(getId).filter(Boolean)
      .forEach((id) => expect(authorIds).to.include(id))

    dateRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) expect(dates.some((d) => d < 2011)).to.equal(true)
    })

    const dateIdSet = new Set(dateRes.body.itemListElement.map(getId).filter(Boolean))
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d >= 2011)) {
        expect(dateIdSet).not.to.include(getId(item))
      }
    })
  })

  it('date = "2015" returns only author results with date 2015', async () => {
    const [authorRes, dateRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date = "2015"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const dateTotal = normalize(dateRes.body.totalResults) || 0
    expect(dateTotal).to.be.at.most(authorTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean)
    dateIds.forEach((id) => expect(authorIds).to.include(id))

    dateRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) expect(dates.some((d) => d === 2015)).to.equal(true)
    })

    const dateIdSet = new Set(dateIds)
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d !== 2015)) {
        expect(dateIdSet).not.to.include(getId(item))
      }
    })

    // date = "2015" results should also appear in both >= "2015" and <= "2015"
    const [gteRes, lteRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin" AND date >= "2015"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date <= "2015"' })
    ])

    const gteIds = new Set(gteRes.body.itemListElement.map(getId).filter(Boolean))
    const lteIds = new Set(lteRes.body.itemListElement.map(getId).filter(Boolean))
    dateIds.forEach((id) => {
      expect(gteIds).to.include(id)
      expect(lteIds).to.include(id)
    })
  })

  it('date within "2011 2014" returns only author results with date in [2011, 2014]', async () => {
    const [authorRes, withinRes, gteRes, lteRes] = await Promise.all([
      search({ q: 'author = "Meillassoux, Quentin"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date within "2011 2014"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date >= "2011"' }),
      search({ q: 'author = "Meillassoux, Quentin" AND date <= "2014"' })
    ])

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const withinTotal = normalize(withinRes.body.totalResults) || 0
    const gteTotal = normalize(gteRes.body.totalResults) || 0
    const lteTotal = normalize(lteRes.body.totalResults) || 0

    expect(withinTotal).to.be.at.most(authorTotal)
    expect(withinTotal).to.be.at.most(gteTotal)
    expect(withinTotal).to.be.at.most(lteTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    const withinIds = withinRes.body.itemListElement.map(getId).filter(Boolean)
    withinIds.forEach((id) => expect(authorIds).to.include(id))

    withinRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0) {
        expect(dates.some((d) => d >= 2011 && d <= 2014)).to.equal(true)
      }
    })

    const withinIdSet = new Set(withinIds)
    authorRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d < 2011 || d > 2014)) {
        expect(withinIdSet).not.to.include(getId(item))
      }
    })
  })

  it('date encloses "1928" returns only results from date > 2000 that include 1928', async () => {
    const [baseRes, enclosesRes] = await Promise.all([
      search({ q: 'title = "journal of paleontology" AND date > "2000"' }),
      search({ q: 'title = "journal of paleontology" AND date > "2000" AND date encloses "1928"' })
    ])

    const baseTotal = normalize(baseRes.body.totalResults) || 0
    const enclosesTotal = normalize(enclosesRes.body.totalResults) || 0
    expect(enclosesTotal).to.be.at.most(baseTotal)

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean)
    enclosesRes.body.itemListElement.map(getId).filter(Boolean)
      .forEach((id) => expect(baseIds).to.include(id))

    // base results where all dates are > 1928 cannot enclose 1928
    const enclosesIdSet = new Set(enclosesRes.body.itemListElement.map(getId).filter(Boolean))
    baseRes.body.itemListElement.forEach((item) => {
      const dates = getDates(item)
      if (dates.length > 0 && dates.every((d) => d > 1928)) {
        expect(enclosesIdSet).not.to.include(getId(item))
      }
    })
  })
})
