const { expect } = require('chai')

const { buildEsQuery } = require('../lib/elasticsearch/cql_query_builder')
const { simpleAnyQuery } = require('./fixtures/cql_fixtures')

// describe('CQL Query Builder', function () {
//   it('Simple = query', function () {
//     expect(buildEsQuery("title=\"Hamlet\""))
//       .to.deep.equal(
//         simpleAnyQuery
//       )
//   })
// })
