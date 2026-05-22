const { FILTER_CONFIG, SEARCH_SCOPES } = require('../config')

const combinedFilterFields = (fields) => {
  return fields.map((filterName) => FILTER_CONFIG[filterName].field).flat()
}

const indexMapping = {
  keyword: {
    fields: SEARCH_SCOPES.all.fields,
    exact_fields:
      [{ field: 'items.shelfMark.raw', on: (q) => /^[A-Z]{1,3} \d{2,}/.test(q) },
        ...combinedFilterFields(['title', 'subjectLiteral', 'publisher', 'genreForm', 'series', 'placeOfPublication', 'donor', 'contributorLiteral'])],
    term: [
      { field: 'items.idBarcode', on: (q) => /\d{6,}/.test(q) }
    ]
  },
  title: {
    fields: SEARCH_SCOPES.title.fields,
    exact_fields: FILTER_CONFIG.title.field
  },
  author: {
    fields: SEARCH_SCOPES.contributor.fields,
    exact_fields: FILTER_CONFIG.contributorLiteral.field
  },
  callnumber: {
    fields: ['shelfMark', 'items.shelfMark'],
    term: ['shelfMark.keywordLowercased', 'items.shelfMark.keywordLowercased']
  },
  identifier: {
    prefix: ['identifierV2.value', 'items.shelfMark.keywordLowercased'],
    term: ['uri', 'items.idBarcode', 'idIsbn.clean', 'idIssn.clean']
  },
  subject: {
    fields: SEARCH_SCOPES.subject.fields,
    exact_fields: FILTER_CONFIG.subjectLiteral.field
  },
  language: { term: ['language.id', 'language.label'] },
  date: { fields: ['dates.range'] },
  series: {
    fields: SEARCH_SCOPES.series.fields,
    exact_fields: FILTER_CONFIG.series.field
  },
  genre: { fields: SEARCH_SCOPES.genre.fields, exact_fields: FILTER_CONFIG.genreForm.field },
  center: { term: ['buildingLocationIds'] },
  division: { term: ['collectionIds'] },
  format: { term: ['formatId'] }
}

module.exports = {
  indexMapping
}
