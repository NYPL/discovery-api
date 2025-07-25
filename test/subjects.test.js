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
                      { _source: { preferredTerm: 'cat', count: 1 } },
                      { _source: { preferredTerm: 'dog', count: 2 } }
                    ]
                }
            }
          )
        )
      const results = await app.subjects.browse({ q: 'cat' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(results['@type']).to.equal('subjectList')
      expect(results.subjects.length).to.equal(2)
      expect(results.subjects[0].preferredTerm).to.equal('cat')
      expect(results.subjects[0].count).to.equal(1)
      expect(results.subjects[1].preferredTerm).to.equal('dog')
      expect(results.subjects[1].count).to.equal(2)
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
      expect(params.sort).to.equal('preferredTerm')
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
      expect(params.sort).to.equal('preferredTerm')
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
      expect(Object.keys(body.query.bool.must[0].bool.should[1].term)).to.contain('variants.keyword')
      expect(body.query.bool.must[0].bool.should[1].term['variants.keyword'].value).to.equal('cat')
      expect(Object.keys(body.sort[0])).to.contain('preferredTerm.keyword')
      expect(body.sort[0]['preferredTerm.keyword']).to.equal('asc')
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
      expect(Object.keys(body.query.bool.must[0].bool.should[1].term)).to.contain('variants.keyword')
      expect(body.query.bool.must[0].bool.should[1].term['variants.keyword'].value).to.equal('cat')
      expect(Object.keys(body.sort[0])).to.contain('_score')
      expect(body.sort[0]._score).to.equal('desc')
    })
  })
})
