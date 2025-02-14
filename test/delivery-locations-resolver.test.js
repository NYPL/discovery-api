const sinon = require('sinon')

const DeliveryLocationsResolver = require('../lib/delivery-locations-resolver')

const sampleItems = {
  onsiteOnlySchomburg:
  {
    '@id': 'res:i11982421',
    '@type': [
      'bf:Item'
    ],
    holdingLocation: [
      {
        id: 'loc:scff2',
        prefLabel: 'Schomburg Center - Research & Reference - Desk'
      }
    ],
    idBarcode: [
      '33433036951154'
    ],
    identifier: [
      {
        '@type': 'bf:ShelfMark',
        '@value': 'Sc Micro F-1843'
      },
      {
        '@type': 'bf:Barcode',
        '@value': '33433036951154'
      }
    ],
    specRequestable: false,
    status: [
      {
        '@id': 'status:a',
        prefLabel: 'Available'
      }
    ],
    uri: 'i11982421'
  },
  onsiteNypl: {
    identifier: [
      'urn:bnum:b11995345',
      'urn:bnum:b11995322',
      'urn:barcode:33433036864449'
    ],
    uri: 'i12227153',
    holdingLocation: [
      {
        id: 'loc:scf',
        label: 'Schomburg Center - Research & Reference'
      }
    ],
    accessMessage: [
      { label: 'Use in library', id: 'accessMessage:1' }
    ],
    catalogItemType: [
      { label: 'book, limited circ, MaRLI', id: 'catalogItemType:55' }
    ],
    status: [
      { label: 'Available ', id: 'status:a' }
    ]
  },
  offsiteNypl: {
    identifier: [
      'urn:bnum:pb176961',
      'urn:bnum:b11995345',
      'urn:barcode:33433047331719'
    ],
    uri: 'i14211097',
    holdingLocation: [
      {
        id: 'loc:rcpm2',
        label: 'OFFSITE - Request in Advance for use at Performing Arts'
      }
    ]
  },
  pul: {
    identifier: [
      'urn:bnum:pb176961',
      'urn:barcode:32101062243553'
    ],
    uri: 'pi189241'
  },
  cul: {
    identifier: [
      'urn:bnum:cb1014551',
      'urn:barcode:CU56521537'
    ],
    uri: 'ci9876'
  },
  offsiteNyplDeliverableToScholarRooms: {
    identifier: [
      'urn:bnum:b11995155',
      'urn:barcode:33433011759648'
    ],
    holdingLocation: [
      {
        id: 'loc:rcpm2',
        label: 'OFFSITE - Request in Advance for use at Performing Arts'
      }
    ],
    uri: 'i10483065'
  },
  fakeNYPLMapDivisionItem: {
    identifier: [
      'urn:barcode:made-up-barcode-that-recap-says-belongs-to-ND'
    ],
    uri: 'i7654'
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

describe('Delivery-locations-resolver', function () {
  before(() => {
    // Reroute HTC API requests mapping specific barcodes tested above to recap customer codes:
    sinon.stub(DeliveryLocationsResolver, '__recapCustomerCodesByBarcodes').callsFake((barcodes) => {
      const stubbedLookups = {
        'recap-barcode-for-pj': 'PJ',
        33433047331719: 'NP',
        32101062243553: 'PA',
        CU56521537: 'CU',
        33433011759648: 'NA',
        // Let's pretend this is a valid NYPL Map Division item barcode
        // and let's further pretend that HTC API tells us it's recap customer code is ND
        'made-up-barcode-that-recap-says-belongs-to-ND': 'ND'
      }

      // Return hash containing only requested barcodes:
      return Promise.resolve(
        barcodes.reduce((h, barcode) => {
          h[barcode] = stubbedLookups[barcode]
          return h
        }, {})
      )
    })
  })

  after(() => {
    DeliveryLocationsResolver.__recapCustomerCodesByBarcodes.restore()
  })

  describe('SC delivery locations', () => {
    before(() => {
      // Override NYPL-Core lookup for scff3 to make it requestable:
      sinon.stub(DeliveryLocationsResolver, 'nyplCoreLocation').callsFake(() => {
        return {
          sierraDeliveryLocations: [
            {
              code: 'sc',
              label: 'Schomburg Center - Research and Reference Division',
              locationsApiSlug: 'schomburg',
              deliveryLocationTypes: ['Research']
            }
          ],
          requestable: true
        }
      })
    })

    after(() => {
      DeliveryLocationsResolver.nyplCoreLocation.restore()
    })

    it('will hide "Scholar" deliveryLocation for LPA or SC only deliverable items, patron is scholar type', function () {
      return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.onsiteOnlySchomburg], 'mala').then((items) => {
        expect(items[0].deliveryLocation).to.not.have.lengthOf(0)

        // Confirm the known scholar rooms are not included:
        scholarRooms.forEach((scholarRoom) => {
          expect(items[0].deliveryLocation).to.not.include(scholarRoom)
        })
      })
    })
  })

  it('will return empty delivery locations for an unrequestable onsite location code', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].deliveryLocation).to.have.lengthOf(0)
    })
  })

  it('will set eddRequestable to true for a specific onsite NYPL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.onsiteNypl]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will ammend the deliveryLocation property for an offsite NYPL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.offsiteNypl]).then((items) => {
      expect(items[0].deliveryLocation).to.not.have.lengthOf(0)
    })
  })

  it('will set eddRequestable to true for a specific offsite NYPL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.offsiteNypl]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will ammend the deliveryLocation property for a PUL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.pul]).then((items) => {
      expect(items[0].deliveryLocation).to.not.have.lengthOf(0)
    })
  })

  it('will set eddRequestable to true for a specific PUL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.pul]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will set eddRequestable to true for a specific CUL item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.cul]).then((items) => {
      expect(items[0].eddRequestable).to.equal(true)
    })
  })

  it('will set eddRequestable to false for a fake Map Division item', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.fakeNYPLMapDivisionItem]).then((items) => {
      expect(items[0].eddRequestable).to.equal(false)
    })
  })

  it('will hide "Scholar" deliveryLocation for non-scholars', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.offsiteNyplDeliverableToScholarRooms]).then((items) => {
      expect(items[0].deliveryLocation).to.not.have.lengthOf(0)

      // Confirm the known scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation).to.not.include(scholarRoom)
      })
    })
  })

  it('will serve deliveryLocations if item holdingLocation is requestable', function () {
    // At writing, this sierra location (rcpm2) is marked requestable: true
    const offsiteItemInNonRequestableLocation = sampleItems.offsiteNypl

    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([offsiteItemInNonRequestableLocation])
      .then((items) => {
        expect(items[0].deliveryLocation).to.be.a('array')
        expect(items[0].deliveryLocation).to.have.lengthOf(1)
      })
  })

  it('will hide deliveryLocations if item holdingLocation is not requestable', function () {
    const offsiteItemInNonRequestableLocation = JSON.parse(JSON.stringify(sampleItems.offsiteNypl))
    // At writing, this sierra location is marked requestable: false
    offsiteItemInNonRequestableLocation.holdingLocation[0].id = 'loc:rccd8'

    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([offsiteItemInNonRequestableLocation])
      .then((items) => {
        expect(items[0].deliveryLocation).to.be.a('array')
        expect(items[0].deliveryLocation).to.have.lengthOf(0)
      })
  })

  it('will reveal specific scholar room deliveryLocation when specified', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.offsiteNyplDeliverableToScholarRooms], 'mal17').then((items) => {
      expect(items[0].deliveryLocation).to.not.have.lengthOf(0)

      // Confirm the non specified scholar rooms are not included:
      scholarRooms.forEach((scholarRoom) => {
        if (scholarRoom.id !== 'loc:mal17') {
          expect(items[0].deliveryLocation.map((location) => location.id)).not.to.include(scholarRoom.id)
        }
      })
    })
  })

  it('will hide "Scholar" deliveryLocations for scholars with no specific scholar room', function () {
    return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([sampleItems.offsiteNyplDeliverableToScholarRooms]).then((items) => {
      expect(items[0].deliveryLocation).to.not.have.lengthOf(0)

      // Confirm that all scholar rooms are included:
      scholarRooms.forEach((scholarRoom) => {
        expect(items[0].deliveryLocation.map((location) => location.id)).not.to.include(scholarRoom.id)
      })
    })
  })

  describe('eddRequestableByOnSiteCriteria', function () {
    let item

    beforeEach(function () {
      item = {
        identifier: [
          'urn:bnum:b11995345',
          'urn:bnum:b11995322',
          'urn:barcode:33433036864449'
        ],
        uri: 'i12227153',
        holdingLocation: [
          {
            id: 'loc:scff2',
            label: 'Schomburg Center - Research & Reference'
          }
        ],
        accessMessage: [
          { label: 'Use in library', id: 'accessMessage:1' }
        ],
        catalogItemType: [
          { label: 'book, limited circ, MaRLI', id: 'catalogItemType:55' }
        ],
        status: [
          { label: 'Available ', id: 'status:a' }
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

    it('will return true for on-site item failing status check', function () {
      item.status[0].id = 'status:na'
      expect(DeliveryLocationsResolver.eddRequestableByOnSiteCriteria(item)).to.equal(true)
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
    const unrequestableM2CustomerCode = 'EM'
    it('returns undefined for unrequestable code', () =>
      expect(DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode(unrequestableM2CustomerCode)).to.equal(undefined)
    )
    it('return delivery location for requestable code', () => {
      expect(DeliveryLocationsResolver.deliveryLocationsByM2CustomerCode('NH').length).to.not.equal(0)
    })
  })

  describe('attachDeliveryLocationsAndEddRequestability - romcom', () => {
    const requestableM2Location = 'map92'
    const requestableM1Location = 'map82'
    const nonrequestableM2Location = 'ccj92'
    const unrequestableM2CustomerCode = 'EM'

    it('will return delivery locations for an requestable M1 item', function () {
      const items = [{
        uri: 'b123',
        holdingLocation: [{ id: requestableM1Location }]
      }]
      return DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability(items).then((items) => {
        expect(items[0].deliveryLocation).to.not.have.lengthOf(0)
      })
    })

    it('returns delivery locations for requestable M2 items', () => {
      const items = [{
        uri: 'b123',
        m2CustomerCode: ['XA'],
        holdingLocation: [{ id: requestableM2Location }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((items) => {
          expect(items[0].deliveryLocation).to.deep.equal([
            { id: 'loc:mal', label: 'Schwarzman Building - Main Reading Room 315', sortPosition: 1 },
            { id: 'loc:mab', label: 'Schwarzman Building - Art & Architecture Room 300', sortPosition: 2 },
            { id: 'loc:maf', label: 'Schwarzman Building - Dorot Jewish Division Room 111', sortPosition: 2 },
            { id: 'loc:map', label: 'Schwarzman Building - Map Division Room 117', sortPosition: 2 },
            { id: 'loc:mag', label: 'Schwarzman Building - Milstein Division Room 121', sortPosition: 2 }
          ])
        })
    })

    it('returns no delivery locations for nonrequestable M2 holding locations', () => {
      const items = [{
        uri: 'b123',
        // requestable m2 code
        m2CustomerCode: [unrequestableM2CustomerCode],
        // non requestable holding location overrides requestable m2 code
        holdingLocation: [{ id: nonrequestableM2Location }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((items) => {
          expect(items[0].deliveryLocation).to.have.lengthOf(0)
        })
    })

    it('returns no delivery locations for item with requestable M2 holding locations but no m2 code', () => {
      const items = [{
        uri: 'b123',
        // non requestable holding location overrides requestable m2 code
        holdingLocation: [{ id: requestableM2Location }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((items) => {
          expect(items[0].deliveryLocation).to.have.lengthOf(0)
        })
    })

    it('returns scholar delivery locations for requestable M2 items when scholar room is provided', () => {
      const items = [{
        uri: 'b123',
        m2CustomerCode: ['XA'],
        holdingLocation: [{ id: requestableM2Location }]
      }]
      const scholarRoom = 'malc'
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items, scholarRoom)
        .then((items) => {
          expect(items[0].deliveryLocation).to.deep.include.members([
            { id: 'loc:malc', label: 'Schwarzman Building - Cullman Center', sortPosition: 0 },
            { id: 'loc:mal', label: 'Schwarzman Building - Main Reading Room 315', sortPosition: 1 },
            { id: 'loc:mab', label: 'Schwarzman Building - Art & Architecture Room 300', sortPosition: 2 },
            { id: 'loc:maf', label: 'Schwarzman Building - Dorot Jewish Division Room 111', sortPosition: 2 },
            { id: 'loc:map', label: 'Schwarzman Building - Map Division Room 117', sortPosition: 2 },
            { id: 'loc:mag', label: 'Schwarzman Building - Milstein Division Room 121', sortPosition: 2 }
          ])
        })
    })

    it('returns no delivery locations for non-requestable M2 customer codes', () => {
      const items = [{
        uri: 'b123',
        m2CustomerCode: [unrequestableM2CustomerCode],
        holdingLocation: [{ id: requestableM2Location }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((deliveryLocations) => {
          expect(deliveryLocations[0].deliveryLocation).to.deep.equal([])
        })
    })
    it('returns no delivery locations for non-existant M2 customer codes', () => {
      const items = [{
        uri: 'b123',
        m2CustomerCode: ['xxx'],
        holdingLocation: [{ id: requestableM2Location }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((deliveryLocations) => {
          expect(deliveryLocations[0].deliveryLocation).to.deep.equal([])
        })
    })
    it('returns no delivery locations for fake holding location', () => {
      const items = [{
        uri: 'b123',
        holdingLocation: [{ id: 'fake' }]
      }]
      return DeliveryLocationsResolver
        .attachDeliveryLocationsAndEddRequestability(items)
        .then((deliveryLocations) => {
          expect(deliveryLocations[0].deliveryLocation).to.deep.equal([])
        })
    })
    it('returns null for item with recap code with no sierra delivery locations', () => {
      const item = {
        holdingLocation: [{ id: 'rc2ma' }],
        identifier: [
          'urn:bnum:b11995345',
          'urn:barcode:recap-code-for-pj'
        ],
        uri: 'b11995345'
      }
      expect(DeliveryLocationsResolver.attachDeliveryLocationsAndEddRequestability([item])
        .then((items) => {
          expect(items[0].deliveryLocation).to.deep.equal([])
        }))
    })
  })
  describe('requestableBasedOnHoldingLocation', function () {
    // These expectations rely on the requestability of these locations being
    // somewhat static, which has been generally true
    it('identifies a non-requestable location', function () {
      expect(
        DeliveryLocationsResolver.requestableBasedOnHoldingLocation({
          holdingLocation: [{ id: 'loc:rccd8' }]
        })
      ).to.equal(false)
    })
    it('identifies a requestable location', function () {
      expect(
        DeliveryLocationsResolver.requestableBasedOnHoldingLocation({
          holdingLocation: [{ id: 'loc:rcpm2' }]
        })
      ).to.equal(true)
    })
  })
  describe('getRecapDeliveryInfo', function () {
    it('returns empty deliveryLocation and eddRequestable false based on holding location when missing recapCustomerCode', function () {
      const resolved = DeliveryLocationsResolver.getRecapDeliveryInfo({
        holdingLocation: [{ id: 'loc:rccd8' }],
        uri: 'i14747243'
      })
      expect(resolved.deliveryLocation.length).to.equal(0)
      expect(resolved.eddRequestable).to.equal(false)
    })

    it('returns empty string delivery location and eddRequestable true based on holding location when missing recapCustomerCode', function () {
      const resolved = DeliveryLocationsResolver.getRecapDeliveryInfo({
        holdingLocation: [{ id: 'loc:rcpm2' }],
        uri: 'i14747243'
      })
      expect(resolved.deliveryLocation.length).to.equal(1)
      expect(resolved.deliveryLocation[0]).to.equal('')
      expect(resolved.eddRequestable).to.equal(true)
    })
  })
})
