const fixtures = require('./fixtures')

describe('AvailableDeliveryLocationTypes', function () {
  let AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

  before(function () {
    // Reroute these (and only these) api paths to local fixtures:
    fixtures.enableDataApiFixtures({
      'patrons/branch-patron-id': 'patron-research.json',
      'patrons/scholar-patron-id': 'patron-scholar.json'
    })
  })

  after(function () {
    fixtures.disableDataApiFixtures()
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
