/* eslint-env mocha */

var AvailabilityResolver = require('../lib/availability_resolver.js')
var expect = require("chai").expect;

describe('Response with updated availability', function () {
    it('includes the latest availability status of items', function () {

      let elasticSearchResponse = require('./searchResponse.json')
      let availabilityResolver = new AvailabilityResolver(elasticSearchResponse)
      return availabilityResolver.responseWithUpdatedAvailability()
        .then((newResponse) => {
            return newResponse
        })
        .then((response) => {
            var hit = response.hits.hits[0]
            var items = hit._source.items
            items.forEach((item) => {
                if(item.status)
                    console.log(item.uri + " : " + JSON.stringify(item.status))
                if(item.uri === 'i10283665'){
                    expect(item.status[0].id).to.equal('status:a')
                    expect(item.status[0].label).to.equal('Available')
                }else if(item.uri === 'i10283664'){
                    expect(item.status[0].id).to.equal('status:u')
                    expect(item.status[0].label).to.equal('Temporarily unavailable')
                }
            })
        })
    })
  })
