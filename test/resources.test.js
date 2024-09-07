const { expect } = require('chai')
const fs = require('fs')
const sinon = require('sinon')
const scsbClient = require('../lib/scsb-client')
const errors = require('../lib/errors')

const fixtures = require('./fixtures')

describe('Resources query', function () {
  const resourcesPrivMethods = {}
  let app

  before(function () {
    app = require('../app')
    // We're passing a reference to a local object `resourcesPrivMethods` so
    // that we get access to otherwise private methods defined in lib/resources
    require('../lib/resources')(app, resourcesPrivMethods)

    fixtures.enableScsbFixtures()
  })

  after(() => {
    fixtures.disableScsbFixtures()
  })

  describe('parseSearchParams', function () {
    it('parses params, sets defaults', function () {
      const params = resourcesPrivMethods.parseSearchParams({})
      expect(params).to.be.a('object')
      expect(params.q).to.equal(undefined)
      expect(params.search_scope).to.equal('all')
      expect(params.page).to.equal(1)
      expect(params.per_page).to.equal(50)
      expect(params.sort).to.equal(undefined)
      expect(params.filters).to.equal(undefined)
      expect(params.merge_checkin_card_items).to.equal(true)
      expect(params.include_item_aggregations).to.equal(true)
    })

    it('extracts merge_checkin_card_items', function () {
      expect(
        resourcesPrivMethods
          .parseSearchParams({ merge_checkin_card_items: 'false' })
          .merge_checkin_card_items
      ).to.equal(false)
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
      expect(body.bool.must[0].query_string.query).to.equal('subjectLiteral:"hot potatoes"')
    })

    it('escapes colon if field not recognized', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'fladeedle:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].query_string).to.be.a('object')
      expect(body.bool.must[0].query_string.query).to.equal('fladeedle\\:"hot potatoes"')
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
      expect(query.bool.should[0].query_string.query).to.equal('fladeedle')

      // Second clause is a query_string query across multiple root level fields, with literal query
      expect(query.bool.should[1]).to.be.a('object')
      expect(query.bool.should[1].query_string).to.be.a('object')
      expect(query.bool.should[1].query_string.fields).to.be.a('array')
      expect(query.bool.should[1].query_string.fields).to.include('shelfMark')
      expect(query.bool.should[1].query_string.query).to.equal('"fladeedle"')

      // Third clause is a nested query_string query on items fields:
      expect(query.bool.should[2]).to.be.a('object')
      expect(query.bool.should[2].nested).to.be.a('object')
      expect(query.bool.should[2].nested.path).to.eq('items')
      expect(query.bool.should[2].nested.query).to.be.a('object')
      expect(query.bool.should[2].nested.query.query_string).to.be.a('object')
      expect(query.bool.should[2].nested.query.query_string.fields).to.be.a('array')
      expect(query.bool.should[2].nested.query.query_string.fields).to.include('items.shelfMark')
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
      expect(body).to.deep.equal({
        query: {
          bool: {
            should: [
              { term: { idIsbn: '0689844921' } },
              { term: { idIsbn_clean: '0689844921' } }
            ],
            minimum_should_match: 1
          }
        }
      })
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

  describe('findByUri 404', () => {
    before(() => {
      fixtures.enableEsFixtures()
    })

    after(() => {
      fixtures.disableEsFixtures()
    })

    it('handles bib 404 by rejecting with NotFoundError', () => {
      const call = () => app.resources.findByUri({ uri: 'b123' })
      return expect(call()).to.be.rejectedWith(errors.NotFoundError)
    })
  })

  describe('findByUri all items', () => {
    after(() => { app.esClient.search.restore() })
    it('overrides items_size and items_from', async () => {
      const esSearchStub =
        sinon.stub(app.esClient, 'search')
          .callsFake(async (body) => ({ body: { hits: { hits: [{ _source: { items: [{ uri: 'spaghetti' }] } }] } } }))
      await app.resources.findByUri({ uri: 'b1234', all_items: 'true' })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(searchBody.item_size).to.equal(undefined)
      expect(searchBody.items_from).to.equal(undefined)
      console.dir(searchBody, { depth: null })
      expect(searchBody).to.deep.equal({
        _source: {
          excludes: ['uris', '*_packed', '*_sort', 'items.*_packed', 'contentsTitle']
        },
        size: 1,
        query: {
          bool: {
            must: [{ term: { uri: 'b1234' } }]
          }
        },
        aggregations: {
          item_location: {
            nested: { path: 'items' },
            aggs: {
              _nested: { terms: { size: 100, field: 'items.holdingLocation_packed' } }
            }
          },
          item_status: {
            nested: { path: 'items' },
            aggs: {
              _nested: { terms: { size: 100, field: 'items.status_packed' } }
            }
          },
          item_format: {
            nested: { path: 'items' },
            aggs: {
              _nested: { terms: { size: 100, field: 'items.formatLiteral' } }
            }
          }
        }
      })
    })
  })

  describe('findByUri es connection error', () => {
    before(() => {
      sinon.stub(app.esClient, 'search').callsFake((req) => {
        return Promise.resolve(fs.readFileSync('./test/fixtures/es-connection-error.json', 'utf8'))
      })
    })

    after(() => {
      app.esClient.search.restore()
    })

    it('handles connection error by rejecting with Error', () => {
      const call = () => app.resources.findByUri({ uri: 'b123-connection-error', merge_checkin_card_items: true })
      return expect(call()).to.be.rejectedWith(Error, 'Error connecting to index')
    })
  })

  describe('findByUri scsb connection error', () => {
    before(() => {
      fixtures.enableEsFixtures()

      // Specifically disable scsb fixtrues for this scope
      fixtures.disableScsbFixtures()

      sinon.stub(scsbClient, 'getItemsAvailabilityForBnum')
        .callsFake(() => Promise.reject(new Error()))
      sinon.stub(scsbClient, 'getItemsAvailabilityForBarcodes')
        .callsFake(() => Promise.resolve([]))
    })

    after(() => {
      fixtures.disableEsFixtures()
      scsbClient.getItemsAvailabilityForBnum.restore()
      scsbClient.getItemsAvailabilityForBarcodes.restore()

      // Re-enable scsb fixtures
      fixtures.enableScsbFixtures()
    })

    it('handles scsb connection error in initial availability lookup by resolving document', () => {
      return app.resources.findByUri({ uri: 'b10833141', merge_checkin_card_items: true })
        .then((resp) => {
          expect(resp).to.be.a('object')
          expect(resp['@id']).to.eq('res:b10833141')
        })
    })
  })

  describe('findByUri with filters', () => {
    before(() => {
      fixtures.enableEsFixtures()
    })

    after(() => {
      fixtures.disableEsFixtures()
    })

    it('passes filters to esClient', () => {
      return app.resources.findByUri({
        uri: 'b123',
        item_volume: '1-2',
        item_date: '3-4',
        item_format: 'text,microfilm',
        item_location: 'SASB,LPA',
        item_status: 'here,there'
      })
        // This call is going to error because the bnum is fake
        .catch((e) => {
          // Verify correct nested filters were passed to ES query:
          const searchCall1Arg1 = app.esClient.search.args[0][0]
          const nestedFilters = searchCall1Arg1.query.bool.filter[0].bool.should[0].nested.query.bool.filter
          expect(nestedFilters)
            .to.deep.equal([
              {
                range: {
                  'items.volumeRange': {
                    gte: 1,
                    lte: 2
                  }
                }
              },
              {
                range: {
                  'items.dateRange': {
                    gte: 3,
                    lte: 4
                  }
                }
              },
              {
                terms: {
                  'items.formatLiteral': [
                    'text',
                    'microfilm'
                  ]
                }
              },
              {
                terms: {
                  'items.holdingLocation.id': [
                    'SASB',
                    'LPA'
                  ]
                }
              },
              {
                terms: {
                  'items.status.id': [
                    'here',
                    'there'
                  ]
                }
              }
            ])
        })
    })
  })

  describe('esRangeValue', () => {
    it('should handle a range with two values', () => {
      expect(resourcesPrivMethods.esRangeValue([123, 456])).to.deep.equal({
        gte: 123,
        lte: 456
      })
    })

    it('should handle a range with one value', () => {
      expect(resourcesPrivMethods.esRangeValue([123])).to.deep.equal({
        gte: 123,
        lt: 124
      })
    })
  })

  describe('itemsFilterContext', () => {
    it('should return an empty object in case of no query', () => {
      expect(resourcesPrivMethods.itemsFilterContext({})).to.deep.equal({})
    })

    it('should return an empty object in case there are no filters', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: {} })).to.deep.equal({})
    })

    it('should return filters for volume in case there is a volume', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { volume: [1, 2] } }))
        .to.deep.equal({ filter: [{ range: { 'items.volumeRange': { gte: 1, lte: 2 } } }] })
    })

    it('should return filters for date in case there is a date', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { date: [1, 2] } }))
        .to.deep.equal({ filter: [{ range: { 'items.dateRange': { gte: 1, lte: 2 } } }] })
    })

    it('should return filters for format in case there is a format', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { format: ['text', 'microfilm', 'AV'] } }))
        .to.deep.equal({ filter: [{ terms: { 'items.formatLiteral': ['text', 'microfilm', 'AV'] } }] })
    })

    it('should return filters for location in case there is a location', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { location: ['SASB', 'LPA', 'Schomburg'] } }))
        .to.deep.equal({ filter: [{ terms: { 'items.holdingLocation.id': ['SASB', 'LPA', 'Schomburg'] } }] })
    })

    it('should return filters for status in case there is a status', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { status: ['Available', 'Unavailable', 'In Process'] } }))
        .to.deep.equal({ filter: [{ terms: { 'items.status.id': ['Available', 'Unavailable', 'In Process'] } }] })
    })

    it('should combine all filters in case of multiple filters', () => {
      expect(resourcesPrivMethods.itemsFilterContext({
        query: {
          volume: [1, 2],
          date: [3, 4],
          format: ['text', 'microfilm', 'AV'],
          location: ['SASB', 'LPA', 'Schomburg'],
          status: ['Available', 'Unavailable', 'In Process']
        }
      })).to.deep.equal({
        filter: [
          { range: { 'items.volumeRange': { gte: 1, lte: 2 } } },
          { range: { 'items.dateRange': { gte: 3, lte: 4 } } },
          { terms: { 'items.formatLiteral': ['text', 'microfilm', 'AV'] } },
          { terms: { 'items.holdingLocation.id': ['SASB', 'LPA', 'Schomburg'] } },
          { terms: { 'items.status.id': ['Available', 'Unavailable', 'In Process'] } }
        ]
      })
    })

    it('should ignore all other parameters', () => {
      expect(resourcesPrivMethods.itemsFilterContext({ query: { location: ['SASB', 'LPA', 'Schomburg'] }, something: 'else' }))
        .to.deep.equal({ filter: [{ terms: { 'items.holdingLocation.id': ['SASB', 'LPA', 'Schomburg'] } }] })
    })
  })

  describe('itemsQueryContext', () => {
    it('should ignore check in card items when merge_checkin_card_items is not set', () => {
      expect(resourcesPrivMethods.itemsQueryContext({}))
        .to.deep.equal({ must_not: [{ exists: { field: 'items.electronicLocator' } }, { term: { 'items.type': 'nypl:CheckinCardItem' } }] })
    })

    it('should ignore check in card items when merge_checkin_card_items is falsey', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ merge_checkin_card_items: false }))
        .to.deep.equal({ must_not: [{ exists: { field: 'items.electronicLocator' } }, { term: { 'items.type': 'nypl:CheckinCardItem' } }] })
    })

    it('should include check in card items when merge_checkin_card_items is truthy', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ merge_checkin_card_items: true }))
        .to.deep.equal({ must_not: [{ exists: { field: 'items.electronicLocator' } }] })
    })

    it('should include check in card items but exclude electronic resources when merge_checkin_card_items is truthy and removeElectronicResourcesFromItemsArray is truthy', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ removeElectronicResourcesFromItemsArray: true, merge_checkin_card_items: true }))
        .to.deep.equal({ must_not: [{ exists: { field: 'items.electronicLocator' } }] })
    })

    it('should ignore electronic resources when removeElectronicResourcesFromItemsArray is set', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ removeElectronicResourcesFromItemsArray: true }))
        .to.deep.equal({ must_not: [{ exists: { field: 'items.electronicLocator' } }, { term: { 'items.type': 'nypl:CheckinCardItem' } }] })
    })
  })

  describe('addInnerHits', () => {
    it('should include query for items', () => {
      expect(resourcesPrivMethods.addInnerHits({ query: { bool: {} } }, { size: 1, from: 2 }))
        .to.deep.equal({
          query: {
            bool: {
              filter: [
                {
                  bool: {
                    should: [
                      {
                        nested: {
                          path: 'items',
                          query: {
                            bool: {
                              must_not: [
                                { exists: { field: 'items.electronicLocator' } }
                              ]
                            }
                          },
                          inner_hits: {
                            sort: [{ 'items.enumerationChronology_sort': 'desc' }],
                            size: 1,
                            from: 2,
                            name: 'items'
                          }
                        }
                      },
                      {
                        nested: {
                          inner_hits: {
                            name: 'electronicResources'
                          },
                          path: 'items',
                          query: {
                            exists: {
                              field: 'items.electronicLocator'
                            }
                          }
                        }
                      },
                      { match_all: {} }
                    ]
                  }
                }
              ]
            }
          }
        })
    })

    it('should exclude check in card items if explicitly set', () => {
      expect(resourcesPrivMethods.addInnerHits({ query: { bool: {} } }, { size: 1, from: 2, merge_checkin_card_items: false }))
        .to.deep.equal({
          query: {
            bool: {
              filter: [
                {
                  bool: {
                    should: [
                      {
                        nested: {
                          path: 'items',
                          query: {
                            bool: {
                              must_not: [
                                { exists: { field: 'items.electronicLocator' } },
                                { term: { 'items.type': 'nypl:CheckinCardItem' } }
                              ]
                            }
                          },
                          inner_hits: {
                            sort: [{ 'items.enumerationChronology_sort': 'desc' }],
                            size: 1,
                            from: 2,
                            name: 'items'
                          }
                        }
                      },
                      {
                        nested: {
                          inner_hits: {
                            name: 'electronicResources'
                          },
                          path: 'items',
                          query: {
                            exists: {
                              field: 'items.electronicLocator'
                            }
                          }
                        }
                      },
                      { match_all: {} }
                    ]
                  }
                }
              ]
            }
          }
        })
    })

    it('should include filters for items', () => {
      expect(resourcesPrivMethods.addInnerHits(
        { query: { bool: {} } },
        { size: 1, from: 2, query: { volume: [1, 2], location: ['SASB', 'LPA'], other: 'filter' } }
      )).to.deep.equal({
        query: {
          bool: {
            filter: [
              {
                bool: {
                  should: [
                    {
                      nested: {
                        path: 'items',
                        query: {
                          bool: {
                            must_not: [
                              { exists: { field: 'items.electronicLocator' } }
                            ],
                            filter: [
                              { range: { 'items.volumeRange': { gte: 1, lte: 2 } } },
                              { terms: { 'items.holdingLocation.id': ['SASB', 'LPA'] } }
                            ]
                          }
                        },
                        inner_hits: {
                          sort: [{ 'items.enumerationChronology_sort': 'desc' }],
                          size: 1,
                          from: 2,
                          name: 'items'
                        }
                      }
                    },
                    {
                      nested: {
                        inner_hits: {
                          name: 'electronicResources'
                        },
                        path: 'items',
                        query: {
                          exists: {
                            field: 'items.electronicLocator'
                          }
                        }
                      }
                    },
                    { match_all: {} },
                    {
                      nested: {
                        inner_hits: { name: 'allItems' },
                        path: 'items',
                        query: {
                          bool: {
                            must_not: [
                              { exists: { field: 'items.electronicLocator' } }
                            ]
                          }
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      })
    })
  })
})
