const { expect } = require('chai')

const { buildEsQuery } = require('../lib/elasticsearch/cql_query_builder')
const {
  simpleAdjQuery,
  simpleAnyQuery,
  simpleAllQuery,
  prefixPhraseQuery,
  anyWithPrefixQuery,
  keywordQueryForBarcode,
  keywordQueryForShelfMark,
  keywordQueryForGeneralTerm,
  identifierQuery
} = require('./fixtures/cql_fixtures')

describe.only('CQL Query Builder', function () {
  it('Simple = query', function () {
    expect(buildEsQuery("title=\"Hamlet\""))
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple adj query', function () {
    expect(buildEsQuery("title adj \"Hamlet\""))
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple any query', function () {
    expect(buildEsQuery("title any \"Hamlet Othello\""))
      .to.deep.equal(
        simpleAnyQuery
      )
  })

  it('Simple all query', function () {
    expect(buildEsQuery("title all \"Hamlet Othello\""))
      .to.deep.equal(
        simpleAllQuery
      )
  })

  it('Prefix phrase query', function () {
    expect(buildEsQuery("title = \"^The Tragedy of Hamlet, Prince of Denmark\""))
      .to.deep.equal(
        prefixPhraseQuery
      )
  })

  it('Prefix queries mixed into any query', function () {
    expect(buildEsQuery("title any \"^Tragedy ^Comedy Hamlet Othello\""))
      .to.deep.equal(
        anyWithPrefixQuery
      )
  })

  it('Keyword query for barcode', function () {
    expect(buildEsQuery("keyword = \"123456\""))
      .to.deep.equal(
        keywordQueryForBarcode
      )
  })

  it('Keyword query for shelfMark', function () {
    expect(buildEsQuery("keyword = \"B 12\""))
      .to.deep.equal(
        keywordQueryForShelfMark
      )
  })

  it('Keyword query for general term', function () {
    expect(buildEsQuery("keyword = \"Hamlet\""))
      .to.deep.equal(
        keywordQueryForGeneralTerm
      )
  })

  it('Identifier query', function () {
    expect(buildEsQuery("identifier = \"b1234\""))
      .to.deep.equal(
        identifierQuery
      )
  })
})
