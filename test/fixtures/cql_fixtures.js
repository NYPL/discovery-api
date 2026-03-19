const simpleAdjQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Hamlet',
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
                      type: 'phrase'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const multiAdjQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Hamlet, Prince',
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
                      type: 'phrase'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const prefixPhraseQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    prefix: {
                      'title.keywordLowercasedStripped': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'seriesStatement.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'titleAlt.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'donor.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'parallelTitleAlt.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'parallelSeriesStatement.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'parallelCreatorLiteral.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'uniformTitle.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'parallelUniformTitle.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      'addedAuthorTitle.raw': 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  },
                  {
                    prefix: {
                      placeOfPublication: 'The Tragedy of Hamlet, Prince of Denmark'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const simpleAnyQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Hamlet',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Othello',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const anyWithPrefixQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          prefix: {
                            'title.keywordLowercasedStripped': 'Tragedy'
                          }
                        },
                        {
                          prefix: { 'seriesStatement.raw': 'Tragedy' }
                        },
                        { prefix: { 'titleAlt.raw': 'Tragedy' } },
                        { prefix: { 'donor.raw': 'Tragedy' } },
                        {
                          prefix: { 'parallelTitleAlt.raw': 'Tragedy' }
                        },
                        {
                          prefix: { 'parallelSeriesStatement.raw': 'Tragedy' }
                        },
                        {
                          prefix: { 'parallelCreatorLiteral.raw': 'Tragedy' }
                        },
                        { prefix: { 'uniformTitle.raw': 'Tragedy' } },
                        {
                          prefix: { 'parallelUniformTitle.raw': 'Tragedy' }
                        },
                        {
                          prefix: { 'addedAuthorTitle.raw': 'Tragedy' }
                        },
                        { prefix: { placeOfPublication: 'Tragedy' } }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          prefix: {
                            'title.keywordLowercasedStripped': 'Comedy'
                          }
                        },
                        { prefix: { 'seriesStatement.raw': 'Comedy' } },
                        { prefix: { 'titleAlt.raw': 'Comedy' } },
                        { prefix: { 'donor.raw': 'Comedy' } },
                        {
                          prefix: { 'parallelTitleAlt.raw': 'Comedy' }
                        },
                        {
                          prefix: { 'parallelSeriesStatement.raw': 'Comedy' }
                        },
                        {
                          prefix: { 'parallelCreatorLiteral.raw': 'Comedy' }
                        },
                        { prefix: { 'uniformTitle.raw': 'Comedy' } },
                        {
                          prefix: { 'parallelUniformTitle.raw': 'Comedy' }
                        },
                        {
                          prefix: { 'addedAuthorTitle.raw': 'Comedy' }
                        },
                        { prefix: { placeOfPublication: 'Comedy' } }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Hamlet',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Othello',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const simpleAllQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Hamlet',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Othello',
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
                            type: 'cross_fields'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const keywordQueryForBarcode = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: '123456',
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
                        'placeOfPublication.folded'
                      ],
                      type: 'phrase'
                    }
                  }
                ]
              }
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [{ term: { 'items.idBarcode': '123456' } }]
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
}

const keywordQueryForShelfMark = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'B 12',
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
                        'placeOfPublication.folded'
                      ],
                      type: 'phrase'
                    }
                  }
                ]
              }
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: 'B 12',
                          fields: ['items.shelfMark'],
                          type: 'phrase'
                        }
                      }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
}

const keywordQueryForGeneralTerm = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Hamlet',
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
                        'placeOfPublication.folded'
                      ],
                      type: 'phrase'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const identifierQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  { term: { uri: 'b1234' } },
                  { term: { 'idIsbn.clean': 'b1234' } },
                  { term: { 'idIssn.clean': 'b1234' } },
                  { prefix: { 'identifierV2.value': 'b1234' } }
                ]
              }
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      { term: { 'items.idBarcode': 'b1234' } },
                      {
                        prefix: {
                          'items.shelfMark.keywordLowercased': 'b1234'
                        }
                      }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
}

