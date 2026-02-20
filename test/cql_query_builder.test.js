const { expect } = require('chai')

const { buildEsQuery } = require('../lib/elasticsearch/cql_query_builder')
const ApiRequest = require('../lib/api-request')
const {
  simpleAdjQuery,
  simpleAnyQuery,
  simpleAllQuery,
  prefixPhraseQuery,
  anyWithPrefixQuery,
  keywordQueryForBarcode,
  keywordQueryForShelfMark,
  keywordQueryForGeneralTerm,
  identifierQuery,
  binaryBooleanQuery,
  ternaryBooleanQuery,
  queryWithParentheses,
  negationQuery,
  dateBeforeQuery,
  dateBeforeOrOnQuery,
  dateAfterQuery,
  dateAfterOrOnQuery,
  dateWithinQuery,
  dateEnclosesQuery,
  filterQuery
} = require('./fixtures/cql_fixtures')

describe('CQL Query Builder', function () {
  it('Simple = query', function () {
    expect(buildEsQuery('title="Hamlet"'))
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple adj query', function () {
    expect(buildEsQuery('title adj "Hamlet"'))
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple any query', function () {
    expect(buildEsQuery('title any "Hamlet Othello"'))
      .to.deep.equal(
        simpleAnyQuery
      )
  })

  it('Simple all query', function () {
    expect(buildEsQuery('title all "Hamlet Othello"'))
      .to.deep.equal(
        simpleAllQuery
      )
  })

  it('Prefix phrase query', function () {
    expect(buildEsQuery('title = "^The Tragedy of Hamlet, Prince of Denmark"'))
      .to.deep.equal(
        prefixPhraseQuery
      )
  })

  it('Prefix queries mixed into any query', function () {
    expect(buildEsQuery('title any "^Tragedy ^Comedy Hamlet Othello"'))
      .to.deep.equal(
        anyWithPrefixQuery
      )
  })

  it('Keyword query for barcode', function () {
    expect(buildEsQuery('keyword = "123456"'))
      .to.deep.equal(
        keywordQueryForBarcode
      )
  })

  it('Keyword query for shelfMark', function () {
    expect(buildEsQuery('keyword = "B 12"'))
      .to.deep.equal(
        keywordQueryForShelfMark
      )
  })

  it('Keyword query for general term', function () {
    expect(buildEsQuery('keyword = "Hamlet"'))
      .to.deep.equal(
        keywordQueryForGeneralTerm
      )
  })

  it('Identifier query', function () {
    expect(buildEsQuery('identifier = "b1234"'))
      .to.deep.equal(
        identifierQuery
      )
  })

  it('Binary boolean query', function () {
    expect(buildEsQuery('author = "Shakespeare" AND language = "English"'))
      .to.deep.equal(
        binaryBooleanQuery
      )
  })

  it('Ternary boolean query', function () {
    expect(buildEsQuery('author = "Shakespeare" AND language = "English" OR genre = "tragedy"'))
      .to.deep.equal(
        ternaryBooleanQuery
      )
  })

  it('Boolean query with parentheses', function () {
    expect(buildEsQuery('author = "Shakespeare" AND (language = "English" OR genre = "tragedy")'))
      .to.deep.equal(
        queryWithParentheses
      )
  })

  it('Query with NOT', function () {
    expect(buildEsQuery('author = "Shakespeare" NOT language = "English"'))
      .to.deep.equal(
        negationQuery
      )
  })

  it('Query with AND NOT', function () {
    expect(buildEsQuery('author = "Shakespeare" AND NOT language = "English"'))
      .to.deep.equal(
        negationQuery
      )
  })

  it('Date after query', function () {
    expect(buildEsQuery('date > "1990"'))
      .to.deep.equal(
        dateAfterQuery
      )
  })

  it('Date after or on query', function () {
    expect(buildEsQuery('date >= "1990"'))
      .to.deep.equal(
        dateAfterOrOnQuery
      )
  })

  it('Date before query', function () {
    expect(buildEsQuery('date < "1990"'))
      .to.deep.equal(
        dateBeforeQuery
      )
  })

  it('Date dateBeforeOrOnQuery query', function () {
    expect(buildEsQuery('date <= "1990"'))
      .to.deep.equal(
        dateBeforeOrOnQuery
      )
  })

  it('Date within query', function () {
    expect(buildEsQuery('date within "1990 2000"'))
      .to.deep.equal(
        dateWithinQuery
      )
  })

  it('Date encloses query', function () {
    expect(buildEsQuery('date encloses "1990 2000"'))
      .to.deep.equal(
        dateEnclosesQuery
      )
  })

  it('Query with applied filters', function () {
    const apiRequest = new ApiRequest({ filters: { language: ['Klingon'] }, search_scope: 'cql' })
    expect(buildEsQuery('author="Shakespeare"', apiRequest))
      .to.deep.equal(
        filterQuery
      )
  })
})
