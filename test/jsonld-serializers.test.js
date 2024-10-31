const { expect } = require('chai')

const { ResourceSerializer } = require('../lib/jsonld_serializers')

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
  })
})
