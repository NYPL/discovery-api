var request = require('request-promise')
var assert = require('assert')
const config = require('config')

var base_url = ('http://localhost:' + config.get('port'))

describe('Aggregations response', function () {
  this.timeout(10000)
  var requestPath = '/api/v0.1/discovery/resources/aggregations?q=hamilton&search_scope=all'
  // This is a bad test.
  // * It's super dependent on our index at the time of writing.
  // * It talks to the network
  // * It tests functionality in that should probably go into a Serializer unit test
  // That said - it's what I have to fix this regession:
  //   https://github.com/NYPL-discovery/discovery-api/issues/45
  it('should unpack fields', function (done) {
    request.get(`${base_url}${requestPath}`, function (err, response, body) {
      if (err) throw err
      assert.equal(200, response.statusCode)
      var doc = JSON.parse(body)
      var values = doc.itemListElement[0].values
      expect(values.length).to.be.above(0)
      expect(values[0].value).to.equal('orgs:1000')
      expect(values[0].label).to.equal('Stephen A. Schwarzman Building')
      done()
    })
  })
})
