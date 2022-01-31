let AvailabilityResolver = require('../lib/availability_resolver.js')
let elasticSearchResponse = require('./fixtures/elastic_search_response.js')
// let specRequestableElasticSearchResponse = require('./fixtures/specRequestable-es-response')

function getFakeRestClient () {
  var response = [
    {
      'itemBarcode': '33433058338470',
      'itemAvailabilityStatus': "Item Barcode doesn't exist in SCSB database.",
      'errorMessage': null
    },
    {
      'itemBarcode': '32101071572406',
      'itemAvailabilityStatus': 'Not Available',
      'errorMessage': null
    },
    {
      'itemBarcode': '1000546836',
      'itemAvailabilityStatus': 'Available',
      'errorMessage': null
    },
    // An item in rc2ma", which ES has as Available:
    {
      'itemBarcode': '10005468369',
      'itemAvailabilityStatus': 'Not Available',
      'errorMessage': null
    },
    // CUL item (available):
    {
      'itemBarcode': '1000020117',
      'itemAvailabilityStatus': 'Available',
      'errorMessage': null
    },
    // CUL item (not available):
    {
      'itemBarcode': '10000201179999',
      'itemAvailabilityStatus': 'Not Available',
      'errorMessage': null
    }

  ]

  return {
    getItemsAvailabilityForBarcodes: function (barcodes) {
      return Promise.resolve(response)
    }
  }
}

