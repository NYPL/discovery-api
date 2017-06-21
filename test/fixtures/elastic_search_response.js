exports.fakeElasticSearchResponse = () => {
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
