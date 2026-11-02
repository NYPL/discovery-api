const { expect } = require('chai')
const sinon = require('sinon')

const errors = require('../lib/errors')
const esClient = require('../lib/elasticsearch/client')

describe('Elasticsearch Client', () => {
  describe('nonRecapItemStatusAggregation', () => {
    beforeEach(() => {
      // We expect these tests to trigger an ES query to retrieve aggregated
      // non-reap-statuses for the bib:
      sinon.stub(esClient, 'search')
        .callsFake(() => {
          return Promise.resolve(require('./fixtures/es-response-b1234-just-non-recap-statuses.json'))
        })
    })

    afterEach(() => esClient.search.restore())

    it('retrieves item status aggregation', async () => {
      const resp = await esClient.nonRecapItemStatusAggregation('b1234')

      expect(resp).to.be.a('array')
      expect(resp).to.deep.equal([
        { key: 'status:a||Available', doc_count: 2 }
      ])
    })
  })

  describe('errors', () => {
    let error

    beforeEach(() => {
      error = new Error()

      sinon.stub(esClient, 'esClient')
        .callsFake(() => {
          return {
            search: () => Promise.reject(error),
            get: () => Promise.reject(error)
          }
        })
    })

    afterEach(() => {
      esClient.esClient.restore()
    })

    it('identifies connection error', () => {
      error.statusCode = 403

      const call = esClient.search({ q: 'foo' })
      return expect(call).to.be.rejectedWith(errors.IndexConnectionError)
    })

    it('identifies lexical error', () => {
      error.statusCode = 400
      error.body = {
        error: {
          type: 'search_phase_execution_exception',
          failed_shards: [
            {
              reason: {
                type: 'query_shard_exception',
                caused_by: {
                  type: 'parse_exception'
                }
              }
            }
          ]
        }
      }

      const call = esClient.search({ q: '"unbalanced' })
      return expect(call).to.be.rejectedWith(errors.IndexSearchError)
    })

    it('generic error', () => {
      const call = esClient.search({ q: 'foo' })
      return expect(call).to.be.rejectedWith(Error)
    })

    it('rejects `get` with IndexConnectionError on 403', () => {
      error.statusCode = 403

      const call = esClient.get({ index: 'resources', id: 'b1234' })
      return expect(call).to.be.rejectedWith(errors.IndexConnectionError)
    })

    it('rejects `get` with the generic error otherwise', () => {
      const call = esClient.get({ index: 'resources', id: 'b1234' })
      return expect(call).to.be.rejectedWith(Error)
    })
  })

  describe('get', () => {
    afterEach(() => {
      if (esClient.esClient.restore) esClient.esClient.restore()
    })

    it('calls esClient().get with the given body and resolves its response', async () => {
      const getStub = sinon.stub().resolves({ _source: { foo: 'bar' } })
      sinon.stub(esClient, 'esClient').callsFake(() => ({ get: getStub }))

      const body = { index: 'resources', id: 'b1234', _source_includes: 'foo' }
      const resp = await esClient.get(body)

      sinon.assert.calledWith(getStub, body)
      expect(resp).to.deep.equal({ _source: { foo: 'bar' } })
    })
  })

  describe('getLinkedEntryForUri', () => {
    afterEach(() => {
      if (esClient.get.restore) esClient.get.restore()
    })

    it('resolves the `linkedEntry` property of the ES doc `_source`', async () => {
      sinon.stub(esClient, 'get').resolves({
        _source: { linkedEntry: [{ hash: 1, marcTag: '700', marcTagIndex: 0 }] }
      })

      const resp = await esClient.getLinkedEntryForUri('b1234')

      expect(resp).to.deep.equal([{ hash: 1, marcTag: '700', marcTagIndex: 0 }])
    })

    it('queries ES using the uri as the doc id, scoped to `linkedEntry`', async () => {
      const getStub = sinon.stub(esClient, 'get').resolves({ _source: { linkedEntry: [] } })

      await esClient.getLinkedEntryForUri('b1234')

      sinon.assert.calledWith(getStub, {
        index: process.env.RESOURCES_INDEX,
        id: 'b1234',
        _source_includes: 'linkedEntry'
      })
    })

    it('throws a NotFoundError when the ES doc is not found', async () => {
      const notFoundError = new Error('not found')
      notFoundError.meta = { body: { found: false } }
      sinon.stub(esClient, 'get').rejects(notFoundError)

      await expect(esClient.getLinkedEntryForUri('b1234')).to.be.rejectedWith(errors.NotFoundError)
    })

    it('swallows other errors and resolves undefined', async () => {
      sinon.stub(esClient, 'get').rejects(new Error('some other ES error'))

      await expect(esClient.getLinkedEntryForUri('b1234')).to.be.rejected
    })
  })
})
