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
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: 'Hamlet',
                          fields: [],
                          type: 'phrase'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Hamlet',
                          fields: [],
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
                    multi_match: {
                      query: 'The Tragedy of Hamlet, Prince of Denmark',
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
                      type: 'phrase_prefix'
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
                          query: 'The Tragedy of Hamlet, Prince of Denmark',
                          fields: [],
                          type: 'phrase_prefix'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'The Tragedy of Hamlet, Prince of Denmark',
                          fields: [],
                          type: 'phrase_prefix'
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
                    multi_match: {
                      query: 'Hamlet Othello',
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
                      type: 'cross_fields',
                      operator: 'or'
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
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'or'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'or'
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
                    multi_match: {
                      query: 'Hamlet Othello',
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
                      type: 'cross_fields',
                      operator: 'or'
                    }
                  },
                  {
                    multi_match: {
                      query: 'Tragedy',
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
                      type: 'phrase_prefix'
                    }
                  },
                  {
                    multi_match: {
                      query: 'Comedy',
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
                      type: 'phrase_prefix'
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
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'or'
                        }
                      },
                      {
                        multi_match: {
                          query: 'Tragedy',
                          fields: [],
                          type: 'phrase_prefix'
                        }
                      },
                      {
                        multi_match: {
                          query: 'Comedy',
                          fields: [],
                          type: 'phrase_prefix'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'or'
                        }
                      },
                      {
                        multi_match: {
                          query: 'Tragedy',
                          fields: [],
                          type: 'phrase_prefix'
                        }
                      },
                      {
                        multi_match: {
                          query: 'Comedy',
                          fields: [],
                          type: 'phrase_prefix'
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

const simpleAllQuery = {
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
                      query: 'Hamlet Othello',
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
                      type: 'cross_fields',
                      operator: 'and'
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
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'and'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Hamlet Othello',
                          fields: [],
                          type: 'cross_fields',
                          operator: 'and'
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
                    should: [
                      {
                        multi_match: {
                          query: '123456',
                          fields: [
                            'items.idBarcode'
                          ],
                          type: 'phrase'
                        }
                      }
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
                      {
                        multi_match: {
                          query: '123456',
                          fields: [],
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
                          fields: [
                            'items.shelfMark'
                          ],
                          type: 'phrase'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'B 12',
                          fields: [],
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
            },
            {
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: 'Hamlet',
                          fields: [],
                          type: 'phrase'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Hamlet',
                          fields: [],
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

const identifierQuery = {
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
                      uri: 'b1234'
                    }
                  },
                  {
                    term: {
                      'idIsbn.clean': 'b1234'
                    }
                  },
                  {
                    term: {
                      'idIssn.clean': 'b1234'
                    }
                  },
                  {
                    prefix: {
                      'identifierV2.value': 'b1234'
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
                        term: {
                          'items.idBarcode': 'b1234'
                        }
                      },
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
              nested: {
                path: 'holdings',
                query: {
                  bool: {
                    should: []
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
                  },
                  {
                    nested: {
                      path: 'items',
                      query: {
                        bool: {
                          should: [
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
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
            },
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'English',
                            fields: [
                              'language.id',
                              'language.label'
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
                                query: 'English',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'English',
                                fields: [],
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
                            query: {
                              bool: {
                                should: [
                                  {
                                    multi_match: {
                                      query: 'Shakespeare',
                                      fields: [],
                                      type: 'phrase'
                                    }
                                  }
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
                                  {
                                    multi_match: {
                                      query: 'Shakespeare',
                                      fields: [],
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
                  },
                  {
                    bool: {
                      should: [
                        {
                          bool: {
                            should: [
                              {
                                multi_match: {
                                  query: 'English',
                                  fields: [
                                    'language.id',
                                    'language.label'
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
                                      query: 'English',
                                      fields: [],
                                      type: 'phrase'
                                    }
                                  }
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
                                  {
                                    multi_match: {
                                      query: 'English',
                                      fields: [],
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
                            fields: [
                              'genreForm.raw'
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
                                query: 'tragedy',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'tragedy',
                                fields: [],
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
                    nested: {
                      path: 'items',
                      query: {
                        bool: {
                          should: [
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
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
                              {
                                multi_match: {
                                  query: 'English',
                                  fields: [
                                    'language.id',
                                    'language.label'
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
                                      query: 'English',
                                      fields: [],
                                      type: 'phrase'
                                    }
                                  }
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
                                  {
                                    multi_match: {
                                      query: 'English',
                                      fields: [],
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
                                  fields: [
                                    'genreForm.raw'
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
                                      query: 'tragedy',
                                      fields: [],
                                      type: 'phrase'
                                    }
                                  }
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
                                  {
                                    multi_match: {
                                      query: 'tragedy',
                                      fields: [],
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
                    nested: {
                      path: 'items',
                      query: {
                        bool: {
                          should: [
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'Shakespeare',
                                fields: [],
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
          ],
          must_not: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      should: [
                        {
                          multi_match: {
                            query: 'English',
                            fields: [
                              'language.id',
                              'language.label'
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
                                query: 'English',
                                fields: [],
                                type: 'phrase'
                              }
                            }
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
                            {
                              multi_match: {
                                query: 'English',
                                fields: [],
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
    ]
  }
}

const dateAfterQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'dates',
                      query: { range: { 'dates.range': { gt: '1990' } } }
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

const dateBeforeQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
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

const dateBeforeOrOnQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'dates',
                      query: { range: { 'dates.range': { lte: '1990' } } }
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

const dateAfterOrOnQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
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

const dateWithinQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'dates',
                      query: {
                        range: { 'dates.range': { gte: '1990', lte: '2000' } }
                      }
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

const dateEnclosesQuery = {
  bool: {
    should: [
      {
        bool: {
          should: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'dates',
                      query: {
                        range: { 'dates.range': { gt: '1990', lt: '2000' } }
                      }
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
              nested: {
                path: 'items',
                query: {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: 'Shakespeare',
                          fields: [],
                          type: 'phrase'
                        }
                      }
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
                      {
                        multi_match: {
                          query: 'Shakespeare',
                          fields: [],
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
  filterQuery
}
