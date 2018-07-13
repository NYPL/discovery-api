const sinon = require('sinon')
const fs = require('fs')

// These are hard-wired to what I know about patron types 10 & 78
describe('AvailableDeliveryLocationTypes', function () {
  let AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

  before(function () {
    sinon.stub(AvailableDeliveryLocationTypes.client, 'get').callsFake(function (path) {
      switch (path) {
        case 'patrons/branch-patron-id':
          return Promise.resolve(JSON.parse(fs.readFileSync('./test/fixtures/patron-research.json', 'utf8')))
        case 'patrons/scholar-patron-id':
          return Promise.resolve(JSON.parse(fs.readFileSync('./test/fixtures/patron-scholar.json', 'utf8')))
        default:
          return Promise.reject()
      }
    })
  })

  after(function () {
    AvailableDeliveryLocationTypes.client.get.restore()
  })

  it('maps patron type 10 to [\'Research\']', function () {
    return AvailableDeliveryLocationTypes.getByPatronId('branch-patron-id').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(['Research'])
    })
  })

  it('maps patron type 78 to [\'Scholar\', \'Research\']', function () {
    return AvailableDeliveryLocationTypes.getByPatronId('scholar-patron-id').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(['Scholar', 'Research'])
    })
  })
})
