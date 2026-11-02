const { expect } = require('chai')
const sinon = require('sinon')

const esClient = require('../lib/elasticsearch/client')
const { NotFoundError } = require('../lib/errors')
const { theThing } = require('../lib/linked-entry')

// Note: lib/linked-entry.js destructures `getLinkedEntryForUri` off of the
// client module at require-time, so stubbing `esClient.getLinkedEntryForUri`
// directly would have no effect on `theThing`. `getLinkedEntryForUri`
// internally calls `clientWrapper.get` via a live property lookup, so we stub
// `esClient.get` (the lowest level we can intercept) to drive these tests.
const stubLinkedEntries = (linkedEntries) => {
  return sinon.stub(esClient, 'get').resolves({ _source: { linkedEntry: linkedEntries } })
}

describe('linked-entry', () => {
  describe('theThing', () => {
    afterEach(() => {
      if (esClient.get.restore) esClient.get.restore()
    })

    describe('when no linkedEntry matches the given params', () => {
      beforeEach(() => {
        stubLinkedEntries([
          { hash: 111, marcTag: '700', marcTagIndex: 0 },
          { hash: 222, marcTag: '710', marcTagIndex: 1 }
        ])
      })

      it('throws a NotFoundError', async () => {
        const params = { uri: 'b1234', hash: 999, marcTag: '700', marcTagIndex: 0 }
        await expect(theThing(params)).to.be.rejectedWith(NotFoundError)
      })

      it('includes the params and linkedEntries in the error message', async () => {
        const params = { uri: 'b1234', hash: 999, marcTag: '700', marcTagIndex: 0 }
        try {
          await theThing(params)
          throw new Error('expected theThing to reject')
        } catch (e) {
          expect(e).to.be.instanceOf(NotFoundError)
          expect(e.message).to.include('b1234')
          expect(e.message).to.include('incorrect/out of date')
        }
      })
    })

    describe('when linkedEntries is an empty array', () => {
      beforeEach(() => {
        stubLinkedEntries([])
      })

      it('rejects with a NotFoundError', async () => {
        const params = { uri: 'b1234', hash: 999, marcTag: '700', marcTagIndex: 0 }
        await expect(theThing(params)).to.be.rejectedWith(NotFoundError)
      })
    })

    describe('when a linkedEntry matches on hash and marcTag, but marcTagIndex differs (partial match)', () => {
      beforeEach(() => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 5 }
        ])
      })

      it('resolves with a response flagged as potentially stale', async () => {
        const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }
        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response', potentiallyStaleData: true })
      })
    })

    describe('when a linkedEntry matches on hash, marcTag, and marcTagIndex (whole match)', () => {
      beforeEach(() => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 0 }
        ])
      })

      it('resolves with the nyql query response, not flagged as stale', async () => {
        const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }
        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })
    })

    it('looks up the ES doc using the uri from params', async () => {
      const getStub = stubLinkedEntries([{ hash: 1, marcTag: '700', marcTagIndex: 0 }])

      const params = { uri: 'b1234', hash: 1, marcTag: '700', marcTagIndex: 0 }
      await theThing(params).catch(() => {})

      sinon.assert.calledWith(getStub, sinon.match({ id: 'b1234' }))
    })

    it('propagates a NotFoundError raised while fetching the linked entries', async () => {
      const notFoundError = new Error('not found')
      notFoundError.meta = { body: { found: false } }
      sinon.stub(esClient, 'get').rejects(notFoundError)

      const params = { uri: 'b1234', hash: 1, marcTag: '700', marcTagIndex: 0 }
      await expect(theThing(params)).to.be.rejectedWith(NotFoundError, /Record not found: b1234/)
    })

    describe('with multiple linked entries sharing some fields', () => {
      const params = { uri: 'b1234', hash: 123, marcTag: '700', marcTagIndex: 0 }

      it('selects the whole match and ignores decoys that only share one field', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '710', marcTagIndex: 9 }, // hash matches only
          { hash: 999, marcTag: '700', marcTagIndex: 9 }, // marcTag matches only
          { hash: 999, marcTag: '710', marcTagIndex: 0 }, // marcTagIndex matches only
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // the real whole match
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      it('rejects with NotFoundError when every entry shares at most one field with params', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '710', marcTagIndex: 9 }, // hash matches only
          { hash: 999, marcTag: '700', marcTagIndex: 9 }, // marcTag matches only
          { hash: 999, marcTag: '710', marcTagIndex: 0 } // marcTagIndex matches only
        ])

        await expect(theThing(params)).to.be.rejectedWith(NotFoundError)
      })

      it('selects the matching entry when several entries share the same hash but different marcTags', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '650', marcTagIndex: 0 },
          { hash: 123, marcTag: '651', marcTagIndex: 0 },
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // the real match
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      it('selects the matching entry when several entries share hash and marcTag but differ by index', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 0 }, // the real whole match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 1 },
          { hash: 123, marcTag: '700', marcTagIndex: 2 }
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      it('resolves without error when the matching entry is duplicated verbatim', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 0 },
          { hash: 123, marcTag: '700', marcTagIndex: 0 }
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      // `findMatchingLinkedEntry` (lib/linked-entry.js) prefers an exact
      // (whole) match over a partial one regardless of array order. These
      // tests verify that preference holds in both orderings.
      it('prefers the whole match over a partial match that precedes it in the array', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 5 }, // partial match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 0 } // whole match, listed second
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      it('finds the whole match when it precedes a partial match in the array', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 0 }, // whole match, listed first
          { hash: 123, marcTag: '700', marcTagIndex: 5 } // partial match, listed second
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response' })
      })

      it('flags data as stale only when no whole match exists, regardless of partial-match position', async () => {
        stubLinkedEntries([
          { hash: 123, marcTag: '700', marcTagIndex: 5 },
          { hash: 123, marcTag: '700', marcTagIndex: 9 }
        ])

        const resp = await theThing(params)
        expect(resp).to.deep.equal({ message: 'nyql query response', potentiallyStaleData: true })
      })
    })
  })
})
