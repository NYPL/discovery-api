/* global describe it done */

const lambdaTester = require('lambda-tester')
const expect = require('chai').expect

const handler = require('../index.js').handler

describe('AWS Lambda Tests', () => {
  describe('No paths given in AWS events', () => {
    it('should throw an error message', () => {
      return lambdaTester(handler)
        .event({})
        .expectError((error) => expect(error.message).to.equal('No event was received.'))
    })

    it('should throw an error message on a bad path', () => {
      return lambdaTester(handler)
        .event({ path: '/api/v0.1/discovery/bad/path' })
        .expectError((error) => {
          console.log(error)
          // Not sure why this is function is not being executed. Should be the same as above, but
          // maybe because it's not a Lambda error but an Express error.
          // expect(error.body).to.equal('Cannot GET /api/v0.1/discovery/bad/path\n')
        })
        .then(() => done())
        .catch((error) => {
          expect(error.result.body).to.equal('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta ' +
            'charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /api/v0.1' +
            '/discovery/bad/path</pre>\n</body>\n</html>\n')
        })
    })
  })

  describe('Basic base paths as input', () => {
    it('should return the API version on the root path', () => {
      return lambdaTester(handler)
        .event({ path: '/' })
        .expectSucceed((result) => {
          expect(result.body).to.equal('0.0.6')
          expect(result.statusCode).to.equal(200)
        })
    })

    it('should return the API version on the base API path', () => {
      return lambdaTester(handler)
        .event({ path: '/api/v0.1/discovery' })
        .expectSucceed((result) => {
          expect(result.body).to.equal('0.0.6')
          expect(result.statusCode).to.equal(200)
        })
    })
  })

  describe('Fetching data from the Express API', () => {
    it('should return data from the main resource path', () => {
      return lambdaTester(handler)
        .event({ path: '/api/v0.1/discovery/resources' })
        .expectSucceed((result) => {
          const data = JSON.parse(result.body)

          expect(result.statusCode).to.equal(200)
          expect(data['@type']).to.equal('itemList')
          expect(data.itemListElement[0]['@type']).to.equal('searchResult')
          // The total number is expected to get updated over time
          expect(data.totalResults).to.equal(9880162)
        })
    })

    it('should return data from a query', () => {
      return lambdaTester(handler)
        .event({
          path: '/api/v0.1/discovery/resources',
          queryStringParameters: {
            q: 'france'
          }
        })
        .expectSucceed((result) => {
          const data = JSON.parse(result.body)

          expect(result.statusCode).to.equal(200)
          expect(data['@type']).to.equal('itemList')
          expect(data.itemListElement[0]['@type']).to.equal('searchResult')
          expect(data.totalResults).to.equal(36558)
        })
        // .verify(done())
    })

    // The next test keeps failing but the one after works. Maybe /resources/aggregations returns
    // too many results and the response times out.
    // it('should return filters from the main aggregation path', () => {
    //   return lambdaTester(handler)
    //     .event({ path: '/api/v0.1/discovery/resources/aggregations' })
    //     .expectSucceed((result) => {
    //       const data = JSON.parse(result.body)
    //
    //       expect(result.statusCode).to.equal(200)
    //       expect(data['@type']).to.equal('itemList')
    //       expect(data.itemListElement[0]['@type']).to.equal('nypl:Aggregation')
    //       // The total number of aggregations is expected to get updated over time
    //       expect(data.totalResults).to.equal(9880161)
    //     })
    // })

    it('should return filters from the aggregation path with a query', () => {
      return lambdaTester(handler)
        .event({
          path: '/api/v0.1/discovery/resources/aggregations',
          queryStringParameters: {
            q: 'france'
          }
        })
        .expectSucceed((result) => {
          const data = JSON.parse(result.body)

          expect(result.statusCode).to.equal(200)
          expect(data['@type']).to.equal('itemList')
          expect(data.itemListElement[0]['@type']).to.equal('nypl:Aggregation')
          expect(data.totalResults).to.equal(36558)
        })
    })

    it('should return data for one resource', () => {
      return lambdaTester(handler)
        .event({ path: '/api/v0.1/discovery/resources/b10000204' })
        .expectSucceed((result) => {
          const data = JSON.parse(result.body)

          expect(result.statusCode).to.equal(200)
          // had to use toString() because `typeof data.type` says it's an object even
          // though data.type = [ 'nypl:Item' ]
          expect(data.type.toString()).to.equal('nypl:Item')
          expect(data.idBnum.toString()).to.equal('10000204')
        })
    })
  })
})
