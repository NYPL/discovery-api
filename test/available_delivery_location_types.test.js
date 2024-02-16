const fixtures = require('./fixtures')

describe('AvailableDeliveryLocationTypes', function () {
  let AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

  before(function () {
    // Reroute these (and only these) api paths to local fixtures:
    fixtures.enableDataApiFixtures({
      'patrons/branch-patron-id': 'patron-research.json',
      'patrons/scholar-patron-id': 'patron-scholar.json',
      'patrons/unrecognizable-ptype-patron-id': 'patron-unrecognizable-type.json'
    })
  })

  after(function () {
    fixtures.disableDataApiFixtures()
  })

  it('maps patron type 10 to [\'Research\']', function () {
    return AvailableDeliveryLocationTypes.getByPatronId('branch-patron-id').then(({ deliveryLocationTypes }) => {
      expect(deliveryLocationTypes).to.eql(['Research'])
    })
  })

  it('maps patron type 78 to [\'Scholar\', \'Research\']', function () {
    return AvailableDeliveryLocationTypes.getByPatronId('scholar-patron-id').then(({ deliveryLocationTypes, scholarRoom }) => {
      expect(deliveryLocationTypes).to.eql(['Research', 'Scholar'])
      expect(scholarRoom).to.eql({
        code: 'mal17',
        label: 'Schwarzman Building - Scholar Room 217'
      })
    })
  })

  it('maps an unrecognizable patron type to [\'Research\']', function () {
    return AvailableDeliveryLocationTypes.getByPatronId('unrecognizable-ptype-patron-id').then(({ deliveryLocationTypes }) => {
      expect(deliveryLocationTypes).to.eql(['Research'])
    })
  })
})
