const { expect } = require('chai')
const sinon = require('sinon')

const AvailabilityResolver = require('../lib/availability_resolver.js')
const elasticSearchResponse = require('./fixtures/elastic_search_response.js')
const recapScsbQueryMatch = require('./fixtures/recap-scsb-query-match')
const recapScsbQueryMismatch = require('./fixtures/recap-scsb-query-mismatch')
const logger = require('../lib/logger')
const scsbClient = require('../lib/scsb-client')
const esClient = require('../lib/elasticsearch/client')

const itemAvailabilityResponse = [
  {
    itemBarcode: '33433058338470',
    itemAvailabilityStatus: "Item Barcode doesn't exist in SCSB database.",
    errorMessage: null
  },
  {
    itemBarcode: '32101071572406',
    itemAvailabilityStatus: 'Not Available',
    errorMessage: null
  },
  {
    itemBarcode: '1000546836',
    itemAvailabilityStatus: 'Available',
    errorMessage: null
  },
  // An item in rc2ma", which ES has as Available:
  {
    itemBarcode: '10005468369',
    itemAvailabilityStatus: 'Not Available',
    errorMessage: null
  },
  // CUL item (available):
  {
    itemBarcode: '1000020117',
    itemAvailabilityStatus: 'Available',
    errorMessage: null
  },
  // CUL item (not available):
  {
    itemBarcode: '10000201179999',
    itemAvailabilityStatus: 'Not Available',
    errorMessage: null
  },
  // Special collections item:
  {
    itemBarcode: '33433058338470',
    itemAvailabilityStatus: 'Available',
    errorMessage: null
  }
]

