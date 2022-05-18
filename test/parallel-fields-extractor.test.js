const { expect } = require('chai')
const parallelFieldsExtractor = require('../lib/parallel-fields-extractor')
const parallelFieldsBib = require('./fixtures/parallel-fields-response.json')
const elasticSearchResponseFixture = require('./fixtures/es-response-for-parallel-fields-extractor-test.json')
const indexFixture = require('./fixtures/parallel-fields-index.json')

describe('Parallel Fields Extractor', () => {
  describe('When a bib has a parallel fields property', () => {
    it('returns the elasticSearchResponse object', () => {
      const response = parallelFieldsExtractor(parallelFieldsBib)
      expect(response.hits.hits).to.be.an('array')
    })

    it('adds each of the items in that array to the bibs as parallel<FieldName>', () => {
      const parallelsExtracted = parallelFieldsExtractor(parallelFieldsBib).hits.hits[0]._source
      expect(Object.keys(parallelsExtracted).length).to.equal(4)
      expect(parallelsExtracted).to.deep.equal({ 'parallelPublicationStatement': ['Москва : Вагриус, 2006.'], 'parallelTableOfContents': ['Черный маг -- Копыто инженера -- Вечер страшной субботы -- Великий канцлер -- Фантастический роман -- Золотое Копье -- Князь тьмы -- Мастер и Маргарита (полная рукописная редакция) -- Мастер и Маргарита (окончательная редакция).'], 'parallelNote': ['\"Литературно-художественное издание\"--Colophon.'], 'parallelPlaceOfPublication': ['Москва :'] })
    })

    it('adds parallel field values to the property array on the index indicated', () => {
      const parallelNote = parallelFieldsExtractor(indexFixture).hits.hits[0]._source.parallelNote
      expect(parallelNote).to.deep.equal([undefined, undefined, 'Issued by: Народна библиотека Краљево.'])
    })
  })

  describe('When a bib has no parallel fields property', () => {
    it('does not modify the elasticSearchResponse', () => {
      expect(parallelFieldsExtractor(elasticSearchResponseFixture)).to.equal(elasticSearchResponseFixture)
    })
  })
})
