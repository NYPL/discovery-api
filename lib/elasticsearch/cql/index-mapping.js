const indexMapping = {
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
      // Try to detect shelfmark searches (e.g. JFD 16-5143)
      { field: 'items.shelfMark', on: (q) => /^[A-Z]{1,3} \d{2,}/.test(q) }
    ],
    exact_fields: [
      'title.keywordLowercasedStripped',
      // missing description
      'subjectLiteral.raw',
      'creatorLiteral.keywordLowercased',
      'contributorLiteral.keywordLowercased',
      // note.label is missing
      'publisherLiteral.raw',
      'seriesStatement.raw',
      'titleAlt.raw',
      // titleDisplay missing
      // contentsTitle missing
      // tableOfContents missing
      'genreForm.raw',
      'donor.raw',
      // parallelTitle missing
      // parallelTitleDisplay missing
      'parallelTitleAlt.raw',
      'parallelSeriesStatement.raw',
      'parallelCreatorLiteral.raw',
      // parallelPublisher/parallelPublisherLiteral missing
      'uniformTitle.raw',
      'parallelUniformTitle.raw',
      // formerTitle missing
      'addedAuthorTitle.raw',
      'placeOfPublication',
      { field: 'items.shelfMark.raw', on: (q) => /^[A-Z]{1,3} \d{2,}/.test(q) }
    ],
    term: [
      { field: 'items.idBarcode', on: (q) => /\d{6,}/.test(q) }
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
    ],
    exact_fields: [
      'title.keywordLowercasedStripped',
      'seriesStatement.raw',
      'titleAlt.raw',
      // titleDisplay missing
      // contentsTitle missing
      // tableOfContents missing
      'donor.raw',
      // parallelTitle missing
      // parallelTitleDisplay missing
      'parallelTitleAlt.raw',
      'parallelSeriesStatement.raw',
      'parallelCreatorLiteral.raw',
      'uniformTitle.raw',
      'parallelUniformTitle.raw',
      // formerTitle missing
      'addedAuthorTitle.raw',
      'placeOfPublication'
    ]
  },
  author: {
    fields: ['creatorLiteral', 'creatorLiteral.folded', 'contributorLiteral.folded', 'parallelCreatorLiteral.folded', 'parallelContributorLiteral.folded'],
    exact_fields: [
      'creatorLiteral.keywordLowercased', 'contributorLiteral.keywordLowercased',
      'parallelCreatorLiteral.raw', 'parallelContributorLiteral.raw'
    ]
  },
  callnumber: {
    fields: ['shelfMark'],
    term: ['shelfMark.keywordLowercased', 'items.shelfMark.keywordLowercased']
  },
  identifier: {
    prefix: ['identifierV2.value', 'items.shelfMark.keywordLowercased'],
    term: ['uri', 'items.idBarcode', 'idIsbn.clean', 'idIssn.clean']
  },
  subject: {
    fields: ['subjectLiteral', 'subjectLiteral.folded', 'parallelSubjectLiteral.folded'],
    exact_fields: ['subjectLiteral.raw']
  },
  language: { term: ['language.id', 'language.label'] },
  date: { fields: ['dates.range'] },
  series: {
    term: ['series', 'parallelSeries']
  },
  genre: { fields: ['genreForm'], exact_fields: ['genreForm.raw'] },
  center: { term: ['buildingLocationIds'] },
  division: { term: ['collectionIds'] },
  format: { term: ['formatId'] }
}

module.exports = {
  indexMapping
}
