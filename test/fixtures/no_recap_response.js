exports.fakeElasticSearchResponseNyplItem = () => {
  return {
    '_shards': {
      'failed': 0,
      'successful': 1,
      'total': 1
    },
    'took': 1,
    'hits': {
      'total': 1,
      'max_score': 1.3862944,
      'hits': [
        {
          '_id': 'b10980129',
          '_source': {
            'numItems': [
              4
            ],
            'createdString': [
              '1989'
            ],
            'issuance': [
              {
                'label': 'monograph/item',
                'id': 'urn:biblevel:m'
              }
            ],
            'creatorLiteral': [
              'Maḥfūẓ, Najīb, 1911-2006.'
            ],
            'creator_sort': [
              'maḥfūẓ, najīb, 1911-2006.'
            ],
            'level': 'debug',
            'items': [
              {
                'uri': 'i22566485',
                'identifier': [
                  'urn:barcode:33433058338470'
                ],
                'status': [
                  {
                    'label': 'Available',
                    'id': 'status:a'
                  }
                ]
              },
              {
                'uri': 'i22566489'
              },
              {
                'holdingLocation_packed': [
                  'loc:scff2||Schomburg Center - Research & Reference'
                ],
                'suppressed': [
                  false
                ],
                'shelfMark': [
                  'Sc D 90-863'
                ],
                'accessMessage_packed': [
                  'accessMessage:1||USE IN LIBRARY'
                ],
                'uri': 'i10283665',
                'accessMessage': [
                  {
                    'label': 'USE IN LIBRARY',
                    'id': 'accessMessage:1'
                  }
                ],
                'catalogItemType': [
                  {
                    'id': 'catalogItemType:2',
                    'label': 'book non-circ'
                  }
                ],
                'deliveryLocation_packed': [
                  'loc:sc||Schomburg Center'
                ],
                'owner': [
                  {
                    'label': 'Schomburg Center for Research in Black Culture, Jean Blackwell Hutson Research and Reference Division',
                    'id': 'orgs:1114'
                  }
                ],
                'deliveryLocation': [
                  {
                    'label': 'Schomburg Center',
                    'id': 'loc:sc'
                  }
                ],
                'identifier': [
                  'urn:barcode:32101071572406'
                ],
                'requestable': [
                  true
                ],
                'owner_packed': [
                  'orgs:1114||Schomburg Center for Research in Black Culture, Jean Blackwell Hutson Research and Reference Division'
                ],
                'status': [
                  {
                    'label': 'Available',
                    'id': 'status:a'
                  }
                ],
                'holdingLocation': [
                  {
                    'label': 'Schomburg Center - Research & Reference',
                    'id': 'loc:scff2'
                  }
                ],
                'status_packed': [
                  'status:a||Available'
                ]
              },
              {
                'holdingLocation_packed': [
                  'loc:scff2||Schomburg Center - Research & Reference'
                ],
                'suppressed': [
                  false
                ],
                'shelfMark': [
                  'Sc D 90-863'
                ],
                'accessMessage_packed': [
                  'accessMessage:1||USE IN LIBRARY'
                ],
                'uri': 'i10283665777',
                'accessMessage': [
                  {
                    'label': 'USE IN LIBRARY',
                    'id': 'accessMessage:1'
                  }
                ],
                'catalogItemType': [
                  {
                    'id': 'catalogItemType:2',
                    'label': 'book non-circ'
                  }
                ],
                'deliveryLocation_packed': [
                  'loc:sc||Schomburg Center'
                ],
                'owner': [
                  {
                    'label': 'Schomburg Center for Research in Black Culture, Jean Blackwell Hutson Research and Reference Division',
                    'id': 'orgs:1114'
                  }
                ],
                'deliveryLocation': [
                  {
                    'label': 'Schomburg Center',
                    'id': 'loc:sc'
                  }
                ],
                'identifier': [
                  'urn:barcode:32101071572406777'
                ],
                'requestable': [
                  true
                ],
                'owner_packed': [
                  'orgs:1114||Schomburg Center for Research in Black Culture, Jean Blackwell Hutson Research and Reference Division'
                ],
                'status': [
                  {
                    'label': 'Not Available',
                    'id': 'status:na'
                  }
                ],
                'holdingLocation': [
                  {
                    'label': 'Schomburg Center - Research & Reference',
                    'id': 'loc:scff2'
                  }
                ],
                'status_packed': [
                  'status:na||Not Available'
                ]
              },
              {
                'holdingLocation': [
                  {
                    'label': 'OFFSITE - Request in Advance',
                    'id': 'loc:rc2ma'
                  }
                ],
                'status_packed': [
                  'status:na||Not Available'
                ],
                'owner': [
                  {
                    'id': 'orgs:1000',
                    'label': 'Stephen A. Schwarzman Building'
                  }
                ],
                'deliveryLocation': [
                  {
                    'id': 'loc:mala',
                    'label': 'SASB - Allen Scholar Room'
                  }
                ],
                'deliveryLocation_packed': [
                  'loc:mala||SASB - Allen Scholar Room'
                ],
                'uri': 'i10283664',
                'accessMessage_packed': [
                  'accessMessage:2||ADV REQUEST'
                ],
                'accessMessage': [
                  {
                    'id': 'accessMessage:2',
                    'label': 'ADV REQUEST'
                  }
                ],
                'status': [
                  {
                    'id': 'status:na',
                    'label': 'Not available'
                  }
                ],
                'owner_packed': [
                  'orgs:1000||Stephen A. Schwarzman Building'
                ],
                'requestable': [
                  false
                ],
                'identifier': [
                  'urn:barcode:1000546836'
                ],
                'holdingLocation_packed': [
                  'loc:rc2ma||OFFSITE - Request in Advance'
                ],
                'shelfMark': [
                  '*OFC 90-2649'
                ],
                'suppressed': [
                  false
                ]
              },
              {
                'holdingLocation': [
                  {
                    'label': 'OFFSITE - Request in Advance',
                    'id': 'loc:rc2ma'
                  }
                ],
                'status_packed': [
                  'status:a||Available'
                ],
                'owner': [
                  {
                    'id': 'orgs:1000',
                    'label': 'Stephen A. Schwarzman Building'
                  }
                ],
                'deliveryLocation': [
                  {
                    'id': 'loc:mala',
                    'label': 'SASB - Allen Scholar Room'
                  }
                ],
                'deliveryLocation_packed': [
                  'loc:mala||SASB - Allen Scholar Room'
                ],
                'uri': 'i102836649',
                'recapCustomerCode': [],
                'accessMessage_packed': [
                  'accessMessage:2||ADV REQUEST'
                ],
                'accessMessage': [
                  {
                    'id': 'accessMessage:2',
                    'label': 'ADV REQUEST'
                  }
                ],
                'status': [
                  {
                    'id': 'status:a',
                    'label': 'Available'
                  }
                ],
                'owner_packed': [
                  'orgs:1000||Stephen A. Schwarzman Building'
                ],
                'requestable': [
                  false
                ],
                'identifier': [
                  'urn:barcode:10005468369'
                ],
                'holdingLocation_packed': [
                  'loc:rc2ma||OFFSITE - Request in Advance'
                ],
                'shelfMark': [
                  '*OFC 90-2649 2'
                ],
                'suppressed': [
                  false
                ]
              },
              {
                'holdingLocation': [
                  {
                    'label': 'OFFSITE - Request in Advance',
                    'id': 'loc:dya0f'
                  }
                ],
                'status_packed': [
                  'status:a||Available'
                ],
                'owner': [
                  {
                    'id': 'orgs:1000',
                    'label': 'Stephen A. Schwarzman Building'
                  }
                ],
                'deliveryLocation': [
                  {
                    'id': 'loc:mala',
                    'label': 'SASB - Allen Scholar Room'
                  }
                ],
                'deliveryLocation_packed': [
                  'loc:mala||SASB - Allen Scholar Room'
                ],
                'uri': 'i102836659',
                'recapCustomerCode': [],
                'accessMessage_packed': [
                  'accessMessage:2||ADV REQUEST'
                ],
                'accessMessage': [
                  {
                    'id': 'accessMessage:2',
                    'label': 'ADV REQUEST'
                  }
                ],
                'status': [
                  {
                    'id': 'status:a',
                    'label': 'Available'
                  }
                ],
                'owner_packed': [
                  'orgs:1000||Stephen A. Schwarzman Building'
                ],
                'requestable': [
                  false
                ],
                'identifier': [
                  'urn:barcode:10005468369'
                ],
                'holdingLocation_packed': [
                  'loc:dya0f||OFFSITE - Request in Advance'
                ],
                'shelfMark': [
                  '*OFC 90-2649 2'
                ],
                'suppressed': [
                  false
                ]
              },
              {
                'holdingLocation': [
                  {
                    'label': 'OFFSITE - Request in Advance (unrequestable location)',
                    'id': 'loc:rcpd8'
                  }
                ],
                'status_packed': [
                  'status:a||Available'
                ],
                'owner': [
                  {
                    'id': 'orgs:1000',
                    'label': 'Stephen A. Schwarzman Building'
                  }
                ],
                'uri': 'i102836649-unrequestable',
                'accessMessage_packed': [
                  'accessMessage:2||ADV REQUEST'
                ],
                'accessMessage': [
                  {
                    'id': 'accessMessage:2',
                    'label': 'ADV REQUEST'
                  }
                ],
                'status': [
                  {
                    'id': 'status:a',
                    'label': 'Available'
                  }
                ],
                'owner_packed': [
                  'orgs:1000||Stephen A. Schwarzman Building'
                ],
                'requestable': [
                  false
                ],
                'identifier': [
                  'urn:barcode:10005468369'
                ],
                'holdingLocation_packed': [
                  'loc:rcpd8||OFFSITE - Request in Advance'
                ],
                'shelfMark': [
                  '*OFC 90-2649 2'
                ],
                'suppressed': [
                  false
                ]
              }
            ],
            'message': 'ResourceSerializer#serialize',
            'materialType_packed': [
              'resourcetypes:txt||Text'
            ],
            'suppressed': [
              'false'
            ],
            'placeOfPublication': [
              'New York :'
            ],
            'dateEndString': [
              '1984'
            ],
            'title_sort': [
              'the thief and the dogs'
            ],
            'uris': [
              'b11293188',
              'b11293188-i22566485',
              'b11293188-i22566489',
              'b11293188-i10283665',
              'b11293188-i10283664'
            ],
            'language': [
              {
                'id': 'lang:eng',
                'label': 'English'
              }
            ],
            'dateString': [
              '1989'
            ],
            'identifier': [
              'urn:bnum:11293188',
              'urn:oclc:12248278',
              'urn:lcc:PJ7846.A46',
              'urn:lccCoarse:PJ7695.8-7976'
            ],
            'publisher': [
              'Doubleday,'
            ],
            'type': [
              'nypl:Item'
            ],
            'createdYear': [
              1989
            ],
            'contributor_sort': [
              'badawī, muḥammad muṣṭafá.'
            ],
            'materialType': [
              {
                'id': 'resourcetypes:txt',
                'label': 'Text'
              }
            ],
            'numAvailable': [
              2
            ],
            'dimensions': [
              '22 cm.'
            ],
            'carrierType_packed': [
              'carriertypes:nc||volume'
            ],
            'note': [
              'Translation of: al-Liṣṣ wa-al-kilāb.'
            ],
            'dateStartYear': [
              1989
            ],
            'shelfMark': [
              '*OFC 90-2649'
            ],
            'idOwi': [
              'urn:owi:58201773'
            ],
            'mediaType': [
              {
                'label': 'unmediated',
                'id': 'mediatypes:n'
              }
            ],
            'title': [
              'The thief and the dogs',
              'The thief and the dogs /'
            ],
            'titleAlt': [
              'Liṣṣ wa-al-kilāb.'
            ],
            'language_packed': [
              'lang:eng||English'
            ],
            'mediaType_packed': [
              'mediatypes:n||unmediated'
            ],
            'titleDisplay': [
              'The thief and the dogs / Naguib Mahfouz ; translated by Trevor Le Gassick, M.M. Badawi ; revised by John Rodenbeck.'
            ],
            'uri': 'b11293188',
            'extent': [
              '158 p. ;'
            ],
            'carrierType': [
              {
                'id': 'carriertypes:nc',
                'label': 'volume'
              }
            ],
            'issuance_packed': [
              'urn:biblevel:m||monograph/item'
            ],
            'contributorLiteral': [
              'Badawī, Muḥammad Muṣṭafá.',
              'Le Gassick, Trevor.',
              'Rodenbeck, John.'
            ],
            'dateEndYear': [
              1984
            ]
          },
          '_type': 'resource',
          '_index': 'resources-2017-06-13',
          '_score': 154.93451
        }
      ]
    },
    'timed_out': false
  }
}