const binaryBooleanQuery = {
  bool: {
    should: [
      {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Shakespeare',
                            fields: [
                              'creatorLiteral',
                              'creatorLiteral.folded',
                              'contributorLiteral.folded',
                              'parallelCreatorLiteral.folded',
                              'parallelContributorLiteral.folded'
                            ],
                            type: 'phrase'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        { term: { 'language.id': 'English' } },
                        { term: { 'language.label': 'English' } }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const ternaryBooleanQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        {
                          bool: {
                            should: [
                              {
                                multi_match: {
                                  query: 'Shakespeare',
                                  fields: [
                                    'creatorLiteral',
                                    'creatorLiteral.folded',
                                    'contributorLiteral.folded',
                                    'parallelCreatorLiteral.folded',
                                    'parallelContributorLiteral.folded'
                                  ],
                                  type: 'phrase'
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          bool: {
                            should: [
                              { term: { 'language.id': 'English' } },
                              { term: { 'language.label': 'English' } }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'tragedy',
                            fields: ['genreForm'],
                            type: 'phrase'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const queryWithParentheses = {
  bool: {
    should: [
      {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Shakespeare',
                            fields: [
                              'creatorLiteral',
                              'creatorLiteral.folded',
                              'contributorLiteral.folded',
                              'parallelCreatorLiteral.folded',
                              'parallelContributorLiteral.folded'
                            ],
                            type: 'phrase'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          bool: {
                            should: [
                              { term: { 'language.id': 'English' } },
                              { term: { 'language.label': 'English' } }
                            ]
                          }
                        }
                      ]
                    }
                  },
                  {
                    bool: {
                      should: [
                        {
                          bool: {
                            should: [
                              {
                                multi_match: {
                                  query: 'tragedy',
                                  fields: ['genreForm'],
                                  type: 'phrase'
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const negationQuery = {
  bool: {
    should: [
      {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'Shakespeare',
                            fields: [
                              'creatorLiteral',
                              'creatorLiteral.folded',
                              'contributorLiteral.folded',
                              'parallelCreatorLiteral.folded',
                              'parallelContributorLiteral.folded'
                            ],
                            type: 'phrase'
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ],
          must_not: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        { term: { 'language.id': 'English' } },
                        { term: { 'language.label': 'English' } }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

const dateAfterQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: { range: { 'dates.range': { gt: '1990' } } }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const dateBeforeQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: { range: { 'dates.range': { lt: '1990' } } }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const dateBeforeOrOnQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: { range: { 'dates.range': { lte: '1990' } } }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const dateAfterOrOnQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: { range: { 'dates.range': { gte: '1990' } } }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const dateWithinQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: {
                    range: { 'dates.range': { gte: '1990', lte: '2000' } }
                  }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const dateEnclosesQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            [
              {
                nested: {
                  path: 'dates',
                  query: {
                    range: { 'dates.range': { gt: '1990', lt: '2000' } }
                  }
                }
              }
            ]
          ]
        }
      }
    ]
  }
}

const filterQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Shakespeare',
                      fields: [
                        'creatorLiteral',
                        'creatorLiteral.folded',
                        'contributorLiteral.folded',
                        'parallelCreatorLiteral.folded',
                        'parallelContributorLiteral.folded'
                      ],
                      type: 'phrase'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ],
    filter: [
      {
        bool: {
          should: [
            { term: { 'language.id': 'Klingon' } },
            { term: { 'language.label': 'Klingon' } }
          ]
        }
      }
    ]
  }
}

const exactMatchQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    term: {
                      'creatorLiteral.keywordLowercased': 'William Shakespeare'
                    }
                  },
                  {
                    term: {
                      'contributorLiteral.keywordLowercased': 'William Shakespeare'
                    }
                  },
                  {
                    term: {
                      'parallelCreatorLiteral.raw': 'William Shakespeare'
                    }
                  },
                  {
                    term: {
                      'parallelContributorLiteral.raw': 'William Shakespeare'
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

module.exports = {
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
}