describe('Response with updated availability', function () {
  it('will change an items status to "Available" if ElasticSearch says it\'s unavailable but SCSB says it is Available', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())

    availabilityResolver.restClient = getFakeRestClient()

    let indexedAsUnavailableURI = 'i10283664'

    let indexedAsUnavailable = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
      return item.uri === indexedAsUnavailableURI
    })

    // Test that it's unavailable at first
    expect(indexedAsUnavailable.status[0].id).to.equal('status:na')
    expect(indexedAsUnavailable.status[0].label).to.equal('Not available')

    return availabilityResolver.responseWithUpdatedAvailability()
    .then((modifedResponse) => {
      let theItem = modifedResponse.hits.hits[0]._source.items.find((item) => {
        return item.uri === indexedAsUnavailableURI
      })

      // Test AvailabilityResolver munges it into availability
      expect(theItem.status[0].id).to.equal('status:a')
      expect(theItem.status[0].label).to.equal('Available')
    })
  })

  it('will change an items status to "Unavailable" if ElasticSearch says it\'s Available but SCSB says it is Unvailable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    let indexedAsAvailableURI = 'i102836649'
    let indexedAsAvailable = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
      return item.uri === indexedAsAvailableURI
    })

    // Test that it's available at first
    expect(indexedAsAvailable.status[0].id).to.equal('status:a')
    expect(indexedAsAvailable.status[0].label).to.equal('Available')

    return availabilityResolver.responseWithUpdatedAvailability()
      .then((modifiedResponse) => {
        let theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => {
          return item.uri === indexedAsAvailableURI
        })

        // Test AvailabilityResolver munges it into temporarily unavailable
        expect(theItem.status[0].id).to.equal('status:na')
        expect(theItem.status[0].label).to.equal('Not available')
      })
  })

  it('will return the original ElasticSearchResponse\'s status for the item if the SCSB can\'t find an item with the barcode', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    let indexedButNotAvailableInSCSBURI = 'i22566485'
    let indexedButNotAvailableInSCSB = elasticSearchResponse.fakeElasticSearchResponseNyplItem().hits.hits[0]._source.items.find((item) => {
      return item.uri === indexedButNotAvailableInSCSBURI
    })

    expect(indexedButNotAvailableInSCSB.status[0].id).to.equal('status:a')
    expect(indexedButNotAvailableInSCSB.status[0].label).to.equal('Available')

    return availabilityResolver.responseWithUpdatedAvailability()
      .then((modifiedResponse) => {
        let theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => {
          return item.uri === indexedButNotAvailableInSCSBURI
        })

        // As this item is not available in SCSB, the elasticSearchResponse's availability for the item was returned
        expect(theItem.status[0].id).to.equal('status:a')
        expect(theItem.status[0].label).to.equal('Available')
      })
  })

  it('will set requestable to false for an item not found in ReCAP', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    let indexedButNotAvailableInSCSBURI = 'i22566485'

    return availabilityResolver.responseWithUpdatedAvailability()
      .then((modifiedResponse) => {
        // Find the modified item in the response:
        let theItem = modifiedResponse.hits.hits[0]._source.items.find((item) => item.uri === indexedButNotAvailableInSCSBURI)

        // Our fakeRESTClient said its barcode doesn't exist, so it should appear with `requestable` false
        expect(theItem.requestable[0]).to.equal(false)
      })
  })

  it('includes the latest availability status of items', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          // A ReCAP item with Discovery status 'Available', but SCSB
          // status 'Not Available' should be made 'Not Available'
          var unavailableItem = items.find((item) => {
            return item.uri === 'i102836649'
          })
          expect(unavailableItem.status[0].id).to.equal('status:na')
          expect(unavailableItem.status[0].label).to.equal('Not available')

          // A ReCAP item with Discovery status 'Not Avaiable', but SCSB
          // status 'Available' should be made available:
          var availableItem = items.find((item) => {
            return item.uri === 'i10283664'
          })
          expect(availableItem.status[0].id).to.equal('status:a')
          expect(availableItem.status[0].label).to.equal('Available')
        })
  })

  it('marks ReCAP items that are SCSB Available items as physRequestable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          // A ReCAP item with SCSB status 'Available' should be
          // made physRequestable:
          var availableItem = items.find((item) => {
            return item.uri === 'i10283664'
          })
          expect(availableItem.physRequestable[0]).to.equal(true)
        })
  })

  it('marks SCSB Available items (that are indexed as Not Available) as requestable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          // A ReCAP item with Discovery status 'Not Available', but SCSB
          // status 'Available' should be made requestable:
          var availableItem = items.find((item) => {
            return item.uri === 'i10283664'
          })
          expect(availableItem.requestable[0]).to.equal(true)
        })
  })

  it('marks SCSB Not-Available items as not requestable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          // A ReCAP item with SCSB status 'Not Available' should be made not
          // requestable:
          var notAvailableItem = items.find((item) => item.uri === 'i102836649')
          expect(notAvailableItem.requestable[0]).to.equal(false)
        })
  })

  it('marks on-site (loc:scff2) Available items as requestable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    process.env.FEATURES = 'on-site-edd'
    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var availableItem = items.find((item) => item.uri === 'i10283665')
          expect(availableItem.requestable[0]).to.equal(true)
        })
  })

  it('marks on-site (loc:scff2) Not-Available items as not requestable', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    process.env.FEATURES = 'on-site-edd'
    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var notAvailableItem = items.find((item) => item.uri === 'i10283665777')
          expect(notAvailableItem.requestable[0]).to.equal(false)
        })
  })

  it('marks on-site (loc:scff2) Available items as not requestable if "on-site-edd" feature flag missing', function () {
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseNyplItem())
    availabilityResolver.restClient = getFakeRestClient()

    process.env.FEATURES = ''
    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var availableItem = items.find((item) => item.uri === 'i10283665')
          expect(availableItem.requestable[0]).to.equal(false)
        })
  })

  describe('CUL item', function () {
    let availabilityResolver = null

    before(function () {
      availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponseCulItem())
      availabilityResolver.restClient = getFakeRestClient()
    })

    it('marks CUL item Available when SCSB API indicates it is so', function () {
      return availabilityResolver.responseWithUpdatedAvailability()
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var availableItem = items.find((item) => item.uri === 'ci1455504')
          expect(availableItem.requestable[0]).to.equal(true)
          expect(availableItem.status[0].label).to.equal('Available')
        })
    })

    it('marks CUL item Not Available when SCSB API indicates it is so', function () {
      return availabilityResolver.responseWithUpdatedAvailability()
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var availableItem = items.find((item) => item.uri === 'ci14555049999')
          expect(availableItem.requestable[0]).to.equal(false)
          expect(availableItem.status[0].label).to.equal('Not available')
        })
    })
  })

  // describe('Special collections items', function () {
  //   let availabilityResolver = null
  //   before(function () {
  //     availabilityResolver = new AvailabilityResolver(specRequestableElasticSearchResponse())
  //   })
  //   it('marks items as specRequestable when there is an aeonURL present', function () {
  //     let response = availabilityResolver.responseWithUpdatedAvailability()
  //     const items = response.hits.hits[0]._source.items
  //     const specRequestableItem = items.find((item) => item.uri === 'i22566485')
  //     expect(specRequestableItem.specRequestable[0]).to.equal(true)
  //   })
  // })
})

