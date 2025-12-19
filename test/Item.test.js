const sinon = require('sinon')
const scsbClient = require('../lib/scsb-client')
const sampleItems = require('./fixtures/sample-items')

const Item = require('../lib/models/Item')

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

describe('attachDeliveryLocationsAndEddRequestability', async function () {
  before(() => {
    // Reroute HTC API requests mapping specific barcodes tested above to recap customer codes:
    sinon.stub(scsbClient, 'recapCustomerCodeByBarcode').callsFake((barcode) => {
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
      // Return requested barcodes:
      return Promise.resolve(stubbedLookups[barcode]
      )
    })
  })

  after(() => {
    scsbClient.recapCustomerCodeByBarcode.restore()
  })

  describe('attachDeliveryLocationsAndEddRequestability - romcom', () => {
    const requestableM2Location = 'map92'
    const requestableM1Location = 'map82'
    const nonrequestableM2Location = 'ccj92'
    const unrequestableM2CustomerCode = 'EM'

    it('will return delivery locations for an requestable M1 item', function () {
      const item = {
        uri: 'b123',
        holdingLocation: [{ id: requestableM1Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item).then((item) => {
        expect(item.deliveryLocation).to.not.have.lengthOf(0)
      })
    })

    it('returns delivery locations for requestable M2 items', () => {
      const item = {
        uri: 'b123',
        m2CustomerCode: ['XA'],
        holdingLocation: [{ id: requestableM2Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.equal([
            { id: 'loc:mal', label: 'Schwarzman Building - Main Reading Room 315', sortPosition: 1 },
            { id: 'loc:mab', label: 'Schwarzman Building - Art & Architecture Room 300', sortPosition: 2 },
            { id: 'loc:maf', label: 'Schwarzman Building - Dorot Jewish Division Room 111', sortPosition: 2 },
            { id: 'loc:map', label: 'Schwarzman Building - Map Division Room 117', sortPosition: 2 },
            { id: 'loc:mag', label: 'Schwarzman Building - Milstein Division Room 121', sortPosition: 2 }
          ])
        })
    })

    it('returns no delivery locations for nonrequestable M2 holding locations', () => {
      const item = {
        uri: 'b123',
        // requestable m2 code
        m2CustomerCode: [unrequestableM2CustomerCode],
        // non requestable holding location overrides requestable m2 code
        holdingLocation: [{ id: nonrequestableM2Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.have.lengthOf(0)
        })
    })

    it('returns no delivery locations for item with requestable M2 holding locations but no m2 code', () => {
      const item = {
        uri: 'b123',
        // non requestable holding location overrides requestable m2 code
        holdingLocation: [{ id: requestableM2Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.have.lengthOf(0)
        })
    })

    it('returns scholar delivery locations for requestable M2 items when scholar room is provided', () => {
      const item = {
        uri: 'b123',
        m2CustomerCode: ['XA'],
        holdingLocation: [{ id: requestableM2Location }]
      }
      const scholarRoom = 'malc'
      return Item.withDeliveryLocationsByBarcode(item, scholarRoom)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.include.members([
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
      const item = {
        uri: 'b123',
        m2CustomerCode: [unrequestableM2CustomerCode],
        holdingLocation: [{ id: requestableM2Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.equal([])
        })
    })
    it('returns no delivery locations for non-existant M2 customer codes', () => {
      const item = {
        uri: 'b123',
        m2CustomerCode: ['xxx'],
        holdingLocation: [{ id: requestableM2Location }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.equal([])
        })
    })
    it('returns no delivery locations for fake holding location', () => {
      const item = {
        uri: 'b123',
        holdingLocation: [{ id: 'fake' }]
      }
      return Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.equal([])
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
      expect(Item.withDeliveryLocationsByBarcode(item)
        .then((item) => {
          expect(item.deliveryLocation).to.deep.equal([])
        }))
    })
  })

  it('will hide "Scholar" deliveryLocation for LPA or SC only deliverable items, patron is scholar type', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.onsiteOnlySchomburg, 'mala')
    expect(item.deliveryLocation).to.not.have.lengthOf(0)

    // Confirm the known scholar rooms are not included:
    scholarRooms.forEach((scholarRoom) => {
      expect(item.deliveryLocation).to.not.include(scholarRoom)
    })
  })

  it('will return empty delivery locations for an unrequestable onsite location code', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.onsiteNypl)
    expect(item.deliveryLocation).to.have.lengthOf(0)
  })

  it('will set eddRequestable to true for a specific onsite NYPL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.onsiteNypl)
    expect(item.eddRequestable).to.equal(true)
  })

  it('will amend the deliveryLocation property for an offsite NYPL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.offsiteNypl)
    expect(item.deliveryLocation).to.not.have.lengthOf(0)
  })

  it('will set eddRequestable to true for a specific offsite NYPL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.offsiteNypl)
    expect(item.eddRequestable).to.equal(true)
  })

  it('will add delivery locations for a PUL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.pul)
    expect(item.deliveryLocation).to.not.have.lengthOf(0)
  })

  it('will set eddRequestable to true for a specific PUL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.pul)
    expect(item.eddRequestable).to.equal(true)
  })

  it('will set eddRequestable to true for a specific CUL item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.cul)
    expect(item.eddRequestable).to.equal(true)
  })

  it('will set eddRequestable to false for a fake Map Division item', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.fakeNYPLMapDivisionItem)
    expect(item.eddRequestable).to.equal(false)
  })

  it('will hide "Scholar" deliveryLocation for non-scholars', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.offsiteNyplDeliverableToScholarRooms)
    expect(item.deliveryLocation).to.not.have.lengthOf(0)

    // Confirm the known scholar rooms are not included:
    scholarRooms.forEach((scholarRoom) => {
      expect(item.deliveryLocation).to.not.include(scholarRoom)
    })
  })

  it('will serve deliveryLocations if item holdingLocation is requestable', async function () {
    // At writing, this sierra location (rcpm2) is marked requestable: true
    const offsiteItemInNonRequestableLocation = sampleItems.offsiteNypl

    const item = await Item.withDeliveryLocationsByBarcode(offsiteItemInNonRequestableLocation)
    expect(item.deliveryLocation).to.be.a('array')
    expect(item.deliveryLocation).to.have.lengthOf(1)
  })

  it('will hide deliveryLocations if item holdingLocation is not requestable', async function () {
    const offsiteItemInNonRequestableLocation = JSON.parse(JSON.stringify(sampleItems.offsiteNypl))
    // At writing, this sierra location is marked requestable: false
    offsiteItemInNonRequestableLocation.holdingLocation[0].id = 'loc:rccd8'

    const item = Item.withDeliveryLocationsByBarcode(offsiteItemInNonRequestableLocation)
    expect(item.deliveryLocation).to.equal(undefined)
  })

  it('will reveal specific scholar room deliveryLocation when specified', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.offsiteNyplDeliverableToScholarRooms)
    expect(item.deliveryLocation).to.not.have.lengthOf(0)

    // Confirm the non specified scholar rooms are not included:
    scholarRooms.forEach((scholarRoom) => {
      if (scholarRoom.id !== 'loc:mal17') {
        expect(item.deliveryLocation.map((location) => location.id)).not.to.include(scholarRoom.id)
      }
    })
  })

  it('will hide "Scholar" deliveryLocations for scholars with no specific scholar room', async function () {
    const item = await Item.withDeliveryLocationsByBarcode(sampleItems.offsiteNyplDeliverableToScholarRooms)
    expect(item.deliveryLocation).to.not.have.lengthOf(0)
    // Confirm that all scholar rooms are included:
    scholarRooms.forEach((scholarRoom) => {
      expect(item.deliveryLocation.map((location) => location.id)).not.to.include(scholarRoom.id)
    })
  })
})
