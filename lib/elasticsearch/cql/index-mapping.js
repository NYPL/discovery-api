const INDEX_MAPPING = {
  keyword: {
    fields: [
      'title',
      'title.folded',
      'description.foldedStemmed',
      'subjectLiteral',
      'subjectLiteral.folded',
      'creatorLiteral',
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
      'parallelTitle.folded',
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
      'title',
      'title.folded',
      'titleAlt.folded',
      'uniformTitle.folded',
      'titleDisplay.folded',
      'seriesStatement.folded',
      'contentsTitle.folded',
      'donor.folded',
      'parallelTitle.folded',
      'parallelTitleDisplay.folded',
      'parallelSeriesStatement.folded',
      'parallelTitleAlt.folded',
      'parallelCreatorLiteral.folded',
      'parallelUniformTitle',
      'formerTitle',
      'addedAuthorTitle'
    ]
  },
  author: {
    fields: ['creatorLiteral', 'creatorLiteral.folded', 'contributorLiteral.folded', 'parallelCreatorLiteral.folded', 'parallelContributorLiteral.folded']
  },
  callnumber: {
    fields: ['shelfMark.keywordLowercased', 'items.shelfMark.keywordLowercased']
  },
  identifier: {
    prefix: ['identifierV2.value', 'items.shelfMark.keywordLowercased' ],
    term: ['uri', 'items.idBarcode', 'idIsbn.clean', 'idIssn.clean']
  },
  subject: {
    fields: ['subjectLiteral', 'subjectLiteral.folded', 'parallelSubjectLiteral.folded']
  },
  language: { field: ['language.id', 'language.label'] },
  date: {},
  series: {
    fields: ['series', 'parallelSeries']
  },
  genre: { field: ['genreForm.raw'] },
  center: { field: ['buildingLocationIds'] },
  division: { field: ['collectionIds'] },
  format: { field: ['formatId'] }
}

module.exports = {
  INDEX_MAPPING
}
