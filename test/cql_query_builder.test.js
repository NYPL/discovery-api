const { expect } = require('chai')

const { CqlQuery } = require('../lib/elasticsearch/cql_query_builder')
const ApiRequest = require('../lib/api-request')
const { InvalidParameterError } = require('../lib/errors')
const ControlledVocabularies = require('../lib/models/ControlledVocabularies')
const vocabFixture = require('./fixtures/controlledVocabularies.json')
const {
  filterQuery,
  simpleAdjQuery,
  simpleAnyQuery,
  simpleAllQuery,
  keywordQueryForBarcode,
  keywordQueryForShelfMark,
  keywordQueryForGeneralTerm,
  identifierQuery,
  binaryBooleanQuery,
  ternaryBooleanQuery,
  dateBeforeQuery,
  dateBeforeOrOnQuery,
  dateAfterQuery,
  dateAfterOrOnQuery,
  dateWithinQuery,
  dateEnclosesQuery,
  multiAdjQuery,
  divisionAdj,
  divisionAll,
  divisionAny,
  divisionExact,
  englishExactLanguageQuery,
  wildcardQueryNoShelfMark,
  wildcardQueryWithShelfMark
} = require('./cql_es_queries')
const { FILTER_CONFIG, SEARCH_SCOPES } = require('../lib/elasticsearch/config')

