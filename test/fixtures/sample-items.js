module.exports = {
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
