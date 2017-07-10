var resolveDeliveryLocations = require('../lib/delivery-locations-resolver').resolveDeliveryLocations

var sampleItems = [
  {
    'identifier': [
      'urn:bnum:b11995345',
      'urn:bnum:b11995322',
      'urn:barcode:33433036864449'
    ],
    'uri': 'i12227153',
    'holdingLocation': [
      {
        'id': 'loc:scff2',
        'label': 'Schomburg Center - Research & Reference'
      }
    ]
  },
  {
    'identifier': [
      'urn:bnum:pb176961',
      'urn:bnum:b11995345',
      'urn:barcode:33433047331719'
    ],
    'uri': 'i14211097',
    'holdingLocation': [
      {
        'id': 'loc:rcpm2',
        'label': 'OFFSITE - Request in Advance for use at Performing Arts'
      }
    ]
  },
  {
    'identifier': [
      'urn:bnum:pb176961',
      'urn:barcode:32101062243553'
    ],
    'uri': 'pi189241'
  }
]

describe('Delivery-locations-resolver', function () {
  it('will ammend the deliveryLocation property for an onsite NYPL item', function () {
    return resolveDeliveryLocations([sampleItems[0]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will ammend the deliveryLocation property for an offsite NYPL item', function () {
    return resolveDeliveryLocations([sampleItems[1]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will ammend the deliveryLocation property for a PUL item', function () {
    return resolveDeliveryLocations([sampleItems[2]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })
})

