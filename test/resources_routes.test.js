const axios = require('axios')
const { expect } = require('chai')
const sinon = require('sinon')
const app = require('../app')

describe('resources routes', function () {
  describe('item id', function () {
    it('recognizes harvard item ids', function () {
      const findByUriSpy = sinon.spy(app.resources.findByUri)
      axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/hb990000049180203941-hi231730706390003941`).then(() => {
        const params = {uri: 'hb990000049180203941', itemUri: 'hi231730706390003941'}
        sinon.assert.calledWith(findByUriSpy, params)
      }
      )
    })
    it('recognizes pi item ids', function () {
      const findByUriSpy = sinon.spy(app.resources.findByUri)
      axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/pb990000049180203941-pi231730706390003941`).then(() => {
        const params = {uri: 'pb990000049180203941', itemUri: 'pi231730706390003941'}
        sinon.assert.calledWith(findByUriSpy, params)
      }
      )
    })
    it('recognizes ci item ids', function () {
      const findByUriSpy = sinon.spy(app.resources.findByUri)
      axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/cb9900000-ci2317307`).then(() => {
        const params = {uri: 'cb9900000', itemUri: 'ci2317307'}
        sinon.assert.calledWith(findByUriSpy, params)
      }
      )
    })
    it('recognizes i item ids', function () {
      const findByUriSpy = sinon.spy(app.resources.findByUri)
      axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/b12345678-i23173070`).then(() => {
        const params = {uri: 'b12345678', itemUri: 'i23173070'}
        sinon.assert.calledWith(findByUriSpy, params)
      }
      )
    })
    it('rejects non item ids', function () {
      const findByUriSpy = sinon.spy(app.resources.findByUri)
      axios.get(`${global.TEST_BASE_URL}/api/v0.1/discovery/resources/pb9900000-xx2317307`).then(() => {
        expect(findByUriSpy.callCount).to.equal(0)
      }
      )
    })
  })
})
