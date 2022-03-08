const SCSBRestClient = require('@nypl/scsb-rest-client')
const logger = require('./logger')

class ScsbClientWithRecap extends SCSBRestClient {
  recapCustomerCodeByBarcode (barcode) {
    const __start = new Date()
    return super.search({ fieldValue: barcode, fieldName: 'Barcode' })
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
        logger.error({ message: 'HTC API error. Send everything to NH', htcError: error.message })
        return null
      })
  }
}

module.exports = ScsbClientWithRecap
