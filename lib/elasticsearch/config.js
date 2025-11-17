// Configure search scopes:
const SEARCH_SCOPES = {
  all: {
    fields: [
      'title^20',
      'title.folded^10',
      'description.foldedStemmed',
      'subjectLiteral^2',
      'subjectLiteral.folded',
      'creatorLiteral^2',
      'creatorLiteral.folded',
      'contributorLiteral.folded',
      'note.label.foldedStemmed',
      'publisherLiteral.folded',
      'seriesStatement.folded',
      'titleAlt.folded',
      'titleDisplay.folded',
      'contentsTitle.folded',
      'tableOfContents.folded',
      'genreForm',
      'donor.folded',
      'parallelTitle.folded^5',
      'parallelTitleDisplay.folded',
      'parallelTitleAlt.folded',
      'parallelSeriesStatement.folded',
      'parallelCreatorLiteral.folded',
      'parallelPublisher',
      'parallelPublisherLiteral',
      'uniformTitle.folded',
      'parallelUniformTitle',
      'formerTitle',
      'addedAuthorTitle',
      'placeOfPublication.folded',
      { field: 'items.idBarcode', on: (q) => /\d{6,}/.test(q) },
      // Try to detect shelfmark searches (e.g. JFD 16-5143)
      { field: 'items.shelfMark', on: (q) => /^[A-Z]{1,3} \d{2,}/.test(q) }
    ]
  },
  title: {
    fields: [
      'title^5',
      'title.folded^2',
      'titleAlt.folded',
      'uniformTitle.folded',
      'titleDisplay.folded',
      'seriesStatement.folded',
      'contentsTitle.folded',
      'donor.folded',
      'parallelTitle.folded^5',
      'parallelTitleDisplay.folded',
      'parallelSeriesStatement.folded',
      'parallelTitleAlt.folded',
      'parallelCreatorLiteral.folded',
      'parallelUniformTitle',
      'formerTitle',
      'addedAuthorTitle'
    ]
  },
  contributor: {
    fields: ['creatorLiteral^4', 'creatorLiteral.folded^2', 'contributorLiteral.folded', 'parallelCreatorLiteral.folded', 'parallelContributorLiteral.folded']
  },
  subject: {
    fields: ['subjectLiteral^2', 'subjectLiteral.folded', 'parallelSubjectLiteral.folded']
  },
  series: {
    fields: ['seriesStatement.folded']
  },
  journal_title: {
    fields: null
  },
  callnumber: {
    // We do custom field matching for this search-scope
  },
  standard_number: {
    // We do custom field matching for this search-scope
  }
}

const FILTER_CONFIG = {
  collection: { operator: 'match', field: ['collectionIds'], repeatable: true },
  format: { operator: 'match', field: ['formatId'], repeatable: true },
  recordType: { operator: 'match', field: ['recordTypeId'], repeatable: true },
  owner: { operator: 'match', field: ['items.owner.id', 'items.owner.label'], repeatable: true, path: 'items' },
  subjectLiteral: { operator: 'match', field: ['subjectLiteral.raw'], repeatable: true },
  holdingLocation: { operator: 'match', field: ['items.holdingLocation.id', 'items.holdingLocation.label'], repeatable: true, path: 'items' },
  buildingLocation: { operator: 'match', field: ['buildingLocationIds'], repeatable: true },
  language: { operator: 'match', field: ['language.id', 'language.label'], repeatable: true },
  materialType: { operator: 'match', field: ['materialType.id', 'materialType.label'], repeatable: true },
  mediaType: { operator: 'match', field: ['mediaType.id', 'mediaType.label'], repeatable: true },
  carrierType: { operator: 'match', field: ['carrierType.id', 'carrierType.label'], repeatable: true },
  publisher: { operator: 'match', field: ['publisherLiteral.raw'], repeatable: true },
  contributorLiteral: { operator: 'match', field: ['contributorLiteral.keywordLowercased', 'parallelContributor.raw', 'creatorLiteral.keywordLowercased', 'parallelCreatorLiteral.raw'], repeatable: true },
  creatorLiteral: { operator: 'match', field: ['creatorLiteral.raw', 'parallelCreatorLiteral.raw'], repeatable: true },
  issuance: { operator: 'match', field: ['issuance.id', 'issuance.label'], repeatable: true },
  createdYear: { operator: 'match', field: ['createdYear'], repeatable: true },
  dateAfter: {
    operator: 'custom',
    type: 'int'
  },
  dateBefore: {
    operator: 'custom',
    type: 'int'
  },
  genreForm: { operator: 'match', field: ['genreForm.raw'], repeatable: true },
  donor: { operator: 'match', field: ['donor.raw'], repeatable: true },
  titleAlt: { operator: 'match', field: ['titleAlt.raw', 'parallelTitleAlt.raw'], repeatable: true },
  uniformTitle: { operator: 'match', field: ['uniformTitle.raw', 'parallelUniformTitle.raw'], repeatable: true },
  addedAuthorTitle: { operator: 'match', field: ['addedAuthorTitle.raw', 'parallelAddedAuthorTitle.raw'], repeatable: true },
  series: { operator: 'match', field: ['series', 'parallelSeries'], repeatable: true },
  placeOfPublication: { operator: 'match', field: ['placeOfPublication', 'parallelPlaceOfPublication'], repeatable: true },
  dateFrom: {
    operator: 'custom',
    type: 'string'
  },
  dateTo: {
    operator: 'custom',
    type: 'string'
  }
}

// Configures aggregations:
const AGGREGATIONS_SPEC = {
  format: { terms: { field: 'formatId' } },
  buildingLocation: { terms: { field: 'buildingLocationIds' } },
  subjectLiteral: { terms: { field: 'subjectLiteral.raw' } },
  language: { terms: { field: 'language_packed' } },
  contributorLiteral: { terms: { field: 'contributorLiteral.raw' } },
  creatorLiteral: { terms: { field: 'creatorLiteral.raw' } },
  collection: { terms: { field: 'collectionIds' } }
}

module.exports = {
  SEARCH_SCOPES,
  FILTER_CONFIG,
  AGGREGATIONS_SPEC
}
