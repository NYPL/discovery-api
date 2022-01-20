const errors = require('../lib/errors')

const fixtures = require('./fixtures')

describe('Resources query', function () {
  let resourcesPrivMethods = {}
  let app

  before(function () {
    app = require('../app')
    // We're passing a reference to a local object `resourcesPrivMethods` so
    // that we get access to otherwise private methods defined in lib/resources
    require('../lib/resources')(app, resourcesPrivMethods)
  })

  describe('parseSearchParams', function () {
    it('parses params, sets defaults', function () {
      const params = resourcesPrivMethods.parseSearchParams({ })
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('all')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal(undefined)
      expect(params.filters).to.equal(undefined)
    })
  })

  describe('escapeQuery', function () {
    it('should escape specials', function () {
      expect(resourcesPrivMethods.escapeQuery('? ^ * + (')).to.equal('\\? \\^ \\* \\+ \\(')
    })

    it('should escape unrecognized field indicators', function () {
      expect(resourcesPrivMethods.escapeQuery('fladeedle:gorf')).to.equal('fladeedle\\:gorf')
    })

    it('should not escape recognized field indicators', function () {
      expect(resourcesPrivMethods.escapeQuery('title:gorf')).to.equal('title:gorf')
    })

    it('should escape a single forward slash', function () {
      expect(resourcesPrivMethods.escapeQuery('/')).to.equal('\\/')
    })

    it('should escape floating colon', function () {
      // Make sure colons floating in whitespace are escaped:
      expect(resourcesPrivMethods.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡')
    })

    it('should escape colons in hyphenated phrases', function () {
      expect(resourcesPrivMethods.escapeQuery('Arkheologii︠a︡ Omska : illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ / Avtor-sostavitelʹ: B.A. Konikov.')).to.equal('Arkheologii︠a︡ Omska \\: illi︠u︡strirovannai︠a︡ ėnt︠s︡iklopedii︠a︡ \\/ Avtor\\-sostavitelʹ\\: B.A. Konikov.')
    })
  })

  describe('buildElasticQuery', function () {
    it('uses "query string query" if subjectLiteral: used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.query).to.equal('subjectLiteral:potatoes')
    })

    it('uses "query string query" if subjectLiteral: quoted phrase used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.query).to.equal('subjectLiteral:\"hot potatoes\"')
    })

    it('escapes colon if field not recognized', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'fladeedle:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.query).to.equal('fladeedle\\:\"hot potatoes\"')
    })

    it('uses "query string query" if plain keyword query used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.query).to.equal('potatoes')
    })

    it('accepts advanced search parameters', function () {
      const params = resourcesPrivMethods.parseSearchParams({ contributor: 'Poe', title: 'Raven', subject: 'ravens' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.fields).to.be.a('array')
      expect(body.bool.must[0].query_string.fields[0]).to.equal('title^5')
      expect(body.bool.must[0].query_string.query).to.equal('Raven')
      expect(body.bool.must[1].query_string).to.be.a('object')
      expect(body.bool.must[1].query_string.fields).to.be.a('array')
      expect(body.bool.must[1].query_string.fields[0]).to.equal('subjectLiteral^2')
      expect(body.bool.must[1].query_string.query).to.equal('ravens')
      expect(body.bool.must[2].query_string).to.be.a('object')
      expect(body.bool.must[2].query_string.fields).to.be.a('array')
      expect(body.bool.must[2].query_string.fields[0]).to.equal('creatorLiteral^4')
      expect(body.bool.must[2].query_string.query).to.equal('Poe')
    })
  })

  describe('buildElasticQueryForKeywords', function () {
    it('returns a simple query_string query for search_scope=all', function () {
      const query = resourcesPrivMethods.buildElasticQueryForKeywords({ q: 'fladeedle', search_scope: 'all' })
      expect(query).to.be.a('object')
      expect(query.query_string).to.be.a('object')
      expect(query.query_string.fields).to.be.a('array')
    })

    it('returns a simple query_string query for search_scope=title', function () {
      const query = resourcesPrivMethods.buildElasticQueryForKeywords({ q: 'fladeedle', search_scope: 'title' })
      expect(query).to.be.a('object')
      expect(query.query_string).to.be.a('object')
      expect(query.query_string.fields).to.be.a('array')
      expect(query.query_string.fields).to.include('uniformTitle.folded')
    })

    it('returns a bool query for search_scope=standard_number', function () {
      const query = resourcesPrivMethods.buildElasticQueryForKeywords({ q: 'fladeedle', search_scope: 'standard_number' })
      expect(query).to.be.a('object')
      expect(query.bool).to.be.a('object')
      expect(query.bool.should).to.be.a('array')

      // First clause is a query_string query across multiple root level fields
      expect(query.bool.should[0]).to.be.a('object')
      expect(query.bool.should[0].query_string).to.be.a('object')
      expect(query.bool.should[0].query_string.fields).to.be.a('array')
      expect(query.bool.should[0].query_string.fields).to.include('shelfMark')

      // Second clause is a nested query_string query on items fields:
      expect(query.bool.should[1]).to.be.a('object')
      expect(query.bool.should[1].nested).to.be.a('object')
      expect(query.bool.should[1].nested.path).to.eq('items')
      expect(query.bool.should[1].nested.query).to.be.a('object')
      expect(query.bool.should[1].nested.query.query_string).to.be.a('object')
      expect(query.bool.should[1].nested.query.query_string.fields).to.be.a('array')
      expect(query.bool.should[1].nested.query.query_string.fields).to.include('items.shelfMark')
    })
  })

  describe('buildElasticBody', function () {
    it('uses subjectLiteral_exploded when given a subjectLiteral filter', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: '', filters: { subjectLiteral: 'United States -- History' } })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.be.a('object')
      expect(body.query).to.be.a('object')
      expect(body.query.bool).to.be.a('object')
      expect(body.query.bool.filter).to.be.a('array')
      expect(body.query.bool.filter[0]).to.be.a('object')
      expect(body.query.bool.filter[0].term).to.be.a('object')
      expect(body.query.bool.filter[0].term.subjectLiteral_exploded).to.equal('United States -- History')
    })

    describe('nyplSource filtering', function () {
      it('does not filter by nyplSource when HIDE_NYPL_SOURCE is not set', function () {
        delete process.env.HIDE_NYPL_SOURCE
        expect(process.env.HIDE_NYPL_SOURCE).to.be.a('undefined')

        const params = resourcesPrivMethods.parseSearchParams({ q: '' })
        const body = resourcesPrivMethods.buildElasticBody(params)

        expect(body).to.be.a('object')
        expect(body.query).to.be.a('undefined')
      })

      it('filters by nyplSource when HIDE_NYPL_SOURCE is set', function () {
        process.env.HIDE_NYPL_SOURCE = 'recap-hl'

        const params = resourcesPrivMethods.parseSearchParams({ q: '' })
        const body = resourcesPrivMethods.buildElasticBody(params)

        // Expect query to resemble: {"from":0,"size":50,"query":{"bool":{"filter":[{"bool":{"must_not":{"terms":{"nyplSource":["recap-hl"]}}}}]}},"sort":["uri"]}
        expect(body).to.be.a('object')
        expect(body).to.have.deep.property('query', {
          bool: {
            filter: [
              {
                bool: {
                  must_not: {
                    terms: {
                      nyplSource: ['recap-hl']
                    }
                  }
                }
              }
            ]
          }
        })

        delete process.env.HIDE_NYPL_SOURCE
      })
    })

    it('processes isbn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ isbn: '0689844921' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.deep.equal({ query: { bool: { must: { term: { idIsbn: '0689844921' } } } } })
    })

    it('processes issn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ issn: '1234-5678' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.deep.equal({ query: { bool: { must: { term: { idIssn: '1234-5678' } } } } })
    })

    it('processes lccn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ lccn: '00068799' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.deep.equal({ query: { regexp: { idLccn: { value: '[^\\d]*00068799[^\\d]*' } } } })
    })

    it('processes oclc correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ oclc: '1033548057' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.deep.equal({ query: { bool: { must: { term: { idOclc: '1033548057' } } } } })
    })
  })

  describe('annotatedMarc endpoint', () => {
    before(() => {
      // Configure the stubbing to serve up the same fixture for all calls:
      fixtures.enableDataApiFixtures({
        'bibs/sierra-nypl/11055155': 'bib-11055155.json',
        'bibs/recap-cul/11055155': 'bib-11055155.json',
        'bibs/recap-hl/11055155': 'bib-11055155.json'
      })
    })

    after(() => {
      fixtures.disableDataApiFixtures()
    })

    it('traslates nypl record id into necessary BibService call', () => {
      return app.resources.annotatedMarc({ uri: 'b11055155' })
        .then((data) => {
          expect(data).to.be.a('object')
          expect(data.bib).to.be.a('object')
          expect(data.bib.id).to.eq('11055155')
        })
    })

    it('traslates CUL record id into necessary BibService call', () => {
      return app.resources.annotatedMarc({ uri: 'cb11055155' })
        .then((data) => {
          expect(data).to.be.a('object')
          expect(data.bib).to.be.a('object')
          expect(data.bib.id).to.eq('11055155')
        })
    })

    it('traslates HL record id into necessary BibService call', () => {
      return app.resources.annotatedMarc({ uri: 'hb11055155' })
        .then((data) => {
          expect(data).to.be.a('object')
          expect(data.bib).to.be.a('object')
          expect(data.bib.id).to.eq('11055155')
        })
    })
  })

  describe('findByUri errors', () => {
    before(() => {
      fixtures.enableEsFixtures()
    })

    after(() => {
      fixtures.disableEsFixtures()
    })

    it('handles connection error by rejecting with Error', () => {
      const call = () => app.resources.findByUri({ uri: 'b123-connection-error' })
      return expect(call()).to.be.rejectedWith(Error, 'Error connecting to index')
    })

    it('handles bib 404 by rejecting with NotFoundError', () => {
      const call = () => app.resources.findByUri({ uri: 'b123' })
      return expect(call()).to.be.rejectedWith(errors.NotFoundError)
    })
  })
})
