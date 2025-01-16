const fixtures = require('./fixtures')

describe('AvailableDeliveryLocationTypes', function () {
  const AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

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

  it('returns no scholar room code for ptype 10 (research)', function () {
    return AvailableDeliveryLocationTypes.getScholarRoomByPatronId('branch-patron-id').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(undefined)
    })
  })

  it('returns scholar room code for ptype 87 (research)', function () {
    return AvailableDeliveryLocationTypes.getScholarRoomByPatronId('scholar-patron-id').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql('mala')
    })
  })

  it('returns no scholar room code for unrecognizable ptype', function () {
    return AvailableDeliveryLocationTypes.getScholarRoomByPatronId('unrecognizable-ptype-patron-id').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(undefined)
    })
  })
})
