const axios = require('axios')
const sinon = require('sinon')
const { InvalidParameterError, NotFoundError, IndexSearchError, IndexConnectionError } = require('../lib/errors')
const esClient = require('../lib/elasticsearch/client')

describe('resources routes', function () {
  let app
  let findByUriStub

  before(function () {
    app = require('../app')
  })

  beforeEach(function () {
    findByUriStub = sinon.stub(app.resources, 'findByUri')
      .callsFake(() => Promise.resolve({ response: 'response' }))
  })

  afterEach(() => {
    app.resources.findByUri.restore()
  })

  describe('bib id with item filters', () => {
    it('can accept "all_items=true"', async () => {
      const params = {
        uri: 'b1234'
      }
      const query = 'item_date=1-2&item_volume=3-4&item_format=text,microfilm&item_location=SASB,LPA&item_status=here&all_items=true'
      const expectedParams = {
        uri: params.uri,
        item_date: '1-2',
        item_volume: '3-4',
        item_format: 'text,microfilm',
        item_location: 'SASB,LPA',
        item_status: 'here',
        all_items: 'true'
      }
      await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}?${query}`)
      sinon.assert.calledWith(findByUriStub, expectedParams)
    })

    it('passes filters to handler', function () {
      const params = {
        uri: 'b1234'
      }

      const query = 'item_date=1-2&item_volume=3-4&item_format=text,microfilm&item_location=SASB,LPA&item_status=here'

      const expectedParams = {
        uri: params.uri,
        item_date: '1-2',
        item_volume: '3-4',
        item_format: 'text,microfilm',
        item_location: 'SASB,LPA',
        item_status: 'here'
      }

      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}?${query}`).then(() => {
        sinon.assert.calledWith(findByUriStub, expectedParams)
      })
    })
  })

  describe('item id', function () {
    it('recognizes harvard item ids', function () {
      const params = { uri: 'hb990000049180203941', itemUri: 'hi231730706390003941' }
      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}-${params.itemUri}`).then(() => {
        sinon.assert.calledWith(findByUriStub, params)
      }
      )
    })
    it('recognizes pi item ids', function () {
      const params = { uri: 'pb990000049180203941', itemUri: 'pi231730706390003941' }
      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}-${params.itemUri}`).then(() => {
        sinon.assert.calledWith(findByUriStub, params)
      }
      )
    })
    it('recognizes ci item ids', function () {
      const params = { uri: 'cb9900000', itemUri: 'ci2317307' }
      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}-${params.itemUri}`).then(() => {
        sinon.assert.calledWith(findByUriStub, params)
      }
      )
    })
    it('recognizes i item ids', function () {
      const params = { uri: 'b12345678', itemUri: 'i23173070' }
      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}-${params.itemUri}`).then(() => {
        sinon.assert.calledWith(findByUriStub, params)
      }
      )
    })
    it('rejects non item ids', function () {
      const params = { uri: 'pb9900000', itemUri: 'xx2317307' }
      return axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/${params.uri}-${params.itemUri}`).then(() => {
        // Check that the item route was bypassed and findByUri was called in the next express route
        sinon.assert.calledWith(findByUriStub, { uri: `${params.uri}-${params.itemUri}` })
      }
      )
    })
  })
})

describe('resources bib/item routes error handling', function () {
  let app
  let findByUriStub

  before(function () {
    app = require('../app')
  })

  beforeEach(function () {
    findByUriStub = sinon.stub(app.resources, 'findByUri').callsFake(() => Promise.resolve({ response: 'ok' }))
  })

  afterEach(function () {
    if (findByUriStub && findByUriStub.restore) findByUriStub.restore()
  })

  it('returns 422 for InvalidParameterError', async function () {
    findByUriStub.callsFake(() => Promise.reject(new InvalidParameterError('Missing id')))

    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b1234`)
      .catch(e => e.response)

    expect(response.status).to.equal(422)
    expect(response.data).to.have.property('name', 'InvalidParameterError')
    expect(response.data).to.have.property('error', 'Missing id')
  })

  it('returns 404 for NotFoundError', async function () {
    findByUriStub.callsFake(() => Promise.reject(new NotFoundError('Not found')))

    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b1234`)
      .catch(e => e.response)

    expect(response.status).to.equal(404)
    expect(response.data).to.have.property('name', 'NotFoundError')
    expect(response.data).to.have.property('error', 'Not found')
  })
})

describe('resources search route error handling', function () {
  let app
  let searchStub

  before(function () {
    app = require('../app')
  })

  beforeEach(function () {
    searchStub = sinon.stub(app.resources, 'search').callsFake(() => Promise.resolve({ response: 'ok' }))
  })

  afterEach(function () {
    if (searchStub && searchStub.restore) searchStub.restore()
  })

  it('returns 422 for InvalidParameterError', async function () {
    searchStub.callsFake(() => Promise.reject(new InvalidParameterError('Missing query param')))

    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources?q=test`)
      .catch(e => e.response)

    expect(response.status).to.equal(422)
    expect(response.data).to.have.property('name', 'InvalidParameterError')
    expect(response.data).to.have.property('error', 'Missing query param')
  })

  it('returns 400 for IndexSearchError', async function () {
    searchStub.callsFake(() => Promise.reject(new IndexSearchError('Malformed search query')))

    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources?q=test`)
      .catch(e => e.response)

    expect(response.status).to.equal(400)
    expect(response.data).to.have.property('name', 'IndexSearchError')
    expect(response.data).to.have.property('error', 'Malformed search query')
  })

  it('returns 500 for IndexConnectionError', async function () {
    searchStub.callsFake(() => Promise.reject(new IndexConnectionError('ES down')))

    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources?q=test`)
      .catch(e => e.response)

    expect(response.status).to.equal(500)
    expect(response.data).to.have.property('name', 'IndexConnectionError')
    expect(response.data).to.have.property('error', 'ES down')
  })
})

