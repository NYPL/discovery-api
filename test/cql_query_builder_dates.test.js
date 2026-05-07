const { expect } = require('chai')
const { buildAtomicMain } = require('../lib/elasticsearch/cql_query_builder')

describe('cql_query_builder date queries', () => {
  // Mocking fields per `indexMapping.date`
  const dateFields = { fields: ['dates.range'] }

  it('builds range queries for relation "any" with multiple dates', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: 'any',
      terms: ['1999', '2000'],
      term: '1999 2000',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      range: {
                        'dates.range': { gte: '1999', relation: 'within', lt: '2000-01-01' }
                      }
                    },
                    {
                      range: {
                        'dates.range': { gte: '2000', relation: 'within', lt: '2001-01-01' }
                      }
                    }
                  ]
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range queries for relation "all" with multiple dates', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: 'all',
      terms: ['1999', '2000'],
      term: '1999 2000',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [
                    {
                      range: {
                        'dates.range': { gte: '1999', relation: 'within', lt: '2000-01-01' }
                      }
                    },
                    {
                      range: {
                        'dates.range': { gte: '2000', relation: 'within', lt: '2001-01-01' }
                      }
                    }
                  ]
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range query for relation "within" connecting two bounds', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: 'within',
      terms: ['1990', '2000'],
      term: '1990 2000',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { gte: '1990', lt: '2001-01-01' }
          }
        }
      }
    })
  })

  it('builds range query for basic mathematical relation "<"', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '<',
      terms: ['1999'],
      term: '1999',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { lt: '1999' }
          }
        }
      }
    })
  })

  it('builds range query for basic mathematical relation ">"', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '>',
      terms: ['1999'],
      term: '1999',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { gte: '2000-01-01' }
          }
        }
      }
    })
  })

  it('builds range query for basic mathematical relation ">="', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '>=',
      terms: ['1999'],
      term: '1999',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { gte: '1999' }
          }
        }
      }
    })
  })

  it('builds range query for basic mathematical relation "<="', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '<=',
      terms: ['1999'],
      term: '1999',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { lt: '2000-01-01' }
          }
        }
      }
    })
  })

  it('builds range query for relation "encloses"', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: 'encloses',
      terms: ['1990'],
      term: '1990',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': { gte: '1990', lte: '1990', relation: 'contains' }
                }
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
    })
  })

  it('builds range query for relation "=" with yyyy date', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '=',
      terms: ['1999'],
      term: '1999',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': { gte: '1999', relation: 'within', lt: '2000-01-01' }
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range query for relation "=" with yyyy-mm date', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '=',
      terms: ['1999-10'],
      term: '1999-10',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': { gte: '1999-10', relation: 'within', lt: '1999-11-01' }
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range query for relation "=" with yyyy-mm-dd date', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '=',
      terms: ['1999-10-15'],
      term: '1999-10-15',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': { gte: '1999-10-15', relation: 'within', lt: '1999-10-16' }
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range query for relation "=" with yyyy-12 date', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '=',
      terms: ['1999-12'],
      term: '1999-12',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': { gte: '1999-12', relation: 'within', lt: '2000-01-01' }
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })

  it('builds range query for relation "=" with yyyy-mm-dd date at end of month', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: '=',
      terms: ['2023-04-30'],
      term: '2023-04-30',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          bool: {
            must: [
              {
                range: {
                  'dates.range': {
                    gte: '2023-04-30',
                    relation: 'within',
                    lt: '2023-05-01'
                  }
                }
              },
              {
                terms: {
                  'dates.tag': ['e', 's', 'p', 'r', 't']
                }
              }
            ]
          }
        }
      }
    })
  })
})
