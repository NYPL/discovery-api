var request = require('request')

// myClient = new SCSBRestClient({url: "foo", apiKey: "bar"})
class SCSBRestClient {
  constructor ({url = null, apiKey = null}) {
    this.url = url
    this.apiKey = apiKey

    if (this.url === null || this.apiKey === null) {
      throw new Error('SCSBRestClient must be instaniated with a url and apiKey')
    }
  }

  getItemsAvailabilityForBarcodes (barcodes = []) {
    return new Promise((resolve, reject) => {
      var bodyToSend = {}
      bodyToSend = {barcodes: barcodes}
      var options = {
        url: this.url + '/sharedCollection/itemAvailabilityStatus',
        headers: {
          'Accept': 'application/json',
          'api_key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyToSend)
      }
      request.post(options, (error, response, body) => {
        if (error) {
          reject(error)
        } else if (response && response.statusCode === 200) {
          resolve(JSON.parse(body))
        } else {
          reject(`Error hitting SCSB API ${response.statusCode}: ${response.body}`)
        }
      })
    })
  }
}

module.exports = SCSBRestClient
