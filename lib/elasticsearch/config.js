const util = require('../util')

// Configure search scopes:
const SEARCH_SCOPES = {
  all: {
    fields: [
      'title^5',
      'title.folded^2',
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
      'uniformTitle.folded',
      'parallelUniformTitle',
      'formerTitle',
      'addedAuthorTitle',
      'placeOfPublication',
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
  recordType: { operator: 'match', field: ['recordTypeId'], repeatable: true },
  owner: { operator: 'match', field: ['items.owner.id', 'items.owner.label'], repeatable: true, path: 'items' },
  subjectLiteral: {
    transform: (val, logger) => {
      if (typeof val === 'string') {
        return util.removeTrailingPeriod(val, logger)
      }
      if (Array.isArray(val)) {
        return val.map((val) => util.removeTrailingPeriod(val, logger))
      }
    },
    operator: 'match',
    field: ['subjectLiteral_exploded'],
    repeatable: true
  },
  holdingLocation: { operator: 'match', field: ['items.holdingLocation.id', 'items.holdingLocation.label'], repeatable: true, path: 'items' },
  buildingLocation: { operator: 'match', field: ['buildingLocationIds'], repeatable: true },
  language: { operator: 'match', field: ['language.id', 'language.label'], repeatable: true },
  materialType: { operator: 'match', field: ['materialType.id', 'materialType.label'], repeatable: true },
  mediaType: { operator: 'match', field: ['mediaType.id', 'mediaType.label'], repeatable: true },
  carrierType: { operator: 'match', field: ['carrierType.id', 'carrierType.label'], repeatable: true },
  publisher: { operator: 'match', field: ['publisherLiteral.raw'], repeatable: true },
  contributorLiteral: { operator: 'match', field: ['contributorLiteral.raw', 'parallelContributor.raw'], repeatable: true },
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
  }
}

module.exports = {
  SEARCH_SCOPES,
  FILTER_CONFIG
}
