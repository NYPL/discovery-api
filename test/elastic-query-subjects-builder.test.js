const { expect } = require('chai')

const ElasticQuerySubjectsBuilder = require('../lib/elasticsearch/elastic-query-subjects-builder')
const ApiRequest = require('../lib/api-request')

describe('ElasticQuerySubjectsBuilder', () => {
  describe('search_scope=""', () => {
    it('applies subject_prefix clauses to query', () => {
      const request = new ApiRequest({ q: 'toast' })
      const inst = ElasticQuerySubjectsBuilder.forApiRequest(request)

      const query = inst.query.toJson()

      expect(query.bool.must[0].bool.should.length).to.equal(2)
      expect(query.bool.must[0].bool.should[0])
      expect(query.bool.must[0].bool.should[0]).to.deep.equal({
        term: {
          'preferredTerm.keyword': {
            value: 'toast',
            boost: 1
          }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        term: {
          'variants.keyword': {
            value: 'toast',
            boost: 1
          }
        }
      })
    })
  })

  describe('search_scope="has"', () => {
    it('applies subject_prefix clauses to query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'has' })
      const inst = ElasticQuerySubjectsBuilder.forApiRequest(request)

      const query = inst.query.toJson()

      expect(query.bool.must[0].bool.should.length).to.equal(2)
      expect(query.bool.must[0].bool.should[0])
      expect(query.bool.must[0].bool.should[0]).to.deep.equal({
        wildcard: {
          'preferredTerm.keyword': {
            value: '*toast*',
            boost: 1
          }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        wildcard: {
          'variants.keyword': {
            value: '*toast*',
            boost: 1
          }
        }
      })
    })
  })

  describe('search_scope="starts_with"', () => {
    it('applies subject_prefix clauses to query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'starts_with' })
      const inst = ElasticQuerySubjectsBuilder.forApiRequest(request)

      const query = inst.query.toJson()

      expect(query.bool.must[0].bool.should.length).to.equal(2)
      expect(query.bool.must[0].bool.should[0])
      expect(query.bool.must[0].bool.should[0]).to.deep.equal({
        prefix: {
          'preferredTerm.keyword': {
            value: 'toast',
            boost: 1
          }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        prefix: {
          'variants.keyword': {
            value: 'toast',
            boost: 1
          }
        }
      })
    })
  })
})
