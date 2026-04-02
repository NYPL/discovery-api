const { expect } = require('chai')

const { CqlQuery } = require('../lib/elasticsearch/cql_query_builder')
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
  filterQuery,
  multiAdjQuery,
  exactMatchQuery
} = require('./fixtures/cql_fixtures')

describe('CQL Query Builder', function () {
  it('Simple = query', function () {
    expect(new CqlQuery('title="Hamlet"').buildEsQuery())
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple adj query', function () {
    expect(new CqlQuery('title adj "Hamlet"').buildEsQuery())
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Multi-word adj query', function () {
    expect(new CqlQuery('title adj "Hamlet, Prince"').buildEsQuery())
      .to.deep.equal(
        multiAdjQuery
      )
  })

  it('Simple any query', function () {
    expect(new CqlQuery('title any "Hamlet Othello"').buildEsQuery())
      .to.deep.equal(
        simpleAnyQuery
      )
  })

  it('Simple all query', function () {
    expect(new CqlQuery('title all "Hamlet Othello"').buildEsQuery())
      .to.deep.equal(
        simpleAllQuery
      )
  })

  it('Prefix phrase query', function () {
    expect(new CqlQuery('title = "^The Tragedy of Hamlet, Prince of Denmark"').buildEsQuery())
      .to.deep.equal(
        prefixPhraseQuery
      )
  })

  it('Prefix queries mixed into any query', function () {
    expect(new CqlQuery('title any "^Tragedy ^Comedy Hamlet Othello"').buildEsQuery())
      .to.deep.equal(
        anyWithPrefixQuery
      )
  })

  it('Keyword query for barcode', function () {
    expect(new CqlQuery('keyword = "123456"').buildEsQuery())
      .to.deep.equal(
        keywordQueryForBarcode
      )
  })

  it('Keyword query for shelfMark', function () {
    expect(new CqlQuery('keyword = "B 12"').buildEsQuery())
      .to.deep.equal(
        keywordQueryForShelfMark
      )
  })

  it('Keyword query for general term', function () {
    expect(new CqlQuery('keyword = "Hamlet"').buildEsQuery())
      .to.deep.equal(
        keywordQueryForGeneralTerm
      )
  })

  it('Identifier query', function () {
    expect(new CqlQuery('identifier = "b1234"').buildEsQuery())
      .to.deep.equal(
        identifierQuery
      )
  })

  it('Binary boolean query', function () {
    expect(new CqlQuery('author = "Shakespeare" AND language = "English"').buildEsQuery())
      .to.deep.equal(
        binaryBooleanQuery
      )
  })

  it('Ternary boolean query', function () {
    expect(new CqlQuery('author = "Shakespeare" AND language = "English" OR genre = "tragedy"').buildEsQuery())
      .to.deep.equal(
        ternaryBooleanQuery
      )
  })

  it('Boolean query with parentheses', function () {
    expect(new CqlQuery('author = "Shakespeare" AND (language = "English" OR genre = "tragedy")').buildEsQuery())
      .to.deep.equal(
        queryWithParentheses
      )
  })

  it('Boolean query with parentheses and whitespace', function () {
    expect(new CqlQuery('author = "Shakespeare"   AND ( language = "English" OR genre = "tragedy" )').buildEsQuery())
      .to.deep.equal(
        queryWithParentheses
      )
  })

  it('Query with NOT', function () {
    expect(new CqlQuery('author = "Shakespeare" NOT language = "English"').buildEsQuery())
      .to.deep.equal(
        negationQuery
      )
  })

  it('Query with AND NOT', function () {
    expect(new CqlQuery('author = "Shakespeare" AND NOT language = "English"').buildEsQuery())
      .to.deep.equal(
        negationQuery
      )
  })

  it('Date after query', function () {
    expect(new CqlQuery('date > "1990"').buildEsQuery())
      .to.deep.equal(
        dateAfterQuery
      )
  })

  it('Date after or on query', function () {
    expect(new CqlQuery('date >= "1990"').buildEsQuery())
      .to.deep.equal(
        dateAfterOrOnQuery
      )
  })

  it('Date before query', function () {
    expect(new CqlQuery('date < "1990"').buildEsQuery())
      .to.deep.equal(
        dateBeforeQuery
      )
  })

  it('Date dateBeforeOrOnQuery query', function () {
    expect(new CqlQuery('date <= "1990"').buildEsQuery())
      .to.deep.equal(
        dateBeforeOrOnQuery
      )
  })

  it('Date within query', function () {
    expect(new CqlQuery('date within "1990 2000"').buildEsQuery())
      .to.deep.equal(
        dateWithinQuery
      )
  })

  it('Date encloses query', function () {
    expect(new CqlQuery('date encloses "1990 2000"').buildEsQuery())
      .to.deep.equal(
        dateEnclosesQuery
      )
  })

  it('Query with applied filters', function () {
    const apiRequest = new ApiRequest({ filters: { language: ['Klingon'] }, search_scope: 'cql' })
    expect(new CqlQuery('author="Shakespeare"').buildEsQuery(apiRequest))
      .to.deep.equal(
        filterQuery
      )
  })

  it('Exact match query', function () {
    expect(new CqlQuery('author == "William Shakespeare"').buildEsQuery())
      .to.deep.equal(
        exactMatchQuery
      )
  })

  it('Handles query with funny casing', function () {
    expect(new CqlQuery('AuThOr = "Shakespeare" aNd LaNgUaGe = "English"').buildEsQuery())
      .to.deep.equal(
        binaryBooleanQuery
      )
  })
})
