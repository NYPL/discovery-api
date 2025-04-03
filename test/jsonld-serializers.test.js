const { expect } = require('chai')

const {
  AggregationsSerializer,
  ItemResultsSerializer,
  ResourceSerializer
} = require('../lib/jsonld_serializers')

describe('JSONLD Serializers', () => {
  describe('ResourceSerializer', () => {
    it('enables hasItemDates when numItemsTotal is above thresshold', async () => {
      const esDoc = {
        uri: 'b123',
        numItemDatesParsed: [8],
        numItemsTotal: [10]
      }
      const serialized = await ResourceSerializer.serialize(esDoc)
      // When 8 of 10 items have parsed dates, we meet the min 80% thresshold:
      expect(serialized.hasItemDates).to.equal(true)
    })

    it('disables hasItemDates when numItemsTotal is below thresshold', async () => {
      const esDoc = {
        uri: 'b123',
        numItemDatesParsed: [7],
        numItemsTotal: [10]
      }
      const serialized = await ResourceSerializer.serialize(esDoc)
      // When 7 of 10 items have parsed dates, we fail the min 80% thresshold:
      expect(serialized.hasItemDates).to.equal(false)
    })

    it('enables hasItemDates when numItemsTotal is missing but numItems is above thresshold', async () => {
      const esDoc = {
        uri: 'b123',
        numItemDatesParsed: [8],
        numItems: [10]
      }
      const serialized = await ResourceSerializer.serialize(esDoc)
      // When 8 of 10 items have parsed dates, we meet the min 80% thresshold:
      expect(serialized.hasItemDates).to.equal(true)
    })

    it('disables hasItemDates when numItemsTotal is missing and numItems is below thresshold', async () => {
      const esDoc = {
        uri: 'b123',
        numItemDatesParsed: [7],
        numItems: [10]
      }
      const serialized = await ResourceSerializer.serialize(esDoc)
      // When 7 of 10 items have parsed dates, we fail the min 80% thresshold:
      expect(serialized.hasItemDates).to.equal(false)
    })

    it('disables hasItemDates when any counts are missing', async () => {
      await Promise.all([
        // No numItems or numItemsTotal set (unlikely):
        {
          uri: 'b123',
          numItemDatesParsed: [7]
        },
        // No numItemDatesParsed set:
        {
          uri: 'b123',
          numItems: [10]
        }
      ]
        .map(async (esDoc) => {
          const serialized = await ResourceSerializer.serialize(esDoc)
          expect(serialized.hasItemDates).to.equal(false)
        })
      )
    })

    describe('format', () => {
      it('adds label to format', async () => {
        const serialized = await ResourceSerializer.serialize({
          formatId: 'a'
        })
        expect(serialized.format).to.deep.equal([{
          '@id': 'a',
          prefLabel: 'Book/Text'
        }])
      })

      it('removes invalid format', async () => {
        const serialized = await ResourceSerializer.serialize({
          formatId: '!'
        })

        expect(serialized.format).to.be.a('null')
      })
    })
  })

  describe('ItemResultsSerializer', () => {
    const esItems = [
      {
        accessMessage: [{ id: 'accessMessage:2', label: 'Request in advance' }],
        catalogItemType: [{ id: 'catalogItemType:55', label: 'book, limited circ, MaRLI' }],
        holdingLocation: [{ id: 'loc:rc2ma', label: 'Offsite' }],
        identifier: [
          'urn:bnum:b10807029',
          'urn:shelfmark:JLE 83-2799',
          'urn:barcode:33433056867710'
        ],
        status: [{ id: 'status:a', label: 'Available' }],
        type: ['bf:Item'],
        uri: 'i12606717',
        recapCustomerCode: ['NA'],
        eddRequestable: true,
        deliveryLocation: [
          {
            id: 'loc:mal23',
            label: 'Schwarzman Building - Scholar Room 223',
            sortPosition: 0
          },
          {
            id: 'loc:mal',
            label: 'Schwarzman Building - Main Reading Room 315',
            sortPosition: 1
          },
          {
            id: 'loc:mab',
            label: 'Schwarzman Building - Art & Architecture Room 300',
            sortPosition: 2
          }
        ]
      }
    ]

    it('serializes delivery-lcoations-by-barcode response', async () => {
      const serialized = await ItemResultsSerializer.serialize(esItems)
      expect(serialized).to.nested.include({
        'itemListElement[0].@id': 'res:i12606717',
        'itemListElement[0].deliveryLocation[0].@id': 'loc:mal23',
        'itemListElement[0].deliveryLocation[0].prefLabel': 'Schwarzman Building - Scholar Room 223'
      })
    })
  })

  describe('AggregationsSerializer', () => {
    const esResponse = require('./fixtures/es-aggregations-response.json')
    // Perform flattening of nested aggregations, same as lib/resources.js
    // does (inline, unfortunately):
    const transformedEsResponse = Object.assign(
      {},
      esResponse,
      {
        aggregations: Object.entries(esResponse.aggregations)
          .reduce((transformed, [field, obj]) => {
            transformed[field] = obj._nested ? obj._nested : obj
            return transformed
          }, {})
      }
    )

    it('formats format agg', async () => {
      const serialized = await AggregationsSerializer.serialize(transformedEsResponse)

      const formatAgg = serialized.itemListElement
        .find((agg) => agg.id === 'format')
      expect(formatAgg).to.be.a('object')

      expect(formatAgg).to.nested.include({
        'values[0].value': 'a',
        'values[0].count': 2324674,
        'values[0].label': 'Book/Text'
      })

      const bucketsWithoutLabels = formatAgg.values
        .filter((val) => !val.label)
      expect(bucketsWithoutLabels).to.have.lengthOf(0)
    })
  })
})
