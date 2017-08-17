let AvailabilityResolver = require('../lib/availability_resolver.js')
let elasticSearchResponse = require('./fixtures/elastic_search_response.js')

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
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponse())

    availabilityResolver.restClient = getFakeRestClient()

    let indexedAsUnavailableURI = 'i10283664'

    let indexedAsUnavailable = elasticSearchResponse.fakeElasticSearchResponse().hits.hits[0]._source.items.find((item) => {
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
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponse())
    availabilityResolver.restClient = getFakeRestClient()

    let indexedAsAvailableURI = 'i10283665'
    let indexedAsAvailable = elasticSearchResponse.fakeElasticSearchResponse().hits.hits[0]._source.items.find((item) => {
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
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponse())
    availabilityResolver.restClient = getFakeRestClient()

    let indexedButNotAvailableInSCSBURI = 'i22566485'
    let indexedButNotAvailableInSCSB = elasticSearchResponse.fakeElasticSearchResponse().hits.hits[0]._source.items.find((item) => {
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
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponse())
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
    let availabilityResolver = new AvailabilityResolver(elasticSearchResponse.fakeElasticSearchResponse())
    availabilityResolver.restClient = getFakeRestClient()

    return availabilityResolver.responseWithUpdatedAvailability()
        .then((modifedResponse) => {
          return modifedResponse
        })
        .then((response) => {
          var items = response.hits.hits[0]._source.items

          var unavailableItem = items.find((item) => {
            return item.uri === 'i10283665'
          })
          expect(unavailableItem.status[0].id).to.equal('status:na')
          expect(unavailableItem.status[0].label).to.equal('Not available')

          var availableItem = items.find((item) => {
            return item.uri === 'i10283664'
          })
          expect(availableItem.status[0].id).to.equal('status:a')
          expect(availableItem.status[0].label).to.equal('Available')
        })
  })
})
