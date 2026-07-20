const { SEARCH_SCOPES } = require('../lib/elasticsearch/config')

const simpleAdjQuery = {
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
                      query: 'Hamlet',
                      fields: SEARCH_SCOPES.title.fields,
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
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Hamlet, Prince',
                      fields: SEARCH_SCOPES.title.fields,
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
    must: [
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
                      'series.keywordLowercasedStripped': 'The Tragedy of Hamlet, Prince of Denmark'
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
                      'parallelSeries.keywordLowercasedStripped': 'The Tragedy of Hamlet, Prince of Denmark'
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
                      'placeOfPublication.keywordLowercasedStripped': 'The Tragedy of Hamlet, Prince of Denmark'
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
    must: [
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
                            fields: SEARCH_SCOPES.title.fields,
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
                            fields: SEARCH_SCOPES.title.fields,
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
    must: [
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
                          prefix: { 'series.keywordLowercasedStripped': 'Tragedy' }
                        },
                        { prefix: { 'titleAlt.raw': 'Tragedy' } },
                        { prefix: { 'donor.raw': 'Tragedy' } },
                        {
                          prefix: { 'parallelTitleAlt.raw': 'Tragedy' }
                        },
                        {
                          prefix: { 'parallelSeries.keywordLowercasedStripped': 'Tragedy' }
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
                        { prefix: { 'placeOfPublication.keywordLowercasedStripped': 'Tragedy' } }
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
                        { prefix: { 'series.keywordLowercasedStripped': 'Comedy' } },
                        { prefix: { 'titleAlt.raw': 'Comedy' } },
                        { prefix: { 'donor.raw': 'Comedy' } },
                        {
                          prefix: { 'parallelTitleAlt.raw': 'Comedy' }
                        },
                        {
                          prefix: { 'parallelSeries.keywordLowercasedStripped': 'Comedy' }
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
                        { prefix: { 'placeOfPublication.keywordLowercasedStripped': 'Comedy' } }
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
                              'series.folded',
                              'contentsTitle.folded',
                              'donor.folded',
                              'parallelTitle.folded',
                              'parallelTitleDisplay.folded',
                              'parallelSeries.folded',
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
                              'series.folded',
                              'contentsTitle.folded',
                              'donor.folded',
                              'parallelTitle.folded',
                              'parallelTitleDisplay.folded',
                              'parallelSeries.folded',
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
    must: [
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
                            fields: SEARCH_SCOPES.title.fields,
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
                            fields: SEARCH_SCOPES.title.fields,
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
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: '123456',
                      fields: SEARCH_SCOPES.all.fields.filter(field => typeof field === 'string'),
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
                          fields: [
                            'items.idBarcode'
                          ],
                          query: '123456',
                          type: 'phrase'
                        }
                      }, { term: { 'items.idBarcode': '123456' } }]
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
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'B 12',
                      fields: SEARCH_SCOPES.all.fields.filter(field => typeof field === 'string'),
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
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: 'Hamlet',
                      fields: SEARCH_SCOPES.all.fields.filter(field => typeof field === 'string'),
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
    must: [
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
    must: [
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
                            fields: SEARCH_SCOPES.contributor.fields,
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
                      must: [
                        {
                          bool: {
                            should: [
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:eng' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:eng' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:enm' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:enm' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:ang' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:ang' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:cpe' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:cpe' }
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
    ]
  }
}

const ternaryBooleanQuery = {
  bool: {
    must: [
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
                                  fields: SEARCH_SCOPES.contributor.fields,
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
                            must: [
                              {
                                bool: {
                                  should: [
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:eng'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:eng'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:enm'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:enm'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:ang'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:ang'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:cpe'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:cpe'
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
                            fields: SEARCH_SCOPES.genre.fields,
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
    must: [
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
                            must: [
                              {
                                bool: {
                                  should: [
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:eng'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:eng'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:enm'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:enm'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:ang'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:ang'
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      bool: {
                                        should: [
                                          {
                                            term: {
                                              'language.id': 'lang:cpe'
                                            }
                                          },
                                          {
                                            term: {
                                              'language.label': 'lang:cpe'
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
                                  fields: ['genreForm', 'genreForm.folded'],
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
    must: [
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
                      must: [
                        {
                          bool: {
                            should: [
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:eng' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:eng' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:enm' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:enm' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:ang' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:ang' }
                                    }
                                  ]
                                }
                              },
                              {
                                bool: {
                                  should: [
                                    {
                                      term: { 'language.id': 'lang:cpe' }
                                    },
                                    {
                                      term: { 'language.label': 'lang:cpe' }
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
    ]
  }
}

const dateAfterQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: { range: { 'dates.range': { gte: '1991-01-01' } } }
              }
            }
          ]
        }
      }
    ]
  }
}

const dateBeforeQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: { range: { 'dates.range': { lt: '1990' } } }
              }
            }
          ]
        }
      }
    ]
  }
}

const dateBeforeOrOnQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: { range: { 'dates.range': { lt: '1991-01-01' } } }
              }
            }
          ]
        }
      }
    ]
  }
}

const dateAfterOrOnQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: { range: { 'dates.range': { gte: '1990' } } }
              }
            }
          ]
        }
      }
    ]
  }
}

const dateWithinQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: {
                  range: { 'dates.range': { gte: '1990', lt: '2001-01-01' } }
                }
              }
            }
          ]
        }
      }
    ]
  }
}

const dateEnclosesQuery = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              nested: {
                path: 'dates',
                query: {
                  bool: {
                    must: [
                      {
                        range: { 'dates.range': { gte: '1990', lte: '1990', relation: 'contains' } }
                      },
                      {
                        terms: {
                          'dates.tag': ['c', 'd', 'i', 'k', 'm', 'q', 'u']
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

const filterQuery = {
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
                      fields: SEARCH_SCOPES.contributor.fields,
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
    must: [
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

const divisionAny = {
  bool: {
    must: [
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
                          bool: {
                            should: [{ term: { collectionIds: 'mao' } }]
                          }
                        },
                        {
                          bool: {
                            should: [{ term: { collectionIds: 'scd' } }]
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
                            should: [{ term: { collectionIds: 'mab' } }]
                          }
                        },
                        {
                          bool: {
                            should: [{ term: { collectionIds: 'scc' } }]
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

const divisionAll = {
  bool: {
    must: [
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
                            should: [{ term: { collectionIds: 'mao' } }]
                          }
                        },
                        {
                          bool: {
                            should: [{ term: { collectionIds: 'scd' } }]
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
                            should: [{ term: { collectionIds: 'mab' } }]
                          }
                        },
                        {
                          bool: {
                            should: [{ term: { collectionIds: 'scc' } }]
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

const divisionAdj = {
  bool: {
    must: [
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
                            should: [{ term: { collectionIds: 'scd' } }]
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

const divisionExact = {
  bool: {
    must: [
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
                            should: [{ term: { collectionIds: 'mag' } }]
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

const englishExactLanguageQuery = {
  bool: {
    must: [
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
                              { term: { 'language.id': 'lang:eng' } },
                              {
                                term: { 'language.label': 'lang:eng' }
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

const wildcardQueryNoShelfMark = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    query_string: {
                      query: 'Ham*let',
                      fields: SEARCH_SCOPES.title.fields,
                      type: 'phrase',
                      analyze_wildcard: true,
                      default_operator: 'AND'
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

const wildcardQueryWithShelfMark = {
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    query_string: {
                      query: 'B 12*',
                      fields: SEARCH_SCOPES.all.fields.filter(field => typeof field === 'string'),
                      type: 'phrase',
                      analyze_wildcard: true,
                      default_operator: 'AND'
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
                          query: 'B 12*',
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
  exactMatchQuery,
  divisionAdj,
  divisionAll,
  divisionAny,
  divisionExact,
  englishExactLanguageQuery,
  wildcardQueryNoShelfMark,
  wildcardQueryWithShelfMark
}
