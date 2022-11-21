const axios = require('axios')
const sinon = require('sinon')

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

  describe('bib id with item filters', function () {
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
        item_status: 'here',
        include_item_aggregations: true,
        merge_checkin_card_items: false
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
        sinon.assert.calledWith(findByUriStub, { include_item_aggregations: true, merge_checkin_card_items: false, uri: `${params.uri}-${params.itemUri}` })
      }
      )
    })
  })
})
