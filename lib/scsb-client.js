const ScsbRestClient = require('@nypl/scsb-rest-client')
const request = require('request')
const NyplSourceMapper = require('discovery-store-models/lib/nypl-source-mapper')
const logger = require('./logger')
const { bNumberWithCheckDigit } = require('./util')


let _scsbClient
const scsbClient = () => {
  if (!_scsbClient) _scsbClient = new ScsbRestClient({ url: process.env.SCSB_URL, apiKey: process.env.SCSB_API_KEY })
  return _scsbClient
}

const clientWrapper = {}

/**
 *  Utility for building a function that returns a Promise that rejects the
 *  given error payload in the specified ms. Useful for racing unbound
 *  requests.
 */
const rejectIn = (timeoutMs, errorPayload) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(errorPayload), timeoutMs)
  })
}

clientWrapper.recapCustomerCodeByBarcode = (barcode) => {
  const __start = new Date()
  const search = scsbClient().search({ fieldValue: barcode, fieldName: 'Barcode' })
    .then((response) => {
      let ellapsed = ((new Date()) - __start)
      logger.debug({ message: `HTC searchByParam API took ${ellapsed}ms`, metric: 'searchByParam-barcode', timeMs: ellapsed })

      if (response && response.searchResultRows && response.searchResultRows.length) {
        let results = response.searchResultRows
        let customerCode = null

        if (results && (results.length > 0) && results[0].searchItemResultRows.length > 0) {
          logger.debug(`${barcode} is a serial item`)
          customerCode = results[0].searchItemResultRows[0].customerCode
        } else {
          logger.debug(`${barcode} is a not a serial item`)
          customerCode = results[0].customerCode
        }
        return customerCode
      }
    })
    .catch((error) => {
      // This is a common error:
      //  "Error hitting SCSB API 502: <html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body bgcolor=\"white\">\r\n<center><h1>502 Bad Gateway</h1></center>\r\n</body>\r\n</html>\r\n"
      // return Promise.reject(error)
      logger.error(`Error retrieving customer code by barcode ${barcode}`, { scsbError: error.message })
      return null
    })
  // Artificially limit effective search time by settling in 5s:
  const timeoutMs = 5000
  return Promise.race([
    search,
    rejectIn(timeoutMs, new Error(`Exhausted ${timeoutMs}ms timeout waiting for SCSB`))
  ]).catch((e) => {
    logger.error('Error fetching customer code: ', e)
  })
}

clientWrapper.getItemsAvailabilityForBarcodes = (barcodes) => scsbClient().getItemsAvailabilityForBarcodes(barcodes)

// bnum is a plain bnum without padding such as we use in the DiscoveryAPI
clientWrapper.getItemsAvailabilityForBnum = (bnum) => {
  // Identify nypl-source and unprefixed id:
  const { nyplSource, id } = NyplSourceMapper.instance().splitIdentifier(bnum)
  // Determine SCSB "institutionId" (e.g. NYPL, HL, CUL, PUL):
  const institutionId = nyplSource.split('-').pop().toUpperCase()
  // The "bibliographicId" in SCSB for our items is padded and prefixed;
  // not so for partner items:
  const bibliographicId = institutionId === 'NYPL'
    ? `.b${bNumberWithCheckDigit(id)}`
    : id
  const body = { institutionId, bibliographicId }
  return scsbClient()
    .scsbQuery('/sharedCollection/bibAvailabilityStatus', body)
    // Remove entries sans barcodes as they are just error responses
    .then((resp) => {
      if (!resp || !Array.isArray(resp)) {
        logger.error(`Error retrieving availability by bnum ${bnum} (${body.bibliographicId})`, resp)
        return []
      }
      return resp.filter((entry) => entry.itemBarcode)
    })
}

/**
 *  Return a map relating distinct ReCAP statuses to the set of barcodes
 */
clientWrapper.getBarcodesByStatusForBnum = (bnum) => {
  return clientWrapper.getItemsAvailabilityForBnum(bnum)
    .then((scsbResp) => {
      return scsbResp
        .reduce((h, entry) => {
          if (!h[entry.itemAvailabilityStatus]) h[entry.itemAvailabilityStatus] = []
          h[entry.itemAvailabilityStatus].push(entry.itemBarcode)
          return h
        }, {})
    })
}

// Shim scsbQuery as general-purpose function for performing arbitrary SCSB
// queries (this function is available in @nypl/scsb-rest-client#2.0, which
// requires Node12+, preventing this app from using it for now.)
ScsbRestClient.prototype.scsbQuery = function (path, body) {
  return new Promise((resolve, reject) => {
    var options = {
      url: this.url + path,
      headers: this._headers(),
      body: JSON.stringify(body),
      // Fail any SCSB query that exceeds 3s (at writing this function is only
      // used by getItemsAvailabilityForBnum)
      timeout: 3000
    }
    request.post(options, (error, response, body) => {
      if (error) {
        reject(error)
      } else if (response && response.statusCode === 200) {
        resolve(JSON.parse(body))
      } else {
        reject(new Error(`Error hitting SCSB API ${response.statusCode}: ${response.body}`))
      }
    })
  })
}

clientWrapper._private = {
  ScsbRestClient
}

module.exports = clientWrapper
