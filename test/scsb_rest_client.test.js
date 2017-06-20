/* eslint no-new:0 */

let SCSBRestClient = require('../lib/scsb_rest_client.js')

describe('SCSBRestClient', function () {
  it('Throws an exception if instaniated without an API Key', function () {
    expect(function () { new SCSBRestClient({url: 'https://example.com'}) }).to.throw(Error, 'SCSBRestClient must be instaniated with a url and apiKey')
  })

  it('Throws an exception if instaniated without a URL', function () {
    expect(function () { new SCSBRestClient({apiKey: 'keepitlikeasecret'}) }).to.throw(Error, 'SCSBRestClient must be instaniated with a url and apiKey')
  })
})
