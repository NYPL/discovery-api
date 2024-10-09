const { expect } = require('chai')

const ElasticQuery = require('../lib/elastic-query')

describe('ElasticQuery', function () {
  it('addShould', () => {
    const query = new ElasticQuery()
    query.addShould({ term: { prop: '123' } })
    expect(query.toJson()).to.deep.equals({
      bool: {
        should: [{ term: { prop: '123' } }]
      }
    })
  })

  it('addMust', () => {
    const query = new ElasticQuery()
    query.addMust({ term: { prop: '123' } })
    expect(query.toJson()).to.deep.equals({
      bool: {
        must: [{ term: { prop: '123' } }]
      }
    })
  })

  it('addFilter', () => {
    const query = new ElasticQuery()
    query.addFilter({ term: { prop: '123' } })
    expect(query.toJson()).to.deep.equals({
      bool: {
        filter: [{ term: { prop: '123' } }]
      }
    })
  })

  it('addShoulds, addMusts, addFilters in combination', () => {
    const query = new ElasticQuery()
    query.addShoulds([
      { term: { prop: 'shoulds 1' } },
      { term: { prop: 'shoulds 2' } }
    ])
    query.addMusts([
      { term: { prop: 'musts 1' } },
      { term: { prop: 'musts 2' } }
    ])
    query.addFilters([
      { term: { prop: 'filters 1' } },
      { term: { prop: 'filters 2' } }
    ])

    expect(query.toJson()).to.deep.equals({
      bool: {
        should: [
          { term: { prop: 'shoulds 1' } },
          { term: { prop: 'shoulds 2' } }
        ],
        must: [
          { term: { prop: 'musts 1' } },
          { term: { prop: 'musts 2' } }
        ],
        filter: [
          { term: { prop: 'filters 1' } },
          { term: { prop: 'filters 2' } }
        ]
      }
    })
  })
})
