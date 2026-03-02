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
            },
            {
              nested: { path: 'items', query: { bool: { should: [] } } }
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: { path: 'items', query: { bool: { should: [] } } }
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: { path: 'items', query: { bool: { should: [] } } }
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      { bool: { should: [] } },
                      { bool: { should: [] } }
                    ]
                  }
                }
              }
            },
            {
              nested: {
                path: 'holdings',
                query: {
                  bool: {
                    should: [
                      { bool: { should: [] } },
                      { bool: { should: [] } }
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
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      { bool: { should: [] } },
                      { bool: { should: [] } },
                      { bool: { should: [] } },
                      { bool: { should: [] } }
                    ]
                  }
                }
              }
            },
            {
              nested: {
                path: 'holdings',
                query: {
                  bool: {
                    should: [
                      { bool: { should: [] } },
                      { bool: { should: [] } },
                      { bool: { should: [] } },
                      { bool: { should: [] } }
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
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    must: [
                      { bool: { should: [] } },
                      { bool: { should: [] } }
                    ]
                  }
                }
              }
            },
            {
              nested: {
                path: 'holdings',
                query: {
                  bool: {
                    must: [
                      { bool: { should: [] } },
                      { bool: { should: [] } }
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
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: { path: 'items', query: { bool: { should: [] } } }
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
                        },
                        {
                          nested: {
                            path: 'items',
                            query: { bool: { should: [] } }
                          }
                        },
                        {
                          nested: {
                            path: 'holdings',
                            query: { bool: { should: [] } }
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
                        },
                        {
                          nested: {
                            path: 'items',
                            query: { bool: { should: [] } }
                          }
                        },
                        {
                          nested: {
                            path: 'holdings',
                            query: { bool: { should: [] } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
                        },
                        {
                          nested: {
                            path: 'items',
                            query: { bool: { should: [] } }
                          }
                        },
                        {
                          nested: {
                            path: 'holdings',
                            query: { bool: { should: [] } }
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
                        },
                        {
                          nested: {
                            path: 'items',
                            query: { bool: { should: [] } }
                          }
                        },
                        {
                          nested: {
                            path: 'holdings',
                            query: { bool: { should: [] } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
                  },
                  {
                    nested: { path: 'items', query: { bool: { should: [] } } }
                  },
                  {
                    nested: {
                      path: 'holdings',
                      query: { bool: { should: [] } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            ],
            { nested: { path: 'items', query: null } },
            { nested: { path: 'holdings', query: null } }
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
            },
            {
              nested: { path: 'items', query: { bool: { should: [] } } }
            },
            {
              nested: { path: 'holdings', query: { bool: { should: [] } } }
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
  multiAdjQuery
}
