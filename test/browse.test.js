const { expect } = require('chai')
const sinon = require('sinon')

describe('Subjects query', function () {
  const subjectsPrivMethods = {}
  let app

  before(function () {
    app = require('../app')
    // We're passing a reference to a local object `subjectPrivMethods` so
    // that we get access to otherwise private methods defined in lib/subjects
    require('../lib/subjects')(app, subjectsPrivMethods)
  })

  after(() => {
  })

  describe('browse', () => {
    after(() => { app.esClient.search.restore() })

    it('returns expected results', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
        .callsFake(async (body) =>
          (
            {
              hits:
            {
              hits:
                [
                  { _source: { preferredTerm: 'cat', count: 1, broaderTerms: ['Pets'] }, matched_queries: ['preferredTerm'] },
                  { _source: { preferredTerm: 'dog', count: 2, seeAlso: ['Scooby Doo'] }, matched_queries: ['preferredTerm'] }
                ]
            }
            }
          )
        )
      const results = await app.subjects.browse({ q: 'cat' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('subjectList')
      expect(results.subjects.length).to.equal(2)
      expect(results.subjects[0].termLabel).to.equal('cat')
      expect(results.subjects[0]['@type']).to.equal('preferredTerm')
      expect(results.subjects[0].count).to.equal(1)
      expect(results.subjects[1].termLabel).to.equal('dog')
      expect(results.subjects[1]['@type']).to.equal('preferredTerm')
      expect(results.subjects[1].count).to.equal(2)
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
      expect(results.subjects[0].broaderTerms).to.deep.equal([{ termLabel: 'Pets' }])
      expect(results.subjects[1].seeAlso).to.deep.equal([{ termLabel: 'Scooby Doo' }])
    })
  })

  describe('browse with variant hit', () => {
    afterEach(() => { app.esClient.search.restore() })
    it('returns properly cased variants and broader terms', async () => {
      const martialArtsHit = {
        _index: 'browse-qa-2025-08-08',
        _id: 'subject_Martial arts films',
        _score: null,
        _source: {
          termType: 'subject',
          count: 2,
          broaderTerms: [
            'Action and adventure films'
          ],
          seeAlso: [
          ],
          variants: [
            'Kung fu films',
            'Spaghetti Easterns'
          ],
          preferredTerm: 'Martial arts films',
          source: 'authority',
          sourceId: 11890433
        },
        sort: [
          12
        ],
        inner_hits: {
          variants: {
            hits: {
              total: {
                value: 1,
                relation: 'eq'
              },
              max_score: 2.725656,
              hits: [
                {
                  _index: 'browse-qa-2025-09-09',
                  _id: 'subject_Spagetti Easterns',
                  _nested: {
                    field: 'variants',
                    offset: 1
                  },
                  _score: 2.725656,
                  _source: {
                    variant: 'Spaghetti Easterns'
                  }
                }
              ]
            }
          }
        }
      }
      await app.init()
      sinon.stub(app.esClient, 'search')
        .callsFake(async (body) =>
          (
            {
              hits:
            {
              hits:
                [
                  martialArtsHit
                ]
            }
            }
          )
        )
      const results = await app.subjects.browse({ q: 'spaghetti' })
      expect(results.subjects[0].termLabel).to.equal('Spaghetti Easterns')
    })
    it('returns expected results when matching on variants', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
        .callsFake(async (body) =>
          (
            {
              hits:
            {
              hits:
                [
                  {
                    _source: {
                      variants: ['Cat'],
                      preferredTerm: 'kitty',
                      count: 1,
                      broaderTerms: ['Pets', 'Felines']
                    },
                    sort: [12],
                    inner_hits: {
                      variants: {
                        hits: {
                          total: {
                            value: 1,
                            relation: 'eq'
                          },
                          max_score: 2.725656,
                          hits: [
                            {
                              _index: 'browse-qa-2025-09-09',
                              _nested: {
                                field: 'variants',
                                offset: 1
                              },
                              _score: 2.725656,
                              _source: {
                                variant: 'Cat'
                              }
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
            }
            }
          )
        )
      const results = await app.subjects.browse({ q: 'cat' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('subjectList')
      expect(results.subjects.length).to.equal(1)
      expect(results.subjects[0].termLabel).to.equal('Cat')
      expect(results.subjects[0]['@type']).to.equal('variant')
      expect(results.subjects[0].preferredTerms[0].termLabel).to.equal('kitty')
      expect(results.subjects[0].preferredTerms[0].count).to.equal(1)
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
    })
  })

  describe('browse empty results', () => {
    after(() => { app.esClient.search.restore() })
    it('handles empty results', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
        .callsFake(async (body) =>
          (
            {
              hits:
            {
              hits:
                [
                ]
            }
            }
          )
        )
      const results = await app.subjects.browse({ q: 'cat' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('subjectList')
      expect(results.subjects.length).to.equal(0)
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
    })
  })

  describe('parseBrowseParams', function () {
    it('parses params, sets defaults', function () {
      const params = subjectsPrivMethods.parseBrowseParams({})
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal('termLabel')
    })

    it('parses params, using search_scope has', function () {
      const params = subjectsPrivMethods.parseBrowseParams({ search_scope: 'has' })
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('has')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal('count')
    })

    it('parses params, using search_scope starts_with', function () {
      const params = subjectsPrivMethods.parseBrowseParams({ search_scope: 'starts_with' })
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('starts_with')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal('termLabel')
    })
  })

  describe('buildElasticSubjectsBody', function () {
    it('builds search body with defaults', function () {
      const params = subjectsPrivMethods.parseBrowseParams({ q: 'cat' })
      const body = subjectsPrivMethods.buildElasticSubjectsBody(params)
      expect(body).to.be.a('object')
      expect(body.from).to.equal(0)
      expect(body.size).to.equal(50)
      expect(Object.keys(body.query.bool.must[0].bool.should[0].term)).to.contain('preferredTerm.keyword')
      expect(body.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
      expect(Object.keys(body.query.bool.must[0].bool.should[1].nested.query.term)).to.contain('variants.variant.keyword')
      expect(body.query.bool.must[0].bool.should[1].nested.query.term['variants.variant.keyword']).to.equal('cat')
    })
  })

  describe('buildElasticSubjectsBody', function () {
    it('builds search body with sort relevance', function () {
      const params = subjectsPrivMethods.parseBrowseParams({ q: 'cat', sort: 'relevance' })
      const body = subjectsPrivMethods.buildElasticSubjectsBody(params)
      expect(body).to.be.a('object')
      expect(body.from).to.equal(0)
      expect(body.size).to.equal(50)
      expect(Object.keys(body.query.bool.must[0].bool.should[0].term)).to.contain('preferredTerm.keyword')
      expect(body.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
      expect(Object.keys(body.query.bool.must[0].bool.should[1].nested.query.term)).to.contain('variants.variant.keyword')
      expect(body.query.bool.must[0].bool.should[1].nested.query.term['variants.variant.keyword']).to.equal('cat')
      expect(Object.keys(body.sort[0])).to.contain('_score')
    })
  })
})

describe('Contributors query', function () {
  const contributorsPrivMethods = {}
  let app

  before(function () {
    app = require('../app')
    // passing a reference to a local object `contributorsPrivMethods` so
    // that we get access to otherwise private methods defined in lib/contributors.js
    require('../lib/contributors')(app, contributorsPrivMethods)
  })

  after(() => {
  })

  describe('browse', () => {
    after(() => { app.esClient.search.restore() })

    it('returns expected results', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
      // 1st call (app.esClient.search) gets the contributors from the browse index
      esSearchStub.onCall(0).resolves(
        {
          hits: {
            hits: [
              { _source: { preferredTerm: 'Dostoyevsky, Fyodor', count: 1, broaderTerms: ['Russian novelists'] }, matched_queries: ['preferredTerm'] },
              { _source: { preferredTerm: 'Tolstoy, Leo', count: 2, seeAlso: ['War and Peace'] }, matched_queries: ['preferredTerm'] }
            ]
          }
        }
      )
      // 2nd call get the role counts from the resources index
      esSearchStub.onCall(1).resolves(
        {
          aggregations: {
            contributor_role: {
              buckets: [
                { key: 'Dostoyevsky, Fyodor||Author', doc_count: 5 },
                { key: 'Tolstoy, Leo||Author', doc_count: 3 }
              ]
            }
          }
        }
      )

      const results = await app.contributors.browse({ q: 'dostoyevsky' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('contributorList')
      expect(results.contributors.length).to.equal(2)
      expect(results.contributors[0].termLabel).to.equal('Dostoyevsky, Fyodor')
      expect(results.contributors[0]['@type']).to.equal('preferredTerm')
      expect(results.contributors[0].count).to.equal(1)
      expect(results.contributors[0].roleCounts).to.deep.equal([{ role: 'Author', count: 5 }])
      expect(results.contributors[0].broaderTerms).to.deep.equal([{ termLabel: 'Russian novelists' }])
      expect(results.contributors[1].termLabel).to.equal('Tolstoy, Leo')
      expect(results.contributors[1]['@type']).to.equal('preferredTerm')
      expect(results.contributors[1].count).to.equal(2)
      expect(results.contributors[1].roleCounts).to.deep.equal([{ role: 'Author', count: 3 }])
      expect(results.contributors[1].seeAlso).to.deep.equal([{ termLabel: 'War and Peace' }])
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('dostoyevsky')
    })
  })

  describe('browse with variant hit', () => {
    afterEach(() => { app.esClient.search.restore() })

    it('returns variants and broader terms', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
      esSearchStub.onCall(0).resolves(
        {
          hits: {
            hits: [
              {
                _source: {
                  variants: ['Dostoevsky, F.'],
                  preferredTerm: 'Dostoyevsky, Fyodor',
                  count: 1,
                  broaderTerms: ['Russian Novelists']
                },
                sort: [12],
                inner_hits: {
                  variants: {
                    hits: {
                      _index: 'browse-qa-2025-09-09',
                      total: { value: 1, relation: 'eq' },
                      max_score: 2.725656,
                      hits: [
                        { _source: { variant: 'Dostoevsky, F.' } }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      )
      esSearchStub.onCall(1).resolves({}) // empty role counts

      const results = await app.contributors.browse({ q: 'dostoevsky' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('contributorList')
      expect(results.contributors.length).to.equal(1)
      expect(results.contributors[0].termLabel).to.equal('Dostoevsky, F.')
      expect(results.contributors[0]['@type']).to.equal('variant')
      expect(results.contributors[0].preferredTerms[0].termLabel).to.equal('Dostoyevsky, Fyodor')
      expect(results.contributors[0].preferredTerms[0].count).to.equal(1)
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('dostoevsky')
    })
  })

  describe('browse empty results', () => {
    after(() => { app.esClient.search.restore() })

    it('handles empty results', async () => {
      await app.init()
      const esSearchStub = sinon.stub(app.esClient, 'search')
      esSearchStub.onCall(0).resolves({ hits: { hits: [] } })
      esSearchStub.onCall(1).resolves({})

      const results = await app.contributors.browse({ q: 'cat' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('contributorList')
      expect(results.contributors.length).to.equal(0)
      expect(searchBody.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('cat')
    })
  })

  describe('parseBrowseParams', function () {
    it('parses params, sets defaults', function () {
      const params = contributorsPrivMethods.parseBrowseParams({})
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal('termLabel')
    })
  })

  describe('buildElasticContributorsBody', function () {
    it('builds search body with defaults', function () {
      const params = contributorsPrivMethods.parseBrowseParams({ q: 'dostoyevsky' })
      const body = contributorsPrivMethods.buildElasticContributorsBody(params)
      expect(body).to.be.a('object')
      expect(body.from).to.equal(0)
      expect(body.size).to.equal(50)
      expect(Object.keys(body.query.bool.must[0].bool.should[0].term)).to.contain('preferredTerm.keyword')
      expect(body.query.bool.must[0].bool.should[0].term['preferredTerm.keyword'].value).to.equal('dostoyevsky')
      expect(Object.keys(body.query.bool.must[0].bool.should[1].nested.query.term)).to.contain('variants.variant.keyword')
      expect(body.query.bool.must[0].bool.should[1].nested.query.term['variants.variant.keyword']).to.equal('dostoyevsky')
    })
  })

  describe('buildElasticRoleCountQuery', function () {
    it('builds search body querying the .keywordLowercasedStripped fields', function () {
      const contributorList = ['Dostoyevsky, Fyodor']
      const body = contributorsPrivMethods.buildElasticRoleCountQuery(contributorList)

      expect(body).to.be.a('object')
      expect(body.size).to.equal(0)
      expect(body.query.bool.should[0].terms).to.have.property('creatorLiteral.keywordLowercasedStripped')
      expect(body.query.bool.should[0].terms['creatorLiteral.keywordLowercasedStripped']).to.deep.equal(contributorList)
      expect(body.query.bool.should[1].terms).to.have.property('contributorLiteral.keywordLowercasedStripped')
      expect(body.query.bool.should[1].terms['contributorLiteral.keywordLowercasedStripped']).to.deep.equal(contributorList)
    })
  })
})
