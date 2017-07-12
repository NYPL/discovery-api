var DeliveryLocationsResolver = require('../lib/delivery-locations-resolver')

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
  },
  {
    'identifier': [
      'urn:bnum:b11995155',
      'urn:barcode:33433011759648'
    ],
    'uri': 'i10483065'
  }
]

const scholarRooms = [
  {
    id: 'loc:mala',
    label: 'SASB - Allen Scholar Room'
  },
  {
    id: 'loc:maln',
    label: 'SASB - Noma Scholar Room'
  },
  {
    id: 'loc:malw',
    label: 'SASB - Wertheim Scholar Room'
  },
  {
    id: 'loc:malc',
    label: 'SASB - Cullman Center'
  }
]

describe('Delivery-locations-resolver', function () {
  it('will ammend the deliveryLocation property for an onsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems[0]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will ammend the deliveryLocation property for an offsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems[1]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will ammend the deliveryLocation property for a PUL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems[2]]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will hide "Scholar" deliveryLocation for non-scholars', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems[3]], ['Research']).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation).to.not.include(scholarRoom)
      })
    })
  })

  it('will reveal "Scholar" deliveryLocation for scholars', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems[3]], ['Research', 'Scholar']).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation).to.include(scholarRoom)
      })
    })
  })
})

