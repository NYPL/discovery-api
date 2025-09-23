const { expect } = require('chai')

const ElasticQuerySubjectsBuilder = require('../lib/elasticsearch/elastic-query-subjects-builder')
const ApiRequest = require('../lib/api-request')

describe('ElasticQuerySubjectsBuilder', () => {
  describe('search_scope=""', () => {
    it('applies subject term clauses to query', () => {
      const request = new ApiRequest({ q: 'toast' })
      const inst = ElasticQuerySubjectsBuilder.forApiRequest(request)

      const query = inst.query.toJson()

      expect(query.bool.must[0].bool.should.length).to.equal(2)
      expect(query.bool.must[0].bool.should[0])
      expect(query.bool.must[0].bool.should[0]).to.deep.equal({
        term: {
          'preferredTerm.keyword': {
            value: 'toast',
            _name: 'preferredTerm'
          }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        nested: {
          inner_hits: {},
          path: 'variants',
          query: {
            term: {
              'variants.variant.keyword': 'toast'
            }
          }
        }
      })
    })
  })

  describe('search_scope="has"', () => {
    it('applies subject match clauses to query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'has' })
      const inst = ElasticQuerySubjectsBuilder.forApiRequest(request)

      const query = inst.query.toJson()

      expect(query.bool.must[0].bool.should.length).to.equal(3)
      expect(query.bool.must[0].bool.should[0])
      expect(query.bool.must[0].bool.should[0]).to.deep.equal({
        match: {
          preferredTerm: {
            _name: 'preferredTerm',
            query: 'toast',
            operator: 'and'
          }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        prefix: {
          preferredTerm: { value: 'toast', _name: 'preferredTermPrefix' }
        }
      })

      expect(query.bool.must[0].bool.should[2]).to.deep.equal({
        nested: {
          inner_hits: {},
          path: 'variants',
          query: {
            match: {
              'variants.variant': {
                query: 'toast',
                operator: 'and'
              }
            }
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
          'preferredTerm.keyword_normalized': { value: 'toast', _name: 'preferredTerm' }
        }
      })

      expect(query.bool.must[0].bool.should[1]).to.deep.equal({
        nested: {
          inner_hits: {},
          path: 'variants',
          query: {
            prefix: {
              'variants.variant.keyword_normalized': 'toast'
            }
          }
        }
      })
    })
  })
})
