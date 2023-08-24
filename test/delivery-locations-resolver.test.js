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
    ],
    'accessMessage': [
      { 'label': 'Use in library', 'id': 'accessMessage:1' }
    ],
    'catalogItemType': [
      { 'label': 'book, limited circ, MaRLI', 'id': 'catalogItemType:55' }
    ],
    'status': [
      { 'label': 'Available ', 'id': 'status:a' }
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
    'uri': 'ci9876'
  },
  offsiteNyplDeliverableToScholarRooms: {
    'identifier': [
      'urn:bnum:b11995155',
      'urn:barcode:33433011759648'
    ],
    'holdingLocation': [
      {
        'id': 'loc:rcpm2',
        'label': 'OFFSITE - Request in Advance for use at Performing Arts'
      }
    ],
    'uri': 'i10483065'
  },
  fakeNYPLMapDivisionItem: {
    'identifier': [
      'urn:barcode:made-up-barcode-that-recap-says-belongs-to-ND'
    ],
    'uri': 'i7654'
  }
}

const scholarRooms = [
  {
    id: 'loc:mala',
    label: 'Schwarzman Building - Allen Scholar Room'
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

  it('will assign empty array to deliveryLocation property for an onsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].deliveryLocation).to.be.empty
    })
  })

  it('will set eddRequestable to true for a specific onsite NYPL item', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
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

  it('will serve deliveryLocations if item holdingLocation is requestable', function () {
    // At writing, this sierra location (rcpm2) is marked requestable: true
    const offsiteItemInNonRequestableLocation = sampleItems.offsiteNypl

    return DeliveryLocationsResolver.resolveDeliveryLocations([offsiteItemInNonRequestableLocation])
      .then((items) => {
        expect(items[0].deliveryLocation).to.be.a('array')
        expect(items[0].deliveryLocation).to.have.lengthOf(1)
      })
  })

  it('will hide deliveryLocations if item holdingLocation is not requestable', function () {
    const offsiteItemInNonRequestableLocation = JSON.parse(JSON.stringify(sampleItems.offsiteNypl))
    // At writing, this sierra location is marked requestable: false
    offsiteItemInNonRequestableLocation.holdingLocation[0].id = 'loc:rccd8'

    return DeliveryLocationsResolver.resolveDeliveryLocations([offsiteItemInNonRequestableLocation])
      .then((items) => {
        expect(items[0].deliveryLocation).to.be.a('array')
        expect(items[0].deliveryLocation).to.be.empty
      })
  })

  it('will reveal "Scholar" deliveryLocation for scholars', function () {
    return DeliveryLocationsResolver.resolveDeliveryLocations([sampleItems.offsiteNyplDeliverableToScholarRooms], ['Research', 'Scholar']).then((items) => {
      expect(items[0].deliveryLocation).to.not.be.empty

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation.map((location) => location.id)).to.include(scholarRoom.id)
      })
    })
  })

  describe('eddRequestableByOnSiteCriteria', function () {
    let item

    beforeEach(function () {
      item = {
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
        ],
        'accessMessage': [
          { 'label': 'Use in library', 'id': 'accessMessage:1' }
        ],
        'catalogItemType': [
          { 'label': 'book, limited circ, MaRLI', 'id': 'catalogItemType:55' }
        ],
        'status': [
          { 'label': 'Available ', 'id': 'status:a' }
        ]
      }
    })

    it('will return false for ReCAP materials', function () {
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(sampleItems.offsiteNypl)).to.equal(false)
    })

    it('will return true for on-site item meeting all criteria', function () {
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
    })

    it('will return false for on-site item failing location check', function () {
      item.holdingLocation[0].id = 'loc:rc'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })

    it('will return false for on-site item failing status check', function () {
      item.status[0].id = 'status:co'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })

    it('will return false for on-site item failing catalogItemType check', function () {
      item.catalogItemType[0].id = 'catalogItemType:56'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })

    it('will return false for on-site item failing accessMessage check', function () {
      item.accessMessage[0].id = 'accessMessage:2'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })

    it('will return true for on-site Schomburg if it\'s not microfilm', function () {
      item.holdingLocation[0].id = 'loc:scff2'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
    })

    it('will return false for microfilm', function () {
      item.catalogItemType[0].id = 'catalogItemType:6'
      item.holdingLocation[0].id = 'loc:mabm2'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })

    it('will return false for on-site item that lacks a barcode', function () {
      // Remove barcode identifier:
      item.identifier = item.identifier.filter((value) => !/^urn:barcode:/.test(value))
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(false)
    })
  })
  describe('deliveryLocationsByM2CustomerCode', () => {
    if (process.env.NYPL_CORE_VERSION && process.env.NYPL_CORE_VERSION.includes('rom-com')) {
      it('returns undefined for unrequestable code', () =>
        expect(DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode('XS')).to.equal(undefined)
      )
      it('return delivery location for requestable code', () => {
        expect(DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode('NH').length).to.not.equal(0)
      })
    }
  })
