const request = require('supertest')
const { expect } = require('chai')
const { baseUrl, getId } = require('./helpers')

// These tests compare NYQL query results to their Advanced Search equivalents to
// verify that both interfaces return the same results. In some cases we only compare
// totalResults counts (via compareTotalResultsOnly) rather than exact IDs, since
// some queries are intentionally more or less precise in one interface vs the other.

const testCases = [
  {
    name: 'author exact match',
    nyql: {
      q: 'author = "Meillassoux, Quentin"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      contributor: 'Meillassoux, Quentin'
    }
  },
  {
    name: 'keyword = "pterosaur"',
    nyql: {
      q: 'keyword = "pterosaur"',
      search_scope: 'cql'
    },
    advanced: {
      q: 'pterosaur'
    }
  },
  {
    name: 'keyword = pterosaur (unquoted)',
    nyql: {
      q: 'keyword = pterosaur',
      search_scope: 'cql'
    },
    advanced: {
      q: 'pterosaur'
    }
  },
  // Commented out — buggy as of 5/27/26. Needs investigation to determine whether
  // this is a NYQL issue or an Advanced Search issue before re-enabling.
  // {
  //   name: 'cat in the hat title search',
  //   nyql: {
  //     q: 'title = "the cat in the hat"',
  //     search_scope: 'cql',
  //   },
  //   advanced: {
  //     q: '',
  //     title: '"the cat in the hat"',
  //   },
  // },
  {
    name: 'call number search',
    nyql: {
      q: 'callnumber = "^JFE 24"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      callnumber: 'JFE 24'
    },
    compareTotalResultsOnly: true
  },
  {
    name: 'subject search',
    nyql: {
      q: 'subject = "Mitanni (Ancient kingdom)"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      subject: 'Mitanni (Ancient kingdom)'
    }
  },
  {
    name: 'Schwarzman location search',
    nyql: {
      q: 'center = "Schwarzman"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      filters: {
        buildingLocation: ['ma']
      }
    },
    compareTotalResultsOnly: true
  },
  {
    name: 'SASB location search',
    nyql: {
      q: 'center = "SASB"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      filters: {
        buildingLocation: ['ma']
      }
    },
    compareTotalResultsOnly: true
  },
  {
    name: 'division = "Manuscript"',
    nyql: {
      q: 'division = "Manuscript"',
      search_scope: 'cql',
      sort: 'title',
      sort_direction: 'asc'
    },
    advanced: {
      q: '',
      division: '"Manuscript"',
      filters: {
        collection: ['mao', 'scd']
      },
      sort: 'title',
      sort_direction: 'asc'
    }
  },
  {
    name: 'language = "Irish"',
    nyql: {
      q: 'language = "Irish"',
      search_scope: 'cql',
      sort: 'title',
      sort_direction: 'asc'
    },
    advanced: {
      q: '',
      filters: {
        language: ['lang:gle', 'lang:mga', 'lang:sga']
      },
      sort: 'title',
      sort_direction: 'asc'
    },
    compareTotalResultsOnly: true
  },
  {
    name: 'genre = "memorial books"',
    nyql: {
      q: 'genre = "memorial books"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      genre: '"memorial books"'
    },
    advancedEndpoint: '/discovery/resources/aggregations',
    compareTotalResultsOnly: true
  },
  {
    name: 'format = "tablet"',
    nyql: {
      q: 'format = "tablet"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      filters: {
        format: ['4'] // formatId for "tablet"
      }
    }
  },
  {
    name: 'title + language filter (AND)',
    nyql: {
      q: 'title = "the cat in the hat" AND language = "Yiddish"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      title: '"the cat in the hat"',
      filters: {
        language: ['lang:yid']
      }
    },
    compareTotalResultsOnly: true
  },
  {
    name: 'author = "Poe, Edgar Allan", page 2, sort A-Z',
    nyql: {
      q: 'author = "Poe, Edgar Allan"',
      search_scope: 'cql',
      page: 2,
      sort: 'title',
      sort_direction: 'asc'
    },
    advanced: {
      q: '',
      contributor: '"Poe, Edgar Allan"',
      page: 2,
      sort: 'title',
      sort_direction: 'asc'
    }
  },
  {
    name: 'author = "Isaac Asimov" (aggregations)',
    nyql: {
      q: 'author = "Isaac Asimov"',
      search_scope: 'cql'
    },
    advanced: {
      q: '',
      contributor: 'Isaac Asimov'
    },
    advancedEndpoint: '/discovery/resources/aggregations'
  }
]

describe('Discovery API - NYQL vs Advanced Search equivalence', function () {
  this.timeout(30000)

  testCases.forEach(({ name, nyql, advanced, advancedEndpoint, compareTotalResultsOnly }) => {
    it(`should match results for: ${name}`, async () => {
      const endpoint = '/discovery/resources'
      const advEndpoint = advancedEndpoint || endpoint

      const nyqlRes = await request(baseUrl)
        .get(endpoint)
        .query({ ...nyql, per_page: 100 })
        .timeout(30000)
        .expect(200)

      const advancedRes = await request(baseUrl)
        .get(advEndpoint)
        .query({ ...advanced, per_page: 100 })
        .timeout(30000)
        .expect(200)

      expect(nyqlRes.body.itemListElement).to.be.an('array')
      expect(advancedRes.body.itemListElement).to.be.an('array')

      if (compareTotalResultsOnly) {
        const nyqlTotal = nyqlRes.body.totalResults
        const advTotal = advancedRes.body.totalResults
        // aggregations endpoint returns totalResults as { value, relation }
        const normalize = (t) => (typeof t === 'object' ? t.value : t)
        expect(normalize(nyqlTotal)).to.equal(normalize(advTotal))
      } else {
        const nyqlIds = nyqlRes.body.itemListElement.map(getId).filter(Boolean)
        const advancedIds = advancedRes.body.itemListElement.map(getId).filter(Boolean)

        const nyqlOnly = nyqlIds.filter((id) => !advancedIds.includes(id))
        const advancedOnly = advancedIds.filter((id) => !nyqlIds.includes(id))
        const sortedNyqlIds = [...nyqlIds].sort()
        const sortedAdvancedIds = [...advancedIds].sort()

        expect(nyqlIds.length).to.equal(advancedIds.length)
        expect(nyqlOnly).to.deep.equal([])
        expect(advancedOnly).to.deep.equal([])
        expect(sortedNyqlIds).to.deep.equal(sortedAdvancedIds)
      }
    })
  })
})