const isValidLanguageQuery = (clause) => {
  const hasIdAndLabelTerms = ({ term }) => expect(Object.keys(term)).to.have.members(['language.id', 'language.label'])
  clause.bool.should.every(should => should.length === 2 && should.every(hasIdAndLabelTerms))
}

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
    const prefixPhraseQuery = new CqlQuery('title = "^The Tragedy of Hamlet, Prince of Denmark"').buildEsQuery()
    // expect a prefix should clause for every field in filter_config
    const shoulds = prefixPhraseQuery.bool.must[0].bool.should[0].bool.should
    expect(shoulds.map(({ prefix }) => Object.keys(prefix)).flat()).to.have.members(FILTER_CONFIG.title.field)
  })

  it('Prefix queries mixed into any query', function () {
    const anyWithPrefixQuery = new CqlQuery('title any "^Tragedy ^Comedy Hamlet Othello"')
    const queryBody = anyWithPrefixQuery.buildEsQuery()
    // one upper level should for every token
    const topLevelShoulds = queryBody.bool.must[0].bool.should[0].bool.should
    expect(topLevelShoulds.length).to.equal(4)
    topLevelShoulds.forEach((queryPerToken, i) => {
      const innerShoulds = queryPerToken.bool.should
      if (i < 2) {
        // individual prefix queries per field
        expect(innerShoulds.map(({ prefix }) => Object.keys(prefix)).flat()).to.have.members(FILTER_CONFIG.title.field)
      }
      if (i > 1) {
        // single multi match query on text fields
        expect(innerShoulds.length).to.equal(1)
        expect(innerShoulds[0].multi_match.fields).to.have.members(SEARCH_SCOPES.title.fields)
      }
    })
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
    const queryWithParentheses = new CqlQuery('author = "Shakespeare" AND (language = "English" OR genre = "tragedy")').buildEsQuery()
    const musts = queryWithParentheses.bool.must[0].bool.must
    // one must for each top level clause
    expect(musts.length).to.equal(2)
    const multiMatch = musts[0].bool.should[0].bool.should[0].multi_match
    expect(multiMatch.query).to.equal('Shakespeare')
    expect(multiMatch.fields).to.have.members(SEARCH_SCOPES.contributor.fields)
    expect(multiMatch.type).to.equal('phrase')
    const languageClauses = musts[1].bool.should[0].bool.should[0].bool.must[0].bool.should
    // expect all relevant ids for english language to be present
    expect(languageClauses.length).to.equal(4)
    expect(languageClauses.every(isValidLanguageQuery))
    const genreClause = musts[1].bool.should[1].bool.should[0].bool.should[0].multi_match
    expect(genreClause.query).to.equal('tragedy')
    expect(genreClause.fields).to.have.members(SEARCH_SCOPES.genre.fields)
    expect(genreClause.type).to.equal('phrase')
  })

  it('whitespace is ignored with parens', function () {
    expect(new CqlQuery('  author = "Shakespeare"   AND ( language = "English" OR genre = "tragedy" )  ').buildEsQuery())
      .to.deep.equal(
        new CqlQuery('author = "Shakespeare" AND (language = "English" OR genre = "tragedy")').buildEsQuery()
      )
  })

  it('AND and AND NOT are equivalent', () => {
    const NOT = new CqlQuery('author = "Shakespeare" NOT language = "English"').buildEsQuery()
    const AND_NOT = new CqlQuery('author = "Shakespeare" AND NOT language = "English"').buildEsQuery()
    expect(NOT).to.deep.equal(AND_NOT)
  })

  it('Query with NOT', function () {
    const negationQuery = new CqlQuery('author = "Shakespeare" NOT language = "English"').buildEsQuery()
    const outerMusts = negationQuery.bool.must[0].bool.must
    const outerMustNot = negationQuery.bool.must[0].bool.must_not
    // expect a must for both queries
    expect(outerMusts.length).to.equal(1)
    expect(outerMustNot.length).to.equal(1)
    const authorClause = outerMusts[0]
    expect(authorClause.bool.should[0].bool.should[0].multi_match.fields).to.have.members(SEARCH_SCOPES.contributor.fields)
    const languageClauses = outerMustNot[0].bool.should[0].bool.must[0].bool.should
    // expect all relevant ids for english language to be present
    expect(languageClauses.length).to.equal(4)
    expect(languageClauses.every(isValidLanguageQuery))
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
    expect(new CqlQuery('date encloses "1990"').buildEsQuery())
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
    const theThing = new CqlQuery('author="Shakespeare"').buildEsQuery(apiRequest)
    expect(theThing).to.deep.equal(filterQuery)
  })

  it('Exact match query', function () {
    const exactMatchQuery = new CqlQuery('author == "William Shakespeare"').buildEsQuery()
    const shoulds = exactMatchQuery.bool.must[0].bool.should[0].bool.should
    // expect a term should clause for every field in filter_config
    expect(shoulds.map(({ term }) => Object.keys(term)).flat()).to.have.members(FILTER_CONFIG.contributorLiteral.field)
  })

  it('Handles query with funny casing', function () {
    const binaryBooleanQuery = new CqlQuery('AuThOr = "Shakespeare" aNd LaNgUaGe = "English"').buildEsQuery()
    const outerMusts = binaryBooleanQuery.bool.must[0].bool.must
    // expect a must for both queries
    expect(outerMusts.length).to.equal(2)
    const authorClause = outerMusts[0]
    expect(authorClause.bool.should[0].bool.should[0].multi_match.fields).to.have.members(SEARCH_SCOPES.contributor.fields)
    const languageClauses = outerMusts[1].bool.should[0].bool.must[0].bool.should
    // expect all relevant ids for english language to be present
    expect(languageClauses.length).to.equal(4)
  })

  it('Wildcard query without shelfMark fields', function () {
    expect(new CqlQuery('title="Ham*let"').buildEsQuery())
      .to.deep.equal(
        wildcardQueryNoShelfMark
      )
  })

  it('Wildcard query with shelfMark fields', function () {
    expect(new CqlQuery('keyword="B 12*"').buildEsQuery())
      .to.deep.equal(
        wildcardQueryWithShelfMark
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

    it('Maps controlled vocab fields correctly for == when label is used instead of value', () => {
      const result = new CqlQuery('division == "Milstein Division"').buildEsQuery()
      console.dir(result, { depth: null })
      expect(result).to.deep.equal(
        divisionExact
      )
    })

    it('generates correct controlled vocab query for == with language scope based on label', () => {
      const result = new CqlQuery('language == "English"').buildEsQuery()
      expect(result).to.deep.equal(englishExactLanguageQuery)
    })

    it('generates correct controlled vocab query for == with language scope based on value', () => {
      const result = new CqlQuery('language == "lang:eng"').buildEsQuery()
      expect(result).to.deep.equal(englishExactLanguageQuery)
    })

    it('generates correct controlled vocab query for == with language scope based on value without lang: prefix', () => {
      const result = new CqlQuery('language == "eng"').buildEsQuery()
      expect(result).to.deep.equal(englishExactLanguageQuery)
    })
  })
})
