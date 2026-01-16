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

describe('bodyForFindByUri', async function () {
  bodyForFindByUri()
})
