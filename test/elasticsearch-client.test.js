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
            search: () => Promise.reject(error)
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
  })

  describe('count', () => {
    let esStub

    beforeEach(() => {
      esStub = sinon.stub(esClient, 'esClient')
        .callsFake(() => {
          return {
            count: sinon.stub().resolves({ count: 42 })
          }
        })
    })

    afterEach(() => {
      esStub.restore()
    })

    it('returns the count value from ES', async () => {
      const body = { query: { match_all: {} } }
      const result = await esClient.count(body, 'my-index')

      expect(result).to.equal(42)
    })

    it('throws IndexConnectionError on 403', async () => {
      esStub.restore()
      sinon.stub(esClient, 'esClient').callsFake(() => {
        return {
          count: () => {
            const err = new Error('Forbidden')
            err.statusCode = 403
            err.body = {}
            return Promise.reject(err)
          }
        }
      })

      const call = esClient.count({ query: { match_all: {} } })
      await expect(call).to.be.rejectedWith(errors.IndexConnectionError)
    })
  })
})