<<<<<<< HEAD

<<<<<<< HEAD
  describe('resolveDeliveryLocations', () => {
    if (process.env.NYPL_CORE_VERSION && process.env.NYPL_CORE_VERSION.includes('rom-com')) {
=======
  describe('attachDeliveryLocationsAndEddRequestability - romcom', () => {
    before(takeThisPartyPartiallyOffline)
    const requestableM2Location = 'map92'
    const requestableM1Location = 'map82'
    const nonrequestableM2Location = 'mab92'
    if (process.env.NYPL_CORE_VERSION && process.env.NYPL_CORE_VERSION.includes('romcom-2.0')) {
      it('will return delivery locations for an requestable M1 item', function () {
        const items = [{
          uri: 'b123',
          holdingLocation: [{ id: requestableM1Location }]
        }]
        return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability(items).then((items) => {
          expect(items[0].deliveryLocation).to.not.be.empty
        })
      })
>>>>>>> parent of 9c606d0... change conditional nypl_core_version check
      it('returns delivery locations for requestable M2 items', () => {
        const items = [{ uri: 'b123', m2CustomerCode: [ 'XA' ] }]
        return DeliveryLocationsResolver
          .resolveDeliveryLocations(items, ['Research'])
          .then((deliveryLocations) => {
            expect(deliveryLocations).to.deep.equal([
              {
                eddRequestable: false,
                m2CustomerCode: ['XA'],
                deliveryLocation: [
                  {id: 'loc:mab', label: 'Schwarzman Building - Art & Architecture Room 300'},
                  {id: 'loc:maf', label: 'Schwarzman Building - Dorot Jewish Division Room 111'},
                  {id: 'loc:mal', label: 'Schwarzman Building - Main Reading Room 315'},
                  {id: 'loc:map', label: 'Schwarzman Building - Map Division Room 117'},
                  {id: 'loc:mag', label: 'Schwarzman Building - Milstein Division Room 121'}
                ],
                uri: 'b123'
              }
            ])
          })
      })

<<<<<<< HEAD
=======
      it('returns no delivery locations for nonrequestable M2 holding locations', () => {
        const items = [{
          uri: 'b123',
          // requestable m2 code
          m2CustomerCode: ['XA'],
          // non requestable holding location overrides requestable m2 code
          holdingLocation: [{ id: nonrequestableM2Location }]
        }]
        return DeliveryLocationsResolver
          .attachDeliveryLocationsAndEddRequestability(items, ['Research'])
          .then((items) => {
            expect(items[0].deliveryLocation).to.be.empty
          })
      })

>>>>>>> parent of dd48ea7... update package-lock
      it('returns scholar delivery locations for requestable M2 items when Scholar rooms requested', () => {
        const items = [{ uri: 'b123', m2CustomerCode: [ 'XA' ] }]
        return DeliveryLocationsResolver
          .resolveDeliveryLocations(items, ['Research', 'Scholar'])
          .then((deliveryLocations) => {
            expect(deliveryLocations[0].deliveryLocation).to.deep.include.members([
              {id: 'loc:mab', label: 'Schwarzman Building - Art & Architecture Room 300'},
              {id: 'loc:maf', label: 'Schwarzman Building - Dorot Jewish Division Room 111'},
              {id: 'loc:mal', label: 'Schwarzman Building - Main Reading Room 315'},
              {id: 'loc:map', label: 'Schwarzman Building - Map Division Room 117'},
              {id: 'loc:mag', label: 'Schwarzman Building - Milstein Division Room 121'},
              {id: 'loc:maln', label: 'Schwarzman Building - Noma Scholar Room'},
              {id: 'loc:malw', label: 'Schwarzman Building - Wertheim Scholar Room'},
              {id: 'loc:mala', label: 'Schwarzman Building - Allen Scholar Room'},
              {id: 'loc:malc', label: 'Schwarzman Building - Cullman Center'}
            ])
          })
      })

      it('returns no delivery locations for non-requestable M2 customer codes', () => {
        const items = [{ uri: 'b123', m2CustomerCode: [ 'XS' ] }]
        return DeliveryLocationsResolver
          .resolveDeliveryLocations(items, ['Research', 'Scholar'])
          .then((deliveryLocations) => {
            expect(deliveryLocations.deliveryLocation).to.equal(undefined)
          })
      })
    }
  })
=======
>>>>>>> parent of d1eee90... Merge branch 'main' into production
})