exports.fakeElasticSearchResponseCulItem = () => {
  return {
    '_shards': {
      'failed': 0,
      'successful': 1,
      'total': 1
    },
    'took': 1,
    'hits': {
      'total': 1,
      'max_score': 1.3862944,
      'hits': [
        {
          '_type': 'resource',
          '_id': 'cb1000077',
          '_source': {
            'extent': [
              'iii, 332 leaves, bound.'
            ],
            'note': [
              {
                'noteType': 'Thesis',
                'label': 'Thesis (Ph. D.)--Columbia University, 1989.',
                'type': 'bf:Note'
              },
              {
                'noteType': 'Bibliography',
                'label': 'Includes bibliographical references (leaves 314-332).',
                'type': 'bf:Note'
              }
            ],
            'language': [
              {
                'label': 'English',
                'id': 'lang:eng'
              }
            ],
            'createdYear': [
              1989
            ],
            'title': [
              'Urbanism as a way of writing : Chicago urban sociology and Chicago urban literature, 1915-1945 / Carla Sofia Cappetti.'
            ],
            'type': [
              'nypl:Item'
            ],
            'createdString': [
              '1989'
            ],
            'creatorLiteral': [
              'Cappetti, Carla Sofia.'
            ],
            'materialType_packed': [
              'resourcetypes:txt||Text'
            ],
            'language_packed': [
              'lang:eng||English'
            ],
            'dateStartYear': [
              1989
            ],
            'identifierV2': [
              {
                'type': 'nypl:Bnumber',
                'value': '1000077'
              }
            ],
            'carrierType_packed': [
              'carriertypes:nc||volume'
            ],
            'creator_sort': [
              'cappetti, carla sofia.'
            ],
            'issuance_packed': [
              'urn:biblevel:m||monograph/item'
            ],
            'updatedAt': 1523471203726,
            'publicationStatement': [
              '1989.'
            ],
            'mediaType_packed': [
              'mediatypes:n||unmediated'
            ],
            'identifier': [
              'urn:bnum:1000077'
            ],
            'materialType': [
              {
                'label': 'Text',
                'id': 'resourcetypes:txt'
              }
            ],
            'carrierType': [
              {
                'label': 'volume',
                'id': 'carriertypes:nc'
              }
            ],
            'dateString': [
              '1989'
            ],
            'title_sort': [
              'urbanism as a way of writing : chicago urban sociology and chicago urban literat'
            ],
            'mediaType': [
              {
                'label': 'unmediated',
                'id': 'mediatypes:n'
              }
            ],
            'titleDisplay': [
              'Urbanism as a way of writing : Chicago urban sociology and Chicago urban literature, 1915-1945 / Carla Sofia Cappetti.'
            ],
            'uri': 'cb1000077',
            'numItems': [
              1
            ],
            'numAvailable': [
              1
            ],
            'uris': [
              'cb1000077',
              'cb1000077-ci1455504'
            ],
            'issuance': [
              {
                'label': 'monograph/item',
                'id': 'urn:biblevel:m'
              }
            ],
            'items': [
              {
                'owner': [
                  {
                    'label': 'Columbia University Libraries',
                    'id': 'orgs:0002'
                  }
                ],
                'accessMessage_packed': [
                  'accessMessage:1||Use in library'
                ],
                'identifier': [
                  'urn:barcode:1000020117'
                ],
                'catalogItemType_packed': [
                  'catalogItemType:1||non-circ'
                ],
                'accessMessage': [
                  {
                    'label': 'Use in library',
                    'id': 'accessMessage:1'
                  }
                ],
                'status_packed': [
                  'status:a||Available '
                ],
                'shelfMark': [
                  'LD1237.5D 1989 .C166'
                ],
                'uri': 'ci1455504',
                'recapCustomerCode': [],
                'identifierV2': [
                  {
                    'type': 'bf:ShelfMark',
                    'value': 'LD1237.5D 1989 .C166'
                  },
                  {
                    'type': 'bf:Barcode',
                    'value': '1000020117'
                  }
                ],
                'idBarcode': [
                  '1000020117'
                ],
                'owner_packed': [
                  'orgs:0002||Columbia University Libraries'
                ],
                'requestable': [
                  true
                ],
                'catalogItemType': [
                  {
                    'label': 'non-circ',
                    'id': 'catalogItemType:1'
                  }
                ],
                'status': [
                  {
                    'label': 'Available ',
                    'id': 'status:a'
                  }
                ]
              },
              {
                'owner': [
                  {
                    'label': 'Columbia University Libraries',
                    'id': 'orgs:0002'
                  }
                ],
                'accessMessage_packed': [
                  'accessMessage:1||Use in library'
                ],
                'identifier': [
                  'urn:barcode:10000201179999'
                ],
                'catalogItemType_packed': [
                  'catalogItemType:1||non-circ'
                ],
                'accessMessage': [
                  {
                    'label': 'Use in library',
                    'id': 'accessMessage:1'
                  }
                ],
                'status_packed': [
                  'status:a||Available '
                ],
                'shelfMark': [
                  'LD1237.5D 1989 .C166 9999'
                ],
                'uri': 'ci14555049999',
                'identifierV2': [
                  {
                    'type': 'bf:ShelfMark',
                    'value': 'LD1237.5D 1989 .C166 9999'
                  },
                  {
                    'type': 'bf:Barcode',
                    'value': '10000201179999'
                  }
                ],
                'idBarcode': [
                  '10000201179999'
                ],
                'owner_packed': [
                  'orgs:0002||Columbia University Libraries'
                ],
                'requestable': [
                  true
                ],
                'catalogItemType': [
                  {
                    'label': 'non-circ',
                    'id': 'catalogItemType:1'
                  }
                ],
                'status': [
                  {
                    'label': 'Available ',
                    'id': 'status:a'
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }
}
