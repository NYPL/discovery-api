const { expect } = require('chai')
const sinon = require('sinon')

describe('Vocabularies', function () {
  let app

  before(function () {
    app = {
      resources: {
        aggregation: sinon.stub()
      }
    }
    require('../lib/vocabularies')(app)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('returns expected formats, languages, collections, and building locations', async () => {
    const mockLanguages = { values: [{ value: 'eng', label: 'English' }] }
    const mockFormats = {
      values: [
        { value: 'a', label: 'Book/text', count: 100 },
        { value: 'z', label: 'E-book', count: 50 }
      ]
    }

    app.resources.aggregation
      .withArgs({ field: 'language', per_page: 500 }, { baseUrl: app.baseUrl })
      .resolves(mockLanguages)
    app.resources.aggregation
      .withArgs({ field: 'format' }, { baseUrl: app.baseUrl })
      .resolves(mockFormats)

    const results = await app.vocabularies({}, { baseUrl: app.baseUrl })

    expect(results).to.be.an('object')
    expect(results.formats).to.be.an('array')
    expect(results.languages).to.deep.equal(mockLanguages.values)
    expect(results.collections).to.be.an('array')
    expect(results.buildingLocations).to.be.an('array')

    // Check agg formats intersect with nyplCore formats
    results.formats.forEach(f => {
      expect(['a', 'z']).to.include(f.value)
    })
  })

  it('includes collections with holdingLocations', async () => {
    const mockLanguages = { values: [] }
    const mockFormats = { values: [] }

    app.resources.aggregation.resolves(mockLanguages)
    app.resources.aggregation.onSecondCall().resolves(mockFormats)

    const results = await app.vocabularies({}, { baseUrl: app.baseUrl })

    expect(results.collections[0]).to.have.keys(['value', 'label', 'holdingLocations'])
  })
})