describe('resources linking-entry route', function () {
  let app

  before(function () {
    app = require('../app')
  })

  beforeEach(function () {
    sinon.spy(app.resources, 'linkingEntry')
    sinon.stub(app.resources, 'search').resolves({ totalResults: 125 })
    sinon.stub(esClient, 'get').resolves({ _source: { linkingEntry: [{ author: ['shakespeare'], display: 'display', label: 'Label', hash: 123, marcTag: '700', marcTagIndex: 0 }] } })
  })

  afterEach(() => {
    if (esClient.get.restore) esClient.get.restore()
    if (esClient.search.restore) esClient.search.restore()
    if (app.resources.search.restore) app.resources.search.restore()
    app.resources.linkingEntry.restore?.()
  })

  it('routes path params to app.resources.linkingEntry', async () => {
    await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/linking-entry/b1234/700/0/123`)

    sinon.assert.calledWith(app.resources.linkingEntry, {
      uri: 'b1234',
      marcTag: '700',
      marcTagIndex: '0',
      hash: '123'
    })
  })

  it('routes query params alongside path params to app.resources.linkingEntry', async () => {
    await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/linking-entry/b1234/700/0/123?page=2&per_page=10`)

    sinon.assert.calledWith(app.resources.linkingEntry, {
      uri: 'b1234',
      marcTag: '700',
      marcTagIndex: '0',
      hash: '123',
      page: '2',
      per_page: '10'
    })
  })

  it('returns the resolved response body', async () => {
    const response = await axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/linking-entry/b1234/700/0/123`)

    expect(response.status).to.equal(200)
    // search results stubbed to just be number of results. in real life, there will be actual bib results included.
    expect(response.data).to.deep.equal(
      {
        '@type': 'linkingEntryItemList',
        linkingEntryInfo: {
          nyqlQuery: '((author adj "shakespeare")) not bibnumber = b1234',
          originalLinkingEntryField: 'Label: display',
          resultsDerivedFromPartialMatch: false
        },
        totalResults: 125
      }
    )
  })
})
