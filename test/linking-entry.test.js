const { expect } = require('chai')
const sinon = require('sinon')

const esClient = require('../lib/elasticsearch/client')
const { LinkingEntryBibNotFoundError, LinkingEntryBadLinkError } = require('../lib/errors')
const { generateNyqlQuery, getNyqlQueryForParams, findMatchingLinkingEntry } = require('../lib/linking-entry')
const { buildElasticQuery } = require('../lib/elasticsearch/elastic-body-builder')

const stubLinkingEntries = (linkingEntries) => {
  return sinon.stub(esClient, 'get').resolves({ _source: { linkingEntry: linkingEntries } })
}

describe('linked-entry', () => {
  describe('generateNyqlQuery', () => {
    const testQueryBuilding = (query) => {
      buildElasticQuery({ q: query, search_scope: 'cql' })
    }
    it('generates a query when all the fields are present, with array id fields', () => {
      const fakeLinkingEntry = { isbn: 'isbn', lccn: 'lccn', oclc: ['(OCLC) oclc1', 'oclc2'], author: 'author of a book', title: 'title of a book', language: 'language' }
      const query = generateNyqlQuery(123, fakeLinkingEntry)
      expect(testQueryBuilding(query))
      expect(query).to.equal('((author adj "author of a book" and title adj "title of a book" and language = "language") or (isbn = "isbn" or oclc = "(OCLC) oclc1" or oclc = "oclc2" or lccn = "lccn")) not bibnumber = 123')
    })
    it('generates a query when some the fields are absent, with array id fields', () => {
      const fakeLinkingEntry = { isbn: 'isbn', oclc: ['(OCLC) oclc1', 'oclc2'], title: 'title of a book' }
      const query = generateNyqlQuery(123, fakeLinkingEntry)
      expect(testQueryBuilding(query))
      expect(query).to.equal('((title adj "title of a book") or (isbn = "isbn" or oclc = "(OCLC) oclc1" or oclc = "oclc2")) not bibnumber = 123')
    })
    it('generates a query when there is only one id field', () => {
      const fakeLinkingEntry = { isbn: 'isbn' }
      const query = generateNyqlQuery(123, fakeLinkingEntry)
      expect(testQueryBuilding(query))
      expect(query).to.equal('((isbn = "isbn")) not bibnumber = 123')
    })
    it('generates a query when there is only one id field', () => {
      const fakeLinkingEntry = { title: 'title of a book' }
      const query = generateNyqlQuery(123, fakeLinkingEntry)
      expect(testQueryBuilding(query))
      expect(query).to.equal('((title adj "title of a book")) not bibnumber = 123')
    })
  })
  describe('findMatchingLinkingEntry', () => {
    it('when a linkingEntry matches on hash and marcTag, but marcTagIndex differs it returns partial match', async () => {
      const entry = { hash: 123, marcTag: '700', marcTagIndex: 5 }

      const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }
      const resp = findMatchingLinkingEntry(params, [entry])
      expect(resp).to.deep.equal({ linkingEntry: entry, partialMatch: true })
    })

    it('indicates when whole match is found', async () => {
      const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }
      const entry = { hash: 123, marcTag: '700', marcTagIndex: 0 }
      const resp = findMatchingLinkingEntry(params, [{ hash: 123, marcTag: '700', marcTagIndex: 0 }])
      expect(resp).to.deep.equal({ linkingEntry: entry, partialMatch: false })
    })
    describe('with multiple linked entries sharing some fields', () => {
      const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }

      it('selects the whole match and ignores decoys that only share one field', async () => {
        const entries = [
          { hash: 123, marcTag: '710', marcTagIndex: 9 }, // hash matches only
          { hash: 999, marcTag: '700', marcTagIndex: 9 }, // marcTag matches only
          { hash: 999, marcTag: '710', marcTagIndex: 0 }, // marcTagIndex matches only
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // the real whole match
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[3], partialMatch: false })
      })

      it('returns null when no matches exist', async () => {
        const entries = [
          { hash: 123, marcTag: '710', marcTagIndex: 9 }, // hash matches only
          { hash: 999, marcTag: '700', marcTagIndex: 9 }, // marcTag matches only
          { hash: 999, marcTag: '710', marcTagIndex: 0 } // marcTagIndex matches only
        ]

        expect(findMatchingLinkingEntry(params, entries)).to.deep.equal(null)
      })

      it('selects the matching entry when several entries share the same hash but different marcTags', async () => {
        const entries = [
          { hash: 123, marcTag: '650', marcTagIndex: 0 },
          { hash: 123, marcTag: '651', marcTagIndex: 0 },
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // the real match
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[2], partialMatch: false })
      })

      it('selects the matching entry when several entries share hash and marcTag but differ by index', async () => {
        const entries = [
          { hash: 123, marcTag: '700', marcTagIndex: 0 }, // the real whole match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 1 },
          { hash: 123, marcTag: '700', marcTagIndex: 2 }
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[0], partialMatch: false })
      })

      it('can handle duplicated entries', async () => {
        const entries = [
          { hash: 123, marcTag: '700', marcTagIndex: 0 },
          { hash: 123, marcTag: '700', marcTagIndex: 0 }
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[0], partialMatch: false })
      })

      it('prefers the whole match over a partial match that precedes it in the array', async () => {
        const entries = [
          { hash: 123, marcTag: '700', marcTagIndex: 5 }, // partial match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // whole match, listed second
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[1], partialMatch: false })
      })

      it('finds the whole match when it precedes a partial match in the array', async () => {
        const entries = [
          { hash: 123, marcTag: '700', marcTagIndex: 0 }, // whole match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 5 } // partial match, listed second
        ]

        const resp = findMatchingLinkingEntry(params, entries)
        expect(resp).to.deep.equal({ linkingEntry: entries[0], partialMatch: false })
      })
    })
  })

  describe('getNyqlQueryForParams', () => {
    afterEach(() => {
      if (esClient.get.restore) esClient.get.restore()
    })
    describe('when no linkingEntry matches the given params', () => {
      beforeEach(() => {
        stubLinkingEntries([
          { hash: 111, marcTag: '700', marcTagIndex: 0 },
          { hash: 222, marcTag: '710', marcTagIndex: 1 }
        ])
      })

      it('includes the params and linkingEntries in the error message', async () => {
        const params = { uri: 'b1234', hash: 999, marcTag: '700', marcTagIndex: 0 }
        try {
          await getNyqlQueryForParams(params)
          throw new Error('expected getNyqlQueryForParams to reject')
        } catch (e) {
          expect(e).to.be.instanceOf(LinkingEntryBadLinkError)
          expect(e.message).to.include('b1234')
          console.log(e.message)
          expect(e.message).to.equal('Request params: {"uri":"b1234","hash":999,"marcTag":"700","marcTagIndex":0}\nLinking entries: [{"hash":111,"marcTag":"700","marcTagIndex":0},{"hash":222,"marcTag":"710","marcTagIndex":1}]')
        }
      })
    })

    it('rejects with a NotFoundError when linkingEntries is an empty array', async () => {
      stubLinkingEntries([])
      const params = { uri: 'b1234', hash: 999, marcTag: '700', marcTagIndex: 0 }
      await expect(getNyqlQueryForParams(params)).to.be.rejectedWith(LinkingEntryBadLinkError)
    })
    it('looks up the ES doc using the uri from params', async () => {
      const getStub = stubLinkingEntries([{ hash: 1, marcTag: '700', marcTagIndex: 0 }])

      const params = { uri: 'b1234', hash: 1, marcTag: '700', marcTagIndex: 0 }
      await getNyqlQueryForParams(params).catch(() => {})

      sinon.assert.calledWith(getStub, sinon.match({ id: 'b1234' }))
    })

    it('propagates a NotFoundError raised while fetching the linked entries', async () => {
      const notFoundError = new Error('not found')
      notFoundError.meta = { body: { found: false } }
      sinon.stub(esClient, 'get').rejects(notFoundError)

      const params = { uri: 'b1234', hash: 1, marcTag: '700', marcTagIndex: 0 }
      await expect(getNyqlQueryForParams(params)).to.be.rejectedWith(LinkingEntryBibNotFoundError, 'b1234')
    })
  })
})
