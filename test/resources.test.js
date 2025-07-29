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
      expect(params.sort).to.equal('relevance')
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

  describe('buildElasticQuery', function () {
    it('uses "query string query" if subjectLiteral: used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].multi_match).to.be.a('object')
      expect(body.bool.must[0].multi_match.query).to.equal('subjectLiteral:potatoes')
    })

    it('uses "query string query" if subjectLiteral: quoted phrase used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'subjectLiteral:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].multi_match).to.be.a('object')
      expect(body.bool.must[0].multi_match.query).to.equal('subjectLiteral:"hot potatoes"')
    })

    it('escapes colon if field not recognized', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'fladeedle:"hot potatoes"' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].multi_match).to.be.a('object')
      expect(body.bool.must[0].multi_match.query).to.equal('fladeedle\\:"hot potatoes"')
    })

    it('uses "query string query" if plain keyword query used', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: 'potatoes' })
      const body = resourcesPrivMethods.buildElasticQuery(params)
      expect(body).to.be.a('object')
      expect(body.bool).to.be.a('object')
      expect(body.bool.must).to.be.a('array')
      expect(body.bool.must[0]).to.be.a('object')
      expect(body.bool.must[0].multi_match).to.be.a('object')
      expect(body.bool.must[0].multi_match.query).to.equal('potatoes')
    })

    it('accepts advanced search parameters', function () {
      const params = resourcesPrivMethods.parseSearchParams({ contributor: 'Poe', title: 'Raven', subject: 'ravens' })
      const body = resourcesPrivMethods.buildElasticQuery(params)

      expect(body).to.nested.include({
        // Expect a title match on Raven:
        'bool.must[0].bool.must[0].multi_match.fields[0]': 'title^5',
        'bool.must[0].bool.must[0].multi_match.query': 'Raven',
        // Expect a subject match on 'ravens'
        'bool.must[1].bool.must[0].multi_match.fields[0]': 'subjectLiteral^2',
        'bool.must[1].bool.must[0].multi_match.query': 'ravens',
        // Expect a creator match on Poe:
        'bool.must[2].bool.must[0].multi_match.fields[0]': 'creatorLiteral^4',
        'bool.must[2].bool.must[0].multi_match.query': 'Poe'
      })
    })
  })

  describe('buildElasticBody', function () {
    it('uses subjectLiteral.raw when given a subjectLiteral filter', function () {
      const params = resourcesPrivMethods.parseSearchParams({ q: '', filters: { subjectLiteral: 'United States -- History' } })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.be.a('object')
      expect(body.query).to.be.a('object')
      expect(body.query.bool).to.be.a('object')
      expect(body.query.bool.filter).to.be.a('array')
      expect(body.query.bool.filter[0]).to.be.a('object')
      expect(body.query.bool.filter[0].term).to.be.a('object')
      expect(body.query.bool.filter[0].term['subjectLiteral.raw']).to.equal('United States -- History')
    })

    describe('nyplSource filtering', function () {
      it('does not filter by nyplSource when HIDE_NYPL_SOURCE is not set', function () {
        delete process.env.HIDE_NYPL_SOURCE
        expect(process.env.HIDE_NYPL_SOURCE).to.be.a('undefined')

        const params = resourcesPrivMethods.parseSearchParams({ q: '' })
        const body = resourcesPrivMethods.buildElasticBody(params)

        expect(body).to.be.a('object')
        expect(body.query.filter).to.be.a('undefined')
      })

      it('filters by nyplSource when HIDE_NYPL_SOURCE is set', function () {
        process.env.HIDE_NYPL_SOURCE = 'recap-hl'

        const params = resourcesPrivMethods.parseSearchParams({ q: '' })
        const body = resourcesPrivMethods.buildElasticBody(params)

        // Expect query to resemble: {"from":0,"size":50,"query":{"bool":{"filter":[{"bool":{"must_not":{"terms":{"nyplSource":["recap-hl"]}}}}]}},"sort":["uri"]}
        expect(body).to.be.a('object')
        expect(body).to.nested.include({ 'query.bool.filter[0].bool.must_not.terms.nyplSource[0]': 'recap-hl' })

        delete process.env.HIDE_NYPL_SOURCE
      })
    })

    it('processes isbn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ isbn: '0689844921' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.nested
        .include({ 'query.bool.must[0].term.idIsbn\\.clean': '0689844921' })
    })

    it('processes issn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ issn: '1234-5678' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.nested.include({ 'query.bool.must[0].term.idIssn\\.clean': '1234-5678' })
    })

    it('processes lccn correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ lccn: '00068799' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.nested.include({ 'query.bool.must[0].regexp.idLccn.value': '[^\\d]*00068799[^\\d]*' })
    })

    it('processes oclc correctly', () => {
      const params = resourcesPrivMethods.parseSearchParams({ oclc: '1033548057' })
      const body = resourcesPrivMethods.buildElasticBody(params)
      expect(body).to.nested.include({ 'query.bool.must[0].term.idOclc': '1033548057' })
    })

    it('does not mutate params', () => {
      const params = resourcesPrivMethods.parseSearchParams({
        filters: {
          subjectLiteral: ['S1'],
          contributorLiteral: ['one', 'two']
        }
      })
      const paramsSnapshot = JSON.stringify(params)

      resourcesPrivMethods.buildElasticBody(params)
      resourcesPrivMethods.buildElasticBody(params)
      resourcesPrivMethods.buildElasticBody(params)

      expect(JSON.stringify(params)).to.equal(paramsSnapshot)
    })
  })

  describe('aggregationQueriesForParams', () => {
    it('produces correct query when no filters', () => {
      const params = resourcesPrivMethods.parseSearchParams({
        q: 'toast'
      })
      const queries = resourcesPrivMethods.aggregationQueriesForParams(params)
      expect(queries).to.be.a('array')
      expect(queries).to.have.lengthOf(1)
    })

    it('produces correct query when one filter', () => {
      const params = resourcesPrivMethods.parseSearchParams({
        q: 'toast',
        filters: {
          subjectLiteral: ['S1']
        }
      })
      const queries = resourcesPrivMethods.aggregationQueriesForParams(params)
      expect(queries).to.be.a('array')
      expect(queries).to.have.lengthOf(2)

      // Expect one agg query for all the properties not involved in a filter:
      expect(Object.keys(queries[0].aggregations)).to.have.lengthOf.at.least(9)
      expect(queries[0].query.bool.filter).to.be.a('array')
      expect(queries[0].query.bool.filter[0].term['subjectLiteral.raw'] === 'S1')

      // Expect second agg query for subjectLiteral - w/out the filter:
      expect(Object.keys(queries[1].aggregations)).to.have.lengthOf(1)
      expect(queries[1]).to.nested.include({ 'aggregations.subjectLiteral.terms.field': 'subjectLiteral.raw' })
      expect(queries[1].query.bool.filter).to.be.a('undefined')
    })

    it('produces correct query when two filters', () => {
      const params = resourcesPrivMethods.parseSearchParams({
        q: 'toast',
        filters: {
          subjectLiteral: ['S1'],
          contributorLiteral: ['C1', 'C2']
        }
      })
      const queries = resourcesPrivMethods.aggregationQueriesForParams(params)
      expect(queries).to.be.a('array')
      expect(queries).to.have.lengthOf(3)

      // Expect first agg query to include all filters:
      expect(Object.keys(queries[0].aggregations)).to.have.lengthOf.at.least(8)
      expect(queries[0].query.bool.filter).to.be.a('array')
      // Expect the subjectLiteral filter:
      expect(queries[0].query.bool.filter[0].term['subjectLiteral.raw'] === 'S1')
      // .. And the contributorLiteral filters:
      expect(queries[0]).to.nested.include({ 'query.bool.filter[1].bool.should[0].bool.should[0].term.contributorLiteral\\.raw': 'C1' })
      expect(queries[0]).to.nested.include({ 'query.bool.filter[1].bool.should[1].bool.should[0].term.contributorLiteral\\.raw': 'C2' })

      // Expect second aggregation for subjectLiteral:
      expect(Object.keys(queries[1].aggregations)).to.have.lengthOf(1)
      expect(queries[1]).to.nested.include({ 'aggregations.subjectLiteral.terms.field': 'subjectLiteral.raw' })
      // Expect this agg to filter on the other active filter, contributorLiteral:
      expect(queries[1]).to.nested.include({ 'query.bool.filter[0].bool.should[0].bool.should[0].term.contributorLiteral\\.raw': 'C1' })
      expect(queries[1]).to.nested.include({ 'query.bool.filter[0].bool.should[1].bool.should[0].term.contributorLiteral\\.raw': 'C2' })
      expect(queries[1].query.bool.filter).to.have.lengthOf(1)
      expect(queries[1].query.bool.filter[0].bool.should).to.have.lengthOf(2)

      // Expect last aggregation for contributorLiteral:
      expect(Object.keys(queries[2].aggregations)).to.have.lengthOf(1)
      expect(queries[2]).to.nested.include({ 'aggregations.contributorLiteral.terms.field': 'contributorLiteral.raw' })
      // Expect this agg to filter on the other active filter, subjectLiteral:
      expect(queries[2].query.bool.filter).to.have.lengthOf(1)

      expect(queries[2].query.bool.filter[0].term['subjectLiteral.raw'] === 'S1')
    })
  })

  describe('mergeAggregationsResponses', () => {
    it('merges aggregations', () => {
      const responses = [
        {
          hits: { total: { value: 13, relation: 'eq' }, hits: [] },
          aggregations: {
            agg1: {
              buckets: [
                { key: 'agg1 value1', doc_count: 10 },
                { key: 'agg1 value2', doc_count: 9 }
              ]
            }
          }
        },
        {
          hits: { total: { value: 100, relation: 'eq' }, hits: [] },
          aggregations: {
            agg2: {
              buckets: [
                { key: 'agg2 value1', doc_count: 10 }
              ]
            }
          }
        },
        {
          hits: { total: { value: 1000, relation: 'eq' }, hits: [] },
          aggregations: {
            agg3: {
              buckets: [
                { key: 'agg3 value1', doc_count: 10 }
              ]
            },
            agg4: {
              buckets: [
                { key: 'agg4 value1', doc_count: 10 }
              ]
            }
          }
        }
      ]

      expect(resourcesPrivMethods.mergeAggregationsResponses(responses)).to.nested.include({
        'hits.total.value': 1000,
        'aggregations.agg1.buckets[1].key': 'agg1 value2',
        'aggregations.agg1.buckets[0].doc_count': 10,
        'aggregations.agg2.buckets[0].key': 'agg2 value1',
        'aggregations.agg3.buckets[0].key': 'agg3 value1',
        'aggregations.agg4.buckets[0].key': 'agg4 value1'
      })
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

  describe('findByUri 4xx', () => {
    before(() => {
      fixtures.enableEsFixtures()
    })

    after(() => {
      fixtures.disableEsFixtures()
    })

    it('handles bib 404 by rejecting with NotFoundError', () => {
      const call = app.resources.findByUri({ uri: 'b123' })
      return expect(call).to.be.rejectedWith(errors.NotFoundError)
    })

    it('handles invalid bib uri with 400', () => {
      const call = app.resources.findByUri({ uri: 'asdf' })
      return expect(call).to.be.rejectedWith(errors.InvalidParameterError, 'Invalid bnum: asdf')
    })
  })

  describe('findByUri all items', () => {
    after(() => { app.esClient.search.restore() })

    it('overrides items_size and items_from', async () => {
      const esSearchStub =
        sinon.stub(app.esClient, 'search')
          .callsFake(async (body) => ({ hits: { hits: [{ _source: { items: [{ uri: 'spaghetti', status: [{ label: 'spaghetti', id: 'status:pasta' }] }] } }] } }))
      await app.resources.findByUri({ uri: 'b1234', all_items: 'true' }, {}, { query: { all_items: 'true' }, params: {} })
      const searchBody = esSearchStub.getCall(0).args[0]
      expect(searchBody.item_size).to.equal(undefined)
      expect(searchBody.items_from).to.equal(undefined)
      expect(searchBody).to.deep.equal({
        _source: {
          // note absence of "*_sort"
          excludes: [
            'uris',
            '*_packed',
            'items.*_packed',
            'contentsTitle',
            'suppressed',
            '*WithoutDates',
            '*Normalized'
          ]
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
    it('should exclude check in card items when options.merge_checkin_card_items is not set', () => {
      expect(resourcesPrivMethods.itemsQueryContext({}))
        .to.deep.equal({ must_not: [{ term: { 'items.type': 'nypl:CheckinCardItem' } }] })
    })

    it('should exclude check in card items when merge_checkin_card_items is falsey', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ merge_checkin_card_items: false }))
        .to.deep.equal({ must_not: [{ term: { 'items.type': 'nypl:CheckinCardItem' } }] })
    })

    it('should use match_all for items when merge_checkin_card_items is truthy', () => {
      expect(resourcesPrivMethods.itemsQueryContext({ merge_checkin_card_items: true }))
        .to.deep.equal({ must: { match_all: {} } })
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
                              must: {
                                match_all: {}
                              }
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
                            must: {
                              match_all: {}
                            },
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
