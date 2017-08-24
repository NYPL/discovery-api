var DeliveryLocationsResolver = require('../lib/delivery-locations-resolver')

var sampleItems = {
  onsiteNypl: {
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
  offsiteNypl: {
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
  pul: {
    'identifier': [
      'urn:bnum:pb176961',
      'urn:barcode:32101062243553'
    ],
    'uri': 'pi189241'
  },
  cul: {
    'identifier': [
      'urn:bnum:cb1014551',
      'urn:barcode:CU56521537'
    ],
    'uri': 'CU55057721'
  },
  offsiteNyplDeliverableToScholarRooms: {
    'identifier': [
      'urn:bnum:b11995155',
      'urn:barcode:33433011759648'
    ],
    'uri': 'i10483065'
  },
  fakeNYPLMapDivisionItem: {
    'identifier': [
      'urn:barcode:made-up-barcode-that-recap-says-belongs-to-ND'
    ]
  }

}

const scholarRooms = [
  {
    id: 'loc:mala',
    label: 'Schwarzman Building - Allen Scholar Room'
  },
  {
    id: 'loc:maln',
    label: 'Schwarzman Building - Noma Scholar Room'
  },
  {
    id: 'loc:malw',
    label: 'Schwarzman Building - Wertheim Scholar Room'
  },
  {
    id: 'loc:malc',
    label: 'Schwarzman Building - Cullman Center'
  }
]

function takeThisPartyPartiallyOffline () {
  // Reroute HTC API requests mapping specific barcodes tested above to recap customer codes:
  DeliveryLocationsResolver.__recapCustomerCodesByBarcodes = () => {
    return Promise.resolve({
      '33433047331719': 'NP',
      '32101062243553': 'PA',
      'CU56521537': 'CU',
      '33433011759648': 'NA',
      // Let's pretend this is a valid NYPL Map Division item barcode
      // and let's further pretend that HTC API tells us it's recap customer code is ND
      'made-up-barcode-that-recap-says-belongs-to-ND': 'ND'
    })
  }
}

describe('Delivery-locations-resolver', function () {
  before(takeThisPartyPartiallyOffline)

  it('will ammend the deliveryLocation property for an onsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will set eddRequestable to false for a specific onsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].eddRequestable).to.equal(false)
    })
  })

  it('will ammend the deliveryLocation property for an offsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.offsiteNypl]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will set eddRequestable to true for a specific offsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.offsiteNypl]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will ammend the deliveryLocation property for a PUL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.pul]).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty
    })
  })

  it('will set eddRequestable to true for a specific PUL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.pul]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will set eddRequestable to true for a specific CUL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.cul]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will set eddRequestable to false for a fake Map Division item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.fakeNYPLMapDivisionItem]).then((items) => {
      expect(items[0].eddRequestable).to.equal(false)
    })
  })

  it('will hide "Scholar" deliveryLocation for non-scholars', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.offsiteNyplDeliverableToScholarRooms], ['Research']).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation).to.not.include(scholarRoom)
      })
    })
  })

  it('will reveal "Scholar" deliveryLocation for scholars', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.offsiteNyplDeliverableToScholarRooms], ['Research', 'Scholar']).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation).to.include(scholarRoom)
      })
    })
  })
})
