const { expect } = require('chai')

const { CqlQuery } = require('../lib/elasticsearch/cql_query_builder')
const ApiRequest = require('../lib/api-request')
const { InvalidParameterError } = require('../lib/errors')
const ControlledVocabularies = require('../lib/models/ControlledVocabularies')
const vocabFixture = require('./fixtures/controlledVocabularies.json')
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
  exactMatchQuery,
  divisionAdj,
  divisionAll,
  divisionAny,
  divisionExact
} = require('./fixtures/cql_fixtures')

describe('CQL Query Builder', function () {
  before(() => {
    ControlledVocabularies.cachedData = vocabFixture
  })

  it('Simple = query', function () {
    expect(new CqlQuery('title="Hamlet"').buildEsQuery())
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Trims whitespace in query terms', function () {
    expect(new CqlQuery('title="  Hamlet  "').buildEsQuery())
      .to.deep.equal(
        simpleAdjQuery
      )
  })

  it('Simple = query without quotes', function () {
    expect(new CqlQuery('title=Hamlet').buildEsQuery())
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
    expect(new CqlQuery('  author = "Shakespeare"   AND ( language = "English" OR genre = "tragedy" )  ').buildEsQuery())
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

  it('Throws InvalidParameterError for invalid date formats', function () {
    expect(() => new CqlQuery('date > "199"').buildEsQuery()).to.throw(InvalidParameterError, 'Dates must be of the form YYYY, YYYY/MM, or YYYY/MM/DD ')
    expect(() => new CqlQuery('date > "1990/1"').buildEsQuery()).to.throw(InvalidParameterError, 'Dates must be of the form YYYY, YYYY/MM, or YYYY/MM/DD ')
    expect(() => new CqlQuery('date > "not-a-date"').buildEsQuery()).to.throw(InvalidParameterError, 'Dates must be of the form YYYY, YYYY/MM, or YYYY/MM/DD ')
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

  describe('displayParsed', function () {
    it('returns parsed AST array for valid queries', function () {
      const result = new CqlQuery('title="Hamlet"').displayParsed()
      expect(result).to.have.property('parsed')
      expect(result).to.not.have.property('error')
      expect(result.parsed).to.deep.equal(['title', '=', '"Hamlet"'])
    })

    it('returns parsed AST array for complex queries', function () {
      const result = new CqlQuery('author="Shakespeare" AND (language="English" OR genre="tragedy")').displayParsed()
      expect(result).to.have.property('parsed')
      expect(result).to.not.have.property('error')
      expect(result.parsed).to.deep.equal([
        ['author', '=', '"Shakespeare"'],
        'AND',
        [
          ['language', '=', '"English"'],
          'OR',
          ['genre', '=', '"tragedy"']
        ]
      ])
    })

    it('returns error message for invalid queries', function () {
      const result = new CqlQuery('title="Hamlet" AND').displayParsed()
      expect(result).to.have.property('error')
      expect(result).to.not.have.property('parsed')
      expect(result.error).to.include('parsing error')
    })

    it('returns specific error message for partially valid queries', function () {
      const result = new CqlQuery('badscope="Hamlet" AND title="Dogs"').displayParsed()
      expect(result).to.have.property('error')
      expect(result).to.not.have.property('parsed')
      expect(result.error).to.include('Parsing error likely near end of')
    })

    it('Maps controlled vocab fields correctly for any', () => {
      const result = new CqlQuery('division any "manuscript art"').buildEsQuery()
      expect(result).to.deep.equal(
        divisionAny
      )
    })

    it('Maps controlled vocab fields correctly for all', () => {
      const result = new CqlQuery('division all "manuscript art"').buildEsQuery()
      expect(result).to.deep.equal(
        divisionAll
      )
    })

    it('Maps controlled vocab fields correctly for adj', () => {
      const result = new CqlQuery('division adj "manuscripts archives"').buildEsQuery()
      expect(result).to.deep.equal(
        divisionAdj
      )
    })

    it('Maps controlled vocab fields correctly for ==', () => {
      const result = new CqlQuery('division == "mag"').buildEsQuery()
      expect(result).to.deep.equal(
        divisionExact
      )
    })
  })
})