describe('Response with updated availability', function () {
  describe('responseWithUpdatedAvailability', () => {
    beforeEach(() => {
      sinon.stub(scsbClient, 'getItemsAvailabilityForBarcodes')
        .callsFake(() => Promise.resolve(itemAvailabilityResponse))

      sinon.stub(scsbClient, 'recapCustomerCodeByBarcode')
        .callsFake(() => Promise.resolve('NC'))
    })

    afterEach(() => {
      scsbClient.getItemsAvailabilityForBarcodes.restore()
      scsbClient.recapCustomerCodeByBarcode.restore()
    })

    it('will change an items status to "Available" if ElasticSearch says it\'s unavailable but SCSB says it is Available', function () {
      const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

      const indexedAsUnavailableURI = 'i10283664'

      const indexedAsUnavailable = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
        return item.uri === indexedAsUnavailableURI
      })

      // Test that it's unavailable at first
      expect(indexedAsUnavailable.status[0].id).to.equal('status:na')
      expect(indexedAsUnavailable.status[0].label).to.equal('Not available')

      return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifiedResponse) => {
          const theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => {
            return item.uri === indexedAsUnavailableURI
          })

          // Test AvailabilityResolver munges it into availability
          expect(theItem.status[0].id).to.equal('status:a')
          expect(theItem.status[0].label).to.equal('Available')
        })
    })

    it('will change an items status to "Unavailable" if ElasticSearch says it\'s Available but SCSB says it is Unvailable', function () {
      const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

      const indexedAsAvailableURI = 'i102836649'
      const indexedAsAvailable = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
        return item.uri === indexedAsAvailableURI
      })

      // Test that it's available at first
      expect(indexedAsAvailable.status[0].id).to.equal('status:a')
      expect(indexedAsAvailable.status[0].label).to.equal('Available')

      return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifiedResponse) => {
          const theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => {
            return item.uri === indexedAsAvailableURI
          })

          // Test AvailabilityResolver munges it into temporarily unavailable
          expect(theItem.status[0].id).to.equal('status:na')
          expect(theItem.status[0].label).to.equal('Not available')
        })
    })

    it('will return the original ElasticSearchResponse\'s status for the item if the SCSB can\'t find an item with the barcode', function () {
      const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

      const indexedButNotAvailableInSCSBURI = 'i22566485'
      const indexedButNotAvailableInSCSB = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
        return item.uri === indexedButNotAvailableInSCSBURI
      })

      expect(indexedButNotAvailableInSCSB.status[0].id).to.equal('status:a')
      expect(indexedButNotAvailableInSCSB.status[0].label).to.equal('Available')

      return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifiedResponse) => {
          const theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => {
            return item.uri === indexedButNotAvailableInSCSBURI
          })

          // As this item is not available in SCSB, the elasticSearchResponse's availability for the item was returned
          expect(theItem.status[0].id).to.equal('status:a')
          expect(theItem.status[0].label).to.equal('Available')
        })
    })

    it('includes the latest availability status of items', function () {
      const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

      return availabilityResolver.responseWithUpdatedAvailability()
        .then((response) => {
          const items = response.hits.hits[0]._source.items

          // A ReCAP item with Discovery status 'Available', but SCSB
          // status 'Not Available' should be made 'Not Available'
          const unavailableItem = items.find((item) => {
            return item.uri === 'i102836649'
          })
          expect(unavailableItem.status[0].id).to.equal('status:na')
          expect(unavailableItem.status[0].label).to.equal('Not available')

          // A ReCAP item with Discovery status 'Not Avaiable', but SCSB
          // status 'Available' should be made available:
          const availableItem = items.find((item) => {
            return item.uri === 'i10283664'
          })
          expect(availableItem.status[0].id).to.equal('status:a')
          expect(availableItem.status[0].label).to.equal('Available')
        })
    })

    describe('CUL item', function () {
      let availabilityResolver = null

      before(function () {
        availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseCulItem())
      })

      it('marks CUL item Available when SCSB API indicates it is so', function () {
        return availabilityResolver.responseWithUpdatedAvailability()
          .then((response) => {
            const items = response.hits.hits[0]._source.items

            const availableItem = items.find((item) => item.uri === 'ci1455504')
            expect(availableItem.requestable[0]).to.equal(true)
            expect(availableItem.status[0].label).to.equal('Available')
          })
      })

      it('marks CUL item not avilable when SCSB API indicates it is so', function () {
        return availabilityResolver.responseWithUpdatedAvailability()
          .then((response) => {
            const items = response.hits.hits[0]._source.items

            const notAvailableItem = items.find((item) => item.uri === 'ci14555049999')
            expect(notAvailableItem.status[0].label).to.equal('Not available')
          })
      })
    })

    describe('checks recapCustomerCodes when options specifies', () => {
      let availabilityResolver = null
      it('logs an error when item\'s code does not match SCSB', () => {
        availabilityResolver = new AvailabilityResolver(recapScsbQueryMismatch())
        const loggerSpy = sinon.spy(logger, 'error')
        return availabilityResolver.responseWithUpdatedAvailability({ queryRecapCustomerCode: true })
          .then(() => {
            expect(loggerSpy.calledOnce).to.equal(true)
            logger.error.restore()
          })
      })

      it('updates recapCustomerCode when item\'s code does not match SCSB', () => {
        return availabilityResolver.responseWithUpdatedAvailability()
          .then((response) => {
            const items = response.hits.hits[0]._source.items
            // A ReCAP item with customer code XX
            const queryItem = items.find((item) => {
              return item.uri === 'i10283667'
            })
            expect(queryItem.recapCustomerCode[0]).to.equal('NC')
          })
      })

      it('does nothing when current recapCustomerCode and SCSB code are a match', () => {
        availabilityResolver = new AvailabilityResolver(recapScsbQueryMatch())
        const loggerSpy = sinon.spy(logger, 'error')
        return availabilityResolver.responseWithUpdatedAvailability()
          .then(() => {
            expect(loggerSpy.notCalled).to.equal(true)
            logger.error.restore()
          })
      })

      it('does not query SCSB unless specified in options', () => {
        return availabilityResolver.responseWithUpdatedAvailability()
          .then(() => {
            expect(scsbClient.recapCustomerCodeByBarcode.notCalled).to.equal(true)
          })
      })
    })
  })

  describe('_fixItemStatusAggregationLabels', () => {
    it('corrects bad na status labels', () => {
      const resp = {
        hits: { hits: [] },
        aggregations: {
          item_status: {
            _nested: {
              buckets: [
                {
                  key: 'status:na||Not Available',
                  doc_count: 1
                }
              ]
            }
          }
        }
      }
      const availabilityResolver = new AvailabilityResolver(resp)
      availabilityResolver._fixItemStatusAggregationLabels()
      const newBuckets = availabilityResolver
        .elasticSearchResponse.aggregations.item_status._nested.buckets
      expect(newBuckets)
        .to.deep.equal([
          {
            key: 'status:na||Not available',
            doc_count: 1
          }
        ])
    })
  })

  describe('_recapStatusesAsEsAggregations', () => {
    it('translates recap statuses into es aggregations', () => {
      const recapStatuses = {
        Available: ['barcode1', 'barcode2', 'barcode3', 'barcode4'],
        'Not Available': ['barcode5', 'barcode6']
      }
      expect(AvailabilityResolver.prototype._recapStatusesAsEsAggregations(recapStatuses))
        .to.deep.equal([
          {
            key: 'status:a||Available',
            doc_count: 4
          },
          {
            key: 'status:na||Not available',
            doc_count: 2
          }
        ])
    })
  })

  describe('_mergeAggregationBuckets', () => {
    it('merges two ES aggregation bucket arrays', () => {
      const b1 = [
        { key: 'key1', doc_count: 1 },
        { key: 'key2', doc_count: 2 },
        { key: 'key3', doc_count: 5 }
      ]
      const b2 = [
        { key: 'key2', doc_count: 3 },
        { key: 'key3', doc_count: 2 },
        { key: 'key4', doc_count: 8 }
      ]

      expect(AvailabilityResolver.prototype._mergeAggregationBuckets(b1, b2))
        .to.deep.equal([
          { key: 'key1', doc_count: 1 },
          { key: 'key2', doc_count: 5 },
          { key: 'key3', doc_count: 7 },
          { key: 'key4', doc_count: 8 }
        ])
    })
  })

  describe('_fixItemStatusAggregation', () => {
    beforeEach(() => {
      // We expect these tests to trigger an ES query to retrieve aggregated
      // non-reap-statuses for the bib:
      sinon.stub(esClient, 'search')
        .callsFake(() => {
          return Promise.resolve(require('./fixtures/es-response-b1234-just-non-recap-statuses.json'))
        })
    })

    afterEach(() => {
      esClient.search.restore()
    })

    it('preserves Available statuses for items that are also available in ReCAP', async () => {
      // Start with an availability resolver wrapping a ES response for a bib
      // with 4 items, where the item-agg shows 2 are RC and all 4 are indexed
      // as Available..
      const availabilityResolver = new AvailabilityResolver(
        require('./fixtures/es-response-b1234-recap-statuses.json')
      )

      // Emulate SCSB reporting that there are two Available items for this bib:
      const recapBarcodesByStatus = {
        Available: ['barcode1', 'barcode2']
      }
      await availabilityResolver._fixItemStatusAggregation({ recapBarcodesByStatus })
      const modifiedResponse = availabilityResolver.elasticSearchResponse
      const buckets = modifiedResponse.aggregations.item_status._nested.buckets
      // Because there are 2 offsite items, and our mocked scsb status response
      // shows two Available items, we expect the final status agg to show 4
      // Available
      expect(buckets).to.deep.equal([
        { key: 'status:a||Available', doc_count: 4 }
      ])
    })

    it('incorporates Not Available statuses for items that are not available in ReCAP', () => {
      const availabilityResolver = new AvailabilityResolver(
        require('./fixtures/es-response-b1234-recap-statuses.json')
      )

      const recapBarcodesByStatus = {
        Available: ['barcode1'],
        'Not Available': ['barcode2']
      }
      return availabilityResolver.responseWithUpdatedAvailability({ recapBarcodesByStatus })
        .then((modifiedResponse) => {
          const buckets = modifiedResponse.aggregations.item_status._nested.buckets
          expect(buckets).to.deep.equal([
            { key: 'status:a||Available', doc_count: 3 },
            { key: 'status:na||Not available', doc_count: 1 }
          ])
        })
    })

    it('incorporates Not Available statuses for partner items that are not available in ReCAP', () => {
      const availabilityResolver = new AvailabilityResolver(
        require('./fixtures/es-response-pb2847934.json')
      )

      const recapBarcodesByStatus = {
        'Not Available': ['32101095377683']
      }
      return availabilityResolver.responseWithUpdatedAvailability({ recapBarcodesByStatus })
        .then((modifiedResponse) => {
          const buckets = modifiedResponse.aggregations.item_status._nested.buckets
          expect(buckets).to.deep.equal([
            { key: 'status:na||Not available', doc_count: 1 }
          ])
        })
    })
  })

  describe('SCSB outage', () => {
    before(() => {
      sinon.stub(scsbClient, 'getItemsAvailabilityForBarcodes')
        .callsFake(() => {
          throw new Error('oh no!')
        })
    })

    after(() => {
      scsbClient.getItemsAvailabilityForBarcodes.restore()
    })

    it('makes recap items na when scsb is out', async () => {
      const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

      const modifiedResponse = await availabilityResolver.responseWithUpdatedAvailability()

      // Just examine items in rc locations:
      const recapItems = modifiedResponse.hits.hits[0]._source.items
        .filter((item) => item.holdingLocation && item.holdingLocation[0] && /^loc:rc/.test(item.holdingLocation[0].id))

      expect(recapItems).to.have.lengthOf(3)

      // Assert that all recap items are Not available:
      recapItems.forEach((item) => {
        // Test AvailabilityResolver munges it into availability
        expect(item.status[0].id).to.equal('status:na')
        expect(item.status[0].label).to.equal('Not available')
      })
    })
  })

  describe('SCSB bad responses', () => {
    // Imagine some unexpected responses:
    ; [
      // Unexpected status string:
      [{ itemBarcode: '10005468369', itemAvailabilityStatus: 'fladeedle' }],
      // An entry without a barcode:
      [{ itemAvailabilityStatus: 'Available' }],
      // Truthy but useless:
      [{ }],
      // Some kind of error response:
      { error: 'some other error' },
      // HTML!
      '<html>oh no html</html',
      // Falsey:
      null,
      // Nonsensical:
      42
    ].forEach((badResponse, index) => {
      it(`makes recap items "na" when scsb returns unexpected responses (#${index})`, async () => {
        // Stub the scsb client to return the bad response:
        sinon.stub(scsbClient, 'getItemsAvailabilityForBarcodes')
          .callsFake(() => Promise.resolve(badResponse))

        const availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
        const modifiedResponse = await availabilityResolver.responseWithUpdatedAvailability()

        // Get the single item for which we've mocked the bad scsb response above:
        const item = modifiedResponse.hits.hits[0]._source.items
          .find((item) => item.identifier && item.identifier[0] === 'urn:barcode:10005468369')

        // Expect the item's Available status to have been flipped to 'na' even
        // through scsb api returned a weird response:
        expect(item.status[0].id).to.equal('status:na')
        expect(item.status[0].label).to.equal('Not available')

        // Restore the client method:
        scsbClient.getItemsAvailabilityForBarcodes.restore()
      })
    })
  })

  describe('invertBarcodeByStatusMapping', () => {
    it('returns empty map if invalid input given', () => {
      ;[null, false, true, 'fladeedle'].forEach((badValue) => {
        expect(AvailabilityResolver.invertBarcodeByStatusMapping(badValue)).to.deep.eq({})
      })
    })

    it('inverts a status to barcode map', () => {
      const map = AvailabilityResolver.invertBarcodeByStatusMapping({
        Available: ['b1', 'b2'],
        'Not available': ['b3', 'b4']
      })
      expect(map).to.deep.eq({
        b1: 'Available',
        b2: 'Available',
        b3: 'Not available',
        b4: 'Not available'
      })
    })
  })
})
