const { expect } = require('chai')
const sinon = require('sinon')

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
})
