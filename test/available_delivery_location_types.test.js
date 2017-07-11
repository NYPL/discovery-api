// These are hard-wired to what I know about patron types 10 & 78
describe('AvailableDeliveryLocationTypes', function () {
  let AvailableDeliveryLocationTypes = require('../lib/available_delivery_location_types.js')

  it('maps patron type 10 to [\'Research\']', function () {
    AvailableDeliveryLocationTypes._getPatronTypeOf = () => Promise.resolve('10')
    return AvailableDeliveryLocationTypes.getByPatronId('620xxxx').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(['Research'])
    })
  })

  it('maps patron type 78 to [\'Scholar\', \'Research\']', function () {
    AvailableDeliveryLocationTypes._getPatronTypeOf = () => Promise.resolve('78')
    return AvailableDeliveryLocationTypes.getByPatronId('620xxxx').then((deliveryLocationTypes) => {
      expect(deliveryLocationTypes).to.eql(['Scholar', 'Research'])
    })
  })
})
