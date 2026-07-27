const { expect } = require('chai')
const { getId, search } = require('./helpers')

const normalize = (t) => (typeof t === 'object' ? t.value : t)

// These tests verify that boolean operators (AND, OR, NOT) and grouping work
// correctly in NYQL queries by comparing combined query results against the
// expected union, intersection, or difference of individual query results.

describe('Discovery API - NYQL boolean operator tests', function () {
  this.timeout(30000)

  it('should combine results for OR query: author = "Meillassoux, Quentin" OR title="the cat in the hat"', async () => {
    const authorRes = await search({ q: 'author = "Meillassoux, Quentin"' })
    const titleRes = await search({ q: 'title = "the cat in the hat"' })
    const combinedRes = await search({ q: 'author = "Meillassoux, Quentin" OR title="the cat in the hat"' })

    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const titleTotal = normalize(titleRes.body.totalResults) || 0
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0

    expect(combinedTotal).to.equal(authorTotal + titleTotal)

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    const titleIds = titleRes.body.itemListElement.map(getId).filter(Boolean)
    const combinedIds = combinedRes.body.itemListElement.map(getId).filter(Boolean)

    const expectedIds = [...new Set([...authorIds, ...titleIds])].sort()
    const actualIds = [...combinedIds].sort()

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds)
    }
  })

  it('should combine results for complex OR query: title="the cat in the hat" AND language="Yiddish" OR author = "Meillassoux, Quentin"', async () => {
    const titleLangRes = await search({ q: 'title="the cat in the hat" AND language="Yiddish"' })
    const authorRes = await search({ q: 'author = "Meillassoux, Quentin"' })
    const combinedRes = await search({ q: 'title="the cat in the hat" AND language="Yiddish" OR author = "Meillassoux, Quentin"' })

    const titleLangTotal = normalize(titleLangRes.body.totalResults) || 0
    const authorTotal = normalize(authorRes.body.totalResults) || 0
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0

    expect(combinedTotal).to.equal(titleLangTotal + authorTotal)

    const titleLangIds = titleLangRes.body.itemListElement.map(getId).filter(Boolean)
    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean)
    const combinedIds = combinedRes.body.itemListElement.map(getId).filter(Boolean)

    const expectedIds = [...new Set([...titleLangIds, ...authorIds])].sort()
    const actualIds = [...combinedIds].sort()

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds)
    }
  })

  it('should return results for NOT query: title="the cat in the hat" AND NOT language="Yiddish"', async () => {
    const baseRes = await search({ q: 'title="the cat in the hat"' })
    const excludedRes = await search({ q: 'title="the cat in the hat" AND language="Yiddish"' })
    const combinedRes = await search({ q: 'title="the cat in the hat" AND NOT language="Yiddish"' })

    const baseTotal = normalize(baseRes.body.totalResults) || 0
    const excludedTotal = normalize(excludedRes.body.totalResults) || 0
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0

    expect(combinedTotal).to.equal(baseTotal - excludedTotal)

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean)
    const excludedIds = excludedRes.body.itemListElement.map(getId).filter(Boolean)
    const combinedIds = combinedRes.body.itemListElement.map(getId).filter(Boolean)

    const expectedIds = baseIds.filter((id) => !excludedIds.includes(id)).sort()
    const actualIds = [...combinedIds].sort()

    if (baseTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds)
    }
  })

  it('should return results for NOT query (shorthand): title="the cat in the hat" NOT language="Yiddish"', async () => {
    const baseRes = await search({ q: 'title="the cat in the hat"' })
    const excludedRes = await search({ q: 'title="the cat in the hat" AND language="Yiddish"' })
    const combinedRes = await search({ q: 'title="the cat in the hat" NOT language="Yiddish"' })

    const baseTotal = normalize(baseRes.body.totalResults) || 0
    const excludedTotal = normalize(excludedRes.body.totalResults) || 0
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0

    expect(combinedTotal).to.equal(baseTotal - excludedTotal)

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean)
    const excludedIds = excludedRes.body.itemListElement.map(getId).filter(Boolean)
    const combinedIds = combinedRes.body.itemListElement.map(getId).filter(Boolean)

    const expectedIds = baseIds.filter((id) => !excludedIds.includes(id)).sort()
    const actualIds = [...combinedIds].sort()

    if (baseTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds)
    }
  })

  it('should treat language="yid" the same as language="Yiddish" in NOT query', async () => {
    const yiddishRes = await search({ q: 'title="the cat in the hat" AND NOT language="Yiddish"' })
    const yidRes = await search({ q: 'title="the cat in the hat" AND NOT language="yid"' })

    const yiddishTotal = normalize(yiddishRes.body.totalResults) || 0
    const yidTotal = normalize(yidRes.body.totalResults) || 0

    expect(yidTotal).to.equal(yiddishTotal)

    const yiddishIds = yiddishRes.body.itemListElement.map(getId).filter(Boolean)
    const yidIds = yidRes.body.itemListElement.map(getId).filter(Boolean)

    if (yiddishTotal <= 100) {
      expect([...yidIds].sort()).to.deep.equal([...yiddishIds].sort())
    }
  })

  it('should combine results for complex grouped query: title="the cat in the hat" AND (language="Yiddish" OR author="Meillassoux, Quentin")', async () => {
    const titleLangRes = await search({ q: 'title="the cat in the hat" AND language="Yiddish"' })
    const titleAuthorRes = await search({ q: 'title="the cat in the hat" AND author="Meillassoux, Quentin"' })
    const combinedRes = await search({ q: 'title="the cat in the hat" AND (language="Yiddish" OR author="Meillassoux, Quentin")' })

    const titleLangTotal = normalize(titleLangRes.body.totalResults) || 0
    const titleAuthorTotal = normalize(titleAuthorRes.body.totalResults) || 0
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0

    expect(combinedTotal).to.equal(titleLangTotal + titleAuthorTotal)

    const titleLangIds = titleLangRes.body.itemListElement.map(getId).filter(Boolean)
    const titleAuthorIds = titleAuthorRes.body.itemListElement.map(getId).filter(Boolean)
    const combinedIds = combinedRes.body.itemListElement.map(getId).filter(Boolean)

    const expectedIds = [...new Set([...titleLangIds, ...titleAuthorIds])].sort()
    const actualIds = [...combinedIds].sort()

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds)
    }
  })
})
