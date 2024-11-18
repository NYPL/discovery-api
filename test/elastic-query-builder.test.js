const { expect } = require('chai')

const ElasticQueryBuilder = require('../lib/elasticsearch/elastic-query-builder')
const ApiRequest = require('../lib/api-request')

describe('ElasticQueryBuilder', () => {
  describe('search_scope all', () => {
    it('generates an "all" query', () => {
      const request = new ApiRequest({ q: 'toast' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      expect(inst).to.be.a('object')
      expect(inst.query).to.be.a('object')
      expect(inst.query.toJson()).to.be.a('object')

      // Expect a multi_match on term:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].multi_match.type': 'most_fields' })
        .include({ 'bool.must[0].multi_match.query': 'toast' })
        .include({ 'bool.must[0].multi_match.fields[0]': 'title^5' })

      // Expect boosting on several fields:
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf.at.least(12).at.most(14)
    })

    it('generates an appropriate empty search', () => {
      const request = new ApiRequest({ q: '' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      expect(inst).to.be.a('object')
      expect(inst.query).to.be.a('object')
      expect(inst.query.toJson()).to.be.a('object')
      expect(inst.query.toJson().match_all).to.deep.equal({})
    })
  })

  describe('search_scope contributor', () => {
    it('generates a "contributor" query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'contributor' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      expect(inst.query.toJson()).to.be.a('object')

      // Expect a multi_match on term:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].multi_match.type': 'most_fields' })
        .include({ 'bool.must[0].multi_match.query': 'toast' })
        .include({ 'bool.must[0].multi_match.fields[0]': 'creatorLiteral^4' })

      // Expect boosting on several fields:
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf.at.least(7).at.most(9)
    })
  })

  describe('search_scope title', () => {
    it('generates a "title" query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'title' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      expect(inst.query.toJson()).to.be.a('object')

      // Expect a multi_match on term:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].multi_match.type': 'most_fields' })
        .include({ 'bool.must[0].multi_match.query': 'toast' })
        .include({ 'bool.must[0].multi_match.fields[0]': 'title^5' })

      // Expect boosting on several fields:
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf.at.least(9).at.most(11)
    })
  })

  describe('search_scope subject', () => {
    it('generates a "subject" query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'subject' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      // Expect a multi_match on term:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].multi_match.type': 'most_fields' })
        .include({ 'bool.must[0].multi_match.query': 'toast' })
        .include({ 'bool.must[0].multi_match.fields[0]': 'subjectLiteral^2' })

      // Expect only common boosting clauses because RC doesn't use this search-scope at writing
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf(4)
    })
  })

  describe('search_scope standard_number', () => {
    it('generates a "standard_number" query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'standard_number' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      // Expect multiple term/prefix matches on identifier fields:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].bool.should[0].prefix.identifierV2\\.value.value': 'toast' })
        .include({ 'bool.must[0].bool.should[1].term.uri.value': 'toast' })

      // Expect boosting on several identifier fields:
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf.at.least(15).at.most(16)
    })
  })

  describe('search_scope callnumber', () => {
    it('generates a "callnumber" query', () => {
      const request = new ApiRequest({ q: 'toast', search_scope: 'callnumber' })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      // Expect multiple term/prefix matches on identifier fields:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.must[0].bool.should[0].prefix.shelfMark\\.keywordLowercased.value': 'toast' })
        .include({ 'bool.must[0].bool.should[1].nested.query.prefix.items\\.shelfMark\\.keywordLowercased.value': 'toast' })

      // Expect boosting on several identifier fields:
      expect(inst.query.toJson().bool.should)
        .to.be.a('array')
        .have.lengthOf.at.least(4).at.most(5)
    })
  })

  describe('user filters', () => {
    it('applies user filters to query', () => {
      const request = new ApiRequest({ q: 'toast', filters: { buildingLocation: 'ma' } })
      const inst = ElasticQueryBuilder.forApiRequest(request)

      // Expect the top level bool to now have a `filter` prop with the user filter:
      expect(inst.query.toJson()).to.nested
        .include({ 'bool.filter[0].term.buildingLocationIds': 'ma' })
    })
  })

  describe('Advanced Search query params', () => {
    describe('callnumber=', () => {
      it('applies callnumber clauses to query', () => {
        const request = new ApiRequest({ callnumber: 'toast' })
        const inst = ElasticQueryBuilder.forApiRequest(request)

        expect(inst.query.toJson()).to.nested
          .include({
            // Match on bib shelfmark:
            'bool.must[0].bool.must[0].bool.should[0].prefix.shelfMark\\.keywordLowercased.value': 'toast',
            // Match on item shelfmark:
            'bool.must[0].bool.must[0].bool.should[1].nested.path': 'items',
            'bool.must[0].bool.must[0].bool.should[1].nested.query.prefix.items\\.shelfMark\\.keywordLowercased.value': 'toast'
          })
      })
    })

    describe('standard_number=', () => {
      it('applies standard_number clauses to query', () => {
        const request = new ApiRequest({ standard_number: 'toast' })
        const inst = ElasticQueryBuilder.forApiRequest(request)

        expect(inst.query.toJson()).to.nested
          .include({
            // Match on bib identifiers:
            'bool.must[0].bool.must[0].bool.should[0].prefix.identifierV2\\.value.value': 'toast'
          })
          .include({
            // Match on bib id:
            'bool.must[0].bool.must[0].bool.should[1].term.uri.value': 'toast' // ,
          })
          .include({
            // Match on item barcode:
            'bool.must[0].bool.must[0].bool.should[2].nested.path': 'items',
            'bool.must[0].bool.must[0].bool.should[2].nested.query.term.items\\.idBarcode.value': 'toast'
          })
      })
    })

    describe('title=', () => {
      it('applies title clauses to query', () => {
        const request = new ApiRequest({ title: 'toast' })
        const inst = ElasticQueryBuilder.forApiRequest(request)

        // console.log('ES: ', JSON.stringify(inst.query.toJson(), null, 2))
        const query = inst.query.toJson()

        // Assert there's a multi-match:
        expect(query).to.nested
          .include({
            // Multi-match on common title fields:
            'bool.must[0].bool.must[0].multi_match.fields[0]': 'title^5',
            'bool.must[0].bool.must[0].multi_match.query': 'toast'
          })
        // Assert there's at least one of the title boosting clauses:
        const titleShoulds = query.bool.must[0].bool.should
        const prefixMatch = titleShoulds.find((should) => should.prefix)
        expect(prefixMatch).to.deep.equal({
          prefix: {
            'title.keywordLowercasedStripped': {
              value: 'toast',
              boost: 50
            }
          }
        })
      })
    })

    describe('contributor=', () => {
      it('applies contributor clauses to query', () => {
        const request = new ApiRequest({ contributor: 'toast' })
        const inst = ElasticQueryBuilder.forApiRequest(request)

        const query = inst.query.toJson()

        // Assert there's a multi-match:
        expect(query).to.nested
          .include({
            // Multi-match on common creator/contrib fields:
            'bool.must[0].bool.must[0].multi_match.fields[0]': 'creatorLiteral^4',
            'bool.must[0].bool.must[0].multi_match.query': 'toast'
          })
        // Assert there's at least one of the creator boosting clauses:
        const contributorShoulds = query.bool.must[0].bool.should
        const prefixMatch = contributorShoulds.find((should) => should.prefix)
        expect(prefixMatch).to.deep.equal({
          prefix: {
            'creatorLiteralNormalized.keywordLowercased': {
              value: 'toast',
              boost: 100
            }
          }
        })
      })
    })

    describe('multiple adv search params', () => {
      it('applies contributor clauses to query', () => {
        const request = new ApiRequest({
          title: 'title value',
          contributor: 'contributor value',
          callnumber: 'callnumber value'
        })
        const inst = ElasticQueryBuilder.forApiRequest(request)

        console.log('ES: ', JSON.stringify(inst.query.toJson(), null, 2))
        const query = inst.query.toJson()

        // Assert there's a multi-match:
        expect(query).to.nested
          .include({
            // Multi-match on title fields:
            'bool.must[0].bool.must[0].multi_match.fields[0]': 'title^5',
            'bool.must[0].bool.must[0].multi_match.query': 'title value',

            // Multi-match on creator/contrib fields:
            'bool.must[1].bool.must[0].multi_match.fields[0]': 'creatorLiteral^4',
            'bool.must[1].bool.must[0].multi_match.query': 'contributor value'
          })

        // Assert there's at least one of the title boosting clauses:
        const titleShoulds = query.bool.must[0].bool.should
        const prefixMatch = titleShoulds.find((should) => should.prefix)
        expect(prefixMatch).to.deep.equal({
          prefix: {
            'title.keywordLowercasedStripped': {
              value: 'title value',
              boost: 50
            }
          }
        })

        // Assert there's at least one of the creator boosting clauses:
        const creatorShoulds = query.bool.must[1].bool.should
        const creatorPrefixMatch = creatorShoulds.find((should) => should.prefix)
        expect(creatorPrefixMatch).to.deep.equal({
          prefix: {
            'creatorLiteralNormalized.keywordLowercased': {
              value: 'contributor value',
              boost: 100
            }
          }
        })
      })
    })
  })
})
