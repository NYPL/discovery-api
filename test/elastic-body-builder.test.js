const { expect } = require('chai')

const { bodyForSearch, bodyForFindByUri } = require('../lib/elasticsearch/elastic-body-builder')

describe('bodyForSearch', function () {
  it('excludes checkin cards by default', function () {
    expect(bodyForSearch({ sort: 'relevance' }))
      .to.deep.equal(
        {
          query: {
            bool: {
              filter: [
                {
                  bool: {
                    should: [
                      {
                        nested: {
                          path: 'items',
                          query: {
                            bool: {
                              must_not: [
                                {
                                  term: {
                                    'items.type': 'nypl:CheckinCardItem'
                                  }
                                }
                              ]
                            }
                          },
                          inner_hits: {
                            sort: [
                              {
                                'items.enumerationChronology_sort': 'desc'
                              }
                            ],
                            size: '3',
                            from: 0,
                            name: 'items'
                          }
                        }
                      },
                      {
                        match_all: {}
                      }
                    ]
                  }
                }
              ]
            }
          },
          sort: [
            {
              _score: 'desc'
            },
            {
              uri: 'asc'
            }
          ],
          _source: {
            excludes: [
              'uris',
              '*_packed',
              '*_sort',
              'items.*_packed',
              'contentsTitle',
              'suppressed',
              '*WithoutDates',
              '*Normalized',
              'items'
            ]
          }
        }
      )
  })

  it('includes checkin cards when present in params', function () {
    expect(bodyForSearch({ sort: 'relevance', merge_checkin_card_items: true }))
      .to.deep.equal(
        {
          query: {
            bool: {
              filter: [
                {
                  bool: {
                    should: [
                      {
                        nested: {
                          path: 'items',
                          query: {
                            bool: {
                              must: {
                                match_all: {}
                              }
                            }
                          },
                          inner_hits: {
                            sort: [
                              {
                                'items.enumerationChronology_sort': 'desc'
                              }
                            ],
                            size: '3',
                            from: 0,
                            name: 'items'
                          }
                        }
                      },
                      {
                        match_all: {}
                      }
                    ]
                  }
                }
              ]
            }
          },
          sort: [
            {
              _score: 'desc'
            },
            {
              uri: 'asc'
            }
          ],
          _source: {
            excludes: [
              'uris',
              '*_packed',
              '*_sort',
              'items.*_packed',
              'contentsTitle',
              'suppressed',
              '*WithoutDates',
              '*Normalized',
              'items'
            ]
          }
        }
      )
  })
})

describe('bodyForFindByUri', function () {
  it('queries for uri', function () {
    const expected = {
      _source: {
        excludes: [
          'uris',
          '*_packed',
          '*_sort',
          'items.*_packed',
          'contentsTitle',
          'suppressed',
          '*WithoutDates',
          '*Normalized',
          'items'
        ]
      },
      size: 1,
      query: {
        bool: {
          must: [
            {
              term: {
                uri: 'b15781267'
              }
            }
          ],
          filter: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'items',
                      query: {
                        bool: {
                          must: {
                            match_all: {}
                          }
                        }
                      },
                      inner_hits: {
                        sort: [
                          {
                            'items.enumerationChronology_sort': 'desc'
                          }
                        ],
                        size: 100,
                        from: 0,
                        name: 'items'
                      }
                    }
                  },
                  {
                    match_all: {}
                  }
                ]
              }
            }
          ]
        }
      },
      aggregations: {
        item_location: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.holdingLocation_packed'
              }
            }
          }
        },
        item_status: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.status_packed'
              }
            }
          }
        },
        item_format: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.formatLiteral'
              }
            }
          }
        }
      }
    }

    const params = {
      all_items: false,
      uri: 'b15781267',
      items_size: 100,
      items_from: 0,
      merge_checkin_card_items: true,
      include_item_aggregations: true
    }
    const barcodes = {}
    expect(bodyForFindByUri(barcodes, params))
      .to.deep.equal(expected)
  })

  it('accepts item params', function () {
    const barcodes = { 'Not Available': ['1234'] }
    const params = {
      all_items: false,
      uri: 'b15781267',
      items_size: 10,
      items_from: 10,
      merge_checkin_card_items: true,
      include_item_aggregations: true
    }

    const expected = {
      _source: {
        excludes: [
          'uris',
          '*_packed',
          '*_sort',
          'items.*_packed',
          'contentsTitle',
          'suppressed',
          '*WithoutDates',
          '*Normalized',
          'items'
        ]
      },
      size: 1,
      query: {
        bool: {
          must: [
            {
              term: {
                uri: 'b15781267'
              }
            }
          ],
          filter: [
            {
              bool: {
                should: [
                  {
                    nested: {
                      path: 'items',
                      query: {
                        bool: {
                          must: {
                            match_all: {}
                          }
                        }
                      },
                      inner_hits: {
                        sort: [
                          {
                            'items.enumerationChronology_sort': 'desc'
                          }
                        ],
                        size: 10,
                        from: 10,
                        name: 'items'
                      }
                    }
                  },
                  {
                    match_all: {}
                  }
                ]
              }
            }
          ]
        }
      },
      aggregations: {
        item_location: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.holdingLocation_packed'
              }
            }
          }
        },
        item_status: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.status_packed'
              }
            }
          }
        },
        item_format: {
          nested: {
            path: 'items'
          },
          aggs: {
            _nested: {
              terms: {
                size: 100,
                field: 'items.formatLiteral'
              }
            }
          }
        }
      }
    }

    expect(bodyForFindByUri(barcodes, params))
      .to.deep.equal(expected)
  })
})
