describe('AvailableDeliveryLocationTypes', function () {
  let AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

  it('returns an Array', function () {
    // These are hard-wired to what I know about patron types 10 & 78
    AvailableDeliveryLocationTypes._getPatronTypeOf = () => { return '10' }
    expect(AvailableDeliveryLocationTypes.getByPatronId('6206547')).to.eql(['Research'])

    AvailableDeliveryLocationTypes._getPatronTypeOf = () => { return '78' }
    expect(AvailableDeliveryLocationTypes.getByPatronId('6206547')).to.eql(['Scholar', 'Research'])
  })
})
