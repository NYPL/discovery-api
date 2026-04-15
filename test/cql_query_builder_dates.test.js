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
            should: [
              {
                range: {
                  'dates.range': { gte: '1999', relation: 'within', lt: '2000' }
                }
              },
              {
                range: {
                  'dates.range': { gte: '2000', relation: 'within', lt: '2001' }
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
                range: {
                  'dates.range': { gte: '1999', relation: 'within', lt: '2000' }
                }
              },
              {
                range: {
                  'dates.range': { gte: '2000', relation: 'within', lt: '2001' }
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
            'dates.range': { gte: '1990', lte: '2000' }
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
            'dates.range': { gt: '1999' }
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
            'dates.range': { lte: '1999' }
          }
        }
      }
    })
  })

  it('builds range query for relation "encloses" connecting two bounds', () => {
    const query = buildAtomicMain({
      scope: 'date',
      relation: 'encloses',
      terms: ['1990', '2000'],
      term: '1990 2000',
      fields: dateFields
    })

    expect(query).to.deep.equal({
      nested: {
        path: 'dates',
        query: {
          range: {
            'dates.range': { gt: '1990', lt: '2000' }
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
          range: {
            'dates.range': { gte: '1999', relation: 'within', lt: '2000' }
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
          range: {
            'dates.range': { gte: '1999-10', relation: 'within', lt: '1999-11' }
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
          range: {
            'dates.range': { gte: '1999-10-15', relation: 'within', lte: '1999-10-15T23:59:59' }
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
          range: {
            'dates.range': { gte: '1999-12', relation: 'within', lt: '2000' }
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
          range: {
            'dates.range': {
              gte: '2023-04-30',
              relation: 'within',
              lte: '2023-04-30T23:59:59'
            }
          }
        }
      }
    })
  })
})
